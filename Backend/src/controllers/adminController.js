import mongoose from 'mongoose';
import Seller from '../models/Seller.model.js';
import Captain from '../models/Captain.model.js';
import Order from '../models/Order.model.js';
import User from '../models/User.model.js';
import Product from '../models/Product.model.js';
import Category from '../models/Category.model.js';
import TransportBooking from '../models/TransportBooking.model.js';
import CaptainNotification from '../models/CaptainNotification.model.js';
import Referral from '../models/Referral.model.js';
import ReferralSettings from '../models/ReferralSettings.model.js';
import CaptainCashSettlement from '../models/CaptainCashSettlement.model.js';
import CodCashCollection from '../models/CodCashCollection.model.js';
import PlatformLedger from '../models/PlatformLedger.model.js';
import { processReferralReward } from './referralController.js';
import { invalidateUserOrdersCache } from './orderController.js';
import { invalidateProductsCache } from './productController.js';
import {
  mapOrderEventToNotificationType,
  notifyUserOrderEvent,
} from '../utils/userNotificationHelper.js';

// ==========================================
// ADMIN DASHBOARD LIVE AGGREGATIONS
// ==========================================
export const getDashboardStats = async (req, res, next) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalCategories,
      totalSubcategories,
      totalProducts,
      productSoldOut,
      lowStockProducts,
      totalOrders,
      completedOrders,
      pendingOrders,
      cancelledOrders,
      totalSellers,
      pendingSellerApprovals,
      totalCaptains,
      activeCaptains,
      todayRevenueAgg,
      totalVolumeAgg,
      recentOrders,
      topSellers,
      weeklyOrdersAgg
    ] = await Promise.all([
      User.countDocuments({ role: { $ne: 'admin' } }).catch(() => 0),
      Category.countDocuments({ parent: null }).catch(() => 0),
      Category.countDocuments({ parent: { $ne: null } }).catch(() => 0),
      Product.countDocuments().catch(() => 0),
      Product.countDocuments({ stock: { $lte: 0 } }).catch(() => 0),
      Product.countDocuments({ stock: { $gt: 0, $lte: 5 } }).catch(() => 0),
      Order.countDocuments({ $or: [{ paymentStatus: 'Paid' }, { paymentMethod: 'COD' }] }).catch(() => 0),
      Order.countDocuments({ orderStatus: { $in: ['Delivered', 'Completed'] } }).catch(() => 0),
      Order.countDocuments({ orderStatus: { $in: ['Placed', 'Processing', 'Out for Delivery'] } }).catch(() => 0),
      Order.countDocuments({ orderStatus: 'Cancelled' }).catch(() => 0),
      Seller.countDocuments().catch(() => 0),
      Seller.countDocuments({ $or: [{ status: 'pending' }, { status: 'under_review' }, { accountStatus: 'under_review' }] }).catch(() => 0),
      Captain.countDocuments().catch(() => 0),
      Captain.countDocuments({ isOnline: true }).catch(() => 0),
      Order.aggregate([
        { $match: { createdAt: { $gte: todayStart }, $or: [{ paymentStatus: 'Paid' }, { paymentMethod: 'COD' }] } },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } }
      ]).catch(() => []),
      Order.aggregate([
        { $match: { $or: [{ paymentStatus: 'Paid' }, { paymentMethod: 'COD' }] } },
        { $group: { _id: null, total: { $sum: '$grandTotal' } } }
      ]).catch(() => []),
      Order.find()
        .populate('user', 'name phone email')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
        .catch(() => []),
      Seller.find()
        .select('businessName ownerName phone totalEarnings walletBalance status createdAt')
        .sort({ totalEarnings: -1, walletBalance: -1 })
        .limit(10)
        .lean()
        .catch(() => []),
      Order.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo }, $or: [{ paymentStatus: 'Paid' }, { paymentMethod: 'COD' }] } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            revenue: { $sum: '$grandTotal' },
            orderCount: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]).catch(() => [])
    ]);

    const revenueToday = todayRevenueAgg?.[0]?.total || 0;
    const totalVolume = totalVolumeAgg?.[0]?.total || 0;

    // Generate last 7 days chart array (with 0 fills for empty days)
    const chartDays = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const found = weeklyOrdersAgg.find(item => item._id === key);
      chartDays.push({
        date: key,
        month: dayName,
        revenue: found ? found.revenue : 0,
        orders: found ? found.orderCount : 0
      });
    }

    // Default regional hubs overview
    const warehouses = [
      { id: 'wh-1', name: 'Noida Central Hub', city: 'Noida, UP', utilization: 72, activeOrders: Math.max(1, Math.round(pendingOrders * 0.45)), capacity: '120,000 sq ft' },
      { id: 'wh-2', name: 'Gurugram Sector-18 Hub', city: 'Gurugram, HR', utilization: 64, activeOrders: Math.max(0, Math.round(pendingOrders * 0.3)), capacity: '95,000 sq ft' },
      { id: 'wh-3', name: 'Delhi Okhla Fulfillment', city: 'Delhi, DL', utilization: 88, activeOrders: Math.max(0, Math.round(pendingOrders * 0.2)), capacity: '85,000 sq ft' },
      { id: 'wh-4', name: 'Faridabad Express Hub', city: 'Faridabad, HR', utilization: 41, activeOrders: Math.max(0, Math.round(pendingOrders * 0.05)), capacity: '60,000 sq ft' }
    ];

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalCategories: totalCategories || (totalSubcategories > 0 ? 1 : 0),
        totalSubcategories,
        totalProducts,
        productSoldOut,
        lowStockProducts,
        totalOrders,
        completedOrders,
        pendingOrders,
        cancelledOrders,
        totalSellers,
        pendingSellerApprovals,
        totalCaptains,
        activeCaptains,
        totalWarehouses: warehouses.length,
        revenueToday,
        totalVolume,
      },
      revenueChartData: chartDays,
      recentOrders,
      topSellers,
      warehouses
    });
  } catch (error) {
    next(error);
  }
};

