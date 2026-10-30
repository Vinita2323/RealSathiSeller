import mongoose from 'mongoose';
import crypto from 'crypto';
import Seller from '../models/Seller.model.js';
import Captain from '../models/Captain.model.js';
import Referral from '../models/Referral.model.js';
import ReferralSettings from '../models/ReferralSettings.model.js';
import WalletTransaction from '../models/WalletTransaction.model.js';
import CaptainTransaction from '../models/CaptainTransaction.model.js';

// ─── Utilities ───────────────────────────────────────────────────────────────

/**
 * Generate a unique referral code for a seller (SELL-XXXXX) or captain (CAP-XXXXX).
 */
const generateReferralCode = async (role, existingId) => {
  const prefix = role === 'seller' ? 'SELL' : 'CAP';
  const Model = role === 'seller' ? Seller : Captain;

  let code;
  let attempts = 0;
  do {
    const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6 hex chars
    code = `${prefix}${randomPart}`;
    const existing = await Model.findOne({ referralCode: code });
    if (!existing) break;
    attempts++;
  } while (attempts < 10);

  return code;
};

/**
 * Credit referral reward to seller's wallet (reusing WalletTransaction pattern).
 * Idempotent: if rewardTransactionId already set, returns early.
 */
const creditSellerReferralReward = async (referral, settings) => {
  if (referral.rewardTransactionId) {
    return { success: false, message: 'Reward already credited' };
  }

  const seller = await Seller.findById(referral.referrerId);
  if (!seller) return { success: false, message: 'Referrer seller not found' };

  const rewardAmt = referral.rewardAmount || settings.sellerRewardAmount;
  const transactionId = `REF-SLR-${referral._id}-${Date.now()}`;
  const balanceBefore = Number(seller.walletBalance || 0);
  const balanceAfter = balanceBefore + rewardAmt;

  await WalletTransaction.create({
    transactionId,
    sellerId: String(seller._id),
    orderId: `REF-${referral._id}`,
    type: 'CREDIT',
    grossAmount: rewardAmt,
    commissionRate: 0,
    commissionAmount: 0,
    netAmount: rewardAmt,
    balanceBefore,
    balanceAfter,
    paymentMethod: 'REFERRAL',
    settlementStatus: 'SETTLED',
    description: `Referral Reward — You referred a new seller`,
  });

  seller.walletBalance = balanceAfter;
  seller.totalEarnings = Number(seller.totalEarnings || 0) + rewardAmt;
  await seller.save();

  return { success: true, transactionId, rewardAmt };
};

/**
 * Credit referral reward to captain's wallet (reusing CaptainTransaction pattern).
 */
const creditCaptainReferralReward = async (referral, settings) => {
  if (referral.rewardTransactionId) {
    return { success: false, message: 'Reward already credited' };
  }

  const captain = await Captain.findById(referral.referrerId);
  if (!captain) return { success: false, message: 'Referrer captain not found' };

  const rewardAmt = referral.rewardAmount || settings.captainRewardAmount;
  const transactionId = `REF-CAP-${referral._id}-${Date.now()}`;
  const balanceBefore = Number(captain.walletBalance || 0);
  const balanceAfter = balanceBefore + rewardAmt;

  await CaptainTransaction.create({
    transactionId,
    captainId: captain._id,
    orderId: `REF-${referral._id}`,
    type: 'BONUS',
    amount: rewardAmt,
    grossAmount: rewardAmt,
    commissionRate: 0,
    commissionAmount: 0,
    netAmount: rewardAmt,
    balanceBefore,
    balanceAfter,
    description: `Referral Reward — You referred a new captain`,
    status: 'COMPLETED',
  });

  captain.walletBalance = balanceAfter;
  await captain.save();

  return { success: true, transactionId, rewardAmt };
};

/**
 * Core reward processing function — can be called from any trigger point.
 */
export const processReferralReward = async (referralId) => {
  const referral = await Referral.findById(referralId);
  if (!referral) return { success: false, message: 'Referral not found' };
  if (referral.rewardTransactionId) return { success: false, message: 'Already rewarded' };
  if (referral.status === 'Rejected') return { success: false, message: 'Referral is rejected' };

  const settings = await ReferralSettings.getOrCreateSettings();

  let result;
  if (referral.referrerRole === 'seller') {
    result = await creditSellerReferralReward(referral, settings);
  } else {
    result = await creditCaptainReferralReward(referral, settings);
  }

  if (result.success) {
    referral.rewardAmount = result.rewardAmt;
    referral.rewardTransactionId = result.transactionId;
    referral.rewardStatus = 'Credited';
    referral.status = 'Rewarded';
    referral.rewardedAt = new Date();
    await referral.save();
  } else {
    referral.rewardStatus = 'Failed';
    await referral.save();
  }

  return result;
};

