import mongoose from 'mongoose';
import User from '../models/User.model.js';
import Product from '../models/Product.model.js';
import {
  readCustomerAttributes,
  rowsFromAttributes,
} from '../utils/selectedVariants.js';
import { evaluateProductSellerEligibility } from '../utils/sellerEligibility.js';

// Helper to find existing product or auto-create fallback for seed/mock frontend items
const findOrCreateProduct = async (productId, productData = {}) => {
  if (!productId) return null;

  // 1. Try finding by ObjectId
  if (mongoose.Types.ObjectId.isValid(productId)) {
    const existing = await Product.findById(productId);
    if (existing) return existing;
  }

  // 2. Try finding by SKU or Name
  let existing = await Product.findOne({
    $or: [
      { sku: String(productId) },
      { name: String(productData.name || productId) },
    ],
  });
  if (existing) return existing;

  // 3. Auto-create product for seed/mock items so DB holds valid reference
  const name = productData.name || `Product ${productId}`;
  const price = Number(productData.salePrice || productData.price || 99);
  const mrp = Number(productData.mrp || productData.originalPrice || price * 1.2);

  const created = await Product.create({
    name,
    sku: String(productId),
    salePrice: price,
    mrp: mrp,
    stock: 100,
    category: productData.category || 'Grocery',
    mainImage: productData.image || productData.mainImage || '',
  });

  return created;
};

const readVariant = (source = {}) => {
  const nested = source.selectedVariant || {};
  const selectedAttributes = readCustomerAttributes(source);
  const variantSku = String(source.variantSku || nested.sku || '').trim();
  const variantId = String(source.variantId || nested._id || '').trim();
  const variantTitle = String(
    source.variantTitle || source.variation || nested.title || ''
  ).trim();
  return { variantSku, variantId, variantTitle, selectedAttributes };
};

const variantKey = (variant) => {
  if (variant.variantSku) return `sku:${variant.variantSku}`;
  const parts = Object.keys(variant.selectedAttributes || {})
    .sort()
    .map((key) => `${key}=${variant.selectedAttributes[key]}`);
  return parts.join('|');
};

const cartLineKey = (productId, variant) => {
  const key = variantKey(variant);
  return key ? `${productId}::${key}` : String(productId);
};

const sameVariant = (item, variant) => {
  const stored = readVariant(item);
  return variantKey(stored) === variantKey(variant);
};

const applyVariant = (entry, variant, extras = {}) => {
  entry.variantSku = variant.variantSku || '';
  entry.variantId = variant.variantId || '';
  entry.variantTitle = variant.variantTitle || '';
  entry.selectedAttributes = Object.keys(variant.selectedAttributes || {}).length
    ? variant.selectedAttributes
    : undefined;
  const snapshot = rowsFromAttributes(variant.selectedAttributes, variant.variantId);
  entry.selectedVariants = snapshot.length ? snapshot : undefined;
  if (extras.price !== undefined && extras.price !== null && extras.price !== '') {
    entry.price = Number(extras.price);
  }
  if (extras.originalPrice !== undefined && extras.originalPrice !== null && extras.originalPrice !== '') {
    entry.originalPrice = Number(extras.originalPrice);
  }
  if (extras.image) entry.image = extras.image;
};

// Drop cart entries whose referenced product was deleted and consolidate any duplicates
const deduplicateAndPruneCart = async (user) => {
  if (!Array.isArray(user.cart) || user.cart.length === 0) return;

  // 1. Filter out null/dangling product references
  const validItems = user.cart.filter((item) => item && item.product);

  // 2. Consolidate duplicates by product + selected variant (color, size, etc.)
  const map = new Map();
  for (const item of validItems) {
    const prodIdStr = typeof item.product === 'object' && item.product._id
      ? item.product._id.toString()
      : item.product.toString();
    const variant = readVariant(item);
    const lineKey = cartLineKey(prodIdStr, variant);

    if (map.has(lineKey)) {
      map.get(lineKey).quantity += Number(item.quantity || 1);
    } else {
      map.set(lineKey, {
        product: item.product,
        quantity: Math.max(1, Number(item.quantity || 1)),
        variantSku: variant.variantSku,
        variantId: variant.variantId,
        variantTitle: variant.variantTitle,
        selectedAttributes: Object.keys(variant.selectedAttributes).length
          ? variant.selectedAttributes
          : undefined,
        selectedVariants: rowsFromAttributes(variant.selectedAttributes, variant.variantId),
        price: item.price,
        originalPrice: item.originalPrice,
        image: item.image || '',
        _id: item._id,
      });
    }
  }

  const consolidated = Array.from(map.values());
  const needsSave = user.cart.length !== consolidated.length;
  user.cart = consolidated;
  if (needsSave) {
    await user.save();
  }
};

