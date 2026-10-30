import mongoose from 'mongoose';
import Product from '../models/Product.model.js';
import Seller from '../models/Seller.model.js';
import { uploadToCloudinary } from '../config/cloudinary.js';
import dotenv from 'dotenv';

dotenv.config();

import fs from 'fs';
import path from 'path';
import { getEligibleSellersForLocation, isValidCoordinate } from '../utils/sellerLocationHelper.js';
import { evaluateSellerStorefrontEligibility, evaluateProductSellerEligibility, isPlatformOfficialSeller } from '../utils/sellerEligibility.js';
import { getEffectiveStock, syncRootStockFromVariants } from '../utils/productStock.js';

// High-speed In-memory Cache for Products listing
const productsCache = new Map();
export const invalidateProductsCache = () => {
  productsCache.clear();
};

const saveBase64ImageLocally = (base64Str, subfolder = 'products') => {
  try {
    const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return null;
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    let ext = '.png';
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = '.jpg';
    else if (mimeType.includes('webp')) ext = '.webp';
    else if (mimeType.includes('svg')) ext = '.svg';
    else if (mimeType.includes('gif')) ext = '.gif';

    const targetDir = path.join(process.cwd(), 'uploads', subfolder.toLowerCase());
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const filename = `img-${Date.now()}-${Math.floor(10000 + Math.random() * 90000)}${ext}`;
    const filePath = path.join(targetDir, filename);
    fs.writeFileSync(filePath, buffer);

    return `/uploads/${subfolder.toLowerCase()}/${filename}`;
  } catch (err) {
    console.error('Failed to save base64 image locally:', err.message);
    return null;
  }
};

const processImage = async (imgStr, folder = 'products') => {
  if (!imgStr || typeof imgStr !== 'string' || !imgStr.trim()) {
    return '';
  }
  
  if (imgStr.startsWith('data:image/')) {
    // 1. Try Cloudinary if configured
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name_here') {
      try {
        const uploadPromise = uploadToCloudinary(imgStr, folder);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Cloudinary upload timed out (6s limit)')), 6000)
        );
        const res = await Promise.race([uploadPromise, timeoutPromise]);
        if (res && res.secure_url) return res.secure_url;
      } catch (err) {
        console.warn('[ProductController] Cloudinary upload failed, persisting locally:', err.message);
      }
    }

    // 2. Persist to local disk uploads directory
    const cleanFolder = folder.includes('/') ? folder.split('/')[0] : folder;
    const localUrl = saveBase64ImageLocally(imgStr, cleanFolder);
    if (localUrl) return localUrl;
  }

  return imgStr;
};

const processImageWithCache = async (imgStr, folder = 'products', cache = new Map()) => {
  if (!imgStr || typeof imgStr !== 'string' || !imgStr.trim()) {
    return '';
  }
  if (imgStr.startsWith('http://') || imgStr.startsWith('https://') || imgStr.startsWith('/uploads/')) {
    return imgStr;
  }
  if (cache.has(imgStr)) {
    return cache.get(imgStr);
  }
  const result = await processImage(imgStr, folder);
  cache.set(imgStr, result);
  return result;
};