// ─── Shared: Apply Referral Code ─────────────────────────────────────────────

/**
 * Shared helper called from registration controllers.
 * Creates a Referral document when a new seller/captain uses a referral code.
 * Returns the new Referral doc or null on failure (non-blocking).
 */
export const applyReferralCodeAtRegistration = async ({
  referralCode,
  referrerRole,
  referredId,
  referredRole,
  referredPhone,
  referredName,
}) => {
  try {
    if (!referralCode) return null;
    const code = String(referralCode).trim().toUpperCase();
    if (!code) return null;

    const settings = await ReferralSettings.getOrCreateSettings();
    const enabled =
      referrerRole === 'seller' ? settings.sellerReferralEnabled : settings.captainReferralEnabled;
    if (!enabled) return null;

    // Normalize phone number to last 10 digits
    const cleanPhone = referredPhone ? String(referredPhone).replace(/\D/g, '').slice(-10) : '';

    // Find the referrer (case-insensitive)
    const ReferrerModel = referrerRole === 'seller' ? Seller : Captain;
    const referrer = await ReferrerModel.findOne({ 
      referralCode: { $regex: new RegExp(`^${code}$`, 'i') } 
    });
    if (!referrer) {
      console.warn(`[Referral] Referrer not found for code: ${code}`);
      return null;
    }

    // Prevent self-referral
    if (referredId && String(referrer._id) === String(referredId)) return null;

    const trigger =
      referrerRole === 'seller' ? settings.sellerRewardTrigger : settings.captainRewardTrigger;
    const rewardAmount =
      referrerRole === 'seller' ? settings.sellerRewardAmount : settings.captainRewardAmount;

    // Check if referral record already exists by phone or referredId
    let referral = await Referral.findOne({
      $or: [
        ...(cleanPhone ? [
          { referralCode: code, referredPhone: cleanPhone },
          { referralCode: code, referredPhone: `+91${cleanPhone}` },
          { referralCode: code, referredPhone: referredPhone }
        ] : []),
        ...(referredId ? [{ referrerId: referrer._id, referredId }] : [])
      ]
    });

    if (referral) {
      // Update with referredId and referredName if previously draft
      if (referredId && !referral.referredId) {
        referral.referredId = referredId;
      }
      if (referredName && (!referral.referredName || referral.referredName === 'Seller' || referral.referredName === 'Captain')) {
        referral.referredName = referredName;
      }
      if (cleanPhone && !referral.referredPhone) {
        referral.referredPhone = cleanPhone;
      }
      await referral.save();
    } else {
      referral = await Referral.create({
        referrerId: referrer._id,
        referrerRole,
        referredId: referredId || null,
        referredRole,
        referralCode: referrer.referralCode || code,
        status: 'Registered',
        rewardAmount,
        referredPhone: cleanPhone || referredPhone || '',
        referredName: referredName || '',
      });
    }

    if (referredId) {
      const ReferredModel = referredRole === 'seller' ? Seller : Captain;
      await ReferredModel.findByIdAndUpdate(referredId, { referredBy: referrer._id });
    }

    // If trigger is immediate (registration), process reward now
    if (trigger === 'registration') {
      await processReferralReward(referral._id);
    }

    return referral;
  } catch (err) {
    console.error('[ReferralController] applyReferralCodeAtRegistration error:', err.message);
    return null;
  }
};

