import mongoose from 'mongoose';

const referralSchema = new mongoose.Schema(
  {
    // The user who shared the referral code
    referrerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    referrerRole: {
      type: String,
      enum: ['seller', 'captain'],
      required: true,
      index: true,
    },
    // The user who registered using the referral code
    referredId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    referredRole: {
      type: String,
      enum: ['seller', 'captain'],
      required: true,
    },
    referralCode: {
      type: String,
      required: true,
      index: true,
    },
    // Lifecycle status
    status: {
      type: String,
      enum: ['Pending', 'Registered', 'Approved', 'Qualified', 'Rewarded', 'Rejected'],
      default: 'Pending',
      index: true,
    },
    // Snapshot of the reward amount at the time of reward (immutable after set)
    rewardAmount: {
      type: Number,
      default: 0,
    },
    rewardStatus: {
      type: String,
      enum: ['Pending', 'Credited', 'Failed'],
      default: 'Pending',
    },
    // Transaction ID for idempotency (prevents double-crediting)
    rewardTransactionId: {
      type: String,
      default: null,
      sparse: true,
    },
    // Metadata for referred user (captured at registration, before referredId exists)
    referredPhone: {
      type: String,
      default: '',
    },
    referredName: {
      type: String,
      default: '',
    },
    // Timestamps for state transitions
    approvedAt: { type: Date, default: null },
    rewardedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' },
  },
  {
    timestamps: true,
    collection: 'referrals',
  }
);

// Compound indexes for common queries
referralSchema.index({ referrerId: 1, referrerRole: 1, createdAt: -1 });
referralSchema.index({ referralCode: 1, referredPhone: 1 }, { unique: true, sparse: true });
referralSchema.index({ status: 1, createdAt: -1 });

const Referral = mongoose.model('Referral', referralSchema);
export default Referral;
