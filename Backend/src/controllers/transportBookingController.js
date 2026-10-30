import mongoose from 'mongoose';
import crypto from 'crypto';
import TransportBooking from '../models/TransportBooking.model.js';
import VehicleType from '../models/VehicleType.model.js';
import Captain from '../models/Captain.model.js';
import Rating from '../models/Rating.model.js';
import CaptainNotification from '../models/CaptainNotification.model.js';
import CaptainTransaction from '../models/CaptainTransaction.model.js';
import CommissionSettings from '../models/CommissionSettings.model.js';
import TransportPricing from '../models/TransportPricing.model.js';
import { razorpayInstance } from '../config/razorpay.js';
import { haversineDistance, estimateRoadDistanceKm, estimateDuration } from '../utils/haversine.js';
import { calculateFare, isNightPeakNow, toStoredFareBreakdown } from '../utils/fareCalculator.js';
import { generateBookingId } from '../utils/generateBookingId.js';

/**
 * Billable trip distance using Admin Vehicle Details rates later.
 * Sums pickup → stops → drop road km, plus return-to-pickup when enabled.
 */
const resolveBillableDistanceKm = ({
  pickupLocation,
  dropLocation,
  stops = [],
  clientDistanceKm = null,
  includeReturn = false,
}) => {
  const points = [];
  if (pickupLocation?.lat != null && pickupLocation?.lng != null) {
    points.push({ lat: parseFloat(pickupLocation.lat), lng: parseFloat(pickupLocation.lng) });
  }
  (stops || []).forEach((s) => {
    const lat = s?.lat ?? s?.latitude;
    const lng = s?.lng ?? s?.longitude;
    if (lat != null && lng != null) points.push({ lat: parseFloat(lat), lng: parseFloat(lng) });
  });
  if (dropLocation?.lat != null && dropLocation?.lng != null) {
    points.push({ lat: parseFloat(dropLocation.lat), lng: parseFloat(dropLocation.lng) });
  }

  if (points.length < 2) {
    const fallback = Number(clientDistanceKm);
    return Number.isFinite(fallback) && fallback > 0 ? Math.round(fallback * 100) / 100 : 5.0;
  }

  let total = 0;
  // When client sent a full-trip driving km (pickup→stops→drop), use it for the
  // whole route when segment count matches a simple 2-point trip; for multi-stop,
  // prefer per-segment road estimates (client total still validated when 2 pts).
  if (points.length === 2) {
    total = estimateRoadDistanceKm(
      points[0].lat,
      points[0].lng,
      points[1].lat,
      points[1].lng,
      clientDistanceKm
    );
  } else {
    for (let i = 0; i < points.length - 1; i += 1) {
      total += estimateRoadDistanceKm(
        points[i].lat,
        points[i].lng,
        points[i + 1].lat,
        points[i + 1].lng,
        null
      );
    }
    // If client provided a full-route driving total, prefer it when sane vs sum
    const client = Number(clientDistanceKm);
    if (Number.isFinite(client) && client > 0) {
      const minAllowed = Math.max(0.5, total * 0.75);
      const maxAllowed = Math.max(total * 2.5, total + 50);
      if (client >= minAllowed && client <= maxAllowed) {
        total = client;
      }
    }
  }

  if (includeReturn) {
    const last = points[points.length - 1];
    const first = points[0];
    total += estimateRoadDistanceKm(last.lat, last.lng, first.lat, first.lng);
  }

  return Math.max(1, Math.round(total * 100) / 100);
};

const buildFareForTrip = ({
  vehicle,
  transportPricing,
  pickupLocation,
  dropLocation,
  stops = [],
  clientDistanceKm = null,
  waitingMinutes = 0,
  discount = 0,
}) => {
  const includeReturn = Boolean(transportPricing?.returnToPickup);
  const distanceKm = resolveBillableDistanceKm({
    pickupLocation,
    dropLocation,
    stops,
    clientDistanceKm,
    includeReturn,
  });
  const fare = calculateFare(vehicle, distanceKm, {
    transportPricing,
    stopsCount: (stops || []).length,
    waitingMinutes,
    discount,
    isNightPeak: isNightPeakNow(transportPricing),
  });
  return {
    distanceKm,
    estimatedDurationMin: estimateDuration(distanceKm),
    fareBreakdown: toStoredFareBreakdown(fare),
    fare,
  };
};

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

// Statuses that mean a booking is "active" (user cannot create another)
const ACTIVE_STATUSES = [
  'SEARCHING_CAPTAIN',
  'CAPTAIN_ASSIGNED',
  'CAPTAIN_ARRIVING',
  'CAPTAIN_REACHED_PICKUP',
  'RIDE_STARTED',
  'CAPTAIN_REACHED_DROP',
];

// Statuses of active rides in progress with an assigned driver
const IN_PROGRESS_STATUSES = [
  'CAPTAIN_ASSIGNED',
  'CAPTAIN_ARRIVING',
  'CAPTAIN_REACHED_PICKUP',
  'RIDE_STARTED',
  'CAPTAIN_REACHED_DROP',
];

// Statuses that are terminal (cannot be cancelled or modified by user)
const TERMINAL_STATUSES = ['RIDE_COMPLETED', 'CANCELLED'];

// Statuses where the user may see the captain's live position
const TRACKING_STATUSES = [
  'CAPTAIN_ASSIGNED',
  'CAPTAIN_ARRIVING',
  'CAPTAIN_REACHED_PICKUP',
  'RIDE_STARTED',
  'CAPTAIN_REACHED_DROP',
];

// Copies the active pricing flag onto the booking. Default is no return leg.
const buildReturnRoute = (pricing, pickupLocation) => {
  if (!pricing?.returnToPickup || !pickupLocation?.address) {
    return { required: false, status: 'NONE' };
  }
  let distanceKm = null;
  let estimatedDurationMin = null;
  return {
    required: true,
    status: 'PENDING',
    destination: {
      address: pickupLocation.address,
      landmark: pickupLocation.landmark || '',
      city: pickupLocation.city || '',
      state: pickupLocation.state || '',
      pincode: pickupLocation.pincode || '',
      lat: pickupLocation.lat ?? null,
      lng: pickupLocation.lng ?? null,
    },
    distanceKm,
    estimatedDurationMin,
  };
};

const withReturnDistance = (route, dropLocation) => {
  if (!route?.required || !route.destination || dropLocation?.lat == null || route.destination.lat == null) {
    return route;
  }
  const distanceKm = haversineDistance(
    parseFloat(dropLocation.lat),
    parseFloat(dropLocation.lng),
    parseFloat(route.destination.lat),
    parseFloat(route.destination.lng)
  );
  return {
    ...route,
    distanceKm,
    estimatedDurationMin: estimateDuration(distanceKm),
  };
};

