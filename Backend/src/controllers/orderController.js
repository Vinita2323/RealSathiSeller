import mongoose from 'mongoose';
import Order from '../models/Order.model.js';
import Cart from '../models/Cart.model.js';
import Product from '../models/Product.model.js';
import User from '../models/User.model.js';
import Seller from '../models/Seller.model.js';
import SellerNotification from '../models/SellerNotification.model.js';
import WalletTransaction from '../models/WalletTransaction.model.js';
import Captain from '../models/Captain.model.js';
import CaptainNotification from '../models/CaptainNotification.model.js';
import PlatformLedger from '../models/PlatformLedger.model.js';
import CommissionSettings from '../models/CommissionSettings.model.js';
import DeliveryPricing from '../models/DeliveryPricing.model.js';
import RefundRequest from '../models/RefundRequest.model.js';
import {
  sendNotificationToUser, 
  sendNotificationToSeller, 
  sendNotificationToCaptain 
} from '../utils/pushNotificationHelper.js';
import { notifyUserOrderEvent } from '../utils/userNotificationHelper.js';
import { invalidateCaptainDashboardCache } from './captainController.js';
import {
  normalizeAttributes,
  readCustomerAttributes,
  freezeSelectedAttributes,
  missingOptionNames,
  rowsFromAttributes,
} from '../utils/selectedVariants.js';
import { evaluateProductSellerEligibility } from '../utils/sellerEligibility.js';
import { debitUserWallet } from '../utils/userWalletHelper.js';
import RepairDriver from '../models/RepairDriver.model.js';

// Helper: Clean base64 image strings or invalid dummy links
const cleanImage = (img) => {
  if (!img || typeof img !== 'string') return '';
  const trimmed = img.trim();
  if (trimmed.includes('photo-1586201375761-83865001e31c')) return '';
  return trimmed;
};

// High-speed In-memory Cache for Seller Notifications
const sellerNotifCache = new Map();
const sellerDocCache = new Map();
let sellerNotifCacheGeneration = 0;
export const invalidateSellerNotifCache = () => {
  sellerNotifCache.clear();
  sellerNotifCacheGeneration += 1;
};

// Helper: Generate delivery OTP
const genDeliveryOtp = () => Math.floor(1000 + Math.random() * 9000).toString();

// Helper: Find all eligible captains for a delivery
export const findAllEligibleCaptains = async (deliveryCity = '', deliveryState = '', deliveryPincode = '', sellerCity = '', sellerPincode = '', excludeCaptainIds = []) => {
  // Drivers added under Repair & Services as "repair only" never receive grocery orders
  const repairOnlyIds = await RepairDriver.distinct('captain', { repairOnly: true });
  const excludedIds = [...excludeCaptainIds, ...repairOnlyIds];

  // Only approved captains may receive deliveries (not pending / under-review / suspended ones)
  const baseFilter = {
    $and: [
      { $or: [{ status: 'approved' }, { accountStatus: 'approved' }] },
      { status: { $nin: ['rejected', 'suspended'] } },
      { accountStatus: { $nin: ['rejected', 'suspended'] } },
    ],
    ...(excludedIds.length ? { _id: { $nin: excludedIds } } : {}),
  };

  const cleanCity = (deliveryCity || sellerCity || '').trim();
  const cleanPincode = (deliveryPincode || sellerPincode || '').trim();
  const cleanState = (deliveryState || '').trim();

  // Tier 1: Match by Pincode / Local Area
  if (cleanPincode) {
    const pinCaptains = await Captain.find({
      ...baseFilter,
      isOnline: true,
      $or: [
        { pinCode: cleanPincode },
        { currentAddress: { $regex: cleanPincode, $options: 'i' } },
        { permanentAddress: { $regex: cleanPincode, $options: 'i' } },
        { 'workingArea.area': { $regex: cleanPincode, $options: 'i' } },
      ],
    }).sort({ createdAt: 1 });
    if (pinCaptains.length > 0) return pinCaptains;
  }

  // Tier 2: Match by City / Working Area
  if (cleanCity) {
    const cityCaptains = await Captain.find({
      ...baseFilter,
      isOnline: true,
      $or: [
        { city: { $regex: cleanCity, $options: 'i' } },
        { currentAddress: { $regex: cleanCity, $options: 'i' } },
        { 'workingArea.city': { $regex: cleanCity, $options: 'i' } },
        { 'workingArea.district': { $regex: cleanCity, $options: 'i' } },
      ],
    }).sort({ createdAt: 1 });
    if (cityCaptains.length > 0) return cityCaptains;
  }

  // Tier 3: Match by State
  if (cleanState) {
    const stateCaptains = await Captain.find({
      ...baseFilter,
      isOnline: true,
      $or: [
        { state: { $regex: cleanState, $options: 'i' } },
        { 'workingArea.state': { $regex: cleanState, $options: 'i' } },
      ],
    }).sort({ createdAt: 1 });
    if (stateCaptains.length > 0) return stateCaptains;
  }

  // Tier 4: All online captains
  const allOnline = await Captain.find({ ...baseFilter, isOnline: true }).sort({ updatedAt: -1 });
  if (allOnline.length > 0) return allOnline;

  // Fallback: approved captains who are currently offline (they see the job once they go online)
  return Captain.find(baseFilter).sort({ updatedAt: -1 }).limit(10);
};

const notifyCaptainsOfPackedOrder = async (parentOrder, notification, captains, captainEarnings, deliveryCity) => {
  for (const captain of captains) {
    const recentOffer = await CaptainNotification.findOne({
      captainId: captain._id,
      order: parentOrder._id,
      type: 'JOB_ASSIGNED',
      createdAt: { $gte: new Date(Date.now() - 60 * 1000) },
    }).select('_id');
    if (!recentOffer) {
      await CaptainNotification.create({
        captainId: captain._id,
        type: 'JOB_ASSIGNED',
        title: 'New Delivery Assigned!',
        message: `Order #${notification.orderId} from ${notification.sellerName || 'Seller'} — Drop: ${deliveryCity || 'Customer Address'}. Payout: ₹${captainEarnings.toFixed(2)}. Report to pickup immediately.`,
        orderId: notification.orderId,
        order: parentOrder._id,
        amount: captainEarnings,
        icon: 'local_shipping',
      });
      sendNotificationToCaptain(captain._id, {
        title: '🛵 New Delivery Assigned!',
        body: `Order #${notification.orderId} — Pickup from ${notification.sellerName || 'Store'}. Payout: ₹${captainEarnings.toFixed(2)}`,
        data: {
          type: 'delivery_assigned',
          orderId: notification.orderId,
          link: '/captain/dashboard',
        },
      }).catch(() => {});
    }
    invalidateCaptainDashboardCache(captain._id);
  }
};

