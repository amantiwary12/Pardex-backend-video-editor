const fs = require('fs');
const path = require('path');
const os = require('os');
const { pipeline } = require('@xenova/transformers');
const ffmpeg = require('fluent-ffmpeg');

const ffmpegPath = require('ffmpeg-static');
if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

const { toHinglish } = require('./hinglish');

const round2 = (n) => parseFloat((n || 0).toFixed(2));

// Caption language presets. Whisper's 'translate' task turns any spoken
// language into English text; 'transcribe' keeps the spoken language.
const LANGUAGE_PRESETS = {
  english: { task: 'translate' },                                        // any speech → English captions
  hindi: { language: 'hindi', task: 'transcribe' },                      // Hindi speech → हिंदी captions
  hinglish: { language: 'hindi', task: 'transcribe', romanize: true },   // Hindi speech → "kya kar rahe ho"
};

// Whisper Small (multilingual, ~190MB quantized) — fits in RAM on modest
// laptops, unlike Large V3 (~1.5GB) which OOMs on 8GB machines.
// On Render's free tier (512MB RAM) even whisper-small OOMs mid-transcription
// (observed peak 465-855MB): the instance is killed and the browser sees the
// connection drop with no response. Render sets RENDER=true in every service's
// env, so default to whisper-tiny there; WHISPER_MODEL always wins if set.
const ON_SMALL_SERVER = process.env.RENDER === 'true' || process.env.SMALL_SERVER === 'true';
const WHISPER_MODEL = process.env.WHISPER_MODEL
  || (ON_SMALL_SERVER ? 'Xenova/whisper-tiny' : 'Xenova/whisper-small');

let transcriber = null;