export const getAllUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = req.query.limit ? Number(req.query.limit) : 200;

    let dbQuery = User.find({ role: { $ne: 'admin' } })
      .select('-otp -otpExpiry')
      .sort({ createdAt: -1 })
      .lean();

    if (limit > 0) {
      dbQuery = dbQuery.skip((page - 1) * limit).limit(limit);
    }

    const [users, total, orderStatsAgg, returnOrders] = await Promise.all([
      dbQuery,
      User.countDocuments({ role: { $ne: 'admin' } }),
      Order.aggregate([
        {
          $group: {
            _id: '$user',
            totalOrders: { $sum: 1 },
            totalReturns: {
              $sum: {
                $cond: [
                  {
                    $or: [
                      {
                        $in: [
                          '$orderStatus',
                          ['Returned', 'Return Requested', 'Return Approved', 'Return Rejected', 'Return']
                        ]
                      },
                      {
                        $in: [
                          { $ifNull: ['$returnStatus', ''] },
                          ['Requested', 'Pending', 'Approved', 'Completed', 'Refunded', 'PickedUp', 'Received', 'Rejected']
                        ]
                      }
                    ]
                  },
                  1,
                  0
                ]
              }
            },
            totalSpent: {
              $sum: {
                $cond: [
                  { $in: ['$orderStatus', ['Cancelled', 'Rejected']] },
                  0,
                  { $ifNull: ['$grandTotal', 0] }
                ]
              }
            },
            lastOrderDate: { $max: '$createdAt' }
          }
        }
      ]).catch((err) => {
        console.error('[Admin] Error in orderStatsAgg:', err);
        return [];
      }),
      Order.find({
        $or: [
          {
            orderStatus: {
              $in: ['Returned', 'Return Requested', 'Return Approved', 'Return Rejected', 'Return']
            }
          },
          {
            returnStatus: {
              $in: ['Requested', 'Pending', 'Approved', 'Rejected', 'Completed', 'Return Requested']
            }
          }
        ]
      })
        .populate('user', 'name phone email addresses')
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(100)
        .lean()
        .catch((err) => {
          console.error('[Admin] Error in returnOrders query:', err);
          return [];
        })
    ]);

    // Map stats by User ObjectId string
    const statsMap = new Map();
    orderStatsAgg.forEach((stat) => {
      if (stat._id) {
        statsMap.set(String(stat._id), stat);
      }
    });

    const enrichedUsers = users.map((u) => {
      const uId = String(u._id);
      const stat = statsMap.get(uId);
      return {
        ...u,
        ordersCount: stat ? stat.totalOrders : 0,
        returnsCount: stat ? stat.totalReturns : 0,
        totalSpent: stat ? stat.totalSpent : 0,
        lastOrderDate: stat ? stat.lastOrderDate : null,
      };
    });

    const totalOrdersPlaced = orderStatsAgg.reduce((acc, s) => acc + (s.totalOrders || 0), 0);
    const totalReturnOrders = orderStatsAgg.reduce((acc, s) => acc + (s.totalReturns || 0), 0);
    const totalRevenue = orderStatsAgg.reduce((acc, s) => acc + (s.totalSpent || 0), 0);

    res.status(200).json({
      success: true,
      count: enrichedUsers.length,
      total,
      page,
      limit: limit || total,
      users: enrichedUsers,
      returnOrders,
      overallStats: {
        totalUsers: total,
        totalOrdersPlaced,
        totalReturnOrders,
        totalRevenue
      }
    });
  } catch (error) {
    next(error);
  }
};

