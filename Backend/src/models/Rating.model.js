import mongoose from 'mongoose';

const ratingSchema = new mongoose.Schema(
  {
    ride: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TransportBooking',
      required: true,
      index: true,
    },
    rideBookingId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    reviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'reviewerModel',
      index: true,
    },
    reviewerType: {
      type: String,
      enum: ['user', 'captain'],
      required: true,
    },
    reviewerModel: {
      type: String,
      enum: ['User', 'Captain'],
      required: true,
    },
    reviewedId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'reviewedModel',
      index: true,
    },
    reviewedType: {
      type: String,
      enum: ['captain', 'user'],
      required: true,
    },
    reviewedModel: {
      type: String,
      enum: ['Captain', 'User'],
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    review: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
    feedbackTags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: 'ratings',
  }
);

// Compound Unique Index: Prevents duplicate rating by the same reviewer for the same ride
ratingSchema.index({ ride: 1, reviewerId: 1 }, { unique: true });

// Query Indexes
ratingSchema.index({ reviewedId: 1, reviewedType: 1, createdAt: -1 });

const Rating = mongoose.model('Rating', ratingSchema);
export default Rating;
