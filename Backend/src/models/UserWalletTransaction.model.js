import mongoose from 'mongoose';

const userWalletTransactionSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
    },
    orderId: {
      type: String,
      default: '',
    },
    returnId: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      enum: ['CREDIT', 'DEBIT'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    balanceBefore: {
      type: Number,
      default: 0,
    },
    balanceAfter: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['COMPLETED', 'PENDING', 'FAILED'],
      default: 'COMPLETED',
    },
    category: {
      type: String,
      enum: ['REFUND', 'ORDER_PAYMENT', 'ADJUSTMENT', 'OTHER'],
      default: 'OTHER',
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

userWalletTransactionSchema.index({ userId: 1, createdAt: -1 });
userWalletTransactionSchema.index({ userId: 1, type: 1, createdAt: -1 });
userWalletTransactionSchema.index({ orderId: 1 });

const UserWalletTransaction = mongoose.model('UserWalletTransaction', userWalletTransactionSchema);
export default UserWalletTransaction;
