import mongoose from 'mongoose';

// Marks a Captain account as a "repair driver" (added by admin under Repair & Services).
// The driver is a normal Captain account (so the existing captain login / app / notifications work);
// this record only adds repair-specific settings.
const repairDriverSchema = new mongoose.Schema(
  {
    captain: { type: mongoose.Schema.Types.ObjectId, ref: 'Captain', required: true, unique: true, index: true },
    // When true the driver is kept out of grocery / ecommerce order auto-dispatch
    repairOnly: { type: Boolean, default: true, index: true },
    createdBy: { type: String, default: '' },
  },
  { timestamps: true }
);

const RepairDriver = mongoose.model('RepairDriver', repairDriverSchema);
export default RepairDriver;
