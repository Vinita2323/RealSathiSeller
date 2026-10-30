import jwt from 'jsonwebtoken';
import User from '../models/User.model.js';
import { extractBearerOrCookieToken } from '../utils/adminAuthCookie.js';

export const protect = (...requiredRoles) => {
  return async (req, res, next) => {
    try {
      const token = extractBearerOrCookieToken(req);

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Not authorized, no token provided',
        });
      }

      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'sathiseller_secret'
      );

      if (requiredRoles && requiredRoles.length > 0) {
        const roles = requiredRoles.flat().filter(Boolean);
        if (roles.length > 0) {
          const isAllowed = roles.includes(decoded.role);

          if (!isAllowed) {
            const roleStr = roles.join(' or ');
            return res.status(403).json({
              success: false,
              message: `Forbidden: Access restricted to ${roleStr}`,
            });
          }
        }
      }

      // Active account enforcement: check if customer account is blocked
      if (decoded.role === 'user' && decoded.id) {
        const userDoc = await User.findById(decoded.id).select('isBlocked status blockReason').lean();
        if (userDoc && (userDoc.isBlocked || userDoc.status === 'blocked' || userDoc.status === 'suspended')) {
          return res.status(403).json({
            success: false,
            message: userDoc.blockReason
              ? `Account suspended: ${userDoc.blockReason}`
              : 'Your account has been suspended by Admin. Please contact customer support.',
            isBlocked: true,
          });
        }
      }

      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed',
      });
    }
  };
};
