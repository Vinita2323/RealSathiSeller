import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
    },
    discountBadge: {
      type: String,
      trim: true,
    },
    ctaText: {
      type: String,
      default: 'Shop Now',
      trim: true,
    },
    redirectUrl: {
      type: String,
      default: '/categories',
      trim: true,
    },
    imageUrl: {
      type: String,
      default: '/promo_banner_bg.png',
    },
    position: {
      type: String,
      default: 'Hero Banner',
    },
    priority: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Active',
    },
  },
  {
    timestamps: true,
  }
);

bannerSchema.index({ status: 1, priority: 1 });

const Banner = mongoose.model('Banner', bannerSchema);
export default Banner;
