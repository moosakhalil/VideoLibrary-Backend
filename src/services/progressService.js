// Single source for a customer's reward progress, now driven by Construction.
//
// Construction owns the two raw counts (warm leads + verified statuses) and the
// VIP flag. The website RECOMPUTES the badge/level locally from those counts
// using its own LEVELS table, so all existing UI (progress bars, next-level
// needs, video unlock gates) keeps working unchanged.

import { computeLevel, computeNextLevel } from '../utils/rewardEngine.js';
import { fetchConstructionProgress } from './constructionClient.js';

// customer -> normalized progress used by /me, /me/progress and /videos/library.
export async function getDerivedProgress(customer) {
  const phone = customer.phoneNumber?.[0] || '';
  const { found, progress } = await fetchConstructionProgress(phone);

  const referralCount = found ? Number(progress?.warmLeads) || 0 : 0;
  const verifiedStatusCount = found ? Number(progress?.verifiedStatuses) || 0 : 0;
  const vipActive = found ? !!progress?.vip?.isActive : false;

  const level = computeLevel(referralCount, verifiedStatusCount);
  const next = computeNextLevel(referralCount, verifiedStatusCount);

  return {
    found,
    referralCount,
    verifiedStatusCount,
    vipActive,
    level, // null = no badge yet
    badgeIndex: level ? level.index : 0,
    next, // null = at top level
  };
}
