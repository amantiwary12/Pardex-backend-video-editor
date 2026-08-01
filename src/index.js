require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const captionRoutes = require('./routes/captions');
const exportRoutes = require('./routes/exports');
const audioRoutes = require('./routes/audio');

const { preloadModel } = require('./services/transcribeLocal');

const app = express();

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

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/captions', captionRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/audio', audioRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();
  await preloadModel();
  app.listen(PORT, () => console.log(`Pardex server running on port ${PORT}`));
})();
