import mongoose from 'mongoose';
import ReturnRequest from '../models/ReturnRequest.model.js';
import Order from '../models/Order.model.js';
import Product from '../models/Product.model.js';
import User from '../models/User.model.js';
import Seller from '../models/Seller.model.js';
import Captain from '../models/Captain.model.js';
import SellerNotification from '../models/SellerNotification.model.js';
import CaptainNotification from '../models/CaptainNotification.model.js';
import CaptainTransaction from '../models/CaptainTransaction.model.js';
import WalletTransaction from '../models/WalletTransaction.model.js';
import PlatformLedger from '../models/PlatformLedger.model.js';
import RefundRequest from '../models/RefundRequest.model.js';
import { invalidateUserOrdersCache } from './orderController.js';
import { creditUserWallet } from '../utils/userWalletHelper.js';

// Helper: Generate OTP & Return ID
const generateReturnOtp = () => Math.floor(1000 + Math.random() * 9000).toString();
const generateReturnId = () => `RET-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;

// Helper: Safely query by _id (if valid ObjectId) or human-readable returnId
export const buildReturnIdQuery = (id, extra = {}) => {
  if (!id) return { _id: null, ...extra };
  const isMongoId = mongoose.Types.ObjectId.isValid(String(id));
  const idQuery = isMongoId ? { $or: [{ _id: id }, { returnId: id }] } : { returnId: id };
  return { ...idQuery, ...extra };
};

// ──────────────────────────────────────────────
// 1. Customer: Request Item-Level Return
// POST /api/returns
// ──────────────────────────────────────────────
export const requestItemReturn = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user._id;
    const { orderId, orderItemId, productId, quantity, reason, customerNotes, customerImages } = req.body;

    if (!orderId || !reason || !String(reason).trim()) {
      return res.status(400).json({ success: false, message: 'Order ID and return reason are required.' });
    }

    const returnQty = Number(quantity) || 1;
    if (returnQty <= 0) {
      return res.status(400).json({ success: false, message: 'Return quantity must be at least 1.' });
    }

    // Find Order belonging to authenticated customer
    const isMongoOrderId = mongoose.Types.ObjectId.isValid(String(orderId));
    const order = await Order.findOne(
      isMongoOrderId
        ? { $or: [{ _id: orderId }, { orderId: orderId }], user: userId }
        : { orderId: orderId, user: userId }
    ).populate('user', 'name phone email');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found or unauthorized.' });
    }

    // Verify Order is Delivered
    const orderStatus = order.orderStatus || order.status || '';
    const isDelivered = ['Delivered', 'DELIVERED', 'Completed', 'Return Requested', 'Return Approved', 'Returned'].includes(orderStatus) || order.captainStatus === 'Delivered';
    if (!isDelivered) {
      return res.status(400).json({
        success: false,
        message: `Only delivered orders are eligible for return. Current status is "${orderStatus}".`,
      });
    }

    // Locate the specific order item
    let targetItem = null;
    if (orderItemId) {
      targetItem = order.items.find((it) => String(it._id) === String(orderItemId));
    }
    if (!targetItem && productId) {
      targetItem = order.items.find((it) => String(it.product) === String(productId) || String(it._id) === String(productId));
    }
    if (!targetItem && order.items.length === 1) {
      targetItem = order.items[0];
    }

    if (!targetItem) {
      return res.status(404).json({ success: false, message: 'Selected item was not found in this order.' });
    }

    // Check Product returnability & return window from Product DB
    const productDoc = await Product.findById(targetItem.product);
    if (productDoc && productDoc.isReturnable === false) {
      return res.status(400).json({
        success: false,
        message: `"${targetItem.name}" is marked as non-returnable.`,
      });
    }

    const returnWindowDays = productDoc?.returnWindow || 7;
    const deliveryDate = order.captainDeliveredAt || order.updatedAt || order.createdAt;
    const windowExpiry = new Date(deliveryDate).getTime() + returnWindowDays * 24 * 60 * 60 * 1000;
    if (Date.now() > windowExpiry) {
      return res.status(400).json({
        success: false,
        message: `The return window of ${returnWindowDays} days for this product has expired.`,
      });
    }

    // Check previously active / completed returns for this item
    const existingReturns = await ReturnRequest.find({
      order: order._id,
      orderItemId: targetItem._id,
      status: { $nin: ['CANCELLED', 'REJECTED', 'VERIFICATION_FAILED'] },
    });

    const totalAlreadyReturnedQty = existingReturns.reduce((sum, r) => sum + (r.quantity || 0), 0);
    const availableToReturnQty = targetItem.quantity - totalAlreadyReturnedQty;

    if (availableToReturnQty <= 0) {
      return res.status(400).json({
        success: false,
        message: `A return request has already been processed or is active for all purchased units of this item.`,
      });
    }

    if (returnQty > availableToReturnQty) {
      return res.status(400).json({
        success: false,
        message: `You can return at most ${availableToReturnQty} unit(s) of this item.`,
      });
    }

    // Financial Calculation (Historical item pricing & proportional discounts)
    const unitPrice = Number(targetItem.price || 0);
    const itemTotal = Number((unitPrice * returnQty).toFixed(2));
    const orderItemsTotal = order.itemsTotal || order.items.reduce((s, it) => s + (it.price || 0) * (it.quantity || 1), 0) || 1;
    const discountAllocation = order.discount ? Number(((order.discount * itemTotal) / orderItemsTotal).toFixed(2)) : 0;
    const taxAllocation = order.gst ? Number(((order.gst * itemTotal) / orderItemsTotal).toFixed(2)) : 0;
    const refundAmount = Math.max(0, Number((itemTotal - discountAllocation + taxAllocation).toFixed(2)));

    // Find Seller for this Product
    let sellerDoc = null;
    if (productDoc?.sellerId) {
      sellerDoc = await Seller.findById(productDoc.sellerId);
    }
    if (!sellerDoc && targetItem.seller) {
      sellerDoc = await Seller.findOne({
        $or: [{ businessName: targetItem.seller }, { ownerName: targetItem.seller }],
      });
    }

    const returnId = generateReturnId();
    const returnOtp = generateReturnOtp();
    const returnOtpExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days validity

    const newReturn = await ReturnRequest.create({
      returnId,
      order: order._id,
      orderId: order.orderId,
      orderItemId: targetItem._id,
      product: targetItem.product,
      productName: targetItem.name,
      productImage: targetItem.image || productDoc?.mainImage || '',
      unitPrice,
      quantity: returnQty,
      itemTotal,
      discountAllocation,
      taxAllocation,
      refundAmount,
      user: userId,
      customerName: order.shippingAddress?.fullName || req.user.name || 'Customer',
      customerPhone: order.shippingAddress?.phone || req.user.phone || '',
      customerAddress: {
        fullName: order.shippingAddress?.fullName,
        phone: order.shippingAddress?.phone,
        addressLine1: order.shippingAddress?.addressLine1,
        addressLine2: order.shippingAddress?.addressLine2 || '',
        landmark: order.shippingAddress?.landmark || '',
        city: order.shippingAddress?.city,
        state: order.shippingAddress?.state,
        pincode: order.shippingAddress?.pincode,
      },
      seller: sellerDoc ? sellerDoc._id : null,
      sellerName: sellerDoc?.businessName || targetItem.seller || 'Sathi Seller Store',
      sellerAddress: {
        storeName: sellerDoc?.businessName || targetItem.seller || 'Sathi Seller Warehouse',
        phone: sellerDoc?.phone || '',
        addressLine1: sellerDoc?.pickupAddress?.addressLine1 || sellerDoc?.addressLine1 || 'Main Warehouse, Sector 62',
        city: sellerDoc?.city || 'Noida',
        state: sellerDoc?.state || 'Uttar Pradesh',
        pincode: sellerDoc?.pincode || '201301',
      },
      reason: String(reason).trim(),
      customerNotes: customerNotes ? String(customerNotes).trim() : '',
      customerImages: Array.isArray(customerImages) ? customerImages : [],
      status: 'REQUESTED',
      returnOtp,
      returnOtpExpiry,
      refundMethod: order.paymentMethod === 'COD' ? 'WALLET' : 'ORIGINAL_PAYMENT',
      timeline: [
        {
          status: 'REQUESTED',
          title: 'Return Request Submitted',
          description: `Customer submitted return request for ${returnQty} unit(s) of "${targetItem.name}". Reason: ${reason}`,
          timestamp: new Date(),
          actor: 'Customer',
        },
      ],
    });

    // Update order status snapshot
    order.orderStatus = 'Return Requested';
    order.returnStatus = 'Pending';
    order.returnReason = reason;
    order.returnedAt = new Date();
    await order.save();
    invalidateUserOrdersCache(userId);

    // Notify Seller
    if (sellerDoc) {
      await SellerNotification.create({
        sellerId: String(sellerDoc._id),
        sellerName: sellerDoc.businessName,
        order: order._id,
        orderId: order.orderId,
        items: [targetItem],
        totalAmount: refundAmount,
        customerDetails: {
          name: order.shippingAddress?.fullName || 'Customer',
          phone: order.shippingAddress?.phone || '',
          address: `${order.shippingAddress?.addressLine1}, ${order.shippingAddress?.city}`,
        },
        status: 'RETURNED',
        rejectionReason: `Customer requested item return: ${reason}`,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
      }).catch((err) => console.warn('[ReturnNotification] Seller notification creation failed:', err.message));
    }

    res.status(201).json({
      success: true,
      message: 'Return request submitted successfully. Our team will review your request shortly.',
      returnRequest: newReturn,
    });
  } catch (error) {
    console.error('[requestItemReturn ERROR]', error);
    next(error);
  }
};

// ──────────────────────────────────────────────
// 2. Customer: Get My Returns
// GET /api/returns/my-returns
// ──────────────────────────────────────────────
export const getMyReturns = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.query;

    const query = { user: userId };
    if (orderId) {
      const isMongoId = mongoose.Types.ObjectId.isValid(orderId);
      query.$or = isMongoId ? [{ order: orderId }, { orderId: orderId }] : [{ orderId: orderId }];
    }

    const returns = await ReturnRequest.find(query)
      .populate('order', 'orderId orderStatus grandTotal createdAt paymentMethod')
      .populate('captain', 'name phone vehicleType')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      returns,
    });
  } catch (error) {
    console.error('[getMyReturns ERROR]', error);
    next(error);
  }
};

// ──────────────────────────────────────────────
// 3. Customer / Seller / Captain / Admin: Get Return By ID
// GET /api/returns/:id
// ──────────────────────────────────────────────
export const getReturnById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isMongoId = mongoose.Types.ObjectId.isValid(id);
    const returnDoc = await ReturnRequest.findOne(
      isMongoId ? { $or: [{ _id: id }, { returnId: id }] } : { returnId: id }
    )
      .populate('order')
      .populate('captain', 'name phone vehicleType rating')
      .populate('seller', 'businessName phone city');

    if (!returnDoc) {
      return res.status(404).json({ success: false, message: 'Return request not found.' });
    }

    // Role-based Authorization
    const role = req.user.role;
    const userId = String(req.user.id);
    if (role === 'user' && String(returnDoc.user) !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to this return request.' });
    }
    if (role === 'captain' && returnDoc.captain && String(returnDoc.captain._id || returnDoc.captain) !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized access.' });
    }

    res.status(200).json({
      success: true,
      returnRequest: returnDoc,
    });
  } catch (error) {
    console.error('[getReturnById ERROR]', error);
    next(error);
  }
};

// ──────────────────────────────────────────────
// 4. Customer: Cancel Return Request
// PUT /api/returns/:id/cancel
// ──────────────────────────────────────────────
export const cancelReturnRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id || req.user._id;

    const returnDoc = await ReturnRequest.findOne(
      buildReturnIdQuery(id, { user: userId })
    );

    if (!returnDoc) {
      return res.status(404).json({ success: false, message: 'Return request not found.' });
    }

    if (!['REQUESTED', 'APPROVED', 'CAPTAIN_ASSIGNMENT_PENDING'].includes(returnDoc.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel return request once pickup has started (Current status: ${returnDoc.status}).`,
      });
    }

    returnDoc.status = 'CANCELLED';
    returnDoc.timeline.push({
      status: 'CANCELLED',
      title: 'Return Request Cancelled',
      description: 'Customer cancelled the return request.',
      timestamp: new Date(),
      actor: 'Customer',
    });
    await returnDoc.save();

    if (returnDoc.order) {
      const otherActiveReturns = await ReturnRequest.find({
        order: returnDoc.order,
        _id: { $ne: returnDoc._id },
        status: { $nin: ['CANCELLED', 'REJECTED', 'VERIFICATION_FAILED'] },
      });
      if (otherActiveReturns.length === 0) {
        await Order.findByIdAndUpdate(returnDoc.order, {
          orderStatus: 'Delivered',
          returnStatus: null,
        });
      }
      invalidateUserOrdersCache(userId);
    }

    res.status(200).json({
      success: true,
      message: 'Return request cancelled successfully.',
      returnRequest: returnDoc,
    });
  } catch (error) {
    console.error('[cancelReturnRequest ERROR]', error);
    next(error);
  }
};

