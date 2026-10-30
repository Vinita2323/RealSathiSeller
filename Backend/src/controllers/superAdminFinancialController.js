import mongoose from 'mongoose';
import PlatformLedger from '../models/PlatformLedger.model.js';
import PayoutRequest from '../models/PayoutRequest.model.js';
import FinancialAdjustment from '../models/FinancialAdjustment.model.js';
import RefundRequest from '../models/RefundRequest.model.js';
import FinancialAuditLog from '../models/FinancialAuditLog.model.js';
import Seller from '../models/Seller.model.js';
import Captain from '../models/Captain.model.js';
import Order from '../models/Order.model.js';
import SellerNotification from '../models/SellerNotification.model.js';
import WalletTransaction from '../models/WalletTransaction.model.js';
import WithdrawalRequest from '../models/WithdrawalRequest.model.js';
import CaptainTransaction from '../models/CaptainTransaction.model.js';
import CodCashCollection from '../models/CodCashCollection.model.js';
import CaptainCashSettlement from '../models/CaptainCashSettlement.model.js';

// Helper: Log financial audit entry
const logAudit = async ({
  actorId,
  actorEmail,
  action,
  targetEntity,
  targetId,
  amount = null,
  previousValue = null,
  newValue = null,
  ipAddress = '',
  userAgent = '',
  remarks = '',
}) => {
  try {
    const logId = `AUD-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;
    await FinancialAuditLog.create({
      logId,
      actorId,
      actorEmail: actorEmail || 'superadmin@sathiseller.com',
      actorRole: 'super_admin',
      action,
      targetEntity,
      targetId: String(targetId || ''),
      amount,
      previousValue,
      newValue,
      ipAddress,
      userAgent,
      remarks,
    });
  } catch (err) {
    console.error('[FinancialAuditLog] Failed to record audit log:', err.message);
  }
};

// =========================================================================
// 1. FINANCIAL DASHBOARD LIVE METRICS
// =========================================================================
export const getFinancialDashboardStats = async (req, res, next) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const [
      ordersAgg,
      todayOrdersAgg,
      sellersAgg,
      captainsAgg,
      pendingPayoutsAgg,
      completedPayoutsAgg,
      todayPayoutsAgg,
      refundsAgg,
      pendingSettlementsAgg,
      monthlyVolumeAgg,
      recentLedger,
    ] = await Promise.all([
      // Total Gross Volume & Total Orders
      Order.aggregate([
        { $match: { $or: [{ paymentStatus: 'Paid' }, { paymentMethod: 'COD' }] } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$grandTotal' },
            totalCount: { $sum: 1 },
          },
        },
      ]).catch(() => []),

      // Today's Revenue & Transactions
      Order.aggregate([
        { $match: { createdAt: { $gte: todayStart }, $or: [{ paymentStatus: 'Paid' }, { paymentMethod: 'COD' }] } },
        {
          $group: {
            _id: null,
            todayRevenue: { $sum: '$grandTotal' },
            todayCount: { $sum: 1 },
          },
        },
      ]).catch(() => []),

      // Total Seller Earnings & Liabilities
      Seller.aggregate([
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: '$totalEarnings' },
            totalCommission: { $sum: '$totalCommissionDeducted' },
            totalWalletLiabilities: { $sum: '$walletBalance' },
            totalWithdrawn: { $sum: '$totalWithdrawn' },
          },
        },
      ]).catch(() => []),

      // Total Captain Balance & Liabilities
      Captain.aggregate([
        {
          $group: {
            _id: null,
            totalWalletLiabilities: { $sum: '$walletBalance' },
            totalCashCollected: { $sum: '$cashCollected' },
            totalOutstandingCash: { $sum: '$outstandingCash' },
            totalCodCollected: { $sum: '$totalCodCollected' },
          },
        },
      ]).catch(() => []),

      // Pending Payouts (both Seller & Captain)
      PayoutRequest.aggregate([
        { $match: { status: { $in: ['PENDING', 'APPROVED', 'PROCESSING'] } } },
        {
          $group: {
            _id: '$recipientType',
            totalAmount: { $sum: '$requestedAmount' },
            count: { $sum: 1 },
          },
        },
      ]).catch(() => []),

      // Completed Payouts
      PayoutRequest.aggregate([
        { $match: { status: 'PAID' } },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$approvedAmount' },
            count: { $sum: 1 },
          },
        },
      ]).catch(() => []),

      // Today Completed Payouts
      PayoutRequest.aggregate([
        { $match: { status: 'PAID', paidAt: { $gte: todayStart } } },
        {
          $group: {
            _id: null,
            todayPayoutAmount: { $sum: '$approvedAmount' },
            todayPayoutCount: { $sum: 1 },
          },
        },
      ]).catch(() => []),

      // Refunds Summary
      RefundRequest.aggregate([
        {
          $group: {
            _id: '$status',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]).catch(() => []),

      // Pending Settlements from Seller Notifications
      SellerNotification.aggregate([
        { $match: { settlementStatus: 'PENDING' } },
        {
          $group: {
            _id: null,
            pendingSellerAmount: { $sum: '$netSellerAmount' },
            pendingCommission: { $sum: '$commissionAmount' },
            count: { $sum: 1 },
          },
        },
      ]).catch(() => []),

      // Monthly Volumes (last 6 months)
      Order.aggregate([
        { $match: { createdAt: { $gte: sixMonthsAgo }, $or: [{ paymentStatus: 'Paid' }, { paymentMethod: 'COD' }] } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            volume: { $sum: '$grandTotal' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]).catch(() => []),

      // Recent 10 Central Ledger entries
      PlatformLedger.find().sort({ createdAt: -1 }).limit(10).lean().catch(() => []),
    ]);

    // Extract metrics
    const totalPlatformRevenue = Number((ordersAgg[0]?.totalRevenue || 0).toFixed(2));
    const totalCustomerTransactions = ordersAgg[0]?.totalCount || 0;

    const todayRevenue = Number((todayOrdersAgg[0]?.todayRevenue || 0).toFixed(2));
    const todayTransactions = todayOrdersAgg[0]?.todayCount || 0;

    const totalSellerEarnings = Number((sellersAgg[0]?.totalEarnings || 0).toFixed(2));
    const totalPlatformCommission = Number((sellersAgg[0]?.totalCommission || 0).toFixed(2));
    const sellerOutstandingLiability = Number((sellersAgg[0]?.totalWalletLiabilities || 0).toFixed(2));

    const captainOutstandingLiability = Number((captainsAgg[0]?.totalWalletLiabilities || 0).toFixed(2));

    // Calculate Captain Total Earnings from transactions
    const captainEarningsAgg = await CaptainTransaction.aggregate([
      { $match: { type: 'CREDIT' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]).catch(() => []);
    const totalCaptainEarnings = Number((captainEarningsAgg[0]?.total || 0).toFixed(2));

    // Pending Payouts breakdown
    let pendingSellerPayouts = 0;
    let pendingSellerPayoutsCount = 0;
    let pendingCaptainPayouts = 0;
    let pendingCaptainPayoutsCount = 0;

    pendingPayoutsAgg.forEach((group) => {
      if (group._id === 'SELLER') {
        pendingSellerPayouts = Number((group.totalAmount || 0).toFixed(2));
        pendingSellerPayoutsCount = group.count || 0;
      } else if (group._id === 'CAPTAIN') {
        pendingCaptainPayouts = Number((group.totalAmount || 0).toFixed(2));
        pendingCaptainPayoutsCount = group.count || 0;
      }
    });

    // Also include legacy pending WithdrawalRequests from sellers if not yet in PayoutRequest
    const legacyPendingWithdrawals = await WithdrawalRequest.aggregate([
      { $match: { status: 'PENDING' } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]).catch(() => []);
    if (legacyPendingWithdrawals[0] && pendingSellerPayoutsCount === 0) {
      pendingSellerPayouts = Number((legacyPendingWithdrawals[0].total || 0).toFixed(2));
      pendingSellerPayoutsCount = legacyPendingWithdrawals[0].count || 0;
    }

    const totalCompletedPayouts = Number((completedPayoutsAgg[0]?.totalAmount || 0).toFixed(2));
    const totalCompletedPayoutsCount = completedPayoutsAgg[0]?.count || 0;

    const todayPayoutsAmount = Number((todayPayoutsAgg[0]?.todayPayoutAmount || 0).toFixed(2));
    const todayPayoutsCount = todayPayoutsAgg[0]?.todayPayoutCount || 0;

    const pendingSettlementsAmount = Number((pendingSettlementsAgg[0]?.pendingSellerAmount || 0).toFixed(2));
    const pendingSettlementsCount = pendingSettlementsAgg[0]?.count || 0;

    // Total Platform Liabilities (Money currently owed to sellers and captains in their wallets)
    const totalOutstandingLiabilities = Number(
      (sellerOutstandingLiability + captainOutstandingLiability).toFixed(2)
    );

    // Total refunds processed
    const completedRefunds = refundsAgg.find((r) => r._id === 'COMPLETED');
    const totalRefundsAmount = Number((completedRefunds?.totalAmount || 0).toFixed(2));
    const totalRefundsCount = completedRefunds?.count || 0;

    // Captain COD Cash & Settlement metrics
    const outstandingCaptainCash = Number((captainsAgg[0]?.totalOutstandingCash || 0).toFixed(2));
    const totalCodCollected = Number((captainsAgg[0]?.totalCodCollected || captainsAgg[0]?.totalCashCollected || 0).toFixed(2));

    const pendingCaptainCashSettlements = await CaptainCashSettlement.aggregate([
      { $match: { status: 'PENDING' } },
      { $group: { _id: null, totalAmount: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]).catch(() => []);
    const pendingCashSettlementsAmount = Number((pendingCaptainCashSettlements[0]?.totalAmount || 0).toFixed(2));
    const pendingCashSettlementsCount = pendingCaptainCashSettlements[0]?.count || 0;

    // Format Monthly Charts
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyChartData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
      const found = monthlyVolumeAgg.find((m) => m._id === key);
      monthlyChartData.push({
        month: label,
        volume: found ? Number(found.volume.toFixed(2)) : 0,
        orders: found ? found.count : 0,
      });
    }

    res.status(200).json({
      success: true,
      metrics: {
        totalPlatformRevenue,
        totalCustomerTransactions,
        totalSellerEarnings,
        totalCaptainEarnings,
        totalPlatformCommission,
        totalPendingSellerPayouts: pendingSellerPayouts,
        pendingSellerPayoutsCount,
        totalPendingCaptainPayouts: pendingCaptainPayouts,
        pendingCaptainPayoutsCount,
        totalCompletedPayouts,
        totalCompletedPayoutsCount,
        totalPendingSettlements: pendingSettlementsAmount,
        pendingSettlementsCount,
        todayTransactionsVolume: todayRevenue,
        todayTransactionsCount: todayTransactions,
        todayPayoutsAmount,
        todayPayoutsCount,
        totalOutstandingLiabilities,
        sellerOutstandingLiability,
        captainOutstandingLiability,
        totalRefundsAmount,
        totalRefundsCount,
        outstandingCaptainCash,
        totalCodCollected,
        pendingCashSettlementsAmount,
        pendingCashSettlementsCount,
      },
      monthlyChartData,
      recentLedger,
    });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 2. CENTRAL TRANSACTION LEDGER
// =========================================================================
export const getLedgerTransactions = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const { category, type, status, entityType, search, startDate, endDate } = req.query;

    const query = {};

    if (category && category !== 'ALL') query.category = category;
    if (type && type !== 'ALL') query.type = type;
    if (status && status !== 'ALL') query.status = status;
    if (entityType && entityType !== 'ALL') query.entityType = entityType;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    if (search && search.trim()) {
      const cleanSearch = search.trim();
      query.$or = [
        { transactionId: { $regex: cleanSearch, $options: 'i' } },
        { referenceId: { $regex: cleanSearch, $options: 'i' } },
        { entityName: { $regex: cleanSearch, $options: 'i' } },
        { description: { $regex: cleanSearch, $options: 'i' } },
      ];
    }

    const [transactions, total] = await Promise.all([
      PlatformLedger.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PlatformLedger.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: transactions.length,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      transactions,
    });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 3. UNIFIED PAYOUT REQUESTS (SELLER & CAPTAIN)
// =========================================================================
export const getPayoutRequests = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const { recipientType, status, search, startDate, endDate } = req.query;

    const query = {};

    if (recipientType && recipientType !== 'ALL') {
      query.recipientType = recipientType.toUpperCase();
    }

    if (status && status !== 'ALL') {
      query.status = status.toUpperCase();
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    if (search && search.trim()) {
      const clean = search.trim();
      query.$or = [
        { payoutId: { $regex: clean, $options: 'i' } },
        { recipientName: { $regex: clean, $options: 'i' } },
        { recipientPhone: { $regex: clean, $options: 'i' } },
        { paymentReference: { $regex: clean, $options: 'i' } },
      ];
    }

    const [payouts, total] = await Promise.all([
      PayoutRequest.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PayoutRequest.countDocuments(query),
    ]);

    // Count summary badges
    const [pendingCount, approvedCount, processingCount, paidCount, rejectedCount] = await Promise.all([
      PayoutRequest.countDocuments({ status: 'PENDING' }),
      PayoutRequest.countDocuments({ status: 'APPROVED' }),
      PayoutRequest.countDocuments({ status: 'PROCESSING' }),
      PayoutRequest.countDocuments({ status: 'PAID' }),
      PayoutRequest.countDocuments({ status: 'REJECTED' }),
    ]);

    res.status(200).json({
      success: true,
      counts: {
        all: total,
        pending: pendingCount,
        approved: approvedCount,
        processing: processingCount,
        paid: paidCount,
        rejected: rejectedCount,
      },
      payouts,
      page,
      pages: Math.ceil(total / limit) || 1,
      total,
    });
  } catch (error) {
    next(error);
  }
};

// Get single Payout Request details + recipient financial profile
export const getPayoutRequestById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isMongoId = mongoose.Types.ObjectId.isValid(id);
    const payout = await PayoutRequest.findOne(
      isMongoId ? { $or: [{ _id: id }, { payoutId: id }] } : { payoutId: id }
    ).lean();

    if (!payout) {
      return res.status(404).json({ success: false, message: 'Payout request not found' });
    }

    let recipientFinancials = null;
    if (payout.recipientType === 'SELLER') {
      const seller = await Seller.findById(payout.recipientId).lean();
      if (seller) {
        recipientFinancials = {
          businessName: seller.businessName,
          ownerName: seller.ownerName,
          phone: seller.phone,
          availableBalance: seller.walletBalance || 0,
          pendingBalance: seller.pendingBalance || 0,
          totalEarnings: seller.totalEarnings || 0,
          totalCommissionDeducted: seller.totalCommissionDeducted || 0,
          totalWithdrawn: seller.totalWithdrawn || 0,
          commissionPercentage: seller.commissionPercentage || 10,
        };
      }
    } else if (payout.recipientType === 'CAPTAIN') {
      const captain = await Captain.findById(payout.recipientId).lean();
      if (captain) {
        recipientFinancials = {
          name: captain.name,
          phone: captain.phone,
          availableBalance: captain.walletBalance || 0,
          cashCollected: captain.cashCollected || 0,
          vehicleType: captain.vehicleType,
        };
      }
    }

    res.status(200).json({
      success: true,
      payout,
      recipientFinancials,
    });
  } catch (error) {
    next(error);
  }
};

// Approve Payout Request
export const approvePayout = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { approvedAmount, remarks } = req.body;

    const payout = await PayoutRequest.findById(id);
    if (!payout) {
      return res.status(404).json({ success: false, message: 'Payout request not found' });
    }

    if (payout.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve payout in status "${payout.status}". Payout must be in PENDING status.`,
      });
    }

    const previousStatus = payout.status;
    payout.status = 'APPROVED';
    payout.approvedAmount = approvedAmount ? Number(approvedAmount) : payout.requestedAmount;
    payout.approvedBy = req.user.id;
    payout.approvedAt = new Date();
    if (remarks) payout.remarks = remarks;
    await payout.save();

    await logAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'APPROVE_PAYOUT',
      targetEntity: 'PayoutRequest',
      targetId: payout.payoutId,
      amount: payout.approvedAmount,
      previousValue: { status: previousStatus },
      newValue: { status: 'APPROVED', approvedAmount: payout.approvedAmount },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      remarks: remarks || 'Super Admin approved payout request',
    });

    res.status(200).json({
      success: true,
      message: `Payout #${payout.payoutId} approved successfully`,
      payout,
    });
  } catch (error) {
    next(error);
  }
};

