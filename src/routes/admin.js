import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAdmin } from '../middleware/adminAuth.js';
import { uploadVideoFiles, uploadVideoFile } from '../middleware/uploadVideo.js';
import {
  adminLogin,
  listVideos,
  createVideo,
  updateVideo,
  deleteVideo,
  listCategories,
  updateCategory,
  listStatusVideos,
  saveStatusVideos,
  saveStatusVideo,
  deleteStatusVideo,
  listDatedVideos,
  saveDatedVideo,
  deleteDatedVideo,
  resetCustomerPin,
} from '../controllers/adminController.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again later.' },
});

router.post('/login', loginLimiter, adminLogin);

// Everything below requires an admin token.
router.use(requireAdmin);

// Videos
router.get('/videos', listVideos);
router.post('/videos', (req, res) => {
  uploadVideoFiles(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    return createVideo(req, res);
  });
});
router.patch('/videos/:id', updateVideo);
router.delete('/videos/:id', deleteVideo);

// Categories
router.get('/categories', listCategories);
router.patch('/categories/:id', updateCategory);

// Status videos (YouTube link per WhatsApp status 1..60)
router.get('/status-videos', listStatusVideos);
router.put('/status-videos', saveStatusVideos); // bulk
router.put('/status-videos/:n', saveStatusVideo); // save/edit one
router.delete('/status-videos/:n', deleteStatusVideo); // delete one

// Dated feature videos (promotional / today)
router.get('/dated-videos', listDatedVideos);
router.post('/dated-videos', (req, res) => {
  uploadVideoFile(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    return saveDatedVideo(req, res);
  });
});
router.delete('/dated-videos/:id', deleteDatedVideo);

// Customer PIN reset (login support only — referrals/status live in construction)
router.post('/customers/:id/reset-pin', resetCustomerPin);

export default router;