async function getTranscriber() {
  if (!transcriber) {
    console.log(`[whisper] Loading ${WHISPER_MODEL} (first load downloads the model)…`);
    const start = Date.now();
    transcriber = await pipeline('automatic-speech-recognition', WHISPER_MODEL, {
      quantized: true,
    });
    console.log(`[whisper] Model loaded in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  }
  return transcriber;
}

function extractAudio(videoUrl, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoUrl)
      .noVideo()
      .audioCodec('pcm_s16le')
      .audioFrequency(16000)
      .audioChannels(1)
      .format('s16le')
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(new Error(`FFmpeg: ${err.message}`)))
      .save(outputPath);
  });
}

function rawPcmToFloat32(filePath) {
  const buffer = fs.readFileSync(filePath);
  const int16 = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 2);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }
  return float32;
}

function splitIntoSentences(text) {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const raw = trimmed.split(/(?<=[.!?।॥])\s+/);
  return raw.map(s => s.trim()).filter(Boolean);
}

function buildSegments(result, durationSec) {
  const allSegments = [];

  const chunks = result?.chunks?.length ? result.chunks : (
    result?.text ? [{ timestamp: [0, durationSec || 30], text: result.text }] : []
  );

  chunks.forEach((chunk, ci) => {
    const text = chunk.text.trim();
    if (!text) return;
    const chunkStart = round2(chunk.timestamp?.[0] ?? 0);
    // Whisper sometimes returns null for the final chunk's end — fall back to
    // the audio duration instead of dropping the chunk.
    const rawEnd = chunk.timestamp?.[1];
    const chunkEnd = round2(rawEnd == null ? Math.max(durationSec || 0, chunkStart + 1) : rawEnd);
    const chunkDur = chunkEnd - chunkStart;
    if (chunkDur <= 0) return;

    const allChunkWords = text.split(/\s+/);
    const totalWords = allChunkWords.length;

    const sentences = splitIntoSentences(text);

    let wordOffset = 0;
    let sentenceCursor = chunkStart;

    sentences.forEach((sentence, si) => {
      const sWords = sentence.split(/\s+/);
      const wordCount = sWords.length;
      const ratio = wordCount / totalWords;
      const sDur = ratio * chunkDur;
      const sEnd = si < sentences.length - 1
        ? round2(sentenceCursor + sDur)
        : chunkEnd;

      const wordDur = sEnd - sentenceCursor > 0 && wordCount > 0
        ? (sEnd - sentenceCursor) / wordCount
        : 0.3;

      const wordObjs = sWords.map((w, j) => ({
        // strip punctuation but keep letters in any script (Devanagari etc.)
        word: w.replace(/[^\p{L}\p{M}\p{N}'\-]/gu, ''),
        start: round2(sentenceCursor + j * wordDur),
        end: round2(sentenceCursor + (j + 1) * wordDur),
      }));

      allSegments.push({
        id: `seg-${ci}-${si}-${Math.round(sentenceCursor * 1000)}`,
        start: sentenceCursor,
        end: sEnd,
        text: sentence,
        words: wordObjs,
      });

      wordOffset += wordCount;
      sentenceCursor = sEnd;
    });
  });

  return allSegments;
}

const SAMPLE_RATE = 16000;

// transformers.js accumulates memory for the whole input across a single
// pipeline call — for a 27-minute video this grew past 4.5GB and OOM'd on an
// 8GB machine. Transcribing in bounded windows (separate calls) keeps peak
// memory roughly constant no matter how long the video is. Override via
// WHISPER_WINDOW_SECONDS if a server has more RAM to spare (fewer, larger
// windows means less boundary-splitting of words, but higher peak memory).
const WINDOW_SECONDS = Number(process.env.WHISPER_WINDOW_SECONDS)
  || (ON_SMALL_SERVER ? 45 : 120);

async function transcribeLocal(videoUrl, language = 'english') {
  const preset = LANGUAGE_PRESETS[language] || LANGUAGE_PRESETS.english;
  const audioPath = path.join(os.tmpdir(), `whisper-${Date.now()}.raw`);

  try {
    console.log('[whisper] Extracting audio from video…');
    await extractAudio(videoUrl, audioPath);

    const samples = rawPcmToFloat32(audioPath);
    const durationSec = samples.length / SAMPLE_RATE;
    console.log(`[whisper] Audio extracted (${durationSec.toFixed(1)}s, ${samples.length} samples)`);

    if (samples.length < SAMPLE_RATE) {
      console.warn('[whisper] Audio too short (<1s), returning empty');
      return [];
    }

    const tr = await getTranscriber();

    console.log(`[whisper] Transcribing (${language})…`);
    const startTs = Date.now();
    const windowSamples = WINDOW_SECONDS * SAMPLE_RATE;
    const windowCount = Math.ceil(samples.length / windowSamples);
    let segments = [];

    for (let w = 0; w < windowCount; w++) {
      const offset = w * windowSamples;
      const end = Math.min(offset + windowSamples, samples.length);
      const windowStart = offset / SAMPLE_RATE;
      const windowDur = (end - offset) / SAMPLE_RATE;

      console.log(`[whisper] Window ${w + 1}/${windowCount} (${windowStart.toFixed(0)}s–${(windowStart + windowDur).toFixed(0)}s)…`);
      const result = await tr(samples.subarray(offset, end), {
        return_timestamps: true,
        chunk_length_s: 30,
        stride_length_s: 5,
        task: preset.task,
        ...(preset.language ? { language: preset.language } : {}),
      });

      const windowSegments = buildSegments(result, windowDur).map((s) => ({
        ...s,
        id: `w${w}-${s.id}`,
        start: round2(s.start + windowStart),
        end: round2(s.end + windowStart),
        words: s.words.map((wd) => ({
          ...wd,
          start: round2(wd.start + windowStart),
          end: round2(wd.end + windowStart),
        })),
      }));
      segments.push(...windowSegments);
    }
    console.log(`[whisper] Done in ${((Date.now() - startTs) / 1000).toFixed(1)}s`);

    if (preset.romanize) {
      segments = segments.map(s => ({
        ...s,
        text: toHinglish(s.text),
        words: s.words.map(w => ({ ...w, word: toHinglish(w.word) })),
      }));
    }

    console.log(`[whisper] Generated ${segments.length} segments`);

    return segments;
  } catch (err) {
    console.error('[whisper] Error:', err.message);
    throw err;
  } finally {
    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
  }
}

async function preloadModel() {
  console.log('[whisper] Preloading model on startup…');
  try {
    await getTranscriber();
    console.log('[whisper] Preload complete');
  } catch (err) {
    console.error('[whisper] Preload failed:', err.message);
  }
}

module.exports = { transcribeLocal, preloadModel };