// ──────────────────────────────────────────────
// 5. Seller: Get Seller Returns
// GET /api/returns/seller/returns
// ──────────────────────────────────────────────
export const getSellerReturns = async (req, res, next) => {
  try {
    const sellerId = req.user.id || req.user._id;
    let seller = await Seller.findById(sellerId);
    if (!seller) {
      seller = await Seller.findOne({ phone: req.user.phone });
    }

    const sellerKey = seller ? String(seller._id) : sellerId;
    const sellerBusinessName = seller?.businessName || '';

    const query = {
      $or: [
        { seller: sellerKey },
        ...(sellerBusinessName ? [{ sellerName: sellerBusinessName }] : []),
      ],
    };

    if (req.query.status && req.query.status !== 'All') {
      query.status = req.query.status;
    }

    const returns = await ReturnRequest.find(query)
      .populate('order', 'orderId orderStatus grandTotal createdAt paymentMethod')
      .populate('captain', 'name phone vehicleType')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      returns,
    });
  } catch (error) {
    console.error('[getSellerReturns ERROR]', error);
    next(error);
  }
};

// ──────────────────────────────────────────────
// 6. Seller / Admin: Approve or Reject Return Request
// PUT /api/returns/:id/approve
// ──────────────────────────────────────────────
export const approveOrRejectReturn = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, rejectionReason } = req.body; // action = 'APPROVE' | 'REJECT'
    const actorRole = req.user.role === 'admin' ? 'Admin' : 'Seller';

    const returnDoc = await ReturnRequest.findOne(buildReturnIdQuery(id));
    if (!returnDoc) {
      return res.status(404).json({ success: false, message: 'Return request not found.' });
    }

    if (returnDoc.status !== 'REQUESTED') {
      return res.status(400).json({
        success: false,
        message: `Return is already in "${returnDoc.status}" state and cannot be modified.`,
      });
    }

    if (action === 'REJECT') {
      returnDoc.status = 'REJECTED';
      returnDoc.rejectionReason = rejectionReason || 'Rejected by seller/admin';
      returnDoc.timeline.push({
        status: 'REJECTED',
        title: 'Return Request Rejected',
        description: `Return was rejected by ${actorRole}. Reason: ${returnDoc.rejectionReason}`,
        timestamp: new Date(),
        actor: actorRole,
      });
      await returnDoc.save();

      if (returnDoc.order) {
        await Order.findByIdAndUpdate(returnDoc.order, {
          orderStatus: 'Return Rejected',
          returnStatus: 'Rejected',
          rejectionReason: returnDoc.rejectionReason,
        });
        if (returnDoc.user) invalidateUserOrdersCache(returnDoc.user);
      }

      return res.status(200).json({
        success: true,
        message: 'Return request has been rejected.',
        returnRequest: returnDoc,
      });
    }

    // APPROVE return request -> Move to CAPTAIN_ASSIGNMENT_PENDING
    returnDoc.status = 'CAPTAIN_ASSIGNMENT_PENDING';
    returnDoc.timeline.push({
      status: 'APPROVED',
      title: 'Return Request Approved',
      description: `Return request approved by ${actorRole}. Pickup assignment initiated for Captain.`,
      timestamp: new Date(),
      actor: actorRole,
    });
    returnDoc.timeline.push({
      status: 'CAPTAIN_ASSIGNMENT_PENDING',
      title: 'Awaiting Captain Pickup Assignment',
      description: 'Looking for an available Captain in the customer pickup zone.',
      timestamp: new Date(),
      actor: 'System',
    });
    await returnDoc.save();

    if (returnDoc.order) {
      await Order.findByIdAndUpdate(returnDoc.order, {
        orderStatus: 'Return Approved',
        returnStatus: 'Approved',
      });
      if (returnDoc.user) invalidateUserOrdersCache(returnDoc.user);
    }

    // Notify available Captains in service area
    await CaptainNotification.create({
      type: 'DELIVERY',
      title: 'New Return Pickup Available!',
      message: `Return pickup for "${returnDoc.productName}" (Order #${returnDoc.orderId}) available in ${returnDoc.customerAddress?.city || 'your area'}.`,
      orderId: returnDoc.orderId,
      order: returnDoc.order,
      icon: 'keyboard_return',
    }).catch(() => {});

    res.status(200).json({
      success: true,
      message: 'Return request approved. Assigned to Captain pickup pool.',
      returnRequest: returnDoc,
    });
  } catch (error) {
    console.error('[approveOrRejectReturn ERROR]', error);
    next(error);
  }
};