// Toggle user block status (Block / Unblock Customer)
export const toggleUserBlock = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isBlocked, reason = '', status } = req.body;
    const adminIdentifier = req.user?.email || req.user?.name || 'Admin';

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Determine target blocked state
    let targetBlocked;
    if (isBlocked !== undefined) {
      targetBlocked = Boolean(isBlocked);
    } else if (status) {
      targetBlocked = (status.toLowerCase() === 'blocked' || status.toLowerCase() === 'suspended');
    } else {
      targetBlocked = !user.isBlocked;
    }

    user.isBlocked = targetBlocked;
    user.status = targetBlocked ? 'blocked' : 'active';
    if (targetBlocked) {
      user.blockReason = reason ? String(reason).trim() : 'Blocked by Administrator';
      user.blockedAt = new Date();
      user.blockedBy = adminIdentifier;
    } else {
      user.blockReason = '';
      user.blockedAt = null;
      user.blockedBy = '';
    }

    await user.save();

    console.log(`[Admin] User ${user.phone} (${user._id}) ${targetBlocked ? 'BLOCKED' : 'UNBLOCKED'} by ${adminIdentifier}. Reason: ${user.blockReason || 'None'}`);

    res.status(200).json({
      success: true,
      message: targetBlocked
        ? `Customer ${user.name || user.phone} has been blocked successfully.`
        : `Customer ${user.name || user.phone} has been unblocked successfully.`,
      user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        isBlocked: user.isBlocked,
        status: user.status,
        blockReason: user.blockReason,
        blockedAt: user.blockedAt,
        blockedBy: user.blockedBy,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Fast In-Memory Cache for Admin Listings
let sellersCache = { data: null, timestamp: 0 };
let captainsCache = { data: null, timestamp: 0 };

export const invalidateSellersCache = () => { sellersCache = { data: null, timestamp: 0 }; };
export const invalidateCaptainsCache = () => { captainsCache = { data: null, timestamp: 0 }; };

export const getAllSellers = async (req, res, next) => {
  try {
    const now = Date.now();
    // Cache for 15 seconds unless forced with ?fresh=true
    if (!req.query.fresh && sellersCache.data && (now - sellersCache.timestamp < 15000)) {
      return res.status(200).json(sellersCache.data);
    }

    const sellers = await Seller.find({})
      .select('-password -otp -otpExpiry -fcmTokens -fcmTokenMobile')
      .populate('referredBy', 'ownerName businessName phone email')
      .sort({ _id: -1 })
      .lean()
      .exec();

    const payload = {
      success: true,
      count: sellers ? sellers.length : 0,
      sellers: sellers || []
    };

    sellersCache = { data: payload, timestamp: now };
    return res.status(200).json(payload);
  } catch (error) {
    console.error('[Admin] Error fetching sellers:', error);
    next(error);
  }
};

// Toggle seller status (Approve / Pending / Under Review / Reject / Suspend)
export const toggleSellerStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rawStatus = (req.body.accountStatus || req.body.status || '').toLowerCase().trim();

    const validStatuses = ['approved', 'under_review', 'pending', 'rejected', 'suspended', 'pending_otp'];
    if (!validStatuses.includes(rawStatus)) {
      return res.status(400).json({ success: false, message: `Invalid status: ${rawStatus}` });
    }

    const seller = await Seller.findById(id);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }

    if (rawStatus === 'approved') {
      // Do not waive unpaid registration fee — selling eligibility still requires paid/not_required
      if (
        seller.registrationFeeStatus === 'pending' ||
        seller.registrationFeeStatus === 'failed'
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Cannot approve seller until the registration fee is paid (or marked not_required when fee is disabled).',
          registrationFeeStatus: seller.registrationFeeStatus,
        });
      }
      seller.accountStatus = 'approved';
      seller.status = 'approved';
      seller.isVerified = true;

      // Handle referral trigger on seller approval
      try {
        const cleanPhone = seller.phone ? String(seller.phone).replace(/\D/g, '').slice(-10) : '';
        let referral = await Referral.findOne({
          $or: [
            { referredId: seller._id, referredRole: 'seller' },
            ...(cleanPhone ? [
              { referredPhone: cleanPhone, referredRole: 'seller' },
              { referredPhone: `+91${cleanPhone}`, referredRole: 'seller' },
              { referredPhone: seller.phone, referredRole: 'seller' }
            ] : []),
            ...(seller.referredBy ? [{ referrerId: seller.referredBy, referredId: seller._id, referrerRole: 'seller' }] : [])
          ]
        });

        // If no referral record exists yet, but seller has referredBy, auto-create the referral record!
        if (!referral && seller.referredBy) {
          const referrerSeller = await Seller.findById(seller.referredBy);
          if (referrerSeller) {
            const settings = await ReferralSettings.getOrCreateSettings();
            referral = await Referral.create({
              referrerId: referrerSeller._id,
              referrerRole: 'seller',
              referredId: seller._id,
              referredRole: 'seller',
              referralCode: referrerSeller.referralCode || 'PROMO',
              status: 'Registered',
              rewardAmount: settings.sellerRewardAmount,
              referredPhone: cleanPhone || seller.phone || '',
              referredName: seller.businessName || seller.ownerName || 'Seller',
            });
          }
        }

        if (referral) {
          if (!referral.referredId) referral.referredId = seller._id;
          if (seller.businessName && (!referral.referredName || referral.referredName === 'Seller')) {
            referral.referredName = seller.businessName || seller.ownerName;
          }
          if (referral.status !== 'Rewarded') {
            referral.status = 'Approved';
            referral.approvedAt = new Date();
            await referral.save();

            const settings = await ReferralSettings.getOrCreateSettings();
            if (settings.sellerReferralEnabled && (settings.sellerRewardTrigger === 'admin_approval' || settings.sellerRewardTrigger === 'registration')) {
              await processReferralReward(referral._id);
            }
          }
        }
      } catch (refErr) {
        console.warn('[Admin] Referral trigger error on seller approval:', refErr.message);
      }
    } else if (rawStatus === 'rejected') {
      seller.accountStatus = 'rejected';
      seller.status = 'rejected';
    } else if (rawStatus === 'suspended') {
      seller.accountStatus = 'suspended';
      seller.status = 'suspended';
    } else if (rawStatus === 'under_review' || rawStatus === 'pending') {
      seller.accountStatus = 'under_review';
      seller.status = 'pending';
    } else if (rawStatus === 'pending_otp') {
      seller.accountStatus = 'pending_otp';
      seller.status = 'pending';
    }

    await seller.save();
    invalidateSellersCache();

    console.log(`[Admin] Updated Seller "${seller.businessName}" Status to "${seller.accountStatus.toUpperCase()}"`);

    res.status(200).json({
      success: true,
      message: `Seller status updated to ${seller.accountStatus.toUpperCase()}`,
      seller
    });
  } catch (error) {
    next(error);
  }
};

