import Admin from '../models/Admin.model.js';
import { generateToken } from '../utils/generateToken.js';
import {
  ADMIN_REMEMBER_TTL,
  ADMIN_SESSION_TTL,
  SUPER_ADMIN_AUTH_COOKIE,
  clearAdminAuthCookie,
  setAdminAuthCookie,
} from '../utils/adminAuthCookie.js';

// Super Admin Login
export const superAdminLogin = async (req, res, next) => {
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

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    if (admin.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Standard administrators cannot access the Super Admin Financial Panel',
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
        role: 'super_admin',
        rememberMe: remember,
      },
      remember ? ADMIN_REMEMBER_TTL : ADMIN_SESSION_TTL
    );

    setAdminAuthCookie(res, token, remember, SUPER_ADMIN_AUTH_COOKIE);

    res.status(200).json({
      success: true,
      message: 'Super Admin financial authentication successful',
      token,
      rememberMe: remember,
      superAdmin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const superAdminLogout = async (req, res, next) => {
  try {
    clearAdminAuthCookie(res, SUPER_ADMIN_AUTH_COOKIE);
    res.status(200).json({
      success: true,
      message: 'Super Admin logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

// Super Admin Profile Check
export const getSuperAdminProfile = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized',
      });
    }

    const admin = await Admin.findById(req.user.id).select('-password');
    if (!admin || admin.role !== 'super_admin') {
      return res.status(401).json({
        success: false,
        message: 'Super Admin session is invalid or expired',
      });
    }

    res.status(200).json({
      success: true,
      superAdmin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        createdAt: admin.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};
