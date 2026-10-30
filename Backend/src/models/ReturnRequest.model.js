import mongoose from 'mongoose';

const returnRequestSchema = new mongoose.Schema(
  {
    returnId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    orderId: {
      type: String,
      required: true,
      index: true,
    },
    orderItemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    productImage: {
      type: String,
      default: '',
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    variantId: {
      type: String,
      default: null,
    },
    variantTitle: {
      type: String,
      default: '',
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    itemTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discountAllocation: {
      type: Number,
      default: 0,
    },
    taxAllocation: {
      type: Number,
      default: 0,
    },
    refundAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    customerName: {
      type: String,
      default: 'Customer',
    },
    customerPhone: {
      type: String,
      default: '',
    },
    customerAddress: {
      fullName: String,
      phone: String,
      addressLine1: String,
      addressLine2: String,
      landmark: String,
      city: String,
      state: String,
      pincode: String,
      location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] },
      },
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      default: null,
      index: true,
    },
    sellerName: {
      type: String,
      default: 'Sathi Seller Store',
    },
    sellerAddress: {
      storeName: String,
      phone: String,
      addressLine1: String,
      city: String,
      state: String,
      pincode: String,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    customerNotes: {
      type: String,
      default: '',
      trim: true,
    },
    customerImages: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: [
        'REQUESTED',
        'APPROVED',
        'REJECTED',
        'CAPTAIN_ASSIGNMENT_PENDING',
        'CAPTAIN_ASSIGNED',
        'PICKUP_STARTED',
        'PICKUP_ARRIVED',
        'PICKED_UP',
        'IN_TRANSIT_TO_SELLER',
        'RECEIVED_BY_SELLER',
        'UNDER_VERIFICATION',
        'VERIFICATION_PASSED',
        'VERIFICATION_FAILED',
        'REFUND_INITIATED',
        'REFUNDED',
        'COMPLETED',
        'CANCELLED',
      ],
      default: 'REQUESTED',
      index: true,
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    // Return Pickup OTP (Secure 4-digit code generated for customer)
    returnOtp: {
      type: String,
      default: null,
    },
    returnOtpExpiry: {
      type: Date,
      default: null,
    },
    returnOtpVerifiedAt: {
      type: Date,
      default: null,
    },
    // Captain Assignment Fields
    captain: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Captain',
      default: null,
      index: true,
    },
    captainStatus: {
      type: String,
      enum: [null, 'Assigned', 'Accepted', 'Rejected', 'At Pickup', 'Picked Up', 'In Transit', 'Delivered to Seller'],
      default: null,
    },
    captainEarnings: {
      type: Number,
      default: 40, // Base return pickup payout for Captain
    },
    captainAssignedAt: {
      type: Date,
      default: null,
    },
    captainAcceptedAt: {
      type: Date,
      default: null,
    },
    pickupStartedAt: {
      type: Date,
      default: null,
    },
    pickupArrivedAt: {
      type: Date,
      default: null,
    },
    pickedUpAt: {
      type: Date,
      default: null,
    },
    pickupNotes: {
      type: String,
      default: '',
    },
    pickupProofUrl: {
      type: String,
      default: '',
    },
    pickupChecklist: {
      correctItem: { type: Boolean, default: true },
      undamaged: { type: Boolean, default: true },
      originalTagsPresent: { type: Boolean, default: true },
      packagingIntact: { type: Boolean, default: true },
      notes: { type: String, default: '' },
    },
    // Seller Receiving Fields
    receivedAt: {
      type: Date,
      default: null,
    },
    receivedBy: {
      type: String,
      default: '',
    },
    receivingNotes: {
      type: String,
      default: '',
    },
    // Product Verification Fields
    verificationStatus: {
      type: String,
      enum: [null, 'PENDING', 'PASSED', 'FAILED'],
      default: null,
    },
    verificationData: {
      correctItem: { type: Boolean, default: true },
      undamaged: { type: Boolean, default: true },
      originalTagsPresent: { type: Boolean, default: true },
      packagingIntact: { type: Boolean, default: true },
      failureReason: { type: String, default: '' },
      verifierNotes: { type: String, default: '' },
      verificationImages: { type: [String], default: [] },
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    verifiedByRole: {
      type: String,
      enum: [null, 'seller', 'admin'],
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    // Refund & Settlement Tracking
    refundMethod: {
      type: String,
      enum: ['WALLET', 'ORIGINAL_PAYMENT', 'BANK_TRANSFER', 'COD_REFUND'],
      default: 'WALLET',
    },
    refundStatus: {
      type: String,
      enum: ['PENDING', 'INITIATED', 'COMPLETED', 'FAILED'],
      default: 'PENDING',
    },
    refundReference: {
      type: String,
      default: '',
    },
    refundProcessedAt: {
      type: Date,
      default: null,
    },
    // Inventory & Financial Adjustments (Guarantees single execution / idempotency)
    inventoryRestored: {
      type: Boolean,
      default: false,
    },
    inventoryRestoredAt: {
      type: Date,
      default: null,
    },
    sellerSettlementAdjusted: {
      type: Boolean,
      default: false,
    },
    sellerSettlementReversedAmount: {
      type: Number,
      default: 0,
    },
    timeline: [
      {
        status: { type: String, required: true },
        title: { type: String, required: true },
        description: { type: String, default: '' },
        timestamp: { type: Date, default: Date.now },
        actor: { type: String, default: 'System' },
      },
    ],
  },
  {
    timestamps: true,
  }
);

returnRequestSchema.index({ order: 1, orderItemId: 1 });
returnRequestSchema.index({ user: 1, createdAt: -1 });
returnRequestSchema.index({ seller: 1, status: 1, createdAt: -1 });
returnRequestSchema.index({ seller: 1, createdAt: -1 });
returnRequestSchema.index({ captain: 1, status: 1 });
returnRequestSchema.index({ captain: 1, createdAt: -1 });
returnRequestSchema.index({ status: 1, createdAt: -1 });
returnRequestSchema.index({ createdAt: -1 });

const ReturnRequest = mongoose.model('ReturnRequest', returnRequestSchema);
export default ReturnRequest;
