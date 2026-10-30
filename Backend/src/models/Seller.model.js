import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const sellerSchema = new mongoose.Schema(
  {
    businessName: {
      type: String,
      trim: true,
      default: 'Seller Store',
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
    },
    ownerName: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    businessType: { type: String, trim: true },
    storeLogo: { type: String },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },
    },
    serviceRadius: { 
      type: Number, 
      default: 5,
      min: [0.1, 'Service radius must be at least 0.1 KM'],
      max: [200, 'Service radius cannot exceed 200 KM']
    },
    gstNumber: { type: String, trim: true },
    panNumber: { type: String, trim: true },
    fssaiLicense: { type: String, trim: true },
    gstPhoto: { type: String },
    bankPassbookPhoto: { type: String },
    tagline: { type: String, trim: true },
    bankName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    ifscCode: { type: String, trim: true },
    categories: [{ type: String }],
    commissionPercentage: {
      type: Number,
      default: 10,
    },
    walletBalance: {
      type: Number,
      default: 0,
    },
    pendingBalance: {
      type: Number,
      default: 0,
    },
    totalEarnings: {
      type: Number,
      default: 0,
    },
    totalCommissionDeducted: {
      type: Number,
      default: 0,
    },
    totalWithdrawn: {
      type: Number,
      default: 0,
    },
    role: {
      type: String,
      default: 'seller',
    },
    otp: {
      type: String,
    },
    otpExpiry: {
      type: Date,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    accountStatus: {
      type: String,
      enum: ['pending_otp', 'under_review', 'approved', 'rejected', 'suspended'],
      default: 'pending_otp',
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'under_review', 'pending_otp', 'suspended'],
      default: 'pending',
    },
    isOnline: {
      type: Boolean,
      default: true,
      index: true,
    },
    membershipStatus: {
      type: String,
      enum: ['active', 'expired', 'pending_payment', 'none'],
      default: 'none',
    },
    registrationFeeStatus: {
      type: String,
      enum: ['pending', 'paid', 'not_required', 'failed'],
      default: 'pending',
      index: true,
    },
    registrationFeePaymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SellerRegistrationPayment',
    },
    registrationFeeAmount: {
      type: Number,
      default: 0,
    },
    registrationFeePaidAt: {
      type: Date,
    },
    warehouseLocation: {
      location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] },
      },
      storeAddress: String,
      state: String,
      district: String,
      city: String,
      area: String,
      pincode: String,
    },
    // FCM Push Notification Tokens (SOP Standard)
    fcmTokens: {
      type: [String],
      default: [],
    },
    fcmTokenMobile: {
      type: [String],
      default: [],
    },
    // Referral System
    referralCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

sellerSchema.index({ location: '2dsphere' }, { sparse: true });
sellerSchema.index({ 'warehouseLocation.location': '2dsphere' }, { sparse: true });
sellerSchema.index({ accountStatus: 1, createdAt: -1 });
sellerSchema.index({ status: 1, createdAt: -1 });
sellerSchema.index({ registrationFeeStatus: 1, createdAt: -1 });
sellerSchema.index({ businessName: 1 });
sellerSchema.index({ serviceRadius: 1 });
sellerSchema.index({ createdAt: -1 });
sellerSchema.index({ referralCode: 1 }, { sparse: true });

// Sync coordinates between location and warehouseLocation.location & hash password
sellerSchema.pre('save', async function () {
  // Sync coordinates between root location and warehouseLocation.location
  const rootCoords = this.location?.coordinates;
  const whCoords = this.warehouseLocation?.location?.coordinates;

  if (whCoords && Array.isArray(whCoords) && (whCoords[0] !== 0 || whCoords[1] !== 0)) {
    if (!this.location) this.location = { type: 'Point', coordinates: [0, 0] };
    this.location.coordinates = whCoords;
  } else if (rootCoords && Array.isArray(rootCoords) && (rootCoords[0] !== 0 || rootCoords[1] !== 0)) {
    if (!this.warehouseLocation) this.warehouseLocation = {};
    if (!this.warehouseLocation.location) this.warehouseLocation.location = { type: 'Point', coordinates: [0, 0] };
    this.warehouseLocation.location.coordinates = rootCoords;
  }

  if (!this.isModified('password') || !this.password) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match password method
sellerSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

const Seller = mongoose.model('Seller', sellerSchema);
export default Seller;