// Hide captain coordinates once the trip is no longer active.
const hideInactiveTracking = (bookingObj) => {
  if (!bookingObj) return bookingObj;
  if (!TRACKING_STATUSES.includes(bookingObj.status)) {
    bookingObj.liveLocation = null;
    if (bookingObj.captainId && typeof bookingObj.captainId === 'object') {
      const captain = { ...bookingObj.captainId };
      delete captain.liveLocation;
      bookingObj.captainId = captain;
    }
  }
  return bookingObj;
};

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Validate lat/lng values if provided
 */
const isValidCoord = (lat, lng) => {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return true; // optional
  const latN = parseFloat(lat);
  const lngN = parseFloat(lng);
  return (
    !isNaN(latN) && !isNaN(lngN) &&
    latN >= -90 && latN <= 90 &&
    lngN >= -180 && lngN <= 180
  );
};

/**
 * Generate a 4-digit ride OTP
 */
const generateRideOtp = () => Math.floor(1000 + Math.random() * 9000).toString();

/**
 * Build a flexible regex pattern to match vehicle types across captain profiles and vehicle models.
 */
export const getVehicleMatchPattern = (vehicleNameOrSlug) => {
  if (!vehicleNameOrSlug) return null;
  const v = String(vehicleNameOrSlug).toLowerCase();
  if (v.includes('bike') || v.includes('motorcycle') || v.includes('two') || v.includes('2')) {
    return 'motorcycle|bike|two|2';
  }
  if (v.includes('three') || v.includes('3') || v.includes('auto')) {
    return '3 wheeler|three|auto';
  }
  if (v.includes('mini') || v.includes('ace') || v.includes('tata')) {
    return 'mini|ace|tata';
  }
  if (v.includes('pickup') || v.includes('bolero') || v.includes('8ft')) {
    return 'pickup|bolero|8ft';
  }
  return v;
};

/**
 * Find all eligible, online, and approved captains with the EXACT matching vehicle type near the pickup location.
 */
const findEligibleCaptains = async (pickupLocation, vehicleSnapshot) => {
  const city = pickupLocation?.city || '';
  const state = pickupLocation?.state || '';
  const vehicleName = vehicleSnapshot?.name || vehicleSnapshot?.slug || '';

  // Base eligibility query: approved & online
  const query = {
    status: 'approved',
    isOnline: true,
  };

  // Strict Vehicle Type filter
  const vehiclePattern = getVehicleMatchPattern(vehicleName);
  if (vehiclePattern) {
    query.vehicleType = { $regex: vehiclePattern, $options: 'i' };
  }

  // Geo / Area filter
  const locationConditions = [];
  if (city) {
    locationConditions.push({ city: { $regex: city, $options: 'i' } });
    locationConditions.push({ 'workingArea.city': { $regex: city, $options: 'i' } });
  }
  if (state) {
    locationConditions.push({ state: { $regex: state, $options: 'i' } });
    locationConditions.push({ 'workingArea.state': { $regex: state, $options: 'i' } });
  }

  if (locationConditions.length > 0) {
    query.$or = locationConditions;
  }

  // Find matching captains with this vehicle (limit to nearest 10 captains)
  let captains = await Captain.find(query).limit(10);

  // If none found in specific city/state, try all online & approved captains with this matching vehicle
  if (captains.length === 0 && vehiclePattern) {
    captains = await Captain.find({
      status: 'approved',
      isOnline: true,
      vehicleType: { $regex: vehiclePattern, $options: 'i' },
    }).limit(10);
  }

  // Fallback: If no captain with that vehicle exists yet, allow all approved & online captains to receive request
  if (captains.length === 0) {
    captains = await Captain.find({
      status: 'approved',
      isOnline: true,
    }).limit(10);
  }

  return captains;
};

/**
 * Dispatch booking requests to all eligible captains.
 * Records PENDING entries in booking.captainRequests and creates captain notifications.
 * Does NOT assign a captain or change booking.status.
 */
