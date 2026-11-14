import mongoose from 'mongoose';
import RepairBooking from '../models/RepairBooking.model.js';
import RepairCenter from '../models/RepairCenter.model.js';
import RepairPayment from '../models/RepairPayment.model.js';
import { creditRepairLeg, recordRepairCashCollected } from '../utils/repairEarnings.js';
import { getDefaultDropLocation, dropLocationFor } from '../utils/repairDropLocation.js';
import { pushHistory, sanitizeForStaff, notifyCustomer, generateRepairOtp } from '../utils/repairHelpers.js';

const POPULATE_CENTER = { path: 'repairCenter', select: 'name address city phone lat lng' };

// A job is "mine" if I am the assigned pickup rider or delivery rider.
const findMyJob = async (req) => {
  const { id } = req.params;
  const captainId = req.user.id;
  const idQuery = mongoose.Types.ObjectId.isValid(id) ? { $or: [{ _id: id }, { bookingId: id }] } : { bookingId: id };
  // $and keeps BOTH conditions. (Spreading idQuery next to a second $or would overwrite its $or and drop the id match,
  // returning any other job of this captain.)
  const booking = await RepairBooking.findOne({
    $and: [idQuery, { $or: [{ pickupCaptainId: captainId }, { deliveryCaptainId: captainId }] }],
  }).populate(POPULATE_CENTER);
  return booking;
};

// Staff view of a booking plus where the parcel must be dropped / collected (repair center or admin address)
const staffView = async (booking, fallback) => ({
  ...sanitizeForStaff(booking),
  dropLocation: dropLocationFor(booking, fallback === undefined ? await getDefaultDropLocation() : fallback),
});

const isMyPickup = (booking, captainId) => String(booking.pickupCaptainId || '') === String(captainId);
const isMyDelivery = (booking, captainId) => String(booking.deliveryCaptainId || '') === String(captainId);

const wrongStage = (res, message) => res.status(400).json({ success: false, message });

// GET /api/repair/captain/jobs?tab=pickups|deliveries|history
export const getCaptainJobs = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const tab = String(req.query.tab || 'pickups');

    let query;
    if (tab === 'pickups') {
      query = {
        pickupCaptainId: captainId,
        pickupCaptainStatus: { $in: ['Assigned', 'Accepted'] },
        status: { $in: ['PICKUP_ASSIGNED', 'PICKUP_ACCEPTED', 'PICKUP_STARTED', 'REACHED_CUSTOMER', 'PICKED_UP', 'CENTER_RIDE_STARTED', 'REACHED_CENTER'] },
      };
    } else if (tab === 'deliveries') {
      query = {
        deliveryCaptainId: captainId,
        deliveryCaptainStatus: { $in: ['Assigned', 'Accepted'] },
        status: { $in: ['DELIVERY_ASSIGNED', 'DELIVERY_ACCEPTED', 'OUT_FOR_DELIVERY'] },
      };
    } else {
      query = {
        $or: [{ pickupCaptainId: captainId }, { deliveryCaptainId: captainId }],
        status: { $in: ['AT_REPAIR_CENTER', 'DIAGNOSING', 'QUOTATION_SENT', 'QUOTATION_APPROVED', 'QUOTATION_REJECTED', 'IN_REPAIR', 'REPAIR_COMPLETED', 'DELIVERED', 'CANCELLED'] },
      };
    }

    const bookings = await RepairBooking.find(query)
      .select('-statusHistory -photos')
      .populate(POPULATE_CENTER)
      .sort({ updatedAt: -1 })
      .limit(50);

    const fallbackDrop = await getDefaultDropLocation();
    const me = String(captainId);
    const views = await Promise.all(bookings.map(async (b) => {
      const view = await staffView(b, fallbackDrop);
      // Which legs of this booking did I finish (and what did each pay)? Used by the Completed list.
      const completedLegs = [];
      if (String(b.pickupCaptainId || '') === me && b.atCenterAt) completedLegs.push({ leg: 'pickup', earnings: b.pickupCaptainEarnings || 0, at: b.atCenterAt });
      if (String(b.deliveryCaptainId || '') === me && b.status === 'DELIVERED') completedLegs.push({ leg: 'delivery', earnings: b.deliveryCaptainEarnings || 0, at: b.deliveredAt });
      return { ...view, completedLegs };
    }));
    res.json({ success: true, bookings: views, count: views.length });
  } catch (error) {
    next(error);
  }
};

