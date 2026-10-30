import CommissionSettings from '../models/CommissionSettings.model.js';
import DeliveryPricing from '../models/DeliveryPricing.model.js';
import Order from '../models/Order.model.js';
import TransportBooking from '../models/TransportBooking.model.js';
import Seller from '../models/Seller.model.js';
import Captain from '../models/Captain.model.js';

// @desc    Get Current Active Commission Settings (Admin)
// @route   GET /api/admin/commission-settings
// @access  Private (Admin / Super Admin)
export const getCommissionSettings = async (req, res, next) => {
  try {
    const settings = await CommissionSettings.getOrCreateActiveSettings();
    res.status(200).json({
      success: true,
      settings,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Dynamic Commission & Delivery Settings (Admin)
// @route   PUT /api/admin/commission-settings
// @access  Private (Admin / Super Admin)
export const updateCommissionSettings = async (req, res, next) => {
  try {
    const { 
      sellerCommission, 
      captainCommission, 
      deliveryCharge, 
      freeDeliveryMinOrder, 
      isFreeDeliveryEnabled, 
      codCharge,
      isCodChargeEnabled,
      isActive = true, 
      reason 
    } = req.body;

    let settings = await CommissionSettings.getOrCreateActiveSettings();
    const adminIdentifier = req.user?.email || req.user?.name || req.user?.phone || 'Admin';

    let sellerRate = settings.sellerCommission;
    let captainRate = settings.captainCommission;

    if (sellerCommission !== undefined && sellerCommission !== null && !isNaN(Number(sellerCommission))) {
      sellerRate = Number(sellerCommission);
      if (sellerRate < 0 || sellerRate > 100) {
        return res.status(400).json({
          success: false,
          message: 'Seller commission must be between 0% and 100%.',
        });
      }
      settings.sellerCommission = sellerRate;
    }

    if (captainCommission !== undefined && captainCommission !== null && !isNaN(Number(captainCommission))) {
      captainRate = Number(captainCommission);
      if (captainRate < 0 || captainRate > 100) {
        return res.status(400).json({
          success: false,
          message: 'Captain commission must be between 0% and 100%.',
        });
      }
      settings.captainCommission = captainRate;
    }

    if (deliveryCharge !== undefined && deliveryCharge !== null && !isNaN(Number(deliveryCharge))) {
      const charge = Number(deliveryCharge);
      if (charge < 0) {
        return res.status(400).json({
          success: false,
          message: 'Delivery charge cannot be negative.',
        });
      }
      settings.deliveryCharge = charge;
    }

    if (freeDeliveryMinOrder !== undefined && freeDeliveryMinOrder !== null && !isNaN(Number(freeDeliveryMinOrder))) {
      const minOrder = Number(freeDeliveryMinOrder);
      if (minOrder < 0) {
        return res.status(400).json({
          success: false,
          message: 'Free delivery minimum order amount cannot be negative.',
        });
      }
      settings.freeDeliveryMinOrder = minOrder;
    }

    if (isFreeDeliveryEnabled !== undefined) {
      settings.isFreeDeliveryEnabled = Boolean(isFreeDeliveryEnabled);
    }

    if (codCharge !== undefined && codCharge !== null && !isNaN(Number(codCharge))) {
      const codVal = Number(codCharge);
      if (codVal < 0) {
        return res.status(400).json({
          success: false,
          message: 'Cash on Delivery (COD) charge cannot be negative.',
        });
      }
      settings.codCharge = codVal;
    }

    if (isCodChargeEnabled !== undefined) {
      settings.isCodChargeEnabled = Boolean(isCodChargeEnabled);
    }

    settings.isActive = Boolean(isActive);
    settings.updatedBy = adminIdentifier;

    // Record audit history entry
    const historyEntry = {
      sellerCommission: settings.sellerCommission,
      captainCommission: settings.captainCommission,
      sellerCommissionType: 'Percentage',
      captainCommissionType: 'Percentage',
      deliveryCharge: settings.deliveryCharge,
      freeDeliveryMinOrder: settings.freeDeliveryMinOrder,
      isFreeDeliveryEnabled: settings.isFreeDeliveryEnabled,
      codCharge: settings.codCharge,
      isCodChargeEnabled: settings.isCodChargeEnabled,
      isActive: settings.isActive,
      changedBy: adminIdentifier,
      changedAt: new Date(),
      reason: reason ? String(reason).trim() : `Admin updated settings: Seller ${settings.sellerCommission}%, Captain ${settings.captainCommission}%, Delivery: ₹${settings.deliveryCharge}, Free Above: ₹${settings.freeDeliveryMinOrder}, COD: ₹${settings.codCharge} (${settings.isCodChargeEnabled ? 'Enabled' : 'Disabled'})`,
    };

    settings.history.unshift(historyEntry);

    // Keep history manageable to max 50 entries
    if (settings.history.length > 50) {
      settings.history = settings.history.slice(0, 50);
    }

    await settings.save();

    // Sync delivery and COD settings to active DeliveryPricing configuration
    try {
      await DeliveryPricing.updateMany(
        { isActive: true },
        {
          $set: {
            baseDeliveryFee: settings.deliveryCharge,
            freeDeliveryThreshold: settings.freeDeliveryMinOrder,
            isFreeDeliveryEnabled: settings.isFreeDeliveryEnabled,
            codCharge: settings.codCharge,
            isCodChargeEnabled: settings.isCodChargeEnabled,
            updatedBy: adminIdentifier,
          },
        }
      );
    } catch (syncErr) {
      console.warn('[CommissionSettings] Error syncing to DeliveryPricing:', syncErr.message);
    }

    console.log(`[CommissionSettings] Updated by ${adminIdentifier}: Seller ${settings.sellerCommission}%, Captain ${settings.captainCommission}%, Delivery ₹${settings.deliveryCharge}, Free Delivery above ₹${settings.freeDeliveryMinOrder}, COD ₹${settings.codCharge}`);

    res.status(200).json({
      success: true,
      message: 'Platform commission and delivery settings updated successfully.',
      settings,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Current Public / App Commission & Delivery Rates (Read-only for Users, Sellers & Captains)
// @route   GET /api/commission-settings/current
// @access  Public / Authenticated
export const getCurrentCommissionRates = async (req, res, next) => {
  try {
    const [settings, deliveryPricing] = await Promise.all([
      CommissionSettings.getOrCreateActiveSettings(),
      DeliveryPricing.getActiveConfig(),
    ]);

    const deliveryCharge = settings.deliveryCharge !== undefined
      ? settings.deliveryCharge
      : (deliveryPricing?.isActive && deliveryPricing?.baseDeliveryFee !== undefined ? deliveryPricing.baseDeliveryFee : 40);

    const freeDeliveryMinOrder = settings.freeDeliveryMinOrder !== undefined
      ? settings.freeDeliveryMinOrder
      : (deliveryPricing?.isActive && deliveryPricing?.freeDeliveryThreshold !== undefined ? deliveryPricing.freeDeliveryThreshold : 500);

    const isFreeDeliveryEnabled = settings.isFreeDeliveryEnabled !== undefined
      ? settings.isFreeDeliveryEnabled
      : (deliveryPricing?.isActive && deliveryPricing?.isFreeDeliveryEnabled !== undefined ? deliveryPricing.isFreeDeliveryEnabled : true);

    const codCharge = settings.codCharge !== undefined
      ? settings.codCharge
      : (deliveryPricing?.isActive && deliveryPricing?.codCharge !== undefined ? deliveryPricing.codCharge : 9);

    const isCodChargeEnabled = settings.isCodChargeEnabled !== undefined
      ? settings.isCodChargeEnabled
      : (deliveryPricing?.isActive && deliveryPricing?.isCodChargeEnabled !== undefined ? deliveryPricing.isCodChargeEnabled : true);

    res.status(200).json({
      success: true,
      sellerCommission: settings.sellerCommission,
      captainCommission: settings.captainCommission,
      sellerCommissionType: settings.sellerCommissionType || 'Percentage',
      captainCommissionType: settings.captainCommissionType || 'Percentage',
      deliveryCharge,
      freeDeliveryMinOrder,
      isFreeDeliveryEnabled,
      codCharge,
      isCodChargeEnabled,
      isActive: settings.isActive,
      updatedAt: settings.updatedAt || deliveryPricing?.updatedAt,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Commission Transaction Reports (Admin)
// @route   GET /api/admin/commission-reports
// @access  Private (Admin / Super Admin)
export const getCommissionReports = async (req, res, next) => {
  try {
    const {
      seller = '',
      captain = '',
      orderId = '',
      commissionType = 'ALL', // 'ALL' | 'SELLER' | 'CAPTAIN'
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.max(1, Math.min(100, Number(limit)));

    // Date range filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }

    // Build Order Query
    const orderQuery = {};
    if (startDate || endDate) {
      orderQuery.createdAt = dateFilter;
    }
    if (orderId) {
      orderQuery.orderId = { $regex: String(orderId).trim(), $options: 'i' };
    }

    // Fetch matching Orders with seller & captain populated (optimized projection)
    const ordersPromise = Order.find(orderQuery)
      .select('orderId items shippingAddress paymentMethod paymentStatus orderStatus grandTotal itemsTotal sellerCommissionRate sellerCommissionAmount sellerEarning captainCommissionRate captainCommissionAmount captainEarnings captainEarning captainStatus createdAt')
      .populate('captainId', 'name phone vehicleType')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Fetch matching Transport Bookings (optimized projection)
    const bookingQuery = {};
    if (startDate || endDate) {
      bookingQuery.createdAt = dateFilter;
    }
    if (orderId) {
      bookingQuery.bookingId = { $regex: String(orderId).trim(), $options: 'i' };
    }

    const bookingsPromise = TransportBooking.find(bookingQuery)
      .select('bookingId fareBreakdown paymentMethod paymentStatus status captainCommissionRate captainCommissionAmount captainEarnings captainEarning createdAt')
      .populate('captainId', 'name phone vehicleType')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const [rawOrders, rawBookings] = await Promise.all([ordersPromise, bookingsPromise]);

    const formattedRecords = [];

    // Process E-Commerce Orders
    for (const ord of rawOrders) {
      const firstItemSeller = ord.items?.[0]?.seller || 'Sathi Seller Official Store';
      const orderAmount = Number(ord.grandTotal || ord.itemsTotal || 0);

      // Snapshot values or dynamic fallback if older document
      const sellerCommRate = ord.sellerCommissionRate !== undefined ? ord.sellerCommissionRate : 10;
      const sellerCommAmt = ord.sellerCommissionAmount !== undefined ? ord.sellerCommissionAmount : Number(((orderAmount * sellerCommRate) / 100).toFixed(2));
      const sellerNetEarn = ord.sellerEarning !== undefined ? ord.sellerEarning : Number((orderAmount - sellerCommAmt).toFixed(2));

      const captainCommRate = ord.captainCommissionRate !== undefined ? ord.captainCommissionRate : 5;
      const captainCommAmt = ord.captainCommissionAmount !== undefined ? ord.captainCommissionAmount : Number(((orderAmount * captainCommRate) / 100).toFixed(2));
      const captainNetEarn = ord.captainEarnings !== undefined ? ord.captainEarnings : (ord.captainEarning || captainCommAmt);

      formattedRecords.push({
        id: ord._id,
        orderId: ord.orderId,
        type: 'E-Commerce Order',
        sellerName: firstItemSeller,
        sellerId: null,
        captainName: ord.captainId?.name || (ord.captainStatus ? 'Assigned Captain' : 'Unassigned'),
        captainPhone: ord.captainId?.phone || '',
        captainId: ord.captainId?._id || null,
        orderAmount,
        sellerCommissionRate: sellerCommRate,
        sellerCommissionAmount: sellerCommAmt,
        sellerEarning: sellerNetEarn,
        captainCommissionRate: captainCommRate,
        captainCommissionAmount: captainCommAmt,
        captainEarning: captainNetEarn,
        orderStatus: ord.orderStatus,
        paymentStatus: ord.paymentStatus,
        createdAt: ord.createdAt,
      });
    }

    // Process Transport Bookings
    for (const trb of rawBookings) {
      const totalFare = Number(trb.fareBreakdown?.totalFare || 0);
      const captainCommRate = trb.captainCommissionRate !== undefined ? trb.captainCommissionRate : 5;
      const captainCommAmt = trb.captainCommissionAmount !== undefined ? trb.captainCommissionAmount : Number(((totalFare * captainCommRate) / 100).toFixed(2));
      const captainNetEarn = trb.captainEarnings !== undefined ? trb.captainEarnings : (totalFare - captainCommAmt);

      formattedRecords.push({
        id: trb._id,
        orderId: trb.bookingId,
        type: 'Transport Ride',
        sellerName: 'N/A (Direct Cargo/Ride)',
        sellerId: null,
        captainName: trb.captainId?.name || (trb.captainId ? 'Assigned Captain' : 'Searching'),
        captainPhone: trb.captainId?.phone || '',
        captainId: trb.captainId?._id || null,
        orderAmount: totalFare,
        sellerCommissionRate: 0,
        sellerCommissionAmount: 0,
        sellerEarning: 0,
        captainCommissionRate: captainCommRate,
        captainCommissionAmount: captainCommAmt,
        captainEarning: captainNetEarn,
        orderStatus: trb.status,
        paymentStatus: trb.paymentStatus,
        createdAt: trb.createdAt,
      });
    }

    // Sort by latest createdAt
    formattedRecords.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply In-Memory Filters for Seller / Captain text matches & Commission Type
    let filtered = formattedRecords;

    if (seller) {
      const sLower = String(seller).trim().toLowerCase();
      filtered = filtered.filter((r) => r.sellerName.toLowerCase().includes(sLower));
    }

    if (captain) {
      const cLower = String(captain).trim().toLowerCase();
      filtered = filtered.filter((r) => r.captainName.toLowerCase().includes(cLower));
    }

    if (commissionType === 'SELLER') {
      filtered = filtered.filter((r) => r.sellerCommissionAmount > 0);
    } else if (commissionType === 'CAPTAIN') {
      filtered = filtered.filter((r) => r.captainCommissionAmount > 0);
    }

    // Aggregate statistics across filtered dataset
    const stats = filtered.reduce(
      (acc, curr) => {
        acc.totalTransactions += 1;
        acc.totalVolume += curr.orderAmount;
        acc.totalSellerCommission += curr.sellerCommissionAmount;
        acc.totalCaptainCommission += curr.captainCommissionAmount;
        acc.totalSellerEarnings += curr.sellerEarning;
        acc.totalCaptainEarnings += curr.captainEarning;
        return acc;
      },
      {
        totalTransactions: 0,
        totalVolume: 0,
        totalSellerCommission: 0,
        totalCaptainCommission: 0,
        totalSellerEarnings: 0,
        totalCaptainEarnings: 0,
      }
    );

    // Round stats to 2 decimal places
    stats.totalVolume = Number(stats.totalVolume.toFixed(2));
    stats.totalSellerCommission = Number(stats.totalSellerCommission.toFixed(2));
    stats.totalCaptainCommission = Number(stats.totalCaptainCommission.toFixed(2));
    stats.totalSellerEarnings = Number(stats.totalSellerEarnings.toFixed(2));
    stats.totalCaptainEarnings = Number(stats.totalCaptainEarnings.toFixed(2));

    const totalCount = filtered.length;
    const paginated = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.status(200).json({
      success: true,
      stats,
      reports: paginated,
      pagination: {
        totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};
