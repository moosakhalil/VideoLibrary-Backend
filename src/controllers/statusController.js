import WhatsAppStatusSubmission from '../models/WhatsAppStatusSubmission.js';

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

// GET /api/web/me/status -> list of submissions + verified total
export async function listStatus(req, res) {
  const submissions = await WhatsAppStatusSubmission.find({
    customerId: req.customer._id,
  }).sort({ createdAt: -1 });

  res.json({
    verifiedTotal: req.customer.verifiedStatusCount(),
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