// ──────────────────────────────────────────────
// 7. Captain: Get Return Pickup Jobs
// GET /api/captain/return-jobs
// ──────────────────────────────────────────────
export const getCaptainReturnJobs = async (req, res, next) => {
  try {
    const captainId = req.user.id || req.user._id;
    const { filter } = req.query; // 'available' | 'active' | 'completed'

    let query = {};
    if (filter === 'active') {
      query = {
        captain: captainId,
        status: { $in: ['CAPTAIN_ASSIGNED', 'PICKUP_STARTED', 'PICKUP_ARRIVED', 'PICKED_UP', 'IN_TRANSIT_TO_SELLER'] },
      };
    } else if (filter === 'completed') {
      query = {
        captain: captainId,
        status: { $in: ['RECEIVED_BY_SELLER', 'UNDER_VERIFICATION', 'VERIFICATION_PASSED', 'REFUNDED', 'COMPLETED'] },
      };
    } else {
      // Default: show jobs assigned to this captain OR available for pickup in area
      query = {
        $or: [
          { status: 'CAPTAIN_ASSIGNMENT_PENDING' },
          { captain: captainId, status: { $in: ['CAPTAIN_ASSIGNED', 'PICKUP_STARTED', 'PICKUP_ARRIVED', 'PICKED_UP', 'IN_TRANSIT_TO_SELLER'] } },
        ],
      };
    }

    const returnJobs = await ReturnRequest.find(query)
      .populate('order', 'orderId createdAt paymentMethod grandTotal')
      .populate('user', 'name phone')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      returnJobs,
    });
  } catch (error) {
    console.error('[getCaptainReturnJobs ERROR]', error);
    next(error);
  }
};

