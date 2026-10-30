import mongoose from 'mongoose';

// ── Sub-schema: Location Point ────────────────────────────────────────────────
const locationSchema = new mongoose.Schema(
  {
    address: { type: String, required: true, trim: true },
    landmark: { type: String, default: '', trim: true },
    city: { type: String, default: '', trim: true },
    state: { type: String, default: '', trim: true },
    pincode: { type: String, default: '', trim: true },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },
  { _id: false }
);

// ── Sub-schema: Stop Point ────────────────────────────────────────────────────
const stopSchema = new mongoose.Schema(
  {
    address: { type: String, required: true, trim: true },
    city: { type: String, default: '', trim: true },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },
  { _id: false }
);

// ── Sub-schema: Fare Breakdown ────────────────────────────────────────────────
const fareBreakdownSchema = new mongoose.Schema(
  {
    baseFare: { type: Number, required: true },
    distanceCharge: { type: Number, required: true },
    platformFee: { type: Number, required: true, default: 0 },
    discount: { type: Number, default: 0 },
    totalFare: { type: Number, required: true },
    waitingCharge: { type: Number, default: 0 },
    stopsCharge: { type: Number, default: 0 },
    nightSurge: { type: Number, default: 0 },
  },
  { _id: false }
);

// ── Sub-schema: Vehicle Snapshot ──────────────────────────────────────────────
// Snapshot is stored so that future pricing changes do NOT alter historical fares
const vehicleSnapshotSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true },
    capacityKg: { type: Number, required: true },
    baseFare: { type: Number, required: true },
    perKmFare: { type: Number, required: true },
    minimumFare: { type: Number, required: true },
    platformFee: { type: Number, default: 0 },
  },
  { _id: false }
);

// ── Sub-schema: Goods Details ─────────────────────────────────────────────────
const goodsSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      trim: true,
    },
    customCategory: { type: String, default: '', trim: true },
    weightKg: { type: Number, required: true, min: 0.1 },
    packages: { type: Number, required: true, min: 1 },
    instructions: { type: String, default: '', trim: true },
  },
  { _id: false }
);

// ── Sub-schema: Captain Request Entry ─────────────────────────────────────────
const captainRequestSchema = new mongoose.Schema(
  {
    captainId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Captain',
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'],
      default: 'PENDING',
    },
    earnings: { type: Number, required: true },
    sentAt: { type: Date, default: Date.now },
    respondedAt: { type: Date, default: null },
  },
  { _id: false }
);

// ── Sub-schema: Status History Entry ─────────────────────────────────────────
const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    changedBy: { type: String, enum: ['user', 'captain', 'system'], required: true },
    changedById: { type: mongoose.Schema.Types.ObjectId, default: null },
    reason: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ── Main Schema: TransportBooking ─────────────────────────────────────────────
const transportBookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      required: true,
      unique: true,
      // Format: TRB-{unix-timestamp}-{5 random chars} e.g. "TRB-1724168400-A1B2C"
    },

    // ── Parties ──────────────────────────────────────────────────────
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    captainId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Captain',
      default: null,
      index: true,
    },

    // ── Locations ─────────────────────────────────────────────────────
    pickupLocation: { type: locationSchema, required: true },
    dropLocation: { type: locationSchema, required: true },
    stops: { type: [stopSchema], default: [] }, // max 3 intermediate stops

    // ── Distance & Duration ───────────────────────────────────────────
    distanceKm: { type: Number, default: null },
    estimatedDurationMin: { type: Number, default: null },

    // ── Goods ─────────────────────────────────────────────────────────
    goods: { type: goodsSchema, required: true },

    // ── Vehicle ───────────────────────────────────────────────────────
    vehicleTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VehicleType',
      required: true,
    },
    vehicleSnapshot: { type: vehicleSnapshotSchema, required: true },

    // ── Fare ──────────────────────────────────────────────────────────
    fareBreakdown: { type: fareBreakdownSchema, required: true },

    // ── Payment ───────────────────────────────────────────────────────
    paymentMethod: {
      type: String,
      enum: ['CASH', 'UPI', 'CARD', 'WALLET'],
      default: 'CASH',
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid', 'Failed'],
      default: 'Pending',
    },
    razorpayOrderId: {
      type: String,
      default: null,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
      index: true,
    },
    razorpaySignature: {
      type: String,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },

    // ── Booking Status ────────────────────────────────────────────────
    status: {
      type: String,
      enum: [
        'SEARCHING_CAPTAIN',
        'CAPTAIN_ASSIGNED',
        'CAPTAIN_ARRIVING',
        'CAPTAIN_REACHED_PICKUP',
        'RIDE_STARTED',
        'CAPTAIN_REACHED_DROP',
        'RIDE_COMPLETED',
        'CANCELLED',
      ],
      default: 'SEARCHING_CAPTAIN',
      index: true,
    },

    // ── Multi-Captain Dispatch & Requests ─────────────────────────────
    captainRequests: { type: [captainRequestSchema], default: [] },

    // ── Captain Assignment & Payout ───────────────────────────────────
    captainCommissionRate: { type: Number, default: 5 },
    captainCommissionAmount: { type: Number, default: 0 },
    captainEarnings: { type: Number, default: 0 },
    captainEarning: { type: Number, default: 0 },

    // ── Pickup OTP Verification (Stage 1) ─────────────────────────────
    pickupOtp: { type: String, default: null }, // 4-digit OTP shown to user when captain reaches pickup
    pickupOtpVerified: { type: Boolean, default: false },
    pickupOtpVerifiedAt: { type: Date, default: null },
    pickupOtpAttempts: { type: Number, default: 0 },

    // ── Drop OTP Verification (Stage 2) ───────────────────────────────
    dropOtp: { type: String, default: null }, // 4-digit OTP shown to user when captain reaches drop
    dropOtpVerified: { type: Boolean, default: false },
    dropOtpVerifiedAt: { type: Date, default: null },
    dropOtpAttempts: { type: Number, default: 0 },

    // ── Goods photos taken at pickup (required before the ride starts) ─
    pickupPhotos: {
      type: [
        new mongoose.Schema(
          {
            url: { type: String, required: true },
            uploadedAt: { type: Date, default: Date.now },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    pickupPhotosVerified: { type: Boolean, default: false },

    // ── Delivery photos taken at drop (required before completion) ──
    dropPhotos: {
      type: [
        new mongoose.Schema(
          {
            url: { type: String, required: true },
            uploadedAt: { type: Date, default: Date.now },
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    // ── Latest captain GPS while the trip is active ──────────────────
    liveLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      heading: { type: Number, default: null },
      accuracy: { type: Number, default: null },
      updatedAt: { type: Date, default: null },
    },

    // ── Optional return / next route after delivery (not a new booking)
    returnRoute: {
      required: { type: Boolean, default: false },
      status: {
        type: String,
        enum: ['NONE', 'PENDING', 'IN_PROGRESS', 'COMPLETED'],
        default: 'NONE',
      },
      destination: { type: locationSchema, required: false },
      distanceKm: { type: Number, default: null },
      estimatedDurationMin: { type: Number, default: null },
      startedAt: { type: Date, default: null },
      completedAt: { type: Date, default: null },
    },

    // ── Proof of Delivery (first drop photo, kept for existing readers)
    proofOfDeliveryUrl: { type: String, default: null },

    // ── Cancellation ──────────────────────────────────────────────────
    cancelledBy: {
      type: String,
      enum: ['user', 'captain', 'system'],
      default: null,
    },
    cancellationReason: { type: String, default: '' },
    cancelledAt: { type: Date, default: null },

    // ── Ride Milestone Timestamps ─────────────────────────────────────
    captainAssignedAt: { type: Date, default: null },
    captainReachedPickupAt: { type: Date, default: null },
    rideStartedAt: { type: Date, default: null },
    captainReachedDropAt: { type: Date, default: null },
    rideCompletedAt: { type: Date, default: null },

    // ── Status History ────────────────────────────────────────────────
    statusHistory: { type: [statusHistorySchema], default: [] },
  },
  {
    timestamps: true, // createdAt, updatedAt
    collection: 'transportbookings',
    autoIndex: false,
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
transportBookingSchema.index({ user: 1, status: 1 });
transportBookingSchema.index({ user: 1, createdAt: -1 });
transportBookingSchema.index({ captainId: 1, status: 1 });
transportBookingSchema.index({ captainId: 1, createdAt: -1 });
transportBookingSchema.index({ status: 1, createdAt: -1 });
transportBookingSchema.index({ 'captainRequests.captainId': 1, 'captainRequests.status': 1 });
transportBookingSchema.index({ createdAt: -1 });

const TransportBooking = mongoose.model('TransportBooking', transportBookingSchema);
export default TransportBooking;
