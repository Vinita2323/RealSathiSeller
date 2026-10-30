import mongoose from 'mongoose';
import ProductReview from '../models/ProductReview.model.js';
import Product from '../models/Product.model.js';
import Order from '../models/Order.model.js';
import User from '../models/User.model.js';

/**
 * Helper: Recalculate product rating average and count via aggregation
 */
export const recalculateProductRatingStats = async (productId) => {
  try {
    const prodObjectId = new mongoose.Types.ObjectId(productId);
    const stats = await ProductReview.aggregate([
      { $match: { product: prodObjectId } },
      {
        $group: {
          _id: '$product',
          ratingAverage: { $avg: '$rating' },
          ratingCount: { $sum: 1 },
        },
      },
    ]);

    let ratingAverage = 0;
    let ratingCount = 0;

    if (stats.length > 0) {
      ratingAverage = Math.round(stats[0].ratingAverage * 10) / 10;
      ratingCount = stats[0].ratingCount;
    }

    await Product.findByIdAndUpdate(prodObjectId, {
      ratingAverage,
      ratingCount,
    });

    return { ratingAverage, ratingCount };
  } catch (error) {
    console.error(`[ReviewController] Error recalculating product rating stats for product ${productId}:`, error);
    return { ratingAverage: 0, ratingCount: 0 };
  }
};

/**
 * Submit or Update a Product Review (Post-Delivery only)
 * POST /api/reviews
 */
export const submitReview = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const {
      productId,
      orderId, // Can be MongoDB _id or orderId string (e.g. ORD-123456)
      rating,
      review = '',
      images = [],
      feedbackTags = [],
    } = req.body;

    // 1. Basic validation
    if (!productId || !orderId || rating === undefined || rating === null) {
      return res.status(400).json({
        success: false,
        message: 'Product ID, Order ID, and Rating (1-5) are required.',
      });
    }

    const numRating = Number(rating);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be an integer between 1 and 5.',
      });
    }

    if (review && review.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Review text cannot exceed 500 characters.',
      });
    }

    if (Array.isArray(images) && images.length > 5) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 5 photos allowed per review.',
      });
    }

    // 2. Fetch Order and Verify Ownership & Delivery Status
    let order = await Order.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(orderId) ? orderId : null },
        { orderId: orderId },
      ],
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.',
      });
    }

    if (order.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to review an order that does not belong to you.',
      });
    }

    const normalizedOrderStatus = (order.orderStatus || '').trim().toLowerCase();
    const isDelivered = ['delivered', 'completed'].includes(normalizedOrderStatus);

    if (!isDelivered) {
      return res.status(400).json({
        success: false,
        message: 'Products can only be rated and reviewed after the order has been successfully delivered.',
      });
    }

    // 3. Verify Product belongs to this Order
    const matchingItem = order.items.find((item) => {
      const itemProdId = item.product?._id || item.product;
      return itemProdId && itemProdId.toString() === productId.toString();
    });

    if (!matchingItem) {
      return res.status(400).json({
        success: false,
        message: 'This product is not part of the specified delivered order.',
      });
    }

    // 4. Verify Product exists in database
    let product = null;
    if (mongoose.Types.ObjectId.isValid(productId)) {
      product = await Product.findById(productId);
    } else {
      product = await Product.findOne({ sku: productId });
    }
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
      });
    }

    // 5. Create or Update Review (Atomic Upsert)
    const existingReview = await ProductReview.findOne({
      user: userId,
      order: order._id,
      product: product._id,
    });

    let reviewDoc;
    let isNew = false;

    if (existingReview) {
      existingReview.rating = numRating;
      existingReview.review = review ? review.trim() : '';
      existingReview.images = Array.isArray(images) ? images : [];
      existingReview.feedbackTags = Array.isArray(feedbackTags) ? feedbackTags : [];
      existingReview.isVerifiedPurchase = true;
      reviewDoc = await existingReview.save();
    } else {
      isNew = true;
      reviewDoc = await ProductReview.create({
        user: userId,
        product: product._id,
        order: order._id,
        orderId: order.orderId,
        rating: numRating,
        review: review ? review.trim() : '',
        images: Array.isArray(images) ? images : [],
        feedbackTags: Array.isArray(feedbackTags) ? feedbackTags : [],
        isVerifiedPurchase: true,
      });
    }

    // 6. Recalculate Product Rating Stats
    const updatedStats = await recalculateProductRatingStats(product._id);

    return res.status(isNew ? 201 : 200).json({
      success: true,
      message: isNew ? 'Review submitted successfully! Thank you for your feedback.' : 'Review updated successfully!',
      review: reviewDoc,
      stats: updatedStats,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this product for this order.',
      });
    }
    next(error);
  }
};

/**
 * Get Reviews and Rating Breakdown for a Product
 * GET /api/reviews/product/:productId
 */
