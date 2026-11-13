import mongoose from 'mongoose';

// Payment records for repair bookings (kept apart from ecommerce order payments).
const repairPaymentSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'RepairBooking', required: true, index: true },
    bookingId: { type: String, required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0 },
    kind: { type: String, enum: ['REPAIR_BILL', 'DIAGNOSIS_FEE'], default: 'REPAIR_BILL' },
    method: { type: String, enum: ['CASH', 'ONLINE'], default: 'CASH' },
    status: { type: String, enum: ['COLLECTED', 'FAILED', 'REFUNDED'], default: 'COLLECTED' },
    collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Captain', default: null },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

const RepairPayment = mongoose.model('RepairPayment', repairPaymentSchema);
export default RepairPayment;
