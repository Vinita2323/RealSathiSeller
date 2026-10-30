import mongoose from 'mongoose';

const sellerMembershipSchema = new mongoose.Schema(
  {
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true, index: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'SellerMembershipPlan', required: true },
    planName: { type: String, required: true, trim: true },
    durationType: { type: String, enum: ['monthly', 'halfYearly', 'yearly'], required: true },
    durationMonths: { type: Number, required: true },
    priceAtPurchase: { type: Number, required: true },
    startDate: { type: Date },
    expiryDate: { type: Date },
    membershipStatus: {
      type: String,
      enum: ['active', 'expired', 'pending_payment', 'cancelled'],
      default: 'pending_payment',
    },
    paymentStatus: {
      type: String,
      enum: ['paid', 'pending', 'failed', 'cancelled'],
      default: 'pending',
    },
    transactionId: { type: String, trim: true, default: '' },
    paymentReference: { type: String, trim: true, default: '' },
    paymentMethod: { type: String, trim: true, default: 'manual' },
    renewedFromId: { type: mongoose.Schema.Types.ObjectId, ref: 'SellerMembership', default: null },
    adminNote: { type: String, default: '' },
  },
  { timestamps: true, collection: 'sellermemberships' }
);

sellerMembershipSchema.index({ sellerId: 1, membershipStatus: 1, expiryDate: 1 });
sellerMembershipSchema.index({ membershipStatus: 1, expiryDate: 1 });
sellerMembershipSchema.index({ createdAt: -1 });

const SellerMembership = mongoose.model('SellerMembership', sellerMembershipSchema);
export default SellerMembership;