// Reject Payout Request (Unreserves and refunds funds back to available balance)
export const rejectPayout = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rejectionReason, remarks } = req.body;

    if (!rejectionReason && !remarks) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    }

    const payout = await PayoutRequest.findById(id);
    if (!payout) {
      return res.status(404).json({ success: false, message: 'Payout request not found' });
    }

    if (['PAID', 'REJECTED'].includes(payout.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot reject payout that is already ${payout.status}`,
      });
    }

    const previousStatus = payout.status;
    const refundAmt = payout.requestedAmount;

    // Refund funds back to recipient wallet balance atomically
    let balanceBefore = 0;
    let balanceAfter = 0;

    if (payout.recipientType === 'SELLER') {
      const seller = await Seller.findById(payout.recipientId);
      if (seller) {
        balanceBefore = Number(seller.walletBalance || 0);
        balanceAfter = Number((balanceBefore + refundAmt).toFixed(2));
        seller.walletBalance = balanceAfter;
        seller.totalWithdrawn = Number(Math.max(0, (seller.totalWithdrawn || 0) - refundAmt).toFixed(2));
        await seller.save();

        // Create Wallet Transaction Record
        const txnId = `TXN-REF-${Date.now().toString().slice(-6)}`;
        await WalletTransaction.create({
          transactionId: txnId,
          sellerId: String(seller._id),
          orderId: payout.payoutId,
          type: 'CREDIT',
          grossAmount: refundAmt,
          netAmount: refundAmt,
          balanceBefore,
          balanceAfter,
          paymentMethod: 'BANK_TRANSFER',
          settlementStatus: 'SETTLED',
          description: `Refund for Rejected Payout #${payout.payoutId}. Reason: ${rejectionReason || remarks}`,
        });
      }
    } else if (payout.recipientType === 'CAPTAIN') {
      const captain = await Captain.findById(payout.recipientId);
      if (captain) {
        balanceBefore = Number(captain.walletBalance || 0);
        balanceAfter = Number((balanceBefore + refundAmt).toFixed(2));
        captain.walletBalance = balanceAfter;
        await captain.save();

        const txnId = `TXN-REF-${Date.now().toString().slice(-6)}`;
        await CaptainTransaction.create({
          transactionId: txnId,
          captainId: captain._id,
          orderId: payout.payoutId,
          type: 'CREDIT',
          amount: refundAmt,
          balanceBefore,
          balanceAfter,
          description: `Refund for Rejected Payout #${payout.payoutId}. Reason: ${rejectionReason || remarks}`,
          status: 'COMPLETED',
        });
      }
    }

    payout.status = 'REJECTED';
    payout.rejectionReason = rejectionReason || remarks;
    payout.processedBy = req.user.id;
    payout.processedAt = new Date();
    await payout.save();

    // Create Central Platform Ledger Reversal Entry
    const ledgerTxnId = `TXN-LED-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;
    await PlatformLedger.create({
      transactionId: ledgerTxnId,
      category: payout.recipientType === 'SELLER' ? 'SELLER_PAYOUT' : 'CAPTAIN_PAYOUT',
      type: 'CREDIT',
      amount: refundAmt,
      source: 'PLATFORM',
      destination: payout.recipientType,
      entityType: payout.recipientType,
      entityId: payout.recipientId,
      entityName: payout.recipientName,
      referenceModel: 'PayoutRequest',
      referenceId: payout.payoutId,
      referenceObjId: payout._id,
      status: 'REVERSED',
      balanceBefore,
      balanceAfter,
      description: `Reversal of Payout #${payout.payoutId} back to ${payout.recipientType} wallet`,
      metadata: { rejectionReason: payout.rejectionReason },
    });

    await logAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'REJECT_PAYOUT',
      targetEntity: 'PayoutRequest',
      targetId: payout.payoutId,
      amount: refundAmt,
      previousValue: { status: previousStatus },
      newValue: { status: 'REJECTED', unreservedAmount: refundAmt },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      remarks: rejectionReason || remarks,
    });

    res.status(200).json({
      success: true,
      message: `Payout #${payout.payoutId} rejected and ₹${refundAmt} restored to available balance`,
      payout,
    });
  } catch (error) {
    next(error);
  }
};

