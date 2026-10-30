import mongoose from 'mongoose';

const captainRegistrationPaymentSchema = new mongoose.Schema(
  {
    captainId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Captain',
      required: true,
      index: true,
    },
    paymentType: {
      type: String,
      enum: ['CAPTAIN_REGISTRATION_FEE'],
      default: 'CAPTAIN_REGISTRATION_FEE',
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
    captainDetails: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
      vehicleType: { type: String, default: '' },
      city: { type: String, default: '' },
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    collection: 'captainregistrationpayments',
  }
);

captainRegistrationPaymentSchema.index({ captainId: 1, createdAt: -1 });
captainRegistrationPaymentSchema.index({ status: 1, createdAt: -1 });
captainRegistrationPaymentSchema.index({ gatewayOrderId: 1 });
captainRegistrationPaymentSchema.index({ gatewayPaymentId: 1 });
captainRegistrationPaymentSchema.index({ createdAt: -1 });

const CaptainRegistrationPayment = mongoose.model(
  'CaptainRegistrationPayment',
  captainRegistrationPaymentSchema
);

export default CaptainRegistrationPayment;