// ──────────────────────────────────────────────
// 8. Captain: Accept Return Pickup Job
// PUT /api/captain/returns/:id/accept
// ──────────────────────────────────────────────
export const captainAcceptReturnJob = async (req, res, next) => {
  try {
    const { id } = req.params;
    const captainId = req.user.id || req.user._id;

    const captain = await Captain.findById(captainId);
    if (!captain) {
      return res.status(404).json({ success: false, message: 'Captain profile not found.' });
    }

    const returnDoc = await ReturnRequest.findOne(
      buildReturnIdQuery(id, { status: { $in: ['CAPTAIN_ASSIGNMENT_PENDING', 'APPROVED'] } })
    );

    if (!returnDoc) {
      return res.status(400).json({
        success: false,
        message: 'This return pickup job is no longer available or already assigned.',
      });
    }

    returnDoc.captain = captainId;
    returnDoc.status = 'CAPTAIN_ASSIGNED';
    returnDoc.captainStatus = 'Accepted';
    returnDoc.captainAssignedAt = new Date();
    returnDoc.captainAcceptedAt = new Date();

    returnDoc.timeline.push({
      status: 'CAPTAIN_ASSIGNED',
      title: 'Captain Assigned for Pickup',
      description: `Captain ${captain.name} (${captain.vehicleType || 'Partner'}) has accepted the return pickup job.`,
      timestamp: new Date(),
      actor: 'Captain',
    });

    await returnDoc.save();

    res.status(200).json({
      success: true,
      message: 'Return pickup job accepted successfully.',
      returnRequest: returnDoc,
    });
  } catch (error) {
    console.error('[captainAcceptReturnJob ERROR]', error);
    next(error);
  }
};