// Update seller commission percentage (%)
export const updateSellerCommission = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { commissionPercentage } = req.body;

    const commRate = Number(commissionPercentage);
    if (isNaN(commRate) || commRate < 0 || commRate > 100) {
      return res.status(400).json({ success: false, message: 'Please enter a valid commission percentage between 0 and 100' });
    }

    const seller = await Seller.findById(id);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }

    seller.commissionPercentage = commRate;
    await seller.save();
    invalidateSellersCache();

    console.log(`[Admin] Updated Seller "${seller.businessName}" Commission Percentage to ${commRate}%`);

    res.status(200).json({
      success: true,
      message: `Commission percentage updated to ${commRate}% for ${seller.businessName || 'Seller'}`,
      seller,
    });
  } catch (error) {
    next(error);
  }
};

// Delete Seller
export const deleteSeller = async (req, res, next) => {
  try {
    const { id } = req.params;
    let seller = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      seller = await Seller.findByIdAndDelete(id);
    } else {
      seller = await Seller.findOneAndDelete({
        $or: [
          { businessName: id },
          { phone: id }
        ]
      });
    }

    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }

    invalidateSellersCache();
    invalidateProductsCache();

    // Clean up associated products for this seller
    try {
      await Product.deleteMany({
        $or: [
          { sellerId: seller._id },
          { seller: seller._id.toString() },
          { seller: seller.businessName }
        ]
      });
    } catch (cleanErr) {
      console.warn('[Admin] Note: Error cleaning up products for deleted seller:', cleanErr.message);
    }

    console.log(`[Admin] Deleted Seller "${seller.businessName || seller.ownerName}" (${seller._id}) and associated products.`);

    res.status(200).json({
      success: true,
      message: `Seller "${seller.businessName || seller.ownerName || 'Store'}" deleted successfully`,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// CAPTAIN (DRIVER) MANAGEMENT CONTROLLERS
// ==========================================

export const getAllCaptains = async (req, res, next) => {
  try {
    const now = Date.now();
    // Cache for 15 seconds unless forced with ?fresh=true
    if (!req.query.fresh && captainsCache.data && (now - captainsCache.timestamp < 15000)) {
      return res.status(200).json(captainsCache.data);
    }

    const captains = await Captain.find({})
      .select('_id name phone email alternateMobile dob age fatherName currentAddress permanentAddress emergencyContact city state pinCode vehicleType drivingLicenseNumber aadhaarNumber rcNumber vehicleInsuranceNumber insuranceValidTill panCardNumber bankDetails documents walletBalance cashCollected status accountStatus membershipStatus isVerified isOnline liveLocation workingArea createdAt updatedAt')
      .sort({ _id: -1 })
      .lean()
      .exec();

    const payload = {
      success: true,
      count: captains ? captains.length : 0,
      captains: captains || [],
    };

    captainsCache = { data: payload, timestamp: now };
    return res.status(200).json(payload);
  } catch (error) {
    console.error('[Admin] Error fetching captains:', error);
    next(error);
  }
};

// Toggle Captain Status (Approve / Pending / Under Review / Reject / Suspend)
export const toggleCaptainStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rawStatus = (req.body.accountStatus || req.body.status || '').toLowerCase().trim();

    const validStatuses = ['approved', 'under_review', 'pending', 'rejected', 'suspended', 'pending_otp'];
    if (!validStatuses.includes(rawStatus)) {
      return res.status(400).json({ success: false, message: `Invalid status: ${rawStatus}` });
    }

    const captain = await Captain.findById(id);
    if (!captain) {
      return res.status(404).json({ success: false, message: 'Captain not found' });
    }

    if (rawStatus === 'approved') {
      captain.accountStatus = 'approved';
      captain.status = 'approved';
      captain.isVerified = true;

      // Handle referral trigger on captain approval
      try {
        const cleanPhone = captain.phone ? String(captain.phone).replace(/\D/g, '').slice(-10) : '';
        let referral = await Referral.findOne({
          $or: [
            { referredId: captain._id, referredRole: 'captain' },
            ...(cleanPhone ? [
              { referredPhone: cleanPhone, referredRole: 'captain' },
              { referredPhone: `+91${cleanPhone}`, referredRole: 'captain' },
              { referredPhone: captain.phone, referredRole: 'captain' }
            ] : []),
            ...(captain.referredBy ? [{ referrerId: captain.referredBy, referredId: captain._id, referrerRole: 'captain' }] : [])
          ]
        });

        // If no referral record exists yet, but captain has referredBy, auto-create the referral record!
        if (!referral && captain.referredBy) {
          const referrerCaptain = await Captain.findById(captain.referredBy);
          if (referrerCaptain) {
            const settings = await ReferralSettings.getOrCreateSettings();
            referral = await Referral.create({
              referrerId: referrerCaptain._id,
              referrerRole: 'captain',
              referredId: captain._id,
              referredRole: 'captain',
              referralCode: referrerCaptain.referralCode || 'PROMO',
              status: 'Registered',
              rewardAmount: settings.captainRewardAmount,
              referredPhone: cleanPhone || captain.phone || '',
              referredName: captain.name || 'Captain',
            });
          }
        }

        if (referral) {
          if (!referral.referredId) referral.referredId = captain._id;
          if (captain.name && (!referral.referredName || referral.referredName === 'Captain')) {
            referral.referredName = captain.name;
          }
          if (referral.status !== 'Rewarded') {
            referral.status = 'Approved';
            referral.approvedAt = new Date();
            await referral.save();

            const settings = await ReferralSettings.getOrCreateSettings();
            if (settings.captainReferralEnabled && (settings.captainRewardTrigger === 'admin_approval' || settings.captainRewardTrigger === 'registration')) {
              await processReferralReward(referral._id);
            }
          }
        }
      } catch (refErr) {
        console.warn('[Admin] Referral trigger error on captain approval:', refErr.message);
      }
    } else if (rawStatus === 'rejected') {
      captain.accountStatus = 'rejected';
      captain.status = 'rejected';
    } else if (rawStatus === 'suspended') {
      captain.accountStatus = 'suspended';
      captain.status = 'suspended';
    } else if (rawStatus === 'under_review' || rawStatus === 'pending') {
      captain.accountStatus = 'under_review';
      captain.status = 'pending';
    } else if (rawStatus === 'pending_otp') {
      captain.accountStatus = 'pending_otp';
      captain.status = 'pending';
    }

    await captain.save();
    invalidateCaptainsCache();

    console.log(`[Admin] Updated Captain "${captain.name}" (${captain.phone}) Status to "${captain.accountStatus.toUpperCase()}"`);

    res.status(200).json({
      success: true,
      message: `Captain "${captain.name}" status updated to ${captain.accountStatus.toUpperCase()}`,
      captain,
    });
  } catch (error) {
    next(error);
  }
};

