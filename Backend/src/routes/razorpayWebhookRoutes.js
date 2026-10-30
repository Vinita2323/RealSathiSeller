import express from 'express';
import { handleRazorpayWebhook } from '../controllers/razorpayWebhookController.js';

const router = express.Router();

// express.raw keeps the untouched request bytes (req.body is a Buffer), which the
// HMAC signature is computed over. This router must be mounted BEFORE express.json().
router.post('/webhook', express.raw({ type: '*/*', limit: '1mb' }), handleRazorpayWebhook);

export default router;
