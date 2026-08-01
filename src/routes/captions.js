const express = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');
const { generateCaptions, getCaptions, updateCaptions } = require('../controllers/captionController');
const { protect } = require('../middleware/auth');

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

router.use(protect);
router.post('/generate/:projectId', upload.single('video'), generateCaptions);
router.route('/:projectId').get(getCaptions).put(updateCaptions);

module.exports = router;