// @desc    Create a new product
// @route   POST /api/products
// @access  Private/Admin
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      category,
      subCategory,
      brand,
      unitValue,
      unitType,
      seller,
      sellerId,
      description,
      mrp,
      salePrice,
      taxRate,
      hsnCode,
      stock,
      minStockLimit,
      sku,
      mainImage,
      homeSections,
      galleryImages,
      status,
      isFeatured,
      isReturnable,
      returnWindow,
      returnPolicy,
      hasVariants,
      variantOptions,
      variants
    } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide Product Name'
      });
    }

    const imageCache = new Map();

    // Process mainImage & galleryImages through Cloudinary in PARALLEL
    const [processedMainImage, processedGalleryImages] = await Promise.all([
      processImageWithCache(mainImage, 'products/main', imageCache),
      Array.isArray(galleryImages) && galleryImages.length > 0
        ? Promise.all(galleryImages.map(img => processImageWithCache(img, 'products/gallery', imageCache)))
        : Promise.resolve([])
    ]);

    // Process variant images if provided, re-using processedMainImage when possible
    let processedVariants = [];
    if (Array.isArray(variants) && variants.length > 0) {
      processedVariants = await Promise.all(
        variants.map(async (v) => {
          let vImage = v.image || '';
          if (vImage && typeof vImage === 'string' && vImage.startsWith('data:image/')) {
            vImage = await processImageWithCache(vImage, 'products/variants', imageCache);
          } else if (!vImage || vImage === mainImage) {
            vImage = processedMainImage;
          }
          return {
            ...v,
            image: vImage,
            price: Number(v.price || 0),
            originalPrice: Number(v.originalPrice || v.price || 0),
            stock: Number(v.stock || 0),
            active: v.active !== undefined ? Boolean(v.active) : true
          };
        })
      );
    }

    // Clean out any option that has 0 values (e.g. user added option name but no tags)
    const cleanVariantOptions = Array.isArray(variantOptions)
      ? variantOptions.filter(o => o.name && o.name.trim() && Array.isArray(o.values) && o.values.length > 0)
      : [];

    const isMultiVariant = Boolean((hasVariants && cleanVariantOptions.length > 0) || (processedVariants && processedVariants.length > 0));
    const firstActiveVariant = processedVariants.find(v => v.active !== false) || processedVariants[0];

    const parsedMrp = Number(mrp || (firstActiveVariant ? firstActiveVariant.originalPrice : (salePrice || 0)));
    const parsedSalePrice = Number(salePrice || (firstActiveVariant ? firstActiveVariant.price : (mrp || 0)));
    // Variant products: root stock must always equal sum of active variant stocks
    const parsedStock = isMultiVariant
      ? syncRootStockFromVariants({ hasVariants: true, variants: processedVariants })
      : Math.max(0, Number(stock !== undefined && stock !== '' ? stock : 0));

    const formattedUnit = `${unitValue || '1'} ${unitType || 'kg'}`;
    const finalIsReturnable = isReturnable !== undefined ? Boolean(isReturnable) : true;
    const finalReturnWindow = returnWindow ? Number(returnWindow) : 7;
    const finalReturnPolicy = returnPolicy || (finalIsReturnable ? `${finalReturnWindow} Days Returnable` : 'Non-Returnable');

    const product = await Product.create({
      name: name.trim(),
      category: category || 'Groceries',
      subCategory: subCategory || '',
      brand: brand || '',
      unitValue: String(unitValue || '1'),
      unitType: String(unitType || 'kg'),
      unit: formattedUnit,
      seller: seller || 'Sathi Seller Official Store',
      sellerId: sellerId && mongoose.Types.ObjectId.isValid(sellerId) ? sellerId : undefined,
      description: description || '',
      mrp: parsedMrp,
      salePrice: parsedSalePrice,
      taxRate: taxRate || '5%',
      hsnCode: hsnCode || '',
      stock: parsedStock,
      minStockLimit: minStockLimit ? Number(minStockLimit) : 10,
      sku: sku || (firstActiveVariant?.sku) || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      mainImage: processedMainImage || (firstActiveVariant?.image) || '',
      homeSections: Array.isArray(homeSections) && homeSections.length > 0 ? homeSections : ['flash_sale', 'bestseller'],
      galleryImages: processedGalleryImages,
      status: status || 'Published',
      isFeatured: Boolean(isFeatured),
      isReturnable: finalIsReturnable,
      returnWindow: finalReturnWindow,
      returnPolicy: finalReturnPolicy,
      hasVariants: isMultiVariant,
      variantOptions: cleanVariantOptions,
      variants: processedVariants
    });


    invalidateProductsCache();

    console.log(`[PRODUCT CREATED IN DB] ID: ${product._id}, Name: ${product.name}, Seller: ${product.seller}, SellerID: ${product.sellerId}`);

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product
    });
  } catch (error) {
    console.error('[PRODUCT CREATION ERROR]', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating product'
    });
  }
};

