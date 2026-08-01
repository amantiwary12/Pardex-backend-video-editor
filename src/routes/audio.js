const express = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');
const { extractFromVideo, applyEffects } = require('../controllers/audioController');

// Temp-only storage — controllers delete these files right after processing.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, os.tmpdir()),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.bin';
    cb(null, `pardex-audio-temp-${Date.now()}${ext}`);
  },
});

const uploadVideo = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/x-matroska', 'video/avi'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only video files (MP4, MOV, WebM, MKV, AVI) are allowed'));
  },
});

const uploadAudio = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/aac', 'audio/mp4', 'audio/x-m4a', 'audio/webm'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only audio files (MP3, WAV, OGG, AAC, M4A) are allowed'));
  },
});

const router = express.Router();

router.post('/extract', uploadVideo.single('video'), extractFromVideo);
router.post('/process', uploadAudio.single('audio'), applyEffects);

module.exports = router;
