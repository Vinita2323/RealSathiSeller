import Captain from '../models/Captain.model.js';
import { generateOtp, isMockOtp } from '../utils/generateOtp.js';
import { generateToken } from '../utils/generateToken.js';
import CaptainMembership from '../models/CaptainMembership.model.js';
import { sendOtpSMS, normalizePhoneNumber } from '../services/smsIndiaHubService.js';
import { uploadToCloudinary } from '../config/cloudinary.js';
import { applyReferralCodeAtRegistration } from './referralController.js';

const processDocImage = async (imgStr, docName = 'doc') => {
  if (!imgStr) return '';
  if (typeof imgStr === 'string' && (imgStr.startsWith('http://') || imgStr.startsWith('https://'))) {
    return imgStr;
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
      console.warn(`[CaptainAuth] Cloudinary upload for ${docName} bypassed/fallback:`, err.message);
    }
  }
  return imgStr;
};

// Register Captain (Mandates Password & Dispatches Verification OTP)
export const registerCaptain = async (req, res, next) => {
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
      panCardNumber,
      referralCode,
    } = req.body;

    const rawPhone = mobileNumber || req.body.phone;

    if (!rawPhone || !fullName) {
      return res.status(400).json({ success: false, message: 'Full Name and Mobile Number are required.' });
    }

    if (!password || String(password).trim().length < 6) {
      return res.status(400).json({ success: false, message: 'Password is required and must be at least 6 characters long.' });
    }

    const phone = normalizePhoneNumber(rawPhone) || rawPhone;

    let captain = await Captain.findOne({
      $or: [
        { phone },
        { phone: `+91${phone}` },
        { phone: `+91 ${phone}` },
        { phone: new RegExp(phone + '$') },
        { phone: String(rawPhone).trim() },
      ]
    });

    if (captain) {
      if (captain.accountStatus === 'approved' || captain.status === 'approved') {
        return res.status(400).json({
          success: false,
          message: 'An account with this mobile number is already registered and approved. Please log in directly.',
        });
      }
      if (captain.accountStatus === 'under_review') {
        return res.status(400).json({
          success: false,
          message: 'An application with this mobile number is already under review. Please wait for Admin approval.',
        });
      }
    }

    const { otp, otpExpiry } = generateOtp();

      const rawDocs = req.body.documents || {};
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

      const captainData = {
        name: fullName,
        phone,
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
    };

    if (captain) {
      Object.assign(captain, captainData);
      await captain.save();
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
          referredPhone: phone,
          referredName: fullName || 'Captain',
        });
      } catch (refErr) {
        console.warn('Referral registration error for captain:', refErr.message);
      }
    }

    console.log(`[CAPTAIN REGISTER] Registered Captain "${fullName}" (${phone}) - Status: PENDING OTP Verification`);

    // Dispatch OTP through SMS
    const smsResult = await sendOtpSMS({
      phone,
      otp,
      appName: 'Sathi Seller',
      role: 'captain',
    });

    res.status(201).json({
      success: true,
      message: 'Registration details saved. Please verify your mobile number with the OTP sent to complete registration.',
      phone,
      accountStatus: 'pending_otp',
      otp: process.env.NODE_ENV !== 'production' ? otp : undefined,
      captain: {
        id: captain._id,
        name: captain.name,
        phone: captain.phone,
        accountStatus: captain.accountStatus,
        status: captain.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Send / Resend OTP
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

    let captain = await Captain.findOne({
      $or: [
        { phone: cleanPhone },
        { phone: `+91${cleanPhone}` },
        { phone: `+91 ${cleanPhone}` },
        { phone: new RegExp(cleanPhone + '$') },
        { phone: String(rawPhone).trim() },
      ]
    });

    if (!captain) {
      if (isPasswordReset) {
        return res.status(404).json({
          success: false,
          message: 'No captain account found with this mobile number. Please register first.',
        });
      }
      captain = await Captain.create({
        phone: cleanPhone,
        otp,
        otpExpiry,
        accountStatus: 'pending_otp',
        status: 'pending',
        isVerified: false
      });
    } else {
      captain.otp = otp;
      captain.otpExpiry = otpExpiry;
      if (captain.phone !== cleanPhone) {
        captain.phone = cleanPhone;
      }
      await captain.save();
    }

    // Dispatch OTP through centralized SMS India Hub Service
    const smsResult = await sendOtpSMS({
      phone: cleanPhone,
      otp,
      appName: 'Sathi Seller',
      role: 'captain',
    });

    if (!smsResult.success) {
      console.warn(`[CaptainAuth] SMS dispatch notice (${smsResult.message || 'Sandbox'}). Mock OTP: ${otp}`);
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

    const captain = await Captain.findOne({
      $or: [
        { phone: cleanPhone },
        { phone: `+91${cleanPhone}` },
        { phone: `+91 ${cleanPhone}` },
        { phone: new RegExp(cleanPhone + '$') },
        { phone: String(phone).trim() },
      ]
    });

    if (!captain) {
      return res.status(404).json({ success: false, message: 'Captain account not found. Please register first.' });
    }

    const isMock = isMockOtp(cleanOtp);
    const isMatchingOtp = isMock || (captain.otp && String(captain.otp).trim() === cleanOtp);

    if (!isMatchingOtp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP code' });
    }

    if (!isMock && captain.otpExpiry && new Date() > new Date(captain.otpExpiry)) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new OTP.' });
    }

    // Clear OTP after successful verification & set status to under_review
    captain.otp = undefined;
    captain.otpExpiry = undefined;
    captain.isVerified = true;
    if (captain.phone !== cleanPhone) {
      captain.phone = cleanPhone;
    }

    // If captain is not already approved, set status to under_review
    if (captain.accountStatus !== 'approved' && captain.status !== 'approved') {
      captain.accountStatus = 'under_review';
      captain.status = 'pending';
    }

    await captain.save();

    // Critical: Do NOT return a token. Registration OTP verification moves account to UNDER_REVIEW.
    return res.status(200).json({
      success: true,
      message: 'Registration Successful. Your account is currently under review. Once the admin approves your account, you will be able to log in using your mobile number and password.',
      accountStatus: captain.accountStatus,
      status: captain.status,
      captain: {
        id: captain._id,
        name: captain.name,
        phone: captain.phone,
        accountStatus: captain.accountStatus,
        status: captain.status,
      }
    });
  } catch (error) {
    next(error);
  }
};

// Captain Login (Strict Mobile Number + Password + Approval Gate)
export const loginCaptain = async (req, res, next) => {
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

    const captain = await Captain.findOne({
      $or: [
        { phone: cleanPhone },
        { phone: `+91${cleanPhone}` },
        { phone: `+91 ${cleanPhone}` },
        { phone: new RegExp(cleanPhone + '$') },
        { phone: String(rawPhone).trim() },
      ]
    });

    if (!captain) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mobile number or password',
      });
    }

    // 1. Check Pending OTP Status
    if (captain.accountStatus === 'pending_otp' && !captain.isVerified) {
      return res.status(403).json({
        success: false,
        accountStatus: 'pending_otp',
        message: 'Please complete your mobile number OTP verification before logging in.',
      });
    }

    // 2. Check Under Review Status
    const isApproved = captain.accountStatus === 'approved' || (captain.status === 'approved' && !captain.accountStatus);
    const isRejected = captain.accountStatus === 'rejected' || captain.status === 'rejected';
    const isSuspended = captain.accountStatus === 'suspended' || captain.status === 'suspended';

    if (isSuspended) {
      return res.status(403).json({
        success: false,
        accountStatus: 'suspended',
        message: 'Your captain account has been suspended. Please contact the administrator.',
      });
    }

    if (isRejected) {
      return res.status(403).json({
        success: false,
        accountStatus: 'rejected',
        message: 'Your captain account application has been rejected. Please contact support.',
      });
    }

    if (!isApproved) {
      return res.status(403).json({
        success: false,
        accountStatus: 'under_review',
        message: 'Your captain account is currently under review. You will be able to log in once your account is approved by the admin.',
      });
    }

    // 3. Verify Password
    if (!captain.password) {
      return res.status(200).json({
        success: false,
        requiresPasswordSetup: true,
        message: 'A password has not been set for your account yet. Please set your password using OTP verification.',
      });
    }

    const isMatch = await captain.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mobile number or password',
      });
    }

    // Generate JWT Token
    const token = generateToken({ id: captain._id, phone: captain.phone, role: captain.role || 'captain' });

    // Membership verification check
    const now = new Date();
    const activeMembership = await CaptainMembership.findOne({
      captainId: captain._id,
      membershipStatus: 'active',
      expiryDate: { $gt: now },
    });

    // Auto-expire stale memberships
    await CaptainMembership.updateMany(
      { captainId: captain._id, membershipStatus: 'active', expiryDate: { $lte: now } },
      { $set: { membershipStatus: 'expired' } }
    );

    const captainSafe = captain.toObject();
    delete captainSafe.password;
    delete captainSafe.otp;
    delete captainSafe.otpExpiry;
    // Strip large base64 documents from auth response to keep payload tiny and prevent localStorage quota errors
    delete captainSafe.documents;

    if (!activeMembership) {
      const pendingMembership = await CaptainMembership.findOne({
        captainId: captain._id,
        membershipStatus: 'pending_payment',
      });
      const membershipStatus = pendingMembership ? 'pending_payment' : 'none';

      return res.status(200).json({
        success: true,
        requiresMembership: true,
        membershipStatus,
        message: 'Membership purchase required to activate your captain account.',
        token,
        captain: captainSafe,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      captain: captainSafe,
    });
  } catch (error) {
    next(error);
  }
};