// @desc    Get all products
// @route   GET /api/products
export const getProducts = async (req, res) => {
  try {
    const now = Date.now();
    const { category, subCategory, section, search, sellerId, seller, lat, lng, latitude, longitude, admin, all } = req.query;

    const userLat = lat !== undefined ? lat : latitude;
    const userLng = lng !== undefined ? lng : longitude;
    const isAdminOrInternal = admin === 'true' || all === 'true' || req.headers['x-admin-request'] === 'true' || req.user?.role === 'admin';

    const cacheKey = `${req.originalUrl}_${userLat || 'none'}_${userLng || 'none'}_${isAdminOrInternal ? 'adm' : 'cust'}`;
    const cached = productsCache.get(cacheKey);
    if (cached && (now - cached.timestamp < 10000)) {
      return res.status(200).json(cached.data);
    }

    let query = {};

    const officialSellerClauses = [
      { seller: { $in: ['Sathi Seller Official Store', 'Sathi Seller', 'Admin', 'Platform', 'Sathi Seller Official Warehouse', 'Sathi Seller Select'] } },
      { seller: /^sathi seller/i },
      { sellerId: null },
      { sellerId: { $exists: false } },
    ];

    if (sellerId || seller) {
      const isOfficial = isPlatformOfficialSeller(seller || sellerId);
      if (!isAdminOrInternal && !req.headers['x-seller-request'] && !isOfficial) {
        const sQuery = sellerId && mongoose.Types.ObjectId.isValid(sellerId)
          ? { _id: sellerId }
          : { businessName: seller || sellerId };
        const sellerDoc = await Seller.findOne(sQuery).lean();
        const eligibility = await evaluateSellerStorefrontEligibility(sellerDoc || sellerId);
        if (!eligibility.eligible) {
          const emptyResponse = {
            success: true,
            count: 0,
            total: 0,
            page: 1,
            limit: 50,
            products: [],
            message: eligibility.message || 'This store is not available for orders.',
          };
          productsCache.set(cacheKey, { data: emptyResponse, timestamp: now });
          return res.status(200).json(emptyResponse);
        }
      }

      if (sellerId) {
        if (mongoose.Types.ObjectId.isValid(sellerId)) {
          query.$or = [
            { sellerId: sellerId },
            { seller: sellerId },
            ...(seller ? [{ seller: seller }] : [])
          ];
        } else {
          query.seller = sellerId;
        }
      } else if (seller) {
        if (isOfficial) {
          query.$or = officialSellerClauses;
        } else {
          query.seller = seller;
        }
      }
    } else if (isAdminOrInternal) {
      // Admin product management: allowed to query all products
    } else if (isValidCoordinate(userLat, userLng)) {
      // Customer Storefront: Find sellers covering this user's location based on each seller's serviceRadius
      const { eligibleSellerIds, eligibleSellerNames } = await getEligibleSellersForLocation(userLat, userLng);

      if (!eligibleSellerIds || eligibleSellerIds.length === 0) {
        // No local 3rd-party sellers near this coordinate: show platform official store products
        query.$or = officialSellerClauses;
      } else {
        const eligibleIdStrings = eligibleSellerIds.map((id) => String(id));
        query.$or = [
          ...officialSellerClauses,
          { sellerId: { $in: eligibleSellerIds } },
          { seller: { $in: eligibleIdStrings } },
          {
            $and: [
              { $or: [{ sellerId: null }, { sellerId: { $exists: false } }] },
              { seller: { $in: eligibleSellerNames } },
            ],
          },
        ];
      }
    } else {
      // Customer Storefront without coordinates (initial load / guest browsing / all-catalog browsing):
      // Display platform official store products and published items
      query.$or = [
        ...officialSellerClauses,
        { status: 'Published' }
      ];
    }

    if (category && category.trim() && category.trim().toLowerCase() !== 'all') {
      const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const normalizedCat = escapeRegex(category.trim()).replace(/\s+/g, '\\s+');
      query.category = { $regex: new RegExp(`^${normalizedCat}$`, 'i') };
    }

    if (subCategory && subCategory.trim() && subCategory.trim().toLowerCase() !== 'all' && subCategory.trim().toLowerCase() !== 'none') {
      const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const normalizedSub = escapeRegex(subCategory.trim()).replace(/\s+/g, '\\s+');
      query.subCategory = { $regex: new RegExp(`^${normalizedSub}$`, 'i') };
    }

    if (section) {
      query.homeSections = section;
    }

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    // Customer / public listings: only Published products
    if (!isAdminOrInternal && !req.headers['x-seller-request']) {
      query.status = 'Published';
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = req.query.limit !== undefined 
      ? (Number(req.query.limit) === 0 ? 0 : Math.min(100, Math.max(1, Number(req.query.limit))))
      : 50;

    let dbQuery = Product.find(query)
      .select('name category subCategory brand unitValue unitType unit seller sellerId mrp salePrice stock mainImage homeSections status isFeatured isReturnable sku createdAt hasVariants variantOptions variants')
      .sort({ createdAt: -1 })
      .lean();

    if (limit > 0) {
      dbQuery = dbQuery.skip((page - 1) * limit).limit(limit);
    }

    const [products, total] = await Promise.all([
      dbQuery,
      Product.countDocuments(query),
    ]);

    let visibleProducts = products || [];

    // Defense-in-depth: drop any product whose seller is not storefront-eligible
    // (covers name collisions / stale seller fields on customer listings)
    if (!isAdminOrInternal && !req.headers['x-seller-request'] && visibleProducts.length > 0) {
      const checks = await Promise.all(
        visibleProducts.map((p) => evaluateProductSellerEligibility(p))
      );
      visibleProducts = visibleProducts.filter((_, idx) => checks[idx]?.eligible);
    }

    // Expose effective stock (variant sum) so seller/user panels never show a stale root count
    const normalizedProducts = visibleProducts.map((p) => ({
      ...p,
      stock: getEffectiveStock(p),
    }));

    const responsePayload = {
      success: true,
      count: normalizedProducts.length,
      total,
      page,
      limit: limit || total,
      products: normalizedProducts,
    };

    productsCache.set(cacheKey, { data: responsePayload, timestamp: now });

    res.status(200).json(responsePayload);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching products'
    });
  }
};

