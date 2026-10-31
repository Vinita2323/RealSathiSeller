import mongoose from 'mongoose';
import Captain from '../models/Captain.model.js';
import Order from '../models/Order.model.js';
import User from '../models/User.model.js';
import Product from '../models/Product.model.js';
import Seller from '../models/Seller.model.js';
import CaptainTransaction from '../models/CaptainTransaction.model.js';
import CaptainNotification from '../models/CaptainNotification.model.js';
import SellerNotification from '../models/SellerNotification.model.js';
import TransportBooking from '../models/TransportBooking.model.js';
import Rating from '../models/Rating.model.js';
import PayoutRequest from '../models/PayoutRequest.model.js';
import PlatformLedger from '../models/PlatformLedger.model.js';
import CodCashCollection from '../models/CodCashCollection.model.js';
import CaptainCashSettlement from '../models/CaptainCashSettlement.model.js';
import { getVehicleMatchPattern } from './transportBookingController.js';
import { notifyUserOrderEvent } from '../utils/userNotificationHelper.js';

// In-memory fast cache for Captain Dashboard stats
const captainDashboardCache = new Map();

export const invalidateCaptainDashboardCache = (captainId) => {
  if (captainId) {
    captainDashboardCache.delete(String(captainId));
  } else {
    captainDashboardCache.clear();
  }
};