// Helper: Auto-assign captain and create notification
export const autoAssignCaptainToOrder = async (notification) => {
  try {
    const parentOrder = await Order.findById(notification.order);
    if (!parentOrder) return null;

    const deliveryCity = notification.deliveryAddress?.city || parentOrder.shippingAddress?.city || '';
    let captainCommRate = parentOrder.captainCommissionRate;
    if (captainCommRate === undefined || captainCommRate === null) {
      try {
        const commSettings = await CommissionSettings.getOrCreateActiveSettings();
        captainCommRate = commSettings?.captainCommission || 5;
      } catch (e) {
        captainCommRate = 5;
      }
    }
    const captainEarnings = parentOrder.captainEarnings > 0
      ? parentOrder.captainEarnings
      : Math.max(15, Math.round(((notification.totalAmount || parentOrder.grandTotal || 0) * (captainCommRate / 100)) * 100) / 100);

    if (parentOrder.captainId && parentOrder.captainStatus !== 'Rejected') {
      const assignedCaptain = await Captain.findById(parentOrder.captainId).select('name phone');
      if (assignedCaptain) {
        parentOrder.captainAssignedAt = new Date();
        await parentOrder.save();
        await notifyCaptainsOfPackedOrder(parentOrder, notification, [assignedCaptain], captainEarnings, deliveryCity);
        return assignedCaptain;
      }
    }

    if (!parentOrder.captainId || parentOrder.captainStatus === 'Rejected') {
      const deliveryCity = notification.deliveryAddress?.city || parentOrder.shippingAddress?.city || '';
      const deliveryState = notification.deliveryAddress?.state || parentOrder.shippingAddress?.state || '';
      const deliveryPincode = notification.deliveryAddress?.pincode || parentOrder.shippingAddress?.pinCode || parentOrder.shippingAddress?.pincode || '';
      
      // Look up seller city/pincode for pickup location proximity
      let sellerCity = '';
      let sellerPincode = '';
      if (notification.sellerId) {
        try {
          const sellerDoc = await Seller.findById(notification.sellerId);
          if (sellerDoc) {
            sellerCity = sellerDoc.city || sellerDoc.warehouseLocation?.city || '';
            sellerPincode = sellerDoc.pinCode || sellerDoc.warehouseLocation?.pincode || '';
          }
        } catch (e) {}
      }

      // Fetch dynamic active captain commission rate
      let captainCommRate = parentOrder.captainCommissionRate;
      if (captainCommRate === undefined || captainCommRate === null) {
        try {
          const commSettings = await CommissionSettings.getOrCreateActiveSettings();
          captainCommRate = commSettings?.captainCommission || 5;
        } catch (e) {
          captainCommRate = 5;
        }
      }

      const captainEarnings = parentOrder.captainEarnings > 0 
        ? parentOrder.captainEarnings 
        : Math.max(15, Math.round(((notification.totalAmount || parentOrder.grandTotal || 0) * (captainCommRate / 100)) * 100) / 100);

      // On re-dispatch after a rejection, skip captains who were already offered this order
      let alreadyOffered = [];
      if (parentOrder.captainStatus === 'Rejected') {
        alreadyOffered = await CaptainNotification.distinct('captainId', {
          order: parentOrder._id,
          type: 'JOB_ASSIGNED',
        });
      }

      const eligibleCaptains = await findAllEligibleCaptains(deliveryCity, deliveryState, deliveryPincode, sellerCity, sellerPincode, alreadyOffered);

      if (eligibleCaptains && eligibleCaptains.length > 0) {
        const nearestCaptain = eligibleCaptains[0];
        const otp = genDeliveryOtp();
        const pickupOtp = parentOrder.pickupOtp || notification.pickupOtp || genDeliveryOtp();

        const claimed = await Order.findOneAndUpdate(
          {
            _id: parentOrder._id,
            $or: [
              { captainId: null },
              { captainId: { $exists: false } },
              { captainStatus: 'Rejected' },
            ],
          },
          {
            captainId: nearestCaptain._id,
            captainStatus: 'Assigned',
            deliveryOtp: otp,
            pickupOtp,
            captainCommissionRate: captainCommRate,
            captainCommissionAmount: Math.round(((notification.totalAmount || parentOrder.grandTotal || 0) * (captainCommRate / 100)) * 100) / 100,
            captainEarnings,
            captainEarning: captainEarnings,
            captainAssignedAt: new Date(),
          },
          { new: true }
        );
        if (!claimed) return null;

        // Save assigned captain info on SellerNotification too
        notification.captainId = nearestCaptain._id;
        notification.captainName = nearestCaptain.name || 'Delivery Captain';
        notification.captainPhone = nearestCaptain.phone || '';
        notification.pickupOtp = pickupOtp;
        await notification.save();

        // Only the assigned captain can see/accept this job, so only notify them
        await notifyCaptainsOfPackedOrder(
          claimed,
          notification,
          [nearestCaptain],
          captainEarnings,
          deliveryCity
        );

        console.log(`[CaptainAssign] Dispatched Order #${notification.orderId} to captain "${nearestCaptain.name}" - ${nearestCaptain.phone} (${eligibleCaptains.length} eligible). OTP: ${otp}, Payout: ₹${captainEarnings}`);
        return nearestCaptain;
      } else {
        console.warn(`[CaptainAssign] No approved/active captain found for Order #${notification.orderId} in ${deliveryCity || 'any area'}.`);
      }
    }
  } catch (err) {
    console.error(`[CaptainAssign ERROR] Failed to auto-assign captain for Order #${notification.orderId}:`, err.message);
  }
  return null;
};


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
    seller: productData.seller || 'Sathi Seller Official Store',
  });

  return created;
};

const pickOrderedVariant = (product, item = {}) => {
  const nested = item.selectedVariant || {};
  const selectedAttributes = readCustomerAttributes(item);
  const variantSku = String(item.variantSku || nested.sku || '').trim();
  const variantId = String(item.variantId || nested._id || '').trim();
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  let matched = null;
  if (variantSku) {
    matched = variants.find((variant) => String(variant.sku || '').trim() === variantSku) || null;
  }
  if (!matched && variantId) {
    matched = variants.find((variant) => String(variant._id || '') === variantId) || null;
  }
  if (!matched && Object.keys(selectedAttributes).length) {
    matched = variants.find((variant) => {
      const attrs = normalizeAttributes(variant.attributes);
      return Object.entries(selectedAttributes).every(([key, value]) => {
        const attrKey = Object.keys(attrs).find((name) => name.toLowerCase() === key.toLowerCase());
        return attrKey && attrs[attrKey] === value;
      });
    }) || null;
  }
  const variantTitle = String(
    matched?.title || item.variantTitle || item.variation || nested.title || ''
  ).trim();
  const frozenAttributes = freezeSelectedAttributes(
    selectedAttributes,
    matched,
    Boolean(variantSku || variantId)
  );
  return {
    matched,
    variantSku: String(matched?.sku || variantSku || '').trim(),
    variantId: String(matched?._id || variantId || '').trim(),
    variantTitle,
    selectedAttributes: frozenAttributes,
  };
};

// WALLET = Sathi Seller in-app balance (instant debit). UPI/CARD/NETBANKING go through Razorpay.
const ONLINE_PAYMENT_METHODS = ['UPI', 'CARD', 'NETBANKING', 'ONLINE'];
const isWalletPaymentMethod = (method) => String(method || '').toUpperCase() === 'WALLET';

const isOnlinePaymentMethod = (method) => ONLINE_PAYMENT_METHODS.includes(String(method || '').toUpperCase());

const orderItemSignature = (items = []) => items
  .map((item) => `${item.product}|${item.variantSku || ''}|${item.quantity}`)
  .sort()
  .join(',');

const adjustOrderStock = async (orderItems, direction) => {
  const held = [];
  for (const orderItem of orderItems) {
    const qty = Number(orderItem.quantity) * direction;
    const filter = orderItem.variantSku
      ? {
          _id: orderItem.product,
          'variants.sku': orderItem.variantSku,
          ...(direction < 0 ? { stock: { $gte: orderItem.quantity }, 'variants.stock': { $gte: orderItem.quantity } } : {}),
        }
      : {
          _id: orderItem.product,
          ...(direction < 0 ? { stock: { $gte: orderItem.quantity } } : {}),
        };
    const update = orderItem.variantSku
      ? { $inc: { 'variants.$.stock': qty, stock: qty } }
      : { $inc: { stock: qty } };
    const result = await Product.updateOne(filter, update);
    if (result.modifiedCount !== 1) {
      if (direction < 0 && held.length) await adjustOrderStock(held, 1);
      return false;
    }
    held.push(orderItem);
  }
  return true;
};

const releaseStockHold = async (order) => {
  if (!order || order.stockHold !== 'reserved' || order.paymentStatus === 'Paid') return false;
  const released = await Order.findOneAndUpdate(
    { _id: order._id, stockHold: 'reserved', paymentStatus: { $ne: 'Paid' } },
    { $set: { stockHold: 'released', paymentStatus: 'Failed', orderStatus: 'Cancelled' } }
  );
  if (!released) return false;
  await adjustOrderStock(order.items || [], 1);
  // Payment failed → Order Failed (not Cancelled) for customer inbox
  if (order.user && order.orderId) {
    notifyUserOrderEvent({
      userId: order.user,
      orderId: order.orderId,
      order: order._id,
      type: 'ORDER_FAILED',
    });
  }
  return true;
};

const createSellerOrderNotifications = async ({ order, orderItems, shippingAddress, userDoc, paymentMethod, orderPickupOtp, globalSellerCommRate, paymentStatus = 'Paid' }) => {
  const existing = await SellerNotification.findOne({ order: order._id }).select('_id').lean();
  if (existing) return;

  const sellerGroups = {};
  for (const item of orderItems) {
    const sellerName = item.seller || 'Sathi Seller Official Store';
    if (!sellerGroups[sellerName]) sellerGroups[sellerName] = [];
    sellerGroups[sellerName].push(item);
  }

  await Promise.all(Object.entries(sellerGroups).map(async ([sellerName, groupItems]) => {
    const groupSubtotal = groupItems.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);
    let sellerDoc = null;
    if (mongoose.Types.ObjectId.isValid(sellerName)) {
      sellerDoc = await Seller.findById(sellerName).lean();
    }
    if (!sellerDoc) {
      sellerDoc = await Seller.findOne({
        $or: [{ phone: sellerName }, { businessName: sellerName }, { ownerName: sellerName }],
      }).lean();
    }

    const assignedSellerId = sellerDoc ? String(sellerDoc._id) : sellerName;
    const actualSellerName = sellerDoc ? (sellerDoc.businessName || sellerDoc.ownerName || sellerName) : sellerName;
    const commRate = Number(sellerDoc?.commissionPercentage !== undefined ? sellerDoc.commissionPercentage : globalSellerCommRate);
    const commAmount = Number(((groupSubtotal * commRate) / 100).toFixed(2));
    const netAmount = Number((groupSubtotal - commAmount).toFixed(2));

    await SellerNotification.create({
      sellerId: assignedSellerId,
      sellerName: actualSellerName,
      order: order._id,
      orderId: order.orderId,
      pickupOtp: orderPickupOtp,
      items: groupItems.map((it) => ({ ...it, image: cleanImage(it.image) })),
      customerDetails: {
        name: shippingAddress.fullName || userDoc?.name || 'Customer',
        phone: shippingAddress.phone || userDoc?.phone || '',
        email: shippingAddress.email || userDoc?.email || '',
      },
      deliveryAddress: shippingAddress,
      deliverySlot: order.deliverySlot,
        paymentMethod,
        paymentStatus,
      totalAmount: groupSubtotal,
      commissionRate: commRate,
      commissionAmount: commAmount,
      netSellerAmount: netAmount,
      settlementStatus: 'PENDING',
      status: 'NEW',
    });

    invalidateSellerNotifCache();
    setImmediate(() => {
      sendNotificationToSeller(assignedSellerId, {
        title: '🔔 New Order Received!',
        body: `Order #${order.orderId} from ${shippingAddress.fullName || 'Customer'} (₹${groupSubtotal.toFixed(2)}). Open to accept.`,
        data: { type: 'new_order', orderId: order.orderId, link: '/seller/orders' },
      }).catch(() => {});
    });
  }));
};

