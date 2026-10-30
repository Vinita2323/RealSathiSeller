import express from 'express';
import { registerCaptain, sendOtp, verifyOtp, loginCaptain, resetPassword } from '../controllers/captainAuthController.js';

const router = express.Router();

router.post('/register', registerCaptain);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/login', loginCaptain);
router.post('/reset-password', resetPassword);
router.post('/set-password', resetPassword);

export default router;

