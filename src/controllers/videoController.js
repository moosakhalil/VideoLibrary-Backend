import KnowledgeVideo from '../models/KnowledgeVideo.js';
import { computeLevel, computeNextLevel, LEVELS } from '../utils/rewardEngine.js';

const badgeName = (index) => LEVELS.find((l) => l.index === index)?.name || '';
const tierLabel = (index) => (index === 0 ? 'Everyone' : badgeName(index));

// GET /api/web/videos/categories
export async function getCategories(req, res) {
  const categories = await KnowledgeVideo.distinct('category', { isActive: true });
  res.json({ categories: categories.sort() });
}

// GET /api/web/videos — the full library, grouped by BADGE LEVEL (tier).
// The sidebar lists tiers (Everyone, Bronze, Silver, Gold, …, VIP). Tiers at or
// below the customer's badge are unlocked; higher tiers are locked and return the
// sample only (never the full source). Category rides along as a tag per video.
export async function getLibrary(req, res) {
  const c = req.customer;

  const referralCount = c.referralCount();
  const verifiedStatusCount = c.verifiedStatusCount();
  const level = computeLevel(referralCount, verifiedStatusCount);
  const badgeIndex = level ? level.index : 0;
  const vipActive = c.vipCatalogAccess?.isActive || false;

  const next = computeNextLevel(referralCount, verifiedStatusCount);
  const nextLevel = next
    ? { name: next.level.name, referralsNeeded: next.referralsNeeded, statusesNeeded: next.statusesNeeded }
    : null;

  const all = await KnowledgeVideo.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1 });

  // Bucket videos by tier: VIP, or badge level (0..7).
  const tiers = new Map();
  for (const v of all) {
    const vip = v.accessLevel === 'vip';
    const key = vip ? 'vip' : `b${v.minBadge || 0}`;
    if (!tiers.has(key)) {
      tiers.set(key, {
        key,
        vip,
        minBadge: vip ? null : v.minBadge || 0,
        label: vip ? 'VIP Catalog' : tierLabel(v.minBadge || 0),
        sortVal: vip ? 100 : v.minBadge || 0, // ascending: Everyone → Ambassador → VIP
        _videos: [],
      });
    }
    tiers.get(key)._videos.push(v);
  }

  const groups = [...tiers.values()]
    .sort((a, b) => b.sortVal - a.sortVal) // highest level on top
    .map((t) => {
      const locked = t.vip ? !vipActive : badgeIndex < t.minBadge;

      // How many more referrals / statuses to unlock THIS level's full videos.
      let referralsNeeded = null;
      let statusesNeeded = null;
      if (!t.vip && t.minBadge > 0) {
        const lvl = LEVELS.find((l) => l.index === t.minBadge);
        referralsNeeded = Math.max(0, lvl.referrals - referralCount);
        statusesNeeded = Math.max(0, lvl.statuses - verifiedStatusCount);
      }

      const videos = t._videos.map((v) => {
        const hasSample = v.sampleType && v.sampleType !== 'none';
        const out = {
          id: v._id,
          title: v.title,
          category: v.category,
          requiredBadge: t.label,
          locked,
          hasSample,
        };
        if (!locked) {
          out.videoType = v.videoType;
          out.youtubeId = v.youtubeId;
          out.videoUrl = v.videoUrl;
        } else if (hasSample) {
          out.sampleType = v.sampleType;
          out.sampleYoutubeId = v.sampleYoutubeId;
          out.sampleVideoUrl = v.sampleVideoUrl;
        }
        return out;
      });
      return {
        key: t.key,
        label: t.label,
        minBadge: t.minBadge,
        vip: t.vip,
        locked,
        referralsNeeded,
        statusesNeeded,
        videos,
      };
    });

  res.json({ badgeIndex, badgeName: badgeName(badgeIndex), nextLevel, groups });
}
