import mongoose from 'mongoose';

const profileEditRequestSchema = new mongoose.Schema(
  {
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'requesterRoleModel',
    },
    requesterRole: {
      type: String,
      required: true,
      enum: ['user', 'seller', 'captain'],
    },
    requesterRoleModel: {
      type: String,
      required: true,
      enum: ['User', 'Seller', 'Captain'],
    },
    requesterName: {
      type: String,
      trim: true,
      default: '',
    },
    requesterPhone: {
      type: String,
      trim: true,
      default: '',
    },
    requesterEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    currentData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    updatedData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    changedFields: [
      {
        field: { type: String, required: true },
        label: { type: String, required: true },
        oldValue: { type: mongoose.Schema.Types.Mixed },
        newValue: { type: mongoose.Schema.Types.Mixed },
      },
    ],
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    adminNote: {
      type: String,
      default: '',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
    },
    reviewedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast lookup
profileEditRequestSchema.index({ requesterId: 1, status: 1 });
profileEditRequestSchema.index({ requesterRole: 1, status: 1 });
profileEditRequestSchema.index({ createdAt: -1 });

export const ProfileEditRequest = mongoose.model('ProfileEditRequest', profileEditRequestSchema);
export default ProfileEditRequest;
