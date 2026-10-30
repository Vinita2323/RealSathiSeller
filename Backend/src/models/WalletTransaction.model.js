import mongoose from 'mongoose';

const walletTransactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
    },
    sellerId: {
      type: String,
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    orderId: {
      type: String,
      required: true,
    },
    notification: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SellerNotification',
    },
    type: {
      type: String,
      enum: ['CREDIT', 'DEBIT', 'DEBIT_REVERSAL', 'WITHDRAWAL', 'REFUND_REVERSAL'],
      required: true,
    },
    grossAmount: {
      type: Number,
      required: true,
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
      required: true,
    },
    balanceBefore: {
      type: Number,
      default: 0,
    },
    balanceAfter: {
      type: Number,
      default: 0,
    },
    paymentMethod: {
      type: String,
      default: 'ONLINE',
    },
    settlementStatus: {
      type: String,
      enum: ['SETTLED', 'REVERSED', 'PENDING', 'COMPLETED', 'FAILED'],
      default: 'SETTLED',
    },
    description: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

walletTransactionSchema.index({ sellerId: 1, createdAt: -1 });
walletTransactionSchema.index({ sellerId: 1, type: 1, createdAt: -1 });
walletTransactionSchema.index({ sellerId: 1, settlementStatus: 1, createdAt: -1 });
walletTransactionSchema.index({ type: 1, createdAt: -1 });
walletTransactionSchema.index({ orderId: 1 });
walletTransactionSchema.index({ createdAt: -1 });

const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema);
export default WalletTransaction;
