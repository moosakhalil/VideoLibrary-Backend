import KnowledgeVideo from '../models/KnowledgeVideo.js';
import WhatsAppStatusSubmission from '../models/WhatsAppStatusSubmission.js';
import Customer from '../models/Customer.js';
import { signAdminToken } from '../utils/jwt.js';
import { evaluateCustomer } from '../utils/rewardEngine.js';

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

// Pull the 11-char ID out of any YouTube URL, or accept a bare ID.
function extractYoutubeId(input = '') {
  const s = String(input).trim();
  const m = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  return s; // fall back to whatever was given
}

// ---------- Videos CRUD ----------
// GET /api/web/admin/videos
export async function listVideos(req, res) {
  const videos = await KnowledgeVideo.find().sort({ category: 1, sortOrder: 1, createdAt: 1 });
  res.json({ videos });
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
  const { title, youtubeId, category, accessLevel, minBadge, sortOrder, isActive } = req.body;
  if (!title || !category) {
    return res.status(400).json({ error: 'title and category are required' });
  }

  const mainFile = req.files?.video?.[0];

  const base = {
    title: title.trim(),
    category: category.trim(),
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
  const { title, youtubeId, category, accessLevel, minBadge, sortOrder, isActive } = req.body;
  const update = {};
  if (title !== undefined) update.title = title.trim();
  if (youtubeId !== undefined) update.youtubeId = extractYoutubeId(youtubeId);
  if (category !== undefined) update.category = category.trim();
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