// Confirms an online order only after the Razorpay amount has already been checked.
// Safe to call from both checkout verification and the webhook.
export const confirmOnlinePayment = async (order, paymentMeta = {}) => {
  if (!order) return { ok: false, reason: 'missing_order' };
  if (!isOnlinePaymentMethod(order.paymentMethod)) return { ok: false, reason: 'not_online' };

  const expectedPaise = Math.round(Number(order.grandTotal) * 100);
  if (paymentMeta.amount != null && Number(paymentMeta.amount) !== expectedPaise) {
    return { ok: false, reason: 'amount_mismatch' };
  }
  if (paymentMeta.currency && String(paymentMeta.currency).toUpperCase() !== 'INR') {
    return { ok: false, reason: 'currency_mismatch' };
  }
  if (
    paymentMeta.razorpayOrderId
    && order.razorpay?.orderId
    && paymentMeta.razorpayOrderId !== order.razorpay.orderId
  ) {
    return { ok: false, reason: 'order_mismatch' };
  }

  if (order.paymentStatus === 'Paid' && order.orderStatus !== 'Payment Pending') {
    await createSellerOrderNotifications({
      order,
      orderItems: order.items,
      shippingAddress: order.shippingAddress,
      paymentMethod: order.paymentMethod,
      orderPickupOtp: order.pickupOtp,
      globalSellerCommRate: order.sellerCommissionRate,
    });
    return { ok: true, already: true, order };
  }

  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, paymentStatus: { $ne: 'Paid' }, orderStatus: 'Payment Pending' },
    {
      $set: {
        paymentStatus: 'Paid',
        orderStatus: 'Placed',
        sellerStatus: 'Pending',
        stockHold: order.stockHold === 'reserved' ? 'finalized' : 'none',
        'razorpay.orderId': paymentMeta.razorpayOrderId || order.razorpay?.orderId || null,
        'razorpay.paymentId': paymentMeta.paymentId || order.razorpay?.paymentId || null,
        'razorpay.paymentStatus': 'captured',
        'razorpay.method': paymentMeta.method || order.razorpay?.method || null,
        'razorpay.amount': paymentMeta.amount ?? order.razorpay?.amount ?? null,
        'razorpay.currency': paymentMeta.currency || 'INR',
        'razorpay.capturedAt': new Date(),
        'razorpay.failedAt': null,
        'razorpay.failureCode': null,
        'razorpay.failureReason': null,
      },
    },
    { new: true }
  );

  if (!claimed) {
    const fresh = await Order.findById(order._id);
    if (fresh?.paymentStatus === 'Paid') return { ok: true, already: true, order: fresh };
    return { ok: false, reason: 'not_pending' };
  }

  if (claimed.stockHold !== 'finalized' && order.stockHold !== 'reserved') {
    const deducted = await adjustOrderStock(claimed.items, -1);
    if (!deducted) {
      await Order.updateOne(
        { _id: claimed._id, paymentStatus: 'Paid', orderStatus: 'Placed' },
        { $set: { orderStatus: 'Payment Pending', paymentStatus: 'Pending', stockHold: 'none' } }
      );
      return { ok: false, reason: 'insufficient_stock' };
    }
    await Order.updateOne({ _id: claimed._id }, { $set: { stockHold: 'finalized' } });
  }

  await createSellerOrderNotifications({
    order: claimed,
    orderItems: claimed.items,
    shippingAddress: claimed.shippingAddress,
    paymentMethod: claimed.paymentMethod,
    orderPickupOtp: claimed.pickupOtp,
    globalSellerCommRate: claimed.sellerCommissionRate,
  });
  await User.updateOne({ _id: claimed.user }, { $set: { cart: [] } });
  invalidateUserOrdersCache(String(claimed.user));
  notifyUserOrderEvent({
    userId: claimed.user,
    orderId: claimed.orderId,
    order: claimed._id,
    type: 'ORDER_PLACED',
  });
  setImmediate(() => {
    sendNotificationToUser(claimed.user, {
      title: 'Order Placed Successfully! 🎉',
      body: `Your order #${claimed.orderId} of ₹${claimed.grandTotal} has been placed. We are assigning the store.`,
      data: { type: 'order_placed', orderId: claimed.orderId, link: '/profile' },
    }).catch(() => {});
  });
  return { ok: true, order: claimed };
};