const dispatchTransportRequests = async (booking) => {
  try {
    const eligibleCaptains = await findEligibleCaptains(
      booking.pickupLocation,
      booking.vehicleSnapshot
    );

    if (!eligibleCaptains || eligibleCaptains.length === 0) {
      console.warn(
        `[TransportDispatch] No online captains found for booking ${booking.bookingId} in ${booking.pickupLocation?.city || 'any area'}`
      );
      return;
    }

    const captainCommRate = booking.captainCommissionRate !== undefined ? booking.captainCommissionRate : 5;
    const captainEarnings = booking.captainEarnings > 0
      ? booking.captainEarnings
      : Math.round((booking.fareBreakdown.totalFare * ((100 - captainCommRate) / 100)) * 100) / 100;

    const now = new Date();
    const requests = eligibleCaptains.map((captain) => ({
      captainId: captain._id,
      status: 'PENDING',
      earnings: captainEarnings,
      sentAt: now,
      respondedAt: null,
    }));

    // Update booking document with dispatched requests (status remains SEARCHING_CAPTAIN)
    await TransportBooking.findByIdAndUpdate(booking._id, {
      $set: {
        captainRequests: requests,
        captainEarnings,
      },
    });

    // Send notifications to all eligible captains
    const notificationPromises = eligibleCaptains.map((captain) =>
      CaptainNotification.create({
        captainId: captain._id,
        type: 'JOB_ASSIGNED',
        title: 'New Transport Request!',
        message: `Pickup: ${booking.pickupLocation.address} → Drop: ${booking.dropLocation.address}. Est. Payout: ₹${captainEarnings.toFixed(2)}. Tap to accept.`,
        orderId: booking.bookingId,
        amount: captainEarnings,
        icon: 'local_shipping',
      })
    );

    await Promise.allSettled(notificationPromises);

    console.log(
      `[TransportDispatch] Dispatched request for booking ${booking.bookingId} to ${eligibleCaptains.length} captains. Booking remains in SEARCHING_CAPTAIN.`
    );
  } catch (err) {
    console.error(`[TransportDispatch ERROR] Booking ${booking.bookingId}:`, err.message);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/transport/fare-estimate
// Auth: user required
// Calculate fare for given locations + vehicle type (NO booking created)
// ──────────────────────────────────────────────────────────────────────────────
export const getFareEstimate = async (req, res, next) => {
  try {
    const { pickupLocation, dropLocation, vehicleTypeId } = req.body;

    const pickupAddr = (
      (typeof pickupLocation === 'string' ? pickupLocation : pickupLocation?.address || pickupLocation?.formattedAddress || pickupLocation?.name || '')
    ).trim();

    const dropAddr = (
      (typeof dropLocation === 'string' ? dropLocation : dropLocation?.address || dropLocation?.formattedAddress || dropLocation?.name || '')
    ).trim();

    const pickupLat = pickupLocation?.lat ?? pickupLocation?.latitude ?? null;
    const pickupLng = pickupLocation?.lng ?? pickupLocation?.longitude ?? null;
    const dropLat = dropLocation?.lat ?? dropLocation?.latitude ?? null;
    const dropLng = dropLocation?.lng ?? dropLocation?.longitude ?? null;

    if (!vehicleTypeId || !mongoose.Types.ObjectId.isValid(vehicleTypeId)) {
      return res.status(400).json({ success: false, message: 'A valid vehicle type ID is required' });
    }
    if (!isValidCoord(pickupLat, pickupLng) || !isValidCoord(dropLat, dropLng)) {
      return res.status(400).json({ success: false, message: 'Invalid coordinate values. Latitude must be -90 to 90, longitude -180 to 180' });
    }

    // ── Fetch vehicle ─────────────────────────────────────────────────
    const vehicle = await VehicleType.findOne({ _id: vehicleTypeId, isActive: true });
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Selected vehicle type is not available' });
    }

    const hasPickupCoords = pickupLat != null && pickupLng != null;
    const hasDropCoords = dropLat != null && dropLng != null;

    // ── Fare uses Admin Vehicle Details rates + road distance ─────────
    const transportPricing = await TransportPricing.getActiveConfig();
    const { distanceKm, estimatedDurationMin, fareBreakdown } = buildFareForTrip({
      vehicle,
      transportPricing,
      pickupLocation: { lat: pickupLat, lng: pickupLng },
      dropLocation: { lat: dropLat, lng: dropLng },
      stops: Array.isArray(req.body.stops) ? req.body.stops : [],
      clientDistanceKm: req.body.distanceKm,
    });

    res.status(200).json({
      success: true,
      estimate: {
        distanceKm,
        estimatedDurationMin,
        vehicleName: vehicle.name,
        vehicleSlug: vehicle.slug,
        fareBreakdown,
        coordsUsed: hasPickupCoords && hasDropCoords,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/transport/bookings/create-payment-order
// Auth: user required
// Create a Razorpay order for online transport booking payment
// ──────────────────────────────────────────────────────────────────────────────
export const createTransportPaymentOrder = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      pickupLocation,
      dropLocation,
      vehicleTypeId,
      goods,
    } = req.body;

    const pickupAddr = (
      typeof pickupLocation === 'string'
        ? pickupLocation
        : pickupLocation?.address || pickupLocation?.formattedAddress || pickupLocation?.name || ''
    ).trim();

    const dropAddr = (
      typeof dropLocation === 'string'
        ? dropLocation
        : dropLocation?.address || dropLocation?.formattedAddress || dropLocation?.name || ''
    ).trim();

    const pickupLat = pickupLocation?.lat ?? pickupLocation?.latitude ?? null;
    const pickupLng = pickupLocation?.lng ?? pickupLocation?.longitude ?? null;
    const dropLat = dropLocation?.lat ?? dropLocation?.latitude ?? null;
    const dropLng = dropLocation?.lng ?? dropLocation?.longitude ?? null;

    if (!pickupAddr) {
      return res.status(400).json({ success: false, message: 'Pickup location address is required' });
    }
    if (!dropAddr) {
      return res.status(400).json({ success: false, message: 'Drop location address is required' });
    }
    if (pickupAddr.toLowerCase() === dropAddr.toLowerCase()) {
      return res.status(400).json({ success: false, message: 'Pickup and drop locations cannot be the same' });
    }
    if (!vehicleTypeId || !mongoose.Types.ObjectId.isValid(vehicleTypeId)) {
      return res.status(400).json({ success: false, message: 'A valid vehicle type ID is required' });
    }
    if (!goods || !goods.category || !goods.weightKg || !goods.packages) {
      return res.status(400).json({ success: false, message: 'Goods details are required' });
    }

    // ── Prevent duplicate in-progress rides with assigned drivers ─────
    const existingInProgress = await TransportBooking.findOne({
      user: userId,
      status: { $in: IN_PROGRESS_STATUSES },
    });
    if (existingInProgress) {
      return res.status(400).json({
        success: false,
        message: 'You have an active ride in progress. Please wait for completion before placing a new booking.',
        activeBookingId: existingInProgress.bookingId,
      });
    }

    // Auto-cancel previous unassigned searches so user is never blocked
    await TransportBooking.updateMany(
      { user: userId, status: 'SEARCHING_CAPTAIN' },
      {
        $set: {
          status: 'CANCELLED',
          cancelledBy: 'user',
          cancellationReason: 'Superseded by new booking',
          cancelledAt: new Date(),
        },
      }
    );

    // ── Fetch & validate vehicle ──────────────────────────────────────
    const vehicle = await VehicleType.findOne({ _id: vehicleTypeId, isActive: true });
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Selected vehicle type is not available' });
    }

    // ── Recalculate distance & fare (Vehicle Details + road km) ───────
    const transportPricing = await TransportPricing.getActiveConfig();
    const { distanceKm, estimatedDurationMin, fareBreakdown } = buildFareForTrip({
      vehicle,
      transportPricing,
      pickupLocation: { lat: pickupLat, lng: pickupLng },
      dropLocation: { lat: dropLat, lng: dropLng },
      stops: Array.isArray(req.body.stops) ? req.body.stops : [],
      clientDistanceKm: req.body.distanceKm,
    });
    const amountInPaise = Math.round(fareBreakdown.totalFare * 100);

    if (amountInPaise <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid booking fare calculation' });
    }

    // ── Create Razorpay Order ─────────────────────────────────────────
    const orderOptions = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `trb_${Date.now().toString().slice(-8)}`,
      notes: {
        userId: userId.toString(),
        vehicleTypeId: vehicleTypeId.toString(),
        category: goods.category,
      },
    };

    const razorpayOrder = await razorpayInstance.orders.create(orderOptions);

    res.status(200).json({
      success: true,
      orderId: razorpayOrder.id,
      amount: fareBreakdown.totalFare,
      amountPaise: amountInPaise,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_live_TgHKKogdCDai1c',
      distanceKm,
      estimatedDurationMin,
      fareBreakdown,
    });
  } catch (error) {
    console.error('[TransportRazorpayOrder ERROR]', error);
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/transport/bookings/verify-payment
// Auth: user required
// Verify Razorpay payment and confirm transport booking
// ──────────────────────────────────────────────────────────────────────────────
export const verifyTransportPayment = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      pickupLocation,
      dropLocation,
      stops = [],
      goods,
      vehicleTypeId,
      paymentMethod = 'UPI',
    } = req.body;

    // ── Validate payment tokens ───────────────────────────────────────
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification tokens (razorpayOrderId, razorpayPaymentId, razorpaySignature) are required',
      });
    }

    // ── Cryptographic Signature Verification ──────────────────────────
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (generatedSignature !== razorpaySignature) {
      console.error('[TransportRazorpayVerify] Signature mismatch for order:', razorpayOrderId);
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature. Verification failed.',
      });
    }

    // ── Idempotency Check: if booking was already created for this order ─
    const existingOrderBooking = await TransportBooking.findOne({ razorpayOrderId });
    if (existingOrderBooking) {
      return res.status(200).json({
        success: true,
        message: 'Payment already verified and booking confirmed',
        booking: existingOrderBooking,
      });
    }

    // ── Prevent duplicate in-progress rides with assigned drivers ─────
    const existingInProgress = await TransportBooking.findOne({
      user: userId,
      status: { $in: IN_PROGRESS_STATUSES },
    });
    if (existingInProgress) {
      return res.status(400).json({
        success: false,
        message: 'You have an active ride in progress. Please wait for completion before placing a new booking.',
        activeBookingId: existingInProgress.bookingId,
      });
    }

    // Auto-cancel previous unassigned searches
    await TransportBooking.updateMany(
      { user: userId, status: 'SEARCHING_CAPTAIN' },
      {
        $set: {
          status: 'CANCELLED',
          cancelledBy: 'user',
          cancellationReason: 'Superseded by new booking',
          cancelledAt: new Date(),
        },
      }
    );

    // ── Fetch & validate vehicle ──────────────────────────────────────
    const vehicle = await VehicleType.findOne({ _id: vehicleTypeId, isActive: true });
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Selected vehicle type is not available' });
    }

    const pickupAddr = (
      typeof pickupLocation === 'string'
        ? pickupLocation
        : pickupLocation?.address || pickupLocation?.formattedAddress || pickupLocation?.name || ''
    ).trim();

    const dropAddr = (
      typeof dropLocation === 'string'
        ? dropLocation
        : dropLocation?.address || dropLocation?.formattedAddress || dropLocation?.name || ''
    ).trim();

    const pickupLat = pickupLocation?.lat ?? pickupLocation?.latitude ?? null;
    const pickupLng = pickupLocation?.lng ?? pickupLocation?.longitude ?? null;
    const dropLat = dropLocation?.lat ?? dropLocation?.latitude ?? null;
    const dropLng = dropLocation?.lng ?? dropLocation?.longitude ?? null;

    // ── Recalculate distance & fare (Vehicle Details + road km) ───────
    const hasPickupCoords = pickupLat != null && pickupLng != null;
    const hasDropCoords = dropLat != null && dropLng != null;

    const transportPricing = await TransportPricing.getActiveConfig();
    const { distanceKm, estimatedDurationMin, fareBreakdown } = buildFareForTrip({
      vehicle,
      transportPricing,
      pickupLocation: { lat: pickupLat, lng: pickupLng },
      dropLocation: { lat: dropLat, lng: dropLng },
      stops,
      clientDistanceKm: req.body.distanceKm,
    });

    const vehicleSnapshot = {
      name: vehicle.name,
      slug: vehicle.slug,
      capacityKg: vehicle.capacityKg,
      baseFare: vehicle.baseFare,
      perKmFare: vehicle.perKmFare,
      minimumFare: vehicle.minimumFare,
      platformFee: vehicle.platformFee,
    };

    const sanitizedStops = (stops || [])
      .filter((s) => s && (s.address || s.formattedAddress || typeof s === 'string'))
      .map((s) => ({
        address: (typeof s === 'string' ? s : s.address || s.formattedAddress || '').trim(),
        city: s.city || '',
        lat: s.lat != null ? parseFloat(s.lat) : (s.latitude != null ? parseFloat(s.latitude) : null),
        lng: s.lng != null ? parseFloat(s.lng) : (s.longitude != null ? parseFloat(s.longitude) : null),
      }));

    const bookingId = generateBookingId();
    const now = new Date();

    // Fetch dynamic active captain commission rate
    let captainCommRate = 5;
    try {
      const commSettings = await CommissionSettings.getOrCreateActiveSettings();
      if (commSettings) {
        captainCommRate = Number(commSettings.captainCommission !== undefined ? commSettings.captainCommission : 5);
      }
    } catch (e) {}

    const captainCommAmount = Math.round(((fareBreakdown.totalFare * captainCommRate) / 100) * 100) / 100;
    const captainEarnings = Math.max(0, Math.round((fareBreakdown.totalFare - captainCommAmount) * 100) / 100);

    const booking = await TransportBooking.create({
      bookingId,
      user: userId,
      pickupLocation: {
        address: pickupAddr,
        landmark: pickupLocation.landmark || '',
        city: pickupLocation.city || '',
        state: pickupLocation.state || '',
        pincode: pickupLocation.pincode || '',
        lat: hasPickupCoords ? parseFloat(pickupLat) : null,
        lng: hasPickupCoords ? parseFloat(pickupLng) : null,
      },
      dropLocation: {
        address: dropAddr,
        landmark: dropLocation.landmark || '',
        city: dropLocation.city || '',
        state: dropLocation.state || '',
        pincode: dropLocation.pincode || '',
        lat: hasDropCoords ? parseFloat(dropLat) : null,
        lng: hasDropCoords ? parseFloat(dropLng) : null,
      },
      stops: sanitizedStops,
      distanceKm,
      estimatedDurationMin,
      goods: {
        category: (goods.category === 'Other' && goods.customCategory ? goods.customCategory : goods.category).trim(),
        customCategory: goods.customCategory?.trim() || '',
        weightKg: parseFloat(goods.weightKg),
        packages: parseInt(goods.packages),
        instructions: goods.instructions || '',
      },
      vehicleTypeId: vehicle._id,
      vehicleSnapshot,
      fareBreakdown,
      paymentMethod: paymentMethod || 'UPI',
      paymentStatus: 'Paid',
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      paidAt: now,
      captainCommissionRate: captainCommRate,
      captainCommissionAmount: captainCommAmount,
      captainEarnings,
      captainEarning: captainEarnings,
      returnRoute: withReturnDistance(
        buildReturnRoute(transportPricing, {
          address: pickupAddr,
          landmark: pickupLocation.landmark || '',
          city: pickupLocation.city || '',
          state: pickupLocation.state || '',
          pincode: pickupLocation.pincode || '',
          lat: hasPickupCoords ? parseFloat(pickupLat) : null,
          lng: hasPickupCoords ? parseFloat(pickupLng) : null,
        }),
        {
          lat: hasDropCoords ? parseFloat(dropLat) : null,
          lng: hasDropCoords ? parseFloat(dropLng) : null,
        }
      ),
      status: 'SEARCHING_CAPTAIN',
      statusHistory: [
        {
          status: 'SEARCHING_CAPTAIN',
          changedBy: 'system',
          changedById: null,
          reason: `Booking created via Razorpay payment (${razorpayPaymentId})`,
          timestamp: now,
        },
      ],
    });

    console.log(`[TransportRazorpayVerify] Success: ${bookingId} verified & created for user ${userId}. Fare: ₹${fareBreakdown.totalFare}, CaptainComm: ${captainCommRate}%`);

    // ── Dispatch requests to eligible captains ────────────────────────
    dispatchTransportRequests(booking).catch((err) =>
      console.error(`[TransportDispatch ASYNC ERROR] ${booking.bookingId}:`, err.message)
    );

    res.status(201).json({
      success: true,
      message: 'Payment verified and booking created successfully. Searching for nearby captains...',
      booking: {
        _id: booking._id,
        bookingId: booking.bookingId,
        status: 'SEARCHING_CAPTAIN',
        distanceKm: booking.distanceKm,
        estimatedDurationMin: booking.estimatedDurationMin,
        fareBreakdown: booking.fareBreakdown,
        paymentMethod: booking.paymentMethod,
        paymentStatus: booking.paymentStatus,
        razorpayPaymentId: booking.razorpayPaymentId,
        pickupLocation: booking.pickupLocation,
        dropLocation: booking.dropLocation,
        stops: booking.stops,
        goods: booking.goods,
        vehicleSnapshot: booking.vehicleSnapshot,
        captainId: null,
        captainAssignedAt: null,
        createdAt: booking.createdAt,
      },
    });
  } catch (error) {
    console.error('[TransportRazorpayVerify ERROR]', error);
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/transport/bookings
// Auth: user required
// Create a new transport booking — fare is always recalculated server-side
// ──────────────────────────────────────────────────────────────────────────────
export const createBooking = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      pickupLocation,
      dropLocation,
      stops = [],
      goods,
      vehicleTypeId,
      paymentMethod = 'CASH',
    } = req.body;

    const pickupAddr = (
      typeof pickupLocation === 'string'
        ? pickupLocation
        : pickupLocation?.address || pickupLocation?.formattedAddress || pickupLocation?.name || ''
    ).trim();

    const dropAddr = (
      typeof dropLocation === 'string'
        ? dropLocation
        : dropLocation?.address || dropLocation?.formattedAddress || dropLocation?.name || ''
    ).trim();

    const pickupLat = pickupLocation?.lat ?? pickupLocation?.latitude ?? null;
    const pickupLng = pickupLocation?.lng ?? pickupLocation?.longitude ?? null;
    const dropLat = dropLocation?.lat ?? dropLocation?.latitude ?? null;
    const dropLng = dropLocation?.lng ?? dropLocation?.longitude ?? null;

    // ── Validation ────────────────────────────────────────────────────
    if (!pickupAddr) {
      return res.status(400).json({ success: false, message: 'Pickup location address is required' });
    }
    if (!dropAddr) {
      return res.status(400).json({ success: false, message: 'Drop location address is required' });
    }
    if (pickupAddr.toLowerCase() === dropAddr.toLowerCase()) {
      return res.status(400).json({ success: false, message: 'Pickup and drop locations cannot be the same' });
    }
    if (!vehicleTypeId || !mongoose.Types.ObjectId.isValid(vehicleTypeId)) {
      return res.status(400).json({ success: false, message: 'A valid vehicle type ID is required' });
    }
    if (!['CASH', 'UPI', 'CARD', 'WALLET'].includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: 'Invalid payment method. Must be CASH, UPI, CARD, or WALLET' });
    }
    if (!goods || !goods.category || !goods.weightKg || !goods.packages) {
      return res.status(400).json({ success: false, message: 'Goods details (category, weight, packages) are required' });
    }
    if (typeof goods.category !== 'string' || !goods.category.trim()) {
      return res.status(400).json({ success: false, message: 'Valid goods category is required' });
    }
    if (parseFloat(goods.weightKg) <= 0) {
      return res.status(400).json({ success: false, message: 'Goods weight must be greater than 0' });
    }
    if (parseInt(goods.packages) < 1) {
      return res.status(400).json({ success: false, message: 'Number of packages must be at least 1' });
    }
    if (!isValidCoord(pickupLat, pickupLng) || !isValidCoord(dropLat, dropLng)) {
      return res.status(400).json({ success: false, message: 'Invalid coordinate values provided' });
    }
    if (stops.length > 3) {
      return res.status(400).json({ success: false, message: 'Maximum 3 intermediate stops are allowed' });
    }

    // ── Prevent duplicate in-progress rides with assigned drivers ─────
    const existingInProgress = await TransportBooking.findOne({
      user: userId,
      status: { $in: IN_PROGRESS_STATUSES },
    });
    if (existingInProgress) {
      return res.status(400).json({
        success: false,
        message: 'You have an active ride in progress. Please wait for completion before placing a new booking.',
        activeBookingId: existingInProgress.bookingId,
      });
    }

    // Auto-cancel previous unassigned searches
    await TransportBooking.updateMany(
      { user: userId, status: 'SEARCHING_CAPTAIN' },
      {
        $set: {
          status: 'CANCELLED',
          cancelledBy: 'user',
          cancellationReason: 'Superseded by new booking',
          cancelledAt: new Date(),
        },
      }
    );

    // ── Fetch & validate vehicle ──────────────────────────────────────
    const vehicle = await VehicleType.findOne({ _id: vehicleTypeId, isActive: true });
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Selected vehicle type is not available' });
    }

    // ── Recalculate distance & fare (Vehicle Details + road km) ───────
    const hasPickupCoords = pickupLocation.lat != null && pickupLocation.lng != null;
    const hasDropCoords = dropLocation.lat != null && dropLocation.lng != null;

    const transportPricing = await TransportPricing.getActiveConfig();
    const { distanceKm, estimatedDurationMin, fareBreakdown } = buildFareForTrip({
      vehicle,
      transportPricing,
      pickupLocation: {
        lat: hasPickupCoords ? pickupLocation.lat : pickupLat,
        lng: hasPickupCoords ? pickupLocation.lng : pickupLng,
      },
      dropLocation: {
        lat: hasDropCoords ? dropLocation.lat : dropLat,
        lng: hasDropCoords ? dropLocation.lng : dropLng,
      },
      stops,
      clientDistanceKm: req.body.distanceKm,
    });

    // ── Build vehicle snapshot (freeze pricing at booking time) ───────
    const vehicleSnapshot = {
      name: vehicle.name,
      slug: vehicle.slug,
      capacityKg: vehicle.capacityKg,
      baseFare: vehicle.baseFare,
      perKmFare: vehicle.perKmFare,
      minimumFare: vehicle.minimumFare,
      platformFee: vehicle.platformFee,
    };

    // ── Sanitize stops ────────────────────────────────────────────────
    const sanitizedStops = stops
      .filter((s) => s && s.address && s.address.trim())
      .map((s) => ({
        address: s.address.trim(),
        city: s.city || '',
        lat: s.lat != null ? parseFloat(s.lat) : null,
        lng: s.lng != null ? parseFloat(s.lng) : null,
      }));

    // ── Create booking document ───────────────────────────────────────
    const bookingId = generateBookingId();
    const now = new Date();

    // Fetch dynamic active captain commission rate
    let captainCommRate = 5;
    try {
      const commSettings = await CommissionSettings.getOrCreateActiveSettings();
      if (commSettings) {
        captainCommRate = Number(commSettings.captainCommission !== undefined ? commSettings.captainCommission : 5);
      }
    } catch (e) {}

    const captainCommAmount = Math.round(((fareBreakdown.totalFare * captainCommRate) / 100) * 100) / 100;
    const captainEarnings = Math.max(0, Math.round((fareBreakdown.totalFare - captainCommAmount) * 100) / 100);

    const booking = await TransportBooking.create({
      bookingId,
      user: userId,
      pickupLocation: {
        address: pickupLocation.address.trim(),
        landmark: pickupLocation.landmark || '',
        city: pickupLocation.city || '',
        state: pickupLocation.state || '',
        pincode: pickupLocation.pincode || '',
        lat: hasPickupCoords ? parseFloat(pickupLocation.lat) : null,
        lng: hasPickupCoords ? parseFloat(pickupLocation.lng) : null,
      },
      dropLocation: {
        address: dropLocation.address.trim(),
        landmark: dropLocation.landmark || '',
        city: dropLocation.city || '',
        state: dropLocation.state || '',
        pincode: dropLocation.pincode || '',
        lat: hasDropCoords ? parseFloat(dropLocation.lat) : null,
        lng: hasDropCoords ? parseFloat(dropLocation.lng) : null,
      },
      stops: sanitizedStops,
      distanceKm,
      estimatedDurationMin,
      goods: {
        category: (goods.category === 'Other' && goods.customCategory ? goods.customCategory : goods.category).trim(),
        customCategory: goods.customCategory?.trim() || '',
        weightKg: parseFloat(goods.weightKg),
        packages: parseInt(goods.packages),
        instructions: goods.instructions || '',
      },
      vehicleTypeId: vehicle._id,
      vehicleSnapshot,
      fareBreakdown,
      paymentMethod,
      paymentStatus: 'Pending',
      captainCommissionRate: captainCommRate,
      captainCommissionAmount: captainCommAmount,
      captainEarnings,
      captainEarning: captainEarnings,
      returnRoute: withReturnDistance(buildReturnRoute(transportPricing, {
        address: pickupLocation.address.trim(),
        landmark: pickupLocation.landmark || '',
        city: pickupLocation.city || '',
        state: pickupLocation.state || '',
        pincode: pickupLocation.pincode || '',
        lat: hasPickupCoords ? parseFloat(pickupLocation.lat) : null,
        lng: hasPickupCoords ? parseFloat(pickupLocation.lng) : null,
      }), {
        lat: hasDropCoords ? parseFloat(dropLocation.lat) : null,
        lng: hasDropCoords ? parseFloat(dropLocation.lng) : null,
      }),
      status: 'SEARCHING_CAPTAIN',
      statusHistory: [
        {
          status: 'SEARCHING_CAPTAIN',
          changedBy: 'system',
          changedById: null,
          reason: 'Booking created by user',
          timestamp: now,
        },
      ],
    });

    console.log(`[TransportBooking] Created: ${bookingId} for user ${userId}. Fare: ₹${fareBreakdown.totalFare}, CaptainComm: ${captainCommRate}%`);

    // ── Dispatch requests to eligible captains asynchronously ──────────
    // Does NOT assign any captain; keeps status at SEARCHING_CAPTAIN.
    dispatchTransportRequests(booking).catch((err) =>
      console.error(`[TransportDispatch ASYNC ERROR] ${booking.bookingId}:`, err.message)
    );

    res.status(201).json({
      success: true,
      message: 'Booking created successfully. Searching for nearby captains...',
      booking: {
        _id: booking._id,
        bookingId: booking.bookingId,
        status: 'SEARCHING_CAPTAIN',
        distanceKm: booking.distanceKm,
        estimatedDurationMin: booking.estimatedDurationMin,
        fareBreakdown: booking.fareBreakdown,
        paymentMethod: booking.paymentMethod,
        paymentStatus: booking.paymentStatus,
        pickupLocation: booking.pickupLocation,
        dropLocation: booking.dropLocation,
        stops: booking.stops,
        goods: booking.goods,
        vehicleSnapshot: booking.vehicleSnapshot,
        captainId: null,
        captainAssignedAt: null,
        createdAt: booking.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/transport/bookings
// Auth: user required
// Returns all transport bookings for the logged-in user (newest first)
// ──────────────────────────────────────────────────────────────────────────────
export const getUserBookings = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { status, limit = 20, page = 1 } = req.query;

    const query = { user: userId };
    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const bookings = await TransportBooking.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('captainId', 'name phone vehicleType liveLocation documents.profilePhoto ratingAverage ratingCount')
      .select('-statusHistory -__v');

    const total = await TransportBooking.countDocuments(query);

    // Look up ratings submitted by this user for these bookings
    const bookingIds = bookings.map((b) => b._id);
    const userRatings = await Rating.find({
      ride: { $in: bookingIds },
      reviewerId: new mongoose.Types.ObjectId(userId),
    }).select('ride rating review feedbackTags createdAt');

    const ratingMap = new Map();
    userRatings.forEach((r) => {
      ratingMap.set(r.ride.toString(), r);
    });

    const enrichedBookings = bookings.map((b) => {
      const bObj = hideInactiveTracking(b.toObject());
      const userRating = ratingMap.get(b._id.toString());
      return {
        ...bObj,
        hasUserRated: Boolean(userRating),
        userRating: userRating ? userRating.rating : null,
        userReview: userRating ? userRating.review : '',
        userFeedbackTags: userRating ? userRating.feedbackTags : [],
      };
    });

    res.status(200).json({
      success: true,
      bookings: enrichedBookings,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/transport/bookings/active
// Auth: user required
// Returns the current active booking (if any) — used for ride tracking screen
// ──────────────────────────────────────────────────────────────────────────────
export const getActiveBooking = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const booking = await TransportBooking.findOne({
      user: userId,
      status: { $in: ACTIVE_STATUSES },
    })
      .sort({ createdAt: -1 })
      .populate('captainId', 'name phone vehicleType liveLocation isOnline documents.profilePhoto ratingAverage ratingCount')
      .select('-__v');

    const bookingObj = booking ? hideInactiveTracking(booking.toObject()) : null;

    res.status(200).json({
      success: true,
      booking: bookingObj,
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/transport/bookings/:bookingId
// Auth: user required
// Returns full details of a specific booking — only the booking owner can access
// ──────────────────────────────────────────────────────────────────────────────
export const getBookingById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { bookingId } = req.params;

    // Support both MongoDB _id and human-readable bookingId
    const isMongoId = mongoose.Types.ObjectId.isValid(bookingId);
    const query = isMongoId
      ? { $or: [{ _id: bookingId }, { bookingId }], user: userId }
      : { bookingId, user: userId };

    const booking = await TransportBooking.findOne(query)
      .populate('captainId', 'name phone vehicleType documents.profilePhoto liveLocation isOnline ratingAverage ratingCount')
      .populate('vehicleTypeId', 'name slug icon')
      .select('-__v');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const userRating = await Rating.findOne({
      ride: booking._id,
      reviewerId: new mongoose.Types.ObjectId(userId),
    });

    const bObj = hideInactiveTracking(booking.toObject());
    bObj.hasUserRated = Boolean(userRating);
    bObj.userRating = userRating ? userRating.rating : null;
    bObj.userReview = userRating ? userRating.review : '';
    bObj.userFeedbackTags = userRating ? userRating.feedbackTags : [];

    res.status(200).json({ success: true, booking: bObj });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// PUT /api/transport/bookings/:bookingId/cancel
// Auth: user required
// Cancel a booking — only allowed in SEARCHING_CAPTAIN or CAPTAIN_ASSIGNED
// ──────────────────────────────────────────────────────────────────────────────
export const cancelBooking = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { bookingId } = req.params;
    const { reason = '' } = req.body;

    // Find the booking and verify ownership
    const isMongoId = mongoose.Types.ObjectId.isValid(bookingId);
    const query = isMongoId
      ? { $or: [{ _id: bookingId }, { bookingId }], user: userId }
      : { bookingId, user: userId };

    const booking = await TransportBooking.findOne(query);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // ── Status validation ─────────────────────────────────────────────
    if (TERMINAL_STATUSES.includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a booking that is already ${booking.status.replace('_', ' ').toLowerCase()}`,
      });
    }

    if (booking.status === 'RIDE_STARTED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a ride that has already started',
      });
    }

    const now = new Date();

    // Expire any pending captain requests
    const updatedCaptainRequests = (booking.captainRequests || []).map((reqItem) => {
      if (reqItem.status === 'PENDING') {
        return { ...reqItem.toObject(), status: 'EXPIRED', respondedAt: now };
      }
      return reqItem;
    });

    const updated = await TransportBooking.findByIdAndUpdate(
      booking._id,
      {
        $set: {
          status: 'CANCELLED',
          cancelledBy: 'user',
          cancellationReason: reason.trim(),
          cancelledAt: now,
          captainRequests: updatedCaptainRequests,
        },
        $push: {
          statusHistory: {
            status: 'CANCELLED',
            changedBy: 'user',
            changedById: userId,
            reason: reason.trim() || 'Cancelled by user',
            timestamp: now,
          },
        },
      },
      { new: true }
    );

    // Notify assigned captain if one was already assigned
    if (booking.captainId) {
      try {
        await CaptainNotification.create({
          captainId: booking.captainId,
          type: 'JOB_CANCELLED',
          title: 'Transport Job Cancelled',
          message: `Booking ${booking.bookingId} has been cancelled by the user.`,
          orderId: booking.bookingId,
          icon: 'cancel',
        });
      } catch (notifErr) {
        console.warn(`[TransportCancel] Captain notification failed: ${notifErr.message}`);
      }
    }

    console.log(`[TransportBooking] Cancelled: ${booking.bookingId} by user ${userId}. Reason: ${reason || 'none'}`);

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      booking: {
        bookingId: updated.bookingId,
        status: updated.status,
        cancelledAt: updated.cancelledAt,
        cancellationReason: updated.cancellationReason,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// Admin: Get Platform-Wide Transport Bookings with Filters, Search & Metrics
// GET /api/transport/bookings/admin/all
// ──────────────────────────────────────────────────────────────────────────────
export const getAdminTransportBookings = async (req, res, next) => {
  try {
    const {
      status,
      search,
      vehicleType,
      startDate,
      endDate,
      captainId,
      userId,
      page = 1,
      limit = 50,
    } = req.query;

    const query = {};

    // Status Filter
    if (status && status !== 'ALL' && status !== 'all') {
      if (status === 'IN_PROGRESS' || status === 'ACTIVE') {
        query.status = { $in: IN_PROGRESS_STATUSES };
      } else {
        query.status = status;
      }
    }

    // Vehicle Type Filter — match slug or name loosely (#63); use $and so it does not clash with search $or
    if (vehicleType && vehicleType !== 'ALL' && vehicleType !== 'all') {
      const escaped = String(vehicleType).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const vehicleMatch = {
        $or: [
          { 'vehicleSnapshot.slug': { $regex: new RegExp(`^${escaped}$`, 'i') } },
          { 'vehicleSnapshot.name': { $regex: new RegExp(escaped.replace(/-/g, '[-\\s]?'), 'i') } },
          { 'vehicleType.slug': { $regex: new RegExp(`^${escaped}$`, 'i') } },
        ],
      };
      query.$and = [...(query.$and || []), vehicleMatch];
    }

    // Captain Filter
    if (captainId && mongoose.Types.ObjectId.isValid(captainId)) {
      query.captainId = captainId;
    }

    // User Filter
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      query.user = userId;
    }

    // Date Range Filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // Text Search
    if (search && String(search).trim()) {
      const q = String(search).trim();
      const qRegex = new RegExp(q, 'i');
      query.$or = [
        { bookingId: qRegex },
        { 'pickupLocation.address': qRegex },
        { 'pickupLocation.city': qRegex },
        { 'dropLocation.address': qRegex },
        { 'dropLocation.city': qRegex },
        { 'goods.category': qRegex },
        { 'vehicleSnapshot.name': qRegex },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [rawBookings, allSummaries] = await Promise.all([
      TransportBooking.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      TransportBooking.find({}).select('status fareBreakdown.totalFare captainEarnings').lean(),
    ]);

    const total = allSummaries.length;

    // Fast batch population for users & captains in parallel
    const userIds = [...new Set(rawBookings.map((b) => b.user?.toString()).filter(Boolean))];
    const captainIds = [...new Set(rawBookings.map((b) => b.captainId?.toString()).filter(Boolean))];

    const [usersList, captainsList] = await Promise.all([
      userIds.length > 0 ? User.find({ _id: { $in: userIds } }).select('name phone email').lean() : [],
      captainIds.length > 0
        ? Captain.find({ _id: { $in: captainIds } })
            .select('name phone vehicleType vehicleNumber isOnline ratingAverage ratingCount')
            .lean()
        : [],
    ]);

    const userMap = new Map((usersList || []).map((u) => [u._id.toString(), u]));
    const captainMap = new Map((captainsList || []).map((c) => [c._id.toString(), c]));

    const bookings = rawBookings.map((b) => ({
      ...b,
      user: b.user ? userMap.get(b.user.toString()) || { _id: b.user, name: 'Customer' } : null,
      captainId: b.captainId ? captainMap.get(b.captainId.toString()) || null : null,
    }));

    const stats = {
      totalBookings: total,
      searchingCount: allSummaries.filter((b) => b.status === 'SEARCHING_CAPTAIN').length,
      inProgressCount: allSummaries.filter((b) => IN_PROGRESS_STATUSES.includes(b.status)).length,
      completedCount: allSummaries.filter((b) => b.status === 'RIDE_COMPLETED').length,
      cancelledCount: allSummaries.filter((b) => b.status === 'CANCELLED').length,
      totalRevenue: allSummaries
        .filter((b) => b.status === 'RIDE_COMPLETED')
        .reduce((acc, b) => acc + (b.fareBreakdown?.totalFare || 0), 0),
      totalCaptainEarnings: allSummaries
        .filter((b) => b.status === 'RIDE_COMPLETED')
        .reduce((acc, b) => acc + (b.captainEarnings || 0), 0),
    };

    return res.status(200).json({
      success: true,
      bookings,
      stats,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)) || 1,
      },
    });
  } catch (error) {
    console.error('[getAdminTransportBookings ERROR]', error);
    // Do not pretend success with empty data — that hides logistics bookings (#63)
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load transport bookings',
      bookings: [],
      stats: {
        totalBookings: 0,
        searchingCount: 0,
        inProgressCount: 0,
        completedCount: 0,
        cancelledCount: 0,
        totalRevenue: 0,
        totalCaptainEarnings: 0,
      },
      pagination: { total: 0, page: 1, limit: 50, pages: 1 },
    });
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// Admin: Manual Captain Assignment / Reassignment
// PUT /api/transport/bookings/admin/:bookingId/assign-captain
// ──────────────────────────────────────────────────────────────────────────────
export const adminAssignCaptainToTransportBooking = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { captainId, captainEarnings } = req.body;

    if (!captainId || !mongoose.Types.ObjectId.isValid(captainId)) {
      return res.status(400).json({ success: false, message: 'Valid Captain ID is required.' });
    }

    const captain = await Captain.findById(captainId);
    if (!captain) {
      return res.status(404).json({ success: false, message: 'Captain not found.' });
    }

    const isMongoId = mongoose.Types.ObjectId.isValid(bookingId);
    const booking = await TransportBooking.findOne(
      isMongoId ? { $or: [{ _id: bookingId }, { bookingId }] } : { bookingId }
    );

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Transport booking not found.' });
    }

    if (booking.status === 'RIDE_COMPLETED' || booking.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: `Cannot assign captain to booking in ${booking.status} state.`,
      });
    }

    const pickupOtp = generateRideOtp();
    const dropOtp = generateRideOtp();
    const earnings = Number(captainEarnings || booking.captainEarnings || (booking.fareBreakdown.totalFare * 0.85).toFixed(2));
    const now = new Date();

    booking.captainId = captain._id;
    booking.status = 'CAPTAIN_ASSIGNED';
    booking.captainAssignedAt = now;
    booking.pickupOtp = pickupOtp;
    booking.dropOtp = dropOtp;
    booking.captainEarnings = earnings;
    booking.captainEarning = earnings;

    booking.statusHistory.push({
      status: 'CAPTAIN_ASSIGNED',
      changedBy: 'system',
      changedById: req.user.id || req.user._id,
      reason: `Assigned manually by Admin to Captain "${captain.name}" (${captain.phone})`,
      timestamp: now,
    });

    await booking.save();

    // Push Notification to Captain
    await CaptainNotification.create({
      captainId: captain._id,
      type: 'NEW_JOB_ASSIGNED',
      title: '🚚 New Vehicle Transport Assigned by Admin!',
      message: `Admin assigned you Transport Job #${booking.bookingId} (${booking.vehicleSnapshot.name}). Payout: ₹${earnings}`,
      orderId: booking.bookingId,
      icon: 'local_shipping',
    }).catch(() => {});

    res.status(200).json({
      success: true,
      message: `Captain "${captain.name}" assigned successfully to Transport Booking #${booking.bookingId}!`,
      booking,
    });
  } catch (error) {
    console.error('[adminAssignCaptainToTransportBooking ERROR]', error);
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// Admin: Cancel Transport Booking
// PUT /api/transport/bookings/admin/:bookingId/cancel
// ──────────────────────────────────────────────────────────────────────────────
export const adminCancelTransportBooking = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const { reason = 'Cancelled by Administrator' } = req.body;

    const isMongoId = mongoose.Types.ObjectId.isValid(bookingId);
    const booking = await TransportBooking.findOne(
      isMongoId ? { $or: [{ _id: bookingId }, { bookingId }] } : { bookingId }
    );

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    if (booking.status === 'RIDE_COMPLETED') {
      return res.status(400).json({ success: false, message: 'Cannot cancel an already completed ride.' });
    }

    const now = new Date();
    booking.status = 'CANCELLED';
    booking.cancelledBy = 'system';
    booking.cancellationReason = reason.trim();
    booking.cancelledAt = now;

    booking.statusHistory.push({
      status: 'CANCELLED',
      changedBy: 'system',
      changedById: req.user.id || req.user._id,
      reason: reason.trim(),
      timestamp: now,
    });

    await booking.save();

    if (booking.captainId) {
      await CaptainNotification.create({
        captainId: booking.captainId,
        type: 'JOB_CANCELLED',
        title: 'Transport Job Cancelled by Admin',
        message: `Booking #${booking.bookingId} has been cancelled by Admin. Reason: ${reason}`,
        orderId: booking.bookingId,
        icon: 'cancel',
      }).catch(() => {});
    }

    res.status(200).json({
      success: true,
      message: `Transport Booking #${booking.bookingId} has been cancelled.`,
      booking,
    });
  } catch (error) {
    console.error('[adminCancelTransportBooking ERROR]', error);
    next(error);
  }
};
