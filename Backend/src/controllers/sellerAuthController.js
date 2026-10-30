import Seller from '../models/Seller.model.js';
import { generateOtp, isMockOtp } from '../utils/generateOtp.js';
import { generateToken } from '../utils/generateToken.js';
import { uploadToCloudinary } from '../config/cloudinary.js';
import SellerMembership from '../models/SellerMembership.model.js';
import SellerMembershipPlan from '../models/SellerMembershipPlan.model.js';
import { sendOtpSMS, normalizePhoneNumber } from '../services/smsIndiaHubService.js';
import crypto from 'crypto';
import { applyReferralCodeAtRegistration } from './referralController.js';
import { invalidateProductsCache } from './productController.js';
import { invalidatePublicSellersCache } from '../routes/sellerRoutes.js';
import SellerRegistrationFeeConfig from '../models/SellerRegistrationFeeConfig.model.js';
import { hasRegistrationFeeCleared, isMembershipRequiredForSeller } from '../utils/sellerEligibility.js';

// Send / Resend OTP
// purpose: 'register' (default) may create a stub seller; 'reset' requires an existing account
export const sendOtp = async (req, res, next) => {
  try {
    const rawPhone = req.body.phone;
    const purpose = String(req.body.purpose || req.body.for || 'register').toLowerCase();
    const isPasswordReset = purpose === 'reset' || purpose === 'forgot' || purpose === 'forgot_password';

    if (!rawPhone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const cleanPhone = normalizePhoneNumber(rawPhone);
    if (!cleanPhone || cleanPhone.length !== 10) {
      return res.status(400).json({ success: false, message: 'Please provide a valid 10-digit Indian mobile number' });
    }

    const { otp, otpExpiry } = generateOtp();

    let seller = await Seller.findOne({
      $or: [
        { phone: cleanPhone },
        { phone: `+91${cleanPhone}` },
        { phone: `+91 ${cleanPhone}` },
        { phone: new RegExp(cleanPhone + '$') },
        { phone: String(rawPhone).trim() },
      ]
    });

    if (!seller) {
      if (isPasswordReset) {
        return res.status(404).json({
          success: false,
          message: 'No seller account found with this mobile number. Please register first.',
        });
      }
      seller = await Seller.create({ 
        phone: cleanPhone, 
        otp, 
        otpExpiry, 
        accountStatus: 'pending_otp',
        status: 'pending',
        isVerified: false,
        businessName: 'Seller Store'
      });
    } else {
      seller.otp = otp;
      seller.otpExpiry = otpExpiry;
      if (seller.phone !== cleanPhone) {
        seller.phone = cleanPhone;
      }
      await seller.save();
    }

    // Dispatch OTP through centralized SMS India Hub Service
    const smsResult = await sendOtpSMS({
      phone: cleanPhone,
      otp,
      appName: 'Sathi Seller',
      role: 'seller',
    });

    if (!smsResult.success) {
      console.warn(`[SellerAuth] SMS dispatch notice (${smsResult.message || 'Sandbox'}). Mock OTP: ${otp}`);
    }

    res.status(200).json({
      success: true,
      message: smsResult.message || 'OTP sent successfully to your mobile number',
      phone: cleanPhone,
      otp,
    });
  } catch (error) {
    next(error);
  }
};

// Verify OTP (Registration / Verification Flow)
export const verifyOtp = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone and OTP are required' });
    }

    const cleanPhone = normalizePhoneNumber(phone) || String(phone).replace(/\D/g, '').slice(-10);
    const cleanOtp = String(otp).trim();

    let seller = await Seller.findOne({
      $or: [
        { phone: cleanPhone },
        { phone: `+91${cleanPhone}` },
        { phone: `+91 ${cleanPhone}` },
        { phone: new RegExp(cleanPhone + '$') },
        { phone: String(phone).trim() },
      ]
    });

    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller record not found. Please register first.' });
    }

    const isMock = isMockOtp(cleanOtp);
    const isMatchingOtp = isMock || (seller.otp && String(seller.otp).trim() === cleanOtp);

    if (!isMatchingOtp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP code' });
    }

    if (!isMock && seller.otpExpiry && new Date() > new Date(seller.otpExpiry)) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new OTP.' });
    }

    // Registration fee must be paid (or waived via config as not_required) before OTP completes registration
    if (!hasRegistrationFeeCleared(seller)) {
      return res.status(403).json({
        success: false,
        accountStatus: 'pending_payment',
        registrationFeeStatus: seller.registrationFeeStatus || 'pending',
        message:
          'Seller registration fee payment is pending. Please complete payment before verifying OTP.',
      });
    }

    // Clear OTP after successful verification & set status to under_review
    seller.otp = undefined;
    seller.otpExpiry = undefined;
    seller.isVerified = true;
    if (seller.phone !== cleanPhone) {
      seller.phone = cleanPhone;
    }

    // If seller is not already approved, set status to under_review
    if (seller.accountStatus !== 'approved' && seller.status !== 'approved') {
      seller.accountStatus = 'under_review';
      seller.status = 'pending';
    }

    await seller.save();

    // Critical: Do NOT return a token. Registration OTP verification moves account to UNDER_REVIEW.
    return res.status(200).json({
      success: true,
      message: 'Registration Successful. Your account is currently under review. Once the admin approves your account, you will be able to log in using your mobile number and password.',
      accountStatus: seller.accountStatus,
      status: seller.status,
      seller: {
        id: seller._id,
        phone: seller.phone,
        businessName: seller.businessName,
        accountStatus: seller.accountStatus,
        status: seller.status,
      }
    });
  } catch (error) {
    next(error);
  }
};

