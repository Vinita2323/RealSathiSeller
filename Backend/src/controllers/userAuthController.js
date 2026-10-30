import User from '../models/User.model.js';
import { generateOtp, isMockOtp, MOCK_OTP } from '../utils/generateOtp.js';
import { generateToken } from '../utils/generateToken.js';
import { sendOtpSMS, normalizePhoneNumber } from '../services/smsIndiaHubService.js';

// Send OTP
export const sendOtp = async (req, res, next) => {
  try {
    const rawPhone = req.body.phone;

    if (!rawPhone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const cleanPhone = normalizePhoneNumber(rawPhone);
    if (!cleanPhone || cleanPhone.length !== 10) {
      return res.status(400).json({ success: false, message: 'Please provide a valid 10-digit Indian mobile number' });
    }

    const { otp, otpExpiry } = generateOtp();

    let user = await User.findOne({
      $or: [
        { phone: cleanPhone },
        { phone: `+91${cleanPhone}` },
        { phone: `+91 ${cleanPhone}` },
        { phone: new RegExp(cleanPhone + '$') },
      ]
    });

    if (!user) {
      user = await User.create({ phone: cleanPhone, otp, otpExpiry });
    } else {
      if (user.isBlocked || user.status === 'blocked' || user.status === 'suspended') {
        return res.status(403).json({
          success: false,
          message: user.blockReason
            ? `Your account has been suspended by Admin. Reason: ${user.blockReason}`
            : 'Your account has been suspended by Administrator. Please contact customer support.',
          isBlocked: true,
        });
      }
      user.otp = otp;
      user.otpExpiry = otpExpiry;
      if (user.phone !== cleanPhone) {
        user.phone = cleanPhone;
      }
      await user.save();
    }

    // Dispatch OTP through centralized SMS India Hub Service
    const smsResult = await sendOtpSMS({
      phone: cleanPhone,
      otp,
      appName: 'Sathi Seller',
      role: 'user',
    });

    if (!smsResult.success) {
      console.warn(`[UserAuth] SMS delivery notice (${smsResult.message || 'Sandbox'}). Mock OTP: ${otp}`);
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

// Verify OTP
export const verifyOtp = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone and OTP are required' });
    }

    const cleanPhone = normalizePhoneNumber(phone) || String(phone).replace(/\D/g, '').slice(-10);
    const cleanOtp = String(otp).trim();
    const isMock = isMockOtp(cleanOtp);

    let user = await User.findOne({
      $or: [
        { phone: cleanPhone },
        { phone: `+91${cleanPhone}` },
        { phone: `+91 ${cleanPhone}` },
        { phone: new RegExp(cleanPhone + '$') },
        { phone: String(phone).trim() },
      ]
    });

    if (!user) {
      if (isMock) {
        // Auto-create user for frictionless mock OTP testing
        user = await User.create({
          phone: cleanPhone,
          isVerified: true,
          role: 'user',
        });
      } else {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
    }

    if (user.isBlocked || user.status === 'blocked' || user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: user.blockReason
          ? `Your account has been suspended by Admin. Reason: ${user.blockReason}`
          : 'Your account has been suspended by Administrator. Please contact customer support.',
        isBlocked: true,
      });
    }

    const isMatchingOtp = isMock || (user.otp && String(user.otp).trim() === cleanOtp);

    if (!isMatchingOtp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP code' });
    }

    if (!isMock && user.otpExpiry && new Date() > new Date(user.otpExpiry)) {
      return res.status(400).json({ success: false, message: 'OTP has expired' });
    }

    // Clear OTP after successful verification
    user.otp = undefined;
    user.otpExpiry = undefined;
    user.isVerified = true;
    if (user.phone !== cleanPhone && cleanPhone) {
      user.phone = cleanPhone;
    }
    await user.save();

    const token = generateToken({ id: user._id, phone: user.phone, role: user.role });

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      token,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email || '',
        phone: user.phone,
        role: user.role,
        addresses: user.addresses || [],
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get User Profile
export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-otp -otpExpiry');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

// Update User Profile
export const updateProfile = async (req, res, next) => {
  try {
    const { name, email, phone, city } = req.body;
    const updateFields = {};
    if (name !== undefined) updateFields.name = name;
    if (email !== undefined) updateFields.email = email;
    if (phone !== undefined) updateFields.phone = phone;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { new: true, runValidators: false }
    ).select('-otp -otpExpiry');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, message: 'Profile updated successfully', user });
  } catch (error) {
    next(error);
  }
};
