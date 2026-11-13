import mongoose from 'mongoose';
import RepairBooking from '../models/RepairBooking.model.js';
import RepairTechnician from '../models/RepairTechnician.model.js';
import { generateToken } from '../utils/generateToken.js';
import { pushHistory, sanitizeForStaff, notifyCustomer } from '../utils/repairHelpers.js';

const cleanPhone = (value) => String(value || '').replace(/\D/g, '').slice(-10);

// POST /api/repair/technician/login   body: { phone, password }
export const technicianLogin = async (req, res, next) => {
  try {
    const phone = cleanPhone(req.body.phone);
    const password = String(req.body.password || '');
    if (phone.length !== 10 || !password) {
      return res.status(400).json({ success: false, message: 'Enter your 10-digit mobile number and password.' });
    }
    const tech = await RepairTechnician.findOne({ phone }).select('+password').populate('repairCenter', 'name address city');
    if (!tech || !(await tech.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid mobile number or password.' });
    }
    if (!tech.active) {
      return res.status(403).json({ success: false, message: 'Your technician account is inactive. Contact admin.' });
    }
    const token = generateToken({ id: tech._id, phone: tech.phone, role: 'technician' });
    const technician = tech.toObject();
    delete technician.password;
    res.json({ success: true, token, technician });
  } catch (error) {
    next(error);
  }
};

// GET /api/repair/technician/me
export const getTechnicianProfile = async (req, res, next) => {
  try {
    const tech = await RepairTechnician.findById(req.user.id).populate('repairCenter', 'name address city');
    if (!tech) return res.status(404).json({ success: false, message: 'Technician not found.' });
    res.json({ success: true, technician: tech });
  } catch (error) {
    next(error);
  }
};

const TECH_ACTIVE = ['DIAGNOSING', 'QUOTATION_SENT', 'QUOTATION_APPROVED', 'IN_REPAIR'];
const TECH_DONE = ['REPAIR_COMPLETED', 'DELIVERY_ASSIGNED', 'DELIVERY_ACCEPTED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'QUOTATION_REJECTED'];

// GET /api/repair/technician/jobs?tab=active|completed
export const getTechnicianJobs = async (req, res, next) => {
  try {
    const tab = req.query.tab === 'completed' ? 'completed' : 'active';
    const bookings = await RepairBooking.find({
      technician: req.user.id,
      status: { $in: tab === 'active' ? TECH_ACTIVE : TECH_DONE },
    })
      .select('-statusHistory')
      .populate('repairCenter', 'name city')
      .sort({ updatedAt: -1 })
      .limit(100);
    res.json({ success: true, bookings: bookings.map(sanitizeForStaff) });
  } catch (error) {
    next(error);
  }
};

const findMyJob = async (req) => {
  const { id } = req.params;
  const idQuery = mongoose.Types.ObjectId.isValid(id) ? { $or: [{ _id: id }, { bookingId: id }] } : { bookingId: id };
  return RepairBooking.findOne({ ...idQuery, technician: req.user.id }).populate('repairCenter', 'name address city');
};

// GET /api/repair/technician/jobs/:id
export const getTechnicianJob = async (req, res, next) => {
  try {
    const booking = await findMyJob(req);
    if (!booking) return res.status(404).json({ success: false, message: 'Repair job not found.' });
    res.json({ success: true, booking: sanitizeForStaff(booking) });
  } catch (error) {
    next(error);
  }
};

// PUT /api/repair/technician/jobs/:id/quotation
// body: { findings, photos[], items: [{label, amount}], estimatedDays, notes }
export const submitDiagnosisAndQuotation = async (req, res, next) => {
  try {
    const booking = await findMyJob(req);
    if (!booking) return res.status(404).json({ success: false, message: 'Repair job not found.' });
    if (booking.status !== 'DIAGNOSING') {
      return res.status(400).json({ success: false, message: 'Diagnosis can only be submitted while the item is being diagnosed.' });
    }

    const findings = String(req.body.findings || '').trim();
    if (!findings) {
      return res.status(400).json({ success: false, message: 'Please enter your diagnosis findings.' });
    }
    const items = (Array.isArray(req.body.items) ? req.body.items : [])
      .map((i) => ({ label: String(i?.label || '').trim(), amount: Number(i?.amount) }))
      .filter((i) => i.label && Number.isFinite(i.amount) && i.amount >= 0);
    if (items.length === 0) {
      return res.status(400).json({ success: false, message: 'Add at least one quotation line (parts / labour) with an amount.' });
    }
    const total = Math.round(items.reduce((sum, i) => sum + i.amount, 0) * 100) / 100;

    booking.diagnosis = {
      findings,
      photos: (Array.isArray(req.body.photos) ? req.body.photos : []).filter((p) => typeof p === 'string' && p).slice(0, 6),
      diagnosedAt: new Date(),
    };
    booking.quotation = {
      items,
      total,
      estimatedDays: Math.max(0, Number(req.body.estimatedDays) || 0),
      notes: String(req.body.notes || '').slice(0, 500),
      status: 'Sent',
      sentAt: new Date(),
      respondedAt: null,
      customerNote: '',
    };
    pushHistory(booking, 'QUOTATION_SENT', { note: `Quotation of ₹${total} sent`, byRole: 'technician', by: req.user.id });
    await booking.save();
    notifyCustomer(booking, 'Quotation ready', `Repair quotation of ₹${total} is ready for ${booking.bookingId}. Please review and approve.`);
    res.json({ success: true, message: 'Quotation sent to customer.', booking: sanitizeForStaff(booking) });
  } catch (error) {
    next(error);
  }
};

// PUT /api/repair/technician/jobs/:id/start-repair
export const startRepair = async (req, res, next) => {
  try {
    const booking = await findMyJob(req);
    if (!booking) return res.status(404).json({ success: false, message: 'Repair job not found.' });
    if (booking.status !== 'QUOTATION_APPROVED') {
      return res.status(400).json({ success: false, message: 'Repair can start only after the customer approves the quotation.' });
    }
    pushHistory(booking, 'IN_REPAIR', { note: 'Repair started', byRole: 'technician', by: req.user.id });
    await booking.save();
    notifyCustomer(booking, 'Repair started', `Repair has started for ${booking.bookingId}.`);
    res.json({ success: true, message: 'Repair started.', booking: sanitizeForStaff(booking) });
  } catch (error) {
    next(error);
  }
};

// PUT /api/repair/technician/jobs/:id/complete   body: { repairNotes }
export const completeRepair = async (req, res, next) => {
  try {
    const booking = await findMyJob(req);
    if (!booking) return res.status(404).json({ success: false, message: 'Repair job not found.' });
    if (booking.status !== 'IN_REPAIR') {
      return res.status(400).json({ success: false, message: 'Start the repair before completing it.' });
    }
    booking.repairNotes = String(req.body.repairNotes || '').slice(0, 1000);
    booking.repairCompletedAt = new Date();
    pushHistory(booking, 'REPAIR_COMPLETED', { note: 'Repair completed', byRole: 'technician', by: req.user.id });
    await booking.save();
    notifyCustomer(booking, 'Repair completed', `Repair is complete for ${booking.bookingId}. Delivery will be arranged shortly.`);
    res.json({ success: true, message: 'Repair marked as completed.', booking: sanitizeForStaff(booking) });
  } catch (error) {
    next(error);
  }
};
