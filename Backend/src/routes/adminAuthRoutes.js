import express from 'express';
import { adminLogin, adminLogout, getAdminProfile, updateAdminProfile } from '../controllers/adminAuthController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login', adminLogin);
router.post('/logout', adminLogout);
router.get('/profile', protect('admin', 'super_admin'), getAdminProfile);
router.get('/me', protect('admin', 'super_admin'), getAdminProfile);
router.put('/profile', protect('admin', 'super_admin'), updateAdminProfile);

export default router;

