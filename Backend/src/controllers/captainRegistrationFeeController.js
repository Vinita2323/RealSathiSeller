import crypto from 'crypto';
import CaptainRegistrationFeeConfig from '../models/CaptainRegistrationFeeConfig.model.js';
import CaptainRegistrationPayment from '../models/CaptainRegistrationPayment.model.js';
import Captain from '../models/Captain.model.js';
import { razorpayInstance } from '../config/razorpay.js';
import { uploadToCloudinary } from '../config/cloudinary.js';
import { sendOtpSMS, normalizePhoneNumber } from '../services/smsIndiaHubService.js';
import { generateOtp } from '../utils/generateOtp.js';
import { applyReferralCodeAtRegistration } from './referralController.js';

// Helper: Process doc image (URL passthrough, or Base64 -> Cloudinary)
const processDocImage = async (imgStr, docName = 'doc') => {
  if (!imgStr) return '';
  if (typeof imgStr === 'string') {
    // Already uploaded via /api/upload (avoids nginx 413 on initiate-order)
    if (
      imgStr.startsWith('http://') ||
      imgStr.startsWith('https://') ||
      imgStr.startsWith('/uploads/') ||
      imgStr.startsWith('uploads/')
    ) {
      return imgStr.startsWith('uploads/') ? `/${imgStr}` : imgStr;
    }
  }
  if (typeof imgStr === 'string' && imgStr.startsWith('data:image/')) {
    try {
      const uploadPromise = uploadToCloudinary(imgStr, `captains/${docName}`);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Cloudinary upload timeout')), 5000)
      );
      const res = await Promise.race([uploadPromise, timeoutPromise]);
      if (res && res.secure_url) return res.secure_url;
    } catch (err) {
      console.warn(`[CaptainRegFee] Cloudinary upload for ${docName} bypassed/fallback:`, err.message);
    }
  }
  return imgStr;
};