// ──────────────────────────────────────────────
// 9. Captain: Update Return Lifecycle Status
// PUT /api/captain/returns/:id/status
// body: { status: 'PICKUP_STARTED' | 'PICKUP_ARRIVED' | 'IN_TRANSIT_TO_SELLER' | 'DELIVERED_TO_SELLER' | 'RECEIVED_BY_SELLER' }
// ──────────────────────────────────────────────
export const captainUpdateReturnStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const captainId = req.user.id || req.user._id;

    const returnDoc = await ReturnRequest.findOne(
      buildReturnIdQuery(id, { captain: captainId })
    );

    if (!returnDoc) {
      return res.status(404).json({ success: false, message: 'Return pickup job not found or unauthorized.' });
    }

    const validStatuses = [
      'PICKUP_STARTED',
      'PICKUP_ARRIVED',
      'IN_TRANSIT_TO_SELLER',
      'DELIVERED_TO_SELLER',
      'RECEIVED_BY_SELLER',
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid return status transition: "${status}".` });
    }

    if (status === 'PICKUP_STARTED') {
      returnDoc.status = 'PICKUP_STARTED';
      returnDoc.captainStatus = 'In Transit';
      returnDoc.pickupStartedAt = new Date();
      returnDoc.timeline.push({
        status: 'PICKUP_STARTED',
        title: 'Captain on the Way',
        description: 'Captain has started the journey to customer pickup location.',
        timestamp: new Date(),
        actor: 'Captain',
      });
    } else if (status === 'PICKUP_ARRIVED') {
      returnDoc.status = 'PICKUP_ARRIVED';
      returnDoc.captainStatus = 'At Pickup';
      returnDoc.pickupArrivedAt = new Date();
      returnDoc.timeline.push({
        status: 'PICKUP_ARRIVED',
        title: 'Captain Arrived at Customer Location',
        description: 'Captain has arrived. Please share the 4-digit Return OTP for item pickup.',
        timestamp: new Date(),
        actor: 'Captain',
      });
    } else if (status === 'IN_TRANSIT_TO_SELLER') {
      returnDoc.status = 'IN_TRANSIT_TO_SELLER';
      returnDoc.captainStatus = 'In Transit';
      returnDoc.timeline.push({
        status: 'IN_TRANSIT_TO_SELLER',
        title: 'Returned Item in Transit to Seller',
        description: 'Captain is transporting the returned product to the seller return location.',
        timestamp: new Date(),
        actor: 'Captain',
      });
    } else if (status === 'DELIVERED_TO_SELLER' || status === 'RECEIVED_BY_SELLER') {
      returnDoc.status = 'RECEIVED_BY_SELLER';
      returnDoc.captainStatus = 'Delivered to Seller';
      returnDoc.receivedAt = new Date();
      returnDoc.receivedBy = returnDoc.sellerName || 'Seller Store';
      returnDoc.receivingNotes = notes || 'Handed over by Captain';
      returnDoc.timeline.push({
        status: 'RECEIVED_BY_SELLER',
        title: 'Delivered to Seller / Return Location',
        description: 'Product has been delivered to seller warehouse. Awaiting quality verification.',
        timestamp: new Date(),
        actor: 'Captain',
      });
    }

    await returnDoc.save();

    res.status(200).json({
      success: true,
      message: `Status updated to ${status}`,
      returnRequest: returnDoc,
    });
  } catch (error) {
    console.error('[captainUpdateReturnStatus ERROR]', error);
    next(error);
  }
};

// ──────────────────────────────────────────────
// 10. Captain: Verify Return Pickup OTP (Mandatory for PICKED_UP)
// POST /api/captain/returns/:id/verify-otp
// body: { otp: '1234', notes: 'Item sealed and packaged', proofUrl: 'https://...' }
// ──────────────────────────────────────────────
export const captainVerifyReturnOtp = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { otp, notes, proofUrl, checklist } = req.body;
    const captainId = req.user.id || req.user._id;

    if (!otp) {
      return res.status(400).json({ success: false, message: 'Return OTP is required.' });
    }

    const returnDoc = await ReturnRequest.findOne(
      buildReturnIdQuery(id, { captain: captainId })
    );

    if (!returnDoc) {
      return res.status(404).json({ success: false, message: 'Return pickup job not found or unauthorized.' });
    }

    if (returnDoc.status === 'PICKED_UP' || returnDoc.returnOtpVerifiedAt) {
      return res.status(400).json({ success: false, message: 'Return OTP has already been verified for this pickup.' });
    }

    // Verify OTP (allow dev bypass '0000', '1234', '123456')
    const cleanOtp = String(otp).trim();
    const isValidOtp = returnDoc.returnOtp === cleanOtp || ['0000', '1234', '123456'].includes(cleanOtp);
    if (!isValidOtp) {
      return res.status(400).json({ success: false, message: 'Invalid Return OTP. Please ask customer for correct code (or use 123456 / 0000).' });
    }

    // Mark PICKED_UP
    returnDoc.status = 'PICKED_UP';
    returnDoc.captainStatus = 'Picked Up';
    returnDoc.returnOtpVerifiedAt = new Date();
    returnDoc.pickedUpAt = new Date();
    returnDoc.pickupNotes = notes || (checklist && checklist.notes) || 'Product collected successfully';
    if (proofUrl) returnDoc.pickupProofUrl = proofUrl;

    if (checklist) {
      returnDoc.pickupChecklist = {
        correctItem: checklist.correctItem !== false,
        undamaged: checklist.undamaged !== false,
        originalTagsPresent: checklist.originalTagsPresent !== false,
        packagingIntact: checklist.packagingIntact !== false,
        notes: notes || checklist.notes || '',
      };
    }

    returnDoc.timeline.push({
      status: 'PICKED_UP',
      title: 'Product Quality Checked & OTP Verified',
      description: `Captain verified inspection checklist and customer Return OTP. Collected ${returnDoc.quantity} unit(s) of "${returnDoc.productName}".`,
      timestamp: new Date(),
      actor: 'Captain',
    });

    // Credit Captain Wallet for successful return pickup
    const captain = await Captain.findById(captainId);
    if (captain) {
      const earnings = Number(returnDoc.captainEarnings || 40);
      const balBefore = Number(captain.walletBalance || 0);
      const balAfter = Number((balBefore + earnings).toFixed(2));
      captain.walletBalance = balAfter;
      await captain.save();

      const txnId = `CTX-RET-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;
      await CaptainTransaction.create({
        transactionId: txnId,
        captainId,
        type: 'CREDIT',
        amount: earnings,
        grossAmount: earnings,
        commissionAmount: 0,
        balanceBefore: balBefore,
        balanceAfter: balAfter,
        description: `Earnings for Return Pickup #${returnDoc.returnId} (Order #${returnDoc.orderId})`,
      });

      await PlatformLedger.create({
        transactionId: `TXN-LED-CAP-RET-${Date.now().toString().slice(-6)}`,
        category: 'CAPTAIN_EARNING',
        type: 'CREDIT',
        amount: earnings,
        source: 'PLATFORM_TREASURY',
        destination: 'CAPTAIN',
        entityType: 'CAPTAIN',
        entityId: String(captain._id),
        entityName: captain.name,
        referenceModel: 'Order',
        referenceId: returnDoc.orderId,
        status: 'SUCCESS',
        description: `Captain payout for return pickup #${returnDoc.returnId}`,
      }).catch(() => {});
    }

    await returnDoc.save();

    res.status(200).json({
      success: true,
      message: 'Quality checklist confirmed and OTP verified successfully! Product marked as PICKED UP.',
      returnRequest: returnDoc,
    });
  } catch (error) {
    console.error('[captainVerifyReturnOtp ERROR]', error);
    next(error);
  }
};

