import mongoose from 'mongoose';
import User from '../models/User.model.js';
import Product from '../models/Product.model.js';

// Helper to find or auto-create product for mock/seed items
const findOrCreateProduct = async (productId, productData = {}) => {
  if (!productId) return null;

  if (mongoose.Types.ObjectId.isValid(productId)) {
    const existing = await Product.findById(productId);
    if (existing) return existing;
  }

  let existing = await Product.findOne({
    $or: [
      { sku: String(productId) },
      { name: String(productData.name || productId) },
    ],
  });
  if (existing) return existing;

  const name = productData.name || `Product ${productId}`;
  const price = Number(productData.salePrice || productData.price || 99);
  const mrp = Number(productData.mrp || productData.originalPrice || price * 1.2);

  return await Product.create({
    name,
    sku: String(productId),
    salePrice: price,
    mrp: mrp,
    stock: 100,
    category: productData.category || 'Grocery',
    mainImage: productData.image || productData.mainImage || '',
  });
};

// Get user wishlist directly from User document
export const getWishlist = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).populate('wishlist');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({
      success: true,
      wishlist: {
        products: user.wishlist || [],
      },
    });
  } catch (error) {
    next(error);
  }
};

// Toggle product in wishlist inside User document
export const toggleWishlist = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { productId, product: productPayload } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required' });
    }

    const product = await findOrCreateProduct(productId, productPayload);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.wishlist) user.wishlist = [];

    const index = user.wishlist.findIndex(
      (p) => p && p.toString() === product._id.toString()
    );

    let isAdded = false;
    if (index > -1) {
      user.wishlist.splice(index, 1);
    } else {
      user.wishlist.push(product._id);
      isAdded = true;
    }

    await user.save();
    await user.populate('wishlist');

    res.status(200).json({
      success: true,
      isAdded,
      message: isAdded ? 'Added to wishlist' : 'Removed from wishlist',
      wishlist: {
        products: user.wishlist || [],
      },
    });
  } catch (error) {
    next(error);
  }
};

// Sync guest local wishlist items into User document
export const syncWishlist = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { productIds = [] } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.wishlist) user.wishlist = [];

    const existingStrIds = new Set(user.wishlist.map((p) => p ? p.toString() : ''));
    for (const pid of productIds) {
      if (pid) {
        const rawId = typeof pid === 'object' ? (pid._id || pid.id) : pid;
        const product = await findOrCreateProduct(rawId, typeof pid === 'object' ? pid : {});
        if (product && !existingStrIds.has(product._id.toString())) {
          user.wishlist.push(product._id);
          existingStrIds.add(product._id.toString());
        }
      }
    }

    await user.save();
    await user.populate('wishlist');

    res.status(200).json({
      success: true,
      message: 'Wishlist synced successfully',
      wishlist: {
        products: user.wishlist || [],
      },
    });
  } catch (error) {
    next(error);
  }
};
