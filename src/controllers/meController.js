import PersonalDiscount from '../models/PersonalDiscount.js';
import { LEVELS } from '../utils/rewardEngine.js';
import { getDerivedProgress } from '../services/progressService.js';

// A safe, PIN-free view of the customer for the front-end.
// Referral/status counts, badge and VIP now come from Construction (recomputed
// locally from the two counts); identity fields stay local.
export async function buildCustomerView(customer) {
  const p = await getDerivedProgress(customer);

  return {
    id: customer._id,
    name: customer.name,
    phone: customer.phoneNumber?.[0] || '',
    language: customer.language,
    referralCode: customer.referralCode,
    found: p.found, // false => not in the construction rewards system yet
    badge: {
      index: p.badgeIndex,
      name: p.level ? p.level.name : 'No badge yet',
      reward: p.level ? p.level.reward : '',
      isInactive: false, // keep-alive lives in construction now
    },
    referralCount: p.referralCount,
    verifiedStatusCount: p.verifiedStatusCount,
    vipCatalogAccess: {
      isActive: p.vipActive,
      expiresAt: null, // construction owns VIP timing; only isActive is surfaced
    },
  };
}

// GET /api/web/me
export async function getMe(req, res) {
  res.json({ customer: await buildCustomerView(req.customer) });
}

// GET /api/web/me/progress — the AND-gate math, fed by construction counts.
export async function getProgress(req, res) {
  const p = await getDerivedProgress(req.customer);
  const { found, referralCount, verifiedStatusCount, level: current, next } = p;

  let message = 'You have reached the top level — amazing work! 🎉';
  if (next) {
    const parts = [];
    if (next.referralsNeeded > 0) parts.push(`${next.referralsNeeded} more warm lead(s)`);
    if (next.statusesNeeded > 0) parts.push(`${next.statusesNeeded} more status(es)`);
    message = `Get ${parts.join(' AND ')} to reach ${next.level.name}.`;
  }

  res.json({
    found,
    current: current
      ? { index: current.index, name: current.name, reward: current.reward }
      : { index: 0, name: 'No badge yet', reward: '' },
    referrals: {
      have: referralCount,
      need: next ? next.level.referrals : current?.referrals || referralCount,
    },
    statuses: {
      have: verifiedStatusCount,
      need: next ? next.level.statuses : current?.statuses || verifiedStatusCount,
    },
    next: next
      ? {
          name: next.level.name,
          referralsNeeded: next.referralsNeeded,
          statusesNeeded: next.statusesNeeded,
        }
      : null,
    message,
    keepAlive: null, // activity recency is tracked in construction, not here
    levels: LEVELS,
  });
}

// GET /api/web/me/rewards — VIP from construction; discounts from the local ledger.
export async function getRewards(req, res) {
  const c = req.customer;
  const p = await getDerivedProgress(c);
  const discounts = await PersonalDiscount.find({ customerId: c._id }).sort({ createdAt: -1 });

  const view = discounts.map((d) => ({
    id: d._id,
    grantType: d.grantType,
    discountValue: d.discountValue,
    grantedForLevel: d.grantedForLevel,
    state: d.state, // available | used | expired
    createdAt: d.createdAt,
    usedAt: d.usedAt,
  }));

  res.json({
    discounts: view,
    vipCatalog: {
      isActive: p.vipActive,
      expiresAt: null,
    },
  });
}

// PATCH /api/web/me — update simple profile fields
export async function updateMe(req, res) {
  const c = req.customer;
  const { name, language } = req.body;
  if (typeof name === 'string') c.name = name;
  if (typeof language === 'string') c.language = language;
  await c.save();
  res.json({ customer: await buildCustomerView(c) });
}
