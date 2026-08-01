const fs = require('fs');
const { transcribeLocal } = require('../services/transcribeLocal');

// Stateless transcription: the video arrives with this request only so
// Whisper can hear the audio, lives in the OS temp folder for the duration
// of transcription, and is deleted in the `finally` below. The resulting
// caption text is returned to the browser, which stores it locally —
// nothing is kept on the server.
exports.generateCaptions = async (req, res, next) => {
  const tempPath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No video file received for transcription.' });
    }

    const language = ['english', 'hindi', 'hinglish'].includes(req.body?.language)
      ? req.body.language
      : 'english';

    let segments;
    try {
      segments = await transcribeLocal(tempPath, language);
    } catch (err) {
      return res.status(502).json({
        success: false,
        message: `Transcription failed: ${err.message}. Please try again.`,
      });
    }
    if (!segments.length) {
      return res.status(422).json({
        success: false,
        message: 'No speech was detected in this video.',
      });
    }

    res.status(200).json({ success: true, data: { segments } });
  } catch (error) {
    next(error);
  } finally {
    if (tempPath) fs.unlink(tempPath, () => {});
  }
};
