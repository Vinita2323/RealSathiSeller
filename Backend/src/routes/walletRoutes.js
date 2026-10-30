import express from 'express';
import {
  getSellerWallet,
  requestWithdrawal,
  getAdminSettlements,
  getAdminWithdrawals,
  updateWithdrawalStatus,
  getUserWallet,
  getUserWalletTransactions,
} from '../controllers/walletController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// User Wallet Routes
router.get('/user', protect('user'), getUserWallet);
router.get('/user/transactions', protect('user'), getUserWalletTransactions);

// Seller Wallet Routes
router.get('/seller', protect('seller'), getSellerWallet);
router.post('/seller/withdraw', protect('seller'), requestWithdrawal);

// Super Admin Settlement & Withdrawal Management Routes (Restricted from normal Admin)
router.get('/admin/settlements', protect('super_admin'), getAdminSettlements);
router.get('/admin/withdrawals', protect('super_admin'), getAdminWithdrawals);
router.put('/admin/withdrawals/:id/status', protect('super_admin'), updateWithdrawalStatus);

export default router;
