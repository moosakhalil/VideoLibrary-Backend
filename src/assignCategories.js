import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import KnowledgeVideo, { videoCategories } from './models/KnowledgeVideo.js';
import { CATEGORIES } from './config/categories.js';

// Assigns 1–3 random canonical categories to EVERY video so the whole library
// shows up again under the new category system.
//
// Usage:
//   node src/assignCategories.js          → only fix videos whose categories
//                                            aren't in the canonical list
//   node src/assignCategories.js --all    → re-roll random categories for ALL
//   node src/assignCategories.js --force  → same as --all
const FORCE = process.argv.includes('--all') || process.argv.includes('--force');

// Deterministic-ish shuffle using the array length (no Date/Math.random ban here,
// this is a one-off script run by a human).
function pickRandom() {
  const count = 1 + Math.floor(Math.random() * 3); // 1..3
  const pool = [...CATEGORIES];
  const out = [];
  for (let i = 0; i < count && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

async function run() {
  await connectDB();

  const videos = await KnowledgeVideo.find();
  console.log(`Found ${videos.length} video(s).`);

  let changed = 0;
  for (const v of videos) {
    const current = videoCategories(v);
    const allValid = current.length > 0 && current.every((c) => CATEGORIES.includes(c));

    if (allValid && !FORCE) {
      console.log(`  • "${v.title}" — keeping [${current.join(', ')}]`);
      continue;
    }

    const picked = pickRandom();
    v.categories = picked;
    v.category = picked[0]; // keep legacy field in sync
    await v.save();
    changed++;
    console.log(`  ✓ "${v.title}" — set [${picked.join(', ')}]`);
  }

  console.log(`\n✅ Done. Updated ${changed} of ${videos.length} video(s).`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
