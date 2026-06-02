import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDB } from './config/db.js';
import Customer from './models/Customer.js';
import WhatsAppStatusSubmission from './models/WhatsAppStatusSubmission.js';
import { evaluateCustomer } from './utils/rewardEngine.js';

// Usage: node src/seedCustomer.js <phone> <pin> <referrals> <statuses>
const phone = process.argv[2] || '03312674909';
const pin = process.argv[3] || '6262';
const numReferrals = Number(process.argv[4] || 20);
const numStatuses = Number(process.argv[5] || 20);

const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
// Spread activity over the last ~80 days so keep-alive stays "active".
const spread = (i, total) => new Date(now - Math.floor((i / total) * 80) * DAY);

function genReferralCode() {
  return 'REF' + Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function run() {
  await connectDB();

  let customer = await Customer.findOne({ phoneNumber: phone });
  if (!customer) {
    console.log(`No customer with phone ${phone} — creating one.`);
    customer = new Customer({ phoneNumber: [phone], referralCode: genReferralCode() });
  } else {
    console.log(`Found existing customer ${customer._id}.`);
  }

  if (!customer.referralCode) customer.referralCode = genReferralCode();

  // Ensure they can log in with the given PIN.
  customer.pinHash = await bcrypt.hash(String(pin), 10);
  customer.pinSetAt = new Date();
  customer.failedPinAttempts = 0;
  customer.pinLockedUntil = null;

  // Set exactly N qualifying referrals (all "said hi").
  customer.customersReferred = Array.from({ length: numReferrals }, (_, i) => ({
    name: `Referral ${i + 1}`,
    phoneNumber: `0331000${String(i + 1).padStart(4, '0')}`,
    repliedWithHi: true,
    becameCustomer: i % 4 === 0, // a quarter became customers
    referredAt: spread(i, numReferrals),
  }));

  // Set exactly N verified statuses (+ history for keep-alive).
  customer.whatsappStatusStats = {
    totalStatusesVerified: numStatuses,
    history: Array.from({ length: numStatuses }, (_, i) => ({ verifiedAt: spread(i, numStatuses) })),
  };

  await customer.save();

  // Replace this customer's submission docs with N verified ones so the
  // Status page list matches the verified total.
  await WhatsAppStatusSubmission.deleteMany({ customerId: customer._id });
  await WhatsAppStatusSubmission.insertMany(
    Array.from({ length: numStatuses }, (_, i) => ({
      customerId: customer._id,
      imageUrl: '/uploads/seeded-status.png',
      status: 'verified',
      reviewedAt: spread(i, numStatuses),
    }))
  );

  const result = await evaluateCustomer(customer);

  console.log('\n✅ Seeded customer:');
  console.log(`   phone: ${phone}   PIN: ${pin}`);
  console.log(`   referrals: ${customer.referralCount()}   verified statuses: ${customer.verifiedStatusCount()}`);
  console.log(`   badge: ${result.level ? result.level.name : 'No badge'}`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
