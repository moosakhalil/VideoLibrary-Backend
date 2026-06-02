import mongoose from 'mongoose';

const { Schema } = mongoose;

// A person this customer referred (a "warm lead" when repliedWithHi === true)
const referredPersonSchema = new Schema(
  {
    name: { type: String, default: '' },
    phoneNumber: { type: String, default: '' },
    repliedWithHi: { type: Boolean, default: false }, // counts as a referral
    becameCustomer: { type: Boolean, default: false },
    referredAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

// One entry per verified/approved WhatsApp status (used for keep-alive timing)
const statusHistorySchema = new Schema(
  {
    submissionId: { type: Schema.Types.ObjectId, ref: 'WhatsAppStatusSubmission' },
    verifiedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const customerSchema = new Schema(
  {
    name: { type: String, default: '' },
    // Customers may have more than one phone number; the first is the primary.
    phoneNumber: { type: [String], default: [], index: true },
    language: { type: String, default: 'en' },

    referralCode: { type: String, unique: true, sparse: true, index: true },
    customersReferred: { type: [referredPersonSchema], default: [] },

    // ---- Local auth (phone + PIN + JWT) ----
    pinHash: { type: String, default: null },
    pinSetAt: { type: Date, default: null },
    failedPinAttempts: { type: Number, default: 0 },
    pinLockedUntil: { type: Date, default: null },

    // ---- Reward engine results (computed/updated by the engine) ----
    referralBadge: {
      currentBadge: { type: Number, default: 0 }, // 0 = none, 1..7 = level index
      badgeName: { type: String, default: '' },
      isInactive: { type: Boolean, default: false },
      lastEvaluatedAt: { type: Date, default: null },
    },

    whatsappStatusStats: {
      totalStatusesVerified: { type: Number, default: 0 },
      history: { type: [statusHistorySchema], default: [] },
    },

    vipCatalogAccess: {
      isActive: { type: Boolean, default: false },
      expiresAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

// Count of qualifying referrals = referred people who said hi
customerSchema.methods.referralCount = function () {
  return this.customersReferred.filter((p) => p.repliedWithHi).length;
};

customerSchema.methods.verifiedStatusCount = function () {
  return this.whatsappStatusStats?.totalStatusesVerified || 0;
};

const Customer = mongoose.model('Customer', customerSchema);
export default Customer;
