import mongoose from 'mongoose';

const payoutRequestSchema = new mongoose.Schema(
  {
    payoutId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    recipientType: {
      type: String,
      enum: ['SELLER', 'CAPTAIN'],
      required: true,
      index: true,
    },
    recipientId: {
      type: String,
      required: true,
      index: true,
    },
    recipientName: {
      type: String,
      default: '',
    },
    recipientPhone: {
      type: String,
      default: '',
    },
    requestedAmount: {
      type: Number,
      required: true,
      min: 1,
    },
    approvedAmount: {
      type: Number,
      default: null,
    },
    bankDetails: {
      bankName: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      ifscCode: { type: String, default: '' },
      accountHolderName: { type: String, default: '' },
      upiId: { type: String, default: '' },
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'PROCESSING', 'PAID', 'REJECTED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    paymentMethod: {
      type: String,
      default: 'BANK_TRANSFER',
    },
    paymentReference: {
      type: String,
      default: '',
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    failureReason: {
      type: String,
      default: '',
    },
    remarks: {
      type: String,
      default: '',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
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
    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

payoutRequestSchema.index({ recipientType: 1, status: 1, createdAt: -1 });
payoutRequestSchema.index({ recipientId: 1, createdAt: -1 });
payoutRequestSchema.index({ status: 1, paidAt: -1 });
payoutRequestSchema.index({ status: 1, createdAt: -1 });
payoutRequestSchema.index({ createdAt: -1 });

const PayoutRequest = mongoose.model('PayoutRequest', payoutRequestSchema);
export default PayoutRequest;