// GET /api/repair/captain/pending
// Jobs assigned to me by admin that I have not accepted / rejected yet (drives the live "new job" popup).
export const getPendingOffers = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const bookings = await RepairBooking.find({
      $or: [
        { pickupCaptainId: captainId, pickupCaptainStatus: 'Assigned', status: 'PICKUP_ASSIGNED' },
        { deliveryCaptainId: captainId, deliveryCaptainStatus: 'Assigned', status: 'DELIVERY_ASSIGNED' },
      ],
    })
      .select('bookingId categoryName brand model problem subProblem pickupAddress pickupSlot status updatedAt repairCenter')
      .populate(POPULATE_CENTER)
      .sort({ updatedAt: -1 })
      .limit(10);
    const fallbackDrop = await getDefaultDropLocation();
    const offers = await Promise.all(bookings.map(async (b) => ({ ...(await staffView(b, fallbackDrop)), offerType: b.status === 'DELIVERY_ASSIGNED' ? 'delivery' : 'pickup' })));
    res.json({ success: true, offers });
  } catch (error) {
    next(error);
  }
};

// PUT /api/repair/captain/jobs/:id/accept  (pickup or delivery, whichever is pending for me)
export const acceptJob = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const booking = await findMyJob(req);
    if (!booking) return res.status(404).json({ success: false, message: 'Repair job not found.' });

    if (isMyPickup(booking, captainId) && booking.status === 'PICKUP_ASSIGNED' && booking.pickupCaptainStatus === 'Assigned') {
      booking.pickupCaptainStatus = 'Accepted';
      pushHistory(booking, 'PICKUP_ACCEPTED', { note: 'Rider accepted pickup', byRole: 'captain', by: captainId });
      await booking.save();
      notifyCustomer(booking, 'Rider on the way', `Your rider has accepted pickup for ${booking.bookingId}. Your pickup OTP is ${booking.pickupOtp} — share it only when the rider reaches you.`);
      return res.json({ success: true, message: 'Pickup accepted.', booking: sanitizeForStaff(booking) });
    }

    if (isMyDelivery(booking, captainId) && booking.status === 'DELIVERY_ASSIGNED' && booking.deliveryCaptainStatus === 'Assigned') {
      booking.deliveryCaptainStatus = 'Accepted';
      pushHistory(booking, 'DELIVERY_ACCEPTED', { note: 'Rider accepted delivery', byRole: 'captain', by: captainId });
      await booking.save();
      notifyCustomer(booking, 'Delivery rider assigned', `A rider will deliver ${booking.bookingId} soon. Your delivery OTP is ${booking.deliveryOtp} — share it only after you receive your item.`);
      return res.json({ success: true, message: 'Delivery accepted.', booking: sanitizeForStaff(booking) });
    }

    return wrongStage(res, 'This job is not waiting for your acceptance.');
  } catch (error) {
    next(error);
  }
};

// PUT /api/repair/captain/jobs/:id/reject  (returns the job to admin for re-assignment)
export const rejectJob = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const booking = await findMyJob(req);
    if (!booking) return res.status(404).json({ success: false, message: 'Repair job not found.' });
    const reason = String(req.body.reason || 'Rider declined').slice(0, 200);

    if (isMyPickup(booking, captainId) && booking.status === 'PICKUP_ASSIGNED' && booking.pickupCaptainStatus === 'Assigned') {
      booking.pickupCaptainStatus = 'Rejected';
      booking.pickupCaptainId = null;
      pushHistory(booking, 'REQUESTED', { note: `Pickup rider rejected: ${reason}. Awaiting re-assignment`, byRole: 'captain', by: captainId });
      await booking.save();
      return res.json({ success: true, message: 'Pickup rejected.' });
    }

    if (isMyDelivery(booking, captainId) && booking.status === 'DELIVERY_ASSIGNED' && booking.deliveryCaptainStatus === 'Assigned') {
      booking.deliveryCaptainStatus = 'Rejected';
      booking.deliveryCaptainId = null;
      pushHistory(booking, booking.preDeliveryStatus || 'REPAIR_COMPLETED', {
        note: `Delivery rider rejected: ${reason}. Awaiting re-assignment`,
        byRole: 'captain',
        by: captainId,
      });
      await booking.save();
      return res.json({ success: true, message: 'Delivery rejected.' });
    }

    return wrongStage(res, 'Only a newly assigned job can be rejected.');
  } catch (error) {
    next(error);
  }
};

// PUT /api/repair/captain/jobs/:id/start-ride   (rider leaves for the customer; customer + admin see "Rider on the way")
export const startPickupRide = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const booking = await findMyJob(req);
    if (!booking || !isMyPickup(booking, captainId)) {
      return res.status(404).json({ success: false, message: 'Repair job not found.' });
    }
    if (booking.status !== 'PICKUP_ACCEPTED') {
      return wrongStage(res, 'Accept the pickup first, then start the ride.');
    }
    booking.rideStartedAt = new Date();
    pushHistory(booking, 'PICKUP_STARTED', { note: 'Rider started the ride to the customer', byRole: 'captain', by: captainId });
    await booking.save();
    notifyCustomer(booking, 'Rider is on the way', `Your rider has started towards you for ${booking.bookingId}. Your pickup OTP is ${booking.pickupOtp}.`);
    res.json({ success: true, message: 'Ride started.', booking: sanitizeForStaff(booking) });
  } catch (error) {
    next(error);
  }
};

