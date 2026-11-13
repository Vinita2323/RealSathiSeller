import mongoose from 'mongoose';
import RepairBooking from '../models/RepairBooking.model.js';
import RepairCategory from '../models/RepairCategory.model.js';
import RepairCenter from '../models/RepairCenter.model.js';
import RepairTechnician from '../models/RepairTechnician.model.js';
import RepairPayment from '../models/RepairPayment.model.js';
import RepairSetting, { DEFAULT_REPAIR_HERO } from '../models/RepairSetting.model.js';
import Captain from '../models/Captain.model.js';
import RepairDriver from '../models/RepairDriver.model.js';
import {
  ADMIN_CANCELLABLE,
  pushHistory,
  notifyCaptain,
  notifyCustomer,
} from '../utils/repairHelpers.js';

const isId = (v) => mongoose.Types.ObjectId.isValid(String(v || ''));
const adminId = (req) => req.user?.id || '';

const bookingQuery = (id) => (isId(id) ? { $or: [{ _id: id }, { bookingId: id }] } : { bookingId: id });

const loadBooking = (id) =>
  RepairBooking.findOne(bookingQuery(id))
    .populate('user', 'name phone')
    .populate('pickupCaptainId', 'name phone')
    .populate('deliveryCaptainId', 'name phone')
    .populate('repairCenter', 'name address city phone')
    .populate('technician', 'name phone');

// ── Bookings ──────────────────────────────────────────────────────────────────────────
// GET /api/repair/admin/bookings?status=&q=
export const listBookings = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.status && req.query.status !== 'ALL') query.status = String(req.query.status);
    const q = String(req.query.q || '').trim();
    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { bookingId: new RegExp(safe, 'i') },
        { categoryName: new RegExp(safe, 'i') },
        { brand: new RegExp(safe, 'i') },
        { model: new RegExp(safe, 'i') },
        { 'pickupAddress.phone': new RegExp(safe, 'i') },
        { 'pickupAddress.fullName': new RegExp(safe, 'i') },
      ];
    }
    const bookings = await RepairBooking.find(query)
      .select('-photos -statusHistory')
      .populate('pickupCaptainId', 'name phone')
      .populate('deliveryCaptainId', 'name phone')
      .populate('repairCenter', 'name')
      .populate('technician', 'name')
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();
    res.json({ success: true, bookings });
  } catch (error) {
    next(error);
  }
};

// GET /api/repair/admin/bookings/:id
export const getBooking = async (req, res, next) => {
  try {
    const booking = await loadBooking(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Repair booking not found.' });
    const payments = await RepairPayment.find({ booking: booking._id }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, booking, payments });
  } catch (error) {
    next(error);
  }
};

// GET /api/repair/admin/new-requests
// Lightweight feed polled by the admin panel to alert on new repair requests (status REQUESTED).
export const getNewRequests = async (req, res, next) => {
  try {
    const [requests, count] = await Promise.all([
      RepairBooking.find({ status: 'REQUESTED' })
        .select('bookingId categoryName brand model problem pickupAddress.fullName pickupAddress.phone pickupAddress.city pickupSlot createdAt')
        .sort({ createdAt: -1 })
        .limit(15)
        .lean(),
      RepairBooking.countDocuments({ status: 'REQUESTED' }),
    ]);
    res.json({ success: true, count, requests });
  } catch (error) {
    next(error);
  }
};

// GET /api/repair/admin/riders  – approved captains that can be given repair pickups / deliveries
export const listRiders = async (req, res, next) => {
  try {
    const [captains, links] = await Promise.all([
      Captain.find({
        $and: [
          { $or: [{ status: 'approved' }, { accountStatus: 'approved' }] },
          { status: { $nin: ['rejected', 'suspended'] } },
          { accountStatus: { $nin: ['rejected', 'suspended'] } },
        ],
      })
        .select('name phone city isOnline vehicleType')
        .sort({ isOnline: -1, name: 1 })
        .lean(),
      RepairDriver.find().select('captain').lean(),
    ]);
    const driverIds = new Set(links.map((l) => String(l.captain)));
    // Dedicated repair drivers first, then other approved captains
    const riders = captains
      .map((c) => ({ ...c, isRepairDriver: driverIds.has(String(c._id)) }))
      .sort((a, b) => Number(b.isRepairDriver) - Number(a.isRepairDriver));
    res.json({ success: true, riders });
  } catch (error) {
    next(error);
  }
};

