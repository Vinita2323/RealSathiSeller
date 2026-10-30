import crypto from 'crypto';
import SellerMembershipPlan from '../models/SellerMembershipPlan.model.js';
import CaptainMembershipPlan from '../models/CaptainMembershipPlan.model.js';
import SellerMembership from '../models/SellerMembership.model.js';
import CaptainMembership from '../models/CaptainMembership.model.js';
import Seller from '../models/Seller.model.js';
import Captain from '../models/Captain.model.js';
import { razorpayInstance } from '../config/razorpay.js';

// ============================================================
// In-memory cache for ultra-fast plan lookups (TTL: 60s)
// ============================================================
let sellerPlansCache = { data: null, timestamp: 0 };
let captainPlansCache = { data: null, timestamp: 0 };

export const invalidateSellerPlansCache = () => {
  sellerPlansCache = { data: null, timestamp: 0 };
};

export const invalidateCaptainPlansCache = () => {
  captainPlansCache = { data: null, timestamp: 0 };
};

// ============================================================
// HELPER: Generate unique transaction ID
// ============================================================
const generateTransactionId = (prefix = 'TXN') => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
};

// ============================================================
// HELPER: Calculate expiry date
// ============================================================
const calcExpiryDate = (startDate, durationMonths) => {
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + durationMonths);
  return d;
};

// ============================================================
// HELPER: Targeted sync for single seller/captain
// ============================================================
const syncSellerMembershipStatus = async (sellerId) => {
  const now = new Date();
  await SellerMembership.updateMany(
    { sellerId, membershipStatus: 'active', expiryDate: { $lte: now } },
    { $set: { membershipStatus: 'expired', paymentStatus: 'paid' } }
  );
  const active = await SellerMembership.exists({
    sellerId,
    membershipStatus: 'active',
    expiryDate: { $gt: now },
  });
  if (!active) {
    await Seller.findByIdAndUpdate(sellerId, { membershipStatus: 'expired' });
  } else {
    await Seller.findByIdAndUpdate(sellerId, { membershipStatus: 'active' });
  }
};

const syncCaptainMembershipStatus = async (captainId) => {
  const now = new Date();
  await CaptainMembership.updateMany(
    { captainId, membershipStatus: 'active', expiryDate: { $lt: now } },
    { $set: { membershipStatus: 'expired', paymentStatus: 'paid' } }
  );
  const active = await CaptainMembership.exists({ captainId, membershipStatus: 'active' });
  if (!active) {
    await Captain.findByIdAndUpdate(captainId, { membershipStatus: 'expired' });
  }
};

// Global background auto-expire (used by admin or background cron)
const autoExpireMemberships = async () => {
  const now = new Date();
  const [expiredSellerIds, expiredCaptainIds] = await Promise.all([
    SellerMembership.distinct('sellerId', {
      membershipStatus: 'active',
      expiryDate: { $lt: now },
    }),
    CaptainMembership.distinct('captainId', {
      membershipStatus: 'active',
      expiryDate: { $lt: now },
    }),
  ]);

  await Promise.all([
    SellerMembership.updateMany(
      { membershipStatus: 'active', expiryDate: { $lt: now } },
      { $set: { membershipStatus: 'expired', paymentStatus: 'paid' } }
    ),
    CaptainMembership.updateMany(
      { membershipStatus: 'active', expiryDate: { $lt: now } },
      { $set: { membershipStatus: 'expired', paymentStatus: 'paid' } }
    ),
  ]);

  // Keep denormalized seller/captain membershipStatus in sync for listings that use it
  if (expiredSellerIds.length > 0) {
    const stillActive = await SellerMembership.distinct('sellerId', {
      sellerId: { $in: expiredSellerIds },
      membershipStatus: 'active',
      expiryDate: { $gt: now },
    });
    const stillActiveSet = new Set(stillActive.map((id) => String(id)));
    const toExpire = expiredSellerIds.filter((id) => !stillActiveSet.has(String(id)));
    if (toExpire.length > 0) {
      await Seller.updateMany(
        { _id: { $in: toExpire } },
        { $set: { membershipStatus: 'expired' } }
      );
    }
  }

  if (expiredCaptainIds.length > 0) {
    const stillActive = await CaptainMembership.distinct('captainId', {
      captainId: { $in: expiredCaptainIds },
      membershipStatus: 'active',
      expiryDate: { $gt: now },
    });
    const stillActiveSet = new Set(stillActive.map((id) => String(id)));
    const toExpire = expiredCaptainIds.filter((id) => !stillActiveSet.has(String(id)));
    if (toExpire.length > 0) {
      await Captain.updateMany(
        { _id: { $in: toExpire } },
        { $set: { membershipStatus: 'expired' } }
      );
    }
  }
};

