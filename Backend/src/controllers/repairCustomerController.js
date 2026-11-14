import mongoose from 'mongoose';
import RepairBooking from '../models/RepairBooking.model.js';
import RepairCategory from '../models/RepairCategory.model.js';
import RepairSetting, { DEFAULT_REPAIR_HERO } from '../models/RepairSetting.model.js';
import {
  DEFAULT_REPAIR_CATEGORIES,
  CUSTOMER_CANCELLABLE,
  generateRepairBookingId,
  generateRepairOtp,
  pushHistory,
  sanitizeForCustomer,
  notifyCustomer,
  notifyAssignedCaptainsCancelled,
} from '../utils/repairHelpers.js';

// Seed the default catalog exactly once. Afterwards admin deletions stay deleted.
const ensureCatalogSeeded = async () => {
  const setting = await RepairSetting.findOneAndUpdate(
    { key: 'default' },
    { $setOnInsert: { key: 'default', catalogSeeded: false } },
    { upsert: true, new: true }
  );
  if (setting.catalogSeeded) return;
  const claimed = await RepairSetting.findOneAndUpdate(
    { key: 'default', catalogSeeded: false },
    { $set: { catalogSeeded: true } }
  );
  if (!claimed) return; // another request is seeding
  if ((await RepairCategory.estimatedDocumentCount()) === 0) {
    await RepairCategory.insertMany(DEFAULT_REPAIR_CATEGORIES);
  }
};

// GET /api/repair/catalog (public)
export const getCatalog = async (req, res, next) => {
  try {
    await ensureCatalogSeeded();
    const [categories, setting] = await Promise.all([
      RepairCategory.find({ active: true }).sort({ priority: 1, name: 1 }).lean(),
      RepairSetting.findOne({ key: 'default' }), // hydrated doc, so hero defaults apply to old records
    ]);
    const hero = setting?.hero ? setting.hero.toObject() : { ...DEFAULT_REPAIR_HERO };
    res.json({ success: true, categories, content: { hero } });
  } catch (error) {
    next(error);
  }
};

const isValidSlotDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));

// POST /api/repair/bookings
export const createBooking = async (req, res, next) => {
  try {
    const {
      categoryId, brand, model, problem, subProblem, description,
      photos, pickupAddress, pickupDate, pickupTimeSlot,
    } = req.body;

    if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ success: false, message: 'Please select a repair category.' });
    }
    const category = await RepairCategory.findOne({ _id: categoryId, active: true }).lean();
    if (!category) {
      return res.status(404).json({ success: false, message: 'Repair category not found.' });
    }
    if (!String(brand || '').trim() || !String(model || '').trim()) {
      return res.status(400).json({ success: false, message: 'Please select brand and model.' });
    }
    if (!String(problem || '').trim()) {
      return res.status(400).json({ success: false, message: 'Please select the problem.' });
    }
    // If the chosen problem has sub-problems, the customer must have picked one of them
    const chosenProblem = (category.problems || []).find((p) => p.name === String(problem).trim());
    const subOptions = chosenProblem?.subProblems || [];
    let chosenSub = '';
    if (subOptions.length > 0) {
      chosenSub = String(subProblem || '').trim();
      if (!chosenSub) {
        return res.status(400).json({ success: false, message: 'Please select the issue detail for this problem.' });
      }
      if (!subOptions.some((s) => s.name === chosenSub)) {
        return res.status(400).json({ success: false, message: 'The selected issue detail is not available for this problem.' });
      }
    }
    if (!String(description || '').trim()) {
      return res.status(400).json({ success: false, message: 'Please describe the issue.' });
    }
    if (!pickupAddress || !String(pickupAddress.addressLine1 || '').trim() || !String(pickupAddress.pincode || '').trim()) {
      return res.status(400).json({ success: false, message: 'Please select a pickup address.' });
    }
    if (!isValidSlotDate(pickupDate) || !String(pickupTimeSlot || '').trim()) {
      return res.status(400).json({ success: false, message: 'Please select pickup date and time.' });
    }
    const today = new Date().toISOString().slice(0, 10);
    if (pickupDate < today) {
      return res.status(400).json({ success: false, message: 'Pickup date cannot be in the past.' });
    }

    const cleanPhotos = (Array.isArray(photos) ? photos : [])
      .filter((p) => typeof p === 'string' && p.trim())
      .slice(0, 6);

    const booking = new RepairBooking({
      bookingId: generateRepairBookingId(),
      user: req.user.id,
      category: category._id,
      categoryName: category.name,
      brand: String(brand).trim(),
      model: String(model).trim(),
      problem: String(problem).trim(),
      subProblem: chosenSub,
      description: String(description).trim(),
      photos: cleanPhotos,
      pickupAddress: {
        fullName: pickupAddress.fullName || '',
        phone: pickupAddress.phone || '',
        addressLine1: pickupAddress.addressLine1 || '',
        addressLine2: pickupAddress.addressLine2 || '',
        landmark: pickupAddress.landmark || '',
        city: pickupAddress.city || '',
        state: pickupAddress.state || '',
        pincode: pickupAddress.pincode || '',
        lat: Number.isFinite(Number(pickupAddress.lat)) ? Number(pickupAddress.lat) : null,
        lng: Number.isFinite(Number(pickupAddress.lng)) ? Number(pickupAddress.lng) : null,
      },
      pickupSlot: { date: pickupDate, timeSlot: String(pickupTimeSlot).trim() },
      pickupOtp: generateRepairOtp(),
      deliveryOtp: generateRepairOtp(),
      centerOtp: generateRepairOtp(),
      diagnosisFee: category.diagnosisFee || 0,
    });
    pushHistory(booking, 'REQUESTED', { note: 'Repair booked by customer', byRole: 'customer', by: req.user.id });
    await booking.save();

    res.status(201).json({ success: true, message: 'Repair booking confirmed.', booking: sanitizeForCustomer(booking) });
  } catch (error) {
    next(error);
  }
};