// Place Order
export const placeOrder = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      shippingAddress,
      deliverySlot = { date: 'Today', time: 'Express Delivery' },
      deliveryInstructions = '',
      paymentMethod = 'COD',
      items: rawBodyItems,
    } = req.body;

    if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.addressLine1 || !shippingAddress.phone) {
      return res.status(400).json({
        success: false,
        message: 'Valid shipping address with Full Name, Phone, and Street Address is required',
      });
    }

    // Retrieve user document to inspect cart array or rawBodyItems
    let userDoc = await User.findById(userId);
    let itemsToProcess = [];

    if (userDoc && userDoc.cart && userDoc.cart.length > 0) {
      const bodyItems = Array.isArray(rawBodyItems) ? rawBodyItems : [];
      itemsToProcess = userDoc.cart.map((cartItem) => {
        const plain = typeof cartItem.toObject === 'function' ? cartItem.toObject() : { ...cartItem };
        const productId = String(plain.product?._id || plain.product || '');
        const match = bodyItems.find((bodyItem) => {
          const bodyId = String(bodyItem.product?._id || bodyItem.product || bodyItem.productId || bodyItem.id || '');
          if (bodyId !== productId) return false;
          const bodySku = String(bodyItem.variantSku || '').trim();
          const cartSku = String(plain.variantSku || '').trim();
          if (bodySku || cartSku) return bodySku === cartSku;
          return true;
        });
        const hasStoredVariant = Boolean(
          plain.variantSku
          || plain.variantId
          || (plain.selectedAttributes && Object.keys(plain.selectedAttributes).length)
          || (Array.isArray(plain.selectedVariants) && plain.selectedVariants.length)
        );
        if (!match || hasStoredVariant) return plain;
        return {
          ...plain,
          variantSku: match.variantSku || '',
          variantId: match.variantId || '',
          variantTitle: match.variantTitle || '',
          selectedAttributes: match.selectedAttributes,
          selectedVariants: match.selectedVariants,
          image: match.image || plain.image,
        };
      });
    } else if (rawBodyItems && Array.isArray(rawBodyItems) && rawBodyItems.length > 0) {
      itemsToProcess = rawBodyItems;
    }

    if (!itemsToProcess || itemsToProcess.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Your cart is empty. Cannot place order.',
      });
    }

    // Parallel server-side validation of products, pricing, and stock
    const resolvedItems = await Promise.all(
      itemsToProcess.map(async (item) => {
        const targetProdId = item.product?._id || item.product || item.productId || item.id;
        const product = await findOrCreateProduct(targetProdId, item.product || item);
        return { item, product };
      })
    );

    let itemsTotal = 0;
    let totalOriginalPrice = 0;
    const orderItems = [];

    for (const { item, product } of resolvedItems) {
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `One or more products in your cart are no longer available.`,
        });
      }

      const eligibility = await evaluateProductSellerEligibility(product);
      if (!eligibility.eligible) {
        return res.status(403).json({
          success: false,
          message:
            eligibility.message ||
            `"${product.name}" is not available because the store is not eligible to sell.`,
          reason: eligibility.reason,
          productId: product._id,
        });
      }

      const qty = Math.max(1, Number(item.quantity || 1));
      const chosen = pickOrderedVariant(product, item);
      const missingOptions = missingOptionNames(product, chosen.selectedAttributes);
      if (missingOptions.length) {
        return res.status(400).json({
          success: false,
          message: `Select ${missingOptions.join(', ')} for "${product.name}" before placing the order.`,
        });
      }
      if (
        product.hasVariants
        && Array.isArray(product.variants)
        && product.variants.some((variant) => variant && variant.active !== false)
        && !chosen.matched
      ) {
        return res.status(400).json({
          success: false,
          message: `The selected options for "${product.name}" are not available.`,
        });
      }
      const availableStock = chosen.matched
        ? Number(chosen.matched.stock ?? product.stock ?? 0)
        : product.stock;

      if (availableStock !== undefined && availableStock < qty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}". Available: ${availableStock}, Requested: ${qty}`,
        });
      }

      const unitPrice = chosen.matched
        ? Number(chosen.matched.price || product.salePrice || product.price || item.price || 0)
        : Number(product.salePrice || product.price || item.price || 0);
      const originalUnitPrice = chosen.matched
        ? Number(chosen.matched.originalPrice || chosen.matched.price || product.mrp || product.originalPrice || unitPrice)
        : Number(product.mrp || product.originalPrice || item.originalPrice || unitPrice);

      itemsTotal += unitPrice * qty;
      totalOriginalPrice += originalUnitPrice * qty;

      orderItems.push({
        product: product._id,
        name: product.name,
        price: unitPrice,
        originalPrice: originalUnitPrice,
        quantity: qty,
        image: cleanImage(
          chosen.matched?.image || product.mainImage || product.image || item.image || (product.variants?.[0]?.image) || ''
        ) || chosen.matched?.image || product.mainImage || product.image || item.image || '',
        seller: product.seller || item.seller || 'Sathi Seller Official Store',
        variantSku: chosen.variantSku,
        variantId: chosen.variantId,
        sku: chosen.variantSku || String(product.sku || '').trim(),
        variantTitle: chosen.variantTitle,
        selectedAttributes: Object.keys(chosen.selectedAttributes || {}).length
          ? chosen.selectedAttributes
          : undefined,
        selectedVariants: rowsFromAttributes(chosen.selectedAttributes, chosen.variantId),
      });
    }

    // Fetch dynamic commission & centralized delivery pricing settings
    let globalSellerCommRate = 10;
    let globalCaptainCommRate = 5;
    let deliveryChargeRate = 40;
    let freeDeliveryMinOrderRate = 500;
    let isFreeDeliveryActive = true;
    let peakSurgeFee = 0;
    let codChargeRate = 9;
    let isCodChargeActive = true;
    try {
      const [commSettings, deliveryPricing] = await Promise.all([
        CommissionSettings.getOrCreateActiveSettings(),
        DeliveryPricing.getActiveConfig(),
      ]);

      if (commSettings) {
        globalSellerCommRate = Number(commSettings.sellerCommission !== undefined ? commSettings.sellerCommission : 10);
        globalCaptainCommRate = Number(commSettings.captainCommission !== undefined ? commSettings.captainCommission : 5);
      }

      if (deliveryPricing && deliveryPricing.isActive) {
        deliveryChargeRate = Number(deliveryPricing.baseDeliveryFee ?? 40);
        freeDeliveryMinOrderRate = Number(deliveryPricing.freeDeliveryThreshold ?? 500);
        isFreeDeliveryActive = Boolean(deliveryPricing.isFreeDeliveryEnabled ?? true);
        codChargeRate = Number(deliveryPricing.codCharge ?? commSettings?.codCharge ?? 9);
        isCodChargeActive = Boolean(deliveryPricing.isCodChargeEnabled ?? commSettings?.isCodChargeEnabled ?? true);
        if (deliveryPricing.peakSurge?.enabled) {
          peakSurgeFee = Number(deliveryPricing.peakSurge.surgeAmount || 0);
        }
      } else if (commSettings) {
        deliveryChargeRate = Number(commSettings.deliveryCharge !== undefined ? commSettings.deliveryCharge : 40);
        freeDeliveryMinOrderRate = Number(commSettings.freeDeliveryMinOrder !== undefined ? commSettings.freeDeliveryMinOrder : 500);
        isFreeDeliveryActive = commSettings.isFreeDeliveryEnabled !== undefined ? Boolean(commSettings.isFreeDeliveryEnabled) : true;
        codChargeRate = Number(commSettings.codCharge !== undefined ? commSettings.codCharge : 9);
        isCodChargeActive = commSettings.isCodChargeEnabled !== undefined ? Boolean(commSettings.isCodChargeEnabled) : true;
      }
    } catch (e) {
      console.warn('[OrderController] Error reading DeliveryPricing/CommissionSettings, using fallback rates:', e.message);
    }

    // Server-side calculation of totals using dynamic delivery rules & COD extra charges
    const isFreeShipping = itemsTotal === 0 || (isFreeDeliveryActive && itemsTotal >= freeDeliveryMinOrderRate);
    const shippingFee = isFreeShipping ? 0 : (deliveryChargeRate + peakSurgeFee);
    const isCodPayment = String(paymentMethod).toUpperCase() === 'COD';
    const codCharge = (isCodPayment && isCodChargeActive) ? Number(codChargeRate || 0) : 0;
    const discount = Math.max(0, totalOriginalPrice - itemsTotal);
    const gst = 0; // GST included in prices
    const grandTotal = Number((itemsTotal + shippingFee + codCharge).toFixed(2));

    const walletPayment = isWalletPaymentMethod(paymentMethod);
    const onlinePayment = isOnlinePaymentMethod(paymentMethod);

    if (walletPayment) {
      if (!userDoc) {
        userDoc = await User.findById(userId).select('walletBalance name phone email cart');
      }
      const available = Number(userDoc?.walletBalance || 0);
      if (available < grandTotal) {
        return res.status(400).json({
          success: false,
          message: `Insufficient Sathi Seller Wallet balance. Available ₹${available.toFixed(2)}, required ₹${grandTotal.toFixed(2)}.`,
          walletBalance: available,
        });
      }
    }

    const pendingCutoff = new Date(Date.now() - 30 * 60 * 1000);
    if (onlinePayment) {
      const openPending = await Order.find({
        user: userId,
        orderStatus: 'Payment Pending',
        paymentStatus: { $ne: 'Paid' },
        stockHold: 'reserved',
      });
      const signature = orderItemSignature(orderItems);
      let reusable = null;
      for (const pending of openPending) {
        const expired = pending.createdAt < pendingCutoff;
        const sameCart = orderItemSignature(pending.items) === signature
          && Math.round(Number(pending.grandTotal) * 100) === Math.round(grandTotal * 100);
        if (!expired && sameCart && !reusable) {
          reusable = pending;
          continue;
        }
        await releaseStockHold(pending);
      }
      if (reusable) {
        return res.status(200).json({
          success: true,
          awaitingPayment: true,
          message: 'Complete payment to place this order.',
          order: reusable,
        });
      }
    }

    // Generate Order ID
    const orderId = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const sellerCommissionAmount = Number(((itemsTotal * globalSellerCommRate) / 100).toFixed(2));
    const sellerEarning = Number((itemsTotal - sellerCommissionAmount).toFixed(2));

    const captainCommissionAmount = Number(((grandTotal * globalCaptainCommRate) / 100).toFixed(2));
    const captainEarnings = Math.max(15, Math.round(captainCommissionAmount * 100) / 100);
    const orderPickupOtp = Math.floor(1000 + Math.random() * 9000).toString();
    const orderDeliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();

    // Create order document in MongoDB with frozen rate snapshots
    const order = await Order.create({
      orderId,
      user: userId,
      items: orderItems,
      shippingAddress,
      deliverySlot,
      deliveryInstructions,
      paymentMethod,
      paymentStatus: walletPayment ? 'Paid' : 'Pending',
      orderStatus: isOnlinePaymentMethod(paymentMethod) ? 'Payment Pending' : 'Placed',
      sellerStatus: 'Pending',
      stockHold: 'none',
      itemsTotal,
      shippingFee,
      codCharge,
      discount,
      gst,
      grandTotal,
      sellerCommissionRate: globalSellerCommRate,
      sellerCommissionAmount,
      sellerEarning,
      captainCommissionRate: globalCaptainCommRate,
      captainCommissionAmount,
      captainEarnings,
      captainEarning: captainEarnings,
      pickupOtp: orderPickupOtp,
      deliveryOtp: orderDeliveryOtp,
    });

    console.log(`[OrderController] Successfully created Order in MongoDB: OrderID=${order.orderId}, UserID=${userId}, ItemsTotal=₹${itemsTotal}, Shipping=₹${shippingFee}, COD=₹${codCharge}, GrandTotal=₹${grandTotal}`);

    let walletBalanceAfter = null;
    if (walletPayment) {
      const debit = await debitUserWallet({
        userId,
        amount: grandTotal,
        category: 'ORDER_PAYMENT',
        orderId: order.orderId,
        order: order._id,
        description: `Payment for order #${order.orderId}`,
      });
      if (!debit.success) {
        await Order.deleteOne({ _id: order._id });
        return res.status(400).json({
          success: false,
          message: debit.message || 'Wallet payment failed.',
          walletBalance: debit.balance,
        });
      }
      walletBalanceAfter = debit.balance;
      // Keep in-memory userDoc in sync so later userDoc.save() does not overwrite balance
      if (userDoc) {
        userDoc.walletBalance = debit.balance;
      }
    }

    if (onlinePayment) {
      const reserved = await adjustOrderStock(orderItems, -1);
      if (!reserved) {
        await Order.deleteOne({ _id: order._id });
        return res.status(400).json({
          success: false,
          message: 'Insufficient stock for one or more items.',
        });
      }
      order.stockHold = 'reserved';
      await order.save();
      invalidateUserOrdersCache(userId);
      return res.status(201).json({
        success: true,
        awaitingPayment: true,
        message: 'Complete payment to place this order.',
        order,
      });
    }

    // Parallel stock reduction for all ordered items
    const stockUpdates = orderItems.map((orderItem) => {
      if (orderItem.variantSku) {
        return Product.updateOne(
          { _id: orderItem.product, 'variants.sku': orderItem.variantSku },
          { $inc: { 'variants.$.stock': -orderItem.quantity, stock: -orderItem.quantity } }
        );
      }
      return Product.findByIdAndUpdate(orderItem.product, {
        $inc: { stock: -orderItem.quantity },
      });
    });

    // -------------------------------------------------------------
    // MULTI-SELLER ORDER SPLITTING & SELLER NOTIFICATION CREATION
    // -------------------------------------------------------------
    const sellerGroups = {};
    for (const item of orderItems) {
      const sellerName = item.seller || 'Sathi Seller Official Store';
      if (!sellerGroups[sellerName]) {
        sellerGroups[sellerName] = [];
      }
      sellerGroups[sellerName].push(item);
    }

    const sellerNotificationPromises = Object.entries(sellerGroups).map(async ([sellerName, groupItems]) => {
      const groupSubtotal = groupItems.reduce((acc, curr) => acc + (curr.price * curr.quantity), 0);

      // Try to find matching seller in Seller model
      let sellerDoc = null;
      if (mongoose.Types.ObjectId.isValid(sellerName)) {
        sellerDoc = await Seller.findById(sellerName).lean();
      }
      if (!sellerDoc) {
        sellerDoc = await Seller.findOne({
          $or: [
            { phone: sellerName },
            { businessName: sellerName },
            { ownerName: sellerName },
          ],
        }).lean();
      }

      const assignedSellerId = sellerDoc ? String(sellerDoc._id) : sellerName;
      const actualSellerName = sellerDoc ? (sellerDoc.businessName || sellerDoc.ownerName || sellerName) : sellerName;
      const commRate = Number(sellerDoc?.commissionPercentage !== undefined ? sellerDoc.commissionPercentage : globalSellerCommRate);
      const commAmount = Number(((groupSubtotal * commRate) / 100).toFixed(2));
      const netAmount = Number((groupSubtotal - commAmount).toFixed(2));

      const notification = await SellerNotification.create({
        sellerId: assignedSellerId,
        sellerName: actualSellerName,
        order: order._id,
        orderId: order.orderId,
        pickupOtp: orderPickupOtp,
        items: groupItems.map(it => ({ ...it, image: cleanImage(it.image) })),
        customerDetails: {
          name: shippingAddress.fullName || userDoc?.name || 'Customer',
          phone: shippingAddress.phone || userDoc?.phone || '',
          email: shippingAddress.email || userDoc?.email || '',
        },
        deliveryAddress: shippingAddress,
        deliverySlot,
        paymentMethod,
        paymentStatus: order.paymentStatus,
        totalAmount: groupSubtotal,
        commissionRate: commRate,
        commissionAmount: commAmount,
        netSellerAmount: netAmount,
        settlementStatus: 'PENDING',
        status: 'NEW',
      });

      invalidateSellerNotifCache();

      // Asynchronous non-blocking push notification to seller
      setImmediate(() => {
        sendNotificationToSeller(assignedSellerId, {
          title: '🔔 New Order Received!',
          body: `Order #${order.orderId} from ${shippingAddress.fullName || 'Customer'} (₹${groupSubtotal.toFixed(2)}). Open to accept.`,
          data: {
            type: 'new_order',
            orderId: order.orderId,
            link: '/seller/orders',
          },
        }).catch(() => {});
      });

      console.log(`[SellerNotification] Created notification for Seller "${actualSellerName}" (SellerID: ${assignedSellerId}, Gross: ₹${groupSubtotal}, Comm: ${commRate}% = ₹${commAmount}, Net: ₹${netAmount}) for Order ${order.orderId}`);
      return notification;
    });

    // Execute stock updates and seller notifications concurrently
    await Promise.all([...stockUpdates, ...sellerNotificationPromises]);
    await Order.updateOne({ _id: order._id }, { $set: { stockHold: 'finalized' } });

    notifyUserOrderEvent({
      userId,
      orderId: order.orderId,
      order: order._id,
      type: 'ORDER_PLACED',
    });

    // Asynchronous non-blocking push notification to user
    setImmediate(() => {
      sendNotificationToUser(userId, {
        title: 'Order Placed Successfully! 🎉',
        body: `Your order #${order.orderId} of ₹${grandTotal} has been placed. We are assigning the store.`,
        data: {
          type: 'order_placed',
          orderId: order.orderId,
          link: '/profile',
        },
      }).catch(() => {});
    });

    // Clear user cart array in User collection after successful order creation
    let isUserUpdated = false;
    if (!userDoc) {
      userDoc = await User.findById(userId);
    }
    if (userDoc) {
      userDoc.cart = [];
      isUserUpdated = true;
    }

    if (userDoc) {
      const submittedName = req.body.name || req.body.fullName || (shippingAddress && shippingAddress.fullName) || '';
      const submittedEmail = req.body.email || (shippingAddress && shippingAddress.email) || '';
      const submittedPhone = req.body.phone || (shippingAddress && shippingAddress.phone) || '';

      // 1. Update Name if missing or default placeholder ("User", "Customer")
      if (submittedName && submittedName.trim().length > 0) {
        const cleanName = submittedName.trim();
        if (!userDoc.name || userDoc.name === 'User' || userDoc.name === 'Customer' || userDoc.name.trim() === '') {
          userDoc.name = cleanName;
          isUserUpdated = true;
        }
      }

      // 2. Update Email if missing/empty
      if (submittedEmail && submittedEmail.trim().length > 0) {
        const cleanEmail = submittedEmail.trim().toLowerCase();
        if (!userDoc.email || userDoc.email.trim() === '') {
          userDoc.email = cleanEmail;
          isUserUpdated = true;
        }
      }

      // 3. Update Phone if missing
      if (submittedPhone && submittedPhone.trim().length > 0) {
        const cleanPhone = submittedPhone.trim();
        if (!userDoc.phone || userDoc.phone.trim() === '') {
          userDoc.phone = cleanPhone;
          isUserUpdated = true;
        }
      }

      // 4. Save Shipping Address to User's saved addresses array if not already present
      if (shippingAddress && shippingAddress.addressLine1) {
        const cleanShippingName = (shippingAddress.fullName && shippingAddress.fullName !== 'User' && shippingAddress.fullName !== 'Customer')
          ? shippingAddress.fullName
          : (userDoc.name && userDoc.name !== 'User' && userDoc.name !== 'Customer' ? userDoc.name : 'Customer');

        shippingAddress.fullName = cleanShippingName;

        const addrLine1 = shippingAddress.addressLine1.trim().toLowerCase();
        const addrCity = (shippingAddress.city || '').trim().toLowerCase();
        const addrZip = (shippingAddress.pincode || shippingAddress.zip || '').trim();

        const existingAddressIndex = userDoc.addresses.findIndex((a) => {
          const l1 = (a.addressLine1 || a.address || '').trim().toLowerCase();
          const c = (a.city || '').trim().toLowerCase();
          const z = (a.pincode || a.zip || '').trim();
          return l1 === addrLine1 && c === addrCity && z === addrZip;
        });

        if (existingAddressIndex >= 0) {
          if (!userDoc.addresses[existingAddressIndex].fullName || userDoc.addresses[existingAddressIndex].fullName === 'User' || userDoc.addresses[existingAddressIndex].fullName === 'Customer') {
            userDoc.addresses[existingAddressIndex].fullName = cleanShippingName;
            isUserUpdated = true;
          }
        } else {
          userDoc.addresses.push({
            fullName: cleanShippingName,
            phone: shippingAddress.phone || userDoc.phone,
            altPhone: shippingAddress.altPhone || '',
            email: shippingAddress.email || userDoc.email,
            addressLine1: shippingAddress.addressLine1,
            addressLine2: shippingAddress.addressLine2 || '',
            landmark: shippingAddress.landmark || '',
            city: shippingAddress.city || 'Noida',
            state: shippingAddress.state || 'Uttar Pradesh',
            pincode: shippingAddress.pincode || shippingAddress.zip || '201301',
            country: shippingAddress.country || 'India',
            addressType: shippingAddress.addressType || shippingAddress.type || 'Home',
            isDefault: userDoc.addresses.length === 0,
          });
          isUserUpdated = true;
        }
      }

      // Also clean up any addresses containing placeholder names
      if (userDoc.name && userDoc.name !== 'User' && userDoc.name !== 'Customer') {
        userDoc.addresses.forEach((a) => {
          if (!a.fullName || a.fullName === 'User' || a.fullName === 'Customer') {
            a.fullName = userDoc.name;
            isUserUpdated = true;
          }
        });
      }

      if (isUserUpdated) {
        await userDoc.save();
        console.log(`[OrderController] Successfully updated User profile for User ID ${userId}: Name="${userDoc.name}", Email="${userDoc.email}"`);
      }
    }

    invalidateUserOrdersCache(userId);

    res.status(201).json({
      success: true,
      message: walletPayment ? 'Order placed successfully using Sathi Seller Wallet!' : 'Order placed successfully!',
      order,
      walletBalance: walletBalanceAfter,
      user: userDoc
        ? {
            id: userDoc._id,
            _id: userDoc._id,
            name: userDoc.name,
            email: userDoc.email,
            phone: userDoc.phone,
            role: userDoc.role,
            addresses: userDoc.addresses,
            walletBalance: Number(userDoc.walletBalance || walletBalanceAfter || 0),
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
};

// In-memory cache for user orders
const userOrdersCache = new Map();

export const invalidateUserOrdersCache = (userId) => {
  if (userId) {
    userOrdersCache.delete(String(userId));
  } else {
    userOrdersCache.clear();
  }
};

// Get User Orders (Ultra-Fast Response with In-Memory Caching & Lean Projection)
const releaseExpiredPaymentHolds = async (userId) => {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);
  const stale = await Order.find({
    user: userId,
    orderStatus: 'Payment Pending',
    stockHold: 'reserved',
    paymentStatus: { $ne: 'Paid' },
    createdAt: { $lt: cutoff },
  });
  let released = 0;
  for (const pending of stale) {
    if (await releaseStockHold(pending)) released += 1;
  }
  return released;
};

export const releaseAllExpiredPaymentHolds = async () => {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);
  const stale = await Order.find({
    orderStatus: 'Payment Pending',
    stockHold: 'reserved',
    paymentStatus: { $ne: 'Paid' },
    createdAt: { $lt: cutoff },
  }).limit(50);
  for (const pending of stale) {
    await releaseStockHold(pending);
  }
};

