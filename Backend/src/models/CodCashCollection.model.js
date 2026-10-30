import mongoose from 'mongoose';

const codCashCollectionSchema = new mongoose.Schema(
  {
    collectionId: {
      type: String,
      required: true,
      unique: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    orderId: {
      type: String,
      required: true,
      unique: true, // Prevents duplicate COD collections for the same order
    },
    captainId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Captain',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      default: 'COD',
    },
    status: {
      type: String,
      enum: ['COLLECTED', 'SETTLED', 'CANCELLED'],
      default: 'COLLECTED',
      index: true,
    },
    collectedAt: {
      type: Date,
      default: Date.now,
    },
    settlementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CaptainCashSettlement',
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

codCashCollectionSchema.index({ captainId: 1, status: 1 });
codCashCollectionSchema.index({ createdAt: -1 });

const CodCashCollection = mongoose.model('CodCashCollection', codCashCollectionSchema);
export default CodCashCollection;
