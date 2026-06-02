import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { checkPhone, register, login, logout } from '../controllers/authController.js';

const router = Router();

// Rate-limit auth attempts per IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please slow down and try again later.' },
});

router.post('/check-phone', authLimiter, checkPhone);
router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', logout);

export default router;