// Helper to find product by ObjectId or SKU
const findProductByIdOrSku = async (idOrSku) => {
  if (!idOrSku) return null;
  if (mongoose.Types.ObjectId.isValid(idOrSku)) {
    const p = await Product.findById(idOrSku);
    if (p) return p;
  }
  return await Product.findOne({ sku: idOrSku });
};

// @desc    Get product by ID
// @route   GET /api/products/:id
// @access  Public
export const getProductById = async (req, res) => {
  try {
    let product = null;
    if (req.params.id && mongoose.Types.ObjectId.isValid(req.params.id)) {
      product = await Product.findById(req.params.id).lean();
    }
    if (!product && req.params.id) {
      product = await Product.findOne({ sku: req.params.id }).lean();
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const isAdminOrInternal =
      req.query.admin === 'true' ||
      req.headers['x-admin-request'] === 'true' ||
      req.headers['x-seller-request'] === 'true' ||
      req.user?.role === 'admin' ||
      req.user?.role === 'seller';

    if (!isAdminOrInternal) {
      if (product.status && product.status !== 'Published') {
        return res.status(404).json({
          success: false,
          message: 'Product not found',
        });
      }

      const eligibility = await evaluateProductSellerEligibility(product);
      if (!eligibility.eligible) {
        return res.status(404).json({
          success: false,
          message: eligibility.message || 'This product is not available.',
        });
      }
    }

    res.status(200).json({
      success: true,
      product: {
        ...product,
        stock: getEffectiveStock(product),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching product details'
    });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private/Admin
export const updateProduct = async (req, res) => {
  try {
    const product = await findProductByIdOrSku(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const updateData = { ...req.body };
    if (updateData.mainImage) {
      updateData.mainImage = await processImage(updateData.mainImage, 'products/main');
    }
    if (Array.isArray(updateData.galleryImages)) {
      updateData.galleryImages = await Promise.all(updateData.galleryImages.map(img => processImage(img, 'products/gallery')));
    }

    if (Array.isArray(updateData.variants)) {
      updateData.variants = await Promise.all(
        updateData.variants.map(async (v) => {
          let vImage = v.image || '';
          if (vImage && typeof vImage === 'string' && vImage.startsWith('data:image/')) {
            vImage = await processImage(vImage, 'products/variants');
          }
          return {
            ...v,
            image: vImage,
            price: Number(v.price || 0),
            originalPrice: Number(v.originalPrice || v.price || 0),
            stock: Number(v.stock || 0),
            active: v.active !== undefined ? Boolean(v.active) : true
          };
        })
      );

      if (updateData.hasVariants && updateData.variants.length > 0) {
        const firstActiveVariant = updateData.variants.find(v => v.active !== false) || updateData.variants[0];
        if (firstActiveVariant) {
          if (!updateData.salePrice) updateData.salePrice = firstActiveVariant.price;
          if (!updateData.mrp) updateData.mrp = firstActiveVariant.originalPrice;
        }
        // Always keep root stock = sum of active variant stocks
        updateData.stock = syncRootStockFromVariants({
          hasVariants: true,
          variants: updateData.variants,
        });
      }
    } else if (updateData.hasVariants && Array.isArray(product.variants) && product.variants.length > 0) {
      // Variants not in payload but product already has them — keep root stock consistent if stock omitted
      if (updateData.stock === undefined || updateData.stock === null) {
        updateData.stock = syncRootStockFromVariants({
          hasVariants: true,
          variants: product.variants,
        });
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      product._id,
      { $set: updateData },
      { returnDocument: 'after', runValidators: true }
    );

    invalidateProductsCache();

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product: updatedProduct
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating product'
    });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private/Admin
export const deleteProduct = async (req, res) => {
  try {
    const product = await findProductByIdOrSku(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    await product.deleteOne();
    invalidateProductsCache();

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting product'
    });
  }
};
