import crypto from 'crypto';
import SellerRegistrationFeeConfig from '../models/SellerRegistrationFeeConfig.model.js';
import SellerRegistrationPayment from '../models/SellerRegistrationPayment.model.js';
import Seller from '../models/Seller.model.js';
import { razorpayInstance } from '../config/razorpay.js';
import { uploadToCloudinary } from '../config/cloudinary.js';
import { sendOtpSMS } from '../services/smsIndiaHubService.js';
import { generateOtp } from '../utils/generateOtp.js';
import { applyReferralCodeAtRegistration } from './referralController.js';

// Helper: Normalize 10-digit phone
const normalizePhone = (phone) => {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
};

// Helper: Generate Unique Receipt ID
const generateReceiptId = () => {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `SRF-${Date.now()}-${rand}`;
};

// ============================================================================
// PUBLIC & SELLER CONTROLLERS
// ============================================================================

/**
 * GET /api/seller-registration-fee/config
 * Retrieves current active seller registration fee configuration
 */
export const getPublicFeeConfig = async (req, res, next) => {
  try {
    const config = await SellerRegistrationFeeConfig.getOrCreateActiveConfig();
    return res.status(200).json({
      success: true,
      amount: config.amount,
      currency: config.currency,
      isActive: config.isActive,
      description: config.description,
    });
  } catch (error) {
    console.error('[SellerRegFee] Error fetching fee config:', error);
    next(error);
  }
};

/**
 * POST /api/seller-registration-fee/initiate-order
 * Validates registration data, creates/upserts pending seller application,
 * and creates a Razorpay payment order for the exact configured registration fee.
 */
