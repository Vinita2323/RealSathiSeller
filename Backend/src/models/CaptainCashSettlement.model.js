import mongoose from 'mongoose';

const captainCashSettlementSchema = new mongoose.Schema(
  {
    settlementId: {
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
    captainName: {
      type: String,
      trim: true,
      default: 'Captain Partner',
    },
    captainPhone: {
      type: String,
      trim: true,
      default: '',
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    paymentMode: {
      type: String,
      enum: ['CASH_DEPOSIT', 'BANK_TRANSFER', 'UPI', 'OFFICE_PAYMENT'],
      default: 'BANK_TRANSFER',
    },
    transactionReference: {
      type: String,
      trim: true,
      default: '',
    },
    proofDocument: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    remarks: {
      type: String,
      default: '',
    },
    adminRemarks: {
      type: String,
      default: '',
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    outstandingBefore: {
      type: Number,
      default: 0,
    },
    outstandingAfter: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

captainCashSettlementSchema.index({ captainId: 1, status: 1 });
captainCashSettlementSchema.index({ createdAt: -1 });

const CaptainCashSettlement = mongoose.model('CaptainCashSettlement', captainCashSettlementSchema);
export default CaptainCashSettlement;
