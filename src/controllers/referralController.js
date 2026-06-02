// GET /api/web/me/referral — code + share link + share text
export async function getReferral(req, res) {
  const c = req.customer;
  const base = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  const shareLink = `${base}/?ref=${encodeURIComponent(c.referralCode || '')}`;
  const shareText =
    `Join me and learn from these free construction-material knowledge videos! ` +
    `Use my code ${c.referralCode}: ${shareLink}`;

  res.json({
    referralCode: c.referralCode,
    shareLink,
    shareText,
    whatsappShareUrl: `https://wa.me/?text=${encodeURIComponent(shareText)}`,
  });
}

// GET /api/web/me/referrals — list of referred people + states + counts
export async function getReferrals(req, res) {
  const c = req.customer;
  const people = (c.customersReferred || []).map((p) => ({
    id: p._id,
    name: p.name || 'Friend',
    phoneNumber: p.phoneNumber,
    repliedWithHi: p.repliedWithHi,
    becameCustomer: p.becameCustomer,
    referredAt: p.referredAt,
    state: p.becameCustomer ? 'became-customer' : p.repliedWithHi ? 'said-hi' : 'invited',
  }));

  res.json({
    total: people.length,
    qualified: people.filter((p) => p.repliedWithHi).length, // counts toward levels
    becameCustomers: people.filter((p) => p.becameCustomer).length,
    people,
  });
}
