import mongoose from 'mongoose';
import { selectedVariantSchema } from '../utils/selectedVariants.js';

const sellerNotificationItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  originalPrice: { type: Number },
  quantity: { type: Number, required: true, min: 1 },
  image: { type: String },
  variantSku: { type: String, default: '' },
  variantId: { type: String, default: '' },
  sku: { type: String, default: '' },
  variantTitle: { type: String, default: '' },
  selectedAttributes: { type: mongoose.Schema.Types.Mixed, default: undefined },
  selectedVariants: { type: [selectedVariantSchema], default: undefined },
});

const sellerNotificationSchema = new mongoose.Schema(
  {
    sellerId: {
      type: String,
      required: true,
      index: true,
    },
    sellerName: {
      type: String,
      default: 'Seller Store',
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    orderId: {
      type: String,
      required: true,
    },
    items: [sellerNotificationItemSchema],
    customerDetails: {
      name: { type: String, default: 'Customer' },
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
    },
    deliveryAddress: {
      fullName: { type: String },
      phone: { type: String },
      addressLine1: { type: String },
      addressLine2: { type: String, default: '' },
      landmark: { type: String, default: '' },
      city: { type: String },
      state: { type: String },
      pincode: { type: String },
      addressType: { type: String, default: 'Home' },
    },
    deliverySlot: {
      date: { type: String, default: 'Today' },
      time: { type: String, default: 'Standard Delivery' },
    },
    paymentMethod: {
      type: String,
      default: 'COD',
    },
    paymentStatus: {
      type: String,
      default: 'Pending',
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['NEW', 'VIEWED', 'ACCEPTED', 'REJECTED', 'PACKED', 'Packed', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'Accepted', 'Rejected', 'Out for Delivery', 'Delivered', 'Processing', 'Placed'],
      default: 'NEW',
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    commissionRate: {
      type: Number,
      default: 10,
    },
    commissionAmount: {
      type: Number,
      default: 0,
    },
    netSellerAmount: {
      type: Number,
      default: 0,
    },
    settlementStatus: {
      type: String,
      enum: ['PENDING', 'SETTLED', 'FAILED', 'REVERSED'],
      default: 'PENDING',
    },
    proofOfDeliveryUrl: {
      type: String,
      default: '',
    },
    pickupOtp: {
      type: String,
      default: null,
    },
    pickupOtpVerified: {
      type: Boolean,
      default: false,
    },
    pickupOtpVerifiedAt: {
      type: Date,
      default: null,
    },
    captainId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Captain',
    },
    captainName: {
      type: String,
      default: '',
    },
    captainPhone: {
      type: String,
      default: '',
    },
    viewedAt: { type: Date },
    acceptedAt: { type: Date },
    rejectedAt: { type: Date },
    settledAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

sellerNotificationSchema.index({ sellerId: 1, status: 1, createdAt: -1 });
sellerNotificationSchema.index({ sellerId: 1, settlementStatus: 1 });
sellerNotificationSchema.index({ settlementStatus: 1, createdAt: -1 });
sellerNotificationSchema.index({ order: 1 });
sellerNotificationSchema.index({ orderId: 1 });
sellerNotificationSchema.index({ createdAt: -1 });

const SellerNotification = mongoose.model('SellerNotification', sellerNotificationSchema);
export default SellerNotification;
