import mongoose from 'mongoose';

const refundRequestSchema = new mongoose.Schema(
  {
    refundId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    orderId: {
      type: String,
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    userName: {
      type: String,
      default: '',
    },
    userPhone: {
      type: String,
      default: '',
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['REQUESTED', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED'],
      default: 'REQUESTED',
      index: true,
    },
    paymentMethod: {
      type: String,
      default: '',
    },
    paymentReference: {
      type: String,
      default: '',
    },
    gatewayRefundId: {
      type: String,
      default: '',
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    remarks: {
      type: String,
      default: '',
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

refundRequestSchema.index({ orderId: 1, createdAt: -1 });
refundRequestSchema.index({ userId: 1, createdAt: -1 });
refundRequestSchema.index({ status: 1, createdAt: -1 });
refundRequestSchema.index({ createdAt: -1 });

const RefundRequest = mongoose.model('RefundRequest', refundRequestSchema);
export default RefundRequest;