// Register Seller (Mandates Password & Dispatches Verification OTP)
export const registerSeller = async (req, res, next) => {
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
      planId,
      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature,
      paymentMethod,
      referralCode
    } = req.body;

    if (!phone || !businessName) {
      return res.status(400).json({ success: false, message: 'Phone and Business Name are required' });
    }

    if (!password || String(password).trim().length < 6) {
      return res.status(400).json({ success: false, message: 'Password is required and must be at least 6 characters long.' });
    }

    const cleanPhone = normalizePhoneNumber(phone);
    if (!cleanPhone || cleanPhone.length !== 10) {
      return res.status(400).json({ success: false, message: 'Please provide a valid 10-digit mobile number' });
    }

    let existingSeller = await Seller.findOne({
      $or: [
        { phone: cleanPhone },
        { phone: `+91${cleanPhone}` },
        { phone: `+91 ${cleanPhone}` },
        { phone: new RegExp(cleanPhone + '$') },
        { phone: String(phone).trim() },
      ]
    });

    if (existingSeller) {
      if (existingSeller.accountStatus === 'approved' || existingSeller.status === 'approved') {
        return res.status(400).json({ success: false, message: 'This mobile number is already registered and approved. Please log in directly.' });
      }
      if (existingSeller.accountStatus === 'under_review') {
        return res.status(400).json({ success: false, message: 'An account with this mobile number is already under review. Please wait for Admin approval.' });
      }
    }

    let processedLogo = '';
    if (storeLogo && typeof storeLogo === 'string' && storeLogo.startsWith('data:image/')) {
      try {
        const uploadRes = await uploadToCloudinary(storeLogo, 'sellers/logos');
        processedLogo = uploadRes.secure_url;
      } catch (err) {
        console.warn('Cloudinary upload failed for seller logo:', err.message);
      }
    }

    let processedGstPhoto = '';
    if (gstPhoto && typeof gstPhoto === 'string' && gstPhoto.startsWith('data:image/')) {
      try {
        const uploadRes = await uploadToCloudinary(gstPhoto, 'sellers/documents');
        processedGstPhoto = uploadRes.secure_url;
      } catch (err) {
        console.warn('Cloudinary upload failed for GST photo:', err.message);
        processedGstPhoto = gstPhoto;
      }
    } else {
      processedGstPhoto = gstPhoto || '';
    }

    let processedPassbookPhoto = '';
    if (bankPassbookPhoto && typeof bankPassbookPhoto === 'string' && bankPassbookPhoto.startsWith('data:image/')) {
      try {
        const uploadRes = await uploadToCloudinary(bankPassbookPhoto, 'sellers/documents');
        processedPassbookPhoto = uploadRes.secure_url;
      } catch (err) {
        console.warn('Cloudinary upload failed for passbook photo:', err.message);
        processedPassbookPhoto = bankPassbookPhoto;
      }
    } else {
      processedPassbookPhoto = bankPassbookPhoto || '';
    }

    const { otp, otpExpiry } = generateOtp();

    // Alternate register path: never default to not_required unless fee config is inactive/zero
    let registrationFeeStatus = 'pending';
    let registrationFeeAmount = 0;
    try {
      const feeConfig = await SellerRegistrationFeeConfig.getOrCreateActiveConfig();
      if (!feeConfig.isActive || Number(feeConfig.amount) <= 0) {
        registrationFeeStatus = 'not_required';
        registrationFeeAmount = 0;
      } else {
        registrationFeeStatus = 'pending';
        registrationFeeAmount = Number(feeConfig.amount) || 0;
      }
    } catch (feeErr) {
      console.warn('[registerSeller] Fee config lookup failed; defaulting fee to pending:', feeErr.message);
      registrationFeeStatus = 'pending';
    }

    // Do not overwrite an already-paid fee when re-submitting incomplete registration
    if (existingSeller && existingSeller.registrationFeeStatus === 'paid') {
      registrationFeeStatus = 'paid';
      registrationFeeAmount = existingSeller.registrationFeeAmount || registrationFeeAmount;
    }

    const sellerData = {
      businessName,
      ownerName,
      phone: cleanPhone,
      password, // Pre-save hook will hash this
      email,
      businessType: businessType || 'Retail',
      storeLogo: processedLogo || storeLogo,
      serviceRadius: serviceRadius ? Math.max(0.1, Math.min(200, Number(serviceRadius) || 5)) : 5,
      gstNumber,
      panNumber,
      fssaiLicense,
      gstPhoto: processedGstPhoto,
      bankPassbookPhoto: processedPassbookPhoto,
      categories: Array.isArray(categories) && categories.length > 0 ? categories : [],
      location: {
        type: 'Point',
        coordinates: (lng != null && lat != null && !isNaN(lng) && !isNaN(lat)) ? [parseFloat(lng), parseFloat(lat)] : [0, 0]
      },
      warehouseLocation: {
        storeAddress: completeAddress,
        city,
        state,
        pincode,
        location: {
          type: 'Point',
          coordinates: (lng != null && lat != null && !isNaN(lng) && !isNaN(lat)) ? [parseFloat(lng), parseFloat(lat)] : [0, 0]
        }
      },
      otp,
      otpExpiry,
      isVerified: false,
      accountStatus: 'pending_otp',
      status: 'pending',
      registrationFeeStatus,
      registrationFeeAmount,
    };

    let seller;
    if (existingSeller) {
      Object.assign(existingSeller, sellerData);
      seller = await existingSeller.save();
    } else {
      seller = await Seller.create(sellerData);
    }

    // Process referral code if provided
    if (referralCode) {
      try {
        await applyReferralCodeAtRegistration({
          referralCode,
          referrerRole: 'seller',
          referredId: seller._id,
          referredRole: 'seller',
          referredPhone: cleanPhone,
          referredName: businessName || ownerName || 'Seller',
        });
      } catch (refErr) {
        console.warn('Referral registration error for seller:', refErr.message);
      }
    }

    // Process Membership if planId provided
    if (planId) {
      try {
        const plan = await SellerMembershipPlan.findById(planId);
        if (plan && plan.status === 'active') {
          if (razorpayPaymentId && razorpayOrderId && razorpaySignature) {
            const generatedSignature = crypto
              .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'secret_placeholder')
              .update(razorpayOrderId + '|' + razorpayPaymentId)
              .digest('hex');

            if (generatedSignature === razorpaySignature) {
              const startDate = new Date();
              const expiryDate = new Date();
              expiryDate.setMonth(expiryDate.getMonth() + plan.durationMonths);

              await SellerMembership.create({
                sellerId: seller._id,
                planId: plan._id,
                planName: plan.name,
                durationType: plan.durationType,
                durationMonths: plan.durationMonths,
                priceAtPurchase: plan.price,
                membershipStatus: 'active',
                paymentStatus: 'paid',
                paymentReference: razorpayPaymentId,
                paymentMethod: 'razorpay',
                transactionId: razorpayOrderId,
                startDate,
                expiryDate
              });
              await Seller.findByIdAndUpdate(seller._id, { membershipStatus: 'active' });
            }
          } else if (paymentMethod === 'cod' || paymentMethod === 'manual') {
            await SellerMembership.create({
              sellerId: seller._id,
              planId: plan._id,
              planName: plan.name,
              durationType: plan.durationType,
              durationMonths: plan.durationMonths,
              priceAtPurchase: plan.price,
              membershipStatus: 'pending_payment',
              paymentStatus: 'pending',
              paymentReference: 'COD',
              paymentMethod: paymentMethod || 'cod',
              transactionId: `COD-${Date.now()}`
            });
            await Seller.findByIdAndUpdate(seller._id, { membershipStatus: 'pending_payment' });
          }
        }
      } catch (memErr) {
        console.warn('Membership processing error during seller registration:', memErr.message);
      }
    }

    // Send OTP SMS
    const smsResult = await sendOtpSMS({
      phone: cleanPhone,
      otp,
      appName: 'Sathi Seller',
      role: 'seller',
    });

    res.status(201).json({
      success: true,
      message: 'Registration details saved. Please verify your mobile number with the OTP sent to complete registration.',
      phone: cleanPhone,
      accountStatus: 'pending_otp',
      seller: {
        id: seller._id,
        phone: seller.phone,
        businessName: seller.businessName,
        accountStatus: 'pending_otp'
      }
    });
  } catch (error) {
    next(error);
  }
};

