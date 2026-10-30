import mongoose from 'mongoose';

// One document per Razorpay webhook delivery, keyed by the X-Razorpay-Event-Id header.
// Razorpay re-sends the same event id on retries, so the unique index on `eventId`
// is what makes webhook processing idempotent.
const razorpayWebhookEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, trim: true },
    eventType: { type: String, required: true, trim: true },
    paymentId: { type: String, default: null },
    orderId: { type: String, default: null }, // Razorpay order id
    status: {
      type: String,
      enum: ['processing', 'processed', 'ignored', 'failed'],
      default: 'processing',
    },
    attempts: { type: Number, default: 1 },
    result: { type: String, default: '' },
    processingError: { type: String, default: '' },
    receivedAt: { type: Date, default: Date.now },
    processingStartedAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
  },
  { timestamps: true }
);

// Keep the collection small; Razorpay only retries for ~24h.
razorpayWebhookEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

const RazorpayWebhookEvent = mongoose.model('RazorpayWebhookEvent', razorpayWebhookEventSchema);
export default RazorpayWebhookEvent;
