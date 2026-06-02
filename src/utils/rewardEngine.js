import PersonalDiscount from '../models/PersonalDiscount.js';

// The 7 reward levels — a customer reaches a level only when BOTH the referral
// count AND the verified WhatsApp-status count meet the row's thresholds.
// index is 1-based; index 0 means "no badge yet".
export const LEVELS = [
  { index: 1, name: 'First Referral Knowledge', referrals: 1, statuses: 1, discount: 0, vip: false, reward: 'Recognition only' },
  { index: 2, name: 'Bronze Knowledge', referrals: 5, statuses: 3, discount: 1, vip: false, reward: '1% off on next buy' },
  { index: 3, name: 'Silver Knowledge', referrals: 10, statuses: 5, discount: 1, vip: false, reward: '1% off on next buy' },
  { index: 4, name: 'Gold Knowledge', referrals: 15, statuses: 10, discount: 1, vip: false, reward: '1% off on next buy' },
  { index: 5, name: 'Platinum Knowledge', referrals: 25, statuses: 12, discount: 1, vip: false, reward: '1% off on next buy' },
  { index: 6, name: 'Knowledge Master', referrals: 40, statuses: 14, discount: 1, vip: true, reward: '1% off on next buy + VIP batch catalog (2 days)' },
  { index: 7, name: 'Knowledge Ambassador', referrals: 40, statuses: 16, discount: 1, vip: true, reward: '1% off on next buy + VIP batch catalog (2 days)' },
];

export const VIP_ACCESS_DAYS = 2;
export const KEEP_ALIVE_WINDOW_DAYS = 90;
export const KEEP_ALIVE_REQUIRED = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

// Highest level whose BOTH thresholds are satisfied (the AND gate).
export function computeLevel(referralCount, verifiedStatusCount) {
  let earned = null;
  for (const level of LEVELS) {
    if (referralCount >= level.referrals && verifiedStatusCount >= level.statuses) {
      earned = level;
    }
  }
  return earned; // null = no badge yet
}

// The first level not yet reached, plus exactly what's still needed.
export function computeNextLevel(referralCount, verifiedStatusCount) {
  for (const level of LEVELS) {
    const haveReferrals = referralCount >= level.referrals;
    const haveStatuses = verifiedStatusCount >= level.statuses;
    if (!haveReferrals || !haveStatuses) {
      return {
        level,
        referralsNeeded: Math.max(0, level.referrals - referralCount),
        statusesNeeded: Math.max(0, level.statuses - verifiedStatusCount),
      };
    }
  }
  return null; // already at the top level
}

// "3 qualifying activities (referrals + verified statuses) within the last 90 days".
// Falling short flags inactive but NEVER downgrades the badge.
export function computeKeepAlive(customer) {
  const cutoff = Date.now() - KEEP_ALIVE_WINDOW_DAYS * DAY_MS;

  const recentReferrals = (customer.customersReferred || []).filter(
    (p) => p.repliedWithHi && p.referredAt && new Date(p.referredAt).getTime() >= cutoff
  ).length;

  const recentStatuses = (customer.whatsappStatusStats?.history || []).filter(
    (h) => h.verifiedAt && new Date(h.verifiedAt).getTime() >= cutoff
  ).length;

  const recentActivities = recentReferrals + recentStatuses;
  const isInactive = recentActivities < KEEP_ALIVE_REQUIRED;

  return {
    recentActivities,
    required: KEEP_ALIVE_REQUIRED,
    windowDays: KEEP_ALIVE_WINDOW_DAYS,
    moreNeeded: Math.max(0, KEEP_ALIVE_REQUIRED - recentActivities),
    isInactive,
    isActive: !isInactive,
  };
}

// Re-evaluate a customer's badge, VIP access, keep-alive flag, and grant any
// newly-earned 1% discounts. Persists changes and returns a summary.
export async function evaluateCustomer(customer) {
  const referralCount = customer.referralCount();
  const verifiedStatusCount = customer.verifiedStatusCount();

  const previousBadge = customer.referralBadge?.currentBadge || 0;
  const level = computeLevel(referralCount, verifiedStatusCount);
  const newBadge = level ? level.index : 0;

  // Grant a 1% discount + VIP access for each newly reached level that carries them.
  if (newBadge > previousBadge) {
    for (const lvl of LEVELS) {
      if (lvl.index > previousBadge && lvl.index <= newBadge) {
        if (lvl.discount > 0) {
          const already = await PersonalDiscount.findOne({
            customerId: customer._id,
            grantedForLevel: lvl.index,
          });
          if (!already) {
            await PersonalDiscount.create({
              customerId: customer._id,
              grantType: 'level-reward',
              grantedForLevel: lvl.index,
              discountValue: lvl.discount,
              expiresAt: null, // 1% off "next buy" never time-expires
            });
          }
        }
        if (lvl.vip) {
          customer.vipCatalogAccess = {
            isActive: true,
            expiresAt: new Date(Date.now() + VIP_ACCESS_DAYS * DAY_MS),
          };
        }
      }
    }
  }

  // Expire VIP access when its window passes.
  if (
    customer.vipCatalogAccess?.isActive &&
    customer.vipCatalogAccess.expiresAt &&
    customer.vipCatalogAccess.expiresAt.getTime() < Date.now()
  ) {
    customer.vipCatalogAccess.isActive = false;
  }

  const keepAlive = computeKeepAlive(customer);

  customer.referralBadge = {
    currentBadge: newBadge,
    badgeName: level ? level.name : '',
    isInactive: keepAlive.isInactive,
    lastEvaluatedAt: new Date(),
  };

  await customer.save();

  return { level, referralCount, verifiedStatusCount, keepAlive };
}
