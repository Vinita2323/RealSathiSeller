import express from 'express';
import {
  placeOrder,
  getUserOrders,
  getOrderById,
  getSellerNotifications,
  markNotificationViewed,
  acceptSellerOrder,
  rejectSellerOrder,
  updateSellerOrderStatus,
  requestOrderReturn,
  createRazorpayOrder,
  verifyRazorpayPayment,
} from '../controllers/orderController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Seller Routes
router.get('/seller/notifications', protect('seller'), getSellerNotifications);
router.put('/seller/notifications/:id/view', protect('seller'), markNotificationViewed);
router.put('/seller/notifications/:id/accept', protect('seller'), acceptSellerOrder);
router.put('/seller/notifications/:id/reject', protect('seller'), rejectSellerOrder);
router.put('/seller/notifications/:id/status', protect('seller'), updateSellerOrderStatus);

// Razorpay Routes
router.post('/razorpay/create-order', protect('user'), createRazorpayOrder);
router.post('/razorpay/verify-payment', protect('user'), verifyRazorpayPayment);

// User Routes
router.post('/', protect('user'), placeOrder);
router.get('/', protect('user'), getUserOrders);
router.get('/:id', protect('user'), getOrderById);
router.post('/:id/return', protect('user'), requestOrderReturn);

export default router;
