import mongoose from 'mongoose';

const { Schema } = mongoose;

// Same storage model as the M11 page: YouTube video organised under a category.
const knowledgeVideoSchema = new Schema(
  {
    title: { type: String, required: true },
    youtubeId: { type: String, default: '' }, // YouTube ID (when videoType === 'youtube')
    videoUrl: { type: String, default: '' }, // served path (when videoType === 'upload')
    videoType: { type: String, enum: ['youtube', 'upload'], default: 'youtube' },

    // Optional sample/teaser shown to customers below the required badge.
    sampleType: { type: String, enum: ['none', 'youtube', 'upload'], default: 'none' },
    sampleYoutubeId: { type: String, default: '' },
    sampleVideoUrl: { type: String, default: '' },
    // A video can belong to one OR many categories.
    categories: { type: [String], default: [], index: true },
    category: { type: String, default: '', index: true }, // legacy single-category (kept for old records)
    accessLevel: { type: String, default: 'all' }, // 'all' | 'vip' (VIP catalog gate)
    // Minimum badge level required to see this video (0 = everyone, 1..7 = badge index).
    // Access is cumulative: a Gold (4) customer also sees minBadge 0,1,2,3.
    minBadge: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 }, // controls bundling order
  },
  { timestamps: true }
);

const KnowledgeVideo = mongoose.model('KnowledgeVideo', knowledgeVideoSchema);

// Always read a video's categories as an array (falls back to the legacy field).
export function videoCategories(v) {
  if (v.categories?.length) return v.categories;
  return v.category ? [v.category] : [];
}

// One-time backfill: copy legacy `category` strings into the `categories` array.
export async function migrateVideoCategories() {
  const legacy = await KnowledgeVideo.find({
    $and: [
      { category: { $exists: true, $ne: '' } },
      { $or: [{ categories: { $exists: false } }, { categories: { $size: 0 } }] },
    ],
  });
  for (const v of legacy) {
    v.categories = [v.category];
    await v.save();
  }
}

export default KnowledgeVideo;
