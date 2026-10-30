import express from 'express';
import {
  getWishlist,
  toggleWishlist,
  syncWishlist,
} from '../controllers/wishlistController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect('user'));

router.get('/', getWishlist);
router.post('/toggle', toggleWishlist);
router.post('/sync', syncWishlist);

export default router;
