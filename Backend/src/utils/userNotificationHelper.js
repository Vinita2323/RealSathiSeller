import UserNotification from '../models/UserNotification.model.js';
import { emitToUser } from '../socket/socket.js';

const TEMPLATES = {
  ORDER_PLACED: {
    title: 'Order Placed Successfully',
    message: (orderId) => `Your order #${orderId} has been placed successfully.`,
  },
  ORDER_CONFIRMED: {
    title: 'Order Confirmed',
    message: (orderId) => `Your order #${orderId} has been confirmed.`,
  },
  ORDER_OUT_FOR_DELIVERY: {
    title: 'Out for Delivery',
    message: (orderId) => `Your order #${orderId} is out for delivery.`,
  },
  ORDER_DELIVERED: {
    title: 'Order Delivered',
    message: (orderId) => `Your order #${orderId} has been delivered successfully.`,
  },
  ORDER_CANCELLED: {
    title: 'Order Cancelled',
    message: (orderId) => `Your order #${orderId} has been cancelled.`,
  },
  ORDER_FAILED: {
    title: 'Order Failed',
    message: (orderId) => `Unfortunately, your order #${orderId} could not be completed.`,
  },
};

/**
 * Creates a user order notification once per (user, orderId, type).
 * Emits Socket.IO event to the user's room when created.
 */
export const createUserOrderNotification = async ({
  userId,
  orderId,
  order = null,
  type,
}) => {
  try {
    if (!userId || !orderId || !type || !TEMPLATES[type]) return null;

    const template = TEMPLATES[type];
    const doc = await UserNotification.create({
      userId,
      orderId: String(orderId),
      order: order || null,
      type,
      title: template.title,
      message: template.message(orderId),
      isRead: false,
    });

    emitToUser(String(userId), 'user:notification', {
      notification: {
        _id: doc._id,
        userId: doc.userId,
        title: doc.title,
        message: doc.message,
        type: doc.type,
        orderId: doc.orderId,
        order: doc.order,
        isRead: doc.isRead,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      },
    });

    return doc;
  } catch (err) {
    // Duplicate key = already notified for this event; ignore
    if (err?.code === 11000) return null;
    console.warn('[UserNotification] create failed:', err.message);
    return null;
  }
};

/**
 * Map orderStatus / payment failure to one of the 6 allowed notification types.
 * Returns null for intermediate statuses that must not notify.
 */
export const mapOrderEventToNotificationType = ({
  orderStatus,
  paymentStatus,
  preferFailed = false,
} = {}) => {
  if (preferFailed || paymentStatus === 'Failed') {
    return 'ORDER_FAILED';
  }

  switch (orderStatus) {
    case 'Placed':
      return 'ORDER_PLACED';
    case 'Accepted':
      return 'ORDER_CONFIRMED';
    case 'Out for Delivery':
      return 'ORDER_OUT_FOR_DELIVERY';
    case 'Delivered':
      return 'ORDER_DELIVERED';
    case 'Cancelled':
      return 'ORDER_CANCELLED';
    case 'Rejected':
      return 'ORDER_FAILED';
    default:
      return null;
  }
};

/**
 * Fire-and-forget wrapper so order flows are never blocked by notification I/O.
 */
export const notifyUserOrderEvent = (params) => {
  setImmediate(() => {
    createUserOrderNotification(params).catch(() => {});
  });
};

export default createUserOrderNotification;
