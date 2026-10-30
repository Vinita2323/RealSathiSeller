import mongoose from 'mongoose';

const platformLedgerSchema = new mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    category: {
      type: String,
      enum: [
        'CUSTOMER_PAYMENT',
        'SELLER_EARNING',
        'CAPTAIN_EARNING',
        'SELLER_PAYOUT',
        'CAPTAIN_PAYOUT',
        'PLATFORM_COMMISSION',
        'REFUND',
        'FINANCIAL_ADJUSTMENT',
        'MEMBERSHIP_FEE',
        'REGISTRATION_FEE',
      ],
      required: true,
      index: true,
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
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    source: {
      type: String,
      default: 'PLATFORM',
    },
    destination: {
      type: String,
      default: 'PLATFORM',
    },
    entityType: {
      type: String,
      enum: ['USER', 'SELLER', 'CAPTAIN', 'PLATFORM'],
      default: 'PLATFORM',
      index: true,
    },
    entityId: {
      type: String,
      default: '',
      index: true,
    },
    entityName: {
      type: String,
      default: '',
    },
    referenceModel: {
      type: String,
      default: '',
    },
    referenceId: {
      type: String,
      default: '',
      index: true,
    },
    referenceObjId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'PENDING', 'FAILED', 'REVERSED'],
      default: 'SUCCESS',
      index: true,
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
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

platformLedgerSchema.index({ category: 1, createdAt: -1 });
platformLedgerSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
platformLedgerSchema.index({ entityType: 1, createdAt: -1 });
platformLedgerSchema.index({ status: 1, createdAt: -1 });
platformLedgerSchema.index({ type: 1, createdAt: -1 });
platformLedgerSchema.index({ createdAt: -1 });

const PlatformLedger = mongoose.model('PlatformLedger', platformLedgerSchema);
export default PlatformLedger;
