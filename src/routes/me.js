import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getMe, getProgress, getRewards, updateMe } from '../controllers/meController.js';
import { getReferral, getReferrals } from '../controllers/referralController.js';
import { listStatus } from '../controllers/statusController.js';

const router = Router();

router.use(requireAuth); // everything below needs a valid JWT

router.get('/', getMe);
router.patch('/', updateMe);
router.get('/progress', getProgress);
router.get('/rewards', getRewards);

router.get('/referral', getReferral);
router.get('/referrals', getReferrals);

// Read-only: status submission/verification now lives in construction.
router.get('/status', listStatus);

export default router;
