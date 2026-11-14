import mongoose from 'mongoose';
import { REPAIR_STATUSES } from '../utils/repairHelpers.js';

// Repair & Services booking. Completely separate from ecommerce `Order`.

const addressSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    addressLine1: { type: String, trim: true, default: '' },
    addressLine2: { type: String, trim: true, default: '' },
    landmark: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    pincode: { type: String, trim: true, default: '' },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
  },
  { _id: false }
);

const historySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    note: { type: String, default: '' },
    byRole: { type: String, default: 'system' },
    by: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const quotationItemSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, required: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const repairBookingSchema = new mongoose.Schema(
  {
    bookingId: { type: String, required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    // Item details
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'RepairCategory', default: null },
    categoryName: { type: String, required: true, trim: true },
    brand: { type: String, trim: true, default: '' },
    model: { type: String, trim: true, default: '' },
    problem: { type: String, trim: true, required: true },
    subProblem: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    photos: { type: [String], default: [] },

    // Pickup
    pickupAddress: { type: addressSchema, required: true },
    pickupSlot: {
      date: { type: String, required: true }, // YYYY-MM-DD
      timeSlot: { type: String, required: true }, // e.g. "10:00 AM - 12:00 PM"
    },

    status: { type: String, enum: REPAIR_STATUSES, default: 'REQUESTED', index: true },
    statusHistory: { type: [historySchema], default: [] },

    // OTPs (generated at booking, never exposed to captain / technician)
    pickupOtp: { type: String, default: '' },
    deliveryOtp: { type: String, default: '' },
    // Repair-center handover OTP: known to admin / center staff, entered by the rider on arrival
    centerOtp: { type: String, default: '' },
    centerOtpVerified: { type: Boolean, default: false },
    pickupOtpVerified: { type: Boolean, default: false },
    deliveryOtpVerified: { type: Boolean, default: false },

    // Rider assignment
    pickupCaptainId: { type: mongoose.Schema.Types.ObjectId, ref: 'Captain', default: null, index: true },
    pickupCaptainStatus: { type: String, enum: ['', 'Assigned', 'Accepted', 'Rejected'], default: '' },
    deliveryCaptainId: { type: mongoose.Schema.Types.ObjectId, ref: 'Captain', default: null, index: true },
    deliveryCaptainStatus: { type: String, enum: ['', 'Assigned', 'Accepted', 'Rejected'], default: '' },
    // Status to fall back to if the delivery rider rejects
    preDeliveryStatus: { type: String, default: '' },

    // Repair center + technician
    repairCenter: { type: mongoose.Schema.Types.ObjectId, ref: 'RepairCenter', default: null },
    technician: { type: mongoose.Schema.Types.ObjectId, ref: 'RepairTechnician', default: null, index: true },

    // Diagnosis + quotation
    diagnosis: {
      findings: { type: String, default: '' },
      photos: { type: [String], default: [] },
      diagnosedAt: { type: Date, default: null },
    },
    quotation: {
      items: { type: [quotationItemSchema], default: [] },
      total: { type: Number, default: 0 },
      estimatedDays: { type: Number, default: 0 },
      notes: { type: String, default: '' },
      status: { type: String, enum: ['None', 'Sent', 'Approved', 'Rejected'], default: 'None' },
      sentAt: { type: Date, default: null },
      respondedAt: { type: Date, default: null },
      customerNote: { type: String, default: '' },
    },
    repairNotes: { type: String, default: '' },
    // 'phone' = admin recorded the diagnosis and takes the customer's decision by phone; 'app' = customer approves in the app
    decisionMode: { type: String, enum: ['app', 'phone'], default: 'app' },

    // Billing (separate from ecommerce payments)
    diagnosisFee: { type: Number, default: 0 },
    amountDue: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ['Pending', 'Paid'], default: 'Pending' },
    paymentMethod: { type: String, default: '' },

    // Driver earnings (paid once per completed leg; see utils/repairEarnings.js)
    pickupEarningCredited: { type: Boolean, default: false },
    deliveryEarningCredited: { type: Boolean, default: false },
    pickupCaptainEarnings: { type: Number, default: 0 },
    deliveryCaptainEarnings: { type: Number, default: 0 },

    // Timestamps for milestones
    rideStartedAt: { type: Date, default: null },
    reachedCustomerAt: { type: Date, default: null },
    pickedUpAt: { type: Date, default: null },
    centerRideStartedAt: { type: Date, default: null },
    reachedCenterAt: { type: Date, default: null },
    atCenterAt: { type: Date, default: null },
    repairCompletedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },

    cancelReason: { type: String, default: '' },
    cancelledBy: { type: String, default: '' },
  },
  { timestamps: true }
);

repairBookingSchema.index({ createdAt: -1 });
repairBookingSchema.index({ status: 1, createdAt: -1 });

const RepairBooking = mongoose.model('RepairBooking', repairBookingSchema);
export default RepairBooking;
