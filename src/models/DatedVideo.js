import mongoose from 'mongoose';

const { Schema } = mongoose;

// A video pinned to a specific calendar date, for the "promotional" or
// "today" feature sections on the customer video page.
const datedVideoSchema = new Schema(
  {
    kind: { type: String, enum: ['promotional', 'today'], required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    videoType: { type: String, enum: ['youtube', 'upload'], default: 'youtube' },
    youtubeId: { type: String, default: '' },
    videoUrl: { type: String, default: '' },
    title: { type: String, default: '' },
  },
  { timestamps: true }
);

// One video per kind per date.
datedVideoSchema.index({ kind: 1, date: 1 }, { unique: true });

const DatedVideo = mongoose.model('DatedVideo', datedVideoSchema);
export default DatedVideo;
