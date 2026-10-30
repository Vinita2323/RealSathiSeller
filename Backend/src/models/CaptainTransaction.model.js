import mongoose from 'mongoose';

const captainTransactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
    },
    captainId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Captain',
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    orderId: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      enum: ['CREDIT', 'WITHDRAWAL', 'BONUS'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    grossAmount: {
      type: Number,
      default: 0,
    },
    commissionRate: {
      type: Number,
      default: 0,
    },
    commissionAmount: {
      type: Number,
      default: 0,
    },
    netAmount: {
      type: Number,
      default: 0,
    },
    balanceBefore: {
      type: Number,
      default: 0,
    },
    balanceAfter: {
      type: Number,
      default: 0,
    },
    description: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['COMPLETED', 'PENDING', 'FAILED'],
      default: 'COMPLETED',
    },
    // For withdrawals
    withdrawalMethod: { type: String, default: '' },
    bankDetails: {
      bankName: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      ifscCode: { type: String, default: '' },
      upiId: { type: String, default: '' },
    },
  },
  {
    timestamps: true,
  }
);

captainTransactionSchema.index({ captainId: 1, type: 1, createdAt: -1 });
captainTransactionSchema.index({ captainId: 1, createdAt: -1 });
captainTransactionSchema.index({ type: 1, createdAt: -1 });
captainTransactionSchema.index({ createdAt: -1 });

const CaptainTransaction = mongoose.model('CaptainTransaction', captainTransactionSchema);
export default CaptainTransaction;