// ──────────────────────────────────────────────
// 10b. Captain: Fail Doorstep Inspection
// PUT /api/returns/captain/:id/fail-inspection
// ──────────────────────────────────────────────
export const captainFailReturnInspection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { failureReason, notes } = req.body;
    const captainId = req.user.id || req.user._id;

    const returnDoc = await ReturnRequest.findOne(
      buildReturnIdQuery(id, { captain: captainId })
    );

    if (!returnDoc) {
      return res.status(404).json({ success: false, message: 'Return pickup job not found or unauthorized.' });
    }

    const reason = failureReason || notes || 'Product did not pass doorstep inspection checklist.';
    returnDoc.status = 'VERIFICATION_FAILED';
    returnDoc.verificationStatus = 'FAILED';
    returnDoc.rejectionReason = reason;
    returnDoc.verificationData = {
      correctItem: false,
      undamaged: false,
      originalTagsPresent: false,
      packagingIntact: false,
      failureReason: reason,
      verifierNotes: notes || '',
    };

    returnDoc.timeline.push({
      status: 'VERIFICATION_FAILED',
      title: 'Doorstep Quality Inspection Failed',
      description: `Captain rejected return pickup at doorstep. Reason: ${reason}`,
      timestamp: new Date(),
      actor: 'Captain',
    });

    await returnDoc.save();

    if (returnDoc.order) {
      await Order.findByIdAndUpdate(returnDoc.order, {
        orderStatus: 'Return Rejected',
        returnStatus: 'Rejected',
        rejectionReason: reason,
      });
      if (returnDoc.user) invalidateUserOrdersCache(returnDoc.user);
    }

    res.status(200).json({
      success: true,
      message: 'Inspection marked as failed. Return pickup closed.',
      returnRequest: returnDoc,
    });
  } catch (error) {
    console.error('[captainFailReturnInspection ERROR]', error);
    next(error);
  }
};

// ──────────────────────────────────────────────
// 11. Seller / Admin: Mark Received & Start Verification
// PUT /api/returns/:id/seller-receive
// ──────────────────────────────────────────────
export const sellerReceiveReturnedProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const returnDoc = await ReturnRequest.findOne(buildReturnIdQuery(id));
    if (!returnDoc) {
      return res.status(404).json({ success: false, message: 'Return request not found.' });
    }

    returnDoc.status = 'UNDER_VERIFICATION';
    returnDoc.receivedAt = returnDoc.receivedAt || new Date();
    returnDoc.receivedBy = req.user.name || 'Seller Store';
    returnDoc.receivingNotes = notes || 'Received at store. Quality verification in progress.';
    returnDoc.verificationStatus = 'PENDING';

    returnDoc.timeline.push({
      status: 'UNDER_VERIFICATION',
      title: 'Product Under Quality Verification',
      description: 'Returned product received at seller facility. Quality check in progress.',
      timestamp: new Date(),
      actor: req.user.role === 'admin' ? 'Admin' : 'Seller',
    });

    await returnDoc.save();

    res.status(200).json({
      success: true,
      message: 'Product marked as received. Quality verification started.',
      returnRequest: returnDoc,
    });
  } catch (error) {
    console.error('[sellerReceiveReturnedProduct ERROR]', error);
    next(error);
  }
};

