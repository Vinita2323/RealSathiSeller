import mongoose from 'mongoose';

const transportPricingAuditSchema = new mongoose.Schema(
  {
    baseFare: { type: Number, required: true },
    perKmFare: { type: Number, required: true },
    minimumFare: { type: Number, required: true },
    waitingChargePerMin: { type: Number, required: true },
    additionalStopCharge: { type: Number, required: true },
    platformFee: { type: Number, default: 0 },
    nightPeakPricing: {
      enabled: { type: Boolean, default: false },
      surgeMultiplier: { type: Number, default: 1.25 },
      surgeFlat: { type: Number, default: 0 },
      startHour: { type: String, default: '22:00' },
      endHour: { type: String, default: '06:00' },
      description: { type: String, default: 'Night / Peak hours surcharge' },
    },
    isActive: { type: Boolean, default: false },
    changedBy: { type: String, default: 'Admin' },
    changedAt: { type: Date, default: Date.now },
    reason: { type: String, default: 'Transport pricing updated' },
  },
  { _id: false }
);

const transportPricingSchema = new mongoose.Schema(
  {
    configName: {
      type: String,
      required: [true, 'Configuration name is required'],
      trim: true,
      default: 'Standard Transport Pricing',
    },
    description: {
      type: String,
      trim: true,
      default: 'Standard urban logistics and goods transport pricing schedule',
    },
    baseFare: {
      type: Number,
      required: [true, 'Base fare is required'],
      min: [0, 'Base fare cannot be negative'],
      default: 50,
    },
    perKmFare: {
      type: Number,
      required: [true, 'Per KM charge is required'],
      min: [0, 'Per KM charge cannot be negative'],
      default: 15,
    },
    minimumFare: {
      type: Number,
      required: [true, 'Minimum fare is required'],
      min: [0, 'Minimum fare cannot be negative'],
      default: 60,
    },
    waitingChargePerMin: {
      type: Number,
      required: [true, 'Waiting charge per minute is required'],
      min: [0, 'Waiting charge per minute cannot be negative'],
      default: 2,
    },
    additionalStopCharge: {
      type: Number,
      required: [true, 'Additional stop charge is required'],
      min: [0, 'Additional stop charge cannot be negative'],
      default: 30,
    },
    platformFee: {
      type: Number,
      min: [0, 'Platform fee cannot be negative'],
      default: 10,
    },
    // When true, new bookings include a return-to-pickup leg after delivery.
    // Existing bookings stay unchanged, and no second booking is created.
    returnToPickup: {
      type: Boolean,
      default: false,
    },
    nightPeakPricing: {
      enabled: {
        type: Boolean,
        default: false,
      },
      surgeMultiplier: {
        type: Number,
        min: [1, 'Surge multiplier must be at least 1.0'],
        default: 1.25,
      },
      surgeFlat: {
        type: Number,
        min: [0, 'Flat surge fee cannot be negative'],
        default: 0,
      },
      startHour: {
        type: String,
        default: '22:00',
      },
      endHour: {
        type: String,
        default: '06:00',
      },
      description: {
        type: String,
        default: 'Late Night / Rush Hour Transport Surcharge',
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
    history: [transportPricingAuditSchema],
  },
  {
    timestamps: true,
    collection: 'transportpricings',
  }
);

// Helper: Ensure one active document exists or initialize default
transportPricingSchema.statics.getActiveConfig = async function () {
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
      configName: 'Standard Logistics Rate Matrix',
      description: 'Default platform rate matrix for on-demand transport & freight bookings',
      baseFare: 50,
      perKmFare: 15,
      minimumFare: 60,
      waitingChargePerMin: 2,
      additionalStopCharge: 30,
      platformFee: 10,
      nightPeakPricing: {
        enabled: false,
        surgeMultiplier: 1.25,
        surgeFlat: 0,
        startHour: '22:00',
        endHour: '06:00',
        description: 'Night / Peak Surcharge',
      },
      isActive: true,
      updatedBy: 'System Initializer',
      history: [
        {
          baseFare: 50,
          perKmFare: 15,
          minimumFare: 60,
          waitingChargePerMin: 2,
          additionalStopCharge: 30,
          platformFee: 10,
          nightPeakPricing: {
            enabled: false,
            surgeMultiplier: 1.25,
            surgeFlat: 0,
            startHour: '22:00',
            endHour: '06:00',
            description: 'Night / Peak Surcharge',
          },
          isActive: true,
          changedBy: 'System Initializer',
          changedAt: new Date(),
          reason: 'Initial default transport pricing configuration created',
        },
      ],
    });
  }
  return active;
};

const TransportPricing = mongoose.model('TransportPricing', transportPricingSchema);

export default TransportPricing;
