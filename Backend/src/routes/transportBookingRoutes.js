import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getFareEstimate,
  createBooking,
  createTransportPaymentOrder,
  verifyTransportPayment,
  getUserBookings,
  getActiveBooking,
  getBookingById,
  cancelBooking,
  getAdminTransportBookings,
  adminAssignCaptainToTransportBooking,
  adminCancelTransportBooking,
} from '../controllers/transportBookingController.js';

const router = express.Router();

const customerAuth = protect(['user', 'seller', 'admin', 'super_admin']);
const adminAuth = protect(['admin', 'super_admin']);

// ── Fare Estimate (Calculation only — no booking created) ────────────────────
// POST /api/transport/bookings/fare-estimate (Public / Calculation)
router.post('/fare-estimate', getFareEstimate);

// ── Payment Gateway (Razorpay) ────────────────────────────────────────────────
// POST /api/transport/bookings/create-payment-order — create Razorpay order
router.post('/create-payment-order', customerAuth, createTransportPaymentOrder);

// POST /api/transport/bookings/verify-payment       — verify Razorpay payment & create booking
router.post('/verify-payment', customerAuth, verifyTransportPayment);

// ── Admin Transport Routes (MUST be declared before /:bookingId) ──────────────
// GET  /api/transport/bookings/admin/all — get all platform transport bookings
router.get('/admin/all', adminAuth, getAdminTransportBookings);

// PUT  /api/transport/bookings/admin/:bookingId/assign-captain — admin manual assign
router.put('/admin/:bookingId/assign-captain', adminAuth, adminAssignCaptainToTransportBooking);

// PUT  /api/transport/bookings/admin/:bookingId/cancel — admin cancel booking
router.put('/admin/:bookingId/cancel', adminAuth, adminCancelTransportBooking);

// ── User Bookings ─────────────────────────────────────────────────────────────
// POST   /api/transport/bookings            — create booking (Cash on delivery / Direct)
router.post('/', customerAuth, createBooking);

// GET    /api/transport/bookings            — list user's bookings
router.get('/', customerAuth, getUserBookings);

// GET    /api/transport/bookings/active     — get current active booking
// IMPORTANT: must be declared BEFORE /:bookingId to avoid "active" being treated as an ID
router.get('/active', customerAuth, getActiveBooking);

// GET    /api/transport/bookings/:bookingId — get specific booking
router.get('/:bookingId', customerAuth, getBookingById);

// PUT    /api/transport/bookings/:bookingId/cancel — cancel booking
router.put('/:bookingId/cancel', customerAuth, cancelBooking);

export default router;
