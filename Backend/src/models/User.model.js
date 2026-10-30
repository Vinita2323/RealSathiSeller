import mongoose from 'mongoose';
import { selectedVariantSchema } from '../utils/selectedVariants.js';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: 'User',
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    dob: {
      type: String,
      trim: true,
      default: '',
    },
    role: {
      type: String,
      default: 'user',
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
    isBlocked: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'blocked', 'suspended', 'pending'],
      default: 'active',
      index: true,
    },
    blockReason: {
      type: String,
      default: '',
      trim: true,
    },
    blockedAt: {
      type: Date,
      default: null,
    },
    blockedBy: {
      type: String,
      default: '',
      trim: true,
    },
    addresses: [
      {
        fullName: String,
        phone: String,
        altPhone: String,
        email: String,
        addressLine1: String,
        addressLine2: String,
        landmark: String,
        city: String,
        state: String,
        pincode: String,
        country: { type: String, default: 'India' },
        addressType: { type: String, enum: ['Home', 'Office', 'Other'], default: 'Home' },
        location: {
          type: { type: String, enum: ['Point'], default: 'Point' },
          coordinates: { type: [Number], default: [0, 0] },
        },
        addressString: String,
        district: String,
        area: String,
        isDefault: { type: Boolean, default: false },
      },
    ],
    cart: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
          default: 1,
        },
        variantSku: { type: String, default: '' },
        variantId: { type: String, default: '' },
        variantTitle: { type: String, default: '' },
        selectedAttributes: { type: mongoose.Schema.Types.Mixed, default: undefined },
        selectedVariants: { type: [selectedVariantSchema], default: undefined },
        price: { type: Number },
        originalPrice: { type: Number },
        image: { type: String, default: '' },
      },
    ],
    wishlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    walletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Rating fields (Calculated from Captain reviews)
    ratingAverage: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    ratingCount: {
      type: Number,
      default: 0,
      min: 0,
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
  },
  {
    timestamps: true,
  }
);

userSchema.index({ 'addresses.location': '2dsphere' });
userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ email: 1 });
userSchema.index({ createdAt: -1 });

const User = mongoose.model('User', userSchema);
export default User;
