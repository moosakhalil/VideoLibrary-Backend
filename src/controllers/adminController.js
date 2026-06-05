import KnowledgeVideo, { videoCategories } from '../models/KnowledgeVideo.js';
import WhatsAppStatusSubmission from '../models/WhatsAppStatusSubmission.js';
import Customer from '../models/Customer.js';
import Category, { ensureCategories } from '../models/Category.js';
import StatusVideo from '../models/StatusVideo.js';
import DatedVideo from '../models/DatedVideo.js';
import { CATEGORIES } from '../config/categories.js';
import { signAdminToken } from '../utils/jwt.js';
import { evaluateCustomer } from '../utils/rewardEngine.js';
import { extractYoutubeId } from '../utils/youtube.js';

// ---------- Auth ----------
// POST /api/web/admin/login  { username, password }
export function adminLogin(req, res) {
  const { username, password } = req.body;
  const okUser = username === process.env.ADMIN_USERNAME;
  const okPass = password === process.env.ADMIN_PASSWORD;
  if (!okUser || !okPass) {
    return res.status(401).json({ error: 'Wrong admin username or password' });
  }
  const token = signAdminToken();
  res.json({ token });
}

// ---------- Videos CRUD ----------
// GET /api/web/admin/videos
export async function listVideos(req, res) {
  const videos = await KnowledgeVideo.find().sort({ category: 1, sortOrder: 1, createdAt: 1 });
  res.json({ videos });
}

// Normalise an incoming categories payload (JSON string, array, or single
// string) into a clean array limited to the canonical category list.
function parseCategories(body) {
  let raw = body.categories;
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { raw = [raw]; }
  }
  if (!Array.isArray(raw)) raw = raw ? [raw] : [];
  // de-dupe, trim, and keep only valid canonical categories
  const seen = new Set();
  return raw
    .map((c) => String(c).trim())
    .filter((c) => CATEGORIES.includes(c) && !seen.has(c) && seen.add(c));
}

// Resolve the optional sample into { sampleType, sampleYoutubeId, sampleVideoUrl }.
function resolveSample(body, files) {
  const sampleFile = files?.sampleVideo?.[0];
  if (sampleFile) {
    return { sampleType: 'upload', sampleVideoUrl: `/uploads/videos/${sampleFile.filename}`, sampleYoutubeId: '' };
  }
  if (body.sampleYoutubeId) {
    return { sampleType: 'youtube', sampleYoutubeId: extractYoutubeId(body.sampleYoutubeId), sampleVideoUrl: '' };
  }
  return { sampleType: 'none', sampleYoutubeId: '', sampleVideoUrl: '' };
}

// POST /api/web/admin/videos
// Multipart: optional "video" (full) and "sampleVideo" (teaser) files.
export async function createVideo(req, res) {
  const { title, youtubeId, accessLevel, minBadge, sortOrder, isActive } = req.body;
  const categories = parseCategories(req.body);
  if (!title || categories.length === 0) {
    return res.status(400).json({ error: 'title and at least one category are required' });
  }

  const mainFile = req.files?.video?.[0];

  const base = {
    title: title.trim(),
    categories,
    category: categories[0], // keep legacy field populated
    accessLevel: accessLevel || 'all',
    minBadge: Number(minBadge) || 0,
    sortOrder: Number(sortOrder) || 0,
    isActive: isActive !== false && isActive !== 'false',
    ...resolveSample(req.body, req.files),
  };

  let video;
  if (mainFile) {
    video = await KnowledgeVideo.create({
      ...base,
      videoType: 'upload',
      videoUrl: `/uploads/videos/${mainFile.filename}`,
      youtubeId: '',
    });
  } else if (youtubeId) {
    video = await KnowledgeVideo.create({
      ...base,
      videoType: 'youtube',
      youtubeId: extractYoutubeId(youtubeId),
      videoUrl: '',
    });
  } else {
    return res.status(400).json({ error: 'Provide a YouTube link/ID or upload a video file.' });
  }

  res.status(201).json({ video });
}

// PATCH /api/web/admin/videos/:id
export async function updateVideo(req, res) {
  const { title, youtubeId, accessLevel, minBadge, sortOrder, isActive } = req.body;
  const update = {};
  if (title !== undefined) update.title = title.trim();
  if (youtubeId !== undefined) update.youtubeId = extractYoutubeId(youtubeId);
  if (req.body.categories !== undefined) {
    const categories = parseCategories(req.body);
    if (categories.length === 0) {
      return res.status(400).json({ error: 'Select at least one category.' });
    }
    update.categories = categories;
    update.category = categories[0]; // keep legacy field in sync
  }
  if (accessLevel !== undefined) update.accessLevel = accessLevel;
  if (minBadge !== undefined) update.minBadge = Number(minBadge) || 0;
  if (sortOrder !== undefined) update.sortOrder = Number(sortOrder) || 0;
  if (isActive !== undefined) update.isActive = !!isActive;

  // Sample edits (YouTube id or clearing). File re-upload uses the create flow.
  if (req.body.sampleType === 'none') {
    update.sampleType = 'none';
    update.sampleYoutubeId = '';
    update.sampleVideoUrl = '';
  } else if (req.body.sampleYoutubeId !== undefined) {
    if (req.body.sampleYoutubeId) {
      update.sampleType = 'youtube';
      update.sampleYoutubeId = extractYoutubeId(req.body.sampleYoutubeId);
      update.sampleVideoUrl = '';
    }
  }

  const video = await KnowledgeVideo.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!video) return res.status(404).json({ error: 'Video not found' });
  res.json({ video });
}

