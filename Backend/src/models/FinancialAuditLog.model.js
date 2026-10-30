import mongoose from 'mongoose';

const financialAuditLogSchema = new mongoose.Schema(
  {
    logId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
    actorEmail: {
      type: String,
      required: true,
    },
    actorRole: {
      type: String,
      default: 'super_admin',
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    targetEntity: {
      type: String,
      required: true,
      index: true,
    },
    targetId: {
      type: String,
      default: '',
      index: true,
    },
    amount: {
      type: Number,
      default: null,
    },
    previousValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    ipAddress: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
    remarks: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

financialAuditLogSchema.index({ action: 1, createdAt: -1 });
financialAuditLogSchema.index({ targetEntity: 1, targetId: 1 });
financialAuditLogSchema.index({ createdAt: -1 });

const FinancialAuditLog = mongoose.model('FinancialAuditLog', financialAuditLogSchema);
export default FinancialAuditLog;