// Helper: Generate Unique Receipt ID
const generateReceiptId = () => {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CRF-${Date.now()}-${rand}`;
};

// ============================================================================
// PUBLIC & CAPTAIN CONTROLLERS
// ============================================================================

/**
 * GET /api/captain-registration-fee/config
 * Retrieves current active captain registration fee configuration
 */
export const getPublicFeeConfig = async (req, res, next) => {
  try {
    const config = await CaptainRegistrationFeeConfig.getOrCreateActiveConfig();
    return res.status(200).json({
      success: true,
      amount: config.amount,
      currency: config.currency,
      isActive: config.isActive,
      description: config.description,
    });
  } catch (error) {
    console.error('[CaptainRegFee] Error fetching fee config:', error);
    next(error);
  }
};

/**
 * POST /api/captain-registration-fee/initiate-order
 * Validates registration data, creates/upserts pending captain application,
 * and creates a Razorpay payment order for the exact configured registration fee.
 */
export const initiateRegistrationFeeOrder = async (req, res, next) => {
  try {
    const {
      fullName,
      mobileNumber,
      password,
      alternateMobile,
      email,
      dob,
      age,
      fatherName,
      currentAddress,
      permanentAddress,
      city,
      state,
      pinCode,
      emergencyContact,
      aadhaarNumber,
      panCardNumber,
      vehicleType,
      drivingLicenseNumber,
      rcNumber,
      vehicleInsuranceNumber,
      insuranceValidTill,
      pucNumber,
      pucValidTill,
      permitNumber,
      permitValidTill,
      fitnessCertNumber,
      fitnessValidTill,
      roadTaxNumber,
      roadTaxValidTill,
      gpsEnabled,
      gpsDeviceId,
      bankName,
      accountHolderName,
      accountNumber,
      ifscCode,
      branchName,
      upiId,
      documents,
      referralCode,
    } = req.body;

    const rawPhone = mobileNumber || req.body.phone;

    if (!rawPhone || !fullName) {
      return res.status(400).json({
        success: false,
        message: 'Full Name and Mobile Number are required.',
      });
    }

    if (!password || String(password).trim().length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password is required and must be at least 6 characters long.',
      });
    }

    const cleanPhone = normalizePhoneNumber(rawPhone) || String(rawPhone).replace(/\D/g, '').slice(-10);
    if (!cleanPhone || cleanPhone.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 10-digit Indian mobile number',
      });
    }

    // Check if captain already exists and is approved or already paid
    let existingCaptain = await Captain.findOne({
      $or: [
        { phone: cleanPhone },
        { phone: `+91${cleanPhone}` },
        { phone: `+91 ${cleanPhone}` },
        { phone: new RegExp(cleanPhone + '$') },
        { phone: String(rawPhone).trim() },
      ],
    });

    if (existingCaptain) {
      if (existingCaptain.accountStatus === 'approved' || existingCaptain.status === 'approved') {
        return res.status(400).json({
          success: false,
          message: 'This mobile number is already registered and approved. Please log in directly.',
        });
      }

      if (existingCaptain.accountStatus === 'under_review') {
        return res.status(400).json({
          success: false,
          message: 'An application with this mobile number is already under review. Please wait for Admin approval.',
        });
      }

      const isFeeExempt =
        existingCaptain.registrationFeeStatus === 'paid' ||
        existingCaptain.registrationFeeStatus === 'not_required';

      if (isFeeExempt) {
        const { otp, otpExpiry } = generateOtp();
        existingCaptain.otp = otp;
        existingCaptain.otpExpiry = otpExpiry;
        await existingCaptain.save();

        sendOtpSMS({
          phone: cleanPhone,
          otp,
          appName: 'Sathi Seller',
          role: 'captain',
        }).catch((smsErr) =>
          console.warn('[CaptainRegFee] OTP SMS failed (already paid path):', smsErr.message)
        );

        return res.status(200).json({
          success: true,
          registrationFeeRequired: false,
          alreadyPaid: true,
          message: 'Registration fee is not required or already paid for this account. Proceeding to verification.',
          phone: cleanPhone,
          otp: process.env.NODE_ENV !== 'production' ? otp : undefined,
          captain: {
            id: existingCaptain._id,
            name: existingCaptain.name,
            phone: existingCaptain.phone,
          },
        });
      }
    }

    // Get active fee configuration from database (NEVER TRUST CLIENT)
    const feeConfig = await CaptainRegistrationFeeConfig.getOrCreateActiveConfig();

    // Process image/PDF uploads (prefer pre-uploaded URLs from /api/upload)
    const rawDocs = documents || req.body.documents || {};
    const processedDocs = {};
    await Promise.all(
      Object.entries(rawDocs).map(async ([key, val]) => {
        if (val) {
          processedDocs[key] = await processDocImage(val, key);
        } else {
          processedDocs[key] = '';
        }
      })
    );

    const requiredDocKeys = [
      { key: 'profilePhoto', label: 'Live Selfie / Profile Photo' },
      { key: 'drivingLicense', label: 'Driving License' },
      { key: 'aadhaarFront', label: 'Aadhaar Front' },
      { key: 'aadhaarBack', label: 'Aadhaar Back' },
      { key: 'rcDocument', label: 'RC Document' },
      { key: 'bankPassbook', label: 'Bank Passbook Photo' },
    ];
    const missingRequired = requiredDocKeys.filter(
      (d) => !processedDocs[d.key] || !String(processedDocs[d.key]).trim()
    );
    if (missingRequired.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required documents: ${missingRequired.map((d) => d.label).join(', ')}.`,
      });
    }

    const { otp, otpExpiry } = generateOtp();

    const captainData = {
      name: fullName,
      phone: cleanPhone,
      password, // Pre-save hook will hash this
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
      aadhaarNumber,
      panCardNumber: panCardNumber ? panCardNumber.toUpperCase() : '',
      vehicleType: vehicleType || 'Motorcycle',
      drivingLicenseNumber,
      rcNumber,
      vehicleInsuranceNumber,
      insuranceValidTill,
      pucNumber,
      pucValidTill,
      permitNumber,
      permitValidTill,
      fitnessCertNumber,
      fitnessValidTill,
      roadTaxNumber,
      roadTaxValidTill,
      gpsEnabled: gpsEnabled !== undefined ? gpsEnabled : true,
      gpsDeviceId,
      documents: processedDocs,
      bankDetails: {
        bankName,
        accountHolderName,
        accountNumber,
        ifscCode,
        branchName,
        upiId,
        panCardNumber: panCardNumber ? panCardNumber.toUpperCase() : '',
      },
      otp,
      otpExpiry,
      isVerified: false,
      accountStatus: 'pending_otp',
      status: 'pending',
      registrationFeeStatus: (feeConfig.isActive && feeConfig.amount > 0) ? 'pending' : 'not_required',
      registrationFeeAmount: (feeConfig.isActive && feeConfig.amount > 0) ? feeConfig.amount : 0,
    };

    let captain;
    if (existingCaptain) {
      Object.assign(existingCaptain, captainData);
      captain = await existingCaptain.save();
    } else {
      captain = await Captain.create(captainData);
    }

    // Process referral code if provided
    if (referralCode) {
      try {
        await applyReferralCodeAtRegistration({
          referralCode,
          referrerRole: 'captain',
          referredId: captain._id,
          referredRole: 'captain',
          referredPhone: cleanPhone,
          referredName: fullName || 'Captain',
        });
      } catch (refErr) {
        console.warn('[CaptainRegFee] Referral registration error:', refErr.message);
      }
    }

    // CASE 1: Registration Fee is DISABLED or ₹0 by Admin
    if (!feeConfig.isActive || feeConfig.amount <= 0) {
      sendOtpSMS({
        phone: cleanPhone,
        otp,
        appName: 'Sathi Seller',
        role: 'captain',
      }).catch((smsErr) =>
        console.warn('[CaptainRegFee] OTP SMS failed (fee waived):', smsErr.message)
      );

      return res.status(200).json({
        success: true,
        registrationFeeRequired: false,
        message: 'Registration fee is currently waived. Please verify with OTP.',
        phone: cleanPhone,
        otp: process.env.NODE_ENV !== 'production' ? otp : undefined,
        captain: {
          id: captain._id,
          name: captain.name,
          phone: captain.phone,
        },
      });
    }

    // CASE 2: Registration Fee is ACTIVE -> Create Razorpay Order
    const transactionReference = generateReceiptId();
    const orderOptions = {
      amount: Math.round(feeConfig.amount * 100), // In paise
      currency: feeConfig.currency || 'INR',
      receipt: transactionReference,
      notes: {
        captainId: String(captain._id),
        phone: cleanPhone,
        name: captain.name,
        paymentType: 'CAPTAIN_REGISTRATION_FEE',
      },
    };

    const razorpayOrder = await razorpayInstance.orders.create(orderOptions);

    // Create payment transaction record
    const paymentRecord = await CaptainRegistrationPayment.create({
      captainId: captain._id,
      paymentType: 'CAPTAIN_REGISTRATION_FEE',
      amount: feeConfig.amount,
      currency: feeConfig.currency || 'INR',
      gateway: 'razorpay',
      gatewayOrderId: razorpayOrder.id,
      transactionReference,
      status: 'created',
      captainDetails: {
        name: captain.name,
        phone: cleanPhone,
        email: captain.email,
        vehicleType: captain.vehicleType,
        city: captain.city,
      },
    });

    return res.status(201).json({
      success: true,
      registrationFeeRequired: true,
      orderId: razorpayOrder.id,
      amount: feeConfig.amount,
      currency: feeConfig.currency || 'INR',
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_live_TgHKKogdCDai1c',
      captainId: captain._id,
      phone: cleanPhone,
      transactionReference,
      paymentId: paymentRecord._id,
    });
  } catch (error) {
    console.error('[CaptainRegFee] Error initiating registration order:', error);
    next(error);
  }
};

