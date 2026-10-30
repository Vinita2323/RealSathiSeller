import express from 'express';
import {
  getPublicFeeConfig,
  initiateRegistrationFeeOrder,
  verifyRegistrationFeePayment,
  retryRegistrationFeeOrder,
  handleRegistrationFeeWebhook,
  adminGetFeeConfig,
  adminUpdateFeeConfig,
  adminGetFeePayments,
  adminGetFeePaymentById,
} from '../controllers/captainRegistrationFeeController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// ----------------------------------------------------------------------------
// Public & Captain Registration Fee Routes
// ----------------------------------------------------------------------------
router.get('/config', getPublicFeeConfig);
router.post('/initiate-order', initiateRegistrationFeeOrder);
router.post('/verify-payment', verifyRegistrationFeePayment);
router.post('/retry-order', retryRegistrationFeeOrder);
router.post('/webhook', handleRegistrationFeeWebhook);

// ----------------------------------------------------------------------------
// Admin Management Routes (Protected by role='admin' or 'super_admin')
// ----------------------------------------------------------------------------
router.get('/admin', protect(['admin', 'super_admin']), adminGetFeeConfig);
router.put('/admin', protect(['admin', 'super_admin']), adminUpdateFeeConfig);
router.get('/admin/payments', protect(['admin', 'super_admin']), adminGetFeePayments);
router.get('/admin/payments/:id', protect(['admin', 'super_admin']), adminGetFeePaymentById);

export default router;