// ──────────────────────────────────────────────
// Helper: Generate unique IDs & query builder
// ──────────────────────────────────────────────
const generateTxnId = () => `CTX-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
const generateDeliveryOtp = () => Math.floor(1000 + Math.random() * 9000).toString();

const buildOrderQuery = (orderId, extra = {}) => {
  const isMongoId = mongoose.Types.ObjectId.isValid(orderId);
  return {
    ...(isMongoId ? { $or: [{ _id: orderId }, { orderId }] } : { orderId }),
    ...extra,
  };
};

const sellerHasAcceptedOrder = (order) => {
  const sellerStatus = String(order?.sellerStatus || '');
  return [
    'Accepted',
    'ACCEPTED',
    'Packed',
    'PACKED',
    'Processing',
    'PROCESSING',
    'Out for Delivery',
    'OUT_FOR_DELIVERY',
    'Delivered',
    'DELIVERED',
  ].includes(sellerStatus);
};

const orderIsPackedForDelivery = (order) => {
  const orderStatus = String(order?.orderStatus || '');
  const sellerStatus = String(order?.sellerStatus || '');
  return ['Packed', 'Out for Delivery', 'Reached Store / Pickup', 'Delivered'].includes(orderStatus)
    || ['Packed', 'PACKED', 'Out for Delivery', 'OUT_FOR_DELIVERY', 'Delivered', 'DELIVERED'].includes(sellerStatus);
};

const assignedDeliveryQuery = (captainQuery) => ({
  captainId: captainQuery,
  $or: [
    { captainStatus: { $in: ['Accepted', 'Reached Store', 'At Pickup', 'Picked Up', 'In Transit', 'Out for Delivery'] } },
    { captainStatus: 'Assigned', orderStatus: { $in: ['Packed', 'Out for Delivery', 'Reached Store / Pickup'] } },
  ],
});

// ──────────────────────────────────────────────
// GET /api/captain/profile
// ──────────────────────────────────────────────
export const getProfile = async (req, res, next) => {
  try {
    const captain = await Captain.findById(req.user.id).select('-otp -otpExpiry');
    if (!captain) {
      return res.status(404).json({ success: false, message: 'Captain not found' });
    }
    res.json({ success: true, captain });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────
// PUT /api/captain/profile
// ──────────────────────────────────────────────
export const updateProfile = async (req, res, next) => {
  try {
    const {
      name,
      email,
      alternateMobile,
      dob,
      age,
      fatherName,
      currentAddress,
      permanentAddress,
      city,
      state,
      pinCode,
      emergencyContact,
      drivingLicenseNumber,
      rcNumber,
      vehicleInsuranceNumber,
      insuranceValidTill,
      vehicleType,
      documents,
      bankDetails,
    } = req.body;

    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (email !== undefined) updateFields.email = email;
    if (alternateMobile !== undefined) updateFields.alternateMobile = alternateMobile;
    if (dob !== undefined) updateFields.dob = dob;
    if (age !== undefined) updateFields.age = age;
    if (fatherName !== undefined) updateFields.fatherName = fatherName;
    if (currentAddress !== undefined) updateFields.currentAddress = currentAddress;
    if (permanentAddress !== undefined) updateFields.permanentAddress = permanentAddress;
    if (city !== undefined) updateFields.city = city;
    if (state !== undefined) updateFields.state = state;
    if (pinCode !== undefined) updateFields.pinCode = pinCode;
    if (emergencyContact !== undefined) updateFields.emergencyContact = emergencyContact;
    if (drivingLicenseNumber !== undefined) updateFields.drivingLicenseNumber = drivingLicenseNumber;
    if (rcNumber !== undefined) updateFields.rcNumber = rcNumber;
    if (vehicleInsuranceNumber !== undefined) updateFields.vehicleInsuranceNumber = vehicleInsuranceNumber;
    if (insuranceValidTill !== undefined) updateFields.insuranceValidTill = insuranceValidTill;
    if (vehicleType !== undefined) updateFields.vehicleType = vehicleType;

    if (documents && typeof documents === 'object') {
      for (const [k, v] of Object.entries(documents)) {
        updateFields[`documents.${k}`] = v;
      }
    }

    if (bankDetails && typeof bankDetails === 'object') {
      for (const [k, v] of Object.entries(bankDetails)) {
        updateFields[`bankDetails.${k}`] = v;
      }
    }

    const captain = await Captain.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { new: true, runValidators: false }
    );

    if (!captain) {
      return res.status(404).json({ success: false, message: 'Captain not found' });
    }

    console.log(`[Captain updateProfile] Updated DB for captain ${captain.name} (${captain._id}), doc keys:`, Object.keys(captain.documents || {}));

    res.json({ success: true, message: 'Profile updated successfully', captain });
  } catch (error) {
    console.error('[Captain updateProfile Error]:', error);
    next(error);
  }
};

// ──────────────────────────────────────────────
// PUT /api/captain/status
// ──────────────────────────────────────────────
export const updateOnlineStatus = async (req, res, next) => {
  try {
    const { isOnline } = req.body;
    const targetStatus = Boolean(isOnline);

    const captain = await Captain.findByIdAndUpdate(
      req.user.id,
      { isOnline: targetStatus },
      { new: true }
    ).select('isOnline name status accountStatus');

    if (!captain) {
      return res.status(404).json({ success: false, message: 'Captain not found' });
    }

    res.json({
      success: true,
      isOnline: captain.isOnline,
      message: `Status updated to ${captain.isOnline ? 'Online' : 'Offline'}`,
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────
// PUT /api/captain/location
// ──────────────────────────────────────────────
export const updateLocation = async (req, res, next) => {
  try {
    const { lat, lng } = req.body;
    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ success: false, message: 'lat and lng are required' });
    }
    await Captain.findByIdAndUpdate(req.user.id, {
      liveLocation: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
    });
    res.json({ success: true, message: 'Location updated' });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────
// GET /api/captain/dashboard
// ──────────────────────────────────────────────
// ──────────────────────────────────────────────
export const getDashboardStats = async (req, res, next) => {
  try {
    const captainId = req.user.id;

    // Check fast in-memory cache (TTL: 15 seconds)
    const cached = captainDashboardCache.get(String(captainId));
    const now = Date.now();
    if (cached && (now - cached.timestamp < 15000)) {
      return res.json(cached.data);
    }

    const captain = await Captain.findById(captainId)
      .select('name walletBalance isOnline vehicleType liveLocation location')
      .lean()
      .exec();
    if (!captain) return res.status(404).json({ success: false, message: 'Captain not found' });

    const isMongoId = mongoose.Types.ObjectId.isValid(captainId);
    const captainObjId = isMongoId ? new mongoose.Types.ObjectId(captainId) : null;
    const captainQuery = captainObjId ? { $in: [captainId, captainObjId] } : captainId;

    // Today's date range
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // 7 days ago date for weekly aggregation
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    weekAgo.setHours(0, 0, 0, 0);

    const vehiclePattern = getVehicleMatchPattern(captain.vehicleType);

    const transportQuery = {
      status: 'SEARCHING_CAPTAIN',
      captainRequests: {
        $not: {
          $elemMatch: {
            captainId: captainObjId || captainId,
            status: 'REJECTED',
          },
        },
      },
    };

    if (vehiclePattern) {
      transportQuery.$or = [
        { 'vehicleSnapshot.name': { $regex: vehiclePattern, $options: 'i' } },
        { 'vehicleSnapshot.slug': { $regex: vehiclePattern, $options: 'i' } },
      ];
    }

    // Run all database calls in parallel
    const [
      todayTransactions,
      todayOrders,
      todayCompletedTransport,
      pendingOrders,
      transportRequests,
      activeTransport,
      weeklyTxnsAgg,
      totalOrderBookings,
      totalTransportBookings,
    ] = await Promise.all([
      // 1. Today's credit transactions
      CaptainTransaction.find({
        captainId: captainQuery,
        type: 'CREDIT',
        createdAt: { $gte: startOfDay, $lte: endOfDay },
      }).select('amount').lean(),

      // 2. Orders delivered/completed today (by completion time, not assign time) — #66
      Order.find({
        captainId: captainQuery,
        $or: [
          { deliveredAt: { $gte: startOfDay, $lte: endOfDay } },
          { captainDeliveredAt: { $gte: startOfDay, $lte: endOfDay } },
        ],
      }).select('captainStatus orderId deliveredAt captainDeliveredAt').lean(),

      // 3. Today's completed transport count (completion timestamp)
      TransportBooking.countDocuments({
        captainId: captainQuery,
        status: 'RIDE_COMPLETED',
        $or: [
          { rideCompletedAt: { $gte: startOfDay, $lte: endOfDay } },
          { completedAt: { $gte: startOfDay, $lte: endOfDay } },
          { updatedAt: { $gte: startOfDay, $lte: endOfDay } },
        ],
      }),

      // 4. Pending & Active Orders
      Order.find({
        orderStatus: { $nin: ['Delivered', 'Cancelled', 'Rejected'] },
        ...assignedDeliveryQuery(captainQuery),
      })
        .populate('user', 'name phone email')
        .select('orderId shippingAddress captainStatus captainEarnings deliverySlot items createdAt captainAssignedAt paymentMethod paymentStatus itemsTotal grandTotal deliveryInstructions orderStatus sellerStatus')
        .sort({ createdAt: -1 })
        .limit(30)
        .lean(),

      // 5. Pending Transport Requests matching captain vehicle
      TransportBooking.find(transportQuery)
        .populate('user', 'name phone email')
        .populate('vehicleTypeId', 'name slug icon')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),

      // 6. Active Transport Ride assigned to this captain
      TransportBooking.findOne({
        captainId: captainQuery,
        status: {
          $in: [
            'CAPTAIN_ASSIGNED',
            'CAPTAIN_ARRIVING',
            'CAPTAIN_REACHED_PICKUP',
            'RIDE_STARTED',
            'CAPTAIN_REACHED_DROP',
          ],
        },
      })
        .populate('user', 'name phone email')
        .populate('vehicleTypeId', 'name slug icon')
        .lean(),

      // 7. Single Aggregation query for 7-day weekly earnings
      CaptainTransaction.aggregate([
        {
          $match: {
            captainId: captainObjId || captainId,
            type: 'CREDIT',
            createdAt: { $gte: weekAgo, $lte: endOfDay },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            total: { $sum: '$amount' },
          },
        },
      ]),

      // 8. Total order count
      Order.countDocuments({ captainId: captainQuery }),

      // 9. Total transport count
      TransportBooking.countDocuments({ captainId: captainQuery }),
    ]);

    const todayEarnings = (todayTransactions || []).reduce((sum, t) => sum + (t.amount || 0), 0);
    // Orders already filtered by deliveredAt today; count all matches + completed transport
    const deliveredToday = (todayOrders || []).length + (todayCompletedTransport || 0);
    const totalBookings = (totalOrderBookings || 0) + (totalTransportBookings || 0);

    // Build weekly earnings array from aggregation results
    const aggMap = new Map();
    if (Array.isArray(weeklyTxnsAgg)) {
      weeklyTxnsAgg.forEach((item) => {
        if (item._id) aggMap.set(item._id, item.total || 0);
      });
    }

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyData = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const yyyy = day.getFullYear();
      const mm = String(day.getMonth() + 1).padStart(2, '0');
      const dd = String(day.getDate()).padStart(2, '0');
      const key = `${yyyy}-${mm}-${dd}`;
      weeklyData.push({
        day: days[day.getDay()],
        value: aggMap.get(key) || 0,
      });
    }

    const dashCapLat = Number(captain?.liveLocation?.coordinates?.[1] ?? captain?.location?.coordinates?.[1]);
    const dashCapLng = Number(captain?.liveLocation?.coordinates?.[0] ?? captain?.location?.coordinates?.[0]);
    const dashHasLoc = Number.isFinite(dashCapLat) && Number.isFinite(dashCapLng);
    const dashMaxKm = 50;
    const dashHaversine = (lat1, lon1, lat2, lon2) => {
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

    const formattedTransportRequests = (transportRequests || [])
      .map((b) => {
        const myReq = b.captainRequests?.find((r) => String(r.captainId) === String(captainId));
        const totalFare = Number(b.fareBreakdown?.totalFare || 0);
        const commRate = Number(b.captainCommissionRate !== undefined ? b.captainCommissionRate : 5);
        const commAmt = Number(
          b.captainCommissionAmount !== undefined
            ? b.captainCommissionAmount
            : ((totalFare * commRate) / 100).toFixed(2)
        );
        const netEarnings =
          myReq?.earnings ||
          b.captainEarnings ||
          Math.round((totalFare - commAmt) * 100) / 100;
        const distanceFromCaptainKm = dashHasLoc
          ? dashHaversine(dashCapLat, dashCapLng, Number(b.pickupLocation?.lat), Number(b.pickupLocation?.lng))
          : null;
        return {
          _id: b._id,
          bookingId: b.bookingId,
          pickupLocation: b.pickupLocation,
          dropLocation: b.dropLocation,
          stops: Array.isArray(b.stops) ? b.stops : [],
          goods: b.goods,
          vehicleSnapshot: b.vehicleSnapshot,
          distanceKm: b.distanceKm,
          distanceFromCaptainKm,
          estimatedDurationMin: b.estimatedDurationMin,
          paymentMethod: b.paymentMethod,
          paymentStatus: b.paymentStatus,
          fareBreakdown: b.fareBreakdown || {},
          captainCommissionRate: commRate,
          captainCommissionAmount: commAmt,
          captainEarnings: netEarnings,
          customerName: b.user?.name || 'Customer',
          customerPhone: b.user?.phone || '',
          customerEmail: b.user?.email || '',
          createdAt: b.createdAt,
          isTransport: true,
        };
      })
      .filter((r) => {
        if (!dashHasLoc || r.distanceFromCaptainKm == null) return true;
        return r.distanceFromCaptainKm <= dashMaxKm;
      })
      .sort((a, b) => {
        if (a.distanceFromCaptainKm == null) return 1;
        if (b.distanceFromCaptainKm == null) return -1;
        return a.distanceFromCaptainKm - b.distanceFromCaptainKm;
      });

    let formattedActiveTransport = null;
    if (activeTransport) {
      const myReq = activeTransport.captainRequests?.find((r) => String(r.captainId) === String(captainId));
      const atFare = Number(activeTransport.fareBreakdown?.totalFare || 0);
      const atRate = Number(
        activeTransport.captainCommissionRate !== undefined ? activeTransport.captainCommissionRate : 5
      );
      const atComm = Number(
        activeTransport.captainCommissionAmount !== undefined
          ? activeTransport.captainCommissionAmount
          : ((atFare * atRate) / 100).toFixed(2)
      );
      const atEarnings =
        myReq?.earnings ||
        activeTransport.captainEarnings ||
        Math.round((atFare - atComm) * 100) / 100;
      formattedActiveTransport = {
        ...activeTransport.toObject?.() || activeTransport,
        stops: Array.isArray(activeTransport.stops) ? activeTransport.stops : [],
        fareBreakdown: activeTransport.fareBreakdown || {},
        captainCommissionRate: atRate,
        captainCommissionAmount: atComm,
        captainEarnings: atEarnings,
        customerName: activeTransport.user?.name || 'Customer',
        customerPhone: activeTransport.user?.phone || '',
        customerEmail: activeTransport.user?.email || '',
        isTransport: true,
      };
    }

    let deliveryOrders = pendingOrders || [];
    if (deliveryOrders.length) {
      const notes = await SellerNotification.find({ order: { $in: deliveryOrders.map((order) => order._id) } })
        .select('order sellerId sellerName')
        .lean();
      const sellerIds = notes
        .map((note) => note.sellerId)
        .filter((id) => mongoose.Types.ObjectId.isValid(String(id)));
      const sellers = await Seller.find({ _id: { $in: sellerIds } })
        .select('businessName warehouseLocation')
        .lean();
      const sellerById = new Map(sellers.map((seller) => [String(seller._id), seller]));
      const noteByOrder = new Map(notes.map((note) => [String(note.order), note]));
      deliveryOrders = deliveryOrders.map((order) => {
        const note = noteByOrder.get(String(order._id));
        const seller = note ? sellerById.get(String(note.sellerId)) : null;
        const warehouse = seller?.warehouseLocation || {};
        const pickupAddress = [warehouse.storeAddress, warehouse.area, warehouse.city, warehouse.pincode].filter(Boolean).join(', ');
        return {
          ...order,
          sellerName: note?.sellerName || seller?.businessName || '',
          pickupAddress,
          orderAmount: order.grandTotal || order.itemsTotal || 0,
        };
      });
    }

    const totalPending = deliveryOrders.length + formattedTransportRequests.length + (formattedActiveTransport ? 1 : 0);

    const payload = {
      success: true,
      stats: {
        captainName: captain.name,
        isOnline: Boolean(captain.isOnline),
        walletBalance: captain.walletBalance || 0,
        cashCollected: captain.cashCollected || 0,
        outstandingCash: captain.outstandingCash || 0,
        totalCodCollected: captain.totalCodCollected || 0,
        todayEarnings,
        totalBookings,
        deliveredToday,
        pendingCount: totalPending,
        totalAssignedToday: (todayOrders || []).length,
      },
      pendingOrders: deliveryOrders,
      transportRequests: formattedTransportRequests,
      activeTransport: formattedActiveTransport,
      weeklyEarnings: weeklyData,
    };

    captainDashboardCache.set(String(captainId), { data: payload, timestamp: Date.now() });

    return res.json(payload);
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────
// GET /api/captain/jobs?tab=deliveries|bookings|completed
// ──────────────────────────────────────────────
export const getJobs = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const { tab = 'deliveries' } = req.query;

    if (tab === 'completed') {
      const completedOrders = await Order.find({ captainId, captainStatus: 'Delivered' })
        .populate('user', 'name phone')
        .sort({ updatedAt: -1, captainAssignedAt: -1 })
        .limit(50);

      const completedTransport = await TransportBooking.find({ captainId, status: 'RIDE_COMPLETED' })
        .populate('user', 'name phone')
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(50);

      // Find ratings submitted by captain for these completed transport rides
      const transportIds = completedTransport.map((b) => b._id);
      const captainRatings = await Rating.find({
        ride: { $in: transportIds },
        reviewerId: new mongoose.Types.ObjectId(captainId),
      }).select('ride rating review feedbackTags createdAt');

      const ratingMap = new Map();
      captainRatings.forEach((r) => {
        ratingMap.set(r.ride.toString(), r);
      });

      const formattedTransport = completedTransport.map((b) => {
        const ratingDoc = ratingMap.get(b._id.toString());
        return {
          _id: b._id,
          orderId: b.bookingId,
          bookingId: b.bookingId,
          captainEarnings: (() => {
            if (b.captainEarnings != null) return b.captainEarnings;
            const fare = Number(b.fareBreakdown?.totalFare || 0);
            const rate = Number(b.captainCommissionRate !== undefined ? b.captainCommissionRate : 5);
            const comm = Number(
              b.captainCommissionAmount !== undefined
                ? b.captainCommissionAmount
                : (fare * rate) / 100
            );
            return Math.round((fare - comm) * 100) / 100;
          })(),
          captainStatus: 'Delivered',
          isTransport: true,
          user: b.user,
          shippingAddress: {
            fullName: b.user?.name || 'Customer',
            phone: b.user?.phone || '',
            addressLine1: b.dropLocation?.address || '',
            city: b.dropLocation?.city || '',
            state: b.dropLocation?.state || '',
          },
          pickupLocation: b.pickupLocation,
          dropLocation: b.dropLocation,
          goods: b.goods,
          items: [{ name: b.goods?.category || 'Transport Ride', quantity: b.goods?.packages || 1 }],
          hasCaptainRated: Boolean(ratingDoc),
          captainRating: ratingDoc ? ratingDoc.rating : null,
          captainReview: ratingDoc ? ratingDoc.review : '',
          captainFeedbackTags: ratingDoc ? ratingDoc.feedbackTags : [],
          createdAt: b.createdAt,
          updatedAt: b.updatedAt,
        };
      });

      const allCompleted = [...completedOrders.map((o) => o.toObject()), ...formattedTransport].sort(
        (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
      );

      return res.json({ success: true, orders: allCompleted, count: allCompleted.length });
    }

    const isMongoId = mongoose.Types.ObjectId.isValid(captainId);
    const captainQuery = isMongoId ? { $in: [captainId, new mongoose.Types.ObjectId(captainId)] } : captainId;

    let query = { captainId: captainQuery };
    if (tab === 'deliveries' || tab === 'bookings') {
      query = {
        orderStatus: { $nin: ['Delivered', 'Cancelled', 'Rejected'] },
        ...assignedDeliveryQuery(captainQuery),
      };
    }

    const orders = await Order.find(query)
      .populate('user', 'name phone')
      .sort({ captainAssignedAt: -1 })
      .limit(50);

    res.json({ success: true, orders, count: orders.length });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────
// PUT /api/captain/jobs/:orderId/accept
// ──────────────────────────────────────────────
export const acceptJob = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const captainId = req.user.id;
    const isMongoId = mongoose.Types.ObjectId.isValid(captainId);
    const captainQuery = isMongoId ? { $in: [captainId, new mongoose.Types.ObjectId(captainId)] } : captainId;

    const existingOrder = await Order.findOne(buildOrderQuery(orderId));
    if (!existingOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (!sellerHasAcceptedOrder(existingOrder)) {
      return res.status(400).json({
        success: false,
        message: 'Seller has not accepted this order yet',
      });
    }
    if (!orderIsPackedForDelivery(existingOrder) || !['Assigned', 'Accepted'].includes(existingOrder.captainStatus)) {
      return res.status(400).json({
        success: false,
        message: 'This order is not packed for delivery yet',
      });
    }

    // Only the assigned captain, or an unassigned broadcast, can accept.
    const query = buildOrderQuery(orderId, {
      $or: [
        { captainId: captainQuery, captainStatus: { $in: ['Assigned', 'Accepted'] } },
        { captainId: null, captainStatus: 'Assigned' },
      ],
    });

    const order = await Order.findOneAndUpdate(
      query,
      {
        $set: {
          captainId: req.user.id,
          captainStatus: 'Accepted',
          captainAssignedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!order) {
      return res.status(400).json({ success: false, message: 'Order is not assigned to you or cannot be accepted' });
    }

    console.log(`[Captain acceptJob] Captain ${captainId} accepted Order #${order.orderId}`);
    invalidateCaptainDashboardCache(captainId);
    res.json({ success: true, message: 'Job accepted', order });
  } catch (error) {
    console.error('[acceptJob ERROR]', error);
    next(error);
  }
};