// ──────────────────────────────────────────────
// 12. Seller / Admin: Product Verification & Refund Workflow
// PUT /api/returns/:id/verify
// body: {
//   verificationPassed: true/false,
//   checklist: { correctItem, undamaged, originalTagsPresent, packagingIntact },
//   failureReason: '',
//   verifierNotes: ''
// }
// ──────────────────────────────────────────────
export const verifyReturnedProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      verificationPassed,
      outcome,
      action,
      checklist,
      failureReason,
      rejectionReason,
      verifierNotes,
      inspectionNotes,
      notes,
    } = req.body;

    const isPassed =
      verificationPassed === true ||
      verificationPassed === 'true' ||
      outcome === 'PASSED' ||
      outcome === true ||
      action === 'APPROVE' ||
      action === 'PASS';

    const userId = req.user.id || req.user._id;

    const returnDoc = await ReturnRequest.findOne(buildReturnIdQuery(id));
    if (!returnDoc) {
      return res.status(404).json({ success: false, message: 'Return request not found.' });
    }

    if (returnDoc.verificationStatus === 'PASSED' && returnDoc.status === 'COMPLETED' && isPassed) {
      return res.status(400).json({ success: false, message: 'This return has already been verified and refunded.' });
    }

    const effectiveNotes = verifierNotes || inspectionNotes || notes || '';
    const effectiveFailureReason = failureReason || rejectionReason || (isPassed ? '' : 'Product did not pass return inspection criteria.');

    returnDoc.verificationStatus = isPassed ? 'PASSED' : 'FAILED';
    returnDoc.verifiedBy = userId;
    returnDoc.verifiedByRole = req.user.role === 'admin' ? 'admin' : 'seller';
    returnDoc.verifiedAt = new Date();
    returnDoc.rejectionReason = isPassed ? '' : effectiveFailureReason;
    returnDoc.verificationData = {
      correctItem: checklist?.correctItem !== false,
      undamaged: checklist?.undamaged !== false,
      originalTagsPresent: checklist?.originalTagsPresent !== false,
      packagingIntact: checklist?.packagingIntact !== false,
      failureReason: effectiveFailureReason,
      verifierNotes: effectiveNotes,
    };

    if (!isPassed) {
      returnDoc.status = 'VERIFICATION_FAILED';
      returnDoc.timeline.push({
        status: 'VERIFICATION_FAILED',
        title: 'Product Verification Failed',
        description: `Item inspection failed. Reason: ${returnDoc.verificationData.failureReason}`,
        timestamp: new Date(),
        actor: req.user.role === 'admin' ? 'Admin' : 'Seller',
      });
      await returnDoc.save();

      if (returnDoc.order) {
        await Order.findByIdAndUpdate(returnDoc.order, {
          orderStatus: 'Return Rejected',
          returnStatus: 'Rejected',
          rejectionReason: effectiveFailureReason,
        });
        if (returnDoc.user) invalidateUserOrdersCache(returnDoc.user);
      }

      return res.status(200).json({
        success: true,
        message: 'Product verification marked as failed. Refund will not be processed.',
        returnRequest: returnDoc,
      });
    }

    // Verification PASSED -> Process Refund, Inventory Restoration, and Seller Settlement Reversal
    returnDoc.status = 'VERIFICATION_PASSED';
    returnDoc.timeline.push({
      status: 'VERIFICATION_PASSED',
      title: 'Quality Verification Passed',
      description: 'Returned product inspected and approved. Processing refund.',
      timestamp: new Date(),
      actor: req.user.role === 'admin' ? 'Admin' : 'Seller',
    });

    // 1. INVENTORY RESTORATION (Single Execution / Idempotent)
    if (!returnDoc.inventoryRestored && returnDoc.product) {
      await Product.findByIdAndUpdate(returnDoc.product, {
        $inc: { stock: returnDoc.quantity },
      }).catch((err) => console.warn('[Inventory] Stock restoration error:', err.message));

      returnDoc.inventoryRestored = true;
      returnDoc.inventoryRestoredAt = new Date();
      returnDoc.timeline.push({
        status: 'INVENTORY_RESTORED',
        title: 'Stock Restored',
        description: `Restored ${returnDoc.quantity} unit(s) of "${returnDoc.productName}" back to active inventory.`,
        timestamp: new Date(),
        actor: 'System',
      });
    }

    // 2. REFUND PROCESSING (To User Wallet / Refund Record)
    const refundAmt = Number(returnDoc.refundAmount || 0);
    if (refundAmt > 0 && returnDoc.refundStatus !== 'COMPLETED') {
      returnDoc.status = 'REFUND_INITIATED';

      // Credit User Wallet + ledger if user exists
      if (returnDoc.user) {
        await creditUserWallet({
          userId: returnDoc.user,
          amount: refundAmt,
          category: 'REFUND',
          orderId: returnDoc.orderId || '',
          order: returnDoc.order || null,
          returnId: returnDoc.returnId || '',
          description: `Refund for return #${returnDoc.returnId}: ${returnDoc.productName || 'item'}`,
        });
      }

      // Record Refund Request Entity for SuperAdmin / Financial Reports
      const refundRecordId = `REF-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;
      await RefundRequest.create({
        refundId: refundRecordId,
        orderId: returnDoc.orderId,
        order: returnDoc.order,
        userId: returnDoc.user,
        userName: returnDoc.customerName,
        userPhone: returnDoc.customerPhone,
        amount: refundAmt,
        reason: `Item Return #${returnDoc.returnId}: ${returnDoc.reason}`,
        status: 'COMPLETED',
        paymentMethod: returnDoc.refundMethod,
        processedBy: userId,
        processedAt: new Date(),
        remarks: `Refund credited for returned item "${returnDoc.productName}" (Qty: ${returnDoc.quantity})`,
      }).catch((err) => console.warn('[RefundRequest] Creation error:', err.message));

      // Record in Platform Treasury Ledger
      await PlatformLedger.create({
        transactionId: `TXN-LED-REFUND-${Date.now().toString().slice(-6)}`,
        category: 'REFUND',
        type: 'DEBIT',
        amount: refundAmt,
        source: 'PLATFORM_TREASURY',
        destination: 'USER',
        entityType: 'USER',
        entityId: String(returnDoc.user),
        entityName: returnDoc.customerName,
        referenceModel: 'Order',
        referenceId: returnDoc.orderId,
        status: 'SUCCESS',
        description: `Refund for return #${returnDoc.returnId} (${returnDoc.productName})`,
      }).catch(() => {});

      returnDoc.refundStatus = 'COMPLETED';
      returnDoc.refundReference = refundRecordId;
      returnDoc.refundProcessedAt = new Date();
      returnDoc.status = 'REFUNDED';

      returnDoc.timeline.push({
        status: 'REFUNDED',
        title: `Refund of ₹${refundAmt.toFixed(2)} Processed`,
        description: `Refund amount credited to customer wallet / original payment source.`,
        timestamp: new Date(),
        actor: 'System',
      });
    }

    // 3. SELLER SETTLEMENT REVERSAL (Adjust seller wallet balance if already settled)
    if (!returnDoc.sellerSettlementAdjusted && returnDoc.seller) {
      const seller = await Seller.findById(returnDoc.seller);
      if (seller) {
        const commRate = seller.commissionPercentage || 10;
        const grossReturn = Number(returnDoc.refundAmount || returnDoc.itemTotal || 0);
        const commReversal = Number(((grossReturn * commRate) / 100).toFixed(2));
        const netDeduction = Number((grossReturn - commReversal).toFixed(2));

        const balanceBefore = Number(seller.walletBalance || 0);
        const balanceAfter = Number((balanceBefore - netDeduction).toFixed(2));
        seller.walletBalance = balanceAfter;
        seller.totalEarnings = Math.max(0, Number(((seller.totalEarnings || 0) - netDeduction).toFixed(2)));
        await seller.save();

        const txnId = `TXN-REV-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;
        await WalletTransaction.create({
          transactionId: txnId,
          sellerId: String(seller._id),
          order: returnDoc.order,
          orderId: returnDoc.orderId,
          type: 'DEBIT',
          grossAmount: grossReturn,
          commissionRate: commRate,
          commissionAmount: commReversal,
          netAmount: netDeduction,
          balanceBefore,
          balanceAfter,
          settlementStatus: 'SETTLED',
          description: `Settlement reversal for Returned Item #${returnDoc.returnId} (Net -₹${netDeduction})`,
        });

        returnDoc.sellerSettlementAdjusted = true;
        returnDoc.sellerSettlementReversedAmount = netDeduction;
      }
    }

    returnDoc.status = 'COMPLETED';
    returnDoc.timeline.push({
      status: 'COMPLETED',
      title: 'Return Completed Successfully',
      description: 'All return, verification, refund, and inventory restoration steps finished.',
      timestamp: new Date(),
      actor: 'System',
    });

    await returnDoc.save();

    if (returnDoc.order) {
      await Order.findByIdAndUpdate(returnDoc.order, {
        orderStatus: 'Refund Completed',
        returnStatus: 'Refunded',
        refundStatus: 'Completed',
        refundedAt: new Date(),
      });
      if (returnDoc.user) invalidateUserOrdersCache(returnDoc.user);
    }

    res.status(200).json({
      success: true,
      message: 'Product verified successfully! Refund processed, stock restored, and return completed.',
      returnRequest: returnDoc,
    });
  } catch (error) {
    console.error('[verifyReturnedProduct ERROR]', error);
    next(error);
  }
};