// Delete Captain
export const deleteCaptain = async (req, res, next) => {
  try {
    const { id } = req.params;
    const captain = await Captain.findByIdAndDelete(id);
    if (!captain) {
      return res.status(404).json({ success: false, message: 'Captain not found' });
    }

    invalidateCaptainsCache();

    res.status(200).json({
      success: true,
      message: `Captain "${captain.name}" deleted successfully`,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// CAPTAIN ASSIGNMENT TO ORDER
// ==========================================

// Get available (online + approved) captains for assignment
export const getAvailableCaptains = async (req, res, next) => {
  try {
    const captains = await Captain.find({ status: 'approved', isOnline: true })
      .select('name phone vehicleType city workingArea liveLocation walletBalance')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ success: true, captains, count: captains.length });
  } catch (error) {
    next(error);
  }
};

// Assign a captain to an order
export const assignCaptainToOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { captainId, captainEarnings = 0 } = req.body;

    if (!captainId) {
      return res.status(400).json({ success: false, message: 'captainId is required' });
    }

    const captain = await Captain.findById(captainId);
    if (!captain) {
      return res.status(404).json({ success: false, message: 'Captain not found' });
    }

    const isMongoId = mongoose.Types.ObjectId.isValid(orderId);
    const order = await Order.findOne(
      isMongoId ? { $or: [{ _id: orderId }, { orderId }] } : { orderId }
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Generate 4-digit delivery OTP
    const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();

    const updates = {
      captainId,
      captainStatus: 'Assigned',
      deliveryOtp,
      captainEarnings: Number(captainEarnings),
      captainAssignedAt: new Date(),
    };
    if (order.orderStatus === 'Processing') {
      updates.orderStatus = 'Out for Delivery';
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      order._id,
      { $set: updates },
      { new: true }
    );

    // Customer inbox only when admin moves order to Out for Delivery (not on assign alone)
    if (updates.orderStatus === 'Out for Delivery' && updatedOrder?.user && updatedOrder?.orderId) {
      notifyUserOrderEvent({
        userId: updatedOrder.user,
        orderId: updatedOrder.orderId,
        order: updatedOrder._id,
        type: 'ORDER_OUT_FOR_DELIVERY',
      });
    }

    // Notify the captain
    await CaptainNotification.create({
      captainId,
      type: 'JOB_ASSIGNED',
      title: 'New Delivery Assigned!',
      message: `Order #${order.orderId} has been assigned to you. Payout: ₹${captainEarnings}. Report to pickup location.`,
      orderId: order.orderId,
      order: order._id,
      amount: Number(captainEarnings),
      icon: 'local_shipping',
    });

    console.log(`[Admin] Assigned Captain "${captain.name}" to Order #${order.orderId}. OTP: ${deliveryOtp}`);

    res.status(200).json({
      success: true,
      message: `Captain "${captain.name}" assigned to Order #${order.orderId}`,
      deliveryOtp,
      order,
    });
  } catch (error) {
    next(error);
  }
};

// Get all orders with captain assignment status (for admin order management)
export const getAdminOrders = async (req, res, next) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name phone email')
      .populate('captainId', 'name phone vehicleType')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    res.status(200).json({ success: true, orders, count: orders.length });
  } catch (error) {
    next(error);
  }
};