// Process & Complete Payout (Record Bank Transfer / Payout Reference)
export const processPayout = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paymentReference, paymentMethod = 'BANK_TRANSFER', remarks } = req.body;

    if (!paymentReference) {
      return res.status(400).json({
        success: false,
        message: 'Payment reference (UTR / Transaction ID / Gateway reference) is required to complete payout',
      });
    }

    const payout = await PayoutRequest.findById(id);
    if (!payout) {
      return res.status(404).json({ success: false, message: 'Payout request not found' });
    }

    if (payout.status === 'PAID') {
      return res.status(400).json({ success: false, message: 'This payout is already marked as PAID' });
    }

    if (payout.status === 'REJECTED') {
      return res.status(400).json({ success: false, message: 'Cannot process a rejected payout' });
    }

    const previousStatus = payout.status;
    const paidAmount = payout.approvedAmount || payout.requestedAmount;

    payout.status = 'PAID';
    payout.paymentReference = paymentReference;
    payout.paymentMethod = paymentMethod;
    if (remarks) payout.remarks = remarks;
    payout.paidAt = new Date();
    payout.processedBy = req.user.id;
    payout.processedAt = new Date();
    await payout.save();

    // Sync captain/seller wallet withdrawal txn so app no longer shows Pending (#68)
    try {
      if (payout.recipientType === 'CAPTAIN') {
        await CaptainTransaction.updateMany(
          {
            $or: [
              { orderId: payout.payoutId },
              { orderId: String(payout._id) },
              { description: { $regex: payout.payoutId || '', $options: 'i' } },
            ],
            type: { $in: ['WITHDRAWAL', 'DEBIT'] },
            status: { $in: ['PENDING', 'Pending', 'pending'] },
            captainId: payout.recipientId,
          },
          { $set: { status: 'COMPLETED' } }
        );
      } else if (payout.recipientType === 'SELLER') {
        await WalletTransaction.updateMany(
          {
            $or: [
              { orderId: payout.payoutId },
              { orderId: String(payout._id) },
            ],
            type: { $in: ['WITHDRAWAL', 'DEBIT'] },
            status: { $in: ['PENDING', 'Pending', 'pending'] },
            sellerId: String(payout.recipientId),
          },
          { $set: { status: 'COMPLETED' } }
        );
        if (payout.withdrawalRequestId || payout.payoutId) {
          const wrFilter = {
            status: { $in: ['PENDING', 'APPROVED', 'PROCESSING'] },
          };
          if (payout.withdrawalRequestId) wrFilter._id = payout.withdrawalRequestId;
          else wrFilter.payoutId = payout.payoutId;
          await WithdrawalRequest.updateMany(wrFilter, {
            $set: { status: 'PAID', paidAt: new Date() },
          }).catch(() => null);
        }
      }
    } catch (syncErr) {
      console.warn('[processPayout] Wallet txn status sync warning:', syncErr.message);
    }

    // Create Central Platform Ledger Payout Entry
    const ledgerTxnId = `TXN-LED-OUT-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;
    await PlatformLedger.create({
      transactionId: ledgerTxnId,
      category: payout.recipientType === 'SELLER' ? 'SELLER_PAYOUT' : 'CAPTAIN_PAYOUT',
      type: 'DEBIT',
      amount: paidAmount,
      source: 'PLATFORM_TREASURY',
      destination: payout.recipientType,
      entityType: payout.recipientType,
      entityId: payout.recipientId,
      entityName: payout.recipientName,
      referenceModel: 'PayoutRequest',
      referenceId: payout.payoutId,
      referenceObjId: payout._id,
      status: 'SUCCESS',
      description: `Payout #${payout.payoutId} settled via ${paymentMethod}. Ref: ${paymentReference}`,
      metadata: {
        paymentMethod,
        paymentReference,
        bankDetails: payout.bankDetails,
      },
    });

    await logAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'PROCESS_PAYOUT',
      targetEntity: 'PayoutRequest',
      targetId: payout.payoutId,
      amount: paidAmount,
      previousValue: { status: previousStatus },
      newValue: { status: 'PAID', paymentReference, paymentMethod },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      remarks: remarks || `Payout settled with reference ${paymentReference}`,
    });

    res.status(200).json({
      success: true,
      message: `Payout #${payout.payoutId} marked as PAID successfully`,
      payout,
    });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 4. SELLER & CAPTAIN SETTLEMENTS AUDIT
