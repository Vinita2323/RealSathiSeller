import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  validateReferralCode,
  getSellerReferralCode,
  getSellerReferrals,
  getCaptainReferralCode,
  getCaptainReferrals,
  getReferralSettings,
  updateReferralSettings,
  getReferralStats,
  getAllReferrals,
  adminUpdateReferralStatus,
  adminCreditReferralReward,
} from '../controllers/referralController.js';

const router = express.Router();

// ── Public ────────────────────────────────────────────────────────────────────
router.get('/validate', validateReferralCode);

// ── Seller Routes ─────────────────────────────────────────────────────────────
router.get('/seller/code', protect('seller'), getSellerReferralCode);
router.get('/seller/my', protect('seller'), getSellerReferrals);

// ── Captain Routes ────────────────────────────────────────────────────────────
router.get('/captain/code', protect('captain'), getCaptainReferralCode);
router.get('/captain/my', protect('captain'), getCaptainReferrals);

// ── Admin Routes ──────────────────────────────────────────────────────────────
router.get('/admin/settings', protect('admin'), getReferralSettings);
router.put('/admin/settings', protect('admin'), updateReferralSettings);
router.get('/admin/stats', protect('admin'), getReferralStats);
router.get('/admin/all', protect('admin'), getAllReferrals);
router.put('/admin/:id/approve', protect('admin'), adminUpdateReferralStatus);
router.post('/admin/:id/credit', protect('admin'), adminCreditReferralReward);

export default router;
