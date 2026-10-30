import express from 'express';
import { 
  sendOtp, 
  verifyOtp, 
  registerSeller, 
  loginSeller, 
  resetPassword, 
  getSellerProfile, 
  updateSellerProfile,
  toggleOnlineStatus
} from '../controllers/sellerAuthController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/register', registerSeller);
router.post('/login', loginSeller);
router.post('/reset-password', resetPassword);
router.post('/set-password', resetPassword);

router.get('/profile', protect('seller'), getSellerProfile);
router.put('/profile', protect('seller'), updateSellerProfile);
router.put('/status', protect('seller'), toggleOnlineStatus);

export default router;