export const getUserOrders = async (req, res, next) => {
  try {
    const userId = String(req.user.id);
    const now = Date.now();
    const released = await releaseExpiredPaymentHolds(userId);
    if (released) userOrdersCache.delete(userId);

    // Cache hit (15 seconds TTL)
    if (!req.query.fresh && userOrdersCache.has(userId)) {
      const cached = userOrdersCache.get(userId);
      if (now - cached.timestamp < 15000) {
        return res.status(200).json(cached.data);
      }
    }

    const orders = await Order.find({ user: userId })
      .select('orderId items shippingAddress deliverySlot paymentMethod paymentStatus orderStatus returnStatus returnReason returnedAt refundStatus refundedAt sellerStatus rejectionReason itemsTotal shippingFee discount gst grandTotal createdAt updatedAt')
      .populate({ path: 'items.product', select: 'name mainImage image category' })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    const sanitizedOrders = (orders || []).map(order => {
      if (Array.isArray(order.items)) {
        order.items = order.items.map(it => {
          let resolvedImage = it.image;
          if (!resolvedImage || (typeof resolvedImage === 'string' && resolvedImage.includes('photo-1586201375761-83865001e31c'))) {
            resolvedImage = it.product?.mainImage || it.product?.image || '';
          }
          return {
            ...it,
            image: resolvedImage || it.image || '',
          };
        });
      }
      return order;
    });

    const responsePayload = {
      success: true,
      orders: sanitizedOrders,
    };

    userOrdersCache.set(userId, { data: responsePayload, timestamp: now });

    res.status(200).json(responsePayload);
  } catch (error) {
    next(error);
  }
};