const assignRider = (kind) => async (req, res, next) => {
  try {
    const { captainId } = req.body;
    if (!isId(captainId)) return res.status(400).json({ success: false, message: 'Select a rider.' });
    const captain = await Captain.findById(captainId).select('name phone status accountStatus');
    if (!captain || [captain.status, captain.accountStatus].some((s) => ['rejected', 'suspended'].includes(s))) {
      return res.status(404).json({ success: false, message: 'Rider not available.' });
    }
    if (captain.status !== 'approved' && captain.accountStatus !== 'approved') {
      return res.status(400).json({ success: false, message: 'Only approved riders can be assigned.' });
    }

    const booking = await loadBooking(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Repair booking not found.' });

    if (kind === 'pickup') {
      if (!['REQUESTED', 'PICKUP_ASSIGNED'].includes(booking.status)) {
        return res.status(400).json({ success: false, message: 'Pickup rider can only be assigned before pickup.' });
      }
      booking.pickupCaptainId = captain._id;
      booking.pickupCaptainStatus = 'Assigned';
      pushHistory(booking, 'PICKUP_ASSIGNED', { note: `Pickup rider: ${captain.name || captain.phone}`, byRole: 'admin', by: adminId(req) });
      await booking.save();
      notifyCaptain(captain._id, booking, '🛠 New Repair Pickup', `Pickup ${booking.bookingId} — ${booking.categoryName} from ${booking.pickupAddress.city || 'customer'} on ${booking.pickupSlot.date}, ${booking.pickupSlot.timeSlot}.`);
      notifyCustomer(booking, 'Pickup rider assigned', `A rider has been assigned to pick up your item for ${booking.bookingId}. Your pickup OTP is ${booking.pickupOtp} — share it only with the rider at pickup.`);
    } else {
      if (!['REPAIR_COMPLETED', 'QUOTATION_REJECTED', 'DELIVERY_ASSIGNED'].includes(booking.status)) {
        return res.status(400).json({ success: false, message: 'Delivery rider can be assigned once repair is completed (or the quotation was rejected).' });
      }
      if (booking.status !== 'DELIVERY_ASSIGNED') booking.preDeliveryStatus = booking.status;
      booking.deliveryCaptainId = captain._id;
      booking.deliveryCaptainStatus = 'Assigned';
      pushHistory(booking, 'DELIVERY_ASSIGNED', { note: `Delivery rider: ${captain.name || captain.phone}`, byRole: 'admin', by: adminId(req) });
      await booking.save();
      notifyCaptain(captain._id, booking, '🛠 New Repair Delivery', `Deliver ${booking.bookingId} (${booking.categoryName}) from the repair center to ${booking.pickupAddress.city || 'customer'}.`);
    }

    res.json({ success: true, message: 'Rider assigned.', booking: await loadBooking(booking._id) });
  } catch (error) {
    next(error);
  }
};
export const assignPickupRider = assignRider('pickup');
export const assignDeliveryRider = assignRider('delivery');

// PUT /api/repair/admin/bookings/:id/assign-center
export const assignCenter = async (req, res, next) => {
  try {
    if (!isId(req.body.centerId)) return res.status(400).json({ success: false, message: 'Select a repair center.' });
    const center = await RepairCenter.findOne({ _id: req.body.centerId, active: true });
    if (!center) return res.status(404).json({ success: false, message: 'Repair center not found.' });
    const booking = await loadBooking(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Repair booking not found.' });
    if (['DELIVERED', 'CANCELLED'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'This booking is already closed.' });
    }
    booking.repairCenter = center._id;
    booking.statusHistory.push({ status: booking.status, note: `Repair center: ${center.name}`, byRole: 'admin', by: adminId(req), at: new Date() });
    await booking.save();
    res.json({ success: true, message: 'Repair center assigned.', booking: await loadBooking(booking._id) });
  } catch (error) {
    next(error);
  }
};

// PUT /api/repair/admin/bookings/:id/assign-technician
export const assignTechnician = async (req, res, next) => {
  try {
    if (!isId(req.body.technicianId)) return res.status(400).json({ success: false, message: 'Select a technician.' });
    const tech = await RepairTechnician.findOne({ _id: req.body.technicianId, active: true });
    if (!tech) return res.status(404).json({ success: false, message: 'Technician not found.' });
    const booking = await loadBooking(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Repair booking not found.' });
    if (!['AT_REPAIR_CENTER', 'DIAGNOSING'].includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'A technician can be assigned once the item is at the repair center and before the quotation is sent.' });
    }
    booking.technician = tech._id;
    pushHistory(booking, 'DIAGNOSING', { note: `Technician: ${tech.name}`, byRole: 'admin', by: adminId(req) });
    await booking.save();
    notifyCustomer(booking, 'Diagnosis started', `A technician has started diagnosing your item for ${booking.bookingId}.`);
    res.json({ success: true, message: 'Technician assigned.', booking: await loadBooking(booking._id) });
  } catch (error) {
    next(error);
  }
};

