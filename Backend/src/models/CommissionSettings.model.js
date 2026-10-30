import mongoose from 'mongoose';

const commissionAuditHistorySchema = new mongoose.Schema(
  {
    sellerCommission: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    captainCommission: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    sellerCommissionType: {
      type: String,
      default: 'Percentage',
    },
    captainCommissionType: {
      type: String,
      default: 'Percentage',
    },
    deliveryCharge: {
      type: Number,
      default: 40,
    },
    freeDeliveryMinOrder: {
      type: Number,
      default: 500,
    },
    isFreeDeliveryEnabled: {
      type: Boolean,
      default: true,
    },
    codCharge: {
      type: Number,
      default: 9,
    },
    isCodChargeEnabled: {
      type: Boolean,
      default: true,
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
      default: 'Commission & Delivery configuration updated',
      trim: true,
    },
  },
  { _id: false }
);

const commissionSettingsSchema = new mongoose.Schema(
  {
    sellerCommission: {
      type: Number,
      required: true,
      min: [0, 'Seller commission percentage cannot be negative'],
      max: [100, 'Seller commission percentage cannot exceed 100%'],
      default: 10,
    },
    captainCommission: {
      type: Number,
      required: true,
      min: [0, 'Captain commission percentage cannot be negative'],
      max: [100, 'Captain commission percentage cannot exceed 100%'],
      default: 5,
    },
    sellerCommissionType: {
      type: String,
      enum: ['Percentage'],
      default: 'Percentage',
    },
    captainCommissionType: {
      type: String,
      enum: ['Percentage'],
      default: 'Percentage',
    },
    deliveryCharge: {
      type: Number,
      required: true,
      min: [0, 'Delivery charge cannot be negative'],
      default: 40,
    },
    freeDeliveryMinOrder: {
      type: Number,
      required: true,
      min: [0, 'Free delivery minimum order cannot be negative'],
      default: 500,
    },
    isFreeDeliveryEnabled: {
      type: Boolean,
      default: true,
    },
    codCharge: {
      type: Number,
      required: true,
      min: [0, 'COD charge cannot be negative'],
      default: 9,
    },
    isCodChargeEnabled: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    updatedBy: {
      type: String,
      default: 'Admin',
    },
    history: [commissionAuditHistorySchema],
  },
  {
    timestamps: true,
    collection: 'commissionsettings',
  }
);

// Helper to get or initialize active settings singleton
commissionSettingsSchema.statics.getOrCreateActiveSettings = async function () {
  let settings = await this.findOne({}).sort({ createdAt: -1 });
  if (!settings) {
    settings = await this.create({
      sellerCommission: 10,
      captainCommission: 5,
      sellerCommissionType: 'Percentage',
      captainCommissionType: 'Percentage',
      deliveryCharge: 40,
      freeDeliveryMinOrder: 500,
      isFreeDeliveryEnabled: true,
      codCharge: 9,
      isCodChargeEnabled: true,
      isActive: true,
      updatedBy: 'System Initializer',
      history: [
        {
          sellerCommission: 10,
          captainCommission: 5,
          sellerCommissionType: 'Percentage',
          captainCommissionType: 'Percentage',
          deliveryCharge: 40,
          freeDeliveryMinOrder: 500,
          isFreeDeliveryEnabled: true,
          codCharge: 9,
          isCodChargeEnabled: true,
          isActive: true,
          changedBy: 'System Initializer',
          changedAt: new Date(),
          reason: 'Initial system default configuration (Seller: 10%, Captain: 5%, Delivery: ₹40, Free above: ₹500, COD: ₹9)',
        },
      ],
    });
  } else {
    // If existing document lacks delivery/COD settings, initialize defaults
    let needSave = false;
    if (settings.deliveryCharge === undefined) {
      settings.deliveryCharge = 40;
      needSave = true;
    }
    if (settings.freeDeliveryMinOrder === undefined) {
      settings.freeDeliveryMinOrder = 500;
      needSave = true;
    }
    if (settings.isFreeDeliveryEnabled === undefined) {
      settings.isFreeDeliveryEnabled = true;
      needSave = true;
    }
    if (settings.codCharge === undefined) {
      settings.codCharge = 9;
      needSave = true;
    }
    if (settings.isCodChargeEnabled === undefined) {
      settings.isCodChargeEnabled = true;
      needSave = true;
    }
    if (needSave) {
      await settings.save();
    }
  }
  return settings;
};

const CommissionSettings = mongoose.model('CommissionSettings', commissionSettingsSchema);

export default CommissionSettings;