// Get Order Details by ID (supports MongoDB _id or orderId string)
export const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    let order = await Order.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(id) ? id : null },
        { orderId: id },
      ],
    })
      .populate('captainId', 'name phone vehicleType liveLocation')
      .populate('items.product', 'name mainImage image price salePrice');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Auto-generate deliveryOtp if missing so customer can see it on /track-order
    if (!order.deliveryOtp && order.orderStatus !== 'Delivered' && order.orderStatus !== 'Cancelled' && order.orderStatus !== 'Rejected') {
      const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
      order.deliveryOtp = generatedOtp;
      await Order.findByIdAndUpdate(order._id, { deliveryOtp: generatedOtp });
    }

    const orderObj = order.toObject ? order.toObject() : order;
    if (Array.isArray(orderObj.items)) {
      orderObj.items = orderObj.items.map(it => {
        let resolvedImage = it.image;
        if (!resolvedImage || (typeof resolvedImage === 'string' && resolvedImage.includes('photo-1586201375761-83865001e31c'))) {
          resolvedImage = it.product?.mainImage || it.product?.image || '';
        }
        return {
          ...it,
          image: resolvedImage || it.image || '',
        };
      });
    }

    res.status(200).json({
      success: true,
      order: orderObj,
    });
  } catch (error) {
    next(error);
  }
};

// -------------------------------------------------------------------
// SELLER SPECIFIC ORDER & NOTIFICATION CONTROLLER ENDPOINTS
// -------------------------------------------------------------------

// @desc    Get Seller Incoming Notifications & Order History
// @route   GET /api/orders/seller/notifications
// @access  Private/Seller
export const getSellerNotifications = async (req, res, next) => {
  try {
    const sellerId = req.user?.id;
    if (!sellerId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const limit = req.query.limit !== undefined 
      ? (Number(req.query.limit) === 0 ? 0 : Math.min(50, Math.max(1, Number(req.query.limit)))) 
      : 20;
    const page = Math.max(1, Number(req.query.page) || 1);

    const now = Date.now();
    const cacheKey = `${sellerId}_p${page}_l${limit}`;
    const cached = sellerNotifCache.get(cacheKey);
    if (cached && (now - cached.timestamp < 3500)) {
      return res.status(200).json(cached.data);
    }

    let sellerDoc = sellerDocCache.get(sellerId)?.doc;
    if (!sellerDoc && mongoose.Types.ObjectId.isValid(sellerId)) {
      sellerDoc = await Seller.findById(sellerId).select('businessName ownerName phone').lean();
      if (sellerDoc) {
        sellerDocCache.set(sellerId, { doc: sellerDoc, timestamp: now });
      }
    }

    const possibleSellerKeys = [
      sellerId,
      sellerDoc?._id ? String(sellerDoc._id) : null,
      sellerDoc?.businessName,
      sellerDoc?.ownerName,
      sellerDoc?.phone
    ].filter(Boolean);

    const query = {
      $or: [
        { sellerId: { $in: possibleSellerKeys } },
        { sellerName: { $in: possibleSellerKeys } },
      ],
    };

    let dbQuery = SellerNotification.find(query)
      .select('sellerId sellerName order orderId items.name items.price items.originalPrice items.quantity items.image items.product items.variantSku items.variantId items.sku items.variantTitle items.selectedAttributes items.selectedVariants customerDetails deliveryAddress deliverySlot paymentMethod paymentStatus totalAmount status rejectionReason commissionRate commissionAmount netSellerAmount settlementStatus proofOfDeliveryUrl pickupOtp pickupOtpVerified pickupOtpVerifiedAt captainId captainName captainPhone viewedAt acceptedAt rejectedAt settledAt createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();

    if (limit > 0) {
      dbQuery = dbQuery.skip((page - 1) * limit).limit(limit);
    }

    const generationAtRead = sellerNotifCacheGeneration;
    const [rawNotifications, newNotificationsCount] = await Promise.all([
      dbQuery,
      SellerNotification.countDocuments({ ...query, status: 'NEW' }),
    ]);
    // An accept/reject that landed while this query was in flight must not be
    // cached or returned as a still-new order.
    if (generationAtRead !== sellerNotifCacheGeneration) {
      if (req._sellerNotifReread) {
        // A second status change landed during the reread. Return this snapshot
        // without caching it.
      } else {
        req._sellerNotifReread = true;
        return getSellerNotifications(req, res, next);
      }
    }

    const notifications = rawNotifications.map(n => {
      if (!n.pickupOtp) {
        n.pickupOtp = (n.orderId ? String(n.orderId).replace(/\D/g, '').slice(-4) : '1234') || '1234';
      }
      if (Array.isArray(n.items)) {
        n.items = n.items.map(it => {
          if (typeof it.image === 'string' && it.image.includes('photo-1586201375761-83865001e31c')) {
            it.image = it.product?.mainImage || it.product?.image || '';
          }
          return it;
        });
      }
      return n;
    });

    const responsePayload = {
      success: true,
      count: notifications.length,
      newCount: newNotificationsCount,
      notifications,
    };

    if (generationAtRead === sellerNotifCacheGeneration) {
      sellerNotifCache.set(cacheKey, { data: responsePayload, timestamp: now });
    }

    res.status(200).json(responsePayload);
  } catch (error) {
    next(error);
  }
};

// @desc    Mark Seller Notification as Viewed
// @route   PUT /api/orders/seller/notifications/:id/view
// @access  Private/Seller
export const markNotificationViewed = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    const notification = await SellerNotification.findById(id);

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    if (notification.status === 'NEW') {
      notification.status = 'VIEWED';
      notification.viewedAt = new Date();
      await notification.save();
      invalidateSellerNotifCache();
    }

    res.status(200).json({
      success: true,
      notification,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Accept Seller Order
// @route   PUT /api/orders/seller/notifications/:id/accept
// @access  Private/Seller
export const acceptSellerOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ success: false, message: 'Order notification not found' });
    }
    const notification = await SellerNotification.findById(id);

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Order notification not found' });
    }

    if (notification.status === 'REJECTED') {
      return res.status(400).json({
        success: false,
        message: 'Order notification is already rejected',
      });
    }

    if (notification.order) {
      const parentOrder = await Order.findById(notification.order).select('orderStatus paymentStatus');
      if (parentOrder?.orderStatus === 'Payment Pending') {
        return res.status(400).json({
          success: false,
          message: 'Payment is not complete for this order',
        });
      }
    }

    const now = new Date();
    notification.status = 'ACCEPTED';
    if (!notification.acceptedAt) {
      notification.acceptedAt = now;
    }
    if (!notification.pickupOtp) {
      notification.pickupOtp = Math.floor(1000 + Math.random() * 9000).toString();
    }
    await notification.save();
    invalidateSellerNotifCache();

    // Update parent order
    if (notification.order) {
      const parentOrder = await Order.findByIdAndUpdate(
        notification.order,
        {
          orderStatus: 'Accepted',
          sellerStatus: 'Accepted',
          acceptedAt: now,
          ...(notification.pickupOtp ? { pickupOtp: notification.pickupOtp } : {}),
        },
        { new: true }
      ).select('user orderId');

      if (parentOrder?.user && parentOrder?.orderId) {
        notifyUserOrderEvent({
          userId: parentOrder.user,
          orderId: parentOrder.orderId,
          order: parentOrder._id,
          type: 'ORDER_CONFIRMED',
        });
      }
    }

    console.log(`[OrderController] Seller accepted Order ID ${notification.orderId}; status update only, no new-order notification`);

    res.status(200).json({
      success: true,
      message: 'Order accepted successfully and assigned to nearest delivery captain!',
      notification,
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Reject Seller Order
// @route   PUT /api/orders/seller/notifications/:id/reject
// @access  Private/Seller
export const rejectSellerOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ success: false, message: 'Order notification not found' });
    }

    const rawBody = req.body || {};
    const rejectionReason = typeof rawBody === 'string' ? rawBody : (rawBody.rejectionReason || rawBody.reason);
    const customReason = rawBody.customReason;

    const finalReason = rejectionReason === 'Other' && customReason
      ? customReason.trim()
      : (rejectionReason || 'Unable to fulfill order');

    const notification = await SellerNotification.findById(id);

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Order notification not found' });
    }

    if (notification.status === 'ACCEPTED' || notification.status === 'REJECTED') {
      return res.status(400).json({
        success: false,
        message: `Order notification is already ${notification.status.toLowerCase()}`,
      });
    }

    const now = new Date();
    notification.status = 'REJECTED';
    notification.rejectionReason = finalReason;
    notification.rejectedAt = now;
    await notification.save();
    invalidateSellerNotifCache();

    // Restore stock for items in this notification
    if (Array.isArray(notification.items)) {
      for (const item of notification.items) {
        if (item.product) {
          await Product.findByIdAndUpdate(item.product, {
            $inc: { stock: item.quantity },
          });
        }
      }
    }

    // Update parent order
    if (notification.order) {
      const parentOrder = await Order.findByIdAndUpdate(
        notification.order,
        {
          orderStatus: 'Rejected',
          sellerStatus: 'Rejected',
          rejectionReason: finalReason,
          rejectedAt: now,
        },
        { new: true }
      ).select('user orderId');

      if (parentOrder?.user && parentOrder?.orderId) {
        notifyUserOrderEvent({
          userId: parentOrder.user,
          orderId: parentOrder.orderId,
          order: parentOrder._id,
          type: 'ORDER_FAILED',
        });
      }
    }

    console.log(`[OrderController] Seller rejected Order ID ${notification.orderId}; status update only, no new-order notification. Reason: "${finalReason}"`);

    res.status(200).json({
      success: true,
      message: 'Order rejected successfully',
      notification,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Seller Order Status (Accept, Reject, Out for Delivery, Delivered)
// @route   PUT /api/orders/seller/notifications/:id/status
// @access  Private/Seller
export const updateSellerOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const notification = await SellerNotification.findById(id);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Order notification not found' });
    }

    const sellerAlreadyAccepted = [
      'ACCEPTED',
      'Accepted',
      'PROCESSING',
      'Processing',
      'PACKED',
      'Packed',
      'OUT_FOR_DELIVERY',
      'Out for Delivery',
      'DELIVERED',
      'Delivered',
    ].includes(notification.status);
    const movingPastAccept = ['Out for Delivery', 'OUT_FOR_DELIVERY', 'Delivered', 'DELIVERED', 'Processing', 'PACKED', 'Packed'].includes(status);
    if (movingPastAccept && !sellerAlreadyAccepted) {
      return res.status(400).json({
        success: false,
        message: 'Accept the order before updating delivery status',
      });
    }

    const now = new Date();
    let mappedNotificationStatus = status;
    let mappedOrderStatus = status;

    if (status === 'ACCEPTED' || status === 'Accepted') {
      mappedNotificationStatus = 'ACCEPTED';
      mappedOrderStatus = 'Accepted';
      notification.acceptedAt = now;
    } else if (status === 'Packed' || status === 'PACKED') {
      mappedNotificationStatus = 'PACKED';
      mappedOrderStatus = 'Packed';
    } else if (status === 'REJECTED' || status === 'Rejected') {
      mappedNotificationStatus = 'REJECTED';
      mappedOrderStatus = 'Rejected';
      notification.rejectedAt = now;
      notification.rejectionReason = rejectionReason || 'Unable to fulfill order';
      
      // Restore stock for items
      if (Array.isArray(notification.items)) {
        for (const item of notification.items) {
          if (item.product) {
            await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
          }
        }
      }
    } else if (status === 'Out for Delivery' || status === 'OUT_FOR_DELIVERY') {
      if (!['PACKED', 'Packed', 'OUT_FOR_DELIVERY', 'Out for Delivery'].includes(notification.status)) {
        return res.status(400).json({
          success: false,
          message: 'Mark the order as packed before sending it out for delivery',
        });
      }
      mappedNotificationStatus = 'OUT_FOR_DELIVERY';
      mappedOrderStatus = 'Out for Delivery';
    } else if (status === 'Delivered' || status === 'DELIVERED') {
      mappedNotificationStatus = 'DELIVERED';
      mappedOrderStatus = 'Delivered';
      notification.paymentStatus = 'Paid';
    } else if (status === 'Processing') {
      mappedNotificationStatus = 'PROCESSING';
      mappedOrderStatus = 'Processing';
    }

    notification.status = mappedNotificationStatus;
    await notification.save();
    invalidateSellerNotifCache();

    if (notification.order) {
      const parentOrder = await Order.findByIdAndUpdate(
        notification.order,
        {
          orderStatus: mappedOrderStatus,
          sellerStatus: mappedNotificationStatus,
          ...(mappedNotificationStatus === 'DELIVERED' ? { paymentStatus: 'Paid' } : {}),
          ...(mappedNotificationStatus === 'REJECTED' ? { rejectionReason: notification.rejectionReason } : {}),
        },
        { new: true }
      ).select('user orderId');

      // Only the 6 customer-facing events (skip Packed / Processing / etc.)
      const eventTypeMap = {
        Accepted: 'ORDER_CONFIRMED',
        'Out for Delivery': 'ORDER_OUT_FOR_DELIVERY',
        Delivered: 'ORDER_DELIVERED',
        Rejected: 'ORDER_FAILED',
        Cancelled: 'ORDER_CANCELLED',
      };
      const notifType = eventTypeMap[mappedOrderStatus];
      if (notifType && parentOrder?.user && parentOrder?.orderId) {
        notifyUserOrderEvent({
          userId: parentOrder.user,
          orderId: parentOrder.orderId,
          order: parentOrder._id,
          type: notifType,
        });
      }
    }

    if (mappedNotificationStatus === 'PACKED') {
      await autoAssignCaptainToOrder(notification);
    }

    console.log(`[OrderController] Updated Order ID ${notification.orderId} status to "${mappedOrderStatus}"`);

    // Automatic Settlement Trigger upon Delivery
    if (mappedNotificationStatus === 'DELIVERED') {
      await processSellerSettlement(notification._id);
    }

    res.status(200).json({
      success: true,
      message: `Order status updated to ${mappedOrderStatus}`,
      notification,
    });
  } catch (error) {
    next(error);
  }
};