// PUT /api/repair/captain/jobs/:id/reached   (rider has arrived at the customer → OTP can now be entered)
export const markReachedCustomer = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const booking = await findMyJob(req);
    if (!booking || !isMyPickup(booking, captainId)) {
      return res.status(404).json({ success: false, message: 'Repair job not found.' });
    }
    if (booking.status !== 'PICKUP_STARTED') {
      return wrongStage(res, 'Start the ride first.');
    }
    booking.reachedCustomerAt = new Date();
    pushHistory(booking, 'REACHED_CUSTOMER', { note: 'Rider reached the customer location', byRole: 'captain', by: captainId });
    await booking.save();
    notifyCustomer(booking, 'Rider has arrived', `Your rider has reached your location for ${booking.bookingId}. Share your pickup OTP ${booking.pickupOtp} to hand over the item.`);
    res.json({ success: true, message: 'Marked as reached. Ask the customer for the pickup OTP.', booking: sanitizeForStaff(booking) });
  } catch (error) {
    next(error);
  }
};

// POST /api/repair/captain/jobs/:id/verify-pickup-otp   body: { otp }
export const verifyPickupOtp = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const booking = await findMyJob(req);
    if (!booking || !isMyPickup(booking, captainId)) {
      return res.status(404).json({ success: false, message: 'Repair job not found.' });
    }
    if (booking.status !== 'REACHED_CUSTOMER') {
      return wrongStage(res, 'Start the ride and mark "Reached customer" before entering the pickup OTP.');
    }
    if (String(req.body.otp || '').trim() !== booking.pickupOtp) {
      return res.status(400).json({ success: false, message: 'Invalid pickup OTP. Please ask the customer.' });
    }
    booking.pickupOtpVerified = true;
    booking.pickedUpAt = new Date();
    pushHistory(booking, 'PICKED_UP', { note: 'Item picked up from customer', byRole: 'captain', by: captainId });
    await booking.save();
    notifyCustomer(booking, 'Item picked up', `Your item for ${booking.bookingId} has been picked up and is on its way to the repair center.`);
    res.json({ success: true, message: 'Pickup verified. Take the item to the repair center.', booking: await staffView(booking) });
  } catch (error) {
    next(error);
  }
};

// PUT /api/repair/captain/jobs/:id/start-center-ride
// After pickup the rider starts the ride to the repair center (customer + admin see "On the way to repair center").
export const startRideToCenter = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const booking = await findMyJob(req);
    if (!booking || !isMyPickup(booking, captainId)) {
      return res.status(404).json({ success: false, message: 'Repair job not found.' });
    }
    if (booking.status !== 'PICKED_UP') {
      return wrongStage(res, 'Pick up the item from the customer first, then start the ride to the repair center.');
    }
    // Pre-assign the first active center when admin has not chosen one (no center is not fatal: admin can still guide the rider)
    if (!booking.repairCenter) {
      const center = await RepairCenter.findOne({ active: true }).sort({ createdAt: 1 });
      if (center) booking.repairCenter = center._id;
    }
    booking.centerRideStartedAt = new Date();
    pushHistory(booking, 'CENTER_RIDE_STARTED', { note: 'Rider started the ride to the repair center', byRole: 'captain', by: captainId });
    await booking.save();
    await booking.populate(POPULATE_CENTER);
    notifyCustomer(booking, 'On the way to the repair center', `Your item for ${booking.bookingId} is on its way to the repair center.`);
    res.json({ success: true, message: 'Ride to the repair center started.', booking: await staffView(booking) });
  } catch (error) {
    next(error);
  }
};

// PUT /api/repair/captain/jobs/:id/reached-center
// Rider arrived at the repair center → admin is alerted and gives the handover OTP.
export const markReachedCenter = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const booking = await findMyJob(req);
    if (!booking || !isMyPickup(booking, captainId)) {
      return res.status(404).json({ success: false, message: 'Repair job not found.' });
    }
    if (booking.status !== 'CENTER_RIDE_STARTED') {
      return wrongStage(res, 'Start the ride to the repair center first.');
    }
    if (!booking.centerOtp) booking.centerOtp = generateRepairOtp(); // bookings created before this step existed
    booking.reachedCenterAt = new Date();
    pushHistory(booking, 'REACHED_CENTER', { note: 'Rider reached the repair center', byRole: 'captain', by: captainId });
    await booking.save();
    await booking.populate(POPULATE_CENTER);
    res.json({ success: true, message: 'Reached. Ask the repair center for the handover OTP.', booking: await staffView(booking) });
  } catch (error) {
    next(error);
  }
};