// ──────────────────────────────────────────────
// 13. Admin: Get Platform-Wide Returns
// GET /api/returns/admin/all
// ──────────────────────────────────────────────
export const getAdminReturns = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status && status !== 'All') {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { returnId: { $regex: search, $options: 'i' } },
        { orderId: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } },
        { productName: { $regex: search, $options: 'i' } },
        { sellerName: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [returns, total] = await Promise.all([
      ReturnRequest.find(query)
        .populate('order', 'orderId orderStatus grandTotal createdAt paymentMethod')
        .populate('captain', 'name phone vehicleType')
        .populate('seller', 'businessName phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      ReturnRequest.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      returns,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error('[getAdminReturns ERROR]', error);
    next(error);
  }
};

// ──────────────────────────────────────────────
// 14. Admin: Assign Captain Manually
// PUT /api/returns/:id/assign-captain
// ──────────────────────────────────────────────
export const adminAssignCaptain = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { captainId } = req.body;

    if (!captainId) {
      return res.status(400).json({ success: false, message: 'Captain ID is required.' });
    }

    const captain = await Captain.findById(captainId);
    if (!captain) {
      return res.status(404).json({ success: false, message: 'Captain not found.' });
    }

    const returnDoc = await ReturnRequest.findOne(buildReturnIdQuery(id));
    if (!returnDoc) {
      return res.status(404).json({ success: false, message: 'Return request not found.' });
    }

    returnDoc.captain = captain._id;
    returnDoc.status = 'CAPTAIN_ASSIGNED';
    returnDoc.captainStatus = 'Assigned';
    returnDoc.captainAssignedAt = new Date();

    returnDoc.timeline.push({
      status: 'CAPTAIN_ASSIGNED',
      title: 'Captain Assigned by Admin',
      description: `Captain ${captain.name} was assigned for return pickup by platform Admin.`,
      timestamp: new Date(),
      actor: 'Admin',
    });

    await returnDoc.save();

    await CaptainNotification.create({
      captainId: captain._id,
      type: 'DELIVERY',
      title: 'Return Pickup Mission Assigned!',
      message: `You have been assigned to return pickup #${returnDoc.returnId} for "${returnDoc.productName}".`,
      orderId: returnDoc.orderId,
      order: returnDoc.order,
      icon: 'keyboard_return',
    }).catch(() => {});

    res.status(200).json({
      success: true,
      message: `Captain ${captain.name} assigned successfully.`,
      returnRequest: returnDoc,
    });
  } catch (error) {
    console.error('[adminAssignCaptain ERROR]', error);
    next(error);
  }
};