// Helper: Process Automatic Seller Settlement
export const processSellerSettlement = async (notificationId) => {
  try {
    // Atomic check & lock: find notification with settlementStatus: 'PENDING'
    const notification = await SellerNotification.findOneAndUpdate(
      { 
        _id: notificationId, 
        settlementStatus: 'PENDING'
      },
      { 
        $set: { 
          settlementStatus: 'SETTLED', 
          settledAt: new Date() 
        } 
      },
      { new: true }
    );

    if (!notification) {
      console.log(`[Settlement] Notification ${notificationId} is already settled or not eligible.`);
      return null;
    }

    // Payment Verification: Online Pay or Delivered COD (which marks paymentStatus = 'Paid')
    const payMethod = (notification.paymentMethod || '').toUpperCase();
    const isPayCompleted = ['ONLINE', 'UPI', 'CARD', 'NETBANKING', 'WALLET'].includes(payMethod) || notification.paymentStatus === 'Paid' || notification.status === 'DELIVERED';

    if (!isPayCompleted) {
      console.log(`[Settlement] Notification ${notificationId} skipped automatic wallet credit because Payment is not completed.`);
      return notification;
    }

    // Find matching seller in Seller model
    let seller = await Seller.findById(notification.sellerId);
    if (!seller && mongoose.Types.ObjectId.isValid(notification.sellerId) === false) {
      seller = await Seller.findOne({ 
        $or: [
          { phone: notification.sellerId },
          { businessName: notification.sellerName },
          { ownerName: notification.sellerName }
        ]
      });
    }

    if (!seller) {
      console.warn(`[Settlement] Seller document not found for sellerId/sellerName: "${notification.sellerId}" / "${notification.sellerName}"`);
      return notification;
    }

    const grossAmount = Number(notification.totalAmount || 0);
    const commRate = Number(notification.commissionRate !== undefined ? notification.commissionRate : (seller.commissionPercentage || 10));
    const commAmount = Number(((grossAmount * commRate) / 100).toFixed(2));
    const netAmount = Number((grossAmount - commAmount).toFixed(2));

    const balanceBefore = Number(seller.walletBalance || 0);
    const balanceAfter = Number((balanceBefore + netAmount).toFixed(2));

    // Update seller financial balances atomically
    seller.walletBalance = balanceAfter;
    seller.totalEarnings = Number(((seller.totalEarnings || 0) + netAmount).toFixed(2));
    seller.totalCommissionDeducted = Number(((seller.totalCommissionDeducted || 0) + commAmount).toFixed(2));
    await seller.save();

    // Create Wallet Transaction Record
    const txnId = `TXN-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;
    await WalletTransaction.create({
      transactionId: txnId,
      sellerId: String(seller._id),
      order: notification.order,
      orderId: notification.orderId,
      notification: notification._id,
      type: 'CREDIT',
      grossAmount,
      commissionRate: commRate,
      commissionAmount: commAmount,
      netAmount,
      balanceBefore,
      balanceAfter,
      paymentMethod: notification.paymentMethod || 'ONLINE',
      settlementStatus: 'SETTLED',
      description: `Wallet credit for Delivered Order #${notification.orderId} (Net ₹${netAmount} after ${commRate}% commission ₹${commAmount})`,
    });

    // Central Platform Ledger: Record Seller Net Earning
    await PlatformLedger.create({
      transactionId: `TXN-LED-SEL-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`,
      category: 'SELLER_EARNING',
      type: 'CREDIT',
      amount: netAmount,
      source: 'PLATFORM_TREASURY',
      destination: 'SELLER',
      entityType: 'SELLER',
      entityId: String(seller._id),
      entityName: seller.businessName || seller.ownerName || 'Seller',
      referenceModel: 'Order',
      referenceId: notification.orderId,
      referenceObjId: notification.order,
      status: 'SUCCESS',
      balanceBefore,
      balanceAfter,
      description: `Seller net earning credited for Order #${notification.orderId}`,
      metadata: { grossAmount, commRate, commAmount, netAmount },
    }).catch(err => console.warn('[PlatformLedger] Seller earning log failed:', err.message));

    // Central Platform Ledger: Record Platform Commission
    if (commAmount > 0) {
      await PlatformLedger.create({
        transactionId: `TXN-LED-COMM-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`,
        category: 'PLATFORM_COMMISSION',
        type: 'CREDIT',
        amount: commAmount,
        source: 'SELLER_ORDER',
        destination: 'PLATFORM_TREASURY',
        entityType: 'SELLER',
        entityId: String(seller._id),
        entityName: seller.businessName || seller.ownerName || 'Seller',
        referenceModel: 'Order',
        referenceId: notification.orderId,
        referenceObjId: notification.order,
        status: 'SUCCESS',
        description: `Platform commission (${commRate}%) earned on Order #${notification.orderId}`,
        metadata: { grossAmount, commRate, commAmount },
      }).catch(err => console.warn('[PlatformLedger] Commission log failed:', err.message));
    }

    console.log(`[Settlement SUCCESS] Credited ₹${netAmount} (Gross: ₹${grossAmount}, Comm ${commRate}%: ₹${commAmount}) to Seller "${seller.businessName}" (Balance: ₹${balanceBefore} -> ₹${balanceAfter})`);
    return notification;
  } catch (err) {
    console.error(`[Settlement ERROR] Failed processing settlement for notification ${notificationId}:`, err);
    return null;
  }
};