// Update order status from Admin panel
export const updateAdminOrderStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { orderStatus, sellerStatus, captainStatus, paymentStatus } = req.body;

    const isMongoId = mongoose.Types.ObjectId.isValid(orderId);
    const order = await Order.findOne(
      isMongoId ? { $or: [{ _id: orderId }, { orderId }] } : { orderId }
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (orderStatus) order.orderStatus = orderStatus;
    if (sellerStatus) order.sellerStatus = sellerStatus;
    if (captainStatus) order.captainStatus = captainStatus;
    if (paymentStatus) order.paymentStatus = paymentStatus;

    if (orderStatus === 'Delivered') {
      order.deliveredAt = new Date();
      if (order.paymentMethod === 'COD') {
        order.paymentStatus = 'Paid';
      }
    }

    await order.save();

    const notifType = mapOrderEventToNotificationType({
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      preferFailed: paymentStatus === 'Failed',
    });
    if (notifType && order.user && order.orderId) {
      notifyUserOrderEvent({
        userId: order.user,
        orderId: order.orderId,
        order: order._id,
        type: notifType,
      });
    }

    console.log(`[Admin] Updated Order #${order.orderId} status to "${order.orderStatus}"`);

    res.status(200).json({
      success: true,
      message: `Order #${order.orderId} updated successfully`,
      order
    });
  } catch (error) {
    next(error);
  }
};

// Fetch orders placed by a specific user for Admin User Detail view
export const getUserOrdersForAdmin = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const isMongoId = mongoose.Types.ObjectId.isValid(userId);
    const filter = isMongoId ? { user: userId } : { user: userId };

    const orders = await Order.find(filter)
      .populate('captainId', 'name phone vehicleType')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      orders,
      count: orders.length,
    });
  } catch (error) {
    next(error);
  }
};

