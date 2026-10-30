import express from 'express';
import {
  submitReview,
  getProductReviews,
  getOrderReviewStatus,
  getUserReviews,
  updateReview,
  deleteReview,
} from '../controllers/reviewController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public: Get reviews & breakdown for a product
router.get('/product/:productId', getProductReviews);

// Protected User Routes
router.post('/', protect('user'), submitReview);
router.get('/order/:orderId/status', protect('user'), getOrderReviewStatus);
router.get('/user', protect('user'), getUserReviews);
router.put('/:id', protect('user'), updateReview);
router.delete('/:id', protect('user'), deleteReview);

export default router;