// Get user cart directly from User document
export const getCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).populate('cart.product');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await deduplicateAndPruneCart(user);

    res.status(200).json({
      success: true,
      cart: {
        items: user.cart || [],
      },
    });
  } catch (error) {
    next(error);
  }
};

// Add item to cart inside User document
export const addToCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { productId, quantity = 1, product: productPayload, variantSku, variantId, variantTitle, selectedAttributes, selectedVariants, price, originalPrice, image } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required' });
    }

    const product = await findOrCreateProduct(productId, productPayload);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const eligibility = await evaluateProductSellerEligibility(product);
    if (!eligibility.eligible) {
      return res.status(403).json({
        success: false,
        message: eligibility.message || 'This product is not available from an eligible store.',
        reason: eligibility.reason,
      });
    }

    if (product.stock !== undefined && product.stock <= 0) {
      return res.status(400).json({ success: false, message: 'Product is out of stock' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.cart) user.cart = [];

    const targetDbId = product._id.toString();
    const variant = readVariant({
      ...(productPayload || {}),
      variantSku,
      variantId,
      variantTitle,
      selectedAttributes,
      selectedVariants,
    });
    const extras = {
      price: price ?? productPayload?.price ?? productPayload?.salePrice,
      originalPrice: originalPrice ?? productPayload?.originalPrice ?? productPayload?.mrp,
      image: image || productPayload?.image || productPayload?.mainImage || '',
    };
    const existingIndex = user.cart.findIndex(
      (item) => item.product && item.product.toString() === targetDbId && sameVariant(item, variant)
    );

    if (existingIndex > -1) {
      user.cart[existingIndex].quantity += Number(quantity);
      applyVariant(user.cart[existingIndex], variant, extras);
    } else {
      const entry = { product: product._id, quantity: Number(quantity) };
      applyVariant(entry, variant, extras);
      user.cart.push(entry);
    }

    await user.save();
    await user.populate('cart.product');
    await deduplicateAndPruneCart(user);

    res.status(200).json({
      success: true,
      message: 'Item added to cart',
      cart: {
        items: user.cart || [],
      },
    });
  } catch (error) {
    console.error('Error in addToCart controller:', error);
    next(error);
  }
};

// Update cart item quantity inside User document
export const updateCartItem = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      productId,
      delta,
      quantity,
      product: productPayload,
      variantSku,
      variantId,
      variantTitle,
      selectedAttributes,
      selectedVariants,
      price,
      originalPrice,
      image,
      replaceLine,
      previousVariantSku,
      previousSelectedAttributes,
    } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required' });
    }

    const product = await findOrCreateProduct(productId, productPayload);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const targetDbId = product._id.toString();
    const variant = readVariant({
      ...(productPayload || {}),
      variantSku,
      variantId,
      variantTitle,
      selectedAttributes,
      selectedVariants,
    });
    const extras = {
      price: price ?? productPayload?.price ?? productPayload?.salePrice,
      originalPrice: originalPrice ?? productPayload?.originalPrice ?? productPayload?.mrp,
      image: image || productPayload?.image || productPayload?.mainImage || '',
    };

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.cart) user.cart = [];

    if (replaceLine) {
      const previous = readVariant({
        variantSku: previousVariantSku,
        selectedAttributes: previousSelectedAttributes,
      });
      const prevIndex = user.cart.findIndex(
        (item) => item.product && item.product.toString() === targetDbId && sameVariant(item, previous)
      );
      const nextIndex = user.cart.findIndex(
        (item) => item.product && item.product.toString() === targetDbId && sameVariant(item, variant)
      );

      if (prevIndex > -1 && nextIndex > -1 && prevIndex !== nextIndex) {
        user.cart.splice(prevIndex, 1);
      } else if (prevIndex > -1) {
        applyVariant(user.cart[prevIndex], variant, extras);
        if (quantity !== undefined) {
          user.cart[prevIndex].quantity = Math.max(1, Number(quantity));
        }
      } else if (nextIndex === -1 && Number(quantity) > 0) {
        const entry = { product: product._id, quantity: Math.max(1, Number(quantity)) };
        applyVariant(entry, variant, extras);
        user.cart.push(entry);
      }

      await user.save();
      await user.populate('cart.product');
      await deduplicateAndPruneCart(user);

      return res.status(200).json({
        success: true,
        message: 'Cart updated successfully',
        cart: { items: user.cart || [] },
      });
    }

    const existingIndex = user.cart.findIndex(
      (item) => item.product && item.product.toString() === targetDbId && sameVariant(item, variant)
    );

    let targetQty = 1;

    if (existingIndex > -1) {
      if (quantity !== undefined) {
        targetQty = Number(quantity);
      } else if (delta !== undefined) {
        targetQty = user.cart[existingIndex].quantity + Number(delta);
      } else {
        targetQty = user.cart[existingIndex].quantity;
      }

      if (targetQty <= 0) {
        user.cart.splice(existingIndex, 1);
      } else {
        user.cart[existingIndex].quantity = targetQty;
        // Quantity-only updates must NOT wipe existing variant selection
        const hasVariantPayload = Boolean(
          variant.variantSku
          || variant.variantId
          || Object.keys(variant.selectedAttributes || {}).length
        );
        if (hasVariantPayload) {
          applyVariant(user.cart[existingIndex], variant, extras);
        } else if (extras.price !== undefined && extras.price !== null && extras.price !== '') {
          user.cart[existingIndex].price = Number(extras.price);
        }
      }
    } else {
      if (quantity !== undefined) {
        targetQty = Number(quantity);
      } else if (delta !== undefined) {
        targetQty = Math.max(1, Number(delta));
      }

      if (targetQty > 0) {
        const entry = { product: product._id, quantity: targetQty };
        applyVariant(entry, variant, extras);
        user.cart.push(entry);
      }
    }

    await user.save();
    await user.populate('cart.product');
    await deduplicateAndPruneCart(user);

    res.status(200).json({
      success: true,
      message: 'Cart updated successfully',
      cart: {
        items: user.cart || [],
      },
    });
  } catch (error) {
    next(error);
  }
};

