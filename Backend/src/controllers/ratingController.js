import mongoose from 'mongoose';
import Rating from '../models/Rating.model.js';
import TransportBooking from '../models/TransportBooking.model.js';
import Order from '../models/Order.model.js';
import User from '../models/User.model.js';
import Captain from '../models/Captain.model.js';

const DELIVERED_ORDER_STATUSES = new Set([
  'Delivered',
  'Returned',
  'Return Requested',
  'Return Approved',
  'Return Rejected',
  'Refund Completed',
  'Refunded',
]);

const refId = (value) => {
  if (!value) return null;
  if (typeof value === 'object' && value._id) return value._id;
  return value;
};

const findRideOrOrder = async (rideId) => {
  const id = String(rideId || '').trim();
  const isMongoId = mongoose.Types.ObjectId.isValid(id) && id.length === 24;

  const booking = await TransportBooking.findOne(
    isMongoId ? { $or: [{ _id: id }, { bookingId: id }] } : { bookingId: id }
  );
  if (booking) return { kind: 'ride', doc: booking };

  const order = await Order.findOne(
    isMongoId ? { $or: [{ _id: id }, { orderId: id }] } : { orderId: id }
  );
  if (order) return { kind: 'order', doc: order };

  return null;
};

// ──────────────────────────────────────────────────────────────────────────────
// Helper: Recalculate and update recipient's average rating and total count
// ──────────────────────────────────────────────────────────────────────────────
export const recalculateRatingStats = async (reviewedId, reviewedType) => {
  try {
    const targetObjId = mongoose.Types.ObjectId.isValid(reviewedId)
      ? new mongoose.Types.ObjectId(reviewedId)
      : reviewedId;

    const stats = await Rating.aggregate([
      {
        $match: {
          reviewedId: targetObjId,
          reviewedType: reviewedType.toLowerCase(),
        },
      },
      {
        $group: {
          _id: '$reviewedId',
          ratingAverage: { $avg: '$rating' },
          ratingCount: { $sum: 1 },
        },
      },
    ]);

    const ratingAverage = stats.length > 0 ? Math.round(stats[0].ratingAverage * 10) / 10 : 0;
    const ratingCount = stats.length > 0 ? stats[0].ratingCount : 0;

    if (reviewedType === 'captain') {
      await Captain.findByIdAndUpdate(reviewedId, { ratingAverage, ratingCount });
    } else if (reviewedType === 'user') {
      await User.findByIdAndUpdate(reviewedId, { ratingAverage, ratingCount });
    }

    return { ratingAverage, ratingCount };
  } catch (error) {
    console.error(`[Rating] Error recalculating stats for ${reviewedType} ${reviewedId}:`, error);
    return { ratingAverage: 0, ratingCount: 0 };
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/ratings
// Auth: User or Captain
// ──────────────────────────────────────────────────────────────────────────────
export const submitRating = async (req, res, next) => {
  try {
    const reviewerId = req.user.id;
    const reviewerRole = req.user.role; // 'user' | 'captain'
    const { rideId, rating, review = '', feedbackTags = [] } = req.body;

    if (!rideId) {
      return res.status(400).json({ success: false, message: 'rideId is required' });
    }

    const numRating = Number(rating);
    if (!numRating || isNaN(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be a valid number between 1 and 5',
      });
    }

    const subject = await findRideOrOrder(rideId);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Ride not found' });
    }

    const booking = subject.doc;
    const isOrder = subject.kind === 'order';
    const subjectUserId = refId(booking.user);
    const subjectCaptainId = refId(booking.captainId);
    const subjectCode = isOrder ? booking.orderId : booking.bookingId;

    if (isOrder) {
      const delivered =
        booking.captainStatus === 'Delivered' || DELIVERED_ORDER_STATUSES.has(booking.orderStatus);
      if (!delivered) {
        return res.status(400).json({
          success: false,
          message: 'Only a delivered order can be rated.',
        });
      }
    } else if (booking.status !== 'RIDE_COMPLETED') {
      return res.status(400).json({
        success: false,
        message: `Ride cannot be rated in "${booking.status}" status. Only completed rides are eligible for rating.`,
      });
    }

    let reviewerType = '';
    let reviewerModel = '';
    let reviewedId = null;
    let reviewedType = '';
    let reviewedModel = '';

    if (reviewerRole === 'user') {
      if (subjectUserId?.toString() !== reviewerId.toString()) {
        return res.status(403).json({
          success: false,
          message: isOrder ? 'You are not the customer for this order' : 'You are not the customer for this ride',
        });
      }

      if (!subjectCaptainId) {
        return res.status(400).json({
          success: false,
          message: isOrder ? 'No captain was assigned to this order' : 'No captain was assigned to this ride',
        });
      }

      reviewerType = 'user';
      reviewerModel = 'User';
      reviewedId = subjectCaptainId;
      reviewedType = 'captain';
      reviewedModel = 'Captain';
    } else if (reviewerRole === 'captain') {
      if (subjectCaptainId?.toString() !== reviewerId.toString()) {
        return res.status(403).json({
          success: false,
          message: isOrder
            ? 'You are not the assigned captain for this order'
            : 'You are not the assigned captain for this ride',
        });
      }

      if (!subjectUserId) {
        return res.status(400).json({
          success: false,
          message: 'No customer is linked to this order',
        });
      }

      reviewerType = 'captain';
      reviewerModel = 'Captain';
      reviewedId = subjectUserId;
      reviewedType = 'user';
      reviewedModel = 'User';
    } else {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only users and captains can submit a rating',
      });
    }

    // Prevent self-rating
    if (reviewerId.toString() === reviewedId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot rate yourself',
      });
    }

    // Check for existing duplicate rating
    const existingRating = await Rating.findOne({
      ride: booking._id,
      reviewerId: new mongoose.Types.ObjectId(reviewerId),
    });

    if (existingRating) {
      return res.status(400).json({
        success: false,
        message: isOrder ? 'You have already rated this order' : 'You have already rated this ride',
        existingRating,
      });
    }

    // Create the rating record
    const newRating = await Rating.create({
      ride: booking._id,
      rideBookingId: subjectCode,
      reviewerId,
      reviewerType,
      reviewerModel,
      reviewedId,
      reviewedType,
      reviewedModel,
      rating: Math.round(numRating),
      review: String(review || '').trim(),
      feedbackTags: Array.isArray(feedbackTags) ? feedbackTags.map((t) => String(t).trim()).filter(Boolean) : [],
    });

    // Recalculate recipient statistics
    const updatedStats = await recalculateRatingStats(reviewedId, reviewedType);

    console.log(
      `[Rating] Created rating (${newRating.rating}★) for ${isOrder ? 'Order' : 'Ride'} #${subjectCode}: ${reviewerType} -> ${reviewedType} ${reviewedId}. New Stats: Avg=${updatedStats.ratingAverage}, Count=${updatedStats.ratingCount}`
    );

    res.status(201).json({
      success: true,
      message: 'Thank you! Rating submitted successfully.',
      rating: newRating,
      updatedStats,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted a rating',
      });
    }
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/ratings/ride/:rideId
// Auth: User or Captain
// Returns rating status for a specific ride
// ──────────────────────────────────────────────────────────────────────────────
export const getRideRatingStatus = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const currentUserId = req.user?.id;

    const subject = await findRideOrOrder(rideId);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Ride not found' });
    }

    const booking = subject.doc;
    const isOrder = subject.kind === 'order';
    const canRate = isOrder
      ? (booking.captainStatus === 'Delivered' || DELIVERED_ORDER_STATUSES.has(booking.orderStatus))
      : booking.status === 'RIDE_COMPLETED';

    const ratings = await Rating.find({ ride: booking._id });

    const userRatingDoc = ratings.find((r) => r.reviewerType === 'user');
    const captainRatingDoc = ratings.find((r) => r.reviewerType === 'captain');

    const myRatingDoc = currentUserId
      ? ratings.find((r) => r.reviewerId?.toString() === currentUserId.toString())
      : null;

    res.status(200).json({
      success: true,
      rideId: isOrder ? booking.orderId : booking.bookingId,
      hasUserRated: Boolean(userRatingDoc),
      userRating: userRatingDoc ? userRatingDoc.rating : null,
      userReview: userRatingDoc ? userRatingDoc.review : '',
      userFeedbackTags: userRatingDoc ? userRatingDoc.feedbackTags : [],
      hasCaptainRated: Boolean(captainRatingDoc),
      captainRating: captainRatingDoc ? captainRatingDoc.rating : null,
      captainReview: captainRatingDoc ? captainRatingDoc.review : '',
      captainFeedbackTags: captainRatingDoc ? captainRatingDoc.feedbackTags : [],
      myRating: myRatingDoc || null,
      canRate: canRate && !myRatingDoc,
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/ratings/stats/:type/:id
// Public / Authenticated
// Returns detailed rating statistics and star breakdown for a Captain or User
// ──────────────────────────────────────────────────────────────────────────────
export const getRatingBreakdown = async (req, res, next) => {
  try {
    const { type, id } = req.params; // type: 'captain' | 'user'
    const normalizedType = String(type).toLowerCase();

    if (!['captain', 'user'].includes(normalizedType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid type parameter. Must be "captain" or "user"',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid target ID' });
    }

    const targetObjId = new mongoose.Types.ObjectId(id);

    // Fetch target document for base details
    let targetDoc = null;
    if (normalizedType === 'captain') {
      targetDoc = await Captain.findById(id).select('name ratingAverage ratingCount vehicleType documents.profilePhoto');
    } else {
      targetDoc = await User.findById(id).select('name ratingAverage ratingCount');
    }

    if (!targetDoc) {
      return res.status(404).json({ success: false, message: `${type} not found` });
    }

    // Run parallel aggregation for breakdown + recent reviews
    const [breakdownResult, recentReviews] = await Promise.all([
      Rating.aggregate([
        {
          $match: {
            reviewedId: targetObjId,
            reviewedType: normalizedType,
          },
        },
        {
          $group: {
            _id: '$rating',
            count: { $sum: 1 },
          },
        },
      ]),
      Rating.find({
        reviewedId: targetObjId,
        reviewedType: normalizedType,
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('reviewerId', 'name')
        .select('rating review feedbackTags createdAt reviewerType reviewerId'),
    ]);

    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let totalRatings = 0;
    let sumScore = 0;

    (breakdownResult || []).forEach((item) => {
      const star = item._id;
      if (breakdown[star] !== undefined) {
        breakdown[star] = item.count;
        totalRatings += item.count;
        sumScore += star * item.count;
      }
    });

    const averageRating =
      totalRatings > 0 ? Math.round((sumScore / totalRatings) * 10) / 10 : targetDoc.ratingAverage || 0;

    // Collect top feedback tag frequencies
    const tagCounts = {};
    recentReviews.forEach((r) => {
      (r.feedbackTags || []).forEach((t) => {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      });
    });

    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag, count]) => ({ tag, count }));

    res.status(200).json({
      success: true,
      target: {
        id: targetDoc._id,
        name: targetDoc.name,
        type: normalizedType,
        profilePhoto: targetDoc.documents?.profilePhoto || '',
      },
      stats: {
        ratingAverage: averageRating,
        ratingCount: totalRatings,
        breakdown,
        topTags,
      },
      recentReviews: recentReviews.map((r) => ({
        _id: r._id,
        rating: r.rating,
        review: r.review,
        feedbackTags: r.feedbackTags,
        createdAt: r.createdAt,
        reviewerName: r.reviewerId?.name || (r.reviewerType === 'captain' ? 'Captain' : 'Customer'),
      })),
    });
  } catch (error) {
    next(error);
  }
};
