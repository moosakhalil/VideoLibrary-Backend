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
    category: { type: String, required: true, index: true },
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
export default KnowledgeVideo;