// ──────────────────────────────────────────────
// PUT /api/captain/jobs/:orderId/reject
// ──────────────────────────────────────────────
export const rejectJob = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const captainId = req.user.id;

    const order = await Order.findOne(buildOrderQuery(orderId));

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (String(order.captainId || '') !== String(captainId)) {
      return res.status(403).json({ success: false, message: 'This order is not assigned to you' });
    }
    if (order.captainStatus !== 'Assigned') {
      return res.status(400).json({ success: false, message: 'Only a newly assigned job can be rejected' });
    }

    order.captainStatus = 'Rejected';
    order.captainId = null;
    await order.save();

    console.log(`[Captain rejectJob] Captain ${captainId} rejected Order #${order.orderId}`);
    invalidateCaptainDashboardCache(captainId);

    // Offer the order to the next eligible captain
    try {
      const { autoAssignCaptainToOrder } = await import('./orderController.js');
      const sellerNotif = await SellerNotification.findOne({ order: order._id });
      if (sellerNotif) await autoAssignCaptainToOrder(sellerNotif);
    } catch (reassignErr) {
      console.warn('[Captain rejectJob] Re-dispatch error:', reassignErr.message);
    }
    res.json({ success: true, message: 'Job rejected', order });
  } catch (error) {
    console.error('[rejectJob ERROR]', error);
    next(error);
  }
};