// DELETE /api/web/admin/videos/:id
export async function deleteVideo(req, res) {
  const video = await KnowledgeVideo.findByIdAndDelete(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found' });
  res.json({ ok: true });
}

// ---------- Categories ----------
// GET /api/web/admin/categories — every canonical category with its on/off state
// and how many videos sit under it.
export async function listCategories(req, res) {
  await ensureCategories();
  const rows = await Category.find();
  // A video can be in several categories, so unwind the array before counting.
  const counts = await KnowledgeVideo.aggregate([
    { $project: { cats: { $cond: [{ $gt: [{ $size: { $ifNull: ['$categories', []] } }, 0] }, '$categories', ['$category']] } } },
    { $unwind: '$cats' },
    { $group: { _id: '$cats', count: { $sum: 1 } } },
  ]);
  const countByName = Object.fromEntries(counts.map((c) => [c._id, c.count]));
  const byName = Object.fromEntries(rows.map((r) => [r.name, r]));

  const categories = CATEGORIES.map((name) => ({
    id: byName[name]?._id || null,
    name,
    isActive: byName[name] ? byName[name].isActive : true,
    videoCount: countByName[name] || 0,
  }));
  res.json({ categories });
}

// PATCH /api/web/admin/categories/:id  { isActive }
export async function updateCategory(req, res) {
  const { isActive } = req.body;
  const category = await Category.findByIdAndUpdate(
    req.params.id,
    { isActive: !!isActive },
    { new: true }
  );
  if (!category) return res.status(404).json({ error: 'Category not found' });
  res.json({ category });
}

// ---------- Status videos (one YouTube link per WhatsApp status 1..60) ----------
// GET /api/web/admin/status-videos — always returns all 60 rows (blank if unset).
export async function listStatusVideos(req, res) {
  const rows = await StatusVideo.find();
  const byNum = Object.fromEntries(rows.map((r) => [r.statusNumber, r.youtubeLink]));
  const items = Array.from({ length: 60 }, (_, i) => ({
    statusNumber: i + 1,
    youtubeLink: byNum[i + 1] || '',
  }));
  res.json({ items });
}

// PUT /api/web/admin/status-videos  { items: [{ statusNumber, youtubeLink }] }
export async function saveStatusVideos(req, res) {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  const ops = [];
  for (const it of items) {
    const n = Number(it.statusNumber);
    if (!Number.isInteger(n) || n < 1 || n > 60) continue;
    ops.push(
      StatusVideo.updateOne(
        { statusNumber: n },
        { $set: { youtubeLink: String(it.youtubeLink || '').trim() } },
        { upsert: true }
      )
    );
  }
  await Promise.all(ops);
  res.json({ ok: true });
}

// PUT /api/web/admin/status-videos/:n  { youtubeLink } — save/edit one status.
export async function saveStatusVideo(req, res) {
  const n = Number(req.params.n);
  if (!Number.isInteger(n) || n < 1 || n > 60) {
    return res.status(400).json({ error: 'statusNumber must be 1..60' });
  }
  const youtubeLink = String(req.body.youtubeLink || '').trim();
  await StatusVideo.updateOne({ statusNumber: n }, { $set: { youtubeLink } }, { upsert: true });
  res.json({ ok: true, statusNumber: n, youtubeLink });
}

// DELETE /api/web/admin/status-videos/:n — remove the video for one status.
export async function deleteStatusVideo(req, res) {
  const n = Number(req.params.n);
  if (!Number.isInteger(n) || n < 1 || n > 60) {
    return res.status(400).json({ error: 'statusNumber must be 1..60' });
  }
  await StatusVideo.deleteOne({ statusNumber: n });
  res.json({ ok: true, statusNumber: n });
}

// ---------- Dated feature videos (promotional / today) ----------
const isKind = (k) => k === 'promotional' || k === 'today';
const isYmd = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
// Today in Asia/Karachi (GMT+5) as YYYY-MM-DD, for past-date validation.
const karachiTodayYmd = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

// GET /api/web/admin/dated-videos?kind=promotional
export async function listDatedVideos(req, res) {
  const { kind } = req.query;
  if (!isKind(kind)) return res.status(400).json({ error: 'kind must be promotional or today' });
  const rows = await DatedVideo.find({ kind }).sort({ date: 1 });
  res.json({
    items: rows.map((v) => ({
      id: v._id,
      date: v.date,
      videoType: v.videoType,
      youtubeId: v.youtubeId,
      videoUrl: v.videoUrl,
      title: v.title,
    })),
  });
}

// POST /api/web/admin/dated-videos  (multipart) { kind, date, title, youtubeId? } + optional file "video"
// Upserts the single video for that kind+date.
export async function saveDatedVideo(req, res) {
  const { kind, date, title, youtubeId } = req.body;
  if (!isKind(kind)) return res.status(400).json({ error: 'kind must be promotional or today' });
  if (!isYmd(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  if (date < karachiTodayYmd()) {
    return res.status(400).json({ error: 'Cannot set a video for a past date.' });
  }

  const file = req.file;
  const update = { kind, date, title: (title || '').trim() };

  if (file) {
    update.videoType = 'upload';
    update.videoUrl = `/uploads/videos/${file.filename}`;
    update.youtubeId = '';
  } else if (youtubeId) {
    update.videoType = 'youtube';
    update.youtubeId = extractYoutubeId(youtubeId);
    update.videoUrl = '';
  } else {
    return res.status(400).json({ error: 'Provide a YouTube link/ID or upload a video file.' });
  }

  const video = await DatedVideo.findOneAndUpdate({ kind, date }, update, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  });
  res.status(201).json({ video });
}

// DELETE /api/web/admin/dated-videos/:id
export async function deleteDatedVideo(req, res) {
  const video = await DatedVideo.findByIdAndDelete(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found' });
  res.json({ ok: true });
}

// ---------- Status moderation ----------
// GET /api/web/admin/status?status=pending
export async function listSubmissions(req, res) {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const submissions = await WhatsAppStatusSubmission.find(filter)
    .sort({ createdAt: -1 })
    .populate('customerId', 'name phoneNumber');
  res.json({ submissions });
}

// PATCH /api/web/admin/status/:id  { action: 'approve' | 'reject', reason? }
export async function moderateSubmission(req, res) {
  const { action, reason } = req.body;
  const sub = await WhatsAppStatusSubmission.findById(req.params.id);
  if (!sub) return res.status(404).json({ error: 'Submission not found' });

  const customer = await Customer.findById(sub.customerId);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const wasVerified = sub.status === 'verified';

  if (action === 'approve') {
    sub.status = 'verified';
    sub.rejectionReason = '';
    sub.reviewedAt = new Date();
    if (!wasVerified) {
      customer.whatsappStatusStats.totalStatusesVerified =
        (customer.whatsappStatusStats.totalStatusesVerified || 0) + 1;
      customer.whatsappStatusStats.history.push({ submissionId: sub._id, verifiedAt: new Date() });
    }
  } else if (action === 'reject') {
    sub.status = 'rejected';
    sub.rejectionReason = reason || '';
    sub.reviewedAt = new Date();
    if (wasVerified) {
      // undo a previously-counted approval
      customer.whatsappStatusStats.totalStatusesVerified = Math.max(
        0,
        (customer.whatsappStatusStats.totalStatusesVerified || 0) - 1
      );
      customer.whatsappStatusStats.history = customer.whatsappStatusStats.history.filter(
        (h) => String(h.submissionId) !== String(sub._id)
      );
    }
  } else {
    return res.status(400).json({ error: 'action must be approve or reject' });
  }

  await sub.save();
  await customer.save();
  await evaluateCustomer(customer); // re-check the AND gate / grant rewards
  res.json({ submission: sub });
}

// ---------- Customers + referrals ----------
// GET /api/web/admin/customers
export async function listCustomers(req, res) {
  const customers = await Customer.find().sort({ createdAt: -1 });
  res.json({
    customers: customers.map((c) => ({
      id: c._id,
      name: c.name,
      phone: c.phoneNumber?.[0] || '',
      referralCode: c.referralCode,
      badge: c.referralBadge?.badgeName || 'No badge',
      referralCount: c.referralCount(),
      verifiedStatusCount: c.verifiedStatusCount(),
      hasPin: !!c.pinHash,
    })),
  });
}

// POST /api/web/admin/customers/:id/referrals  { name, phoneNumber, repliedWithHi, becameCustomer }
export async function addReferral(req, res) {
  const customer = await Customer.findById(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const { name, phoneNumber, repliedWithHi = true, becameCustomer = false } = req.body;
  customer.customersReferred.push({
    name: name || 'Friend',
    phoneNumber: phoneNumber || '',
    repliedWithHi: !!repliedWithHi,
    becameCustomer: !!becameCustomer,
    referredAt: new Date(),
  });
  await customer.save();
  await evaluateCustomer(customer);
  res.status(201).json({ ok: true, referralCount: customer.referralCount() });
}

// POST /api/web/admin/customers/:id/reset-pin — staff clears the PIN
export async function resetCustomerPin(req, res) {
  const customer = await Customer.findById(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  customer.pinHash = null;
  customer.pinSetAt = null;
  customer.failedPinAttempts = 0;
  customer.pinLockedUntil = null;
  await customer.save();
  res.json({ ok: true });
}