// GET /api/repair/bookings
export const getMyBookings = async (req, res, next) => {
  try {
    const bookings = await RepairBooking.find({ user: req.user.id })
      .select('-statusHistory -photos -diagnosis.photos')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ success: true, bookings: bookings.map(sanitizeForCustomer) });
  } catch (error) {
    next(error);
  }
};

const findOwnBooking = async (req) => {
  const { id } = req.params;
  const query = mongoose.Types.ObjectId.isValid(id)
    ? { $or: [{ _id: id }, { bookingId: id }], user: req.user.id }
    : { bookingId: id, user: req.user.id };
  return RepairBooking.findOne(query)
    .populate('pickupCaptainId', 'name phone')
    .populate('deliveryCaptainId', 'name phone')
    .populate('repairCenter', 'name address city phone')
    .populate('technician', 'name');
};

// GET /api/repair/bookings/:id
export const getMyBooking = async (req, res, next) => {
  try {
    const booking = await findOwnBooking(req);
    if (!booking) return res.status(404).json({ success: false, message: 'Repair booking not found.' });
    res.json({ success: true, booking: sanitizeForCustomer(booking) });
  } catch (error) {
    next(error);
  }
};

// PUT /api/repair/bookings/:id/quotation   body: { action: 'approve' | 'reject', note }
export const respondToQuotation = async (req, res, next) => {
  try {
    const action = String(req.body.action || '').toLowerCase();
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Action must be approve or reject.' });
    }
    const booking = await findOwnBooking(req);
    if (!booking) return res.status(404).json({ success: false, message: 'Repair booking not found.' });
    if (booking.status !== 'QUOTATION_SENT' || booking.quotation.status !== 'Sent') {
      return res.status(400).json({ success: false, message: 'There is no quotation waiting for your approval.' });
    }
    if (booking.decisionMode === 'phone') {
      return res.status(400).json({ success: false, message: 'Our team will confirm this with you by phone.' });
    }

    booking.quotation.respondedAt = new Date();
    booking.quotation.customerNote = String(req.body.note || '').slice(0, 500);

    if (action === 'approve') {
      booking.quotation.status = 'Approved';
      booking.amountDue = booking.quotation.total; // diagnosis fee is included in an approved repair
      pushHistory(booking, 'QUOTATION_APPROVED', { note: 'Customer approved the quotation', byRole: 'customer', by: req.user.id });
    } else {
      booking.quotation.status = 'Rejected';
      booking.amountDue = booking.diagnosisFee; // only the diagnosis fee is payable
      pushHistory(booking, 'QUOTATION_REJECTED', {
        note: booking.quotation.customerNote || 'Customer rejected the quotation',
        byRole: 'customer',
        by: req.user.id,
      });
    }
    await booking.save();
    notifyCustomer(booking, 'Repair update', action === 'approve'
      ? `Quotation approved for ${booking.bookingId}. Repair will begin shortly.`
      : `Quotation rejected for ${booking.bookingId}. Your item will be returned.`);

    res.json({ success: true, message: action === 'approve' ? 'Quotation approved.' : 'Quotation rejected.', booking: sanitizeForCustomer(booking) });
  } catch (error) {
    next(error);
  }
};

// PUT /api/repair/bookings/:id/cancel
export const cancelMyBooking = async (req, res, next) => {
  try {
    const booking = await findOwnBooking(req);
    if (!booking) return res.status(404).json({ success: false, message: 'Repair booking not found.' });
    if (!CUSTOMER_CANCELLABLE.includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'This booking can no longer be cancelled.' });
    }
    booking.cancelReason = String(req.body.reason || 'Cancelled by customer').slice(0, 300);
    booking.cancelledBy = 'customer';
    notifyAssignedCaptainsCancelled(booking, 'The customer cancelled the repair.'); // before rider status is cleared
    booking.pickupCaptainStatus = '';
    pushHistory(booking, 'CANCELLED', { note: booking.cancelReason, byRole: 'customer', by: req.user.id });
    await booking.save();
    res.json({ success: true, message: 'Repair booking cancelled.', booking: sanitizeForCustomer(booking) });
  } catch (error) {
    next(error);
  }
};