// PUT /api/repair/admin/bookings/:id/cancel
export const cancelBooking = async (req, res, next) => {
  try {
    const booking = await loadBooking(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Repair booking not found.' });
    if (!ADMIN_CANCELLABLE.includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'This booking can no longer be cancelled.' });
    }
    booking.cancelReason = String(req.body.reason || 'Cancelled by admin').slice(0, 300);
    booking.cancelledBy = 'admin';
    pushHistory(booking, 'CANCELLED', { note: booking.cancelReason, byRole: 'admin', by: adminId(req) });
    await booking.save();
    notifyCustomer(booking, 'Repair cancelled', `Repair ${booking.bookingId} was cancelled. ${booking.cancelReason}`);
    res.json({ success: true, message: 'Booking cancelled.', booking: await loadBooking(booking._id) });
  } catch (error) {
    next(error);
  }
};

// ── Repair drivers (captain accounts created by admin for repair pickups / deliveries) ─────────
const ACTIVE_PICKUP = ['PICKUP_ASSIGNED', 'PICKUP_ACCEPTED', 'PICKUP_STARTED', 'REACHED_CUSTOMER', 'PICKED_UP'];
const ACTIVE_DELIVERY = ['DELIVERY_ASSIGNED', 'DELIVERY_ACCEPTED', 'OUT_FOR_DELIVERY'];

const driverStats = async (captainId) => {
  const [pickups, deliveries, done] = await Promise.all([
    RepairBooking.countDocuments({ pickupCaptainId: captainId, status: { $in: ACTIVE_PICKUP } }),
    RepairBooking.countDocuments({ deliveryCaptainId: captainId, status: { $in: ACTIVE_DELIVERY } }),
    RepairBooking.countDocuments({
      $or: [
        { pickupCaptainId: captainId, pickedUpAt: { $ne: null } },
        { deliveryCaptainId: captainId, status: 'DELIVERED' },
      ],
    }),
  ]);
  return { activeJobs: pickups + deliveries, completedJobs: done };
};

const shapeDriver = async (link) => {
  const c = link.captain;
  if (!c) return null;
  const suspended = [c.status, c.accountStatus].some((s) => ['suspended', 'rejected'].includes(s));
  return {
    _id: link._id,
    captainId: c._id,
    name: c.name,
    phone: c.phone,
    city: c.city || '',
    vehicleType: c.vehicleType || '',
    drivingLicenseNumber: c.drivingLicenseNumber || '',
    isOnline: Boolean(c.isOnline),
    active: !suspended,
    repairOnly: link.repairOnly,
    createdAt: link.createdAt,
    ...(await driverStats(c._id)),
  };
};

