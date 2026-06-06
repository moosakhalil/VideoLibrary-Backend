import KnowledgeVideo, { videoCategories } from '../models/KnowledgeVideo.js';
import Category from '../models/Category.js';
import DatedVideo from '../models/DatedVideo.js';
import { categoryRank } from '../config/categories.js';
import { LEVELS } from '../utils/rewardEngine.js';
import { getDerivedProgress } from '../services/progressService.js';

const badgeName = (index) => LEVELS.find((l) => l.index === index)?.name || '';
const tierLabel = (index) => (index === 0 ? 'Everyone' : badgeName(index));

// Names of categories the admin has switched ON. Videos in any other category
// (or in a toggled-off one) are hidden from customers entirely.
async function activeCategoryNames() {
  const active = await Category.find({ isActive: true }).select('name');
  return new Set(active.map((c) => c.name));
}

// YYYY-MM-DD for "today" in Asia/Karachi (GMT+5, no DST) — independent of the
// server's own timezone. en-CA formats as YYYY-MM-DD.
function todayYmd() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

const featuredView = (v) =>
  v
    ? {
        title: v.title,
        videoType: v.videoType,
        youtubeId: v.youtubeId,
        videoUrl: v.videoUrl,
        date: v.date,
      }
    : null;

// GET /api/web/videos/featured — promotional + today's video for the current date.
export async function getFeatured(req, res) {
  const date = todayYmd();
  const [promotional, today] = await Promise.all([
    DatedVideo.findOne({ kind: 'promotional', date }),
    DatedVideo.findOne({ kind: 'today', date }),
  ]);
  res.json({ date, promotional: featuredView(promotional), today: featuredView(today) });
}

// GET /api/web/videos/promotional — promotional videos for today + past days,
// most recent first, so customers can browse previous days' promos via a date
// filter. Future-dated promos are excluded.
export async function getPromotional(req, res) {
  const today = todayYmd();
  const rows = await DatedVideo.find({
    kind: 'promotional',
    date: { $lte: today },
  }).sort({ date: -1 });
  res.json({ today, items: rows.map(featuredView) });
}

// GET /api/web/videos/categories — only the categories that are active AND
// actually have at least one video, in canonical order.
export async function getCategories(req, res) {
  const activeNames = await activeCategoryNames();
  // distinct over the array field returns each used category once.
  const used = await KnowledgeVideo.distinct('categories', { isActive: true });
  const categories = used
    .filter((name) => activeNames.has(name))
    .sort((a, b) => categoryRank(a) - categoryRank(b));
  res.json({ categories });
}

// GET /api/web/videos — the full library, grouped by BADGE LEVEL (tier).
// The sidebar lists tiers (Everyone, Bronze, Silver, Gold, …, VIP). Tiers at or
// below the customer's badge are unlocked; higher tiers are locked and return the
// sample only (never the full source). Category rides along as a tag per video.
export async function getLibrary(req, res) {
  const c = req.customer;

  // Counts + badge + VIP come from construction (recomputed locally into a level).
  const { referralCount, verifiedStatusCount, badgeIndex, vipActive, next } =
    await getDerivedProgress(c);

  const nextLevel = next
    ? { name: next.level.name, referralsNeeded: next.referralsNeeded, statusesNeeded: next.statusesNeeded }
    : null;

  const activeNames = await activeCategoryNames();
  const all = (await KnowledgeVideo.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1 }))
    // Keep a video if at least one of its categories is still toggled on.
    .filter((v) => videoCategories(v).some((c) => activeNames.has(c)));

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
          // Only expose the categories that are currently active.
          categories: videoCategories(v).filter((c) => activeNames.has(c)),
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
