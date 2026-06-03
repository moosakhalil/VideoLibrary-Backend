import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import { connectDB } from './src/config/db.js';
import { ensureCategories } from './src/models/Category.js';
import { migrateVideoCategories } from './src/models/KnowledgeVideo.js';
import authRoutes from './src/routes/auth.js';
import meRoutes from './src/routes/me.js';
import videoRoutes from './src/routes/videos.js';
import adminRoutes from './src/routes/admin.js';
import { UPLOAD_DIR } from './src/middleware/upload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Serve uploaded status screenshots
app.use('/uploads', express.static(UPLOAD_DIR));

// Health check
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'rewards-api' }));

// Routes
app.use('/api/web/auth', authRoutes);
app.use('/api/web/me', meRoutes);
app.use('/api/web/videos', videoRoutes);
app.use('/api/web/admin', adminRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const PORT = process.env.PORT || 5000;

connectDB()
  .then(async () => {
    await ensureCategories();
    await migrateVideoCategories();
    app.listen(PORT, () => console.log(`🚀 API listening on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('❌ Failed to start:', err.message);
    process.exit(1);
  });
