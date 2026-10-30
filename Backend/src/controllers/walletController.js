import mongoose from 'mongoose';
import Seller from '../models/Seller.model.js';
import SellerNotification from '../models/SellerNotification.model.js';
import WalletTransaction from '../models/WalletTransaction.model.js';
import WithdrawalRequest from '../models/WithdrawalRequest.model.js';
import PayoutRequest from '../models/PayoutRequest.model.js';
import User from '../models/User.model.js';
import UserWalletTransaction from '../models/UserWalletTransaction.model.js';

// @desc    Get Seller Wallet Data (Metrics, Transactions, Withdrawals)
// @route   GET /api/wallet/seller
// @access  Private/Seller
export const getSellerWallet = async (req, res, next) => {
  try {
    const sellerId = req.user.id;
    let seller = await Seller.findById(sellerId);
    
    if (!seller) {
      seller = await Seller.findOne({ phone: req.user.phone });
    }

    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller profile not found' });
    }

    const sellerKey = String(seller._id);
    const sellerPhone = seller.phone || '';

    // Fetch Transactions & Withdrawal Requests
    const transactions = await WalletTransaction.find({
      $or: [{ sellerId: sellerKey }, { sellerId: sellerPhone }]
    }).sort({ createdAt: -1 });

    const withdrawals = await WithdrawalRequest.find({
      $or: [{ sellerId: sellerKey }, { sellerId: sellerPhone }]
    }).sort({ createdAt: -1 });

    // Calculate Pending Balance (from non-delivered notifications)
    const pendingNotifications = await SellerNotification.find({
      $or: [{ sellerId: sellerKey }, { sellerId: sellerPhone }],
      status: { $nin: ['DELIVERED', 'Delivered', 'REJECTED', 'Rejected'] }
    });

    const pendingBalance = pendingNotifications.reduce((acc, n) => {
      const commRate = n.commissionRate || seller.commissionPercentage || 10;
      const gross = n.totalAmount || 0;
      const net = gross - (gross * commRate / 100);
      return acc + net;
    }, 0);

    res.status(200).json({
      success: true,
      wallet: {
        availableBalance: Number(seller.walletBalance || 0),
        pendingBalance: Number(pendingBalance.toFixed(2)),
        totalEarnings: Number(seller.totalEarnings || 0),
        totalCommissionDeducted: Number(seller.totalCommissionDeducted || 0),
        totalWithdrawn: Number(seller.totalWithdrawn || 0),
        bankDetails: {
          bankName: seller.bankName || '',
          accountNumber: seller.accountNumber || '',
          ifscCode: seller.ifscCode || '',
          accountHolderName: seller.ownerName || seller.businessName || '',
        },
      },
      transactions,
      withdrawals,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Request Withdrawal from Available Wallet Balance
// @route   POST /api/wallet/seller/withdraw
// @access  Private/Seller
export const requestWithdrawal = async (req, res, next) => {
  try {
    const sellerId = req.user.id;
    const { amount, bankName, accountNumber, ifscCode, accountHolderName } = req.body;

    const withdrawAmt = Number(amount);
    if (isNaN(withdrawAmt) || withdrawAmt <= 0) {
      return res.status(400).json({ success: false, message: 'Please enter a valid withdrawal amount greater than 0' });
    }

    if (!bankName || !accountNumber || !ifscCode) {
      return res.status(400).json({ success: false, message: 'Bank Name, Account Number, and IFSC Code are required' });
    }

    let seller = await Seller.findById(sellerId);
    if (!seller) {
      seller = await Seller.findOne({ phone: req.user.phone });
    }

    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller profile not found' });
    }

    const availableBal = Number(seller.walletBalance || 0);
    if (withdrawAmt > availableBal) {
      return res.status(400).json({
        success: false,
        message: `Insufficient available wallet balance. Maximum withdrawable: ₹${availableBal.toFixed(2)}`,
      });
    }

    // Atomic Balance Deduction
    const balanceBefore = availableBal;
    const balanceAfter = Number((availableBal - withdrawAmt).toFixed(2));

    seller.walletBalance = balanceAfter;
    seller.totalWithdrawn = Number(((seller.totalWithdrawn || 0) + withdrawAmt).toFixed(2));
    
    // Optionally update bank details on seller profile if provided
    if (bankName) seller.bankName = bankName;
    if (accountNumber) seller.accountNumber = accountNumber;
    if (ifscCode) seller.ifscCode = ifscCode;
    await seller.save();

    const withdrawalId = `WTH-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;

    const withdrawal = await WithdrawalRequest.create({
      withdrawalId,
      sellerId: String(seller._id),
      sellerName: seller.businessName || seller.ownerName || 'Seller Store',
      amount: withdrawAmt,
      bankDetails: {
        bankName,
        accountNumber,
        ifscCode,
        accountHolderName: accountHolderName || seller.ownerName || seller.businessName,
      },
      status: 'PENDING',
    });

    // Create unified PayoutRequest for Super Admin Financial System
    await PayoutRequest.create({
      payoutId: withdrawalId,
      recipientType: 'SELLER',
      recipientId: String(seller._id),
      recipientName: seller.businessName || seller.ownerName || 'Seller Store',
      recipientPhone: seller.phone || '',
      requestedAmount: withdrawAmt,
      bankDetails: {
        bankName,
        accountNumber,
        ifscCode,
        accountHolderName: accountHolderName || seller.ownerName || seller.businessName,
      },
      status: 'PENDING',
    }).catch(err => console.warn('[PayoutRequest] Error syncing seller withdrawal:', err.message));

    // Create Wallet Transaction Record
    const txnId = `TXN-WTH-${Date.now().toString().slice(-6)}`;
    await WalletTransaction.create({
      transactionId: txnId,
      sellerId: String(seller._id),
      orderId: withdrawalId,
      type: 'WITHDRAWAL',
      grossAmount: withdrawAmt,
      commissionRate: 0,
      commissionAmount: 0,
      netAmount: -withdrawAmt,
      balanceBefore,
      balanceAfter,
      paymentMethod: 'BANK_TRANSFER',
      settlementStatus: 'PENDING',
      description: `Withdrawal Request #${withdrawalId} to ${bankName} (${accountNumber.slice(-4)})`,
    });

    res.status(201).json({
      success: true,
      message: `Withdrawal request for ₹${withdrawAmt.toFixed(2)} submitted successfully!`,
      withdrawal,
      updatedBalance: balanceAfter,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Get All Settlement & Commission Records
// @route   GET /api/wallet/admin/settlements
// @access  Private/Admin
export const getAdminSettlements = async (req, res, next) => {
  try {
    const settlements = await SellerNotification.find()
      .select('orderId sellerName sellerId totalAmount commissionRate commissionAmount netSellerAmount paymentMethod paymentStatus status settlementStatus settledAt createdAt')
      .sort({ createdAt: -1 });

    const totalCommissionEarned = settlements.reduce((acc, s) => acc + (s.commissionAmount || 0), 0);
    const settledCommissionEarned = settlements
      .filter(s => s.settlementStatus === 'SETTLED')
      .reduce((acc, s) => acc + (s.commissionAmount || 0), 0);
    const pendingAdminCommission = settlements
      .filter(s => s.settlementStatus === 'PENDING')
      .reduce((acc, s) => acc + (s.commissionAmount || 0), 0);

    const totalSettledAmount = settlements
      .filter(s => s.settlementStatus === 'SETTLED')
      .reduce((acc, s) => acc + (s.netSellerAmount || 0), 0);
    const pendingSellerAmount = settlements
      .filter(s => s.settlementStatus === 'PENDING')
      .reduce((acc, s) => acc + (s.netSellerAmount || 0), 0);

    res.status(200).json({
      success: true,
      summary: {
        totalCommissionEarned: Number(totalCommissionEarned.toFixed(2)),
        settledCommissionEarned: Number(settledCommissionEarned.toFixed(2)),
        pendingAdminCommission: Number(pendingAdminCommission.toFixed(2)),
        totalSettledAmount: Number(totalSettledAmount.toFixed(2)),
        pendingSellerAmount: Number(pendingSellerAmount.toFixed(2)),
        totalTransactions: settlements.length,
      },
      settlements,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Get All Seller Withdrawal Requests
// @route   GET /api/wallet/admin/withdrawals
// @access  Private/Admin
export const getAdminWithdrawals = async (req, res, next) => {
  try {
    const withdrawals = await WithdrawalRequest.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      withdrawals,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Admin: Update Withdrawal Request Status (Approve/Reject/Complete)
// @route   PUT /api/wallet/admin/withdrawals/:id/status
// @access  Private/Admin
export const updateWithdrawalStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, adminRemark } = req.body;

    if (!['APPROVED', 'REJECTED', 'COMPLETED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid withdrawal status' });
    }

    const withdrawal = await WithdrawalRequest.findById(id);
    if (!withdrawal) {
      return res.status(404).json({ success: false, message: 'Withdrawal request not found' });
    }

    // If REJECTED, refund withdrawal amount back to seller's available wallet balance!
    if (status === 'REJECTED' && withdrawal.status !== 'REJECTED') {
      const seller = await Seller.findById(withdrawal.sellerId);
      if (seller) {
        const balanceBefore = Number(seller.walletBalance || 0);
        const balanceAfter = Number((balanceBefore + withdrawal.amount).toFixed(2));
        seller.walletBalance = balanceAfter;
        seller.totalWithdrawn = Number(Math.max(0, (seller.totalWithdrawn || 0) - withdrawal.amount).toFixed(2));
        await seller.save();

        // Create Reversal Transaction
        const txnId = `TXN-REF-${Date.now().toString().slice(-6)}`;
        await WalletTransaction.create({
          transactionId: txnId,
          sellerId: String(seller._id),
          orderId: withdrawal.withdrawalId,
          type: 'CREDIT',
          grossAmount: withdrawal.amount,
          netAmount: withdrawal.amount,
          balanceBefore,
          balanceAfter,
          paymentMethod: 'BANK_TRANSFER',
          settlementStatus: 'SETTLED',
          description: `Refund for Rejected Withdrawal Request #${withdrawal.withdrawalId}. Remark: ${adminRemark || 'Rejected by Admin'}`,
        });
      }
    }

    withdrawal.status = status;
    if (adminRemark) withdrawal.adminRemark = adminRemark;
    withdrawal.processedAt = new Date();
    await withdrawal.save();

    res.status(200).json({
      success: true,
      message: `Withdrawal request #${withdrawal.withdrawalId} updated to ${status}`,
      withdrawal,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get User Wallet balance + recent transactions
// @route   GET /api/wallet/user
// @access  Private/User
export const getUserWallet = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId).select('name phone walletBalance');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const transactions = await UserWalletTransaction.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const [creditAgg, debitAgg] = await Promise.all([
      UserWalletTransaction.aggregate([
        { $match: { userId: user._id, type: 'CREDIT', status: 'COMPLETED' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      UserWalletTransaction.aggregate([
        { $match: { userId: user._id, type: 'DEBIT', status: 'COMPLETED' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      wallet: {
        balance: Number(Number(user.walletBalance || 0).toFixed(2)),
        availableBalance: Number(Number(user.walletBalance || 0).toFixed(2)),
        totalCredited: Number(Number(creditAgg[0]?.total || 0).toFixed(2)),
        totalDebited: Number(Number(debitAgg[0]?.total || 0).toFixed(2)),
      },
      transactions,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get User Wallet transactions (filterable)
// @route   GET /api/wallet/user/transactions
// @access  Private/User
export const getUserWalletTransactions = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const type = String(req.query.type || 'All').toUpperCase();
    const query = { userId };
    if (type === 'CREDIT' || type === 'DEBIT') {
      query.type = type;
    }

    const transactions = await UserWalletTransaction.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.status(200).json({
      success: true,
      transactions,
    });
  } catch (error) {
    next(error);
  }
};
