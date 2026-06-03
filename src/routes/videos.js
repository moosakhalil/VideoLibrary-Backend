import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getCategories, getLibrary, getFeatured } from '../controllers/videoController.js';

const router = Router();

router.use(requireAuth);

router.get('/categories', getCategories);
router.get('/featured', getFeatured);
router.get('/library', getLibrary);

export default router;
