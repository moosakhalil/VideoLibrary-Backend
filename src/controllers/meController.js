import PersonalDiscount from '../models/PersonalDiscount.js';
import {
  LEVELS,
  computeLevel,
  computeNextLevel,
  computeKeepAlive,
  evaluateCustomer,
} from '../utils/rewardEngine.js';

// A safe, PIN-free view of the customer for the front-end.
export async function buildCustomerView(customer) {
  await evaluateCustomer(customer); // keep results fresh on every load

  const referralCount = customer.referralCount();
  const verifiedStatusCount = customer.verifiedStatusCount();
  const level = computeLevel(referralCount, verifiedStatusCount);
  const keepAlive = computeKeepAlive(customer);

  return {
    id: customer._id,
    name: customer.name,
    phone: customer.phoneNumber?.[0] || '',
    language: customer.language,
    referralCode: customer.referralCode,
    badge: {
      index: level ? level.index : 0,
      name: level ? level.name : 'No badge yet',
      reward: level ? level.reward : '',
      isInactive: keepAlive.isInactive,
    },
    referralCount,
    verifiedStatusCount,
    vipCatalogAccess: {
      isActive: customer.vipCatalogAccess?.isActive || false,
      expiresAt: customer.vipCatalogAccess?.expiresAt || null,
    },
  };
}

// GET /api/web/me
export async function getMe(req, res) {
  res.json({ customer: await buildCustomerView(req.customer) });
}

// GET /api/web/me/progress — the AND-gate math
export async function getProgress(req, res) {
  const c = req.customer;
  const referralCount = c.referralCount();
  const verifiedStatusCount = c.verifiedStatusCount();

  const current = computeLevel(referralCount, verifiedStatusCount);
  const next = computeNextLevel(referralCount, verifiedStatusCount);
  const keepAlive = computeKeepAlive(c);

  let message = 'You have reached the top level — amazing work! 🎉';
  if (next) {
    const parts = [];
    if (next.referralsNeeded > 0) parts.push(`${next.referralsNeeded} more warm lead(s)`);
    if (next.statusesNeeded > 0) parts.push(`${next.statusesNeeded} more status(es)`);
    message = `Get ${parts.join(' AND ')} to reach ${next.level.name}.`;
  }

  res.json({
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
    keepAlive,
    levels: LEVELS,
  });
}

// GET /api/web/me/rewards
export async function getRewards(req, res) {
  const c = req.customer;
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
      isActive: c.vipCatalogAccess?.isActive || false,
      expiresAt: c.vipCatalogAccess?.expiresAt || null,
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
