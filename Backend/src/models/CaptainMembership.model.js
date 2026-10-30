import mongoose from 'mongoose';

const captainMembershipSchema = new mongoose.Schema(
  {
    captainId: { type: mongoose.Schema.Types.ObjectId, ref: 'Captain', required: true, index: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'CaptainMembershipPlan', required: true },
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
    renewedFromId: { type: mongoose.Schema.Types.ObjectId, ref: 'CaptainMembership', default: null },
    adminNote: { type: String, default: '' },
  },
  { timestamps: true, collection: 'captainmemberships' }
);

captainMembershipSchema.index({ captainId: 1, membershipStatus: 1, expiryDate: 1 });
captainMembershipSchema.index({ membershipStatus: 1, expiryDate: 1 });
captainMembershipSchema.index({ createdAt: -1 });

const CaptainMembership = mongoose.model('CaptainMembership', captainMembershipSchema);
export default CaptainMembership;