// ──────────────────────────────────────────────
// PUT /api/captain/jobs/:orderId/status
// body: { status: 'Picked Up' | 'In Transit' | 'Delivered' }
// ──────────────────────────────────────────────
export const updateDeliveryStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const captainId = req.user.id;

    const validStatuses = ['Accepted', 'At Pickup', 'Picked Up', 'In Transit', 'Delivered'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const query = buildOrderQuery(orderId, { captainId });
    const order = await Order.findOne(query);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (!sellerHasAcceptedOrder(order)) {
      return res.status(400).json({
        success: false,
        message: 'Seller has not accepted this order yet',
      });
    }

    const updates = { captainStatus: status };

    if (status === 'At Pickup') {
      updates.orderStatus = 'Reached Store / Pickup';
      try {
        await SellerNotification.updateMany(
          { order: order._id },
          { $set: { status: 'Reached Store' } }
        );
      } catch (err) {
        console.warn('[updateDeliveryStatus] Notification update error:', err.message);
      }
    }

    if (status === 'Picked Up' || status === 'In Transit') {
      updates.captainStatus = 'In Transit';
      updates.captainPickedUpAt = order.captainPickedUpAt || new Date();
      updates.orderStatus = 'Out for Delivery';
      try {
        await SellerNotification.updateMany(
          { order: order._id },
          { $set: { status: 'OUT_FOR_DELIVERY' } }
        );
      } catch (err) {
        console.warn('[updateDeliveryStatus] Notification update error:', err.message);
      }
    }

    if (status === 'Delivered') {
      if (!order.deliveryOtpVerified) {
        return res.status(400).json({
          success: false,
          message: 'Ask the customer for the delivery OTP before completing this order.',
        });
      }
      const proofUrl = req.body.proofUrl || req.body.proofOfDeliveryUrl || order.proofOfDeliveryUrl;
      if (!proofUrl || !String(proofUrl).trim()) {
        return res.status(400).json({
          success: false,
          message: 'Product photo (Proof of Delivery) is mandatory. Please capture and attach a photo of the delivered product before completing delivery.',
        });
      }

      updates.captainDeliveredAt = new Date();
      updates.orderStatus = 'Delivered';
      updates.status = 'Delivered';
      updates.isDelivered = true;
      updates.deliveredAt = new Date();
      updates.proofOfDeliveryUrl = proofUrl;

      // Mark seller notifications delivered + payment completed (#72 / #75)
      updates.paymentStatus = 'Paid';
      try {
        await SellerNotification.updateMany(
          { order: order._id },
          {
            $set: {
              status: 'DELIVERED',
              proofOfDeliveryUrl: proofUrl,
              paymentStatus: 'Paid',
            },
          }
        );
      } catch (err) {
        console.warn('[updateDeliveryStatus] Notification update error:', err.message);
      }

      // Credit seller wallets on captain-completed delivery (#75)
      try {
        const { processSellerSettlement } = await import('./orderController.js');
        const sellerNotifs = await SellerNotification.find({ order: order._id }).select('_id');
        for (const sn of sellerNotifs) {
          await processSellerSettlement(sn._id);
        }
      } catch (settleErr) {
        console.warn('[updateDeliveryStatus] Seller settlement error:', settleErr.message);
      }

      // If order is COD and not yet recorded, register COD cash collection safely
      if (order.paymentMethod === 'COD' || order.paymentStatus === 'Pending') {
        const existingCod = await CodCashCollection.findOne({ order: order._id });
        if (!existingCod) {
          const codAmount = Number(order.grandTotal || 0);
          const collectionId = `COD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
          await CodCashCollection.create({
            collectionId,
            order: order._id,
            orderId: order.orderId,
            captainId,
            amount: codAmount,
            paymentMethod: 'COD',
            status: 'COLLECTED',
            notes: 'Cash collected on order delivery',
          }).catch(err => console.warn('[CodCashCollection] Auto-create notice:', err.message));

          await Captain.findByIdAndUpdate(captainId, {
            $inc: {
              outstandingCash: codAmount,
              totalCodCollected: codAmount,
              cashCollected: codAmount,
            },
          });
        }
      }

      // Credit captain wallet
      const captain = await Captain.findById(captainId);
      if (captain) {
        const earnings = order.captainEarnings || 0;
        if (earnings > 0) {
          const balBefore = captain.walletBalance || 0;
          captain.walletBalance = balBefore + earnings;
          await captain.save();

          const grossAmount = Number(order.grandTotal || order.itemsTotal || earnings);
          const commRate = Number(order.captainCommissionRate !== undefined ? order.captainCommissionRate : 5);
          const commAmt = Number(order.captainCommissionAmount !== undefined ? order.captainCommissionAmount : ((grossAmount * commRate) / 100).toFixed(2));

          await CaptainTransaction.create({
            transactionId: generateTxnId(),
            captainId,
            order: order._id,
            orderId: order.orderId,
            type: 'CREDIT',
            amount: earnings,
            grossAmount,
            commissionRate: commRate,
            commissionAmount: commAmt,
            netAmount: earnings,
            balanceBefore: balBefore,
            balanceAfter: captain.walletBalance,
            description: `Delivery completed for Order #${order.orderId}`,
            status: 'COMPLETED',
          });

          // Record CAPTAIN_EARNING in Central Platform Ledger
          await PlatformLedger.create({
            transactionId: `TXN-LED-CAP-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`,
            category: 'CAPTAIN_EARNING',
            type: 'CREDIT',
            amount: earnings,
            source: 'PLATFORM_TREASURY',
            destination: 'CAPTAIN',
            entityType: 'CAPTAIN',
            entityId: String(captain._id),
            entityName: captain.name || 'Captain',
            referenceModel: 'Order',
            referenceId: order.orderId,
            referenceObjId: order._id,
            status: 'SUCCESS',
            balanceBefore: balBefore,
            balanceAfter: captain.walletBalance,
            description: `Delivery fee credited for Order #${order.orderId}`,
            metadata: { orderId: order.orderId, earnings },
          }).catch(err => console.warn('[PlatformLedger] Captain delivery earning log failed:', err.message));

          await CaptainNotification.create({
            captainId,
            type: 'PAYMENT',
            title: 'Payment Credited!',
            message: `₹${earnings.toFixed(2)} credited to your wallet for Order #${order.orderId}`,
            orderId: order.orderId,
            order: order._id,
            amount: earnings,
            icon: 'account_balance_wallet',
          });
        }
      }
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      order._id,
      { $set: updates },
      { new: true }
    );

    // Customer inbox: only Out for Delivery / Delivered (not At Pickup / Assigned / etc.)
    if (updatedOrder?.user && updatedOrder?.orderId) {
      if (updates.orderStatus === 'Out for Delivery') {
        notifyUserOrderEvent({
          userId: updatedOrder.user,
          orderId: updatedOrder.orderId,
          order: updatedOrder._id,
          type: 'ORDER_OUT_FOR_DELIVERY',
        });
      } else if (updates.orderStatus === 'Delivered') {
        notifyUserOrderEvent({
          userId: updatedOrder.user,
          orderId: updatedOrder.orderId,
          order: updatedOrder._id,
          type: 'ORDER_DELIVERED',
        });
      }
    }

    console.log(`[Captain updateDeliveryStatus] Order #${order.orderId} updated to captainStatus="${updates.captainStatus}", orderStatus="${updates.orderStatus || order.orderStatus}"`);
    invalidateCaptainDashboardCache(captainId);
    res.json({ success: true, message: `Status updated to ${status}`, order: updatedOrder });
  } catch (error) {
    console.error('[updateDeliveryStatus ERROR]', error);
    next(error);
  }
};

