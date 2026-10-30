import Order from '../models/Order.model.js';
import { razorpayInstance } from '../config/razorpay.js';

// Events this application acts on. `order.paid` carries the same payment entity as
// `payment.captured`, so it is handled as a safety net for a missed capture event.
export const SUPPORTED_EVENTS = new Set([
  'payment.authorized',
  'payment.captured',
  'payment.failed',
  'order.paid',
]);

// Razorpay order receipts are created as `order_<localOrderId>_<timestamp>` by
// orderController.createRazorpayOrder.
const RECEIPT_PATTERN = /^order_(.+)_\d{10,}$/;
const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

const ignored = (reason) => ({ outcome: 'ignored', reason });
const processed = (reason) => ({ outcome: 'processed', reason });

export const extractPaymentInfo = (event) => {
  const payment = event?.payload?.payment?.entity;
  const rzpOrder = event?.payload?.order?.entity;
  return {
    payment,
    rzpOrder,
    paymentId: payment?.id || null,
    razorpayOrderId: payment?.order_id || rzpOrder?.id || null,
  };
};

// Finds the local Order a Razorpay order belongs to. Primary lookup is the id stored
// by createRazorpayOrder; the receipt fallback covers orders whose id was never stored
// (created before this webhook shipped) and Razorpay orders that were superseded.
const findLocalOrder = async (razorpayOrderId, rzpOrderEntity) => {
  const stored = await Order.findOne({ 'razorpay.orderId': razorpayOrderId });
  if (stored) return stored;

  let receipt = rzpOrderEntity?.receipt;
  if (!receipt) {
    try {
      receipt = (await razorpayInstance.orders.fetch(razorpayOrderId))?.receipt;
    } catch (err) {
      // 4xx: Razorpay doesn't know this order for our account -> not ours.
      // Anything else (network, 5xx) is a real failure so the webhook gets retried.
      if (err?.statusCode >= 400 && err.statusCode < 500) return null;
      throw err;
    }
  }

  const match = RECEIPT_PATTERN.exec(receipt || '');
  if (!match) return null;
  const localId = match[1];
  return Order.findOne({
    $or: [{ orderId: localId }, ...(OBJECT_ID_PATTERN.test(localId) ? [{ _id: localId }] : [])],
  });
};

const toDate = (unixSeconds) => (unixSeconds ? new Date(unixSeconds * 1000) : new Date());

const handleAuthorized = async (order, payment) => {
  // Auto-capture is on (payment_capture: 1), so this is transient. Record it, never
  // downgrade a captured payment, and do not treat it as paid.
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, 'razorpay.paymentStatus': { $ne: 'captured' } },
    {
      $set: {
        'razorpay.orderId': payment.order_id,
        'razorpay.paymentId': payment.id,
        'razorpay.paymentStatus': 'authorized',
        'razorpay.method': payment.method || null,
      },
    }
  );
  return updated ? processed('authorized_recorded') : ignored('already_captured');
};

const handleCaptured = async (order, payment) => {
  if (order.paymentMethod === 'COD') {
    console.warn(`[Razorpay Webhook] Capture received for COD order ${order.orderId}; ignoring`);
    return ignored('cod_order');
  }

  // The relationship check: the money actually received must match the order total.
  const expectedPaise = Math.round(Number(order.grandTotal) * 100);
  if (Number(payment.amount) !== expectedPaise) {
    console.warn(
      `[Razorpay Webhook] Amount mismatch for order ${order.orderId}: paid ${payment.amount} paise, expected ${expectedPaise}. Not confirming.`
    );
    return ignored('amount_mismatch');
  }

  if (order.paymentStatus === 'Paid' && order.razorpay?.paymentId && order.razorpay.paymentId !== payment.id) {
    console.warn(
      `[Razorpay Webhook] Order ${order.orderId} already captured with a different payment; possible double payment, review for refund`
    );
    return ignored('second_capture_for_paid_order');
  }

  const { confirmOnlinePayment } = await import('../controllers/orderController.js');
  const result = await confirmOnlinePayment(order, {
    amount: Number(payment.amount),
    currency: payment.currency || 'INR',
    razorpayOrderId: payment.order_id,
    paymentId: payment.id,
    method: payment.method || null,
  });
  if (result.ok) return processed(result.already ? 'already_captured' : 'captured');
  return ignored(result.reason || 'not_confirmed');
};

const handleFailed = async (order, payment) => {
  // A payment can fail and the customer retry successfully on the same Razorpay order,
  // and events can arrive out of order. A captured payment (or a different attempt that
  // is authorized) must never be overwritten by a failure.
  const updated = await Order.findOneAndUpdate(
    {
      _id: order._id,
      $nor: [
        { 'razorpay.paymentStatus': 'captured' },
        { 'razorpay.paymentStatus': 'authorized', 'razorpay.paymentId': { $ne: payment.id } },
      ],
    },
    {
      $set: {
        paymentStatus: 'Failed',
        'razorpay.orderId': payment.order_id,
        'razorpay.paymentId': payment.id,
        'razorpay.paymentStatus': 'failed',
        'razorpay.method': payment.method || null,
        'razorpay.failedAt': toDate(payment.created_at),
        'razorpay.failureCode': payment.error_code || null,
        'razorpay.failureReason': payment.error_description || null,
      },
    }
  );
  return updated ? processed('failed_recorded') : ignored('order_already_paid_or_retrying');
};

/**
 * Applies a signature-verified Razorpay event to local data. Every branch is an
 * atomic, state-guarded update, so replays and out-of-order delivery converge on the
 * same final state. Throws on infrastructure errors so the caller can return 5xx.
 * Wallet/commission settlement happens at delivery, not here, so nothing else is touched.
 */
export const processRazorpayEvent = async (event) => {
  if (!SUPPORTED_EVENTS.has(event.event)) return ignored('unsupported_event');

  const { payment, rzpOrder, razorpayOrderId } = extractPaymentInfo(event);
  if (!payment?.id || !razorpayOrderId) return ignored('missing_payment_entity');

  const order = await findLocalOrder(razorpayOrderId, rzpOrder);
  if (!order) return ignored('unknown_order');

  switch (event.event) {
    case 'payment.authorized':
      return handleAuthorized(order, payment);
    case 'payment.captured':
    case 'order.paid':
      return handleCaptured(order, payment);
    case 'payment.failed':
      return handleFailed(order, payment);
    default:
      return ignored('unsupported_event');
  }
};