// @desc   Public validate referral code (seller or captain) — returns referrer display name only
// @route  GET /api/referral/validate?code=XXX&role=seller
// @access Public
export const validateReferralCode = async (req, res, next) => {
  try {
    const code = String(req.query.code || '').trim().toUpperCase();
    const role = String(req.query.role || 'seller').toLowerCase() === 'captain' ? 'captain' : 'seller';

    if (!code) {
      return res.status(400).json({ success: false, valid: false, message: 'Referral code is required' });
    }

    const ReferrerModel = role === 'seller' ? Seller : Captain;
    const referrer = await ReferrerModel.findOne({
      referralCode: { $regex: new RegExp(`^${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    }).select('businessName ownerName name referralCode');

    if (!referrer) {
      return res.status(200).json({
        success: true,
        valid: false,
        message: 'Invalid referral code',
      });
    }

    const referrerName =
      role === 'seller'
        ? (referrer.businessName || referrer.ownerName || 'Seller Partner')
        : (referrer.name || 'Captain Partner');

    return res.status(200).json({
      success: true,
      valid: true,
      referralCode: referrer.referralCode || code,
      referrerName,
      role,
    });
  } catch (error) {
    next(error);
  }
};

// ─── SELLER ENDPOINTS ────────────────────────────────────────────────────────

// @desc   Get or generate seller's referral code
// @route  GET /api/referral/seller/code
// @access Private/Seller
export const getSellerReferralCode = async (req, res, next) => {
  try {
    const sellerId = req.user.id;
    const seller = await Seller.findById(sellerId).select('referralCode businessName ownerName phone');
    if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

    if (!seller.referralCode) {
      seller.referralCode = await generateReferralCode('seller', sellerId);
      await seller.save();
    }

    const settings = await ReferralSettings.getOrCreateSettings();

    res.status(200).json({
      success: true,
      referralCode: seller.referralCode,
      referralLink: `/seller/register?ref=${seller.referralCode}`,
      enabled: settings.sellerReferralEnabled,
      rewardAmount: settings.sellerRewardAmount,
      rewardTrigger: settings.sellerRewardTrigger,
    });
  } catch (error) {
    next(error);
  }
};

// @desc   Get seller's referral history + stats
// @route  GET /api/referral/seller/my
// @access Private/Seller
export const getSellerReferrals = async (req, res, next) => {
  try {
    const sellerId = req.user.id;

    const referrals = await Referral.find({
      referrerId: sellerId,
      referrerRole: 'seller',
    })
      .populate('referredId', 'ownerName businessName storeLogo phone email createdAt status accountStatus')
      .sort({ createdAt: -1 })
      .lean();

    const total = referrals.length;
    const successful = referrals.filter((r) => r.status === 'Rewarded').length;
    const pending = referrals.filter((r) =>
      ['Pending', 'Registered', 'Approved', 'Qualified'].includes(r.status)
    ).length;
    const rejected = referrals.filter((r) => r.status === 'Rejected').length;
    const totalEarned = referrals
      .filter((r) => r.status === 'Rewarded')
      .reduce((acc, r) => acc + (r.rewardAmount || 0), 0);

    res.status(200).json({
      success: true,
      stats: { total, successful, pending, rejected, totalEarned },
      referrals,
    });
  } catch (error) {
    next(error);
  }
};

// ─── CAPTAIN ENDPOINTS ───────────────────────────────────────────────────────

// @desc   Get or generate captain's referral code
// @route  GET /api/referral/captain/code
// @access Private/Captain
export const getCaptainReferralCode = async (req, res, next) => {
  try {
    const captainId = req.user.id;
    const captain = await Captain.findById(captainId).select('referralCode name phone');
    if (!captain) return res.status(404).json({ success: false, message: 'Captain not found' });

    if (!captain.referralCode) {
      captain.referralCode = await generateReferralCode('captain', captainId);
      await captain.save();
    }

    const settings = await ReferralSettings.getOrCreateSettings();

    res.status(200).json({
      success: true,
      referralCode: captain.referralCode,
      referralLink: `/captain/register?ref=${captain.referralCode}`,
      enabled: settings.captainReferralEnabled,
      rewardAmount: settings.captainRewardAmount,
      rewardTrigger: settings.captainRewardTrigger,
    });
  } catch (error) {
    next(error);
  }
};

// @desc   Get captain's referral history + stats
// @route  GET /api/referral/captain/my
// @access Private/Captain
export const getCaptainReferrals = async (req, res, next) => {
  try {
    const captainId = req.user.id;

    const referrals = await Referral.find({
      referrerId: captainId,
      referrerRole: 'captain',
    })
      .populate('referredId', 'name phone vehicleType profilePhoto createdAt status accountStatus')
      .sort({ createdAt: -1 })
      .lean();

    const total = referrals.length;
    const successful = referrals.filter((r) => r.status === 'Rewarded').length;
    const pending = referrals.filter((r) =>
      ['Pending', 'Registered', 'Approved', 'Qualified'].includes(r.status)
    ).length;
    const rejected = referrals.filter((r) => r.status === 'Rejected').length;
    const totalEarned = referrals
      .filter((r) => r.status === 'Rewarded')
      .reduce((acc, r) => acc + (r.rewardAmount || 0), 0);

    res.status(200).json({
      success: true,
      stats: { total, successful, pending, rejected, totalEarned },
      referrals,
    });
  } catch (error) {
    next(error);
  }
};

// ─── ADMIN ENDPOINTS ─────────────────────────────────────────────────────────

// @desc   Get referral settings
// @route  GET /api/referral/admin/settings
// @access Private/Admin
export const getReferralSettings = async (req, res, next) => {
  try {
    const settings = await ReferralSettings.getOrCreateSettings();
    res.status(200).json({ success: true, settings });
  } catch (error) {
    next(error);
  }
};

// @desc   Update referral settings
// @route  PUT /api/referral/admin/settings
// @access Private/Admin
export const updateReferralSettings = async (req, res, next) => {
  try {
    const {
      sellerReferralEnabled,
      sellerRewardAmount,
      sellerRewardTrigger,
      captainReferralEnabled,
      captainRewardAmount,
      captainRewardTrigger,
      reason,
    } = req.body;

    const settings = await ReferralSettings.getOrCreateSettings();

    // Snapshot before
    const historyEntry = {
      sellerReferralEnabled: settings.sellerReferralEnabled,
      sellerRewardAmount: settings.sellerRewardAmount,
      sellerRewardTrigger: settings.sellerRewardTrigger,
      captainReferralEnabled: settings.captainReferralEnabled,
      captainRewardAmount: settings.captainRewardAmount,
      captainRewardTrigger: settings.captainRewardTrigger,
      changedBy: req.user?.name || req.user?.id || 'Admin',
      changedAt: new Date(),
      reason: reason || 'Admin updated referral settings',
    };

    if (sellerReferralEnabled !== undefined) settings.sellerReferralEnabled = Boolean(sellerReferralEnabled);
    if (sellerRewardAmount !== undefined) settings.sellerRewardAmount = Number(sellerRewardAmount);
    if (sellerRewardTrigger) settings.sellerRewardTrigger = sellerRewardTrigger;
    if (captainReferralEnabled !== undefined) settings.captainReferralEnabled = Boolean(captainReferralEnabled);
    if (captainRewardAmount !== undefined) settings.captainRewardAmount = Number(captainRewardAmount);
    if (captainRewardTrigger) settings.captainRewardTrigger = captainRewardTrigger;
    settings.updatedBy = req.user?.name || req.user?.id || 'Admin';

    settings.history.push(historyEntry);
    await settings.save();

    res.status(200).json({ success: true, message: 'Referral settings updated successfully', settings });
  } catch (error) {
    next(error);
  }
};

// @desc   Get referral stats for admin dashboard
// @route  GET /api/referral/admin/stats
// @access Private/Admin
export const getReferralStats = async (req, res, next) => {
  try {
    const [stats, settings] = await Promise.all([
      Referral.aggregate([
        {
          $facet: {
            byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
            byRole: [{ $group: { _id: '$referrerRole', count: { $sum: 1 } } }],
            totalRewards: [
              { $match: { status: 'Rewarded' } },
              {
                $group: {
                  _id: '$referrerRole',
                  total: { $sum: '$rewardAmount' },
                  count: { $sum: 1 },
                },
              },
            ],
          },
        },
      ]),
      ReferralSettings.getOrCreateSettings(),
    ]);

    const byStatus = {};
    (stats[0]?.byStatus || []).forEach((s) => { byStatus[s._id] = s.count; });

    const byRole = {};
    (stats[0]?.byRole || []).forEach((r) => { byRole[r._id] = r.count; });

    const rewardsByRole = {};
    (stats[0]?.totalRewards || []).forEach((r) => { rewardsByRole[r._id] = { total: r.total, count: r.count }; });

    const totalReferrals = Object.values(byRole).reduce((a, b) => a + b, 0);
    const totalRewardCredited =
      (rewardsByRole.seller?.total || 0) + (rewardsByRole.captain?.total || 0);

    res.status(200).json({
      success: true,
      stats: {
        total: totalReferrals,
        sellerReferrals: byRole.seller || 0,
        captainReferrals: byRole.captain || 0,
        pending: byStatus.Pending || 0,
        registered: byStatus.Registered || 0,
        approved: byStatus.Approved || 0,
        qualified: byStatus.Qualified || 0,
        rewarded: byStatus.Rewarded || 0,
        rejected: byStatus.Rejected || 0,
        totalRewardCredited,
        sellerRewardCredited: rewardsByRole.seller?.total || 0,
        captainRewardCredited: rewardsByRole.captain?.total || 0,
      },
      settings: {
        sellerRewardAmount: settings.sellerRewardAmount,
        captainRewardAmount: settings.captainRewardAmount,
        sellerRewardTrigger: settings.sellerRewardTrigger,
        captainRewardTrigger: settings.captainRewardTrigger,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc   Get all referrals (admin list with filters)
// @route  GET /api/referral/admin/all
// @access Private/Admin
export const getAllReferrals = async (req, res, next) => {
  try {
    const {
      role,
      status,
      rewardStatus,
      dateFrom,
      dateTo,
      startDate,
      endDate,
      page = 1,
      limit = 50,
      search,
    } = req.query;

    // Accept both dateFrom/dateTo and startDate/endDate (#90)
    const from = dateFrom || startDate;
    const to = dateTo || endDate;

    const filter = {};
    if (role) filter.referrerRole = role;
    if (status) filter.status = status;
    if (rewardStatus) filter.rewardStatus = rewardStatus;
    if (from || to) {
      filter.createdAt = {};
      if (from) {
        const d = new Date(from);
        d.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = d;
      }
      if (to) {
        const d = new Date(to);
        d.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = d;
      }
    }
    if (search) {
      filter.$or = [
        { referralCode: { $regex: search, $options: 'i' } },
        { referredPhone: { $regex: search, $options: 'i' } },
        { referredName: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [referrals, total] = await Promise.all([
      Referral.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
      Referral.countDocuments(filter),
    ]);

    // Enrich with referrer names
    const enriched = await Promise.all(
      referrals.map(async (ref) => {
        const r = ref.toObject();
        try {
          if (r.referrerRole === 'seller') {
            const s = await Seller.findById(r.referrerId).select('businessName ownerName phone').lean();
            r.referrerName = s?.businessName || s?.ownerName || 'Unknown Seller';
            r.referrerPhone = s?.phone || '';
          } else {
            const c = await Captain.findById(r.referrerId).select('name phone').lean();
            r.referrerName = c?.name || 'Unknown Captain';
            r.referrerPhone = c?.phone || '';
          }
        } catch {
          r.referrerName = 'Unknown';
          r.referrerPhone = '';
        }
        return r;
      })
    );

    res.status(200).json({
      success: true,
      referrals: enriched,
      pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// @desc   Approve or reject a referral
// @route  PUT /api/referral/admin/:id/approve
// @access Private/Admin
export const adminUpdateReferralStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body; // action: 'approve' | 'reject' | 'qualify'

    const referral = await Referral.findById(id);
    if (!referral) return res.status(404).json({ success: false, message: 'Referral not found' });

    if (referral.status === 'Rewarded') {
      return res.status(400).json({ success: false, message: 'Cannot modify an already rewarded referral' });
    }

    if (action === 'approve') {
      referral.status = 'Approved';
      referral.approvedAt = new Date();

      // Check if trigger is admin_approval → auto-credit
      const settings = await ReferralSettings.getOrCreateSettings();
      const trigger =
        referral.referrerRole === 'seller'
          ? settings.sellerRewardTrigger
          : settings.captainRewardTrigger;
      if (trigger === 'admin_approval') {
        await referral.save();
        const rewardResult = await processReferralReward(referral._id);
        return res.status(200).json({
          success: true,
          message: rewardResult.success
            ? `Referral approved and ₹${rewardResult.rewardAmt} credited to referrer`
            : `Referral approved, reward pending: ${rewardResult.message}`,
          referral: await Referral.findById(id),
        });
      }
    } else if (action === 'qualify') {
      referral.status = 'Qualified';
    } else if (action === 'reject') {
      referral.status = 'Rejected';
      referral.rejectedAt = new Date();
      referral.rejectionReason = reason || 'Rejected by Admin';
    } else {
      return res.status(400).json({ success: false, message: 'Invalid action. Use: approve, qualify, reject' });
    }

    await referral.save();
    res.status(200).json({ success: true, referral });
  } catch (error) {
    next(error);
  }
};

// @desc   Manually credit reward for a referral
// @route  POST /api/referral/admin/:id/credit
// @access Private/Admin
export const adminCreditReferralReward = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await processReferralReward(id);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }
    res.status(200).json({
      success: true,
      message: `₹${result.rewardAmt} credited successfully`,
      transactionId: result.transactionId,
    });
  } catch (error) {
    next(error);
  }
};
