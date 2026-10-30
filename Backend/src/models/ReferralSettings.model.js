import mongoose from 'mongoose';

const settingsHistorySchema = new mongoose.Schema(
  {
    sellerReferralEnabled: { type: Boolean },
    sellerRewardAmount: { type: Number },
    sellerRewardTrigger: { type: String },
    captainReferralEnabled: { type: Boolean },
    captainRewardAmount: { type: Number },
    captainRewardTrigger: { type: String },
    changedBy: { type: String, default: 'Admin' },
    changedAt: { type: Date, default: Date.now },
    reason: { type: String, default: 'Settings updated' },
  },
  { _id: false }
);

const referralSettingsSchema = new mongoose.Schema(
  {
    // Seller referral config
    sellerReferralEnabled: {
      type: Boolean,
      default: true,
    },
    sellerRewardAmount: {
      type: Number,
      default: 200,
      min: [0, 'Reward amount cannot be negative'],
    },
    sellerRewardTrigger: {
      type: String,
      enum: ['registration', 'admin_approval', 'first_order'],
      default: 'admin_approval',
    },
    // Captain referral config
    captainReferralEnabled: {
      type: Boolean,
      default: true,
    },
    captainRewardAmount: {
      type: Number,
      default: 100,
      min: [0, 'Reward amount cannot be negative'],
    },
    captainRewardTrigger: {
      type: String,
      enum: ['registration', 'admin_approval', 'first_order'],
      default: 'admin_approval',
    },
    updatedBy: {
      type: String,
      default: 'Admin',
    },
    history: [settingsHistorySchema],
  },
  {
    timestamps: true,
    collection: 'referralsettings',
  }
);

// Singleton: get or create the one settings document
referralSettingsSchema.statics.getOrCreateSettings = async function () {
  let settings = await this.findOne({}).sort({ createdAt: -1 });
  if (!settings) {
    settings = await this.create({
      sellerReferralEnabled: true,
      sellerRewardAmount: 200,
      sellerRewardTrigger: 'admin_approval',
      captainReferralEnabled: true,
      captainRewardAmount: 100,
      captainRewardTrigger: 'admin_approval',
      updatedBy: 'System Initializer',
      history: [
        {
          sellerReferralEnabled: true,
          sellerRewardAmount: 200,
          sellerRewardTrigger: 'admin_approval',
          captainReferralEnabled: true,
          captainRewardAmount: 100,
          captainRewardTrigger: 'admin_approval',
          changedBy: 'System Initializer',
          changedAt: new Date(),
          reason: 'Initial referral settings configuration',
        },
      ],
    });
  }
  return settings;
};

const ReferralSettings = mongoose.model('ReferralSettings', referralSettingsSchema);
export default ReferralSettings;
