require('dotenv').config();
const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');

const captionRoutes = require('./routes/captions');
const audioRoutes = require('./routes/audio');

const { preloadModel } = require('./services/transcribeLocal');

const app = express();

// This server is a stateless processing service: it transcribes captions and
// applies audio effects, keeping nothing. There is no database — all user
// data (projects, captions, media) lives in the browser's local storage.

// Local dev origins plus the deployed frontend (FRONTEND_URL env var,
// comma-separated if more than one, e.g. "https://pardex.vercel.app").
// Vercel also serves the same project from several other URLs — a git-branch
// alias (pardex-video-editor-git-main-<team>.vercel.app) and a unique URL per
// deployment (pardex-video-editor-<hash>-<team>.vercel.app) — so match any
// *.vercel.app subdomain starting with the project name rather than only the
// one exact production URL.
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map((s) => s.trim()) : []),
];
const vercelPreviewPattern = /^https:\/\/pardex-video-editor(-[a-z0-9-]+)?\.vercel\.app$/;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || vercelPreviewPattern.test(origin)) {
      return callback(null, true);
    }
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.get('/', (req, res) => res.json({ success: true, message: 'Pardex API is running' }));

app.use('/api/captions', captionRoutes);
app.use('/api/audio', audioRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

(async () => {
  // Set WHISPER_PRELOAD=false on small servers so the app boots without
  // holding the model in memory; it then loads on the first caption request.
  if (process.env.WHISPER_PRELOAD !== 'false') {
    await preloadModel();
  }
  const server = app.listen(PORT, () => console.log(`Pardex server running on port ${PORT}`));

  // Caption/audio requests carry multi-hundred-MB video uploads and then wait
  // minutes for CPU transcription. Node's default requestTimeout (5 min) RSTs
  // the socket if the upload hasn't fully arrived by then — on a slow or
  // memory-pressured machine a big upload can exceed that, which surfaces in
  // the browser as net::ERR_CONNECTION_RESET. Disable the per-request clocks;
  // headersTimeout stays at its default so idle sockets still get cleaned up.
  server.requestTimeout = 0;
  server.timeout = 0;
  server.keepAliveTimeout = 60 * 1000;
})();
