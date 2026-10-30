import mongoose from 'mongoose';
import TransportBooking from '../models/TransportBooking.model.js';
import Captain from '../models/Captain.model.js';
import CaptainNotification from '../models/CaptainNotification.model.js';
import CaptainTransaction from '../models/CaptainTransaction.model.js';
import { getVehicleMatchPattern } from './transportBookingController.js';
import { invalidateCaptainDashboardCache } from './captainController.js';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────
const generateRideOtp = () => Math.floor(1000 + Math.random() * 9000).toString();
const generateTxnId = () => `CTX-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

const ACTIVE_LOCATION_STATUSES = [
  'CAPTAIN_ASSIGNED',
  'CAPTAIN_ARRIVING',
  'CAPTAIN_REACHED_PICKUP',
  'RIDE_STARTED',
  'CAPTAIN_REACHED_DROP',
];

const findCaptainBooking = (captainId, bookingId) => {
  const isMongoId = mongoose.Types.ObjectId.isValid(bookingId);
  const query = {
    ...(isMongoId ? { $or: [{ _id: bookingId }, { bookingId }] } : { bookingId }),
    captainId,
  };
  return TransportBooking.findOne(query);
};

const collectPhotoUrls = (body = {}) => {
  const raw = [];
  if (Array.isArray(body.photos)) raw.push(...body.photos);
  if (typeof body.photos === 'string') raw.push(body.photos);
  if (body.proofUrl) raw.push(body.proofUrl);
  if (body.url) raw.push(body.url);
  const urls = [];
  for (const item of raw) {
    const url = String(item?.url || item || '').trim();
    if (!url) continue;
    if (!/^https?:\/\//i.test(url) && !url.startsWith('/uploads/')) continue;
    if (!urls.includes(url)) urls.push(url);
  }
  return urls.slice(0, 6);
};

const hasPickupPhotos = (booking) => Array.isArray(booking?.pickupPhotos) && booking.pickupPhotos.length > 0;
const hasDropPhotos = (booking) =>
  (Array.isArray(booking?.dropPhotos) && booking.dropPhotos.length > 0) || Boolean(booking?.proofOfDeliveryUrl);

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/captain/transport/requests
// Auth: Captain required
// Returns all pending transport requests for the logged-in captain with matching vehicle
// ──────────────────────────────────────────────────────────────────────────────
const netTransportEarnings = (booking, myRequest) => {
  if (myRequest?.earnings != null && Number.isFinite(Number(myRequest.earnings))) {
    return Number(myRequest.earnings);
  }
  if (booking.captainEarnings != null && Number.isFinite(Number(booking.captainEarnings))) {
    return Number(booking.captainEarnings);
  }
  const fare = Number(booking.fareBreakdown?.totalFare || 0);
  const rate = Number(
    booking.captainCommissionRate !== undefined ? booking.captainCommissionRate : 5
  );
  const comm = Number(
    booking.captainCommissionAmount !== undefined
      ? booking.captainCommissionAmount
      : (fare * rate) / 100
  );
  return Math.round((fare - comm) * 100) / 100;
};

const haversineKmPts = (lat1, lon1, lat2, lon2) => {
  if (![lat1, lon1, lat2, lon2].every((n) => Number.isFinite(n))) return null;
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 100) / 100;
};

export const getTransportRequests = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const captain = await Captain.findById(captainId).select('vehicleType liveLocation location workingArea');
    const vehiclePattern = getVehicleMatchPattern(captain?.vehicleType);
    const maxRangeKm = Math.max(1, Number(req.query.maxKm || req.query.rangeKm || 50));

    const baseQuery = {
      status: 'SEARCHING_CAPTAIN',
      captainRequests: {
        $not: {
          $elemMatch: {
            captainId: new mongoose.Types.ObjectId(captainId),
            status: 'REJECTED',
          },
        },
      },
    };

    let query = { ...baseQuery };
    if (vehiclePattern) {
      const matchCount = await TransportBooking.countDocuments({
        ...baseQuery,
        $or: [
          { 'vehicleSnapshot.name': { $regex: vehiclePattern, $options: 'i' } },
          { 'vehicleSnapshot.slug': { $regex: vehiclePattern, $options: 'i' } },
        ],
      });
      if (matchCount > 0) {
        query.$or = [
          { 'vehicleSnapshot.name': { $regex: vehiclePattern, $options: 'i' } },
          { 'vehicleSnapshot.slug': { $regex: vehiclePattern, $options: 'i' } },
        ];
      }
    }

    const bookings = await TransportBooking.find(query)
      .populate('user', 'name phone')
      .populate('vehicleTypeId', 'name slug icon')
      .sort({ createdAt: -1 })
      .limit(40);

    const captainLat = Number(
      captain?.liveLocation?.coordinates?.[1] ?? captain?.location?.coordinates?.[1]
    );
    const captainLng = Number(
      captain?.liveLocation?.coordinates?.[0] ?? captain?.location?.coordinates?.[0]
    );
    const hasCaptainLoc = Number.isFinite(captainLat) && Number.isFinite(captainLng);

    const formattedRequests = bookings
      .map((b) => {
        const myRequest = b.captainRequests?.find(
          (r) => r.captainId?.toString() === captainId
        );
        const pickupLat = Number(b.pickupLocation?.lat);
        const pickupLng = Number(b.pickupLocation?.lng);
        const distanceFromCaptainKm = hasCaptainLoc
          ? haversineKmPts(captainLat, captainLng, pickupLat, pickupLng)
          : null;
        const fare = Number(b.fareBreakdown?.totalFare || 0);
        const commRate = Number(
          b.captainCommissionRate !== undefined ? b.captainCommissionRate : 5
        );
        const commAmt = Number(
          b.captainCommissionAmount !== undefined
            ? b.captainCommissionAmount
            : ((fare * commRate) / 100).toFixed(2)
        );
        const earnings = netTransportEarnings(b, myRequest);

        return {
          _id: b._id,
          bookingId: b.bookingId,
          pickupLocation: b.pickupLocation,
          dropLocation: b.dropLocation,
          stops: b.stops,
          distanceKm: b.distanceKm,
          distanceFromCaptainKm,
          estimatedDurationMin: b.estimatedDurationMin,
          goods: b.goods,
          vehicleSnapshot: b.vehicleSnapshot,
          paymentMethod: b.paymentMethod,
          paymentStatus: b.paymentStatus,
          fareBreakdown: b.fareBreakdown || {},
          captainCommissionRate: commRate,
          captainCommissionAmount: commAmt,
          estimatedEarnings: earnings,
          captainEarnings: earnings,
          sentAt: myRequest?.sentAt || b.createdAt,
          customerName: b.user?.name || 'Customer',
          customerPhone: b.user?.phone || '',
        };
      })
      .filter((r) => {
        // #69 — when captain GPS is known, only show requests within range
        if (!hasCaptainLoc || r.distanceFromCaptainKm == null) return true;
        return r.distanceFromCaptainKm <= maxRangeKm;
      })
      .sort((a, b) => {
        if (a.distanceFromCaptainKm == null && b.distanceFromCaptainKm == null) return 0;
        if (a.distanceFromCaptainKm == null) return 1;
        if (b.distanceFromCaptainKm == null) return -1;
        return a.distanceFromCaptainKm - b.distanceFromCaptainKm;
      })
      .slice(0, 20);

    res.status(200).json({
      success: true,
      count: formattedRequests.length,
      maxRangeKm: hasCaptainLoc ? maxRangeKm : null,
      requests: formattedRequests,
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// PUT /api/captain/transport/requests/:bookingId/accept
// Auth: Captain required
// Atomic acceptance: only the FIRST captain can claim the booking
// Generates the initial secure Pickup OTP
// ──────────────────────────────────────────────────────────────────────────────
export const acceptTransportRequest = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const { bookingId } = req.params;

    const captain = await Captain.findById(captainId);
    if (!captain || captain.status !== 'approved') {
      return res.status(403).json({
        success: false,
        message: 'Your captain account is not approved or is inactive',
      });
    }

    const now = new Date();
    const isMongoId = mongoose.Types.ObjectId.isValid(bookingId);
    const pickupOtp = generateRideOtp();

    // Find the target booking to get the precalculated earnings
    const existing = await TransportBooking.findOne(
      isMongoId ? { $or: [{ _id: bookingId }, { bookingId }] } : { bookingId }
    );

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Transport booking not found' });
    }

    if (existing.status !== 'SEARCHING_CAPTAIN') {
      return res.status(400).json({
        success: false,
        message: 'This transport request has already been accepted by another captain or is no longer available.',
      });
    }

    const myReq = existing.captainRequests?.find(
      (r) => r.captainId.toString() === captainId
    );
    const finalEarnings = netTransportEarnings(existing, myReq);

    // ── ATOMIC ACCEPTANCE QUERY ──
    const booking = await TransportBooking.findOneAndUpdate(
      {
        _id: existing._id,
        status: 'SEARCHING_CAPTAIN', // Concurrency lock
      },
      {
        $set: {
          status: 'CAPTAIN_ASSIGNED',
          captainId: new mongoose.Types.ObjectId(captainId),
          captainAssignedAt: now,
          captainEarnings: finalEarnings,
          pickupOtp,
          pickupOtpVerified: false,
          'captainRequests.$[elem].status': 'ACCEPTED',
          'captainRequests.$[elem].respondedAt': now,
          'captainRequests.$[others].status': 'EXPIRED',
        },
        $push: {
          statusHistory: {
            status: 'CAPTAIN_ASSIGNED',
            changedBy: 'captain',
            changedById: captainId,
            reason: `Accepted by Captain ${captain.name}`,
            timestamp: now,
          },
        },
      },
      {
        arrayFilters: [
          { 'elem.captainId': new mongoose.Types.ObjectId(captainId) },
          {
            'others.captainId': { $ne: new mongoose.Types.ObjectId(captainId) },
            'others.status': 'PENDING',
          },
        ],
        new: true,
      }
    )
      .populate('user', 'name phone')
      .populate('vehicleTypeId', 'name slug icon');

    if (!booking) {
      return res.status(400).json({
        success: false,
        message: 'This transport request has already been accepted by another captain.',
      });
    }

    console.log(
      `[CaptainTransport] Captain "${captain.name}" accepted Booking ${booking.bookingId}. Payout: ₹${finalEarnings}, Pickup OTP: ${pickupOtp}`
    );

    // Confirmation notification for the captain
    await CaptainNotification.create({
      captainId,
      type: 'JOB_ASSIGNED',
      title: 'Transport Request Accepted!',
      message: `You accepted booking #${booking.bookingId}. Pickup: ${booking.pickupLocation.address}. Proceed to pickup.`,
      orderId: booking.bookingId,
      amount: finalEarnings,
      icon: 'local_shipping',
    });

    invalidateCaptainDashboardCache(captainId);

    res.status(200).json({
      success: true,
      message: 'Transport request accepted successfully! Please proceed to the pickup location.',
      booking,
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// PUT /api/captain/transport/requests/:bookingId/reject
// Auth: Captain required
// Rejects request for THIS captain only; booking remains available for others
// ──────────────────────────────────────────────────────────────────────────────
export const rejectTransportRequest = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const { bookingId } = req.params;
    const now = new Date();

    const isMongoId = mongoose.Types.ObjectId.isValid(bookingId);
    const query = isMongoId
      ? { $or: [{ _id: bookingId }, { bookingId }] }
      : { bookingId };

    const booking = await TransportBooking.findOneAndUpdate(
      query,
      {
        $set: {
          'captainRequests.$[elem].status': 'REJECTED',
          'captainRequests.$[elem].respondedAt': now,
        },
      },
      {
        arrayFilters: [{ 'elem.captainId': new mongoose.Types.ObjectId(captainId) }],
        new: true,
      }
    );

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Transport booking not found' });
    }

    console.log(`[CaptainTransport] Captain ${captainId} rejected Booking ${booking.bookingId}`);
    invalidateCaptainDashboardCache(captainId);

    res.status(200).json({
      success: true,
      message: 'Transport request rejected',
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/captain/transport/active
// Auth: Captain required
// Returns the ongoing active transport booking for this captain
// ──────────────────────────────────────────────────────────────────────────────
export const getActiveTransportDelivery = async (req, res, next) => {
  try {
    const captainId = req.user.id;

    const booking = await TransportBooking.findOne({
      captainId,
      $or: [
        { status: { $in: ACTIVE_LOCATION_STATUSES } },
        {
          status: 'RIDE_COMPLETED',
          'returnRoute.required': true,
          'returnRoute.status': { $in: ['PENDING', 'IN_PROGRESS'] },
        },
      ],
    })
      .populate('user', 'name phone email')
      .populate('vehicleTypeId', 'name slug icon')
      .sort({ captainAssignedAt: -1 });

    res.status(200).json({
      success: true,
      booking: booking || null,
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// PUT /api/captain/transport/active/:bookingId/status
// Auth: Captain required
// Updates ride milestone: CAPTAIN_ARRIVING -> CAPTAIN_REACHED_PICKUP -> CAPTAIN_REACHED_DROP -> RIDE_COMPLETED
// ──────────────────────────────────────────────────────────────────────────────
export const updateTransportStatus = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const { bookingId } = req.params;
    const { status, proofUrl } = req.body;

    const allowedStatuses = ['CAPTAIN_ARRIVING', 'CAPTAIN_REACHED_PICKUP', 'RIDE_STARTED', 'CAPTAIN_REACHED_DROP', 'RIDE_COMPLETED'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status update. Must be one of: ${allowedStatuses.join(', ')}.`,
      });
    }

    const isMongoId = mongoose.Types.ObjectId.isValid(bookingId);
    const query = {
      ...(isMongoId ? { $or: [{ _id: bookingId }, { bookingId }] } : { bookingId }),
      captainId,
    };

    const booking = await TransportBooking.findOne(query);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Transport booking not found or not assigned to you',
      });
    }

    if (status === 'CAPTAIN_ARRIVING' && !['CAPTAIN_ASSIGNED', 'CAPTAIN_ARRIVING'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: 'Navigation to pickup is available after the request is accepted.',
      });
    }

    if (
      status === 'CAPTAIN_REACHED_PICKUP' &&
      !['CAPTAIN_ASSIGNED', 'CAPTAIN_ARRIVING', 'CAPTAIN_REACHED_PICKUP'].includes(booking.status)
    ) {
      return res.status(400).json({
        success: false,
        message: 'You can mark arrival at pickup only after this ride is assigned to you.',
      });
    }

    if (status === 'RIDE_STARTED' && (!booking.pickupOtpVerified || !hasPickupPhotos(booking))) {
      return res.status(400).json({
        success: false,
        message: 'Capture goods photos and verify the pickup OTP before starting the ride.',
      });
    }

    if (status === 'CAPTAIN_REACHED_DROP' && !['RIDE_STARTED', 'CAPTAIN_REACHED_DROP'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: 'Reach the drop only after the ride has started.',
      });
    }

    if (status === 'RIDE_COMPLETED' && (!booking.dropOtpVerified || !hasDropPhotos(booking))) {
      return res.status(400).json({
        success: false,
        message: 'Upload a delivery photo and verify the drop OTP before completing this ride.',
      });
    }

    const now = new Date();
    const updates = { status };

    if (status === 'CAPTAIN_REACHED_PICKUP') {
      updates.captainReachedPickupAt = now;
      if (!booking.pickupOtp) {
        updates.pickupOtp = generateRideOtp();
      }
    }

    if (status === 'RIDE_STARTED') {
      updates.pickupOtpVerified = true;
      updates.pickupOtpVerifiedAt = now;
      updates.rideStartedAt = now;
      if (!booking.dropOtp) {
        updates.dropOtp = generateRideOtp();
      }
    }

    if (status === 'CAPTAIN_REACHED_DROP') {
      updates.captainReachedDropAt = now;
      if (!booking.dropOtp) {
        updates.dropOtp = generateRideOtp();
      }
    }

    if (status === 'RIDE_COMPLETED') {
      updates.pickupOtpVerified = true;
      updates.dropOtpVerified = true;
      updates.dropOtpVerifiedAt = now;
      updates.rideCompletedAt = now;
      updates.paymentStatus = 'Paid';
      if (proofUrl) updates.proofOfDeliveryUrl = proofUrl;
      updates.liveLocation = { lat: null, lng: null, heading: null, accuracy: null, updatedAt: null };

      // Credit wallet
      const totalFare = Number(booking.fareBreakdown?.totalFare || 0);
      const captainCommRate = Number(booking.captainCommissionRate !== undefined ? booking.captainCommissionRate : 5);
      const captainCommAmount = Number(booking.captainCommissionAmount !== undefined ? booking.captainCommissionAmount : ((totalFare * captainCommRate) / 100).toFixed(2));
      const earnings = booking.captainEarnings || Math.round((totalFare - captainCommAmount) * 100) / 100 || 0;

      const captain = await Captain.findById(captainId);
      if (captain && earnings > 0 && booking.status !== 'RIDE_COMPLETED') {
        const balBefore = captain.walletBalance || 0;
        captain.walletBalance = balBefore + earnings;
        await captain.save();

        await CaptainTransaction.create({
          transactionId: generateTxnId(),
          captainId,
          orderId: booking.bookingId,
          type: 'CREDIT',
          amount: earnings,
          grossAmount: totalFare,
          commissionRate: captainCommRate,
          commissionAmount: captainCommAmount,
          netAmount: earnings,
          balanceBefore: balBefore,
          balanceAfter: captain.walletBalance,
          description: `Transport ride completed: ${booking.bookingId}`,
          status: 'COMPLETED',
        });

        await CaptainNotification.create({
          captainId,
          type: 'PAYMENT',
          title: 'Transport Earnings Credited!',
          message: `₹${earnings.toFixed(2)} credited to your wallet for Transport Booking #${booking.bookingId}`,
          orderId: booking.bookingId,
          amount: earnings,
          icon: 'account_balance_wallet',
        });
      }
    }

    const updatedBooking = await TransportBooking.findByIdAndUpdate(
      booking._id,
      {
        $set: updates,
        $push: {
          statusHistory: {
            status,
            changedBy: 'captain',
            changedById: captainId,
            reason: `Captain updated status to ${status}`,
            timestamp: now,
          },
        },
      },
      { new: true }
    )
      .populate('user', 'name phone')
      .populate('vehicleTypeId', 'name slug icon');

    console.log(`[CaptainTransport] Booking ${booking.bookingId} status updated to "${status}"`);
    invalidateCaptainDashboardCache(captainId);

    res.status(200).json({
      success: true,
      message: `Status updated to ${status}`,
      booking: updatedBooking,
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/captain/transport/active/:bookingId/verify-pickup-otp
// Auth: Captain required
// Verifies Pickup OTP and starts the ride (RIDE_STARTED)
// Generates the Drop OTP for the next stage
// ──────────────────────────────────────────────────────────────────────────────
export const verifyPickupOtp = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const { bookingId } = req.params;
    const { otp } = req.body;

    if (!otp || String(otp).trim().length !== 4) {
      return res.status(400).json({
        success: false,
        message: 'A 4-digit Pickup OTP is required',
      });
    }

    const isMongoId = mongoose.Types.ObjectId.isValid(bookingId);
    const query = {
      ...(isMongoId ? { $or: [{ _id: bookingId }, { bookingId }] } : { bookingId }),
      captainId,
    };

    const booking = await TransportBooking.findOne(query);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Transport booking not found or not assigned to you',
      });
    }

    if (booking.pickupOtpVerified) {
      return res.status(400).json({
        success: false,
        message: 'Pickup OTP has already been verified for this booking',
      });
    }

    if (booking.status === 'CANCELLED' || booking.status === 'RIDE_COMPLETED') {
      return res.status(400).json({
        success: false,
        message: `Cannot verify pickup for a ${booking.status.toLowerCase()} booking`,
      });
    }

    if (booking.status !== 'CAPTAIN_REACHED_PICKUP') {
      return res.status(400).json({
        success: false,
        message: 'Mark yourself as arrived at pickup before verifying the pickup OTP.',
      });
    }

    if (!hasPickupPhotos(booking)) {
      return res.status(400).json({
        success: false,
        message: 'Upload at least one photo of the goods before verifying the pickup OTP.',
      });
    }

    // Attempt count check (prevent brute force)
    if (booking.pickupOtpAttempts >= 6) {
      return res.status(429).json({
        success: false,
        message: 'Too many incorrect OTP attempts. Please contact customer support.',
      });
    }

    // OTP validation (supports dev bypass '0000', '1234', '123456')
    const cleanOtp = String(otp).trim();
    const isMock = ['0000', '1234', '123456'].includes(cleanOtp);
    if (cleanOtp !== booking.pickupOtp && !isMock) {
      await TransportBooking.findByIdAndUpdate(booking._id, {
        $inc: { pickupOtpAttempts: 1 },
      });
      return res.status(400).json({
        success: false,
        message: 'Invalid Pickup OTP. Please ask the customer for the correct code shown on their screen.',
      });
    }

    const now = new Date();
    const dropOtp = generateRideOtp();

    // ── Unlock Stage 2: RIDE_STARTED & Drop OTP Generation ──
    const updatedBooking = await TransportBooking.findByIdAndUpdate(
      booking._id,
      {
        $set: {
          pickupOtpVerified: true,
          pickupOtpVerifiedAt: now,
          status: 'RIDE_STARTED',
          rideStartedAt: now,
          dropOtp, // Generate separate Drop OTP
          dropOtpVerified: false,
        },
        $push: {
          statusHistory: {
            status: 'RIDE_STARTED',
            changedBy: 'captain',
            changedById: captainId,
            reason: 'Pickup OTP verified successfully. Goods loaded and transport ride started.',
            timestamp: now,
          },
        },
      },
      { new: true }
    )
      .populate('user', 'name phone')
      .populate('vehicleTypeId', 'name slug icon');

    console.log(
      `[CaptainTransport] Booking ${booking.bookingId} Pickup OTP verified. Ride started. Drop OTP: ${dropOtp}`
    );
    invalidateCaptainDashboardCache(captainId);

    res.status(200).json({
      success: true,
      message: 'Pickup OTP verified successfully! Ride has started.',
      booking: updatedBooking,
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/captain/transport/active/:bookingId/verify-drop-otp
// Auth: Captain required
// Verifies Drop OTP, completes ride, and credits Captain wallet
// ──────────────────────────────────────────────────────────────────────────────
export const verifyDropOtp = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const { bookingId } = req.params;
    const { otp, proofUrl } = req.body;

    if (!otp || String(otp).trim().length !== 4) {
      return res.status(400).json({
        success: false,
        message: 'A 4-digit Drop OTP is required',
      });
    }

    const isMongoId = mongoose.Types.ObjectId.isValid(bookingId);
    const query = {
      ...(isMongoId ? { $or: [{ _id: bookingId }, { bookingId }] } : { bookingId }),
      captainId,
    };

    const booking = await TransportBooking.findOne(query);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Transport booking not found or not assigned to you',
      });
    }

    if (booking.dropOtpVerified || booking.status === 'RIDE_COMPLETED') {
      return res.status(200).json({
        success: true,
        message: 'This transport ride has already been completed and verified',
        booking,
      });
    }

    if (booking.status !== 'CAPTAIN_REACHED_DROP') {
      return res.status(400).json({
        success: false,
        message: 'Mark yourself as arrived at the drop before verifying the drop OTP.',
      });
    }

    const incomingDropPhotos = collectPhotoUrls({ proofUrl });
    if (!hasDropPhotos(booking) && incomingDropPhotos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Upload at least one delivery photo before verifying the drop OTP.',
      });
    }

    // OTP validation (supports dev bypass '0000', '1234', '123456', dropOtp, or pickupOtp)
    const cleanOtp = String(otp).trim();
    const isDevBypass = ['0000', '1234', '123456'].includes(cleanOtp);
    const isDropOtpMatch = booking.dropOtp && cleanOtp === String(booking.dropOtp).trim();
    const isPickupOtpMatch = booking.pickupOtp && cleanOtp === String(booking.pickupOtp).trim();

    if (!isDevBypass && !isDropOtpMatch && !isPickupOtpMatch) {
      await TransportBooking.findByIdAndUpdate(booking._id, {
        $inc: { dropOtpAttempts: 1 },
      });
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP code. Please ask the recipient for the code (or use 123456 / 0000).',
      });
    }

    const now = new Date();
    const earnings = netTransportEarnings(booking) || 0;
    const dropPhotos = Array.isArray(booking.dropPhotos) ? [...booking.dropPhotos] : [];
    incomingDropPhotos.forEach((url) => {
      if (!dropPhotos.some((photo) => photo.url === url)) {
        dropPhotos.push({ url, uploadedAt: now });
      }
    });
    const storedProof = booking.proofOfDeliveryUrl || dropPhotos[0]?.url || null;

    // ── Complete the Booking ──
    const updatedBooking = await TransportBooking.findByIdAndUpdate(
      booking._id,
      {
        $set: {
          pickupOtpVerified: true,
          pickupOtpVerifiedAt: booking.pickupOtpVerifiedAt || now,
          dropOtpVerified: true,
          dropOtpVerifiedAt: now,
          status: 'RIDE_COMPLETED',
          rideCompletedAt: now,
          paymentStatus: 'Paid',
          dropPhotos,
          ...(storedProof ? { proofOfDeliveryUrl: storedProof } : {}),
          liveLocation: { lat: null, lng: null, heading: null, accuracy: null, updatedAt: null },
        },
        $push: {
          statusHistory: {
            status: 'RIDE_COMPLETED',
            changedBy: 'captain',
            changedById: captainId,
            reason: 'Drop OTP verified successfully. Goods safely delivered.',
            timestamp: now,
          },
        },
      },
      { new: true }
    )
      .populate('user', 'name phone')
      .populate('vehicleTypeId', 'name slug icon');

    // ── Credit Captain Wallet ──
    const captain = await Captain.findById(captainId);
    if (captain && earnings > 0 && booking.status !== 'RIDE_COMPLETED') {
      const balBefore = captain.walletBalance || 0;
      captain.walletBalance = balBefore + earnings;
      await captain.save();

      await CaptainTransaction.create({
        transactionId: generateTxnId(),
        captainId,
        orderId: booking.bookingId,
        type: 'CREDIT',
        amount: earnings,
        balanceBefore: balBefore,
        balanceAfter: captain.walletBalance,
        description: `Transport ride completed: ${booking.bookingId}`,
        status: 'COMPLETED',
      });

      await CaptainNotification.create({
        captainId,
        type: 'PAYMENT',
        title: 'Transport Earnings Credited!',
        message: `₹${earnings.toFixed(2)} credited to your wallet for Transport Booking #${booking.bookingId}`,
        orderId: booking.bookingId,
        amount: earnings,
        icon: 'account_balance_wallet',
      });
    }

    console.log(
      `[CaptainTransport] Booking ${booking.bookingId} completed! Payout ₹${earnings} credited to Captain ${captainId}`
    );
    invalidateCaptainDashboardCache(captainId);

    res.status(200).json({
      success: true,
      message: 'Drop OTP verified! Transport ride completed successfully.',
      booking: updatedBooking,
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/captain/transport/active/:bookingId/proof
// Auth: Captain required
// Submits optional photo proof of delivery
// ──────────────────────────────────────────────────────────────────────────────
export const submitTransportProof = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const { bookingId } = req.params;
    const { proofUrl } = req.body;

    if (!proofUrl) {
      return res.status(400).json({ success: false, message: 'proofUrl is required' });
    }

    const isMongoId = mongoose.Types.ObjectId.isValid(bookingId);
    const query = {
      ...(isMongoId ? { $or: [{ _id: bookingId }, { bookingId }] } : { bookingId }),
      captainId,
    };

    const now = new Date();
    const photoUrl = collectPhotoUrls({ proofUrl })[0];
    const booking = await TransportBooking.findOneAndUpdate(
      query,
      {
        $set: { proofOfDeliveryUrl: proofUrl },
        ...(photoUrl
          ? {
              $addToSet: {
                dropPhotos: { url: photoUrl, uploadedAt: now },
              },
            }
          : {}),
      },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Proof of delivery submitted successfully',
      proofUrl,
    });
  } catch (error) {
    next(error);
  }
};

