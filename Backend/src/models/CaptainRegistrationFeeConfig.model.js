import mongoose from 'mongoose';

const feeAuditHistorySchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    changedBy: {
      type: String,
      default: 'Admin',
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
    reason: {
      type: String,
      default: 'Captain fee configuration updated',
      trim: true,
    },
  },
  { _id: false }
);

const captainRegistrationFeeConfigSchema = new mongoose.Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: [0, 'Registration fee amount cannot be negative'],
      default: 150,
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
      uppercase: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    description: {
      type: String,
      default: 'One-time onboarding and background verification fee for new delivery captain registrations.',
      trim: true,
    },
    updatedBy: {
      type: String,
      default: 'Admin',
    },
    history: [feeAuditHistorySchema],
  },
  {
    timestamps: true,
    collection: 'captainregistrationfeeconfigs',
  }
);

// Helper to get or initialize active config
captainRegistrationFeeConfigSchema.statics.getOrCreateActiveConfig = async function () {
  let config = await this.findOne({}).sort({ createdAt: -1 });
  if (!config) {
    config = await this.create({
      amount: 150,
      currency: 'INR',
      isActive: true,
      description: 'One-time onboarding and background verification fee for new delivery captain registrations.',
      updatedBy: 'System Initializer',
      history: [
        {
          amount: 150,
          currency: 'INR',
          isActive: true,
          changedBy: 'System Initializer',
          changedAt: new Date(),
          reason: 'Initial system default captain registration fee configuration',
        },
      ],
    });
  }
  return config;
};

const CaptainRegistrationFeeConfig = mongoose.model(
  'CaptainRegistrationFeeConfig',
  captainRegistrationFeeConfigSchema
);

export default CaptainRegistrationFeeConfig;
