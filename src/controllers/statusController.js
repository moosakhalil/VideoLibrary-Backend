import WhatsAppStatusSubmission from '../models/WhatsAppStatusSubmission.js';
import StatusVideo from '../models/StatusVideo.js';
import { extractYoutubeId } from '../utils/youtube.js';

// POST /api/web/me/status (multipart screenshot) -> creates a pending submission
export async function submitStatus(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'A screenshot image is required.' });
  }
  const submission = await WhatsAppStatusSubmission.create({
    customerId: req.customer._id,
    imageUrl: `/uploads/${req.file.filename}`,
    status: 'pending',
  });
  res.status(201).json({ submission });
}

// GET /api/web/me/status -> list of submissions + verified total + reward video
export async function listStatus(req, res) {
  const submissions = await WhatsAppStatusSubmission.find({
    customerId: req.customer._id,
  }).sort({ createdAt: -1 });

  // The reward video unlocked for the customer's current verified-status count.
  // Only the video tied to that exact milestone (statusNumber === verifiedTotal).
  const verifiedTotal = req.customer.verifiedStatusCount();
  let video = null;
  if (verifiedTotal > 0) {
    const row = await StatusVideo.findOne({ statusNumber: verifiedTotal });
    const youtubeId = extractYoutubeId(row?.youtubeLink || '');
    if (youtubeId) video = { statusNumber: verifiedTotal, youtubeId };
  }

  res.json({
    verifiedTotal,
    video,
    submissions: submissions.map((s) => ({
      id: s._id,
      imageUrl: s.imageUrl,
      status: s.status, // pending | verified | rejected
      rejectionReason: s.rejectionReason,
      createdAt: s.createdAt,
      reviewedAt: s.reviewedAt,
    })),
  });
}
