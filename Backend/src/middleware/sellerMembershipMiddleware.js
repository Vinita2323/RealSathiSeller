import { evaluateSellerStorefrontEligibility } from '../utils/sellerEligibility.js';

/**
 * Blocks seller API actions that require an active subscription + paid registration fee + approval.
 * Use on product/order-selling mutations. Do NOT apply to membership purchase/renew or auth/profile.
 *
 * Note: Existing order status updates may still be allowed by omitting this middleware on those routes
 * so in-flight orders can be completed after expiry.
 */
export const requireSellerSellingEligibility = (options = {}) => {
  const requireOnline = options.requireOnline === true;

  return async (req, res, next) => {
    try {
      if (!req.user?.id || req.user.role !== 'seller') {
        return res.status(403).json({
          success: false,
          message: 'Seller authentication required',
        });
      }

      const result = await evaluateSellerStorefrontEligibility(req.user.id, {
        requireOnline,
      });

      if (!result.eligible) {
        const requiresMembership = result.reason === 'membership';
        const requiresRegistrationFee = result.reason === 'registration_fee';
        return res.status(403).json({
          success: false,
          requiresMembership,
          requiresRegistrationFee,
          reason: result.reason,
          message:
            result.message ||
            'Your seller account is not eligible to sell. Complete registration fee, approval, and an active subscription.',
        });
      }

      req.sellerEligibility = result;
      return next();
    } catch (error) {
      console.error('[requireSellerSellingEligibility]', error);
      return res.status(500).json({
        success: false,
        message: 'Unable to verify seller eligibility',
      });
    }
  };
};