export const initiateRegistrationFeeOrder = async (req, res, next) => {
  try {
    const {
      businessName,
      ownerName,
      phone,
      password,
      email,
      businessType,
      storeLogo,
      serviceRadius,
      completeAddress,
      city,
      state,
      pincode,
      lat,
      lng,
      gstNumber,
      panNumber,
      fssaiLicense,
      gstPhoto,
      bankPassbookPhoto,
      categories,
      referralCode,
    } = req.body;

    if (!phone || !businessName) {
      return res.status(400).json({
        success: false,
        message: 'Business Name and Mobile Number are required',
      });
    }

    if (!password || String(password).trim().length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password is required and must be at least 6 characters long.',
      });
    }

    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || cleanPhone.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 10-digit mobile number',
      });
    }

    // Check if seller already exists and is approved or already paid
    let existingSeller = await Seller.findOne({
      $or: [
        { phone: cleanPhone },
        { phone: `+91${cleanPhone}` },
        { phone: new RegExp(cleanPhone + '$') },
      ],
    });

    if (existingSeller) {
      if (existingSeller.accountStatus === 'approved' || existingSeller.status === 'approved') {
        return res.status(400).json({
          success: false,
          message: 'This mobile number is already registered and approved. Please log in directly.',
        });
      }

      // Only skip payment when fee was actually paid or explicitly waived — never via date cutoff
      const isFeeExempt =
        existingSeller.registrationFeeStatus === 'paid' ||
        existingSeller.registrationFeeStatus === 'not_required';

      if (isFeeExempt) {
        // Persist password from this registration attempt if provided (#22)
        if (password) {
          existingSeller.password = password;
          existingSeller.markModified('password');
        }
        if (businessName) existingSeller.businessName = businessName;
        if (ownerName) existingSeller.ownerName = ownerName;

        const { otp, otpExpiry } = generateOtp();
        existingSeller.otp = otp;
        existingSeller.otpExpiry = otpExpiry;
        await existingSeller.save();

        await sendOtpSMS({
          phone: cleanPhone,
          otp,
          appName: 'Sathi Seller',
          role: 'seller',
        });

        return res.status(200).json({
          success: true,
          registrationFeeRequired: false,
          alreadyPaid: existingSeller.registrationFeeStatus === 'paid',
          message: 'Registration fee is not required or already paid for this account. Proceeding to verification.',
          phone: cleanPhone,
          sellerId: existingSeller._id,
          seller: {
            id: existingSeller._id,
            phone: existingSeller.phone,
            businessName: existingSeller.businessName,
          },
        });
      }
    }

    // Get active fee configuration from database (NEVER TRUST CLIENT)
    const feeConfig = await SellerRegistrationFeeConfig.getOrCreateActiveConfig();

    // Validate referral code BEFORE creating/updating seller (#18)
    const cleanReferralCode = referralCode ? String(referralCode).trim().toUpperCase() : '';
    let referrerSeller = null;
    if (cleanReferralCode) {
      const escaped = cleanReferralCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      referrerSeller = await Seller.findOne({
        referralCode: { $regex: new RegExp(`^${escaped}$`, 'i') },
      }).select('_id businessName ownerName referralCode');
      if (!referrerSeller) {
        return res.status(400).json({
          success: false,
          message: 'Invalid referral code. Please check and try again, or leave it blank.',
        });
      }
    }

    // Process image uploads if base64
    let processedLogo = storeLogo || '';
    if (storeLogo && typeof storeLogo === 'string' && storeLogo.startsWith('data:image/')) {
      try {
        const uploadRes = await uploadToCloudinary(storeLogo, 'sellers/logos');
        processedLogo = uploadRes.secure_url;
      } catch (err) {
        console.warn('[SellerRegFee] Cloudinary logo upload error:', err.message);
      }
    }

    let processedGstPhoto = gstPhoto || '';
    if (gstPhoto && typeof gstPhoto === 'string' && gstPhoto.startsWith('data:image/')) {
      try {
        const uploadRes = await uploadToCloudinary(gstPhoto, 'sellers/documents');
        processedGstPhoto = uploadRes.secure_url;
      } catch (err) {
        console.warn('[SellerRegFee] Cloudinary GST upload error:', err.message);
      }
    }

    let processedPassbookPhoto = bankPassbookPhoto || '';
    if (bankPassbookPhoto && typeof bankPassbookPhoto === 'string' && bankPassbookPhoto.startsWith('data:image/')) {
      try {
        const uploadRes = await uploadToCloudinary(bankPassbookPhoto, 'sellers/documents');
        processedPassbookPhoto = uploadRes.secure_url;
      } catch (err) {
        console.warn('[SellerRegFee] Cloudinary passbook upload error:', err.message);
      }
    }

    const { otp, otpExpiry } = generateOtp();

    const sellerData = {
      businessName,
      ownerName,
      phone: cleanPhone,
      password, // Password pre-save hook will hash this
      email,
      businessType: businessType || 'Retail',
      storeLogo: processedLogo,
      serviceRadius: serviceRadius ? Number(serviceRadius) : 5,
      gstNumber,
      panNumber,
      fssaiLicense,
      gstPhoto: processedGstPhoto,
      bankPassbookPhoto: processedPassbookPhoto,
      categories: Array.isArray(categories) ? categories : [],
      warehouseLocation: {
        storeAddress: completeAddress,
        city,
        state,
        pincode,
        location: {
          type: 'Point',
          coordinates: (lng != null && lat != null) ? [parseFloat(lng), parseFloat(lat)] : [0, 0],
        },
      },
      otp,
      otpExpiry,
      isVerified: false,
      accountStatus: 'pending_otp',
      status: 'pending',
      registrationFeeStatus: (feeConfig.isActive && feeConfig.amount > 0) ? 'pending' : 'not_required',
      registrationFeeAmount: (feeConfig.isActive && feeConfig.amount > 0) ? feeConfig.amount : 0,
    };

    let seller;
    if (existingSeller) {
      Object.keys(sellerData).forEach((key) => {
        existingSeller[key] = sellerData[key];
      });
      if (sellerData.password) existingSeller.markModified('password');
      seller = await existingSeller.save();
    } else {
      seller = await Seller.create(sellerData);
    }

    // Apply validated referral after seller exists
    if (cleanReferralCode && referrerSeller) {
      try {
        await applyReferralCodeAtRegistration({
          referralCode: cleanReferralCode,
          referrerRole: 'seller',
          referredId: seller._id,
          referredRole: 'seller',
          referredPhone: cleanPhone,
          referredName: businessName || ownerName || 'Seller',
        });
      } catch (refErr) {
        console.warn('[SellerRegFee] Referral apply error:', refErr.message);
      }
    }

    // CASE 1: Registration Fee is DISABLED or ₹0 by Admin
    if (!feeConfig.isActive || feeConfig.amount <= 0) {
      // Fee not required -> Dispatch OTP immediately
      await sendOtpSMS({
        phone: cleanPhone,
        otp,
        appName: 'Sathi Seller',
        role: 'seller',
      });

      return res.status(200).json({
        success: true,
        registrationFeeRequired: false,
        message: 'Registration fee is currently waived. Please verify with OTP.',
        phone: cleanPhone,
        sellerId: seller._id,
        seller: {
          id: seller._id,
          phone: seller.phone,
          businessName: seller.businessName,
        },
      });
    }

    // CASE 2: Registration Fee is ACTIVE -> Create Razorpay Order
    const transactionReference = generateReceiptId();
    const orderOptions = {
      amount: Math.round(feeConfig.amount * 100), // Razorpay accepts in paise
      currency: feeConfig.currency || 'INR',
      receipt: transactionReference,
      notes: {
        sellerId: String(seller._id),
        phone: cleanPhone,
        businessName: seller.businessName,
        paymentType: 'SELLER_REGISTRATION_FEE',
      },
    };

    const razorpayOrder = await razorpayInstance.orders.create(orderOptions);

    // Create payment transaction record in database
    const paymentRecord = await SellerRegistrationPayment.create({
      sellerId: seller._id,
      paymentType: 'SELLER_REGISTRATION_FEE',
      amount: feeConfig.amount,
      currency: feeConfig.currency || 'INR',
      gateway: 'razorpay',
      gatewayOrderId: razorpayOrder.id,
      transactionReference,
      status: 'created',
      sellerDetails: {
        businessName: seller.businessName,
        ownerName: seller.ownerName,
        phone: cleanPhone,
        email: seller.email,
      },
    });

    return res.status(201).json({
      success: true,
      registrationFeeRequired: true,
      orderId: razorpayOrder.id,
      amount: feeConfig.amount,
      currency: feeConfig.currency || 'INR',
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_live_TgHKKogdCDai1c',
      sellerId: seller._id,
      phone: cleanPhone,
      transactionReference,
      paymentId: paymentRecord._id,
    });
  } catch (error) {
    console.error('[SellerRegFee] Error initiating registration order:', error);
    next(error);
  }
};

