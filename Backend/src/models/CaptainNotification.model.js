import mongoose from 'mongoose';

const captainNotificationSchema = new mongoose.Schema(
  {
    captainId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Captain',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['JOB_ASSIGNED', 'JOB_CANCELLED', 'PAYMENT', 'BONUS', 'SYSTEM', 'ALERT'],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    orderId: {
      type: String,
      default: null,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    amount: {
      type: Number,
      default: null,
    },
    read: {
      type: Boolean,
      default: false,
    },
    icon: {
      type: String,
      default: 'notifications',
    },
  },
  {
    timestamps: true,
  }
);

captainNotificationSchema.index({ captainId: 1, read: 1, createdAt: -1 });
captainNotificationSchema.index({ createdAt: -1 });

const CaptainNotification = mongoose.model('CaptainNotification', captainNotificationSchema);
export default CaptainNotification;