// =========================================================================
export const getSellerSettlements = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const { status, search } = req.query;

    const query = {};
    if (status && status !== 'ALL') query.settlementStatus = status.toUpperCase();

    if (search && search.trim()) {
      const clean = search.trim();
      query.$or = [
        { orderId: { $regex: clean, $options: 'i' } },
        { sellerName: { $regex: clean, $options: 'i' } },
        { sellerId: { $regex: clean, $options: 'i' } },
      ];
    }

    const [settlements, total] = await Promise.all([
      SellerNotification.find(query)
        .select('orderId sellerName sellerId totalAmount commissionRate commissionAmount netSellerAmount paymentMethod paymentStatus status settlementStatus settledAt createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SellerNotification.countDocuments(query),
    ]);

    // Aggregate overall metrics
    const summaryAgg = await SellerNotification.aggregate([
      {
        $group: {
          _id: '$settlementStatus',
          totalGross: { $sum: '$totalAmount' },
          totalCommission: { $sum: '$commissionAmount' },
          totalNetSeller: { $sum: '$netSellerAmount' },
          count: { $sum: 1 },
        },
      },
    ]).catch(() => []);

    let totalSettled = 0;
    let pendingSettled = 0;
    let totalCommission = 0;

    summaryAgg.forEach((s) => {
      totalCommission += s.totalCommission || 0;
      if (s._id === 'SETTLED') totalSettled += s.totalNetSeller || 0;
      if (s._id === 'PENDING') pendingSettled += s.totalNetSeller || 0;
    });

    res.status(200).json({
      success: true,
      summary: {
        totalSettledAmount: Number(totalSettled.toFixed(2)),
        pendingSettlementAmount: Number(pendingSettled.toFixed(2)),
        totalCommissionEarned: Number(totalCommission.toFixed(2)),
        totalTransactions: total,
      },
      settlements,
      page,
      pages: Math.ceil(total / limit) || 1,
      total,
    });
  } catch (error) {
    next(error);
  }
};