export const getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    let prodObjectId = null;
    if (productId && mongoose.Types.ObjectId.isValid(productId)) {
      prodObjectId = new mongoose.Types.ObjectId(productId);
    } else if (productId) {
      const prod = await Product.findOne({ sku: productId }).select('_id').lean();
      if (prod) {
        prodObjectId = prod._id;
      }
    }

    if (!prodObjectId) {
      return res.status(200).json({
        success: true,
        count: 0,
        total: 0,
        page,
        limit,
        averageRating: 0,
        totalRatings: 0,
        breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        reviews: [],
      });
    }

    // Aggregate rating breakdown (1 to 5 star counts)
    const breakdownAgg = await ProductReview.aggregate([
      { $match: { product: prodObjectId } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 },
        },
      },
    ]);

    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let totalRatings = 0;
    let sumRatings = 0;

    breakdownAgg.forEach((b) => {
      if (breakdown[b._id] !== undefined) {
        breakdown[b._id] = b.count;
      }
      totalRatings += b.count;
      sumRatings += b._id * b.count;
    });

    const averageRating = totalRatings > 0 ? Math.round((sumRatings / totalRatings) * 10) / 10 : 0;

    // Fetch paginated reviews with user details populated
    const reviews = await ProductReview.find({ product: prodObjectId })
      .populate('user', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const formattedReviews = reviews.map((r) => ({
      _id: r._id,
      id: r._id,
      rating: r.rating,
      review: r.review,
      images: r.images || [],
      feedbackTags: r.feedbackTags || [],
      isVerifiedPurchase: r.isVerifiedPurchase !== false,
      createdAt: r.createdAt,
      date: new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      user: {
        id: r.user?._id || r.user,
        name: r.user?.name || 'Verified Customer',
        avatar: r.user?.avatar || null,
      },
    }));

    return res.status(200).json({
      success: true,
      productId,
      averageRating,
      totalRatings,
      breakdown,
      page,
      limit,
      totalPages: Math.ceil(totalRatings / limit),
      reviews: formattedReviews,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get Review Status for all items in an Order (for the logged in user)
 * GET /api/reviews/order/:orderId/status
 */
export const getOrderReviewStatus = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { orderId } = req.params;

    let order = await Order.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(orderId) ? orderId : null },
        { orderId: orderId },
      ],
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.user.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const reviews = await ProductReview.find({
      user: userId,
      order: order._id,
    }).lean();

    const reviewMap = {};
    reviews.forEach((r) => {
      reviewMap[r.product.toString()] = {
        _id: r._id,
        id: r._id,
        rating: r.rating,
        review: r.review,
        images: r.images || [],
        feedbackTags: r.feedbackTags || [],
        isVerifiedPurchase: r.isVerifiedPurchase,
        createdAt: r.createdAt,
      };
    });

    return res.status(200).json({
      success: true,
      orderId: order.orderId,
      reviews: reviewMap,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all reviews submitted by the authenticated user
 * GET /api/reviews/user
 */
export const getUserReviews = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const reviews = await ProductReview.find({ user: userId })
      .populate('product', 'name mainImage price salePrice')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      reviews,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing review by ID
 * PUT /api/reviews/:id
 */
export const updateReview = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { id } = req.params;
    const { rating, review, images, feedbackTags } = req.body;

    const reviewDoc = await ProductReview.findById(id);
    if (!reviewDoc) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    if (reviewDoc.user.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'You can only edit your own reviews.' });
    }

    if (rating !== undefined) {
      const numRating = Number(rating);
      if (isNaN(numRating) || numRating < 1 || numRating > 5) {
        return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5.' });
      }
      reviewDoc.rating = numRating;
    }

    if (review !== undefined) reviewDoc.review = review.trim();
    if (images !== undefined) reviewDoc.images = Array.isArray(images) ? images : [];
    if (feedbackTags !== undefined) reviewDoc.feedbackTags = Array.isArray(feedbackTags) ? feedbackTags : [];

    await reviewDoc.save();

    // Recalculate stats
    const updatedStats = await recalculateProductRatingStats(reviewDoc.product);

    return res.status(200).json({
      success: true,
      message: 'Review updated successfully!',
      review: reviewDoc,
      stats: updatedStats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete an existing review by ID
 * DELETE /api/reviews/:id
 */
export const deleteReview = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { id } = req.params;

    const reviewDoc = await ProductReview.findById(id);
    if (!reviewDoc) {
      return res.status(404).json({ success: false, message: 'Review not found' });
    }

    if (reviewDoc.user.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'You can only delete your own reviews.' });
    }

    const productId = reviewDoc.product;
    await ProductReview.findByIdAndDelete(id);

    // Recalculate stats
    const updatedStats = await recalculateProductRatingStats(productId);

    return res.status(200).json({
      success: true,
      message: 'Review deleted successfully.',
      stats: updatedStats,
    });
  } catch (error) {
    next(error);
  }
};
