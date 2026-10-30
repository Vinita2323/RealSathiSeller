import crypto from 'crypto';
import RazorpayWebhookEvent from '../models/RazorpayWebhookEvent.model.js';
import {
  SUPPORTED_EVENTS,
  extractPaymentInfo,
  processRazorpayEvent,
} from '../services/razorpayWebhookService.js';

// A 'processing' claim older than this is assumed to belong to a crashed worker.
const PROCESSING_LOCK_MS = 2 * 60 * 1000;

const isValidSignature = (rawBody, signature, secret) => {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const received = Buffer.from(String(signature), 'utf8');
  const wanted = Buffer.from(expected, 'utf8');
  return received.length === wanted.length && crypto.timingSafeEqual(received, wanted);
};

// The app disables mongoose autoIndex, and the unique eventId index is what makes
// deduplication safe, so guarantee it exists before the first event is claimed.
let indexesReady = null;
const ensureEventIndexes = () => {
  if (!indexesReady) {
    indexesReady = RazorpayWebhookEvent.createIndexes().catch((err) => {
      indexesReady = null; // retry on the next delivery
      throw err;
    });
  }
  return indexesReady;
};

// Inserts the event as 'processing'. The unique eventId index guarantees a single
// winner even across concurrent deliveries or multiple server instances.
const claimEvent = async ({ eventId, eventType, paymentId, orderId }) => {
  try {
    await RazorpayWebhookEvent.create({ eventId, eventType, paymentId, orderId });
    return 'claimed';
  } catch (err) {
    if (err?.code !== 11000) throw err;
  }

  // Seen before: retry it if it previously failed or its worker died, otherwise skip.
  const reclaimed = await RazorpayWebhookEvent.findOneAndUpdate(
    {
      eventId,
      $or: [
        { status: 'failed' },
        { status: 'processing', processingStartedAt: { $lt: new Date(Date.now() - PROCESSING_LOCK_MS) } },
      ],
    },
    { $set: { status: 'processing', processingStartedAt: new Date(), processingError: '' }, $inc: { attempts: 1 } }
  );
  if (reclaimed) return 'claimed';

  const existing = await RazorpayWebhookEvent.findOne({ eventId }).select('status').lean();
  return existing?.status === 'processing' ? 'in_flight' : 'duplicate';
};

const finishEvent = async (eventId, fields) => {
  try {
    await RazorpayWebhookEvent.updateOne({ eventId }, { $set: fields });
  } catch (err) {
    // Business updates are idempotent, so a bookkeeping failure must not turn a
    // completed event into a retry-inducing error.
    console.error('[Razorpay Webhook] Failed to record event status:', err.message);
  }
};

/**
 * POST /api/payments/razorpay/webhook
 * Server-to-server sync of Razorpay payment state. Mounted with express.raw() so
 * req.body is the exact Buffer Razorpay signed.
 */
export const handleRazorpayWebhook = async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is not configured; rejecting webhook');
    return res.status(500).json({ success: false, message: 'Webhook is not configured' });
  }

  const rawBody = req.body;
  if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
    return res.status(400).json({ success: false, message: 'Raw request body unavailable' });
  }

  const signature = req.get('x-razorpay-signature');
  if (!signature) {
    console.warn('[Razorpay Webhook] Signature header missing');
    return res.status(400).json({ success: false, message: 'Missing signature' });
  }
  if (!isValidSignature(rawBody, signature, secret)) {
    console.warn('[Razorpay Webhook] Signature verification failed');
    return res.status(400).json({ success: false, message: 'Invalid signature' });
  }

  // Signature is valid from here on; only now is the body trusted enough to parse.
  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ success: false, message: 'Malformed payload' });
  }
  if (!event || typeof event.event !== 'string' || typeof event.payload !== 'object' || event.payload === null) {
    return res.status(400).json({ success: false, message: 'Malformed payload' });
  }

  if (!SUPPORTED_EVENTS.has(event.event)) {
    return res.status(200).json({ success: true, ignored: true });
  }

  // Razorpay sends a stable id per event (re-used on retries) in this header.
  const eventId =
    req.get('x-razorpay-event-id') || `sha256:${crypto.createHash('sha256').update(rawBody).digest('hex')}`;
  const { paymentId, razorpayOrderId } = extractPaymentInfo(event);

  try {
    await ensureEventIndexes();
    const claim = await claimEvent({
      eventId,
      eventType: event.event,
      paymentId,
      orderId: razorpayOrderId,
    });

    if (claim === 'duplicate') {
      return res.status(200).json({ success: true, duplicate: true });
    }
    if (claim === 'in_flight') {
      // Another delivery of this event is mid-processing; ask Razorpay to retry later.
      return res.status(409).json({ success: false, message: 'Event is being processed' });
    }

    console.log(`[Razorpay Webhook] Received event=${event.event} payment=${paymentId} order=${razorpayOrderId}`);

    try {
      const { outcome, reason } = await processRazorpayEvent(event);
      await finishEvent(eventId, { status: outcome, result: reason, processedAt: new Date() });
      console.log(`[Razorpay Webhook] ${outcome} event=${event.event} payment=${paymentId} result=${reason}`);
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error(`[Razorpay Webhook] Processing failed event=${event.event} payment=${paymentId}:`, err.message);
      await finishEvent(eventId, { status: 'failed', processingError: String(err.message).slice(0, 500) });
      return res.status(500).json({ success: false, message: 'Webhook processing failed' });
    }
  } catch (err) {
    console.error('[Razorpay Webhook] Internal error:', err.message);
    return res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};
