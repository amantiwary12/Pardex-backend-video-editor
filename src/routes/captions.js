const express = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');
const { generateCaptions } = require('../controllers/captionController');

// Disk storage (OS temp) so large videos aren't buffered in RAM. The file is
// transient — captionController deletes it as soon as transcription ends.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, os.tmpdir()),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `pardex-transcribe-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/x-matroska', 'video/avi'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Only video files (MP4, MOV, WebM, MKV, AVI) are allowed'));
  },
});

const router = express.Router();

// Stateless — no auth, no database. The browser owns all project data.
router.post('/generate', upload.single('video'), generateCaptions);

module.exports = router;
