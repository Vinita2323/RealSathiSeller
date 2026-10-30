import mongoose from 'mongoose';

const sectionSchema = new mongoose.Schema({
  heading: {
    type: String,
    required: true,
    trim: true,
  },
  body: {
    type: String,
    required: true,
  },
}, { _id: true });

const policySchema = new mongoose.Schema(
  {
    target: {
      type: String,
      required: true,
      enum: ['user', 'seller', 'captain'],
      lowercase: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['terms', 'privacy'],
      lowercase: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    version: {
      type: String,
      default: 'v1.0',
    },
    effectiveDate: {
      type: String,
      default: () => new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    },
    sections: [sectionSchema],
    published: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: String,
      default: 'Admin',
    }
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure uniqueness per target and policy type
policySchema.index({ target: 1, type: 1 }, { unique: true });

const Policy = mongoose.model('Policy', policySchema);

export default Policy;