// Seller Login (Strict Mobile Number + Password + Approval Gate)
export const loginSeller = async (req, res, next) => {
  try {
    const rawPhone = req.body.phone || req.body.mobileNumber;
    const { password } = req.body;

    if (!rawPhone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number and password are required',
      });
    }

    const cleanPhone = normalizePhoneNumber(rawPhone) || String(rawPhone).replace(/\D/g, '').slice(-10);

    const seller = await Seller.findOne({
      $or: [
        { phone: cleanPhone },
        { phone: `+91${cleanPhone}` },
        { phone: `+91 ${cleanPhone}` },
        { phone: new RegExp(cleanPhone + '$') },
        { phone: String(rawPhone).trim() },
      ]
    });

    if (!seller) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mobile number or password',
      });
    }

    // 1. Check Suspended / Rejected Status
    const isApproved = seller.accountStatus === 'approved' || (seller.status === 'approved' && !seller.accountStatus);
    const isRejected = seller.accountStatus === 'rejected' || seller.status === 'rejected';
    const isSuspended = seller.accountStatus === 'suspended' || seller.status === 'suspended';

    if (isSuspended) {
      return res.status(403).json({
        success: false,
        accountStatus: 'suspended',
        message: 'Your seller account has been suspended. Please contact the administrator.',
      });
    }

    if (isRejected) {
      return res.status(403).json({
        success: false,
        accountStatus: 'rejected',
        message: 'Your seller account application has been rejected. Please contact support.',
      });
    }

    // 2. Check Registration Fee Status
    // Legacy sellers created before the fee system may be marked not_required once.
    // Everyone else must have paid (or config-waived not_required) — including approved accounts.
    const feeConfigCutoff = new Date('2026-09-12T12:46:51.865Z');
    const isPreFeeSeller = seller.createdAt && new Date(seller.createdAt) < feeConfigCutoff;

    if (isPreFeeSeller && seller.registrationFeeStatus === 'pending') {
      seller.registrationFeeStatus = 'not_required';
      await Seller.updateOne({ _id: seller._id }, { $set: { registrationFeeStatus: 'not_required' } });
    }

    if (
      !isPreFeeSeller &&
      (seller.registrationFeeStatus === 'pending' || seller.registrationFeeStatus === 'failed')
    ) {
      return res.status(403).json({
        success: false,
        accountStatus: 'pending_payment',
        registrationFeeStatus: seller.registrationFeeStatus,
        message:
          'Seller registration fee payment is pending. Please complete your registration fee payment to proceed.',
      });
    }

    // 3. Check OTP Verification
    if (seller.accountStatus === 'pending_otp' && !seller.isVerified) {
      return res.status(403).json({
        success: false,
        accountStatus: 'pending_otp',
        message: 'Please complete your mobile number OTP verification before logging in.',
      });
    }

    // 4. Check Under Review Status
    if (!isApproved) {
      return res.status(403).json({
        success: false,
        accountStatus: 'under_review',
        message: 'Your seller account is currently under review. You will be able to log in once your account is approved by the admin.',
      });
    }

    // 5. Verify Password
    if (!seller.password) {
      return res.status(200).json({
        success: false,
        requiresPasswordSetup: true,
        message: 'A password has not been set for your account yet. Please set your password using OTP verification.',
      });
    }

    const isMatch = await seller.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mobile number or password',
      });
    }

    // Generate JWT Token
    const token = generateToken({ id: seller._id, phone: seller.phone, role: seller.role || 'seller' });

    // Membership verification check
    const now = new Date();
    const activeMembership = await SellerMembership.findOne({
      sellerId: seller._id,
      membershipStatus: 'active',
      expiryDate: { $gt: now },
    });

    // Auto-expire stale memberships
    await SellerMembership.updateMany(
      { sellerId: seller._id, membershipStatus: 'active', expiryDate: { $lte: now } },
      { $set: { membershipStatus: 'expired' } }
    );

    const sellerSafe = seller.toObject();
    delete sellerSafe.password;
    delete sellerSafe.otp;
    delete sellerSafe.otpExpiry;

    // Already-registered (legacy) sellers are exempt from mandatory subscription
    const membershipRequired = isMembershipRequiredForSeller(seller);

    if (membershipRequired && !activeMembership) {
      const pendingMembership = await SellerMembership.findOne({
        sellerId: seller._id,
        membershipStatus: 'pending_payment',
      });
      const membershipStatus = pendingMembership ? 'pending_payment' : 'none';

      return res.status(200).json({
        success: true,
        requiresMembership: true,
        membershipRequired: true,
        membershipStatus,
        message: 'Membership purchase required to activate your seller account.',
        token,
        seller: sellerSafe,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Login successful',
      requiresMembership: false,
      membershipRequired,
      token,
      seller: sellerSafe,
    });
  } catch (error) {
    next(error);
  }
};