const cleanDriverPhone = (v) => String(v || '').replace(/\D/g, '').slice(-10);

// GET /api/repair/admin/drivers
export const listDrivers = async (req, res, next) => {
  try {
    const links = await RepairDriver.find()
      .populate('captain', 'name phone city vehicleType drivingLicenseNumber isOnline status accountStatus')
      .sort({ createdAt: -1 });
    const drivers = (await Promise.all(links.map(shapeDriver))).filter(Boolean);
    res.json({ success: true, drivers });
  } catch (error) {
    next(error);
  }
};

// POST /api/repair/admin/drivers   body: { name, phone, password, city, vehicleType, drivingLicenseNumber, repairOnly }
export const createDriver = async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim();
    const phone = cleanDriverPhone(req.body.phone);
    const password = String(req.body.password || '');
    if (!name) return res.status(400).json({ success: false, message: 'Driver name is required.' });
    if (phone.length !== 10) return res.status(400).json({ success: false, message: 'Enter a valid 10-digit mobile number.' });
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });

    const exists = await Captain.findOne({
      $or: [{ phone }, { phone: `+91${phone}` }, { phone: `+91 ${phone}` }, { phone: new RegExp(`${phone}$`) }],
    }).select('_id');
    if (exists) {
      return res.status(400).json({ success: false, message: 'A captain / driver with this mobile number already exists.' });
    }

    const captain = await Captain.create({
      name,
      phone,
      password, // hashed by the Captain model's pre-save hook
      city: String(req.body.city || '').trim(),
      vehicleType: String(req.body.vehicleType || 'Two Wheeler').trim(),
      drivingLicenseNumber: String(req.body.drivingLicenseNumber || '').trim(),
      isVerified: true,
      accountStatus: 'approved',
      status: 'approved',
    });
    const link = await RepairDriver.create({
      captain: captain._id,
      repairOnly: req.body.repairOnly !== false,
      createdBy: adminId(req),
    });
    await link.populate('captain', 'name phone city vehicleType drivingLicenseNumber isOnline status accountStatus');
    res.status(201).json({ success: true, message: 'Driver added.', driver: await shapeDriver(link) });
  } catch (error) {
    next(error);
  }
};

