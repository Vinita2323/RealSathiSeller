import RepairCenter from '../models/RepairCenter.model.js';
import Admin from '../models/Admin.model.js';

/**
 * Where a repair parcel is dropped off (and collected from) by drivers.
 * Priority:  the booking's own repair center → the first active repair center → the admin's profile address.
 * Returns null when nothing is configured.
 */
const lineOf = (o = {}) =>
  [o.addressLine1 || o.address, o.addressLine2, o.landmark, o.city, o.state, o.pincode].filter(Boolean).join(', ');

const fromCenter = (c) => ({
  source: 'center',
  name: c.name || 'Repair Center',
  address: c.address || '',
  addressLine1: c.address || '',
  city: c.city || '',
  state: c.state || '',
  pincode: c.pincode || '',
  phone: c.phone || '',
  lat: c.lat ?? null,
  lng: c.lng ?? null,
  fullAddress: lineOf({ addressLine1: c.address, city: c.city, state: c.state, pincode: c.pincode }),
});

const fromAdmin = (a) => ({
  source: 'admin',
  name: a.name || 'Admin',
  address: a.address.addressLine1 || '',
  addressLine1: a.address.addressLine1 || '',
  addressLine2: a.address.addressLine2 || '',
  landmark: a.address.landmark || '',
  city: a.address.city || '',
  state: a.address.state || '',
  pincode: a.address.pincode || '',
  phone: a.mobile || '',
  lat: a.address.lat ?? null,
  lng: a.address.lng ?? null,
  fullAddress: lineOf(a.address),
});

// Default (used when a booking has no center of its own). Resolve once per request and reuse for every booking.
export const getDefaultDropLocation = async () => {
  const center = await RepairCenter.findOne({ active: true }).sort({ createdAt: 1 }).lean();
  if (center && center.address) return fromCenter(center);
  const admin = await Admin.findOne({ 'address.addressLine1': { $exists: true, $ne: '' } })
    .sort({ role: 1, updatedAt: -1 }) // 'admin' before 'super_admin'
    .select('name mobile address')
    .lean();
  return admin ? fromAdmin(admin) : null;
};

// Drop location for one booking: its own populated center wins, otherwise the default.
export const dropLocationFor = (booking, fallback) => {
  const c = booking?.repairCenter;
  if (c && typeof c === 'object' && c.address) return fromCenter(c);
  return fallback || null;
};
