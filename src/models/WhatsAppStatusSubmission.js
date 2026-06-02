import mongoose from 'mongoose';

const { Schema } = mongoose;

const whatsAppStatusSubmissionSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    imageUrl: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
      index: true,
    },
    rejectionReason: { type: String, default: '' },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const WhatsAppStatusSubmission = mongoose.model(
  'WhatsAppStatusSubmission',
  whatsAppStatusSubmissionSchema
);
export default WhatsAppStatusSubmission;
