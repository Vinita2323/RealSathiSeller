import express from 'express';
import { sendOtp, verifyOtp, getProfile, updateProfile } from '../controllers/userAuthController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);

// User Profile routes
router.get('/profile', protect('user'), getProfile);
router.put('/profile', protect('user'), updateProfile);

export default router;
