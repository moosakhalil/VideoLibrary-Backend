import { verifyToken } from '../utils/jwt.js';

// Verifies an admin JWT (role === 'admin'). Token comes from the
// Authorization: Bearer header (the admin panel stores it separately).
export function requireAdmin(req, res, next) {
  try {
    let token = req.cookies?.adminToken;
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) token = header.slice(7);
    if (!token) return res.status(401).json({ error: 'Admin not authenticated' });

    const payload = verifyToken(token);
    if (payload.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired admin session' });
  }
}