// ============================================================
// PUBLIC: Get Seller Plans (for purchase page)
// ============================================================
export const getSellerPlans = async (req, res, next) => {
  try {
    const now = Date.now();
    if (!req.query.fresh && sellerPlansCache.data && now - sellerPlansCache.timestamp < 60000) {
      return res.status(200).json(sellerPlansCache.data);
    }
    const plans = await SellerMembershipPlan.find({ status: 'active' })
      .sort({ displayOrder: 1, price: 1 })
      .lean();
    const payload = { success: true, plans };
    sellerPlansCache = { data: payload, timestamp: now };
    res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// PUBLIC: Get Captain Plans (for purchase page)
// ============================================================
export const getCaptainPlans = async (req, res, next) => {
  try {
    const now = Date.now();
    if (!req.query.fresh && captainPlansCache.data && now - captainPlansCache.timestamp < 60000) {
      return res.status(200).json(captainPlansCache.data);
    }
    const plans = await CaptainMembershipPlan.find({ status: 'active' })
      .sort({ displayOrder: 1, price: 1 })
      .lean();
    const payload = { success: true, plans };
    captainPlansCache = { data: payload, timestamp: now };
    res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
};

// ============================================================
// SELLER: Get current membership
// ============================================================
export const getSellerMembership = async (req, res, next) => {
  try {
    await syncSellerMembershipStatus(req.user.id);
    const membership = await SellerMembership.findOne({
      sellerId: req.user.id,
      membershipStatus: { $in: ['active', 'pending_payment'] },
    }).populate('planId').sort({ createdAt: -1 }).lean();

    res.status(200).json({ success: true, membership: membership || null });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// CAPTAIN: Get current membership
// ============================================================
export const getCaptainMembership = async (req, res, next) => {
  try {
    await syncCaptainMembershipStatus(req.user.id);
    const membership = await CaptainMembership.findOne({
      captainId: req.user.id,
      membershipStatus: { $in: ['active', 'pending_payment'] },
    }).populate('planId').sort({ createdAt: -1 }).lean();

    res.status(200).json({ success: true, membership: membership || null });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// SELLER: Get membership history
// ============================================================
export const getSellerMembershipHistory = async (req, res, next) => {
  try {
    const memberships = await SellerMembership.find({ sellerId: req.user.id })
      .populate('planId')
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json({ success: true, memberships });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// CAPTAIN: Get membership history
// ============================================================
export const getCaptainMembershipHistory = async (req, res, next) => {
  try {
    const memberships = await CaptainMembership.find({ captainId: req.user.id })
      .populate('planId')
      .sort({ createdAt: -1 })
      .lean();
    res.status(200).json({ success: true, memberships });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// SELLER: Purchase (Online via Razorpay -> Instant Active)
// ============================================================
export const purchaseSellerMembership = async (req, res, next) => {
  try {
    const { planId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;
    if (!planId) return res.status(400).json({ success: false, message: 'Plan ID is required' });

    const plan = await SellerMembershipPlan.findById(planId);
    if (!plan || plan.status !== 'active') {
      return res.status(404).json({ success: false, message: 'Plan not found or inactive' });
    }

    if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: 'Online payment via Razorpay is required. COD / Manual payments are not accepted.',
      });
    }

    // Verify Razorpay HMAC-SHA256 signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (generatedSignature !== razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed: Invalid Razorpay signature.',
      });
    }

    // Determine start and expiry dates (extend if existing active subscription)
    const existingActive = await SellerMembership.findOne({
      sellerId: req.user.id,
      membershipStatus: 'active',
      expiryDate: { $gt: new Date() },
    });

    const startDate = existingActive ? existingActive.expiryDate : new Date();
    const expiryDate = calcExpiryDate(startDate, plan.durationMonths);

    // Cancel any existing pending payments for this seller
    await SellerMembership.updateMany(
      { sellerId: req.user.id, membershipStatus: 'pending_payment' },
      { $set: { membershipStatus: 'cancelled', paymentStatus: 'cancelled' } }
    );

    // Expire old active membership if replaced
    if (existingActive) {
      existingActive.membershipStatus = 'expired';
      await existingActive.save();
    }

    const membership = await SellerMembership.create({
      sellerId: req.user.id,
      planId: plan._id,
      planName: plan.name,
      durationType: plan.durationType,
      durationMonths: plan.durationMonths,
      priceAtPurchase: plan.price,
      membershipStatus: 'active',
      paymentStatus: 'paid',
      transactionId: razorpayOrderId,
      paymentReference: razorpayPaymentId,
      paymentMethod: 'razorpay',
      startDate,
      expiryDate,
    });

    await Seller.findByIdAndUpdate(req.user.id, { membershipStatus: 'active' });

    console.log(`[Membership] Seller ${req.user.id} activated plan ${plan.name} directly via Razorpay (${razorpayPaymentId}) until ${expiryDate}`);

    res.status(201).json({
      success: true,
      message: 'Payment verified and membership activated successfully!',
      membership,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// CAPTAIN: Purchase (Online via Razorpay or Manual Payment Request)
// ============================================================
export const purchaseCaptainMembership = async (req, res, next) => {
  try {
    const { planId, razorpayPaymentId, razorpayOrderId, razorpaySignature, paymentReference, paymentMethod } = req.body;
    if (!planId) return res.status(400).json({ success: false, message: 'Plan ID is required' });

    const plan = await CaptainMembershipPlan.findById(planId);
    if (!plan || plan.status !== 'active') {
      return res.status(404).json({ success: false, message: 'Plan not found or inactive' });
    }

    const isOnlineRazorpay = Boolean(razorpayPaymentId && razorpayOrderId && razorpaySignature);

    if (isOnlineRazorpay) {
      // Verify Razorpay HMAC-SHA256 signature
      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (generatedSignature !== razorpaySignature) {
        return res.status(400).json({
          success: false,
          message: 'Payment verification failed: Invalid Razorpay signature.',
        });
      }

      const existingActive = await CaptainMembership.findOne({
        captainId: req.user.id,
        membershipStatus: 'active',
        expiryDate: { $gt: new Date() },
      });

      const startDate = existingActive ? existingActive.expiryDate : new Date();
      const expiryDate = calcExpiryDate(startDate, plan.durationMonths);

      // Cancel any existing pending payments for this captain
      await CaptainMembership.updateMany(
        { captainId: req.user.id, membershipStatus: 'pending_payment' },
        { $set: { membershipStatus: 'cancelled', paymentStatus: 'cancelled' } }
      );

      if (existingActive) {
        existingActive.membershipStatus = 'expired';
        await existingActive.save();
      }

      const membership = await CaptainMembership.create({
        captainId: req.user.id,
        planId: plan._id,
        planName: plan.name,
        durationType: plan.durationType,
        durationMonths: plan.durationMonths,
        priceAtPurchase: plan.price,
        membershipStatus: 'active',
        paymentStatus: 'paid',
        transactionId: razorpayOrderId,
        paymentReference: razorpayPaymentId,
        paymentMethod: 'razorpay',
        startDate,
        expiryDate,
      });

      await Captain.findByIdAndUpdate(req.user.id, { membershipStatus: 'active' });

      return res.status(201).json({
        success: true,
        message: 'Payment verified and captain membership activated successfully!',
        membership,
      });
    }

    // Manual / Offline payment request (Pending admin confirmation)
    await CaptainMembership.updateMany(
      { captainId: req.user.id, membershipStatus: 'pending_payment' },
      { $set: { membershipStatus: 'cancelled', paymentStatus: 'cancelled' } }
    );

    const transactionId = generateTransactionId('TXN-CAP');
    const membership = await CaptainMembership.create({
      captainId: req.user.id,
      planId: plan._id,
      planName: plan.name,
      durationType: plan.durationType,
      durationMonths: plan.durationMonths,
      priceAtPurchase: plan.price,
      membershipStatus: 'pending_payment',
      paymentStatus: 'pending',
      transactionId,
      paymentReference: paymentReference || '',
      paymentMethod: paymentMethod || 'Cash on Delivery',
    });

    res.status(201).json({
      success: true,
      message: 'Payment request submitted! Admin will verify and activate your membership within 24 hours.',
      membership,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// SELLER: Renew membership (Online via Razorpay -> Instant Active)
// ============================================================
export const renewSellerMembership = async (req, res, next) => {
  try {
    const { planId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;
    if (!planId) return res.status(400).json({ success: false, message: 'Plan ID is required' });

    const plan = await SellerMembershipPlan.findById(planId);
    if (!plan || plan.status !== 'active') {
      return res.status(404).json({ success: false, message: 'Plan not found or inactive' });
    }

    if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: 'Online payment via Razorpay is required.',
      });
    }

    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (generatedSignature !== razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed: Invalid Razorpay signature.',
      });
    }

    const currentMembership = await SellerMembership.findOne({
      sellerId: req.user.id,
      membershipStatus: { $in: ['active', 'expired'] },
    }).sort({ createdAt: -1 });

    const existingActive = await SellerMembership.findOne({
      sellerId: req.user.id,
      membershipStatus: 'active',
      expiryDate: { $gt: new Date() },
    });

    const startDate = existingActive ? existingActive.expiryDate : new Date();
    const expiryDate = calcExpiryDate(startDate, plan.durationMonths);

    // Cancel pending payments
    await SellerMembership.updateMany(
      { sellerId: req.user.id, membershipStatus: 'pending_payment' },
      { $set: { membershipStatus: 'cancelled', paymentStatus: 'cancelled' } }
    );

    if (existingActive) {
      existingActive.membershipStatus = 'expired';
      await existingActive.save();
    }

    const membership = await SellerMembership.create({
      sellerId: req.user.id,
      planId: plan._id,
      planName: plan.name,
      durationType: plan.durationType,
      durationMonths: plan.durationMonths,
      priceAtPurchase: plan.price,
      membershipStatus: 'active',
      paymentStatus: 'paid',
      transactionId: razorpayOrderId,
      paymentReference: razorpayPaymentId,
      paymentMethod: 'razorpay',
      startDate,
      expiryDate,
      renewedFromId: currentMembership?._id || null,
    });

    await Seller.findByIdAndUpdate(req.user.id, { membershipStatus: 'active' });

    console.log(`[Membership] Seller ${req.user.id} renewed plan ${plan.name} directly via Razorpay (${razorpayPaymentId}) until ${expiryDate}`);

    res.status(200).json({
      success: true,
      message: 'Renewal successful! Your membership plan is active.',
      membership,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// CAPTAIN: Renew membership (Online via Razorpay or Manual Payment Request)
// ============================================================
export const renewCaptainMembership = async (req, res, next) => {
  try {
    const { planId, razorpayPaymentId, razorpayOrderId, razorpaySignature, paymentReference, paymentMethod } = req.body;
    if (!planId) return res.status(400).json({ success: false, message: 'Plan ID is required' });

    const plan = await CaptainMembershipPlan.findById(planId);
    if (!plan || plan.status !== 'active') {
      return res.status(404).json({ success: false, message: 'Plan not found or inactive' });
    }

    const currentMembership = await CaptainMembership.findOne({
      captainId: req.user.id,
      membershipStatus: { $in: ['active', 'expired'] },
    }).sort({ createdAt: -1 });

    const isOnlineRazorpay = Boolean(razorpayPaymentId && razorpayOrderId && razorpaySignature);

    if (isOnlineRazorpay) {
      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (generatedSignature !== razorpaySignature) {
        return res.status(400).json({
          success: false,
          message: 'Payment verification failed: Invalid Razorpay signature.',
        });
      }

      const existingActive = await CaptainMembership.findOne({
        captainId: req.user.id,
        membershipStatus: 'active',
        expiryDate: { $gt: new Date() },
      });

      const startDate = existingActive ? existingActive.expiryDate : new Date();
      const expiryDate = calcExpiryDate(startDate, plan.durationMonths);

      await CaptainMembership.updateMany(
        { captainId: req.user.id, membershipStatus: 'pending_payment' },
        { $set: { membershipStatus: 'cancelled', paymentStatus: 'cancelled' } }
      );

      if (existingActive) {
        existingActive.membershipStatus = 'expired';
        await existingActive.save();
      }

      const membership = await CaptainMembership.create({
        captainId: req.user.id,
        planId: plan._id,
        planName: plan.name,
        durationType: plan.durationType,
        durationMonths: plan.durationMonths,
        priceAtPurchase: plan.price,
        membershipStatus: 'active',
        paymentStatus: 'paid',
        transactionId: razorpayOrderId,
        paymentReference: razorpayPaymentId,
        paymentMethod: 'razorpay',
        startDate,
        expiryDate,
        renewedFromId: currentMembership?._id || null,
      });

      await Captain.findByIdAndUpdate(req.user.id, { membershipStatus: 'active' });

      return res.status(200).json({
        success: true,
        message: 'Renewal successful! Your captain membership is active.',
        membership,
      });
    }

    // Manual / Offline payment request for renewal
    await CaptainMembership.updateMany(
      { captainId: req.user.id, membershipStatus: 'pending_payment' },
      { $set: { membershipStatus: 'cancelled', paymentStatus: 'cancelled' } }
    );

    const transactionId = generateTransactionId('TXN-CAP');
    const membership = await CaptainMembership.create({
      captainId: req.user.id,
      planId: plan._id,
      planName: plan.name,
      durationType: plan.durationType,
      durationMonths: plan.durationMonths,
      priceAtPurchase: plan.price,
      membershipStatus: 'pending_payment',
      paymentStatus: 'pending',
      transactionId,
      paymentReference: paymentReference || '',
      paymentMethod: paymentMethod || 'Cash on Delivery',
      renewedFromId: currentMembership?._id || null,
    });

    res.status(200).json({
      success: true,
      message: 'Renewal payment request submitted! Admin will verify and activate your membership within 24 hours.',
      membership,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ADMIN: Get all Seller Plans
// ============================================================
export const adminGetSellerPlans = async (req, res, next) => {
  try {
    const plans = await SellerMembershipPlan.find().sort({ displayOrder: 1, createdAt: -1 });
    // Attach subscriber count to each plan
    const plansWithCounts = await Promise.all(
      plans.map(async (plan) => {
        const activeCount = await SellerMembership.countDocuments({ planId: plan._id, membershipStatus: 'active' });
        const totalCount = await SellerMembership.countDocuments({ planId: plan._id });
        return { ...plan.toObject(), activeSubscribers: activeCount, totalSubscribers: totalCount };
      })
    );
    res.status(200).json({ success: true, plans: plansWithCounts });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ADMIN: Get all Captain Plans
// ============================================================
export const adminGetCaptainPlans = async (req, res, next) => {
  try {
    const plans = await CaptainMembershipPlan.find().sort({ displayOrder: 1, createdAt: -1 });
    const plansWithCounts = await Promise.all(
      plans.map(async (plan) => {
        const activeCount = await CaptainMembership.countDocuments({ planId: plan._id, membershipStatus: 'active' });
        const totalCount = await CaptainMembership.countDocuments({ planId: plan._id });
        return { ...plan.toObject(), activeSubscribers: activeCount, totalSubscribers: totalCount };
      })
    );
    res.status(200).json({ success: true, plans: plansWithCounts });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ADMIN: Create Seller Plan
// ============================================================
export const adminCreateSellerPlan = async (req, res, next) => {
  try {
    const { name, durationType, durationMonths, price, description, features, status, displayOrder } = req.body;
    if (!name || !durationType || !durationMonths || price === undefined) {
      return res.status(400).json({ success: false, message: 'name, durationType, durationMonths, price are required' });
    }
    const plan = await SellerMembershipPlan.create({ name, durationType, durationMonths, price, description, features: features || [], status: status || 'active', displayOrder: displayOrder || 0 });
    invalidateSellerPlansCache();
    res.status(201).json({ success: true, message: 'Seller plan created', plan });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ADMIN: Create Captain Plan
// ============================================================
export const adminCreateCaptainPlan = async (req, res, next) => {
  try {
    const { name, durationType, durationMonths, price, description, features, status, displayOrder } = req.body;
    if (!name || !durationType || !durationMonths || price === undefined) {
      return res.status(400).json({ success: false, message: 'name, durationType, durationMonths, price are required' });
    }
    const plan = await CaptainMembershipPlan.create({ name, durationType, durationMonths, price, description, features: features || [], status: status || 'active', displayOrder: displayOrder || 0 });
    invalidateCaptainPlansCache();
    res.status(201).json({ success: true, message: 'Captain plan created', plan });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ADMIN: Update Seller Plan
// ============================================================
export const adminUpdateSellerPlan = async (req, res, next) => {
  try {
    const plan = await SellerMembershipPlan.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    invalidateSellerPlansCache();
    res.status(200).json({ success: true, message: 'Seller plan updated', plan });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ADMIN: Update Captain Plan
// ============================================================
export const adminUpdateCaptainPlan = async (req, res, next) => {
  try {
    const plan = await CaptainMembershipPlan.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    invalidateCaptainPlansCache();
    res.status(200).json({ success: true, message: 'Captain plan updated', plan });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ADMIN: Toggle Seller Plan status
// ============================================================
export const adminToggleSellerPlan = async (req, res, next) => {
  try {
    const plan = await SellerMembershipPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    plan.status = plan.status === 'active' ? 'inactive' : 'active';
    await plan.save();
    invalidateSellerPlansCache();
    res.status(200).json({ success: true, message: `Plan ${plan.status}d`, plan });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ADMIN: Toggle Captain Plan status
// ============================================================
export const adminToggleCaptainPlan = async (req, res, next) => {
  try {
    const plan = await CaptainMembershipPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    plan.status = plan.status === 'active' ? 'inactive' : 'active';
    await plan.save();
    invalidateCaptainPlansCache();
    res.status(200).json({ success: true, message: `Plan ${plan.status}d`, plan });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ADMIN: Safe Delete Seller Plan
// ============================================================
export const adminDeleteSellerPlan = async (req, res, next) => {
  try {
    const activeCount = await SellerMembership.countDocuments({ planId: req.params.id, membershipStatus: 'active' });
    if (activeCount > 0) {
      return res.status(400).json({ success: false, message: `Cannot delete plan: ${activeCount} active subscription(s) exist.` });
    }
    const plan = await SellerMembershipPlan.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    invalidateSellerPlansCache();
    res.status(200).json({ success: true, message: 'Seller plan deleted' });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ADMIN: Safe Delete Captain Plan
// ============================================================
export const adminDeleteCaptainPlan = async (req, res, next) => {
  try {
    const activeCount = await CaptainMembership.countDocuments({ planId: req.params.id, membershipStatus: 'active' });
    if (activeCount > 0) {
      return res.status(400).json({ success: false, message: `Cannot delete plan: ${activeCount} active subscription(s) exist.` });
    }
    const plan = await CaptainMembershipPlan.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    invalidateCaptainPlansCache();
    res.status(200).json({ success: true, message: 'Captain plan deleted' });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ADMIN: Get All Seller Subscriptions (with filters)
// ============================================================
export const adminGetSellerSubscriptions = async (req, res, next) => {
  try {
    const { status, search, planId, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.membershipStatus = status;
    if (planId) query.planId = planId;

    let subscriptions = await SellerMembership.find(query)
      .populate('sellerId', 'businessName phone email ownerName')
      .populate('planId', 'name durationType price')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    if (search) {
      const s = search.toLowerCase();
      subscriptions = subscriptions.filter(m =>
        m.sellerId?.businessName?.toLowerCase().includes(s) ||
        m.sellerId?.phone?.includes(s) ||
        m.sellerId?.ownerName?.toLowerCase().includes(s) ||
        m.transactionId?.toLowerCase().includes(s)
      );
    }

    const total = await SellerMembership.countDocuments(query);
    res.status(200).json({ success: true, subscriptions, total });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ADMIN: Get All Captain Subscriptions (with filters)
// ============================================================
export const adminGetCaptainSubscriptions = async (req, res, next) => {
  try {
    const { status, search, planId, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.membershipStatus = status;
    if (planId) query.planId = planId;

    let subscriptions = await CaptainMembership.find(query)
      .populate('captainId', 'name phone email')
      .populate('planId', 'name durationType price')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    // Enrich missing captain names when populate fails (deleted/orphan refs) — #86
    const missingCaptainIds = subscriptions
      .filter((m) => !m.captainId || typeof m.captainId !== 'object' || !m.captainId.name)
      .map((m) => (m.captainId && m.captainId._id ? m.captainId._id : m.captainId))
      .filter(Boolean);
    if (missingCaptainIds.length) {
      const captains = await Captain.find({ _id: { $in: missingCaptainIds } })
        .select('name phone email')
        .lean();
      const byId = Object.fromEntries(captains.map((c) => [String(c._id), c]));
      subscriptions = subscriptions.map((m) => {
        if (m.captainId && typeof m.captainId === 'object' && m.captainId.name) return m;
        const rawId = m.captainId && m.captainId._id ? m.captainId._id : m.captainId;
        const found = byId[String(rawId)];
        if (found) {
          return { ...m, captainId: { _id: found._id, name: found.name, phone: found.phone, email: found.email } };
        }
        return {
          ...m,
          captainId: {
            _id: rawId,
            name: m.captainName || 'Captain (unavailable)',
            phone: m.captainPhone || '',
          },
        };
      });
    }

    if (search) {
      const s = search.toLowerCase();
      subscriptions = subscriptions.filter(m =>
        m.captainId?.name?.toLowerCase().includes(s) ||
        m.captainId?.phone?.includes(s) ||
        m.transactionId?.toLowerCase().includes(s)
      );
    }

    const total = await CaptainMembership.countDocuments(query);
    res.status(200).json({ success: true, subscriptions, total });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ADMIN: Confirm Seller Payment → Activate Membership
// ============================================================
export const adminConfirmSellerPayment = async (req, res, next) => {
  try {
    const membership = await SellerMembership.findById(req.params.id);
    if (!membership) return res.status(404).json({ success: false, message: 'Membership record not found' });

    if (membership.membershipStatus === 'active') {
      return res.status(400).json({ success: false, message: 'Membership is already active' });
    }

    // Determine start date — extend from active membership if renewing before expiry
    const existingActive = await SellerMembership.findOne({
      sellerId: membership.sellerId,
      membershipStatus: 'active',
      expiryDate: { $gt: new Date() },
    });

    const startDate = existingActive ? existingActive.expiryDate : new Date();
    const expiryDate = calcExpiryDate(startDate, membership.durationMonths);

    membership.startDate = startDate;
    membership.expiryDate = expiryDate;
    membership.membershipStatus = 'active';
    membership.paymentStatus = 'paid';
    membership.adminNote = req.body.adminNote || '';
    await membership.save();

    // Expire the old active membership if it existed
    if (existingActive) {
      existingActive.membershipStatus = 'expired';
      await existingActive.save();
    }

    // Update seller's membershipStatus
    await Seller.findByIdAndUpdate(membership.sellerId, { membershipStatus: 'active' });

    console.log(`[Admin] Seller membership ACTIVATED: ${membership._id}, expires ${expiryDate}`);

    res.status(200).json({ success: true, message: 'Seller membership activated successfully', membership });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ADMIN: Confirm Captain Payment → Activate Membership
// ============================================================
export const adminConfirmCaptainPayment = async (req, res, next) => {
  try {
    const membership = await CaptainMembership.findById(req.params.id);
    if (!membership) return res.status(404).json({ success: false, message: 'Membership record not found' });

    if (membership.membershipStatus === 'active') {
      return res.status(400).json({ success: false, message: 'Membership is already active' });
    }

    const existingActive = await CaptainMembership.findOne({
      captainId: membership.captainId,
      membershipStatus: 'active',
      expiryDate: { $gt: new Date() },
    });

    const startDate = existingActive ? existingActive.expiryDate : new Date();
    const expiryDate = calcExpiryDate(startDate, membership.durationMonths);

    membership.startDate = startDate;
    membership.expiryDate = expiryDate;
    membership.membershipStatus = 'active';
    membership.paymentStatus = 'paid';
    membership.adminNote = req.body.adminNote || '';
    await membership.save();

    if (existingActive) {
      existingActive.membershipStatus = 'expired';
      await existingActive.save();
    }

    await Captain.findByIdAndUpdate(membership.captainId, { membershipStatus: 'active' });

    console.log(`[Admin] Captain membership ACTIVATED: ${membership._id}, expires ${expiryDate}`);

    res.status(200).json({ success: true, message: 'Captain membership activated successfully', membership });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ADMIN: Manual expiry check trigger
// ============================================================
export const adminCheckExpiry = async (req, res, next) => {
  try {
    await autoExpireMemberships();
    res.status(200).json({ success: true, message: 'Expiry check completed' });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ADMIN: Get Seller Revenue stats
// ============================================================
export const adminGetSellerMembershipStats = async (req, res, next) => {
  try {
    const totalRevenue = await SellerMembership.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$priceAtPurchase' } } },
    ]);
    const activeCount = await SellerMembership.countDocuments({ membershipStatus: 'active' });
    const pendingCount = await SellerMembership.countDocuments({ membershipStatus: 'pending_payment' });
    const expiredCount = await SellerMembership.countDocuments({ membershipStatus: 'expired' });

    res.status(200).json({
      success: true,
      stats: {
        totalRevenue: totalRevenue[0]?.total || 0,
        activeCount,
        pendingCount,
        expiredCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// ADMIN: Get Captain Revenue stats
// ============================================================
export const adminGetCaptainMembershipStats = async (req, res, next) => {
  try {
    const totalRevenue = await CaptainMembership.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$priceAtPurchase' } } },
    ]);
    const activeCount = await CaptainMembership.countDocuments({ membershipStatus: 'active' });
    const pendingCount = await CaptainMembership.countDocuments({ membershipStatus: 'pending_payment' });
    const expiredCount = await CaptainMembership.countDocuments({ membershipStatus: 'expired' });

    res.status(200).json({
      success: true,
      stats: {
        totalRevenue: totalRevenue[0]?.total || 0,
        activeCount,
        pendingCount,
        expiredCount,
      },
    });
  } catch (error) {
    next(error);
  }
};
// ============================================================
// PUBLIC: Create Razorpay Order
// ============================================================
export const createRazorpayOrder = async (req, res, next) => {
  try {
    const { planId, userType = 'seller', currency = 'INR' } = req.body;

    if (!planId) {
      return res.status(400).json({ success: false, message: 'Plan ID is required' });
    }

    let plan = null;
    if (userType === 'captain') {
      plan = await CaptainMembershipPlan.findById(planId);
    } else {
      plan = await SellerMembershipPlan.findById(planId);
    }

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Membership plan not found' });
    }

    const amount = plan.price;

    if (amount === undefined || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid plan amount' });
    }

    if (!process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID.includes('placeholder')) {
      console.error('[Razorpay Config Error]: Razorpay keys are missing or invalid in environment variables.');
      return res.status(500).json({ success: false, message: 'Payment gateway is not configured properly.' });
    }

    const options = {
      amount: Math.round(amount * 100), // amount in the smallest currency unit
      currency,
      receipt: generateTransactionId('RC'),
    };
    
    const order = await razorpayInstance.orders.create(options);
    res.status(200).json({ 
      success: true, 
      order,
      keyId: process.env.RAZORPAY_KEY_ID 
    });
  } catch (error) {
    console.error('[Razorpay Order Error]:', error);
    let errorMessage = error.error?.description || error.message || 'Could not create Razorpay order';
    if (errorMessage === 'Authentication failed' || error.statusCode === 401) {
      errorMessage = 'Razorpay Authentication failed: Please verify your RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Backend/.env';
    }
    res.status(500).json({ success: false, message: errorMessage, error: error.message });
  }
};
