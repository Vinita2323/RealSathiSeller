import Admin from '../models/Admin.model.js';
import { generateToken } from '../utils/generateToken.js';
import {
  ADMIN_AUTH_COOKIE,
  ADMIN_REMEMBER_TTL,
  ADMIN_SESSION_TTL,
  clearAdminAuthCookie,
  setAdminAuthCookie,
} from '../utils/adminAuthCookie.js';

const buildAdminPayload = (admin) => {
  const nameParts = (admin.name || '').split(' ');
  const firstName = admin.firstName || nameParts[0] || '';
  const lastName = admin.lastName || nameParts.slice(1).join(' ') || '';

  return {
    id: admin._id,
    _id: admin._id,
    name: admin.name || `${firstName} ${lastName}`.trim() || 'Administrator',
    firstName,
    lastName,
    email: admin.email,
    mobile: admin.mobile || '',
    address: {
      addressLine1: admin.address?.addressLine1 || '',
      addressLine2: admin.address?.addressLine2 || '',
      landmark: admin.address?.landmark || '',
      city: admin.address?.city || '',
      state: admin.address?.state || '',
      pincode: admin.address?.pincode || '',
      lat: admin.address?.lat ?? null,
      lng: admin.address?.lng ?? null,
    },
    role: admin.role,
    createdAt: admin.createdAt,
  };
};

// Admin Login with Email & Password
export const adminLogin = async (req, res, next) => {
  try {
    const { email, password, rememberMe = false } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password',
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const admin = await Admin.findOne({ email: cleanEmail });

    if (!admin || !['admin', 'super_admin'].includes(admin.role)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const isMatch = await admin.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const remember = Boolean(rememberMe);
    const token = generateToken(
      {
        id: admin._id,
        email: admin.email,
        role: admin.role,
        rememberMe: remember,
      },
      remember ? ADMIN_REMEMBER_TTL : ADMIN_SESSION_TTL
    );

    setAdminAuthCookie(res, token, remember, ADMIN_AUTH_COOKIE);

    res.status(200).json({
      success: true,
      message: 'Admin login successful',
      // Token is also returned for legacy clients; frontend must not persist the password
      // and should prefer the HttpOnly cookie for authorization.
      token,
      rememberMe: remember,
      admin: buildAdminPayload(admin),
    });
  } catch (error) {
    next(error);
  }
};

export const adminLogout = async (req, res, next) => {
  try {
    clearAdminAuthCookie(res, ADMIN_AUTH_COOKIE);
    res.status(200).json({
      success: true,
      message: 'Admin logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Get Admin Profile — requires a valid authenticated session
export const getAdminProfile = async (req, res, next) => {
  try {
    const adminId = req.user?.id || req.user?._id;
    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized',
      });
    }

    const admin = await Admin.findById(adminId).select('-password');
    if (!admin || !['admin', 'super_admin'].includes(admin.role)) {
      return res.status(401).json({
        success: false,
        message: 'Admin session is invalid or expired',
      });
    }

    res.status(200).json({
      success: true,
      admin: buildAdminPayload(admin),
    });
  } catch (error) {
    next(error);
  }
};

// Update Admin Profile
export const updateAdminProfile = async (req, res, next) => {
  try {
    const adminId = req.user?.id || req.user?._id;
    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized',
      });
    }

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin account not found',
      });
    }

    const { firstName, lastName, name, email, mobile, password, newPassword, address } = req.body;

    if (address !== undefined) {
      const a = address || {};
      const clean = (v, max = 200) => String(v ?? '').trim().slice(0, max);
      const num = (v, lo, hi) => {
        if (v === '' || v === null || v === undefined) return null;
        const n = Number(v);
        return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
      };
      const next = {
        addressLine1: clean(a.addressLine1),
        addressLine2: clean(a.addressLine2),
        landmark: clean(a.landmark),
        city: clean(a.city, 80),
        state: clean(a.state, 80),
        pincode: clean(a.pincode, 10),
        lat: num(a.lat, -90, 90),
        lng: num(a.lng, -180, 180),
      };
      const anyText = [next.addressLine1, next.addressLine2, next.landmark, next.city, next.state, next.pincode].some(Boolean);
      if (anyText && (!next.addressLine1 || !next.city)) {
        return res.status(400).json({ success: false, message: 'Please enter the address line and city, or clear the whole address.' });
      }
      if (next.pincode && !/^[0-9]{6}$/.test(next.pincode)) {
        return res.status(400).json({ success: false, message: 'Pincode must be 6 digits.' });
      }
      admin.address = next;
    }

    if (firstName !== undefined) admin.firstName = String(firstName).trim();
    if (lastName !== undefined) admin.lastName = String(lastName).trim();

    if (name !== undefined && name.trim()) {
      admin.name = name.trim();
    } else if (firstName !== undefined || lastName !== undefined) {
      admin.name = `${admin.firstName || ''} ${admin.lastName || ''}`.trim() || 'Administrator';
    }

    if (mobile !== undefined) {
      admin.mobile = String(mobile).trim();
    }

    if (email && email.trim()) {
      const cleanEmail = email.toLowerCase().trim();
      if (cleanEmail !== admin.email) {
        const existing = await Admin.findOne({ email: cleanEmail, _id: { $ne: admin._id } });
        if (existing) {
          return res.status(400).json({
            success: false,
            message: 'An admin account with this email already exists',
          });
        }
        admin.email = cleanEmail;
      }
    }

    const pwdToSet = newPassword || password;
    if (pwdToSet && typeof pwdToSet === 'string' && pwdToSet.trim().length >= 4) {
      admin.password = pwdToSet.trim();
    }

    await admin.save();

    const remember = Boolean(req.user?.rememberMe);
    const token = generateToken(
      {
        id: admin._id,
        email: admin.email,
        role: admin.role,
        rememberMe: remember,
      },
      remember ? ADMIN_REMEMBER_TTL : ADMIN_SESSION_TTL
    );

    setAdminAuthCookie(res, token, remember, ADMIN_AUTH_COOKIE);

    res.status(200).json({
      success: true,
      message: 'Admin profile updated successfully',
      token,
      admin: buildAdminPayload(admin),
    });
  } catch (error) {
    next(error);
  }
};