export const getCaptainSettlements = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    const [captains, total] = await Promise.all([
      Captain.find()
        .select('_id name phone vehicleType walletBalance cashCollected status createdAt')
        .sort({ walletBalance: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Captain.countDocuments(),
    ]);

    res.status(200).json({
      success: true,
      captains,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 5. COMMISSION MANAGEMENT (SUPER ADMIN AUTHORITY ONLY)
// =========================================================================
export const getAllCommissions = async (req, res, next) => {
  try {
    const sellers = await Seller.find()
      .select('_id businessName ownerName phone email commissionPercentage totalEarnings totalCommissionDeducted walletBalance status')
      .sort({ totalCommissionDeducted: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: sellers.length,
      sellers,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSellerCommission = async (req, res, next) => {
  try {
    const { sellerId } = req.params;
    const { commissionPercentage, remarks } = req.body;

    const commRate = Number(commissionPercentage);
    if (isNaN(commRate) || commRate < 0 || commRate > 100) {
      return res.status(400).json({
        success: false,
        message: 'Commission percentage must be a valid number between 0 and 100',
      });
    }

    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }

    const previousRate = seller.commissionPercentage;
    seller.commissionPercentage = commRate;
    await seller.save();

    await logAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'UPDATE_COMMISSION',
      targetEntity: 'Seller',
      targetId: String(seller._id),
      previousValue: { commissionPercentage: previousRate },
      newValue: { commissionPercentage: commRate },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      remarks: remarks || `Super Admin changed commission rate from ${previousRate}% to ${commRate}%`,
    });

    res.status(200).json({
      success: true,
      message: `Commission rate for "${seller.businessName}" updated to ${commRate}%`,
      seller: {
        id: seller._id,
        businessName: seller.businessName,
        commissionPercentage: seller.commissionPercentage,
      },
    });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 6. FINANCIAL ADJUSTMENTS (CREDIT / DEBIT)
// =========================================================================
export const createFinancialAdjustment = async (req, res, next) => {
  try {
    const { entityType, entityId, type, amount, reason, reference, remarks } = req.body;

    if (!entityType || !['SELLER', 'CAPTAIN', 'PLATFORM'].includes(entityType)) {
      return res.status(400).json({ success: false, message: 'Valid entityType (SELLER, CAPTAIN, PLATFORM) is required' });
    }

    if (!type || !['CREDIT', 'DEBIT'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Valid type (CREDIT, DEBIT) is required' });
    }

    const adjAmount = Number(amount);
    if (isNaN(adjAmount) || adjAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than 0' });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'A clear reason for the adjustment is required' });
    }

    let balanceBefore = 0;
    let balanceAfter = 0;
    let entityName = 'Platform Treasury';

    if (entityType === 'SELLER') {
      const seller = await Seller.findById(entityId);
      if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });
      entityName = seller.businessName || seller.ownerName || 'Seller';
      balanceBefore = Number(seller.walletBalance || 0);

      if (type === 'DEBIT' && balanceBefore < adjAmount) {
        return res.status(400).json({
          success: false,
          message: `Cannot debit ₹${adjAmount}. Seller balance is only ₹${balanceBefore.toFixed(2)}`,
        });
      }

      balanceAfter = type === 'CREDIT' ? balanceBefore + adjAmount : balanceBefore - adjAmount;
      balanceAfter = Number(balanceAfter.toFixed(2));
      seller.walletBalance = balanceAfter;
      await seller.save();

      // Create seller transaction record
      const txnId = `TXN-ADJ-${Date.now().toString().slice(-6)}`;
      await WalletTransaction.create({
        transactionId: txnId,
        sellerId: String(seller._id),
        orderId: `ADJ-${Date.now().toString().slice(-6)}`,
        type: type === 'CREDIT' ? 'CREDIT' : 'DEBIT_REVERSAL',
        grossAmount: adjAmount,
        netAmount: type === 'CREDIT' ? adjAmount : -adjAmount,
        balanceBefore,
        balanceAfter,
        paymentMethod: 'MANUAL_ADJUSTMENT',
        settlementStatus: 'SETTLED',
        description: `Manual ${type}: ${reason}. Ref: ${reference || 'N/A'}`,
      });
    } else if (entityType === 'CAPTAIN') {
      const captain = await Captain.findById(entityId);
      if (!captain) return res.status(404).json({ success: false, message: 'Captain not found' });
      entityName = captain.name || 'Captain';
      balanceBefore = Number(captain.walletBalance || 0);

      if (type === 'DEBIT' && balanceBefore < adjAmount) {
        return res.status(400).json({
          success: false,
          message: `Cannot debit ₹${adjAmount}. Captain balance is only ₹${balanceBefore.toFixed(2)}`,
        });
      }

      balanceAfter = type === 'CREDIT' ? balanceBefore + adjAmount : balanceBefore - adjAmount;
      balanceAfter = Number(balanceAfter.toFixed(2));
      captain.walletBalance = balanceAfter;
      await captain.save();

      const txnId = `TXN-ADJ-${Date.now().toString().slice(-6)}`;
      await CaptainTransaction.create({
        transactionId: txnId,
        captainId: captain._id,
        orderId: `ADJ-${Date.now().toString().slice(-6)}`,
        type: type === 'CREDIT' ? 'CREDIT' : 'WITHDRAWAL',
        amount: adjAmount,
        balanceBefore,
        balanceAfter,
        description: `Manual ${type}: ${reason}. Ref: ${reference || 'N/A'}`,
        status: 'COMPLETED',
      });
    }

    const adjustmentId = `ADJ-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;

    const adjustment = await FinancialAdjustment.create({
      adjustmentId,
      entityType,
      entityId: String(entityId || ''),
      entityName,
      type,
      amount: adjAmount,
      reason,
      reference: reference || '',
      remarks: remarks || '',
      createdBy: req.user.id,
      creatorEmail: req.user.email,
      balanceBefore,
      balanceAfter,
      status: 'APPLIED',
    });

    // Create central ledger record
    const ledgerTxnId = `TXN-LED-ADJ-${Date.now().toString().slice(-6)}`;
    await PlatformLedger.create({
      transactionId: ledgerTxnId,
      category: 'FINANCIAL_ADJUSTMENT',
      type,
      amount: adjAmount,
      source: type === 'CREDIT' ? 'PLATFORM' : entityType,
      destination: type === 'CREDIT' ? entityType : 'PLATFORM',
      entityType,
      entityId: String(entityId || ''),
      entityName,
      referenceModel: 'FinancialAdjustment',
      referenceId: adjustmentId,
      referenceObjId: adjustment._id,
      status: 'SUCCESS',
      balanceBefore,
      balanceAfter,
      description: `Financial Adjustment (${type}) of ₹${adjAmount}: ${reason}`,
      metadata: { reference, remarks },
    });

    await logAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'CREATE_FINANCIAL_ADJUSTMENT',
      targetEntity: 'FinancialAdjustment',
      targetId: adjustmentId,
      amount: adjAmount,
      previousValue: { balanceBefore },
      newValue: { balanceAfter, type, reason },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      remarks: `Applied ${type} of ₹${adjAmount} to ${entityType} "${entityName}"`,
    });

    res.status(201).json({
      success: true,
      message: `Financial adjustment #${adjustmentId} applied successfully`,
      adjustment,
      updatedBalance: balanceAfter,
    });
  } catch (error) {
    next(error);
  }
};

export const getFinancialAdjustments = async (req, res, next) => {
  try {
    const adjustments = await FinancialAdjustment.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: adjustments.length,
      adjustments,
    });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 7. REFUNDS MANAGEMENT
// =========================================================================
export const getRefunds = async (req, res, next) => {
  try {
    const refunds = await RefundRequest.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: refunds.length,
      refunds,
    });
  } catch (error) {
    next(error);
  }
};

export const processRefund = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, gatewayRefundId, remarks } = req.body;

    const refund = await RefundRequest.findById(id);
    if (!refund) {
      return res.status(404).json({ success: false, message: 'Refund request not found' });
    }

    const previousStatus = refund.status;
    refund.status = status;
    if (gatewayRefundId) refund.gatewayRefundId = gatewayRefundId;
    if (remarks) refund.remarks = remarks;
    refund.processedBy = req.user.id;
    refund.processedAt = new Date();
    await refund.save();

    if (status === 'COMPLETED') {
      const ledgerTxnId = `TXN-LED-REF-${Date.now().toString().slice(-6)}`;
      await PlatformLedger.create({
        transactionId: ledgerTxnId,
        category: 'REFUND',
        type: 'DEBIT',
        amount: refund.amount,
        source: 'PLATFORM_TREASURY',
        destination: 'USER',
        entityType: 'USER',
        entityId: String(refund.userId || ''),
        entityName: refund.userName || 'Customer',
        referenceModel: 'RefundRequest',
        referenceId: refund.refundId,
        referenceObjId: refund._id,
        status: 'SUCCESS',
        description: `Order Refund #${refund.refundId} processed. Ref: ${gatewayRefundId || 'Direct'}`,
        metadata: { gatewayRefundId, remarks },
      });
    }

    await logAudit({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'PROCESS_REFUND',
      targetEntity: 'RefundRequest',
      targetId: refund.refundId,
      amount: refund.amount,
      previousValue: { status: previousStatus },
      newValue: { status, gatewayRefundId },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      remarks: remarks || `Refund updated to ${status}`,
    });

    res.status(200).json({
      success: true,
      message: `Refund #${refund.refundId} updated to ${status}`,
      refund,
    });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 8. FINANCIAL AUDIT LOGS
// =========================================================================
export const getAuditLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const { action, search } = req.query;

    const query = {};
    if (action && action !== 'ALL') query.action = action;

    if (search && search.trim()) {
      const clean = search.trim();
      query.$or = [
        { logId: { $regex: clean, $options: 'i' } },
        { targetId: { $regex: clean, $options: 'i' } },
        { remarks: { $regex: clean, $options: 'i' } },
        { actorEmail: { $regex: clean, $options: 'i' } },
      ];
    }

    const [logs, total] = await Promise.all([
      FinancialAuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      FinancialAuditLog.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      count: logs.length,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      logs,
    });
  } catch (error) {
    next(error);
  }
};

