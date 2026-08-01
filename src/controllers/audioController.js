const fs = require('fs');
const {
  buildFilterChain,
  extractAudioToFile,
  applyFilterChain,
} = require('../services/audioProcessing');

// Stateless audio processing: media is NEVER stored on the server or in the
// database. Files arrive with the request, are processed in the OS temp
// folder, streamed straight back, and every temp file is deleted after.

const unlinkQuiet = (p) => { if (p) fs.unlink(p, () => {}); };

const streamMp3 = (res, filePath, filename, onDone) => {
  res.set({
    'Content-Type': 'audio/mpeg',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': fs.statSync(filePath).size,
  });
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
  stream.on('close', onDone);
  stream.on('error', onDone);
};

// POST /api/audio/extract — multipart field 'video' → mp3 bytes
exports.extractFromVideo = async (req, res, next) => {
  const tempPath = req.file?.path;
  let outPath;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No video file received' });
    }
    outPath = await extractAudioToFile(tempPath);
    streamMp3(res, outPath, 'extracted-audio.mp3', () => {
      unlinkQuiet(tempPath);
      unlinkQuiet(outPath);
    });
  } catch (error) {
    unlinkQuiet(tempPath);
    unlinkQuiet(outPath);
    next(error);
  }
};

// POST /api/audio/process — multipart field 'audio' + effect flags → mp3 bytes
exports.applyEffects = async (req, res, next) => {
  const tempPath = req.file?.path;
  let outPath;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No audio file received' });
    }

    // Multipart form fields arrive as strings
    const noiseReduction = req.body.noiseReduction === 'true';
    const vocalRemoval = req.body.vocalRemoval === 'true';
    const voiceEffect = ['none', 'deep', 'chipmunk', 'robot', 'radio'].includes(req.body.voiceEffect)
      ? req.body.voiceEffect
      : 'none';

    const filterChain = buildFilterChain({ noiseReduction, vocalRemoval, voiceEffect });
    if (!filterChain) {
      return res.status(400).json({ success: false, message: 'No effects selected' });
    }

    outPath = await applyFilterChain(tempPath, filterChain);
    streamMp3(res, outPath, 'processed-audio.mp3', () => {
      unlinkQuiet(tempPath);
      unlinkQuiet(outPath);
    });
  } catch (error) {
    unlinkQuiet(tempPath);
    unlinkQuiet(outPath);
    next(error);
  }
};