/**
 * POST /api/captain-registration-fee/verify-payment
 * Cryptographically verifies Razorpay payment signature, marks fee as PAID,
 * updates captain status, and dispatches the mobile verification OTP.
 */
export const verifyRegistrationFeePayment = async (req, res, next) => {
  try {
    const {
      captainId,
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
    let paymentRecord = await CaptainRegistrationPayment.findOne({
      gatewayOrderId: razorpayOrderId,
    });

    if (!paymentRecord && captainId) {
      paymentRecord = await CaptainRegistrationPayment.findOne({
        captainId,
        status: { $in: ['created', 'pending'] },
      }).sort({ createdAt: -1 });
    }

    if (generatedSignature !== razorpaySignature) {
      console.error('[CaptainRegFee] Signature verification failed for order:', razorpayOrderId);
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
      const captain = await Captain.findById(paymentRecord.captainId);
      return res.status(200).json({
        success: true,
        message: 'Registration payment already verified successfully.',
        phone: captain?.phone,
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

    // Find and update Captain document
    const targetCaptainId = paymentRecord ? paymentRecord.captainId : captainId;
    const captain = await Captain.findById(targetCaptainId);

    if (!captain) {
      return res.status(404).json({
        success: false,
        message: 'Associated captain record was not found.',
      });
    }

    captain.registrationFeeStatus = 'paid';
    captain.registrationFeePaymentId = paymentRecord?._id;
    captain.registrationFeeAmount = paymentRecord ? paymentRecord.amount : captain.registrationFeeAmount;
    captain.registrationFeePaidAt = new Date();

    // Generate fresh verification OTP
    const { otp, otpExpiry } = generateOtp();
    captain.otp = otp;
    captain.otpExpiry = otpExpiry;
    await captain.save();

    // Dispatch OTP SMS
    await sendOtpSMS({
      phone: captain.phone,
      otp,
      appName: 'Sathi Seller',
      role: 'captain',
    });

    console.log(`[CaptainRegFee] Registration fee of ₹${captain.registrationFeeAmount} paid by captain ${captain._id} (${captain.phone})`);

    return res.status(200).json({
      success: true,
      message: 'Registration payment successful. Please verify your mobile number with the OTP.',
      phone: captain.phone,
      registrationFeeStatus: 'paid',
      otp: process.env.NODE_ENV !== 'production' ? otp : undefined,
    });
  } catch (error) {
    console.error('[CaptainRegFee] Error verifying payment:', error);
    next(error);
  }
};

/**
 * POST /api/captain-registration-fee/retry-order
 * Allows captain to retry payment without duplicating registration data.
 */
export const retryRegistrationFeeOrder = async (req, res, next) => {
  try {
    const { captainId, phone } = req.body;

    const cleanPhone = phone ? normalizePhoneNumber(phone) || String(phone).replace(/\D/g, '').slice(-10) : '';
    const captain = await Captain.findOne({
      $or: [
        ...(captainId ? [{ _id: captainId }] : []),
        ...(cleanPhone ? [{ phone: cleanPhone }, { phone: new RegExp(cleanPhone + '$') }] : []),
      ],
    });

    if (!captain) {
      return res.status(404).json({
        success: false,
        message: 'Captain registration record not found. Please fill the registration form.',
      });
    }

    const isFeeExempt =
      captain.registrationFeeStatus === 'paid' ||
      captain.registrationFeeStatus === 'not_required' ||
      captain.accountStatus === 'approved' ||
      captain.status === 'approved';

    if (isFeeExempt) {
      return res.status(200).json({
        success: true,
        alreadyPaid: true,
        registrationFeeRequired: false,
        message: 'Registration fee is not required or already paid for this account.',
        phone: captain.phone,
      });
    }

    // Fetch existing pending payment or latest fee config
    const existingPayment = await CaptainRegistrationPayment.findOne({
      captainId: captain._id,
    }).sort({ createdAt: -1 });

    const feeConfig = await CaptainRegistrationFeeConfig.getOrCreateActiveConfig();
    const feeAmount = existingPayment ? existingPayment.amount : feeConfig.amount;
    const feeCurrency = existingPayment ? existingPayment.currency : (feeConfig.currency || 'INR');

    const transactionReference = generateReceiptId();
    const orderOptions = {
      amount: Math.round(feeAmount * 100),
      currency: feeCurrency,
      receipt: transactionReference,
      notes: {
        captainId: String(captain._id),
        phone: captain.phone,
        name: captain.name,
        paymentType: 'CAPTAIN_REGISTRATION_FEE',
        isRetry: 'true',
      },
    };

    const razorpayOrder = await razorpayInstance.orders.create(orderOptions);

    const newPaymentRecord = await CaptainRegistrationPayment.create({
      captainId: captain._id,
      paymentType: 'CAPTAIN_REGISTRATION_FEE',
      amount: feeAmount,
      currency: feeCurrency,
      gateway: 'razorpay',
      gatewayOrderId: razorpayOrder.id,
      transactionReference,
      status: 'created',
      captainDetails: {
        name: captain.name,
        phone: captain.phone,
        email: captain.email,
        vehicleType: captain.vehicleType,
        city: captain.city,
      },
    });

    return res.status(200).json({
      success: true,
      orderId: razorpayOrder.id,
      amount: feeAmount,
      currency: feeCurrency,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_live_TgHKKogdCDai1c',
      captainId: captain._id,
      phone: captain.phone,
      transactionReference,
      paymentId: newPaymentRecord._id,
    });
  } catch (error) {
    console.error('[CaptainRegFee] Error retrying registration order:', error);
    next(error);
  }
};

/**
 * POST /api/captain-registration-fee/webhook
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
        console.warn('[CaptainRegFee Webhook] Invalid webhook signature received');
        return res.status(400).send('Invalid webhook signature');
      }
    }

    const event = req.body.event;
    const paymentEntity = req.body.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id;

    if (!orderId) {
      return res.status(200).json({ status: 'ignored' });
    }

    const paymentRecord = await CaptainRegistrationPayment.findOne({ gatewayOrderId: orderId });
    if (!paymentRecord) {
      return res.status(200).json({ status: 'not_applicable' });
    }

    if (event === 'payment.captured' || event === 'order.paid') {
      if (paymentRecord.status !== 'paid') {
        paymentRecord.status = 'paid';
        paymentRecord.gatewayPaymentId = paymentEntity.id;
        paymentRecord.paidAt = new Date();
        await paymentRecord.save();

        await Captain.findByIdAndUpdate(paymentRecord.captainId, {
          registrationFeeStatus: 'paid',
          registrationFeePaymentId: paymentRecord._id,
          registrationFeeAmount: paymentRecord.amount,
          registrationFeePaidAt: new Date(),
        });
        console.log(`[CaptainRegFee Webhook] Marked payment for order ${orderId} as PAID`);
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
    console.error('[CaptainRegFee Webhook] Error:', error);
    return res.status(500).json({ error: error.message });
  }
};

// ============================================================================
// ADMIN CONTROLLERS
// ============================================================================

/**
 * GET /api/admin/captain-registration-fee or /api/captain-registration-fee/admin
 * Returns current fee configuration, audit history, and summary statistics
 */
export const adminGetFeeConfig = async (req, res, next) => {
  try {
    const config = await CaptainRegistrationFeeConfig.getOrCreateActiveConfig();

    const [totalPaidCount, totalAmountResult, pendingCount] = await Promise.all([
      CaptainRegistrationPayment.countDocuments({ status: 'paid' }),
      CaptainRegistrationPayment.aggregate([
        { $match: { status: 'paid' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      CaptainRegistrationPayment.countDocuments({ status: { $in: ['created', 'pending'] } }),
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
        totalPaidCaptains: totalPaidCount,
        totalRevenue,
        pendingPayments: pendingCount,
      },
    });
  } catch (error) {
    console.error('[CaptainRegFee Admin] Error fetching config:', error);
    next(error);
  }
};

/**
 * PUT /api/admin/captain-registration-fee or /api/captain-registration-fee/admin
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

    const config = await CaptainRegistrationFeeConfig.getOrCreateActiveConfig();
    const oldAmount = config.amount;
    const oldStatus = config.isActive;

    const newAmount = amount !== undefined ? Number(amount) : config.amount;
    const newStatus = isActive !== undefined ? Boolean(isActive) : config.isActive;
    const adminUser = req.user?.email || req.user?.name || req.user?.phone || 'Admin';

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

    console.log(`[CaptainRegFee Admin] Fee updated by ${adminUser}: ₹${oldAmount} -> ₹${newAmount} (Active: ${newStatus})`);

    return res.status(200).json({
      success: true,
      message: `Captain registration fee updated successfully to ₹${newAmount}`,
      config,
    });
  } catch (error) {
    console.error('[CaptainRegFee Admin] Error updating config:', error);
    next(error);
  }
};

/**
 * GET /api/captain-registration-fee/admin/payments
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

    const filter = { paymentType: 'CAPTAIN_REGISTRATION_FEE' };

    if (status && status !== 'all') {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { 'captainDetails.name': { $regex: search, $options: 'i' } },
        { 'captainDetails.phone': { $regex: search, $options: 'i' } },
        { 'captainDetails.city': { $regex: search, $options: 'i' } },
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
      CaptainRegistrationPayment.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('captainId', 'name phone email vehicleType city accountStatus status isVerified')
        .lean(),
      CaptainRegistrationPayment.countDocuments(filter),
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
    console.error('[CaptainRegFee Admin] Error fetching payments:', error);
    next(error);
  }
};

/**
 * GET /api/captain-registration-fee/admin/payments/:id
 * Fetches single transaction details
 */
export const adminGetFeePaymentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const payment = await CaptainRegistrationPayment.findById(id)
      .populate('captainId', 'name phone email vehicleType currentAddress city state pinCode accountStatus status isVerified createdAt')
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
    console.error('[CaptainRegFee Admin] Error fetching payment details:', error);
    next(error);
  }
};