// Get Seller Profile
export const getSellerProfile = async (req, res, next) => {
  try {
    const seller = await Seller.findById(req.user.id).select('-password -otp -otpExpiry');
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller profile not found' });
    }

    const membership = await SellerMembership.findOne({
      sellerId: seller._id,
      membershipStatus: { $in: ['active', 'pending_payment'] },
    }).populate('planId').sort({ createdAt: -1 });

    const sellerObj = seller.toObject();
    sellerObj.membership = membership || null;

    res.status(200).json({
      success: true,
      seller: sellerObj,
    });
  } catch (error) {
    next(error);
  }
};

// Update Seller Profile
export const updateSellerProfile = async (req, res, next) => {
  try {
    const {
      businessName,
      ownerName,
      email,
      phone,
      businessType,
      storeLogo,
      serviceRadius,
      tagline,
      gstNumber,
      panNumber,
      fssaiLicense,
      gstPhoto,
      bankPassbookPhoto,
      bankName,
      accountNumber,
      ifscCode,
      categories,
      storeAddress,
      city,
      state,
      pincode,
      isOnline,
    } = req.body;

    const seller = await Seller.findById(req.user.id);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller profile not found' });
    }

    if (isOnline !== undefined) seller.isOnline = Boolean(isOnline);

    if (businessName !== undefined) seller.businessName = businessName;
    if (ownerName !== undefined) seller.ownerName = ownerName;
    if (email !== undefined) seller.email = email;
    if (businessType !== undefined) seller.businessType = businessType;

    // Allow phone update for the logged-in seller only (must stay unique)
    if (phone !== undefined && phone !== null && String(phone).trim() !== '') {
      const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
      if (cleanPhone.length !== 10) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid 10-digit mobile number',
        });
      }
      if (cleanPhone !== seller.phone) {
        const phoneTaken = await Seller.findOne({
          _id: { $ne: seller._id },
          $or: [
            { phone: cleanPhone },
            { phone: `+91${cleanPhone}` },
            { phone: `+91 ${cleanPhone}` },
          ],
        }).select('_id');
        if (phoneTaken) {
          return res.status(400).json({
            success: false,
            message: 'This mobile number is already registered to another seller account',
          });
        }
        seller.phone = cleanPhone;
      }
    }
    
    if (storeLogo && typeof storeLogo === 'string' && storeLogo.startsWith('data:image/')) {
      try {
        const uploadRes = await uploadToCloudinary(storeLogo, 'sellers/logos');
        seller.storeLogo = uploadRes.secure_url;
      } catch (err) {
        console.warn('Cloudinary upload failed for seller logo:', err.message);
        seller.storeLogo = storeLogo;
      }
    } else if (storeLogo !== undefined) {
      seller.storeLogo = storeLogo;
    }

    if (gstPhoto && typeof gstPhoto === 'string' && gstPhoto.startsWith('data:image/')) {
      try {
        const uploadRes = await uploadToCloudinary(gstPhoto, 'sellers/documents');
        seller.gstPhoto = uploadRes.secure_url;
      } catch (err) {
        console.warn('Cloudinary upload failed for GST photo:', err.message);
        seller.gstPhoto = gstPhoto;
      }
    } else if (gstPhoto !== undefined) {
      seller.gstPhoto = gstPhoto;
    }

    if (bankPassbookPhoto && typeof bankPassbookPhoto === 'string' && bankPassbookPhoto.startsWith('data:image/')) {
      try {
        const uploadRes = await uploadToCloudinary(bankPassbookPhoto, 'sellers/documents');
        seller.bankPassbookPhoto = uploadRes.secure_url;
      } catch (err) {
        console.warn('Cloudinary upload failed for passbook photo:', err.message);
        seller.bankPassbookPhoto = bankPassbookPhoto;
      }
    } else if (bankPassbookPhoto !== undefined) {
      seller.bankPassbookPhoto = bankPassbookPhoto;
    }

    if (serviceRadius !== undefined) {
      seller.serviceRadius = Math.max(0.1, Math.min(200, Number(serviceRadius) || 5));
    }
    if (tagline !== undefined) seller.tagline = tagline;
    if (gstNumber !== undefined) seller.gstNumber = gstNumber;
    if (panNumber !== undefined) seller.panNumber = panNumber;
    if (fssaiLicense !== undefined) seller.fssaiLicense = fssaiLicense;
    if (bankName !== undefined) seller.bankName = bankName;
    if (accountNumber !== undefined) seller.accountNumber = accountNumber;
    if (ifscCode !== undefined) seller.ifscCode = ifscCode;
    if (categories !== undefined) seller.categories = categories;

    const {
      lat,
      lng,
      area,
      latitude,
      longitude,
    } = req.body;

    const finalLat = lat !== undefined ? lat : latitude;
    const finalLng = lng !== undefined ? lng : longitude;

    if (
      storeAddress !== undefined ||
      city !== undefined ||
      state !== undefined ||
      pincode !== undefined ||
      area !== undefined ||
      finalLat !== undefined ||
      finalLng !== undefined
    ) {
      const currentCoords = seller.warehouseLocation?.location?.coordinates || seller.location?.coordinates || [0, 0];
      const newCoords = (finalLat != null && finalLng != null && !isNaN(finalLat) && !isNaN(finalLng))
        ? [parseFloat(finalLng), parseFloat(finalLat)]
        : currentCoords;

      seller.location = {
        type: 'Point',
        coordinates: newCoords,
      };

      seller.warehouseLocation = {
        ...seller.warehouseLocation,
        storeAddress: storeAddress !== undefined ? storeAddress : seller.warehouseLocation?.storeAddress,
        city: city !== undefined ? city : seller.warehouseLocation?.city,
        state: state !== undefined ? state : seller.warehouseLocation?.state,
        pincode: pincode !== undefined ? pincode : seller.warehouseLocation?.pincode,
        area: area !== undefined ? area : seller.warehouseLocation?.area,
        location: {
          type: 'Point',
          coordinates: newCoords,
        },
      };
    }

    await seller.save();

    invalidateProductsCache();
    invalidatePublicSellersCache();

    const sellerSafe = seller.toObject();
    delete sellerSafe.password;
    delete sellerSafe.otp;
    delete sellerSafe.otpExpiry;

    res.status(200).json({
      success: true,
      message: 'Seller profile updated successfully',
      seller: sellerSafe,
    });
  } catch (error) {
    next(error);
  }
};

