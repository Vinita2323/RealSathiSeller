import mongoose from 'mongoose';

export const USER_NOTIFICATION_TYPES = [
  'ORDER_PLACED',
  'ORDER_CONFIRMED',
  'ORDER_OUT_FOR_DELIVERY',
  'ORDER_DELIVERED',
  'ORDER_CANCELLED',
  'ORDER_FAILED',
];

const userNotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: USER_NOTIFICATION_TYPES,
      required: true,
      index: true,
    },
    orderId: {
      type: String,
      default: null,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// One notification per user + order + event type (prevents duplicates)
userNotificationSchema.index(
  { userId: 1, orderId: 1, type: 1 },
  { unique: true, partialFilterExpression: { orderId: { $type: 'string' } } }
);
userNotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

const UserNotification = mongoose.model('UserNotification', userNotificationSchema);
export default UserNotification;