const saveStagePhotos = async (req, res, next, stage) => {
  try {
    const captainId = req.user.id;
    const booking = await findCaptainBooking(captainId, req.params.bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Transport booking not found or not assigned to you' });
    }

    const expectedStatus = stage === 'pickup' ? 'CAPTAIN_REACHED_PICKUP' : 'CAPTAIN_REACHED_DROP';
    if (booking.status !== expectedStatus) {
      return res.status(400).json({
        success: false,
        message:
          stage === 'pickup'
            ? 'Goods photos can be uploaded after you arrive at pickup.'
            : 'Delivery photos can be uploaded after you arrive at the drop.',
      });
    }

    const urls = collectPhotoUrls(req.body);
    if (urls.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Upload at least one photo. Use an image URL returned by the upload API.',
      });
    }

    const now = new Date();
    const field = stage === 'pickup' ? 'pickupPhotos' : 'dropPhotos';
    const existing = Array.isArray(booking[field]) ? booking[field] : [];
    urls.forEach((url) => {
      if (!existing.some((photo) => photo.url === url)) {
        existing.push({ url, uploadedAt: now });
      }
    });

    const updates = { [field]: existing };
    if (stage === 'pickup') updates.pickupPhotosVerified = existing.length > 0;
    if (stage === 'drop') updates.proofOfDeliveryUrl = existing[0]?.url || booking.proofOfDeliveryUrl;

    const updated = await TransportBooking.findByIdAndUpdate(booking._id, { $set: updates }, { new: true })
      .populate('user', 'name phone')
      .populate('vehicleTypeId', 'name slug icon');

    res.status(200).json({
      success: true,
      message: stage === 'pickup' ? 'Goods photos saved.' : 'Delivery photos saved.',
      booking: updated,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/captain/transport/active/:bookingId/pickup-photos
export const uploadPickupPhotos = (req, res, next) => saveStagePhotos(req, res, next, 'pickup');

// POST /api/captain/transport/active/:bookingId/drop-photos
export const uploadDropPhotos = (req, res, next) => saveStagePhotos(req, res, next, 'drop');

// POST /api/captain/transport/active/:bookingId/location
export const updateTransportLocation = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return res.status(400).json({ success: false, message: 'A valid latitude and longitude are required.' });
    }

    const booking = await findCaptainBooking(captainId, req.params.bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Transport booking not found or not assigned to you' });
    }
    if (!ACTIVE_LOCATION_STATUSES.includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: 'Location tracking is only available while this trip is active.',
      });
    }

    const now = new Date();
    const liveLocation = {
      lat,
      lng,
      heading: Number.isFinite(Number(req.body.heading)) ? Number(req.body.heading) : null,
      accuracy: Number.isFinite(Number(req.body.accuracy)) ? Number(req.body.accuracy) : null,
      updatedAt: now,
    };

    await TransportBooking.updateOne({ _id: booking._id }, { $set: { liveLocation } });
    await Captain.updateOne(
      { _id: captainId },
      { $set: { liveLocation: { type: 'Point', coordinates: [lng, lat] } } }
    );

    res.status(200).json({ success: true, liveLocation });
  } catch (error) {
    next(error);
  }
};

// POST /api/captain/transport/active/:bookingId/return/complete
// Marks the optional return leg finished. Does not create a booking or credit the wallet again.
export const completeTransportReturn = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const booking = await findCaptainBooking(captainId, req.params.bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Transport booking not found or not assigned to you' });
    }
    if (booking.status !== 'RIDE_COMPLETED' || !booking.returnRoute?.required) {
      return res.status(400).json({
        success: false,
        message: 'This booking does not have a return route to complete.',
      });
    }
    if (booking.returnRoute.status === 'COMPLETED') {
      return res.status(200).json({ success: true, message: 'Return route is already complete.', booking });
    }

    const now = new Date();
    const updated = await TransportBooking.findByIdAndUpdate(
      booking._id,
      {
        $set: {
          'returnRoute.status': 'COMPLETED',
          'returnRoute.completedAt': now,
          liveLocation: { lat: null, lng: null, heading: null, accuracy: null, updatedAt: null },
        },
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Return route completed. The original trip payout is unchanged.',
      booking: updated,
    });
  } catch (error) {
    next(error);
  }
};
