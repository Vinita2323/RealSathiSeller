import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  submitRating,
  getRideRatingStatus,
  getRatingBreakdown,
} from '../controllers/ratingController.js';

const router = express.Router();

// Allow authenticated user or captain
const participantAuth = protect(['user', 'captain']);

// ── Submit a Rating ──────────────────────────────────────────────────────────
// POST /api/ratings
router.post('/', participantAuth, submitRating);

// ── Get Rating Status for a Specific Ride ────────────────────────────────────
// GET /api/ratings/ride/:rideId
router.get('/ride/:rideId', participantAuth, getRideRatingStatus);

// ── Get Rating Statistics & Star Breakdown for Captain or User ───────────────
// GET /api/ratings/stats/:type/:id (type: 'captain' | 'user')
router.get('/stats/:type/:id', getRatingBreakdown);

export default router;
