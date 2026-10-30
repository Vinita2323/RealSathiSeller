import mongoose from 'mongoose';

const sellerRegistrationPaymentSchema = new mongoose.Schema(
  {
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      required: true,
      index: true,
    },
    paymentType: {
      type: String,
      enum: ['SELLER_REGISTRATION_FEE'],
      default: 'SELLER_REGISTRATION_FEE',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
    gateway: {
      type: String,
      default: 'razorpay',
    },
    gatewayOrderId: {
      type: String,
      trim: true,
    },
    gatewayPaymentId: {
      type: String,
      trim: true,
    },
    gatewaySignature: {
      type: String,
      trim: true,
    },
    transactionReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['created', 'pending', 'paid', 'failed', 'cancelled'],
      default: 'created',
      index: true,
    },
    paidAt: {
      type: Date,
    },
    failureReason: {
      type: String,
      trim: true,
      default: '',
    },
    sellerDetails: {
      businessName: { type: String, default: '' },
      ownerName: { type: String, default: '' },
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'sellerregistrationpayments',
  }
);

sellerRegistrationPaymentSchema.index({ sellerId: 1, createdAt: -1 });
sellerRegistrationPaymentSchema.index({ status: 1, createdAt: -1 });
sellerRegistrationPaymentSchema.index({ gatewayOrderId: 1 });
sellerRegistrationPaymentSchema.index({ gatewayPaymentId: 1 });
sellerRegistrationPaymentSchema.index({ createdAt: -1 });

const SellerRegistrationPayment = mongoose.model(
  'SellerRegistrationPayment',
  sellerRegistrationPaymentSchema
);

export default SellerRegistrationPayment;