// =========================================================================
// 9. FINANCIAL EXPORTS & REPORTS
// =========================================================================
export const getFinancialReports = async (req, res, next) => {
  try {
    const { reportType, startDate, endDate } = req.query;

    const dateQuery = {};
    if (startDate || endDate) {
      dateQuery.createdAt = {};
      if (startDate) dateQuery.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateQuery.createdAt.$lte = end;
      }
    }

    if (reportType === 'transactions') {
      const transactions = await PlatformLedger.find(dateQuery).sort({ createdAt: -1 }).limit(500).lean();
      return res.status(200).json({ success: true, reportType, transactions });
    }

    if (reportType === 'seller-settlements') {
      const settlements = await SellerNotification.find(dateQuery)
        .select('orderId sellerName sellerId totalAmount commissionRate commissionAmount netSellerAmount settlementStatus settledAt createdAt')
        .sort({ createdAt: -1 })
        .limit(500)
        .lean();
      return res.status(200).json({ success: true, reportType, settlements });
    }

    if (reportType === 'captain-settlements') {
      const captains = await Captain.find().select('name phone vehicleType walletBalance cashCollected createdAt').lean();
      return res.status(200).json({ success: true, reportType, captains });
    }

    if (reportType === 'platform-revenue') {
      const orders = await Order.aggregate([
        { $match: { ...(dateQuery.createdAt ? { createdAt: dateQuery.createdAt } : {}), $or: [{ paymentStatus: 'Paid' }, { paymentMethod: 'COD' }] } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            grossVolume: { $sum: '$grandTotal' },
            itemsTotal: { $sum: '$itemsTotal' },
            shippingRevenue: { $sum: '$shippingFee' },
            orderCount: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);
      return res.status(200).json({ success: true, reportType, orders });
    }

    // Default overview report
    res.status(200).json({
      success: true,
      message: 'Select a valid report type: transactions, seller-settlements, captain-settlements, platform-revenue',
    });
  } catch (error) {
    next(error);
  }
};