// PUT /api/repair/admin/drivers/:id   (id = RepairDriver id)
export const updateDriver = async (req, res, next) => {
  try {
    const link = await RepairDriver.findById(req.params.id);
    if (!link) return res.status(404).json({ success: false, message: 'Driver not found.' });
    const captain = await Captain.findById(link.captain);
    if (!captain) return res.status(404).json({ success: false, message: 'Driver account not found.' });

    const { name, city, vehicleType, drivingLicenseNumber, password, active, repairOnly } = req.body;
    if (name !== undefined) {
      if (!String(name).trim()) return res.status(400).json({ success: false, message: 'Driver name is required.' });
      captain.name = String(name).trim();
    }
    if (city !== undefined) captain.city = String(city).trim();
    if (vehicleType !== undefined) captain.vehicleType = String(vehicleType).trim();
    if (drivingLicenseNumber !== undefined) captain.drivingLicenseNumber = String(drivingLicenseNumber).trim();
    if (password) {
      if (String(password).length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
      captain.password = String(password);
    }
    if (active !== undefined) {
      if (!active) {
        const busy = await RepairBooking.exists({
          $or: [
            { pickupCaptainId: captain._id, status: { $in: ACTIVE_PICKUP } },
            { deliveryCaptainId: captain._id, status: { $in: ACTIVE_DELIVERY } },
          ],
        });
        if (busy) return res.status(400).json({ success: false, message: 'Driver has active repair jobs. Re-assign them before deactivating.' });
        captain.accountStatus = 'suspended';
        captain.status = 'suspended';
        captain.isOnline = false;
      } else {
        captain.accountStatus = 'approved';
        captain.status = 'approved';
      }
    }
    await captain.save();
    if (repairOnly !== undefined) {
      link.repairOnly = Boolean(repairOnly);
      await link.save();
    }
    await link.populate('captain', 'name phone city vehicleType drivingLicenseNumber isOnline status accountStatus');
    res.json({ success: true, driver: await shapeDriver(link) });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/repair/admin/drivers/:id
export const deleteDriver = async (req, res, next) => {
  try {
    const link = await RepairDriver.findById(req.params.id);
    if (!link) return res.status(404).json({ success: false, message: 'Driver not found.' });
    const used = await RepairBooking.exists({ $or: [{ pickupCaptainId: link.captain }, { deliveryCaptainId: link.captain }] });
    if (used) {
      return res.status(400).json({ success: false, message: 'This driver has repair history and cannot be deleted. Deactivate the driver instead.' });
    }
    await RepairDriver.findByIdAndDelete(link._id);
    // Remove the underlying login only if it was created purely for repair and has no money / history attached
    const captain = await Captain.findById(link.captain).select('walletBalance cashCollected outstandingCash');
    const hasMoney = captain && (Number(captain.walletBalance) || Number(captain.cashCollected) || Number(captain.outstandingCash));
    if (captain && link.repairOnly && !hasMoney) await Captain.findByIdAndDelete(captain._id);
    res.json({ success: true, message: 'Driver deleted.' });
  } catch (error) {
    next(error);
  }
};

// ── Technicians ───────────────────────────────────────────────────────────────────────
export const listTechnicians = async (req, res, next) => {
  try {
    const technicians = await RepairTechnician.find().populate('repairCenter', 'name').sort({ createdAt: -1 }).lean();
    res.json({ success: true, technicians });
  } catch (error) {
    next(error);
  }
};

export const createTechnician = async (req, res, next) => {
  try {
    const phone = String(req.body.phone || '').replace(/\D/g, '').slice(-10);
    const name = String(req.body.name || '').trim();
    const password = String(req.body.password || '');
    if (!name || phone.length !== 10) return res.status(400).json({ success: false, message: 'Name and a valid 10-digit phone are required.' });
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    if (await RepairTechnician.exists({ phone })) {
      return res.status(400).json({ success: false, message: 'A technician with this phone already exists.' });
    }
    const tech = await RepairTechnician.create({
      name,
      phone,
      password,
      email: req.body.email || '',
      skills: Array.isArray(req.body.skills) ? req.body.skills.filter(Boolean) : [],
      repairCenter: isId(req.body.repairCenter) ? req.body.repairCenter : null,
    });
    const out = tech.toObject();
    delete out.password;
    res.status(201).json({ success: true, technician: out });
  } catch (error) {
    next(error);
  }
};

export const updateTechnician = async (req, res, next) => {
  try {
    const tech = await RepairTechnician.findById(req.params.id).select('+password');
    if (!tech) return res.status(404).json({ success: false, message: 'Technician not found.' });
    const { name, email, skills, active, repairCenter, password } = req.body;
    if (name !== undefined) tech.name = String(name).trim() || tech.name;
    if (email !== undefined) tech.email = email;
    if (Array.isArray(skills)) tech.skills = skills.filter(Boolean);
    if (active !== undefined) tech.active = Boolean(active);
    if (repairCenter !== undefined) tech.repairCenter = isId(repairCenter) ? repairCenter : null;
    if (password) {
      if (String(password).length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
      tech.password = password;
    }
    await tech.save();
    const out = tech.toObject();
    delete out.password;
    res.json({ success: true, technician: out });
  } catch (error) {
    next(error);
  }
};

export const deleteTechnician = async (req, res, next) => {
  try {
    const inUse = await RepairBooking.exists({
      technician: req.params.id,
      status: { $in: ['DIAGNOSING', 'QUOTATION_SENT', 'QUOTATION_APPROVED', 'IN_REPAIR'] },
    });
    if (inUse) return res.status(400).json({ success: false, message: 'Technician has active repair jobs. Deactivate instead.' });
    await RepairTechnician.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Technician deleted.' });
  } catch (error) {
    next(error);
  }
};

// ── Repair centers ───────────────────────────────────────────────────────────────────
export const listCenters = async (req, res, next) => {
  try {
    res.json({ success: true, centers: await RepairCenter.find().sort({ createdAt: -1 }).lean() });
  } catch (error) {
    next(error);
  }
};

export const createCenter = async (req, res, next) => {
  try {
    const { name, address } = req.body;
    if (!String(name || '').trim() || !String(address || '').trim()) {
      return res.status(400).json({ success: false, message: 'Center name and address are required.' });
    }
    const center = await RepairCenter.create({
      name: String(name).trim(),
      address: String(address).trim(),
      phone: req.body.phone || '',
      city: req.body.city || '',
      state: req.body.state || '',
      pincode: req.body.pincode || '',
      lat: Number.isFinite(Number(req.body.lat)) && req.body.lat !== '' ? Number(req.body.lat) : null,
      lng: Number.isFinite(Number(req.body.lng)) && req.body.lng !== '' ? Number(req.body.lng) : null,
    });
    res.status(201).json({ success: true, center });
  } catch (error) {
    next(error);
  }
};

export const updateCenter = async (req, res, next) => {
  try {
    const allowed = ['name', 'address', 'phone', 'city', 'state', 'pincode', 'active'];
    const update = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    const center = await RepairCenter.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!center) return res.status(404).json({ success: false, message: 'Repair center not found.' });
    res.json({ success: true, center });
  } catch (error) {
    next(error);
  }
};

export const deleteCenter = async (req, res, next) => {
  try {
    const inUse = await RepairBooking.exists({
      repairCenter: req.params.id,
      status: { $nin: ['DELIVERED', 'CANCELLED'] },
    });
    if (inUse) return res.status(400).json({ success: false, message: 'Center has active repair bookings. Deactivate instead.' });
    await RepairCenter.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Repair center deleted.' });
  } catch (error) {
    next(error);
  }
};

// ── Catalog / pricing ────────────────────────────────────────────────────────────────
export const listCategories = async (req, res, next) => {
  try {
    res.json({ success: true, categories: await RepairCategory.find().sort({ priority: 1, name: 1 }).lean() });
  } catch (error) {
    next(error);
  }
};

const cleanCategoryPayload = (body) => {
  const out = {};
  if (body.name !== undefined) out.name = String(body.name).trim();
  if (body.icon !== undefined) out.icon = String(body.icon || 'Wrench').slice(0, 40);
  if (body.image !== undefined) out.image = String(body.image || '').trim().slice(0, 500);
  if (body.active !== undefined) out.active = Boolean(body.active);
  if (body.diagnosisFee !== undefined) out.diagnosisFee = Math.max(0, Number(body.diagnosisFee) || 0);
  if (body.priority !== undefined) out.priority = Number(body.priority) || 1;
  if (Array.isArray(body.brands)) {
    out.brands = body.brands
      .map((b) => ({
        name: String(b?.name || '').trim(),
        models: (Array.isArray(b?.models) ? b.models : []).map((m) => String(m).trim()).filter(Boolean),
      }))
      .filter((b) => b.name);
  }
  if (Array.isArray(body.problems)) {
    out.problems = body.problems
      .map((p) => ({
        name: String(p?.name || '').trim(),
        estimateMin: Math.max(0, Number(p?.estimateMin) || 0),
        estimateMax: Math.max(0, Number(p?.estimateMax) || 0),
      }))
      .filter((p) => p.name);
  }
  return out;
};

export const createCategory = async (req, res, next) => {
  try {
    const data = cleanCategoryPayload(req.body);
    if (!data.name) return res.status(400).json({ success: false, message: 'Category name is required.' });
    if (!data.problems || data.problems.length === 0) {
      return res.status(400).json({ success: false, message: 'Add at least one problem customers can select.' });
    }
    if (await RepairCategory.exists({ name: data.name })) {
      return res.status(400).json({ success: false, message: 'A category with this name already exists.' });
    }
    res.status(201).json({ success: true, category: await RepairCategory.create(data) });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const data = cleanCategoryPayload(req.body);
    if (data.name === '') return res.status(400).json({ success: false, message: 'Category name is required.' });
    if (Array.isArray(data.problems) && data.problems.length === 0) {
      return res.status(400).json({ success: false, message: 'Add at least one problem customers can select.' });
    }
    if (data.name && (await RepairCategory.exists({ name: data.name, _id: { $ne: req.params.id } }))) {
      return res.status(400).json({ success: false, message: 'A category with this name already exists.' });
    }
    const category = await RepairCategory.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!category) return res.status(404).json({ success: false, message: 'Category not found.' });
    res.json({ success: true, category });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    await RepairCategory.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Category deleted.' });
  } catch (error) {
    next(error);
  }
};

// ── Page content (hero banner on the customer Repair & Services page) ───────────────────
export const getContent = async (req, res, next) => {
  try {
    const setting = await RepairSetting.findOne({ key: 'default' });
    const hero = setting?.hero ? setting.hero.toObject() : { ...DEFAULT_REPAIR_HERO };
    res.json({ success: true, content: { hero }, defaults: { hero: DEFAULT_REPAIR_HERO } });
  } catch (error) {
    next(error);
  }
};

export const updateContent = async (req, res, next) => {
  try {
    const src = req.body?.hero || {};
    const title = String(src.title ?? '').trim();
    const subtitle = String(src.subtitle ?? '').trim();
    if (!title) return res.status(400).json({ success: false, message: 'Banner title is required.' });
    if (title.length > 80) return res.status(400).json({ success: false, message: 'Title can be at most 80 characters.' });
    if (subtitle.length > 160) return res.status(400).json({ success: false, message: 'Description can be at most 160 characters.' });
    const features = (Array.isArray(src.features) ? src.features : [])
      .map((f) => String(f || '').trim())
      .filter(Boolean)
      .slice(0, 4);
    if (features.some((f) => f.length > 24)) {
      return res.status(400).json({ success: false, message: 'Each highlight can be at most 24 characters.' });
    }

    const setting = await RepairSetting.findOneAndUpdate(
      { key: 'default' },
      { $set: { hero: { enabled: src.enabled !== false, title, subtitle, features } }, $setOnInsert: { key: 'default' } },
      { upsert: true, new: true, runValidators: true }
    );
    res.json({ success: true, message: 'Page content saved.', content: { hero: setting.hero.toObject() } });
  } catch (error) {
    next(error);
  }
};

// ── Reports ──────────────────────────────────────────────────────────────────────────
// GET /api/repair/admin/reports/summary
export const getReportSummary = async (req, res, next) => {
  try {
    const [byStatus, byCategory, revenue, totals] = await Promise.all([
      RepairBooking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      RepairBooking.aggregate([
        { $group: { _id: '$categoryName', count: { $sum: 1 }, delivered: { $sum: { $cond: [{ $eq: ['$status', 'DELIVERED'] }, 1, 0] } } } },
        { $sort: { count: -1 } },
      ]),
      RepairPayment.aggregate([
        { $match: { status: 'COLLECTED' } },
        { $group: { _id: '$kind', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      RepairBooking.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            quotationTotal: { $sum: { $cond: [{ $eq: ['$quotation.status', 'Approved'] }, '$quotation.total', 0] } },
            approved: { $sum: { $cond: [{ $eq: ['$quotation.status', 'Approved'] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ['$quotation.status', 'Rejected'] }, 1, 0] } },
          },
        },
      ]),
    ]);
    res.json({
      success: true,
      summary: {
        totals: totals[0] || { total: 0, quotationTotal: 0, approved: 0, rejected: 0 },
        byStatus: byStatus.map((s) => ({ status: s._id, count: s.count })),
        byCategory: byCategory.map((c) => ({ category: c._id, count: c.count, delivered: c.delivered })),
        revenue: revenue.map((r) => ({ kind: r._id, amount: r.amount, count: r.count })),
      },
    });
  } catch (error) {
    next(error);
  }
};
