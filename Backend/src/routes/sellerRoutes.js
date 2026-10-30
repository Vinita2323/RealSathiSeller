import express from 'express';
import mongoose from 'mongoose';
import Seller from '../models/Seller.model.js';
import Product from '../models/Product.model.js';

const router = express.Router();

import { getEligibleSellersForLocation, isValidCoordinate } from '../utils/sellerLocationHelper.js';
import { haversineDistance } from '../utils/haversine.js';
import { deleteSeller } from '../controllers/adminController.js';
import { evaluateSellerStorefrontEligibility } from '../utils/sellerEligibility.js';

// In-memory cache for public sellers listing (TTL: 10s)
let publicSellersCache = new Map();
export const invalidatePublicSellersCache = () => {
  publicSellersCache.clear();
};

// @desc    Get all public sellers (Supports latitude & longitude for service radius filtering)
// @route   GET /api/sellers
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { category, search, lat, lng, latitude, longitude, admin, all } = req.query;
    const userLat = lat !== undefined ? lat : latitude;
    const userLng = lng !== undefined ? lng : longitude;
    const isAdminOrInternal = admin === 'true' || all === 'true' || req.headers['x-admin-request'] === 'true' || req.user?.role === 'admin';
    const now = Date.now();

    const cacheKey = `${req.originalUrl}_${userLat || 'none'}_${userLng || 'none'}_${isAdminOrInternal ? 'adm' : 'cust'}`;
    const cached = publicSellersCache.get(cacheKey);
    if (cached && (now - cached.timestamp < 10000) && !req.query.fresh) {
      return res.status(200).json(cached.data);
    }

    // 1. If valid user location is provided, filter dynamically based on each seller's service radius!
    if (isValidCoordinate(userLat, userLng)) {
      const { eligibleSellers } = await getEligibleSellersForLocation(userLat, userLng, {
        category,
        search
      });

      const payload = {
        success: true,
        count: eligibleSellers.length,
        sellers: eligibleSellers
      };

      publicSellersCache.set(cacheKey, { data: payload, timestamp: now });
      return res.status(200).json(payload);
    }

    // 2. Admin or internal management query without location: return all approved sellers
    if (isAdminOrInternal) {
      // Admin listing: approved sellers (fee/membership managed separately in admin UI)
      let dbQuery = {
        $or: [
          { status: 'approved' },
          { accountStatus: 'approved' },
        ],
        status: { $nin: ['rejected', 'suspended'] },
        accountStatus: { $nin: ['rejected', 'suspended'] }
      };

      if (search) {
        dbQuery.businessName = { $regex: search, $options: 'i' };
      }
      if (category && category.toLowerCase() !== 'all') {
        dbQuery.categories = { $regex: category, $options: 'i' };
      }

      const dbSellers = await Seller.find(dbQuery)
        .select('businessName ownerName businessType storeLogo tagline warehouseLocation location serviceRadius categories isVerified status isOnline rating reviewsCount createdAt')
        .sort({ createdAt: -1 })
        .lean();

      const mappedSellers = dbSellers.map(plain => ({
        _id: String(plain._id),
        id: String(plain._id),
        businessName: plain.businessName || 'Store',
        ownerName: plain.ownerName || '',
        businessType: plain.businessType || 'Retail Store',
        tagline: plain.tagline || 'Quality groceries & daily essentials',
        storeLogo: (plain.storeLogo && typeof plain.storeLogo === 'string' && !plain.storeLogo.startsWith('data:image/'))
          ? plain.storeLogo 
          : 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=160&auto=format&fit=crop&q=80',
        banner: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=800&auto=format&fit=crop&q=80',
        categories: plain.categories && plain.categories.length > 0 ? plain.categories : ['Groceries', 'Daily Needs'],
        rating: plain.rating || 4.8,
        reviewsCount: plain.reviewsCount || 120,
        deliveryTime: '15-25 min',
        distance: 'Local Store',
        serviceRadius: plain.serviceRadius || 5,
        warehouseLocation: plain.warehouseLocation || { storeAddress: 'Local Store', city: plain.city || 'City' },
        isVerified: plain.isVerified || plain.status === 'approved',
        status: plain.status || 'approved'
      }));

      const payload = {
        success: true,
        count: mappedSellers.length,
        sellers: mappedSellers
      };

      publicSellersCache.set(cacheKey, { data: payload, timestamp: now });
      return res.status(200).json(payload);
    }

    // 3. Customer Storefront without valid location coordinates:
    // DO NOT return arbitrary global sellers. Prompt user to select delivery location.
    const noLocationPayload = {
      success: true,
      count: 0,
      sellers: [],
      message: 'Please select your delivery location to view available stores.'
    };
    publicSellersCache.set(cacheKey, { data: noLocationPayload, timestamp: now });
    return res.status(200).json(noLocationPayload);
  } catch (error) {
    console.error('[PUBLIC SELLERS FETCH ERROR]', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching sellers',
      sellers: []
    });
  }
});