// @desc   Request Return on Delivered Order
// @route  POST /api/orders/:id/return
// @access Private/User
export const requestOrderReturn = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason, remarks } = req.body;

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, message: 'Please provide a valid reason for the return request.' });
    }

    const isMongoId = mongoose.Types.ObjectId.isValid(id);
    const order = await Order.findOne(
      isMongoId 
        ? { $or: [{ _id: id }, { orderId: id }], user: req.user.id }
        : { orderId: id, user: req.user.id }
    );

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found or unauthorized.' });
    }

    const currentStatus = order.orderStatus || order.status || '';
    const isDelivered = ['Delivered', 'DELIVERED', 'Completed'].includes(currentStatus) || order.captainStatus === 'Delivered';
    if (!isDelivered) {
      return res.status(400).json({
        success: false,
        message: `Only delivered orders are eligible for return. Current status is "${currentStatus}".`,
      });
    }

    if (order.returnStatus && ['Pending', 'Approved', 'Completed'].includes(order.returnStatus)) {
      return res.status(400).json({
        success: false,
        message: `A return request has already been submitted for this order (Status: ${order.returnStatus}).`,
      });
    }

    const formattedReason = String(reason).trim();
    const cleanRemarks = remarks ? String(remarks).trim() : '';
    const fullReasonText = cleanRemarks ? `${formattedReason} - ${cleanRemarks}` : formattedReason;

    order.orderStatus = 'Return Requested';
    order.returnStatus = 'Pending';
    order.returnReason = fullReasonText;
    order.returnedAt = new Date();
    await order.save();

    invalidateUserOrdersCache(req.user.id);

    // Create RefundRequest record for Admin Financials / SuperAdmin Refund Management
    const refundId = `REFUND-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;
    const refundReq = await RefundRequest.create({
      refundId,
      orderId: order.orderId,
      order: order._id,
      userId: req.user.id,
      userName: order.shippingAddress?.fullName || req.user.name || 'Customer',
      userPhone: order.shippingAddress?.phone || req.user.phone || '',
      amount: order.grandTotal || 0,
      reason: fullReasonText,
      status: 'REQUESTED',
      paymentMethod: order.paymentMethod || 'COD',
      remarks: cleanRemarks,
    }).catch(err => console.warn('[RefundRequest] Creation error:', err.message));

    // Update Seller Notifications so seller dashboard shows return request
    await SellerNotification.updateMany(
      { order: order._id },
      {
        $set: {
          status: 'RETURNED',
          rejectionReason: `Customer Return Requested: ${fullReasonText}`,
        }
      }
    ).catch(() => {});

    res.status(200).json({
      success: true,
      message: 'Return request submitted successfully. Our team will review and process your return shortly.',
      order,
      refundRequest: refundReq || null,
    });
  } catch (error) {
    console.error('[OrderController] Error requesting order return:', error);
    next(error);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// Razorpay Payment Integration
// ──────────────────────────────────────────────────────────────────────────────

import crypto from 'crypto';
import { getRazorpayInstance } from '../config/razorpay.js';

const findUserOrder = (userId, orderId) => Order.findOne({
  user: userId,
  $or: [
    { orderId: String(orderId) },
    ...(/^[a-f0-9]{24}$/i.test(String(orderId)) ? [{ _id: orderId }] : []),
  ],
});

export const createRazorpayOrder = async (req, res, next) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required' });
    }

    const order = await findUserOrder(req.user.id, orderId);
    if (!order || !isOnlinePaymentMethod(order.paymentMethod)) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (order.paymentStatus === 'Paid' || order.orderStatus !== 'Payment Pending') {
      return res.status(400).json({ success: false, message: 'This order is not awaiting payment' });
    }

    const amount = Math.round(Number(order.grandTotal) * 100);
    if (!Number.isFinite(amount) || amount < 100) {
      return res.status(400).json({ success: false, message: 'Order amount is not payable' });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    if (!keyId || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ success: false, message: 'Payment is not configured' });
    }

    const storedId = order.razorpay?.orderId;
    const storedAmount = Number(order.razorpay?.amount);
    if (storedId && String(storedId).startsWith('order_') && storedAmount === amount) {
      console.info('[Razorpay] reuse order', {
        shippnexOrderId: order.orderId,
        razorpayOrderId: storedId,
        amount,
        currency: 'INR',
      });
      return res.status(200).json({
        success: true,
        orderId: storedId,
        razorpayOrderId: storedId,
        amount,
        currency: 'INR',
        keyId,
      });
    }

    const razorpayOrder = await getRazorpayInstance().orders.create({
      amount,
      currency: 'INR',
      receipt: `order_${order.orderId}_${Date.now()}`,
      payment_capture: 1,
    });

    const saved = await Order.findOneAndUpdate(
      { _id: order._id, paymentStatus: { $ne: 'Paid' }, orderStatus: 'Payment Pending' },
      { $set: { 'razorpay.orderId': razorpayOrder.id, 'razorpay.amount': Number(razorpayOrder.amount), 'razorpay.currency': 'INR' } },
      { new: true }
    );
    if (!saved) {
      return res.status(400).json({ success: false, message: 'This order is not awaiting payment' });
    }

    console.info('[Razorpay] created order', {
      shippnexOrderId: order.orderId,
      razorpayOrderId: razorpayOrder.id,
      amount: Number(razorpayOrder.amount),
      currency: razorpayOrder.currency || 'INR',
    });

    res.status(200).json({
      success: true,
      orderId: razorpayOrder.id,
      razorpayOrderId: razorpayOrder.id,
      amount: Number(razorpayOrder.amount),
      currency: razorpayOrder.currency || 'INR',
      keyId,
    });
  } catch (error) {
    console.error('[Razorpay Create Order Error]', error);
    res.status(500).json({ success: false, message: 'Failed to create payment order' });
  }
};

export const verifyRazorpayPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
      return res.status(400).json({ success: false, message: 'Payment details are missing' });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return res.status(500).json({ success: false, message: 'Payment verification is not configured' });
    }

    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generated_signature = hmac.digest('hex');

    if (generated_signature !== razorpay_signature) {
      console.info('[Razorpay] signature rejected', {
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        paymentStatus: 'FAILED',
      });
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    const order = await findUserOrder(req.user.id, orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (order.razorpay?.orderId && order.razorpay.orderId !== razorpay_order_id) {
      return res.status(400).json({ success: false, message: 'Payment does not belong to this order' });
    }

    if (order.paymentStatus === 'Paid' && order.razorpay?.paymentId === razorpay_payment_id) {
      return res.status(200).json({
        success: true,
        message: 'Payment already verified',
        order,
      });
    }

    const payment = await getRazorpayInstance().payments.fetch(razorpay_payment_id);
    if (!payment || payment.order_id !== razorpay_order_id) {
      return res.status(400).json({ success: false, message: 'Payment does not match this Razorpay order' });
    }
    console.info('[Razorpay] verify', {
      shippnexOrderId: order.orderId,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      paymentStatus: payment.status,
    });
    if (payment.status !== 'captured') {
      return res.status(400).json({ success: false, message: 'Payment was not completed' });
    }

    const result = await confirmOnlinePayment(order, {
      amount: Number(payment.amount),
      currency: payment.currency,
      razorpayOrderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      method: payment.method,
    });

    if (!result.ok) {
      const message = result.reason === 'amount_mismatch'
        ? 'Payment amount does not match this order'
        : 'Payment could not be confirmed';
      return res.status(400).json({ success: false, message });
    }

    invalidateUserOrdersCache(String(order.user));
    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      order: result.order,
      orderId: result.order?._id,
    });
  } catch (error) {
    console.error('[Razorpay Verify Payment Error]', error);
    res.status(500).json({ success: false, message: 'Payment verification failed' });
  }
};