// Reset / Set Password (Using Phone + OTP Verification for new & existing legacy captains)
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

    const captain = await Captain.findOne({
      $or: [
        { phone: cleanPhone },
        { phone: `+91${cleanPhone}` },
        { phone: `+91 ${cleanPhone}` },
        { phone: new RegExp(cleanPhone + '$') },
        { phone: String(rawPhone).trim() },
      ]
    });

    if (!captain) {
      return res.status(404).json({
        success: false,
        message: 'Captain account with this mobile number was not found. Please register first.',
      });
    }

    // Verify OTP
    const isMock = isMockOtp(cleanOtp);
    const isMatchingOtp = isMock || (captain.otp && String(captain.otp).trim() === cleanOtp);

    if (!isMatchingOtp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP code. Please check and try again.',
      });
    }

    if (!isMock && captain.otpExpiry && new Date() > new Date(captain.otpExpiry)) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new OTP.',
      });
    }

    // Set new password (will be hashed by pre-save hook)
    captain.password = targetPassword;
    captain.otp = undefined;
    captain.otpExpiry = undefined;
    captain.isVerified = true;
    if (captain.phone !== cleanPhone) {
      captain.phone = cleanPhone;
    }

    await captain.save();

    const isApproved = captain.accountStatus === 'approved' || (captain.status === 'approved' && !captain.accountStatus);
    const isRejected = captain.accountStatus === 'rejected' || captain.status === 'rejected';
    const isSuspended = captain.accountStatus === 'suspended' || captain.status === 'suspended';

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
        accountStatus: captain.accountStatus || 'under_review',
        isApproved: false,
        message: 'Password set successfully! Your account is currently under review. You can log in once approved by the admin.',
      });
    }

    // If approved, generate token and return login session directly
    const token = generateToken({ id: captain._id, phone: captain.phone, role: captain.role || 'captain' });

    const captainSafe = captain.toObject();
    delete captainSafe.password;
    delete captainSafe.otp;
    delete captainSafe.otpExpiry;
    // Strip large base64 documents from auth response to keep payload tiny and prevent localStorage quota errors
    delete captainSafe.documents;

    return res.status(200).json({
      success: true,
      isApproved: true,
      message: 'Password set successfully! You are now logged in.',
      token,
      captain: captainSafe,
    });
  } catch (error) {
    next(error);
  }
};


