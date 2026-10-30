import mongoose from 'mongoose';

/**
 * VehicleType Model
 * Stores transport vehicle categories with server-controlled pricing.
 * Admin manages this collection — frontend never hardcodes prices.
 */
const vehicleTypeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      // e.g. "Motorcycle", "3 Wheeler", "Mini Truck", "Pickup 8ft", "Truck 14ft"
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      // e.g. "motorcycle", "three-wheeler", "mini-truck"
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    capacityKg: {
      type: Number,
      required: true,
      min: 1,
      // Max cargo weight the vehicle can carry (kg)
    },
    dimensions: {
      type: String,
      default: '',
      trim: true,
      // Cargo compartment dimensions e.g. "40 x 40 x 40 cm" or "5.5 x 4.2 x 4.0 ft"
    },
    suitableFor: {
      type: String,
      default: '',
      trim: true,
      // e.g. "Small packages, Food items, Documents"
    },
    vehicleCategory: {
      type: String,
      enum: ['2_wheeler', '3_wheeler', '4_wheeler', 'heavy_truck', 'other'],
      default: '3_wheeler',
    },
    imageUrl: {
      type: String,
      default: '',
      trim: true,
    },
    speedKmH: {
      type: Number,
      default: 30,
      min: 1,
    },
    icon: {
      type: String,
      default: 'truck',
      // Frontend icon identifier: "bike", "auto", "truck", "van", "pickup", "car"
    },

    // ── Pricing (all in INR) ──────────────────────────────────────────
    baseFare: {
      type: Number,
      required: true,
      min: 0,
      // Flat charge applied to every booking regardless of distance
    },
    perKmFare: {
      type: Number,
      required: true,
      min: 0,
      // Added per km travelled
    },
    minimumFare: {
      type: Number,
      required: true,
      min: 0,
      // If (baseFare + distanceCharge) < minimumFare, use minimumFare
    },
    platformFee: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
      // Fixed platform/service charge added on top of ride fare
    },
    // ─────────────────────────────────────────────────────────────────

    isActive: {
      type: Boolean,
      default: true,
      // Admin can deactivate a vehicle type without deleting it
    },
    sortOrder: {
      type: Number,
      default: 0,
      // Controls display order in the UI (ascending)
    },
  },
  {
    timestamps: true,
    collection: 'vehicletypes',
  }
);

const VehicleType = mongoose.model('VehicleType', vehicleTypeSchema);
export default VehicleType;
