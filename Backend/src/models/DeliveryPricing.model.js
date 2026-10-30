import mongoose from 'mongoose';

const deliveryPricingAuditSchema = new mongoose.Schema(
  {
    baseDeliveryFee: { type: Number, required: true },
    perKmDeliveryCharge: { type: Number, required: true },
    minimumDeliveryFee: { type: Number, required: true },
    freeDeliveryThreshold: { type: Number, required: true },
    isFreeDeliveryEnabled: { type: Boolean, default: true },
    codCharge: { type: Number, default: 9 },
    isCodChargeEnabled: { type: Boolean, default: true },
    extraDistanceCharge: { type: Number, required: true },
    thresholdDistanceKm: { type: Number, required: true },
    peakSurge: {
      enabled: { type: Boolean, default: false },
      surgeAmount: { type: Number, default: 0 },
      surgeMultiplier: { type: Number, default: 1.0 },
      description: { type: String, default: 'Peak / Rain surge' },
    },
    isActive: { type: Boolean, default: false },
    changedBy: { type: String, default: 'Admin' },
    changedAt: { type: Date, default: Date.now },
    reason: { type: String, default: 'Delivery pricing updated' },
  },
  { _id: false }
);

const deliveryPricingSchema = new mongoose.Schema(
  {
    configName: {
      type: String,
      required: [true, 'Configuration name is required'],
      trim: true,
      default: 'Standard E-Commerce Delivery Pricing',
    },
    description: {
      type: String,
      trim: true,
      default: 'Default delivery rate card for grocery and e-commerce customer parcels',
    },
    baseDeliveryFee: {
      type: Number,
      required: [true, 'Base delivery fee is required'],
      min: [0, 'Base delivery fee cannot be negative'],
      default: 40,
    },
    perKmDeliveryCharge: {
      type: Number,
      required: [true, 'Per KM delivery charge is required'],
      min: [0, 'Per KM delivery charge cannot be negative'],
      default: 5,
    },
    minimumDeliveryFee: {
      type: Number,
      required: [true, 'Minimum delivery fee is required'],
      min: [0, 'Minimum delivery fee cannot be negative'],
      default: 40,
    },
    freeDeliveryThreshold: {
      type: Number,
      required: [true, 'Free delivery threshold order amount is required'],
      min: [0, 'Free delivery threshold cannot be negative'],
      default: 500,
    },
    isFreeDeliveryEnabled: {
      type: Boolean,
      default: true,
    },
    codCharge: {
      type: Number,
      min: [0, 'COD charge cannot be negative'],
      default: 9,
    },
    isCodChargeEnabled: {
      type: Boolean,
      default: true,
    },
    extraDistanceCharge: {
      type: Number,
      required: [true, 'Extra distance charge is required'],
      min: [0, 'Extra distance charge cannot be negative'],
      default: 10,
    },
    thresholdDistanceKm: {
      type: Number,
      required: [true, 'Threshold distance in KM is required'],
      min: [0, 'Threshold distance cannot be negative'],
      default: 5,
    },
    peakSurge: {
      enabled: {
        type: Boolean,
        default: false,
      },
      surgeAmount: {
        type: Number,
        min: [0, 'Surge amount cannot be negative'],
        default: 0,
      },
      surgeMultiplier: {
        type: Number,
        min: [1, 'Surge multiplier must be at least 1.0'],
        default: 1.0,
      },
      description: {
        type: String,
        default: 'Peak Hour / Bad Weather Delivery Surge',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    updatedBy: {
      type: String,
      default: 'System Initializer',
    },
    history: [deliveryPricingAuditSchema],
  },
  {
    timestamps: true,
    collection: 'deliverypricings',
  }
);

// Helper: Ensure one active document exists or initialize default
deliveryPricingSchema.statics.getActiveConfig = async function () {
  let active = await this.findOne({ isActive: true }).sort({ updatedAt: -1 });
  if (!active) {
    // If none active, check if any exists
    const anyConfig = await this.findOne().sort({ updatedAt: -1 });
    if (anyConfig) {
      anyConfig.isActive = true;
      await anyConfig.save();
      return anyConfig;
    }
    // Create initial active default
    active = await this.create({
      configName: 'Standard Parcel & Grocery Delivery Rate Card',
      description: 'Default rate matrix for retail product deliveries and local courier parcels',
      baseDeliveryFee: 40,
      perKmDeliveryCharge: 5,
      minimumDeliveryFee: 40,
      freeDeliveryThreshold: 500,
      isFreeDeliveryEnabled: true,
      codCharge: 9,
      isCodChargeEnabled: true,
      extraDistanceCharge: 10,
      thresholdDistanceKm: 5,
      peakSurge: {
        enabled: false,
        surgeAmount: 0,
        surgeMultiplier: 1.0,
        description: 'Peak Hour / Bad Weather Delivery Surge',
      },
      isActive: true,
      updatedBy: 'System Initializer',
      history: [
        {
          baseDeliveryFee: 40,
          perKmDeliveryCharge: 5,
          minimumDeliveryFee: 40,
          freeDeliveryThreshold: 500,
          isFreeDeliveryEnabled: true,
          codCharge: 9,
          isCodChargeEnabled: true,
          extraDistanceCharge: 10,
          thresholdDistanceKm: 5,
          peakSurge: {
            enabled: false,
            surgeAmount: 0,
            surgeMultiplier: 1.0,
            description: 'Peak Hour / Bad Weather Delivery Surge',
          },
          isActive: true,
          changedBy: 'System Initializer',
          changedAt: new Date(),
          reason: 'Initial default delivery pricing configuration created',
        },
      ],
    });
  } else {
    let needSave = false;
    if (active.codCharge === undefined) {
      active.codCharge = 9;
      needSave = true;
    }
    if (active.isCodChargeEnabled === undefined) {
      active.isCodChargeEnabled = true;
      needSave = true;
    }
    if (needSave) {
      await active.save();
    }
  }
  return active;
};

const DeliveryPricing = mongoose.model('DeliveryPricing', deliveryPricingSchema);

export default DeliveryPricing;
