import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getProfile,
  updateProfile,
  updateOnlineStatus,
  updateLocation,
  getDashboardStats,
  getJobs,
  acceptJob,
  rejectJob,
  updateDeliveryStatus,
  verifyDeliveryOtp,
  verifyOrderPickupOtp,
  submitProofOfDelivery,
  getActiveDelivery,
  getWallet,
  getTransactions,
  requestWithdrawal,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getServiceAreas,
  deleteAccount,
  confirmCodCollection,
  getCodCollectionHistory,
  requestCashSettlement,
  getCaptainOwnCashSettlements,
} from '../controllers/captainController.js';
import {
  getTransportRequests,
  acceptTransportRequest,
  rejectTransportRequest,
  getActiveTransportDelivery,
  updateTransportStatus,
  verifyPickupOtp,
  verifyDropOtp,
  submitTransportProof,
  uploadPickupPhotos,
  uploadDropPhotos,
  updateTransportLocation,
  completeTransportReturn,
} from '../controllers/captainTransportController.js';

const router = express.Router();

// All routes require captain auth
const captainAuth = protect('captain');

// Profile & Account Management
router.get('/profile', captainAuth, getProfile);
router.put('/profile', captainAuth, updateProfile);
router.delete('/account', captainAuth, deleteAccount);

// Status & Location
router.put('/status', captainAuth, updateOnlineStatus);
router.put('/location', captainAuth, updateLocation);

// Dashboard
router.get('/dashboard', captainAuth, getDashboardStats);

// Jobs (E-Commerce Delivery)
router.get('/jobs', captainAuth, getJobs);
router.put('/jobs/:orderId/accept', captainAuth, acceptJob);
router.put('/jobs/:orderId/reject', captainAuth, rejectJob);
router.put('/jobs/:orderId/status', captainAuth, updateDeliveryStatus);

// COD Cash Collection & Settlement
router.post('/jobs/:orderId/confirm-cod', captainAuth, confirmCodCollection);
router.get('/cod-collections', captainAuth, getCodCollectionHistory);
router.post('/cash-settlements', captainAuth, requestCashSettlement);
router.get('/cash-settlements', captainAuth, getCaptainOwnCashSettlements);

// Transport Requests & Rides (Goods Transport)
router.get('/transport/requests', captainAuth, getTransportRequests);
router.put('/transport/requests/:bookingId/accept', captainAuth, acceptTransportRequest);
router.put('/transport/requests/:bookingId/reject', captainAuth, rejectTransportRequest);
router.get('/transport/active', captainAuth, getActiveTransportDelivery);
router.put('/transport/active/:bookingId/status', captainAuth, updateTransportStatus);
router.post('/transport/active/:bookingId/verify-pickup-otp', captainAuth, verifyPickupOtp);
router.post('/transport/active/:bookingId/verify-drop-otp', captainAuth, verifyDropOtp);
router.post('/transport/active/:bookingId/proof', captainAuth, submitTransportProof);
router.post('/transport/active/:bookingId/pickup-photos', captainAuth, uploadPickupPhotos);
router.post('/transport/active/:bookingId/drop-photos', captainAuth, uploadDropPhotos);
router.post('/transport/active/:bookingId/location', captainAuth, updateTransportLocation);
router.post('/transport/active/:bookingId/return/complete', captainAuth, completeTransportReturn);

// Delivery Actions
router.get('/active-delivery', captainAuth, getActiveDelivery);
router.post('/jobs/:orderId/verify-otp', captainAuth, verifyDeliveryOtp);
router.post('/jobs/:orderId/verify-pickup-otp', captainAuth, verifyOrderPickupOtp);
router.post('/jobs/:orderId/proof', captainAuth, submitProofOfDelivery);

// Wallet
router.get('/wallet', captainAuth, getWallet);
router.get('/wallet/transactions', captainAuth, getTransactions);
router.post('/wallet/withdraw', captainAuth, requestWithdrawal);

// Notifications
router.get('/notifications', captainAuth, getNotifications);
router.put('/notifications/read-all', captainAuth, markAllNotificationsRead);
router.put('/notifications/:id/read', captainAuth, markNotificationRead);

// Service Areas
router.get('/service-areas', captainAuth, getServiceAreas);

export default router;