// Update Return Order status (Approve / Reject / Complete Return)
export const updateReturnOrderStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { returnStatus, orderStatus, returnReason } = req.body;

    const isMongoId = mongoose.Types.ObjectId.isValid(orderId);
    const order = await Order.findOne(
      isMongoId ? { $or: [{ _id: orderId }, { orderId }] } : { orderId }
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (returnStatus) order.returnStatus = returnStatus;
    if (orderStatus) order.orderStatus = orderStatus;
    if (returnReason) order.returnReason = returnReason;

    if (returnStatus === 'Approved' || orderStatus === 'Returned') {
      order.returnedAt = new Date();
    }

    if (returnStatus === 'Completed' || returnStatus === 'Refunded' || orderStatus === 'Refund Completed' || orderStatus === 'Returned') {
      order.refundStatus = 'Completed';
      order.refundedAt = new Date();
    }

    await order.save();
    if (order.user) invalidateUserOrdersCache(order.user);

    res.status(200).json({
      success: true,
      message: `Return status for Order #${order.orderId} updated to "${order.returnStatus || order.orderStatus}"`,
      order,
    });
  } catch (error) {
    next(error);
  }
};

// Update Seller Details (Admin)
export const updateSellerDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, storeName, commission, balance } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Seller ID is required' });
    }

    const seller = await Seller.findById(id);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }

    // Update fields if provided
    if (name) seller.ownerName = name;
    if (storeName) seller.businessName = storeName;

    // Accept "10", "10%", empty — never write NaN to Mongo
    if (commission !== undefined && commission !== null && String(commission).trim() !== '') {
      const commissionNum = Number(String(commission).replace(/%/g, '').trim());
      if (Number.isNaN(commissionNum)) {
        return res.status(400).json({
          success: false,
          message: 'Commission must be a valid number',
        });
      }
      seller.commissionPercentage = Math.max(0, Math.min(100, commissionNum));
    }

    if (balance !== undefined && balance !== null && String(balance).trim() !== '') {
      const balanceNum = Number(String(balance).replace(/[₹,\s]/g, '').trim());
      if (Number.isNaN(balanceNum)) {
        return res.status(400).json({
          success: false,
          message: 'Wallet balance must be a valid number',
        });
      }
      seller.walletBalance = balanceNum;
    }

    await seller.save();
    invalidateSellersCache();

    res.status(200).json({
      success: true,
      message: 'Seller details updated successfully',
      seller: {
        _id: seller._id,
        ownerName: seller.ownerName,
        businessName: seller.businessName,
        commissionPercentage: seller.commissionPercentage,
        walletBalance: seller.walletBalance,
      }
    });
  } catch (error) {
    next(error);
  }
};

