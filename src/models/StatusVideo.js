import mongoose from 'mongoose';

const { Schema } = mongoose;

// One YouTube link stored per WhatsApp-status number (1..60). Just the link for now.
const statusVideoSchema = new Schema(
  {
    statusNumber: { type: Number, required: true, unique: true, min: 1, max: 60 },
    youtubeLink: { type: String, default: '' },
  },
  { timestamps: true }
);

const StatusVideo = mongoose.model('StatusVideo', statusVideoSchema);
export default StatusVideo;