// Toggle Seller Online / Offline Status
export const toggleOnlineStatus = async (req, res, next) => {
  try {
    const seller = await Seller.findById(req.user.id);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller profile not found' });
    }

    const { isOnline } = req.body;
    seller.isOnline = isOnline !== undefined ? Boolean(isOnline) : !seller.isOnline;

    await seller.save();

    invalidateProductsCache();
    invalidatePublicSellersCache();

    res.status(200).json({
      success: true,
      message: `Store is now ${seller.isOnline ? 'ONLINE' : 'OFFLINE'}`,
      isOnline: seller.isOnline,
      seller,
    });
  } catch (error) {
    next(error);
  }
};

// Reset / Set Password (Using Phone + OTP Verification for new & existing legacy sellers)
export const resetPassword = async (req, res, next) => {
  try {
    const rawPhone = req.body.phone || req.body.mobileNumber;
    const { otp, newPassword, password } = req.body;
    const targetPassword = newPassword || password;

    if (!rawPhone || !otp || !targetPassword) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number, OTP, and new password are required',
      });
    }

    if (String(targetPassword).trim().length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    const cleanPhone = normalizePhoneNumber(rawPhone) || String(rawPhone).replace(/\D/g, '').slice(-10);
    const cleanOtp = String(otp).trim();

    const seller = await Seller.findOne({
      $or: [
        { phone: cleanPhone },
        { phone: `+91${cleanPhone}` },
        { phone: `+91 ${cleanPhone}` },
        { phone: new RegExp(cleanPhone + '$') },
        { phone: String(rawPhone).trim() },
      ]
    });

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller account with this mobile number was not found. Please register first.',
      });
    }

    // Verify OTP
    const isMock = isMockOtp(cleanOtp);
    const isMatchingOtp = isMock || (seller.otp && String(seller.otp).trim() === cleanOtp);

    if (!isMatchingOtp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP code. Please check and try again.',
      });
    }

    if (!isMock && seller.otpExpiry && new Date() > new Date(seller.otpExpiry)) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new OTP.',
      });
    }

    // Set new password (will be hashed by pre-save hook)
    seller.password = targetPassword;
    seller.otp = undefined;
    seller.otpExpiry = undefined;
    seller.isVerified = true;
    if (seller.phone !== cleanPhone) {
      seller.phone = cleanPhone;
    }

    await seller.save();

    const isApproved = seller.accountStatus === 'approved' || (seller.status === 'approved' && !seller.accountStatus);
    const isRejected = seller.accountStatus === 'rejected' || seller.status === 'rejected';
    const isSuspended = seller.accountStatus === 'suspended' || seller.status === 'suspended';

    if (isSuspended) {
      return res.status(403).json({
        success: false,
        accountStatus: 'suspended',
        message: 'Password updated, but your account has been suspended. Please contact support.',
      });
    }

    if (isRejected) {
      return res.status(403).json({
        success: false,
        accountStatus: 'rejected',
        message: 'Password updated, but your account application has been rejected. Please contact support.',
      });
    }

    if (!isApproved) {
      return res.status(200).json({
        success: true,
        accountStatus: seller.accountStatus || 'under_review',
        isApproved: false,
        message: 'Password set successfully! Your account is currently under review. You can log in once approved by the admin.',
      });
    }

    // If approved, generate token and return login session directly
    const token = generateToken({ id: seller._id, phone: seller.phone, role: seller.role || 'seller' });

    const sellerSafe = seller.toObject();
    delete sellerSafe.password;
    delete sellerSafe.otp;
    delete sellerSafe.otpExpiry;

    return res.status(200).json({
      success: true,
      isApproved: true,
      message: 'Password set successfully! You are now logged in.',
      token,
      seller: sellerSafe,
    });
  } catch (error) {
    next(error);
  }
};


