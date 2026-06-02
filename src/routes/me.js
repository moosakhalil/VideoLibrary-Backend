import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { uploadStatusImage } from '../middleware/upload.js';
import { getMe, getProgress, getRewards, updateMe } from '../controllers/meController.js';
import { getReferral, getReferrals } from '../controllers/referralController.js';
import { submitStatus, listStatus } from '../controllers/statusController.js';

const router = Router();

router.use(requireAuth); // everything below needs a valid JWT

router.get('/', getMe);
router.patch('/', updateMe);
router.get('/progress', getProgress);
router.get('/rewards', getRewards);

router.get('/referral', getReferral);
router.get('/referrals', getReferrals);

router.get('/status', listStatus);
router.post('/status', (req, res) => {
  uploadStatusImage(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    return submitStatus(req, res);
  });
});

export default router;