/**
 * POST /api/seller-registration-fee/verify-payment
 * Cryptographically verifies Razorpay payment signature, marks fee as PAID,
 * updates seller status, and dispatches the mobile verification OTP.
 */
export const verifyRegistrationFeePayment = async (req, res, next) => {
  try {
    const {
      sellerId,
      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature,
    } = req.body;

    if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required Razorpay payment verification parameters',
      });
    }

    // Cryptographic Signature Verification using HMAC-SHA256
    const secret = process.env.RAZORPAY_KEY_SECRET || 'secret_placeholder';
    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    // Find the associated payment record
    let paymentRecord = await SellerRegistrationPayment.findOne({
      gatewayOrderId: razorpayOrderId,
    });

    if (!paymentRecord && sellerId) {
      paymentRecord = await SellerRegistrationPayment.findOne({
        sellerId,
        status: { $in: ['created', 'pending'] },
      }).sort({ createdAt: -1 });
    }

    if (generatedSignature !== razorpaySignature) {
      console.error('[SellerRegFee] Signature verification failed for order:', razorpayOrderId);
      if (paymentRecord) {
        paymentRecord.status = 'failed';
        paymentRecord.failureReason = 'Signature mismatch during backend verification';
        await paymentRecord.save();
      }
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature. Payment verification failed.',
      });
    }

    // Idempotency: If already marked as paid, return success without duplicate processing
    if (paymentRecord && paymentRecord.status === 'paid') {
      const seller = await Seller.findById(paymentRecord.sellerId);
      return res.status(200).json({
        success: true,
        message: 'Registration payment already verified successfully.',
        phone: seller?.phone,
        registrationFeeStatus: 'paid',
      });
    }

    // Atomic update of payment record
    if (paymentRecord) {
      paymentRecord.status = 'paid';
      paymentRecord.gatewayPaymentId = razorpayPaymentId;
      paymentRecord.gatewaySignature = razorpaySignature;
      paymentRecord.paidAt = new Date();
      await paymentRecord.save();
    }

    // Find and update Seller document
    const targetSellerId = paymentRecord ? paymentRecord.sellerId : sellerId;
    const seller = await Seller.findById(targetSellerId);

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Associated seller record was not found.',
      });
    }

    seller.registrationFeeStatus = 'paid';
    seller.registrationFeePaymentId = paymentRecord?._id;
    seller.registrationFeeAmount = paymentRecord ? paymentRecord.amount : seller.registrationFeeAmount;
    seller.registrationFeePaidAt = new Date();

    // Generate fresh verification OTP
    const { otp, otpExpiry } = generateOtp();
    seller.otp = otp;
    seller.otpExpiry = otpExpiry;
    await seller.save();

    // Dispatch OTP SMS
    await sendOtpSMS({
      phone: seller.phone,
      otp,
      appName: 'Sathi Seller',
      role: 'seller',
    });

    console.log(`[SellerRegFee] Registration fee of ₹${seller.registrationFeeAmount} paid by seller ${seller._id} (${seller.phone})`);

    return res.status(200).json({
      success: true,
      message: 'Registration payment successful. Please verify your mobile number with the OTP.',
      phone: seller.phone,
      registrationFeeStatus: 'paid',
      });
  } catch (error) {
    console.error('[SellerRegFee] Error verifying payment:', error);
    next(error);
  }
};

