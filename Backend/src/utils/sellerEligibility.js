import mongoose from 'mongoose';
import Seller from '../models/Seller.model.js';
import SellerMembership from '../models/SellerMembership.model.js';

/**
 * Centralized seller storefront / selling eligibility.
 *
 * A seller is eligible for public product visibility and new customer orders only when:
 * 1. Admin-approved (accountStatus or status === approved; not rejected/suspended)
 * 2. Registration fee is paid or explicitly not_required
 * 3. Active membership exists (SellerMembership membershipStatus active AND expiryDate > now)
 * 4. Store is online (isOnline !== false) — for customer-facing checks only
 *
 * Note: MEMBERSHIP_ENFORCEMENT_CUTOFF / isMembershipRequiredForSeller are retained only for
 * seller-panel auth UX (e.g. prompting subscription purchase). Customer storefront listing
 * always requires an active subscription so unsubscribed sellers' products stay hidden.
 */

export const REGISTRATION_FEE_OK = ['paid', 'not_required'];

/**
 * Check if a seller identifier / name represents the official Sathi Seller platform store / Admin catalog.
 */
export const isPlatformOfficialSeller = (sellerRef) => {
  if (!sellerRef) return true;
  if (typeof sellerRef === 'object') {
    const name = sellerRef.businessName || sellerRef.name || '';
    if (isPlatformOfficialSeller(name)) return true;
    return false;
  }
  const s = String(sellerRef).toLowerCase().trim();
  return (
    s === 'sathi seller official store' ||
    s === 'sathi seller official warehouse' ||
    s === 'sathi seller' ||
    s === 'admin' ||
    s === 'platform' ||
    s === 'official' ||
    s === 'sathi seller select' ||
    s.startsWith('sathi seller')
  );
};

/**
 * Cutoff used only for seller-panel UX (prompting subscription purchase via
 * isMembershipRequiredForSeller). Customer storefront always requires active membership.
 */
export const MEMBERSHIP_ENFORCEMENT_CUTOFF = new Date('2026-10-09T00:00:00.000Z');

/** Subscription model is switched off for now. Set to true to enforce seller memberships again. */
export const SELLER_MEMBERSHIP_ENFORCED = false;

/** True when seller-panel should treat subscription as required (UX / auth prompts). */
export const isMembershipRequiredForSeller = (seller) => {
  if (!SELLER_MEMBERSHIP_ENFORCED) return false;
  if (!seller) return true;
  if (seller.createdAt && new Date(seller.createdAt) < MEMBERSHIP_ENFORCEMENT_CUTOFF) {
    return false;
  }
  return true;
};

export const isSellerApproved = (seller) => {
  if (!seller) return false;
  const rejected =
    seller.accountStatus === 'rejected' ||
    seller.status === 'rejected' ||
    seller.accountStatus === 'suspended' ||
    seller.status === 'suspended';
  if (rejected) return false;
  return (
    seller.accountStatus === 'approved' ||
    seller.status === 'approved'
  );
};

export const hasRegistrationFeeCleared = (seller) => {
  if (!seller) return false;
  return REGISTRATION_FEE_OK.includes(seller.registrationFeeStatus);
};

/** Mongo match fragment for approved + fee-cleared + online sellers (membership filtered separately). */
export const storefrontSellerBaseMatch = () => ({
  $and: [
    {
      $or: [{ status: 'approved' }, { accountStatus: 'approved' }],
    },
    {
      status: { $nin: ['rejected', 'suspended'] },
      accountStatus: { $nin: ['rejected', 'suspended'] },
    },
    {
      registrationFeeStatus: { $in: REGISTRATION_FEE_OK },
    },
    {
      isOnline: { $ne: false },
    },
  ],
});

/**
 * Expire stale active memberships for the given seller ids, then return
 * the set of seller ObjectId strings that still have a valid active plan.
 */
export const getActiveMembershipSellerIdSet = async (sellerIds = []) => {
  const ids = (sellerIds || [])
    .map((id) => {
      if (!id) return null;
      if (id instanceof mongoose.Types.ObjectId) return id;
      if (mongoose.Types.ObjectId.isValid(id)) return new mongoose.Types.ObjectId(id);
      return null;
    })
    .filter(Boolean);

  if (ids.length === 0) return new Set();

  if (!SELLER_MEMBERSHIP_ENFORCED) return new Set(ids.map((id) => String(id)));

  const now = new Date();

  await SellerMembership.updateMany(
    {
      sellerId: { $in: ids },
      membershipStatus: 'active',
      expiryDate: { $lte: now },
    },
    { $set: { membershipStatus: 'expired' } }
  );

  const expiredSellerIds = await SellerMembership.distinct('sellerId', {
    sellerId: { $in: ids },
    membershipStatus: 'expired',
  });

  if (expiredSellerIds.length > 0) {
    const stillActive = await SellerMembership.distinct('sellerId', {
      sellerId: { $in: expiredSellerIds },
      membershipStatus: 'active',
      expiryDate: { $gt: now },
    });
    const stillActiveSet = new Set(stillActive.map((id) => String(id)));
    const toMarkExpired = expiredSellerIds.filter((id) => !stillActiveSet.has(String(id)));
    if (toMarkExpired.length > 0) {
      await Seller.updateMany(
        { _id: { $in: toMarkExpired }, membershipStatus: { $ne: 'expired' } },
        { $set: { membershipStatus: 'expired' } }
      );
    }
  }

  const activeIds = await SellerMembership.distinct('sellerId', {
    sellerId: { $in: ids },
    membershipStatus: 'active',
    expiryDate: { $gt: now },
  });

  return new Set(activeIds.map((id) => String(id)));
};