// @desc    Get single seller details + their products
// @route   GET /api/sellers/:id
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, lng, latitude, longitude } = req.query;
    const userLat = lat !== undefined ? lat : latitude;
    const userLng = lng !== undefined ? lng : longitude;

    let seller = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      seller = await Seller.findById(id).select('businessName ownerName businessType storeLogo tagline warehouseLocation location serviceRadius categories isVerified status accountStatus isOnline phone email rating reviewsCount registrationFeeStatus membershipStatus').lean();
    }

    if (!seller) {
      seller = await Seller.findOne({
        businessName: { $regex: new RegExp(`^${decodeURIComponent(id).trim()}$`, 'i') }
      }).select('businessName ownerName businessType storeLogo tagline warehouseLocation location serviceRadius categories isVerified status accountStatus isOnline phone email rating reviewsCount registrationFeeStatus membershipStatus').lean();
    }

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: 'Seller store not found',
        seller: null,
        products: []
      });
    }

    const isAdminOrInternal = req.headers['x-admin-request'] === 'true' || req.headers['x-seller-request'] === 'true' || req.user?.role === 'admin';

    // Customer storefront: fee paid + approved + active subscription + online
    if (!isAdminOrInternal) {
      const eligibility = await evaluateSellerStorefrontEligibility(seller);
      if (!eligibility.eligible) {
        return res.status(200).json({
          success: true,
          seller: { ...seller, isOnline: seller.isOnline !== false },
          products: [],
          message: eligibility.message || 'This store is not available for orders.',
        });
      }
    }

    let isLocationCovered = true;
    let distanceKm = null;

    // Dynamic distance calculation if user coordinates are provided
    if (isValidCoordinate(userLat, userLng)) {
      const coords = seller.warehouseLocation?.location?.coordinates || seller.location?.coordinates;
      if (coords && Array.isArray(coords) && coords.length >= 2 && (coords[0] !== 0 || coords[1] !== 0)) {
        const dist = haversineDistance(parseFloat(userLat), parseFloat(userLng), coords[1], coords[0]);
        distanceKm = Math.round(dist * 100) / 100;
        seller.distanceKm = distanceKm;
        seller.distance = `${dist.toFixed(1)} km`;
        isLocationCovered = dist <= (Number(seller.serviceRadius) || 5);
        seller.isCovered = isLocationCovered;
      }
    }

    // If user provided coordinates and seller is OUTSIDE radius, do NOT return products
    if (isValidCoordinate(userLat, userLng) && !isLocationCovered) {
      return res.status(200).json({
        success: true,
        seller,
        products: [],
        message: `This store is outside your delivery area (Distance: ${distanceKm || 'N/A'} km, Max radius: ${seller.serviceRadius || 5} km).`
      });
    }

    // Fetch products belonging strictly to this seller
    let productQuery = {
      $or: [
        { sellerId: seller._id },
        { seller: seller.businessName },
        { seller: seller._id.toString() }
      ]
    };

    if (!isAdminOrInternal) {
      productQuery.status = 'Published';
    }

    let products = await Product.find(productQuery).sort({ createdAt: -1 }).lean();

    res.status(200).json({
      success: true,
      seller,
      products
    });
  } catch (error) {
    console.error('[GET SELLER STORE ERROR]', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching seller store',
      seller: null,
      products: []
    });
  }
});

// @desc    Delete single seller
// @route   DELETE /api/sellers/:id
// @access  Private/Admin
router.delete('/:id', deleteSeller);

export default router;