/**
 * POST /api/seller-registration-fee/retry-order
 * Allows seller to retry payment without duplicating registration data.
 * Preserves original initiated amount if an order was already created.
 */
export const retryRegistrationFeeOrder = async (req, res, next) => {
  try {
    const { sellerId, phone } = req.body;

    const cleanPhone = normalizePhone(phone);
    const seller = await Seller.findOne({
      $or: [
        ...(sellerId ? [{ _id: sellerId }] : []),
        ...(cleanPhone ? [{ phone: cleanPhone }, { phone: new RegExp(cleanPhone + '$') }] : []),
      ],
    });

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller registration record not found. Please fill the registration form.',
      });
    }

    const feeConfigCutoff = new Date('2026-09-12T12:46:51.865Z');
    const isLegacySeller = seller.createdAt && new Date(seller.createdAt) < feeConfigCutoff;
    const isFeeExempt = seller.registrationFeeStatus === 'paid' || 
                        seller.registrationFeeStatus === 'not_required' || 
                        seller.accountStatus === 'approved' || 
                        seller.status === 'approved' || 
                        isLegacySeller;

    if (isFeeExempt) {
      return res.status(200).json({
        success: true,
        alreadyPaid: true,
        registrationFeeRequired: false,
        message: 'Registration fee is not required or already paid for this account.',
        phone: seller.phone,
      });
    }

    // Fetch existing pending payment or latest fee config
    const existingPayment = await SellerRegistrationPayment.findOne({
      sellerId: seller._id,
    }).sort({ createdAt: -1 });

    const feeConfig = await SellerRegistrationFeeConfig.getOrCreateActiveConfig();
    const feeAmount = existingPayment ? existingPayment.amount : feeConfig.amount;
    const feeCurrency = existingPayment ? existingPayment.currency : (feeConfig.currency || 'INR');

    const transactionReference = generateReceiptId();
    const orderOptions = {
      amount: Math.round(feeAmount * 100),
      currency: feeCurrency,
      receipt: transactionReference,
      notes: {
        sellerId: String(seller._id),
        phone: seller.phone,
        businessName: seller.businessName,
        paymentType: 'SELLER_REGISTRATION_FEE',
        isRetry: 'true',
      },
    };

    const razorpayOrder = await razorpayInstance.orders.create(orderOptions);

    const newPaymentRecord = await SellerRegistrationPayment.create({
      sellerId: seller._id,
      paymentType: 'SELLER_REGISTRATION_FEE',
      amount: feeAmount,
      currency: feeCurrency,
      gateway: 'razorpay',
      gatewayOrderId: razorpayOrder.id,
      transactionReference,
      status: 'created',
      sellerDetails: {
        businessName: seller.businessName,
        ownerName: seller.ownerName,
        phone: seller.phone,
        email: seller.email,
      },
    });

    return res.status(200).json({
      success: true,
      orderId: razorpayOrder.id,
      amount: feeAmount,
      currency: feeCurrency,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_live_TgHKKogdCDai1c',
      sellerId: seller._id,
      phone: seller.phone,
      transactionReference,
      paymentId: newPaymentRecord._id,
    });
  } catch (error) {
    console.error('[SellerRegFee] Error retrying registration order:', error);
    next(error);
  }
};

