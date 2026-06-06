// Single source for a customer's reward progress, now driven by Construction.
//
// Construction owns the two raw counts (warm leads + verified statuses) and the
// VIP flag. The website RECOMPUTES the badge/level locally from those counts
// using its own LEVELS table, so all existing UI (progress bars, next-level
// needs, video unlock gates) keeps working unchanged.
//
// Fallback: if construction is unreachable/unconfigured (error), we use the
// website's own local numbers so the dashboard still loads. A clean "found:false"
// answer is NOT an error — it means the phone really has no progress yet (zeros).

import { computeLevel, computeNextLevel } from '../utils/rewardEngine.js';
import { fetchConstructionProgress } from './constructionClient.js';

// Shape the two raw counts into the normalized progress object every caller uses.
function buildProgress(found, referralCount, verifiedStatusCount, vipActive) {
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

// customer -> normalized progress used by /me, /me/progress and /videos/library.
export async function getDerivedProgress(customer) {
  const phone = customer.phoneNumber?.[0] || '';
  const { error, found, progress } = await fetchConstructionProgress(phone);

  if (error) {
    // Construction down/unconfigured: fall back to the website's local numbers so
    // the page never breaks. found:true => show the real data, not the empty
    // "not in our rewards system yet" state.
    return buildProgress(
      true,
      customer.referralCount?.() || 0,
      customer.verifiedStatusCount?.() || 0,
      !!customer.vipCatalogAccess?.isActive
    );
  }

  return buildProgress(
    found,
    found ? Number(progress?.warmLeads) || 0 : 0,
    found ? Number(progress?.verifiedStatuses) || 0 : 0,
    found ? !!progress?.vip?.isActive : false
  );
}