// Update Captain Details (Admin)
export const updateCaptainDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, mobile, city, address, balance, cashCollected } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Captain ID is required' });
    }

    const captain = await Captain.findById(id);
    if (!captain) {
      return res.status(404).json({ success: false, message: 'Captain not found' });
    }

    // Update fields if provided
    if (name) captain.name = name;
    if (mobile) captain.phone = mobile;
    if (city) captain.city = city;
    if (address) captain.currentAddress = address;
    if (balance !== undefined) captain.walletBalance = Number(balance);
    if (cashCollected !== undefined) captain.cashCollected = Number(cashCollected);

    await captain.save();
    invalidateCaptainsCache();

    res.status(200).json({
      success: true,
      message: 'Captain details updated successfully',
      captain: {
        _id: captain._id,
        name: captain.name,
        phone: captain.phone,
        city: captain.city,
        currentAddress: captain.currentAddress,
        walletBalance: captain.walletBalance,
        cashCollected: captain.cashCollected,
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// CAPTAIN COD CASH SETTLEMENTS (Admin)
// ==========================================
export const getCaptainCashSettlements = async (req, res, next) => {
  try {
    const { status } = req.query;

    const query = {};
    if (status && status !== 'ALL') {
      query.status = status;
    }

    const settlements = await CaptainCashSettlement.find(query)
      .populate('captainId', 'name phone email city vehicleType outstandingCash cashCollected totalCodCollected')
      .sort({ createdAt: -1 })
      .lean();

    // Summary calculations across all settlements and captains
    const [captainsSummary, pendingAgg, approvedAgg] = await Promise.all([
      Captain.aggregate([
        {
          $group: {
            _id: null,
            totalOutstanding: { $sum: '$outstandingCash' },
            totalCod: { $sum: '$totalCodCollected' },
            totalCash: { $sum: '$cashCollected' },
          },
        },
      ]).catch(() => []),
      CaptainCashSettlement.aggregate([
        { $match: { status: 'PENDING' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]).catch(() => []),
      CaptainCashSettlement.aggregate([
        { $match: { status: 'APPROVED' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]).catch(() => []),
    ]);

    const summary = {
      totalOutstanding: Number((captainsSummary[0]?.totalOutstanding || 0).toFixed(2)),
      totalCodCollected: Number((captainsSummary[0]?.totalCod || captainsSummary[0]?.totalCash || 0).toFixed(2)),
      pendingSettlementAmount: Number((pendingAgg[0]?.total || 0).toFixed(2)),
      pendingSettlementCount: pendingAgg[0]?.count || 0,
      approvedSettlementAmount: Number((approvedAgg[0]?.total || 0).toFixed(2)),
      approvedSettlementCount: approvedAgg[0]?.count || 0,
    };

    res.json({
      success: true,
      settlements,
      summary,
    });
  } catch (error) {
    next(error);
  }
};

export const processCaptainCashSettlement = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, adminRemarks = '' } = req.body;

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid action. Must be APPROVE or REJECT.' });
    }

    const isMongoId = mongoose.Types.ObjectId.isValid(id);
    const query = isMongoId ? { $or: [{ _id: id }, { settlementId: id }] } : { settlementId: id };

    const settlement = await CaptainCashSettlement.findOne(query);
    if (!settlement) {
      return res.status(404).json({ success: false, message: 'Settlement request not found' });
    }

    if (settlement.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: `This settlement request is already ${settlement.status}.` });
    }

    const captain = await Captain.findById(settlement.captainId);
    if (!captain) {
      return res.status(404).json({ success: false, message: 'Captain associated with this settlement was not found' });
    }

    const now = new Date();
    settlement.processedAt = now;
    settlement.processedBy = req.user?.id || req.user?._id || null;
    settlement.adminRemarks = adminRemarks || (action === 'APPROVE' ? 'Approved by Administrator' : 'Rejected by Administrator');

    if (action === 'APPROVE') {
      const settleAmount = Number(settlement.amount);
      const currentOutstanding = Number(captain.outstandingCash || 0);

      // Deduct from captain's outstanding cash
      const newOutstanding = Math.max(0, Number((currentOutstanding - settleAmount).toFixed(2)));
      captain.outstandingCash = newOutstanding;
      await captain.save();

      settlement.status = 'APPROVED';
      settlement.outstandingBefore = currentOutstanding;
      settlement.outstandingAfter = newOutstanding;
      await settlement.save();

      // Record in Platform Central Ledger
      try {
        await PlatformLedger.create({
          transactionId: `TXN-LED-SET-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`,
          category: 'CAPTAIN_CASH_SETTLEMENT',
          type: 'CREDIT',
          amount: settleAmount,
          source: 'CAPTAIN',
          destination: 'PLATFORM_TREASURY',
          entityType: 'CAPTAIN',
          entityId: String(captain._id),
          entityName: captain.name || 'Captain',
          referenceModel: 'CaptainCashSettlement',
          referenceId: settlement.settlementId,
          referenceObjId: settlement._id,
          status: 'SUCCESS',
          balanceBefore: currentOutstanding,
          balanceAfter: newOutstanding,
          description: `COD Cash Settlement #${settlement.settlementId} verified and settled (Amount: ₹${settleAmount})`,
          metadata: { settlementId: settlement.settlementId, amount: settleAmount, paymentMode: settlement.paymentMode },
        });
      } catch (ledErr) {
        console.warn('[PlatformLedger] Failed to log settlement:', ledErr.message);
      }

      // Notify captain
      try {
        await CaptainNotification.create({
          captainId: captain._id,
          type: 'PAYMENT',
          title: 'Cash Settlement Approved',
          message: `Your COD cash settlement of ₹${settleAmount.toFixed(2)} (#${settlement.settlementId}) has been verified and approved. Remaining outstanding: ₹${newOutstanding.toFixed(2)}.`,
          amount: settleAmount,
          icon: 'verified',
        });
      } catch (notifErr) {
        console.warn('[CaptainNotification] Settlement notice failed:', notifErr.message);
      }

      return res.json({
        success: true,
        message: `Settlement #${settlement.settlementId} approved. ₹${settleAmount.toFixed(2)} deducted from captain's outstanding cash balance.`,
        settlement,
        captain: {
          _id: captain._id,
          outstandingCash: captain.outstandingCash,
        },
      });
    } else {
      // REJECT
      settlement.status = 'REJECTED';
      await settlement.save();

      // Notify captain
      try {
        await CaptainNotification.create({
          captainId: captain._id,
          type: 'PAYMENT',
          title: 'Cash Settlement Rejected',
          message: `Your COD cash settlement request of ₹${settlement.amount.toFixed(2)} (#${settlement.settlementId}) was rejected. Reason: ${adminRemarks || 'Verification unsuccessful'}.`,
          amount: settlement.amount,
          icon: 'cancel',
        });
      } catch (notifErr) {
        console.warn('[CaptainNotification] Settlement reject notice failed:', notifErr.message);
      }

      return res.json({
        success: true,
        message: `Settlement #${settlement.settlementId} has been rejected.`,
        settlement,
      });
    }
  } catch (error) {
    console.error('[processCaptainCashSettlement ERROR]', error);
    next(error);
  }
};