// Remove item from cart inside User document
export const removeFromCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { productId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const product = await findOrCreateProduct(productId);
    const targetDbId = product ? product._id.toString() : String(productId);
    let parsedAttrs;
    if (req.query.attrs) {
      try {
        parsedAttrs = JSON.parse(req.query.attrs);
      } catch {
        parsedAttrs = undefined;
      }
    }
    const variant = readVariant({
      variantSku: req.query.variantSku,
      selectedAttributes: parsedAttrs,
    });
    const hasVariantFilter = Boolean(variantKey(variant));

    if (user.cart) {
      user.cart = user.cart.filter((item) => {
        if (!item.product) return false;
        const sameProduct = item.product.toString() === targetDbId || item.product.toString() === String(productId);
        if (!sameProduct) return true;
        if (!hasVariantFilter) return false;
        return !sameVariant(item, variant);
      });
      await user.save();
      await user.populate('cart.product');
      await deduplicateAndPruneCart(user);
    }

    res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      cart: {
        items: user.cart || [],
      },
    });
  } catch (error) {
    next(error);
  }
};

// Clear cart inside User document
export const clearCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    if (user) {
      user.cart = [];
      await user.save();
    }
    res.status(200).json({
      success: true,
      message: 'Cart cleared successfully',
      cart: { items: [] },
    });
  } catch (error) {
    next(error);
  }
};

// Sync bulk cart items into User document
export const syncCart = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { items = [] } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.cart) user.cart = [];

    for (const item of items) {
      const prodId = item.productId || item.id || item._id;
      const product = await findOrCreateProduct(prodId, item);
      if (product) {
        const variant = readVariant(item);
        const existingIndex = user.cart.findIndex(
          (i) => i.product && i.product.toString() === product._id.toString() && sameVariant(i, variant)
        );
        const extras = {
          price: item.price ?? item.salePrice,
          originalPrice: item.originalPrice ?? item.mrp,
          image: item.image || item.mainImage || '',
        };
        if (existingIndex > -1) {
          user.cart[existingIndex].quantity = Math.max(1, Number(item.quantity || user.cart[existingIndex].quantity));
          applyVariant(user.cart[existingIndex], variant, extras);
        } else {
          const entry = { product: product._id, quantity: Math.max(1, Number(item.quantity || 1)) };
          applyVariant(entry, variant, extras);
          user.cart.push(entry);
        }
      }
    }

    await user.save();
    await user.populate('cart.product');
    await pruneDanglingCartItems(user);

    res.status(200).json({
      success: true,
      message: 'Cart synced successfully',
      cart: {
        items: user.cart || [],
      },
    });
  } catch (error) {
    next(error);
  }
};
