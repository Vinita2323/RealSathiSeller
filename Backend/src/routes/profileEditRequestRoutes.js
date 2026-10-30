import express from 'express';
import {
  submitEditRequest,
  getMyPendingEditRequest,
  getAllEditRequests,
  getEditRequestById,
  approveEditRequest,
  rejectEditRequest,
} from '../controllers/profileEditRequestController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Requester endpoints (User, Seller, Captain)
router.post('/submit', protect(), submitEditRequest);
router.get('/my-pending', protect(), getMyPendingEditRequest);

// Admin endpoints (List, Review, Approve, Reject)
router.get('/admin', protect(), getAllEditRequests);
router.get('/admin/:id', protect(), getEditRequestById);
router.put('/admin/:id/approve', protect(), approveEditRequest);
router.put('/admin/:id/reject', protect(), rejectEditRequest);

export default router;
