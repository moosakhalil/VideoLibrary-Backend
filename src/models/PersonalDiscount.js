import mongoose from 'mongoose';

const { Schema } = mongoose;

const personalDiscountSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    grantType: { type: String, default: 'level-reward' }, // why it was granted
    grantedForLevel: { type: Number, default: null }, // level index that granted it
    discountValue: { type: Number, default: 1 }, // percent off
    isUsed: { type: Boolean, default: false },
    usedAt: { type: Date, default: null },
    // "1% off on next buy" has NO time expiry — null means never expires.
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// A discount is "available" if not used and (no expiry OR not yet expired).
personalDiscountSchema.virtual('state').get(function () {
  if (this.isUsed) return 'used';
  if (this.expiresAt && this.expiresAt.getTime() < Date.now()) return 'expired';
  return 'available';
});

personalDiscountSchema.set('toJSON', { virtuals: true });
personalDiscountSchema.set('toObject', { virtuals: true });

const PersonalDiscount = mongoose.model('PersonalDiscount', personalDiscountSchema);
export default PersonalDiscount;
