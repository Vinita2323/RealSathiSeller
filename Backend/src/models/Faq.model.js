import mongoose from 'mongoose';

const faqSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: [true, 'FAQ question is required'],
      trim: true,
    },
    answer: {
      type: String,
      required: [true, 'FAQ answer is required'],
      trim: true,
    },
    category: {
      type: String,
      default: 'General',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast active queries and ordering
faqSchema.index({ isActive: 1, order: 1, createdAt: -1 });

const Faq = mongoose.model('Faq', faqSchema);

export default Faq;
