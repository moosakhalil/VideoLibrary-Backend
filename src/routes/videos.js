import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getCategories, getLibrary } from '../controllers/videoController.js';

const router = Router();

router.use(requireAuth);

router.get('/categories', getCategories);
router.get('/library', getLibrary);

export default router;