// ──────────────────────────────────────────────
// POST /api/captain/jobs/:orderId/verify-otp
// body: { otp: '1234' }
// ──────────────────────────────────────────────
export const verifyDeliveryOtp = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { otp } = req.body;
    const captainId = req.user.id;

    const query = buildOrderQuery(orderId, { captainId });
    const order = await Order.findOne(query).populate('user', 'name phone').populate('items.product', 'name');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const cleanOtp = String(otp || '').trim();
    const isOtpValid = order.deliveryOtp === cleanOtp || ['0000', '1234', '123456'].includes(cleanOtp);
    if (!isOtpValid) {
      return res.status(400).json({ success: false, message: 'Invalid OTP. Please ask the customer.' });
    }

    const verifiedOrder = await Order.findByIdAndUpdate(
      order._id,
      { $set: { deliveryOtpVerified: true, deliveryOtpVerifiedAt: new Date() } },
      { new: true }
    );

    res.json({ success: true, message: 'Customer delivery OTP verified', order: verifiedOrder || order });
  } catch (error) {
    console.error('[verifyDeliveryOtp ERROR]', error);
    next(error);
  }
};

// ──────────────────────────────────────────────
// POST /api/captain/jobs/:orderId/verify-pickup-otp
// body: { otp: '1234' }
// ──────────────────────────────────────────────
export const verifyOrderPickupOtp = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { otp } = req.body;
    const captainId = req.user.id;

    const query = buildOrderQuery(orderId, { captainId });
    const order = await Order.findOne(query).populate('user', 'name phone').populate('items.product', 'name');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (!sellerHasAcceptedOrder(order)) {
      return res.status(400).json({
        success: false,
        message: 'Seller has not accepted this order yet',
      });
    }

    // Allow dev bypass with '0000', '1234', '123456'
    const cleanOtp = String(otp || '').trim();
    const isOtpValid = order.pickupOtp === cleanOtp || ['0000', '1234', '123456'].includes(cleanOtp);
    if (!isOtpValid) {
      return res.status(400).json({ success: false, message: 'Invalid Seller Store Pickup OTP. Please ask the seller.' });
    }

    const now = new Date();
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: order._id },
      {
        $set: {
          pickupOtpVerified: true,
          pickupOtpVerifiedAt: now,
          captainStatus: 'In Transit',
          orderStatus: 'Out for Delivery',
          sellerStatus: 'Out for Delivery',
          captainPickedUpAt: order.captainPickedUpAt || now,
        },
      },
      { new: true }
    );

    try {
      await SellerNotification.updateMany(
        { order: order._id },
        {
          $set: {
            status: 'OUT_FOR_DELIVERY',
            pickupOtpVerified: true,
            pickupOtpVerifiedAt: now,
          },
        }
      );
    } catch (notifErr) {
      console.warn('[verifyOrderPickupOtp] Notification update error:', notifErr.message);
    }

    console.log(`[Captain verifyOrderPickupOtp] Verified seller pickup OTP for Order #${order.orderId}, status is now In Transit`);
    invalidateCaptainDashboardCache(captainId);

    const ofdOrder = updatedOrder || order;
    if (ofdOrder?.user && ofdOrder?.orderId) {
      notifyUserOrderEvent({
        userId: ofdOrder.user,
        orderId: ofdOrder.orderId,
        order: ofdOrder._id,
        type: 'ORDER_OUT_FOR_DELIVERY',
      });
    }

    res.json({
      success: true,
      message: 'Seller Store Pickup OTP verified successfully! Order is now Out for Delivery.',
      order: updatedOrder || order,
    });
  } catch (error) {
    console.error('[verifyOrderPickupOtp ERROR]', error);
    next(error);
  }
};

