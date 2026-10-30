import express from 'express';
import {
  getCommissionSettings,
  updateCommissionSettings,
  getCurrentCommissionRates,
  getCommissionReports,
} from '../controllers/commissionSettingsController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// ----------------------------------------------------------------------------
// Public / App Rate Inspection Route (For Sellers & Captains Read-Only)
// ----------------------------------------------------------------------------
router.get('/commission-settings/current', getCurrentCommissionRates);
router.get('/current', getCurrentCommissionRates);

// ----------------------------------------------------------------------------
// Admin Management Routes (Protected: strictly admin & super_admin)
// ----------------------------------------------------------------------------
router.get('/admin/commission-settings', protect(['admin', 'super_admin']), getCommissionSettings);
router.put('/admin/commission-settings', protect(['admin', 'super_admin']), updateCommissionSettings);
router.get('/admin/commission-reports', protect(['admin', 'super_admin']), getCommissionReports);

export default router;
