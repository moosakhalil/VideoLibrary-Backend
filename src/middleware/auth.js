import { verifyToken } from '../utils/jwt.js';
import Customer from '../models/Customer.js';

// Verifies our own JWT locally (no external calls) and loads the customer.
// Accepts token from HTTP-only cookie OR Authorization: Bearer header.
export async function requireAuth(req, res, next) {
  try {
    let token = req.cookies?.token;
    const header = req.headers.authorization;
    if (!token && header && header.startsWith('Bearer ')) {
      token = header.slice(7);
    }
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const payload = verifyToken(token);
    const customer = await Customer.findById(payload.customerId);
    if (!customer) {
      return res.status(401).json({ error: 'Account not found' });
    }

    req.customer = customer; // each customer can only ever reach their own record
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}