/**
 * POST /api/seller-registration-fee/webhook
 * Razorpay webhook handler for asynchronous payment capture/failure confirmation
 */
export const handleRegistrationFeeWebhook = async (req, res) => {
  try {
    const webhookSignature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (webhookSecret && webhookSignature) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (expectedSignature !== webhookSignature) {
        console.warn('[SellerRegFee] Invalid webhook signature received');
        return res.status(400).send('Invalid webhook signature');
      }
    }

    const event = req.body.event;
    const paymentEntity = req.body.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id;

    if (!orderId) {
      return res.status(200).json({ status: 'ignored' });
    }

    const paymentRecord = await SellerRegistrationPayment.findOne({ gatewayOrderId: orderId });
    if (!paymentRecord) {
      return res.status(200).json({ status: 'not_applicable' });
    }

    if (event === 'payment.captured' || event === 'order.paid') {
      if (paymentRecord.status !== 'paid') {
        paymentRecord.status = 'paid';
        paymentRecord.gatewayPaymentId = paymentEntity.id;
        paymentRecord.paidAt = new Date();
        await paymentRecord.save();

        await Seller.findByIdAndUpdate(paymentRecord.sellerId, {
          registrationFeeStatus: 'paid',
          registrationFeePaymentId: paymentRecord._id,
          registrationFeeAmount: paymentRecord.amount,
          registrationFeePaidAt: new Date(),
        });
        console.log(`[SellerRegFee Webhook] Marked payment for order ${orderId} as PAID`);
      }
    } else if (event === 'payment.failed') {
      if (paymentRecord.status !== 'paid') {
        paymentRecord.status = 'failed';
        paymentRecord.failureReason = paymentEntity.error_description || 'Payment failed via webhook';
        await paymentRecord.save();
      }
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('[SellerRegFee Webhook] Error:', error);
    return res.status(500).json({ error: error.message });
  }
};

// ============================================================================
// ADMIN CONTROLLERS
// ============================================================================

/**
 * GET /api/admin/seller-registration-fee
 * Returns current fee configuration, audit history, and summary statistics
 */
export const adminGetFeeConfig = async (req, res, next) => {
  try {
    const config = await SellerRegistrationFeeConfig.getOrCreateActiveConfig();

    // Summary statistics
    const [totalPaidCount, totalAmountResult, pendingCount] = await Promise.all([
      SellerRegistrationPayment.countDocuments({ status: 'paid' }),
      SellerRegistrationPayment.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      SellerRegistrationPayment.countDocuments({ status: { $in: ['created', 'pending'] } }),
    ]);

    const totalRevenue = totalAmountResult[0]?.total || 0;

    return res.status(200).json({
      success: true,
      config: {
        _id: config._id,
        amount: config.amount,
        currency: config.currency,
        isActive: config.isActive,
        description: config.description,
        updatedBy: config.updatedBy,
        updatedAt: config.updatedAt,
        history: (config.history || []).sort((a, b) => new Date(b.changedAt) - new Date(a.changedAt)),
      },
      stats: {
        totalPaidSellers: totalPaidCount,
        totalRevenue,
        pendingPayments: pendingCount,
      },
    });
  } catch (error) {
    console.error('[SellerRegFee Admin] Error fetching config:', error);
    next(error);
  }
};

