import mongoose from 'mongoose';

const productReviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    orderId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    review: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Review cannot exceed 500 characters'],
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: function (val) {
          return val.length <= 5;
        },
        message: 'Maximum 5 photos allowed per review',
      },
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: true,
    },
    feedbackTags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'product_reviews',
  }
);

// Compound Unique Index: Strictly enforces 1 review per product per order per user
productReviewSchema.index({ user: 1, order: 1, product: 1 }, { unique: true });

// Targeted query indexes
productReviewSchema.index({ product: 1, createdAt: -1 });
productReviewSchema.index({ orderId: 1, product: 1 });
productReviewSchema.index({ user: 1, createdAt: -1 });

const ProductReview = mongoose.model('ProductReview', productReviewSchema);

export default ProductReview;
