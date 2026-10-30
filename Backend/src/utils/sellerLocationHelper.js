import mongoose from 'mongoose';
import Seller from '../models/Seller.model.js';
import { haversineDistance } from './haversine.js';
import {
  storefrontSellerBaseMatch,
  getActiveMembershipSellerIdSet,
} from './sellerEligibility.js';

/**
 * Validates geographical coordinates (Latitude & Longitude).
 * Latitude must be between -90 and 90.
 * Longitude must be between -180 and 180.
 */
export const isValidCoordinate = (lat, lng) => {
  const numLat = Number(lat);
  const numLng = Number(lng);

  if (isNaN(numLat) || isNaN(numLng)) return false;
  if (numLat < -90 || numLat > 90) return false;
  if (numLng < -180 || numLng > 180) return false;
  // Exclude [0, 0] null island as valid user delivery location
  if (numLat === 0 && numLng === 0) return false;

  return true;
};

/**
 * Finds all active sellers whose configurable serviceRadius (in KM) covers the given user location.
 *
 * Visibility Rule:
 * distance(userLocation, sellerLocation) <= seller.serviceRadius (in KM)
 *
 * @param {number|string} userLat User Latitude
 * @param {number|string} userLng User Longitude
 * @param {object} options Optional filtering (status, category, search)
 * @returns {Promise<{
 *   eligibleSellers: Array,
 *   eligibleSellerIds: Array<mongoose.Types.ObjectId>,
 *   eligibleSellerNames: Array<string>
 * }>}
 */
export const getEligibleSellersForLocation = async (userLat, userLng, options = {}) => {
  if (!isValidCoordinate(userLat, userLng)) {
    return {
      eligibleSellers: [],
      eligibleSellerIds: [],
      eligibleSellerNames: [],
    };
  }

  const lat = parseFloat(userLat);
  const lng = parseFloat(userLng);

  try {
    // 1. First attempt: High-performance MongoDB Aggregation using $geoNear
    // Requires approved + registration fee cleared + online. Membership filtered after geo match.
    const matchQuery = storefrontSellerBaseMatch();

    if (options.search) {
      matchQuery.$and.push({ businessName: { $regex: options.search, $options: 'i' } });
    }
    if (options.category && options.category.toLowerCase() !== 'all') {
      matchQuery.$and.push({ categories: { $regex: options.category, $options: 'i' } });
    }

    let results = [];

    try {
      results = await Seller.aggregate([
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [lng, lat] },
            key: 'warehouseLocation.location',
            distanceField: 'distanceMeters',
            spherical: true,
            maxDistance: 200000, // 200 KM maximum cap
            query: matchQuery,
          },
        },
        {
          $addFields: {
            effectiveRadiusKm: {
              $cond: {
                if: {
                  $and: [
                    { $gt: ['$serviceRadius', 0] },
                    { $lte: ['$serviceRadius', 200] },
                  ],
                },
                then: '$serviceRadius',
                else: 5,
              },
            },
          },
        },
        {
          $addFields: {
            effectiveRadiusMeters: {
              $multiply: ['$effectiveRadiusKm', 1000],
            },
            distanceKm: {
              $round: [{ $divide: ['$distanceMeters', 1000] }, 2],
            },
          },
        },
        {
          $match: {
            $expr: {
              $lte: ['$distanceMeters', '$effectiveRadiusMeters'],
            },
          },
        },
        {
          $sort: { distanceMeters: 1 },
        },
      ]);
    } catch (geoNearErr) {
      // If 2dsphere index query fails (e.g., during index rebuild or unindexed coordinates field), fallback to Haversine
      console.warn('[sellerLocationHelper] $geoNear failed, falling back to Haversine:', geoNearErr.message);
      results = [];
    }

    // 2. Haversine Calculation Fallback if geoNear returned 0 or errored
    if (!results || results.length === 0) {
      const fallbackQuery = storefrontSellerBaseMatch();
      if (options.search) {
        fallbackQuery.$and.push({ businessName: { $regex: options.search, $options: 'i' } });
      }
      if (options.category && options.category.toLowerCase() !== 'all') {
        fallbackQuery.$and.push({ categories: { $regex: options.category, $options: 'i' } });
      }
      const candidates = await Seller.find(fallbackQuery).lean();

      results = [];

      for (const seller of candidates) {
        const coords =
          seller.warehouseLocation?.location?.coordinates ||
          seller.location?.coordinates ||
          null;

        if (
          !coords ||
          !Array.isArray(coords) ||
          coords.length < 2 ||
          (coords[0] === 0 && coords[1] === 0) ||
          isNaN(coords[0]) ||
          isNaN(coords[1])
        ) {
          // Seller without valid coordinates is NOT eligible for location-based delivery
          continue;
        }

        const sellerLng = Number(coords[0]);
        const sellerLat = Number(coords[1]);
        const radiusKm = Number(seller.serviceRadius) > 0 ? Number(seller.serviceRadius) : 5;

        const distanceKm = haversineDistance(lat, lng, sellerLat, sellerLng);

        // Core business rule: distance <= seller.serviceRadius
        if (distanceKm <= radiusKm) {
          results.push({
            ...seller,
            distanceKm,
            distanceMeters: Math.round(distanceKm * 1000),
            effectiveRadiusKm: radiusKm,
          });
        }
      }

      // Sort by distance ascending
      results.sort((a, b) => a.distanceKm - b.distanceKm);
    }

    // 3. Active subscription required for all customer-facing storefront sellers.
    // Sellers without an active SellerMembership must not appear or list products.
    const membershipOk = await getActiveMembershipSellerIdSet(results.map((s) => s._id));
    results = results.filter((s) => membershipOk.has(String(s._id)));

    const eligibleSellers = results.map((s) => ({
      _id: s._id,
      id: s._id.toString(),
      businessName: s.businessName,
      ownerName: s.ownerName || '',
      businessType: s.businessType || 'Retail Store',
      tagline: s.tagline || 'Quality groceries & daily essentials',
      storeLogo: s.storeLogo || '',
      banner: s.banner || 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=800&auto=format&fit=crop&q=80',
      categories: Array.isArray(s.categories) && s.categories.length > 0 ? s.categories : ['Groceries', 'Daily Needs'],
      rating: s.rating || 4.8,
      reviewsCount: s.reviewsCount || 120,
      deliveryTime: s.distanceKm ? `${Math.max(10, Math.round(s.distanceKm * 3 + 10))}-${Math.max(15, Math.round(s.distanceKm * 3 + 15))} min` : '15-25 min',
      distance: s.distanceKm != null ? `${s.distanceKm.toFixed(1)} km` : `${((s.distanceMeters || 0) / 1000).toFixed(1)} km`,
      distanceKm: s.distanceKm != null ? s.distanceKm : (s.distanceMeters || 0) / 1000,
      serviceRadius: s.serviceRadius || 5,
      warehouseLocation: s.warehouseLocation || { storeAddress: 'Local Store', city: s.city || 'City' },
      isVerified: s.isVerified || s.status === 'approved',
      status: s.status || 'approved',
    }));

    const eligibleSellerIds = eligibleSellers.map((s) => s._id);
    const eligibleSellerNames = eligibleSellers
      .map((s) => s.businessName)
      .filter(Boolean);

    return {
      eligibleSellers,
      eligibleSellerIds,
      eligibleSellerNames,
    };
  } catch (error) {
    console.error('[sellerLocationHelper] Error resolving eligible sellers:', error);
    return {
      eligibleSellers: [],
      eligibleSellerIds: [],
      eligibleSellerNames: [],
    };
  }
};