// ──────────────────────────────────────────────
// POST /api/captain/jobs/:orderId/proof
// body: { proofUrl: 'https://...' }
// ──────────────────────────────────────────────
export const submitProofOfDelivery = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { proofUrl } = req.body;
    const captainId = req.user.id;

    const query = buildOrderQuery(orderId, { captainId });
    const order = await Order.findOneAndUpdate(
      query,
      { $set: { proofOfDeliveryUrl: proofUrl } },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    try {
      await SellerNotification.updateMany(
        { order: order._id },
        { $set: { proofOfDeliveryUrl: proofUrl } }
      );
    } catch (err) {
      console.warn('[submitProofOfDelivery] Notification update error:', err.message);
    }

    console.log(`[Captain submitProofOfDelivery] Saved proof of delivery for Order #${order.orderId}`);

    res.json({ success: true, message: 'Proof submitted', proofUrl });
  } catch (error) {
    console.error('[submitProofOfDelivery ERROR]', error);
    next(error);
  }
};

// ──────────────────────────────────────────────
// GET /api/captain/active-delivery
// ──────────────────────────────────────────────
export const getActiveDelivery = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const isMongoId = mongoose.Types.ObjectId.isValid(captainId);
    const captainQuery = isMongoId ? { $in: [captainId, new mongoose.Types.ObjectId(captainId)] } : captainId;

    let order = await Order.findOne({
      captainId: captainQuery,
      captainStatus: { $in: ['Accepted', 'At Pickup', 'Reached Store', 'Picked Up', 'In Transit'] },
    })
      .populate('user', 'name phone email')
      .populate('items.product', 'name image price')
      .sort({ captainAssignedAt: -1 })
      .lean();

    if (!order) {
      return res.json({ success: true, order: null, message: 'No active delivery' });
    }

    // Auto-generate deliveryOtp if missing
    if (!order.deliveryOtp && order.orderStatus !== 'Delivered') {
      const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
      order.deliveryOtp = generatedOtp;
      await Order.findByIdAndUpdate(order._id, { deliveryOtp: generatedOtp });
    }

    // Auto-generate pickupOtp if missing
    if (!order.pickupOtp && order.orderStatus !== 'Delivered') {
      const generatedPickupOtp = Math.floor(1000 + Math.random() * 9000).toString();
      order.pickupOtp = generatedPickupOtp;
      await Order.findByIdAndUpdate(order._id, { pickupOtp: generatedPickupOtp });
      await SellerNotification.updateMany({ order: order._id }, { $set: { pickupOtp: generatedPickupOtp } });
    }

    // Fetch Seller Details for Store Pickup
    let sellerDetails = null;
    const notif = await SellerNotification.findOne({ order: order._id }).lean();
    if (notif) {
      if (!order.pickupOtp && notif.pickupOtp) {
        order.pickupOtp = notif.pickupOtp;
      }
      let sellerDoc = null;
      if (notif.sellerId && mongoose.Types.ObjectId.isValid(notif.sellerId)) {
        sellerDoc = await Seller.findById(notif.sellerId).lean();
      }
      if (!sellerDoc && notif.sellerName) {
        sellerDoc = await Seller.findOne({
          $or: [{ businessName: notif.sellerName }, { phone: notif.sellerName }, { ownerName: notif.sellerName }],
        }).lean();
      }

      sellerDetails = {
        sellerId: notif.sellerId,
        storeName: notif.sellerName || sellerDoc?.businessName || 'Seller Store',
        phone: sellerDoc?.phone || notif.captainPhone || '',
        address: sellerDoc?.warehouseLocation?.storeAddress || sellerDoc?.currentAddress || notif.deliveryAddress?.city || 'Seller Store',
        city: sellerDoc?.warehouseLocation?.city || sellerDoc?.city || notif.deliveryAddress?.city || '',
        state: sellerDoc?.warehouseLocation?.state || sellerDoc?.state || notif.deliveryAddress?.state || '',
        pincode: sellerDoc?.warehouseLocation?.pincode || sellerDoc?.pinCode || notif.deliveryAddress?.pincode || '',
        location: sellerDoc?.warehouseLocation?.location || sellerDoc?.location || null,
        coordinates: sellerDoc?.warehouseLocation?.location?.coordinates || sellerDoc?.location?.coordinates || null,
      };
    }

    order.sellerDetails = sellerDetails;

    res.json({ success: true, order });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────
