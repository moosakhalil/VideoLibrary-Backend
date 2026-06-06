import bcrypt from 'bcryptjs';
import Customer from '../models/Customer.js';
import { signToken } from '../utils/jwt.js';
import { buildCustomerView } from './meController.js';

const PIN_MIN = Number(process.env.PIN_MIN_LENGTH || 4);
const PIN_MAX = Number(process.env.PIN_MAX_LENGTH || 6);
const MAX_ATTEMPTS = Number(process.env.MAX_PIN_ATTEMPTS || 5);
const LOCK_MINUTES = Number(process.env.PIN_LOCK_MINUTES || 15);

// Keep only digits; trim. (Phones may be stored with country codes.)
function normalizePhone(phone) {
  return String(phone || '').replace(/[^\d+]/g, '').trim();
}

function isValidPin(pin) {
  return new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(String(pin || ''));
}

function genReferralCode() {
  // short, human-friendly code
  return 'REF' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function findByPhone(phone) {
  return Customer.findOne({ phoneNumber: phone });
}

function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: String(process.env.COOKIE_SECURE) === 'true',
    sameSite: 'lax',
    maxAge: 60 * 24 * 60 * 60 * 1000, // ~60 days
  });
}

// POST /api/web/auth/check-phone -> { hasPin }
export async function checkPhone(req, res) {
  const phone = normalizePhone(req.body.phone);
  if (!phone) return res.status(400).json({ error: 'Phone number is required' });

  const customer = await findByPhone(phone);
  res.json({
    exists: !!customer,
    hasPin: !!(customer && customer.pinHash),
  });
}

// POST /api/web/auth/register -> { token, customer }  (only if no PIN yet)
export async function register(req, res) {
  const phone = normalizePhone(req.body.phone);
  const { pin, pinConfirm } = req.body;

  if (!phone) return res.status(400).json({ error: 'Phone number is required' });
  if (!isValidPin(pin)) {
    return res
      .status(400)
      .json({ error: `PIN must be ${PIN_MIN}-${PIN_MAX} digits` });
  }
  if (pin !== pinConfirm) {
    return res.status(400).json({ error: 'PINs do not match' });
  }

  let customer = await findByPhone(phone);

  if (customer && customer.pinHash) {
    return res
      .status(409)
      .json({ error: 'This phone already has a PIN. Please log in instead.' });
  }

  if (!customer) {
    // Default for v1: auto-create a minimal customer record.
    customer = new Customer({
      phoneNumber: [phone],
      referralCode: genReferralCode(),
    });
  }

  customer.pinHash = await bcrypt.hash(String(pin), 10);
  customer.pinSetAt = new Date();
  customer.failedPinAttempts = 0;
  customer.pinLockedUntil = null;
  if (!customer.referralCode) customer.referralCode = genReferralCode();
  await customer.save();

  const token = signToken(customer._id.toString());
  setAuthCookie(res, token);
  res.json({ token, customer: await buildCustomerView(customer) });
}

// POST /api/web/auth/login -> { token, customer }
export async function login(req, res) {
  const phone = normalizePhone(req.body.phone);
  const { pin } = req.body;

  if (!phone || !pin) {
    return res.status(400).json({ error: 'Phone and PIN are required' });
  }

  const customer = await findByPhone(phone);
  if (!customer || !customer.pinHash) {
    return res.status(404).json({ error: 'No PIN set for this phone. Please sign up.' });
  }

  // Brute-force lock
  if (customer.pinLockedUntil && customer.pinLockedUntil.getTime() > Date.now()) {
    const mins = Math.ceil((customer.pinLockedUntil.getTime() - Date.now()) / 60000);
    return res
      .status(429)
      .json({ error: `Too many wrong PINs. Try again in ${mins} minute(s).` });
  }

  const ok = await bcrypt.compare(String(pin), customer.pinHash);
  if (!ok) {
    customer.failedPinAttempts = (customer.failedPinAttempts || 0) + 1;
    if (customer.failedPinAttempts >= MAX_ATTEMPTS) {
      customer.pinLockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
      customer.failedPinAttempts = 0;
      await customer.save();
      return res
        .status(429)
        .json({ error: `Too many wrong PINs. Locked for ${LOCK_MINUTES} minutes.` });
    }
    await customer.save();
    const left = MAX_ATTEMPTS - customer.failedPinAttempts;
    return res.status(401).json({ error: `Wrong PIN. ${left} attempt(s) left.` });
  }

  // Success — reset counters
  customer.failedPinAttempts = 0;
  customer.pinLockedUntil = null;
  await customer.save();

  const token = signToken(customer._id.toString());
  setAuthCookie(res, token);
  res.json({ token, customer: await buildCustomerView(customer) });
}

// POST /api/web/auth/logout
export async function logout(req, res) {
  res.clearCookie('token');
  res.json({ ok: true });
}
