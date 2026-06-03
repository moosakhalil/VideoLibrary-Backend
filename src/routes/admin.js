import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAdmin } from '../middleware/adminAuth.js';
import { uploadVideoFiles } from '../middleware/uploadVideo.js';
import {
  adminLogin,
  listVideos,
  createVideo,
  updateVideo,
  deleteVideo,
  listCategories,
  updateCategory,
  listSubmissions,
  moderateSubmission,
  listCustomers,
  addReferral,
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

// Status moderation
router.get('/status', listSubmissions);
router.patch('/status/:id', moderateSubmission);

// Customers + referrals
router.get('/customers', listCustomers);
router.post('/customers/:id/referrals', addReferral);
router.post('/customers/:id/reset-pin', resetCustomerPin);

export default router;
