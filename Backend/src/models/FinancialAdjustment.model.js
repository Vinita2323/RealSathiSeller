import mongoose from 'mongoose';

const financialAdjustmentSchema = new mongoose.Schema(
  {
    adjustmentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    entityType: {
      type: String,
      enum: ['SELLER', 'CAPTAIN', 'PLATFORM'],
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      required: true,
      index: true,
    },
    entityName: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      enum: ['CREDIT', 'DEBIT'],
      required: true,
      index: true,
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
    reference: {
      type: String,
      default: '',
    },
    remarks: {
      type: String,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
    creatorEmail: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['APPLIED', 'REVERSED'],
      default: 'APPLIED',
    },
    balanceBefore: {
      type: Number,
      default: 0,
    },
    balanceAfter: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

financialAdjustmentSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
financialAdjustmentSchema.index({ createdAt: -1 });

const FinancialAdjustment = mongoose.model('FinancialAdjustment', financialAdjustmentSchema);
export default FinancialAdjustment;
