const os = require('os');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

const ffmpegPath = require('ffmpeg-static');
if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

// Voice-change presets built from ffmpeg's stock audio filters — no ML models,
// so these run instantly and work offline.
//  - deep/chipmunk: classic asetrate+atempo pitch-shift-without-speed-change trick
//  - robot: vibrato (wavering pitch) + short echo for a metallic/robotic timbre
//  - radio: narrow bandpass + compression to mimic an old radio/telephone speaker
const VOICE_EFFECTS = {
  deep: 'asetrate=44100*0.8,aresample=44100,atempo=1.25',
  chipmunk: 'asetrate=44100*1.35,aresample=44100,atempo=0.74',
  robot: 'vibrato=f=6:d=0.9,aecho=0.8:0.9:8:0.4',
  radio: 'highpass=f=300,lowpass=f=3400,acompressor=threshold=-18dB:ratio=4:attack=5:release=50',
};

// Builds a single -af filter chain from the requested effect flags. Effects
// are always computed from the ORIGINAL audio (never stacked on a previous
// processed result), so toggling effects on/off stays predictable.
function buildFilterChain({ noiseReduction, vocalRemoval, voiceEffect }) {
  const filters = [];

  if (vocalRemoval) {
    // Center-channel cancellation — subtracts what's identical in both
    // stereo channels. Removes a hard-center-panned lead vocal reasonably
    // well; it's a DSP trick, not true ML source separation, so results
    // vary with how the track was mixed and mono audio can't be processed.
    filters.push('pan=stereo|c0=0.5*c0-0.5*c1|c1=0.5*c1-0.5*c0');
  }
  if (noiseReduction) {
    filters.push('afftdn=nf=-25'); // FFT-based denoise, -25dB noise floor
  }
  if (voiceEffect && voiceEffect !== 'none' && VOICE_EFFECTS[voiceEffect]) {
    filters.push(VOICE_EFFECTS[voiceEffect]);
  }

  return filters.length ? filters.join(',') : null;
}

function extractAudioToFile(videoUrl) {
  const outputPath = path.join(os.tmpdir(), `pardex-audio-${Date.now()}.mp3`);
  return new Promise((resolve, reject) => {
    ffmpeg(videoUrl)
      .noVideo()
      .audioCodec('libmp3lame')
      .audioBitrate(128)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(new Error(`Audio extraction failed: ${err.message}`)))
      .save(outputPath);
  });
}

function applyFilterChain(inputUrl, filterChain) {
  const outputPath = path.join(os.tmpdir(), `pardex-audio-fx-${Date.now()}.mp3`);
  return new Promise((resolve, reject) => {
    let cmd = ffmpeg(inputUrl).audioCodec('libmp3lame').audioBitrate(128);
    if (filterChain) cmd = cmd.audioFilters(filterChain);
    cmd
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(new Error(`Audio processing failed: ${err.message}`)))
      .save(outputPath);
  });
}

module.exports = {
  buildFilterChain,
  extractAudioToFile,
  applyFilterChain,
};
