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
// comma-separated if more than one, e.g. "https://pardex.vercel.app")
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',').map((s) => s.trim()) : []),
];
app.use(cors({ origin: allowedOrigins, credentials: true }));
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
  app.listen(PORT, () => console.log(`Pardex server running on port ${PORT}`));
})();
