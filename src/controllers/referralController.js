import { getDerivedProgress } from '../services/progressService.js';

// GET /api/web/me/referral — code + share link + share text
export async function getReferral(req, res) {
  const c = req.customer;
  const base = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  const shareLink = `${base}/?ref=${encodeURIComponent(c.referralCode || '')}`;
  const shareText =
    `Join me and learn from these free construction-material knowledge videos! ` +
    `Use my code ${c.referralCode}: ${shareLink}`;

  res.json({
    referralCode: c.referralCode,
    shareLink,
    shareText,
    whatsappShareUrl: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
  });
}

// GET /api/web/me/referrals — warm-lead count (from construction). The per-person
// list lives in construction and isn't exposed through the progress API, so the
// website shows the summary count only.
export async function getReferrals(req, res) {
  const { referralCount } = await getDerivedProgress(req.customer);
  res.json({
    total: referralCount,
    qualified: referralCount, // all counted warm leads qualify toward levels
    becameCustomers: 0, // not surfaced by the construction progress API
    people: [],
  });
}