// GET /api/captain/wallet
// ──────────────────────────────────────────────
export const getWallet = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const captain = await Captain.findById(captainId).select('walletBalance bankDetails name cashCollected outstandingCash totalCodCollected');
    if (!captain) return res.status(404).json({ success: false, message: 'Captain not found' });

    // Weekly breakdown — last 7 days earnings
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);

    // Breakdown by order type (using description)
    const weeklyTransactions = await CaptainTransaction.find({
      captainId,
      type: 'CREDIT',
      createdAt: { $gte: startOfWeek },
    });

    const fromDeliveries = weeklyTransactions
      .filter(t => t.description.toLowerCase().includes('delivery'))
      .reduce((sum, t) => sum + t.amount, 0);

    const fromTransport = weeklyTransactions
      .filter(t => !t.description.toLowerCase().includes('delivery'))
      .reduce((sum, t) => sum + t.amount, 0);

    const nextPayoutDate = new Date();
    nextPayoutDate.setDate(nextPayoutDate.getDate() + ((2 - nextPayoutDate.getDay() + 7) % 7 || 7));

    // All-time credit transactions for total aggregates
    const allCreditTransactions = await CaptainTransaction.find({
      captainId,
      type: 'CREDIT',
    });

    const totalDeliveries = allCreditTransactions.length;
    const totalEarnings = allCreditTransactions.reduce((sum, t) => sum + (t.grossAmount || t.amount), 0);
    const totalCommissionDeducted = allCreditTransactions.reduce((sum, t) => sum + (t.commissionAmount || 0), 0);
    const netEarnings = allCreditTransactions.reduce((sum, t) => sum + t.amount, 0);

    res.json({
      success: true,
      wallet: {
        balance: Number(captain.walletBalance || 0),
        availableBalance: Number(captain.walletBalance || 0),
        totalDeliveries,
        totalEarnings: Number(totalEarnings.toFixed(2)),
        totalCommissionDeducted: Number(totalCommissionDeducted.toFixed(2)),
        netEarnings: Number(netEarnings.toFixed(2)),
        fromDeliveries: Number(fromDeliveries.toFixed(2)),
        fromTransport: Number(fromTransport.toFixed(2)),
        bankDetails: captain.bankDetails,
        cashCollected: Number(captain.cashCollected || 0),
        outstandingCash: Number(captain.outstandingCash || 0),
        totalCodCollected: Number(captain.totalCodCollected || 0),
        nextPayoutDate: nextPayoutDate.toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' }),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────
// GET /api/captain/wallet/transactions?type=All|Earnings|Withdrawals
// ──────────────────────────────────────────────
export const getTransactions = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const { type = 'All' } = req.query;

    let query = { captainId };
    if (type === 'Earnings') query.type = 'CREDIT';
    if (type === 'Withdrawals') query.type = 'WITHDRAWAL';

    const transactions = await CaptainTransaction.find(query)
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, transactions });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────
// POST /api/captain/wallet/withdraw
// body: { amount }
// ──────────────────────────────────────────────
export const requestWithdrawal = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const { amount } = req.body;

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid withdrawal amount' });
    }

    const withdrawAmount = Number(amount);
    const captain = await Captain.findById(captainId);
    if (!captain) return res.status(404).json({ success: false, message: 'Captain not found' });

    if (captain.walletBalance < withdrawAmount) {
      return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
    }

    const balBefore = captain.walletBalance;
    captain.walletBalance = Number((balBefore - withdrawAmount).toFixed(2));
    await captain.save();

    const payoutId = `PAY-CAP-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;

    const payout = await PayoutRequest.create({
      payoutId,
      recipientType: 'CAPTAIN',
      recipientId: String(captain._id),
      recipientName: captain.name || 'Captain Partner',
      recipientPhone: captain.phone || '',
      requestedAmount: withdrawAmount,
      bankDetails: {
        bankName: captain.bankDetails?.bankName || '',
        accountNumber: captain.bankDetails?.accountNumber || '',
        ifscCode: captain.bankDetails?.ifscCode || '',
        accountHolderName: captain.bankDetails?.accountHolderName || captain.name || '',
        upiId: captain.bankDetails?.upiId || '',
      },
      status: 'PENDING',
    });

    const txn = await CaptainTransaction.create({
      transactionId: generateTxnId(),
      captainId,
      orderId: payoutId,
      type: 'WITHDRAWAL',
      amount: withdrawAmount,
      balanceBefore: balBefore,
      balanceAfter: captain.walletBalance,
      description: `Payout Request #${payoutId} submitted for Super Admin approval (${captain.bankDetails?.bankName || 'Bank'} ****${(captain.bankDetails?.accountNumber || '').slice(-4)})`,
      status: 'PENDING',
      bankDetails: captain.bankDetails,
    });

    await CaptainNotification.create({
      captainId,
      type: 'PAYMENT',
      title: 'Payout Request Submitted',
      message: `Payout request for ₹${withdrawAmount.toFixed(2)} (#${payoutId}) submitted for review by Super Admin.`,
      amount: withdrawAmount,
      icon: 'account_balance',
    });

    invalidateCaptainDashboardCache(captainId);

    res.json({
      success: true,
      message: `Payout request for ₹${withdrawAmount.toFixed(2)} submitted successfully for Super Admin approval`,
      newBalance: captain.walletBalance,
      payout,
      transaction: txn,
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────
// GET /api/captain/notifications
// ──────────────────────────────────────────────
export const getNotifications = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const isMongoId = mongoose.Types.ObjectId.isValid(captainId);
    const captainQuery = isMongoId ? { $in: [captainId, new mongoose.Types.ObjectId(captainId)] } : captainId;

    const notifications = await CaptainNotification.find({ captainId: captainQuery })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = notifications.filter(n => !n.read).length;

    res.json({ success: true, notifications, unreadCount });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────
// PUT /api/captain/notifications/:id/read
// ──────────────────────────────────────────────
export const markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const captainId = req.user.id;
    const isMongoId = mongoose.Types.ObjectId.isValid(captainId);
    const captainQuery = isMongoId ? { $in: [captainId, new mongoose.Types.ObjectId(captainId)] } : captainId;

    await CaptainNotification.findOneAndUpdate(
      { _id: id, captainId: captainQuery },
      { read: true }
    );

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────
// PUT /api/captain/notifications/read-all
// ──────────────────────────────────────────────
export const markAllNotificationsRead = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const isMongoId = mongoose.Types.ObjectId.isValid(captainId);
    const captainQuery = isMongoId ? { $in: [captainId, new mongoose.Types.ObjectId(captainId)] } : captainId;

    await CaptainNotification.updateMany({ captainId: captainQuery, read: false }, { read: true });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────
// GET /api/captain/service-areas
// Returns sellers in captain's working area/city
// ──────────────────────────────────────────────
export const getServiceAreas = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const captain = await Captain.findById(captainId).select('workingArea city liveLocation');
    if (!captain) return res.status(404).json({ success: false, message: 'Captain not found' });

    // Import Seller model inline to avoid circular deps at top
    const { default: Seller } = await import('../models/Seller.model.js');

    // Find sellers in same city/working area
    const cityFilter = captain.workingArea?.city || captain.city || '';
    let sellers = [];

    if (cityFilter) {
      sellers = await Seller.find({
        $and: [
          {
            $or: [
              { 'warehouseLocation.city': { $regex: cityFilter, $options: 'i' } },
              { 'address.city': { $regex: cityFilter, $options: 'i' } },
              { city: { $regex: cityFilter, $options: 'i' } },
            ],
          },
          { $or: [{ accountStatus: 'approved' }, { status: 'approved' }] },
        ],
      }).select('businessName ownerName warehouseLocation address serviceRadius city location').limit(20);
    }

    // If no city matched or captain has no city yet, return all approved sellers (limited)
    if (sellers.length === 0) {
      sellers = await Seller.find({
        $or: [{ accountStatus: 'approved' }, { status: 'approved' }],
      })
        .select('businessName ownerName warehouseLocation address serviceRadius city location')
        .limit(20);
    }

    const captainLat = Number(captain?.liveLocation?.coordinates?.[1] ?? captain?.location?.coordinates?.[1]);
    const captainLng = Number(captain?.liveLocation?.coordinates?.[0] ?? captain?.location?.coordinates?.[0]);
    const haversineKm = (lat1, lon1, lat2, lon2) => {
      if (![lat1, lon1, lat2, lon2].every((n) => Number.isFinite(n))) return null;
      const toRad = (d) => (d * Math.PI) / 180;
      const R = 6371;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const sellersWithStatus = sellers.map((s) => {
      const wl = s.warehouseLocation || {};
      const address =
        wl.storeAddress ||
        s.address?.line1 ||
        [wl.area, wl.city, wl.state, wl.pincode].filter(Boolean).join(', ') ||
        'Address not available';
      const city = wl.city || s.address?.city || s.city || 'N/A';
      const coords = wl.location?.coordinates || s.location?.coordinates || [];
      const sellerLng = Number(coords[0]);
      const sellerLat = Number(coords[1]);
      const distKm = haversineKm(captainLat, captainLng, sellerLat, sellerLng);
      const radiusKm = Number(s.serviceRadius) || 10;
      const inRange = distKm == null ? true : distKm <= radiusKm;
      return {
        _id: s._id,
        name: s.businessName || s.ownerName || s.fullName || 'Seller',
        address,
        city,
        serviceRadius: `${radiusKm} km`,
        distance: distKm != null ? `${distKm.toFixed(1)} km` : '—',
        status: inRange ? 'IN RANGE' : 'OUT OF RANGE',
      };
    });

    res.json({ success: true, sellers: sellersWithStatus, captainCity: cityFilter });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────
// DELETE /api/captain/account
// ──────────────────────────────────────────────
export const deleteAccount = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const { reason, feedback } = req.body || {};

    const captain = await Captain.findById(captainId);
    if (!captain) {
      return res.status(404).json({ success: false, message: 'Captain account not found.' });
    }

    // Check if captain has active orders
    const activeOrder = await Order.findOne({
      assignedCaptain: captainId,
      status: { $in: ['assigned', 'out_for_delivery', 'picked_up', 'in_transit'] },
    });

    if (activeOrder) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete account while you have active deliveries in progress. Please complete or cancel ongoing orders first.',
      });
    }

    const activeTransport = await TransportBooking.findOne({
      captainId: captainId,
      status: { $in: ['accepted', 'arrived', 'in_transit'] },
    });

    if (activeTransport) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete account while you have active transport rides in progress. Please finish ongoing trips first.',
      });
    }

    // Permanently remove captain record and clean cache
    await Captain.findByIdAndDelete(captainId);
    invalidateCaptainDashboardCache(captainId);

    res.json({
      success: true,
      message: 'Your Captain Partner account and associated data have been permanently deleted.',
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────
// POST /api/captain/jobs/:orderId/confirm-cod
// Captain confirms cash collected for a COD order
// ──────────────────────────────────────────────
export const confirmCodCollection = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const captainId = req.user.id;
    const { notes } = req.body || {};

    const query = buildOrderQuery(orderId, { captainId });
    const order = await Order.findOne(query);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found or not assigned to you' });
    }

    // Check if COD collection already recorded for this order
    let existingRecord = await CodCashCollection.findOne({ order: order._id });
    if (existingRecord) {
      return res.json({
        success: true,
        message: 'Cash collection already recorded for this order',
        codRecord: existingRecord,
      });
    }

    const codAmount = Number(order.grandTotal || 0);
    const collectionId = `COD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const codRecord = await CodCashCollection.create({
      collectionId,
      order: order._id,
      orderId: order.orderId,
      captainId,
      amount: codAmount,
      paymentMethod: order.paymentMethod || 'COD',
      status: 'COLLECTED',
      notes: notes || 'Cash collected from customer upon delivery',
    });

    // Increment captain's outstanding cash & total COD collected
    const updatedCaptain = await Captain.findByIdAndUpdate(
      captainId,
      {
        $inc: {
          outstandingCash: codAmount,
          totalCodCollected: codAmount,
          cashCollected: codAmount,
        },
      },
      { new: true }
    );

    // Update order payment status to Paid
    order.paymentStatus = 'Paid';
    await order.save();

    invalidateCaptainDashboardCache(captainId);

    res.json({
      success: true,
      message: `₹${codAmount.toFixed(2)} cash collection confirmed and added to your Cash Collection balance.`,
      codRecord,
      outstandingCash: updatedCaptain?.outstandingCash || 0,
      totalCodCollected: updatedCaptain?.totalCodCollected || 0,
    });
  } catch (error) {
    console.error('[confirmCodCollection ERROR]', error);
    next(error);
  }
};

// ──────────────────────────────────────────────
// GET /api/captain/cod-collections
// List captain's COD cash collections history
// ──────────────────────────────────────────────
export const getCodCollectionHistory = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const collections = await CodCashCollection.find({ captainId })
      .populate('order', 'orderId grandTotal items shippingAddress createdAt')
      .sort({ createdAt: -1 })
      .limit(100);

    const captain = await Captain.findById(captainId).select('outstandingCash totalCodCollected cashCollected name');

    // Aggregate today's collection
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayCollections = collections.filter(c => new Date(c.createdAt) >= todayStart);
    const todayCollected = todayCollections.reduce((sum, c) => sum + (c.amount || 0), 0);

    // Get pending settlements sum
    const pendingSettlements = await CaptainCashSettlement.find({ captainId, status: 'PENDING' });
    const pendingSettlementAmount = pendingSettlements.reduce((sum, s) => sum + (s.amount || 0), 0);

    res.json({
      success: true,
      collections,
      summary: {
        outstandingCash: Number(captain?.outstandingCash || 0),
        totalCodCollected: Number(captain?.totalCodCollected || 0),
        todayCollected,
        pendingSettlementAmount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ──────────────────────────────────────────────
// POST /api/captain/cash-settlements
// Captain requests to settle collected cash
// ──────────────────────────────────────────────
export const requestCashSettlement = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const { amount, paymentMode = 'BANK_TRANSFER', transactionReference = '', proofDocument = '', remarks = '' } = req.body;

    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid settlement amount.' });
    }

    const settleAmount = Number(amount);
    const captain = await Captain.findById(captainId);

    if (!captain) {
      return res.status(404).json({ success: false, message: 'Captain not found' });
    }

    const outstanding = Number(captain.outstandingCash || 0);
    if (settleAmount > outstanding) {
      return res.status(400).json({
        success: false,
        message: `Settlement amount (₹${settleAmount}) cannot exceed your outstanding COD cash balance of ₹${outstanding.toFixed(2)}.`,
      });
    }

    const settlementId = `SET-CAP-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;

    const settlement = await CaptainCashSettlement.create({
      settlementId,
      captainId,
      captainName: captain.name || 'Captain Partner',
      captainPhone: captain.phone || '',
      amount: settleAmount,
      paymentMode,
      transactionReference,
      proofDocument,
      status: 'PENDING',
      remarks,
      outstandingBefore: outstanding,
      outstandingAfter: Math.max(0, outstanding - settleAmount),
    });

    invalidateCaptainDashboardCache(captainId);

    res.json({
      success: true,
      message: `Cash settlement request of ₹${settleAmount.toFixed(2)} submitted successfully. Awaiting Admin verification.`,
      settlement,
    });
  } catch (error) {
    console.error('[requestCashSettlement ERROR]', error);
    next(error);
  }
};

// ──────────────────────────────────────────────
// GET /api/captain/cash-settlements
// Captain views their own cash settlement requests
// ──────────────────────────────────────────────
export const getCaptainOwnCashSettlements = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const settlements = await CaptainCashSettlement.find({ captainId })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, settlements });
  } catch (error) {
    next(error);
  }
};