export const sellerHasActiveMembership = async (sellerId) => {
  if (!sellerId) return false;
  const set = await getActiveMembershipSellerIdSet([sellerId]);
  return set.has(String(sellerId));
};

/**
 * Resolve seller document from a product (sellerId ObjectId or businessName string).
 */
export const resolveSellerFromProduct = async (product) => {
  if (!product) return null;

  const sellerId = product.sellerId;
  if (sellerId && mongoose.Types.ObjectId.isValid(String(sellerId))) {
    const byId = await Seller.findById(sellerId).lean();
    if (byId) return byId;
  }

  const sellerRef = product.seller;
  if (sellerRef && mongoose.Types.ObjectId.isValid(String(sellerRef))) {
    const byRef = await Seller.findById(sellerRef).lean();
    if (byRef) return byRef;
  }

  if (sellerRef && typeof sellerRef === 'string' && sellerRef.trim()) {
    return Seller.findOne({
      businessName: { $regex: new RegExp(`^${sellerRef.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    }).lean();
  }

  return null;
};

/**
 * Full storefront eligibility for one seller document (or id).
 * @param {object|string} sellerOrId
 * @param {{ requireOnline?: boolean }} options
 */
export const evaluateSellerStorefrontEligibility = async (sellerOrId, options = {}) => {
  if (isPlatformOfficialSeller(sellerOrId)) {
    return { eligible: true, reason: null, message: null, seller: null, isPlatformOfficial: true };
  }

  const requireOnline = options.requireOnline !== false;

  let seller = sellerOrId;
  if (!seller || typeof seller === 'string' || seller instanceof mongoose.Types.ObjectId) {
    if (!sellerOrId) {
      return { eligible: false, reason: 'seller_missing', message: 'Seller not found.' };
    }
    seller = await Seller.findById(sellerOrId).lean();
  }

  if (!seller) {
    return { eligible: false, reason: 'seller_missing', message: 'Seller not found.' };
  }

  if (!isSellerApproved(seller)) {
    return {
      eligible: false,
      reason: 'not_approved',
      message: 'This store is not approved for selling yet.',
      seller,
    };
  }

  if (!hasRegistrationFeeCleared(seller)) {
    return {
      eligible: false,
      reason: 'registration_fee',
      message: 'Seller registration fee is unpaid. This store is not available.',
      seller,
    };
  }

  if (requireOnline && seller.isOnline === false) {
    return {
      eligible: false,
      reason: 'offline',
      message: 'This store is currently offline and not taking orders.',
      seller,
    };
  }

  // Customer storefront / orders: active subscription required for every seller
  const hasMembership = !SELLER_MEMBERSHIP_ENFORCED || (await sellerHasActiveMembership(seller._id));
  if (!hasMembership) {
    if (seller.membershipStatus === 'active') {
      await Seller.updateOne({ _id: seller._id }, { $set: { membershipStatus: 'expired' } });
    }
    return {
      eligible: false,
      reason: 'membership',
      message: 'This store does not have an active subscription and is not available.',
      seller,
      membershipRequired: true,
    };
  }

  if (SELLER_MEMBERSHIP_ENFORCED && seller.membershipStatus !== 'active') {
    await Seller.updateOne({ _id: seller._id }, { $set: { membershipStatus: 'active' } });
  }

  return { eligible: true, reason: null, message: null, seller, membershipRequired: true };
};

/**
 * Filter an array of seller docs/ids down to those eligible for the public storefront.
 */
export const filterStorefrontEligibleSellers = async (sellers = [], options = {}) => {
  if (!sellers.length) return [];

  const docs = sellers.filter((s) => s && typeof s === 'object' && s._id);
  const idOnly = sellers.filter((s) => s && (typeof s === 'string' || s instanceof mongoose.Types.ObjectId));

  let allDocs = [...docs];
  if (idOnly.length) {
    const fetched = await Seller.find({ _id: { $in: idOnly } }).lean();
    allDocs = allDocs.concat(fetched);
  }

  // Deduplicate by id
  const byId = new Map();
  for (const s of allDocs) {
    byId.set(String(s._id), s);
  }
  const unique = [...byId.values()];

  const requireOnline = options.requireOnline !== false;
  const basePass = unique.filter((s) => {
    if (!isSellerApproved(s)) return false;
    if (!hasRegistrationFeeCleared(s)) return false;
    if (requireOnline && s.isOnline === false) return false;
    return true;
  });

  const activeSet = await getActiveMembershipSellerIdSet(basePass.map((s) => s._id));
  return basePass.filter((s) => activeSet.has(String(s._id)));
};

/**
 * Assert a product's owning seller is storefront-eligible.
 */
export const evaluateProductSellerEligibility = async (product, options = {}) => {
  if (!product) {
    return { eligible: false, reason: 'product_missing', message: 'Product not found.' };
  }

  // Official platform / admin products (no sellerId, or official platform store name) are always storefront-eligible
  if (!product.sellerId || isPlatformOfficialSeller(product.seller)) {
    if (!product.sellerId && (!product.seller || isPlatformOfficialSeller(product.seller))) {
      return { eligible: true, reason: null, message: null, seller: null, isPlatformOfficial: true };
    }
    if (isPlatformOfficialSeller(product.seller)) {
      return { eligible: true, reason: null, message: null, seller: null, isPlatformOfficial: true };
    }
  }

  const seller = await resolveSellerFromProduct(product);
  if (!seller) {
    return {
      eligible: false,
      reason: 'seller_missing',
      message: 'This product is not available from an eligible store.',
    };
  }

  return evaluateSellerStorefrontEligibility(seller, options);
};
