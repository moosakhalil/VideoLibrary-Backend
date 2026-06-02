import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import Customer from './models/Customer.js';
import KnowledgeVideo from './models/KnowledgeVideo.js';
import WhatsAppStatusSubmission from './models/WhatsAppStatusSubmission.js';
import PersonalDiscount from './models/PersonalDiscount.js';

// Wipes ALL data so the app starts empty. Real data is created live:
// customers sign up themselves; videos/referrals/status approvals are set by admin.
async function run() {
  await connectDB();
  console.log('Clearing all collections...');
  await Promise.all([
    Customer.deleteMany({}),
    KnowledgeVideo.deleteMany({}),
    WhatsAppStatusSubmission.deleteMany({}),
    PersonalDiscount.deleteMany({}),
  ]);
  console.log('✅ Database is now empty. Customers sign up live; admin adds videos.');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