// POST /api/repair/captain/jobs/:id/verify-center-otp   body: { otp }
// The repair center gives the OTP to the rider; a correct OTP completes the handover (item is now at the center).
export const verifyCenterOtp = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const booking = await findMyJob(req);
    if (!booking || !isMyPickup(booking, captainId)) {
      return res.status(404).json({ success: false, message: 'Repair job not found.' });
    }
    if (booking.status !== 'REACHED_CENTER') {
      return wrongStage(res, 'Mark "Reached repair center" before entering the handover OTP.');
    }
    if (String(req.body.otp || '').trim() !== booking.centerOtp) {
      return res.status(400).json({ success: false, message: 'Invalid handover OTP. Please ask the repair center.' });
    }
    booking.centerOtpVerified = true;
    booking.atCenterAt = new Date();
    pushHistory(booking, 'AT_REPAIR_CENTER', { note: 'Item handed over at the repair center (OTP verified)', byRole: 'captain', by: captainId });
    await booking.save();
    await booking.populate(POPULATE_CENTER);
    try { await creditRepairLeg(booking, 'pickup'); } catch (e) { console.warn('[RepairEarnings] pickup credit failed:', e.message); }
    notifyCustomer(booking, 'At repair center', `Your item for ${booking.bookingId} has been handed over at the repair center. Diagnosis will start soon.`);
    res.json({ success: true, message: 'Handover verified. The item is now at the repair center.', booking: await staffView(booking) });
  } catch (error) {
    next(error);
  }
};

// PUT /api/repair/captain/jobs/:id/collect   (delivery rider collects repaired item from center)
export const collectFromCenter = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const booking = await findMyJob(req);
    if (!booking || !isMyDelivery(booking, captainId)) {
      return res.status(404).json({ success: false, message: 'Repair job not found.' });
    }
    if (booking.status !== 'DELIVERY_ACCEPTED') {
      return wrongStage(res, 'Accept the delivery first.');
    }
    pushHistory(booking, 'OUT_FOR_DELIVERY', { note: 'Rider collected the item from repair center', byRole: 'captain', by: captainId });
    await booking.save();
    notifyCustomer(booking, 'Out for delivery', `Your item for ${booking.bookingId} is out for delivery. Your delivery OTP is ${booking.deliveryOtp} — share it with the rider once you receive the item.`);
    res.json({ success: true, message: 'Marked out for delivery.', booking: await staffView(booking) });
  } catch (error) {
    next(error);
  }
};

// POST /api/repair/captain/jobs/:id/verify-delivery-otp   body: { otp, paymentMethod: 'CASH' | 'ONLINE' }
export const verifyDeliveryOtp = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const booking = await findMyJob(req);
    if (!booking || !isMyDelivery(booking, captainId)) {
      return res.status(404).json({ success: false, message: 'Repair job not found.' });
    }
    if (booking.status !== 'OUT_FOR_DELIVERY') {
      return wrongStage(res, 'Collect the item from the repair center first.');
    }
    if (String(req.body.otp || '').trim() !== booking.deliveryOtp) {
      return res.status(400).json({ success: false, message: 'Invalid delivery OTP. Please ask the customer.' });
    }

    const method = String(req.body.paymentMethod || 'CASH').toUpperCase() === 'ONLINE' ? 'ONLINE' : 'CASH';
    const amount = Number(booking.amountDue || 0);

    booking.deliveryOtpVerified = true;
    booking.deliveredAt = new Date();
    if (amount > 0) {
      await RepairPayment.create({
        booking: booking._id,
        bookingId: booking.bookingId,
        user: booking.user,
        amount,
        kind: booking.quotation.status === 'Approved' ? 'REPAIR_BILL' : 'DIAGNOSIS_FEE',
        method,
        status: 'COLLECTED',
        collectedBy: captainId,
        note: 'Collected at delivery',
      });
      booking.amountPaid = amount;
      booking.paymentMethod = method;
    }
    booking.paymentStatus = 'Paid';
    pushHistory(booking, 'DELIVERED', { note: 'Delivered and confirmed with customer OTP', byRole: 'captain', by: captainId });
    await booking.save();
    try {
      await creditRepairLeg(booking, 'delivery');
      if (amount > 0 && method === 'CASH') await recordRepairCashCollected(captainId, amount);
    } catch (e) { console.warn('[RepairEarnings] delivery credit failed:', e.message); }
    notifyCustomer(booking, 'Delivered', `Your item for ${booking.bookingId} has been delivered. Thank you!`);
    res.json({ success: true, message: 'Delivery confirmed.', booking: sanitizeForStaff(booking) });
  } catch (error) {
    next(error);
  }
};