/**
 * PUT /api/admin/seller-registration-fee
 * Updates registration fee amount or active status and logs change in audit history
 */
export const adminUpdateFeeConfig = async (req, res, next) => {
  try {
    const { amount, isActive, description, reason } = req.body;

    if (amount !== undefined && (isNaN(amount) || Number(amount) < 0)) {
      return res.status(400).json({
        success: false,
        message: 'Fee amount must be a non-negative number',
      });
    }

    const config = await SellerRegistrationFeeConfig.getOrCreateActiveConfig();
    const oldAmount = config.amount;
    const oldStatus = config.isActive;

    const newAmount = amount !== undefined ? Number(amount) : config.amount;
    const newStatus = isActive !== undefined ? Boolean(isActive) : config.isActive;
    const adminUser = req.user?.email || req.user?.name || req.user?.phone || 'Admin';

    // Append to audit history if value changed
    const auditRecord = {
      amount: newAmount,
      currency: config.currency || 'INR',
      isActive: newStatus,
      changedBy: adminUser,
      changedAt: new Date(),
      reason: reason || `Updated fee from ₹${oldAmount} to ₹${newAmount} (Status: ${newStatus ? 'Active' : 'Inactive'})`,
    };

    config.amount = newAmount;
    config.isActive = newStatus;
    if (description !== undefined) config.description = description;
    config.updatedBy = adminUser;
    config.history.push(auditRecord);

    await config.save();

    console.log(`[SellerRegFee Admin] Fee updated by ${adminUser}: ₹${oldAmount} -> ₹${newAmount} (Active: ${newStatus})`);

    return res.status(200).json({
      success: true,
      message: `Seller registration fee updated successfully to ₹${newAmount}`,
      config,
    });
  } catch (error) {
    console.error('[SellerRegFee Admin] Error updating config:', error);
    next(error);
  }
};

/**
 * GET /api/admin/seller-registration-fee/payments
 * Lists registration fee payments with filtering, search, and pagination
 */
export const adminGetFeePayments = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));
    const status = req.query.status;
    const search = req.query.search ? String(req.query.search).trim() : '';
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    const filter = { paymentType: 'SELLER_REGISTRATION_FEE' };

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { 'sellerDetails.businessName': { $regex: search, $options: 'i' } },
        { 'sellerDetails.ownerName': { $regex: search, $options: 'i' } },
        { 'sellerDetails.phone': { $regex: search, $options: 'i' } },
        { gatewayOrderId: { $regex: search, $options: 'i' } },
        { gatewayPaymentId: { $regex: search, $options: 'i' } },
        { transactionReference: { $regex: search, $options: 'i' } },
      ];
    }

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const [payments, totalCount] = await Promise.all([
      SellerRegistrationPayment.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('sellerId', 'businessName ownerName phone email accountStatus status')
        .lean(),
      SellerRegistrationPayment.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      payments,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('[SellerRegFee Admin] Error fetching payments:', error);
    next(error);
  }
};

/**
 * GET /api/admin/seller-registration-fee/payments/:id
 * Fetches single transaction details for deep inspection
 */
export const adminGetFeePaymentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payment = await SellerRegistrationPayment.findById(id)
      .populate('sellerId', 'businessName ownerName phone email completeAddress warehouseLocation accountStatus status isVerified createdAt')
      .lean();

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Registration fee payment record not found',
      });
    }

    return res.status(200).json({
      success: true,
      payment,
    });
  } catch (error) {
    console.error('[SellerRegFee Admin] Error fetching payment details:', error);
    next(error);
  }
};
