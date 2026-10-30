import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getFinancialDashboardStats,
  getLedgerTransactions,
  getPayoutRequests,
  getPayoutRequestById,
  approvePayout,
  rejectPayout,
  processPayout,
  getSellerSettlements,
  getCaptainSettlements,
  getAllCommissions,
  updateSellerCommission,
  createFinancialAdjustment,
  getFinancialAdjustments,
  getRefunds,
  processRefund,
  getAuditLogs,
  getFinancialReports,
} from '../controllers/superAdminFinancialController.js';

const router = express.Router();

// Strict security: Most routes REQUIRE super_admin role
const superAdminAuth = protect('super_admin');
// Payout & refund routes also accessible by admin role
const payoutAuth = protect('admin', 'super_admin');

// Financial Dashboard (accessible by admin + super_admin)
router.get('/dashboard/metrics', payoutAuth, getFinancialDashboardStats);

// Central Transaction Ledger
router.get('/transactions', superAdminAuth, getLedgerTransactions);

// Payout Management (accessible by admin + super_admin)
router.get('/payouts', payoutAuth, getPayoutRequests);
router.get('/payouts/:id', payoutAuth, getPayoutRequestById);
router.put('/payouts/:id/approve', payoutAuth, approvePayout);
router.put('/payouts/:id/reject', payoutAuth, rejectPayout);
router.put('/payouts/:id/process', payoutAuth, processPayout);

// Settlements
router.get('/settlements/sellers', superAdminAuth, getSellerSettlements);
router.get('/settlements/captains', superAdminAuth, getCaptainSettlements);

// Commission Authority
router.get('/commissions', superAdminAuth, getAllCommissions);
router.put('/sellers/:sellerId/commission', superAdminAuth, updateSellerCommission);

// Financial Adjustments
router.get('/financial-adjustments', superAdminAuth, getFinancialAdjustments);
router.post('/financial-adjustments', superAdminAuth, createFinancialAdjustment);

// Refunds (accessible by admin + super_admin)
router.get('/refunds', payoutAuth, getRefunds);
router.put('/refunds/:id/process', payoutAuth, processRefund);

// Financial Reports
router.get('/reports', superAdminAuth, getFinancialReports);

// Financial Audit Logs
router.get('/audit-logs', superAdminAuth, getAuditLogs);

export default router;
