import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  ChevronLeft, HelpCircle, ChevronRight, Check, Truck, MapPin, 
  CreditCard, Box, ShieldCheck, Clock, User, Phone, KeyRound, Star, 
  RotateCcw, AlertTriangle, X, ArrowRight, RefreshCw, Loader2, CheckCircle2,
  PackageCheck, HelpCircle as HelpIcon, Sparkles
} from 'lucide-react';
import grainsImg from '../../../assets/user/categories/grains-removebg-preview.png';
import { orderService, returnService } from '../../../services/authService';
import productReviewService from '../../../services/productReviewService';
import ProductRatingModal from '../../../components/ProductRatingModal';
import RatingModal from '../../../components/RatingModal';
import ratingService from '../../../services/ratingService';
import LiveDeliveryMap from '../components/LiveDeliveryMap';
import { getImageUrl, handleImageError } from '../../../utils/imageUtils';
import { variantLabel } from '../../../utils/variantLabel';

const RETURN_REASONS = [
  'Damaged / Defective product received',
  'Wrong item or variant delivered',
  'Product quality not as expected',
  'Missing items or parts from order',
  'Received expired or near-expiry product',
  'Product different from description',
  'Item no longer needed',
  'Other reason'
];

const TrackOrder = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initialOrder = location.state?.order;

  const [liveOrder, setLiveOrder] = useState(initialOrder || null);
  const [loadingOrder, setLoadingOrder] = useState(!initialOrder);

  // Reviews State
  const [orderReviews, setOrderReviews] = useState({});
  const [selectedProductToRate, setSelectedProductToRate] = useState(null);
  const [selectedReviewToEdit, setSelectedReviewToEdit] = useState(null);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [isDeliveryRatingOpen, setIsDeliveryRatingOpen] = useState(false);
  const [hasRatedDelivery, setHasRatedDelivery] = useState(false);
  const [deliveryUserRating, setDeliveryUserRating] = useState(null);

  // Item-Level Returns State
  const [orderReturns, setOrderReturns] = useState([]);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedItemToReturn, setSelectedItemToReturn] = useState(null);
  const [returnQuantity, setReturnQuantity] = useState(1);
  const [returnReason, setReturnReason] = useState(RETURN_REASONS[0]);
  const [returnRemarks, setReturnRemarks] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [returnSuccessToast, setReturnSuccessToast] = useState('');
  const [returnErrorToast, setReturnErrorToast] = useState('');

  // Fetch returns for this order
  const fetchOrderReturns = async (targetOrderId) => {
    if (!targetOrderId) return;
    try {
      const res = await returnService.getMyReturns({ orderId: targetOrderId });
      if (res && res.success && Array.isArray(res.returns)) {
        setOrderReturns(res.returns);
      }
    } catch (err) {
      console.warn('TrackOrder fetch returns error:', err.message);
    }
  };

  // Fetch reviews for this delivered order
  const fetchOrderReviews = async (targetOrderId) => {
    if (!targetOrderId) return;
    try {
      const res = await productReviewService.getOrderReviewStatus(targetOrderId);
      if (res && res.success && res.reviews) {
        setOrderReviews(res.reviews);
      }
    } catch (err) {
      console.warn('TrackOrder fetch reviews error:', err.message);
    }
  };

  // Poll for live status update every 4 seconds
  useEffect(() => {
    const targetId = liveOrder?._id || liveOrder?.id || liveOrder?.orderId || initialOrder?._id || initialOrder?.orderId;
    if (!targetId) return;

    let isMounted = true;
    let interval = null;
    // Once the order reaches one of these, nothing more will change — stop polling.
    const FINAL_STATUSES = [
      'Delivered', 'Cancelled', 'Rejected', 'Failed',
      'Return Requested', 'Return Approved', 'Return Rejected', 'Returned',
      'Refund Completed', 'Refunded',
    ];
    const fetchLive = async () => {
      try {
        const res = await orderService.getOrderById(targetId);
        if (isMounted && res.success && res.order) {
          setLiveOrder(res.order);
          // Reviews / returns for a delivered order are loaded by the effect below
          if (FINAL_STATUSES.includes(res.order.orderStatus) || res.order.captainStatus === 'Delivered') {
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.warn('TrackOrder fetch error:', err.message);
      } finally {
        if (isMounted) setLoadingOrder(false);
      }
    };

    fetchLive();
    const startStatus = initialOrder?.orderStatus;
    if (!FINAL_STATUSES.includes(startStatus) && initialOrder?.captainStatus !== 'Delivered') {
      interval = setInterval(() => {
        if (!document.hidden) fetchLive();
      }, 8000);
    }
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const order = liveOrder || initialOrder;

  const orderStatus = order?.orderStatus || order?.status || 'Placed';
  const captainStatus = order?.captainStatus || '';
  const sellerStatus = order?.sellerStatus || '';
  const deliveryOtp = order?.deliveryOtp || '';
  const sellerHasAccepted = [
    'Accepted',
    'ACCEPTED',
    'Packed',
    'PACKED',
    'Processing',
    'PROCESSING',
    'Out for Delivery',
    'OUT_FOR_DELIVERY',
    'Delivered',
    'DELIVERED',
  ].includes(sellerStatus);
  const captainHasAccepted = [
    'Accepted',
    'At Pickup',
    'Reached Store',
    'Picked Up',
    'In Transit',
    'Out for Delivery',
    'Delivered',
  ].includes(captainStatus);

  const isRefundCompleted = orderStatus === 'Refund Completed' || order?.refundStatus === 'Completed' || order?.returnStatus === 'Refunded' || orderReturns.some(r => ['REFUNDED', 'COMPLETED'].includes(r.status));
  const isReturned = orderStatus === 'Returned' || order?.returnStatus === 'Completed';
  const isReturnApproved = orderStatus === 'Return Approved' || order?.returnStatus === 'Approved';
  const isReturnRejected = orderStatus === 'Return Rejected' || order?.returnStatus === 'Rejected';
  const isReturnRequested = orderStatus === 'Return Requested' || order?.returnStatus === 'Pending' || order?.returnStatus === 'Requested' || orderReturns.length > 0;
  const isDelivered = orderStatus === 'Delivered' || captainStatus === 'Delivered' || order?.status === 'Delivered' || ['Return Requested', 'Return Approved', 'Returned', 'Return Rejected', 'Refund Completed', 'Refunded'].includes(orderStatus) || isRefundCompleted;
  const hasReturnRecord = isRefundCompleted || isReturnRequested || isReturnApproved || isReturnRejected || isReturned || orderReturns.length > 0;

  // Load returns once per order (and again when its status changes), reviews only after delivery
  const trackedOrderId = order?.orderId || order?._id || order?.id;
  useEffect(() => {
    if (!trackedOrderId) return;
    fetchOrderReturns(trackedOrderId);
    if (isDelivered) fetchOrderReviews(trackedOrderId);
  }, [trackedOrderId, order?.orderStatus, order?.captainStatus, isDelivered]);

  // Delivery (captain) rating status after grocery order is delivered
  const captainIdKey = String(order?.captainId?._id || order?.captainId || '');
  useEffect(() => {
    const rideId = order?.orderId || order?._id;
    const hasCaptain = Boolean(captainIdKey);
    if (!isDelivered || !rideId || !hasCaptain) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await ratingService.getRideRatingStatus(rideId);
        if (cancelled) return;
        const rated = Boolean(res?.hasUserRated || res?.userRating || res?.rating);
        setHasRatedDelivery(rated);
        setDeliveryUserRating(res?.userRating || res?.rating?.rating || null);
        if (!rated && !sessionStorage.getItem(`sathiseller_delivery_rate_prompt_${rideId}`)) {
          sessionStorage.setItem(`sathiseller_delivery_rate_prompt_${rideId}`, '1');
          setIsDeliveryRatingOpen(true);
        }
      } catch {
        if (!cancelled) setHasRatedDelivery(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isDelivered, order?.orderId, order?._id, captainIdKey]);

  const handleOpenRateModal = (item, existingRev = null) => {
    const prodObj = {
      _id: item.product?._id || item.product || item.productId || item.id,
      id: item.product?._id || item.product || item.productId || item.id,
      name: item.name || item.product?.name || 'Product Item',
      image: item.image || item.product?.mainImage || item.product?.image || '',
      price: item.price || item.product?.price || 0,
    };
    setSelectedProductToRate(prodObj);
    setSelectedReviewToEdit(existingRev || null);
    setIsRatingModalOpen(true);
  };

  const handleReviewSuccess = (reviewData) => {
    if (reviewData && reviewData.productId) {
      setOrderReviews((prev) => ({
        ...prev,
        [reviewData.productId]: reviewData,
      }));
    }
    const targetOrderId = order?.orderId || order?._id || order?.id;
    if (targetOrderId) fetchOrderReviews(targetOrderId);
  };

  // Open Return Modal for a specific item
  const handleOpenReturnModal = (item = null) => {
    const targetItem = item || (order?.items && order.items[0]);
    setSelectedItemToReturn(targetItem);
    setReturnQuantity(1);
    setReturnReason(RETURN_REASONS[0]);
    setReturnRemarks('');
    setReturnErrorToast('');
    setIsReturnModalOpen(true);
  };

  // Handle Return Request Submission
  const handleReturnSubmit = async (e) => {
    e?.preventDefault();
    const targetOrderId = order?.orderId || order?._id || order?.id;
    if (!targetOrderId || !selectedItemToReturn) return;

    setSubmittingReturn(true);
    setReturnErrorToast('');
    try {
      const res = await returnService.requestItemReturn({
        orderId: targetOrderId,
        orderItemId: selectedItemToReturn._id,
        productId: selectedItemToReturn.product?._id || selectedItemToReturn.product,
        quantity: returnQuantity,
        reason: returnReason,
        customerNotes: returnRemarks.trim(),
      });

      if (res && res.success) {
        setIsReturnModalOpen(false);
        setReturnSuccessToast('Item return request submitted! Track pickup status below.');
        fetchOrderReturns(targetOrderId);
        setTimeout(() => setReturnSuccessToast(''), 4500);
      } else {
        setReturnErrorToast(res?.message || 'Failed to submit return request.');
      }
    } catch (err) {
      console.error('Error submitting return:', err);
      setReturnErrorToast(err.response?.data?.message || err.message || 'Error processing return request.');
    } finally {
      setSubmittingReturn(false);
    }
  };

  // Order Details
  const orderId = order?.id || order?.orderId || order?._id || 'ORD-849201';
  const orderDate = order?.date || (order?.createdAt ? new Date(order.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Today');

  const items = order?.items && order.items.length > 0 ? order.items : [
    { name: 'Basmati Rice Premium 5kg', price: 540, quantity: 1, image: grainsImg }
  ];
  const itemsTotal = order?.itemsTotal !== undefined ? Number(order.itemsTotal) : items.reduce((acc, i) => acc + (Number(i.price || 0)) * (Number(i.quantity || 1)), 0);
  const shippingFee = order?.shippingFee !== undefined ? Number(order.shippingFee) : 0;
  const codCharge = order?.codCharge !== undefined ? Number(order.codCharge) : 0;
  const grandTotal = order?.grandTotal !== undefined ? Number(order.grandTotal) : (order?.total !== undefined ? Number(order.total) : (itemsTotal + shippingFee + codCharge));
  const shippingAddress = order?.shippingAddress || {
    fullName: localStorage.getItem('sathiseller_user_name') || 'Customer',
    addressLine1: 'Sector 45, Near Film City',
    city: 'Noida',
    state: 'Uttar Pradesh',
    pincode: '201301',
    phone: localStorage.getItem('sathiseller_user_phone') || '+91 9876543210',
  };
  const paymentMethod = order?.paymentMethod || 'COD';
  const paymentStatus = order?.paymentStatus || (paymentMethod === 'COD' ? 'Pending' : 'Paid');

  // Live captain tracking (map + polyline) — only while the order is out for delivery
  const isOutForDelivery = sellerHasAccepted && !isDelivered && (orderStatus === 'Out for Delivery' || captainStatus === 'In Transit' || captainStatus === 'Picked Up');
  const captainLiveCoords = order?.captainId?.liveLocation?.coordinates;
  const captainPosition = Array.isArray(captainLiveCoords) && captainLiveCoords.length === 2
    ? { lat: captainLiveCoords[1], lng: captainLiveCoords[0] }
    : null;
  const destinationAddress = [
    shippingAddress.addressLine1 || shippingAddress.address,
    shippingAddress.landmark,
    shippingAddress.city,
    shippingAddress.state,
    shippingAddress.pincode || shippingAddress.zip,
  ].filter(Boolean).join(', ');

  // Status steps mapping
  const steps = [
    { key: 'Placed', label: orderStatus === 'Payment Pending' ? 'Payment Pending' : 'Order Placed', sub: orderStatus === 'Payment Pending' ? 'Complete payment to place this order' : 'Order received' },
    { key: 'Processing', label: 'Store Processing', sub: captainStatus === 'At Pickup' ? 'Captain at Store' : 'Preparing items' },
    { key: 'Out for Delivery', label: 'Out for Delivery', sub: 'On the way to you' },
    { 
      key: 'Delivered', 
      label: isRefundCompleted ? 'Refund Completed' : hasReturnRecord ? 'Return Process' : 'Delivered', 
      sub: isRefundCompleted ? 'Refund credited to wallet' : hasReturnRecord ? 'Under return process' : 'Order completed' 
    },
  ];

  const getStepIndex = () => {
    if (isDelivered) return 3;
    if (!sellerHasAccepted) return 0;
    if (orderStatus === 'Out for Delivery' || captainStatus === 'In Transit' || captainStatus === 'Picked Up') return 2;
    if (orderStatus === 'Accepted' || orderStatus === 'Processing' || orderStatus === 'Reached Store / Pickup' || sellerHasAccepted) return 1;
    return 0;
  };

  const currentStepIndex = getStepIndex();

  const getDisplayStatusBadge = () => {
    if (isRefundCompleted) return { text: 'Refund Completed', color: 'bg-emerald-50 text-emerald-800 border-emerald-300 font-black' };
    if (isReturned) return { text: 'Returned', color: 'bg-purple-50 text-purple-700 border-purple-200' };
    if (isReturnApproved) return { text: 'Return Approved', color: 'bg-teal-50 text-teal-700 border-teal-200' };
    if (isReturnRejected) return { text: 'Return Rejected', color: 'bg-rose-50 text-rose-700 border-rose-200' };
    if (isReturnRequested) return { text: 'Return Requested', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    if (orderStatus === 'Delivered' || captainStatus === 'Delivered') return { text: 'Delivered', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (orderStatus === 'Out for Delivery' || captainStatus === 'In Transit') return { text: 'Out for Delivery', color: 'bg-amber-50 text-amber-700 border-amber-200' };
    if (sellerHasAccepted && (captainStatus === 'At Pickup' || orderStatus === 'Reached Store / Pickup')) return { text: 'Captain at Store', color: 'bg-blue-50 text-blue-700 border-blue-200' };
    if (sellerHasAccepted && (orderStatus === 'Accepted' || orderStatus === 'Processing' || sellerStatus === 'Accepted' || sellerStatus === 'ACCEPTED')) return { text: 'Order Accepted', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (orderStatus === 'Rejected') return { text: 'Rejected', color: 'bg-red-50 text-red-700 border-red-200' };
    if (orderStatus === 'Payment Pending') return { text: 'Payment Pending', color: 'bg-amber-50 text-amber-800 border-amber-200' };
    return { text: 'Order Placed', color: 'bg-orange-50 text-[#ea580c] border-orange-200/60' };
  };

  const statusBadge = getDisplayStatusBadge();

  return (
    <div className="w-full max-w-[480px] md:max-w-6xl mx-auto h-[100dvh] md:h-auto md:min-h-screen bg-[#f8fafc] font-sans text-slate-800 relative shadow-[0_0_20px_rgba(0,0,0,0.05)] md:shadow-none flex flex-col overflow-hidden md:overflow-visible md:px-6 md:py-8">
      
      {/* Toast Notification */}
      {returnSuccessToast && (
        <div className="fixed top-5 right-5 z-50 bg-[#002625] text-white px-4 py-3 rounded-2xl shadow-2xl border border-white/20 text-xs font-bold animate-in fade-in slide-in-from-top-3 flex items-center gap-2.5 max-w-md">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <span>{returnSuccessToast}</span>
        </div>
      )}

      {/* Mobile Header */}
      <header className="md:hidden flex justify-between items-center py-4 px-4 bg-white border-b border-slate-100 z-10 sticky top-0 shadow-xs">
        <div className="flex items-center gap-3">
          <button className="bg-transparent border-none cursor-pointer p-0 flex items-center" onClick={() => navigate(-1)}>
            <ChevronLeft size={24} className="text-slate-800" />
          </button>
          <h2 className="text-[15px] font-extrabold tracking-wide m-0 text-slate-900 uppercase">Live Order Tracking</h2>
        </div>
        <button 
          onClick={() => navigate('/support')}
          className="bg-transparent border-none cursor-pointer p-0 flex items-center gap-1 text-[#ea580c] font-bold text-[12px]"
        >
          <HelpCircle size={16} />
          HELP
        </button>
      </header>

      {/* Desktop Header & Breadcrumb */}
      <div className="hidden md:flex items-center justify-between mb-6 bg-white p-5 rounded-2xl border border-slate-100 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <button onClick={() => navigate(-1)} className="hover:text-orange-600 font-medium cursor-pointer border-none bg-transparent flex items-center gap-1">
              <ChevronLeft size={16} /> Back
            </button>
            <span>/</span>
            <button onClick={() => navigate('/orders')} className="hover:text-orange-600 font-medium cursor-pointer border-none bg-transparent">
              Orders
            </button>
            <span>/</span>
            <span className="text-slate-800 font-bold">#{orderId}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 m-0">Live Order Tracking & Details</h1>
        </div>
        <button 
          onClick={() => navigate('/support')} 
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#ea580c] font-bold text-sm border border-orange-200 cursor-pointer transition-colors"
        >
          <HelpCircle size={17} /> Customer Support
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-[40px] md:pb-12 [&::-webkit-scrollbar]:hidden p-4 md:p-0 md:overflow-visible">
        <div className="flex flex-col md:grid md:grid-cols-12 md:gap-8 space-y-4 md:space-y-0">
          
          {/* Left Column (Col 7 on Desktop): Status, Progress, Return CTA, Captain (only before delivery), Address */}
          <div className="md:col-span-7 flex flex-col gap-4">
            
            {/* Order Header Summary Card */}
            <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-100 shadow-xs flex flex-col gap-3">
              <div className="flex justify-between items-start pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[11px] md:text-xs font-bold uppercase tracking-wider text-slate-400 block">Order ID</span>
                  <span className="text-[15px] md:text-lg font-extrabold text-slate-900">#{orderId}</span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] md:text-xs font-bold uppercase tracking-wider text-slate-400 block">Placed On</span>
                  <span className="text-[13px] md:text-sm font-bold text-slate-700">{orderDate}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[12px] md:text-sm font-bold text-slate-500">Live Status</span>
                <span className={`text-[11px] md:text-xs font-extrabold px-3.5 py-1 rounded-full uppercase border ${statusBadge.color}`}>
                  {statusBadge.text}
                </span>
              </div>

              {/* Rejection Alert Box */}
              {orderStatus === 'Rejected' && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-xs mt-1">
                  <span className="font-extrabold block text-red-800">✕ Order Rejected by Seller</span>
                  <span className="font-medium text-slate-700">Reason: "{order?.rejectionReason || 'Unable to fulfill order'}"</span>
                </div>
              )}
            </div>

            {/* Live Delivery Progress Steps */}
            <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-100 shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck size={20} className="text-[#ea580c]" />
                  <h3 className="text-[13px] md:text-sm font-extrabold text-slate-900 uppercase tracking-wider m-0">Delivery Progress</h3>
                </div>
                <span className="text-[10px] md:text-xs font-bold text-slate-400">Live real-time sync</span>
              </div>

              <div className="relative py-2">
                <div className="flex justify-between relative z-10">
                  {steps.map((step, index) => {
                    const isCompleted = index <= currentStepIndex;
                    const isCurrent = index === currentStepIndex;

                    return (
                      <div key={step.key} className="flex flex-col items-center gap-1.5 w-1/4">
                        <div 
                          className={`w-[28px] h-[28px] md:w-8 md:h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                            isCompleted 
                              ? 'bg-[#ea580c] border-[#ea580c] text-white shadow-xs' 
                              : 'bg-white border-slate-200 text-slate-300'
                          }`}
                        >
                          {isCompleted ? <Check size={16} strokeWidth={3} /> : <div className="w-2 h-2 rounded-full bg-slate-300"></div>}
                        </div>
                        <span className={`text-[10px] md:text-xs text-center font-bold leading-tight ${isCurrent ? 'text-[#ea580c]' : isCompleted ? 'text-slate-800' : 'text-slate-400'}`}>
                          {step.label}
                        </span>
                        <span className="text-[9px] md:text-[11px] text-center text-slate-400 leading-tight">
                          {step.sub}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {isDelivered && order?.captainId && (
              <div className="bg-white rounded-2xl p-4 md:p-5 border border-emerald-100 shadow-xs space-y-3">
                <div className="flex items-center gap-2">
                  <Truck size={18} className="text-emerald-600" />
                  <h3 className="text-[13px] md:text-sm font-extrabold text-slate-900 m-0">Rate Delivery</h3>
                </div>
                <p className="text-[11px] text-slate-500 m-0">
                  How was your delivery experience with {order.captainId?.name || 'your captain'}?
                </p>
                {hasRatedDelivery ? (
                  <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                    <span className="text-[12px] font-bold text-amber-900">
                      You rated {deliveryUserRating || order.userRating || 5}/5
                    </span>
                    <Star size={14} className="fill-amber-500 text-amber-500" />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsDeliveryRatingOpen(true)}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold border-none cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Star size={14} className="fill-white text-white" />
                    Rate Captain
                  </button>
                )}
              </div>
            )}

            {isDelivered && order?.items?.length > 0 && (
              <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-100 shadow-xs space-y-3">
                <div className="flex items-center gap-2">
                  <Star size={18} className="text-[#ea580c] fill-[#ea580c]" />
                  <h3 className="text-[13px] md:text-sm font-extrabold text-slate-900 m-0">Rate Product</h3>
                </div>
                <p className="text-[11px] text-slate-500 m-0">
                  Order delivered. Rate the product you received.
                </p>
                <div className="flex flex-col gap-2">
                  {order.items.map((item, idx) => {
                    const prodId = item.product?._id || item.product || item.productId || item.id;
                    const itemReview = prodId ? (orderReviews[prodId] || orderReviews[String(prodId)]) : null;
                    const itemName = item.name || item.product?.name || 'Product';
                    const itemImg = item.image || item.product?.mainImage || grainsImg;
                    return (
                      <div key={item._id || idx} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                        <div className="w-11 h-11 rounded-lg bg-white border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                          <img
                            src={getImageUrl(itemImg, itemName)}
                            alt={itemName}
                            className="w-[85%] h-[85%] object-contain"
                            onError={(e) => handleImageError(e, itemName)}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-slate-900 m-0 truncate">{itemName}</p>
                          {variantLabel(item) && (
                            <span className="text-[11px] font-semibold text-[#ea580c]">{variantLabel(item)}</span>
                          )}
                        </div>
                        {itemReview ? (
                          <button
                            type="button"
                            onClick={() => handleOpenRateModal(item, itemReview)}
                            className="shrink-0 px-3 py-2 text-[11px] font-bold rounded-xl border border-amber-200 bg-amber-50 text-amber-800 cursor-pointer flex items-center gap-1"
                          >
                            <Star size={12} className="fill-amber-500 text-amber-500" />
                            Rated {itemReview.rating}/5
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenRateModal(item)}
                            className="shrink-0 px-3 py-2 text-[11px] font-bold rounded-xl border border-orange-200 bg-orange-50 hover:bg-orange-100 text-[#ea580c] cursor-pointer flex items-center gap-1"
                          >
                            <Star size={12} className="fill-[#ea580c] text-[#ea580c]" />
                            Rate Product
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* RETURN & REFUND SECTION (Visible on Delivered Orders) */}
            {isDelivered && (
              <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-100 shadow-xs space-y-3">
                {orderReturns.length > 0 ? (
                  /* Item-Level Return Tracking Cards */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <RotateCcw size={18} className="text-amber-600" />
                        <h3 className="text-[13px] md:text-sm font-extrabold text-slate-900 m-0">
                          Active Return & Pickup ({orderReturns.length})
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenReturnModal()}
                        className="text-xs font-bold text-[#ea580c] hover:underline cursor-pointer border-none bg-transparent flex items-center gap-1"
                      >
                        + Return Another Item
                      </button>
                    </div>

                    <div className="flex flex-col gap-3">
                      {orderReturns.map((ret, rIdx) => {
                        const isPendingPickup = ['REQUESTED', 'APPROVED', 'CAPTAIN_ASSIGNMENT_PENDING', 'CAPTAIN_ASSIGNED', 'PICKUP_STARTED', 'PICKUP_ARRIVED'].includes(ret.status);
                        const isCompletedReturn = ['REFUNDED', 'COMPLETED'].includes(ret.status);
                        const isRejectedReturn = ['REJECTED', 'VERIFICATION_FAILED'].includes(ret.status);

                        return (
                          <div key={ret._id || rIdx} className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">
                                  Return #{ret.returnId}
                                </span>
                                <h4 className="text-xs md:text-sm font-bold text-slate-900 m-0 line-clamp-1">
                                  {ret.productName} <span className="text-slate-400 font-semibold">× {ret.quantity}</span>
                                </h4>
                              </div>

                              <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border shrink-0 ${
                                isCompletedReturn ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                isRejectedReturn ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                'bg-amber-50 text-amber-700 border-amber-200'
                              }`}>
                                {ret.status.replace(/_/g, ' ')}
                              </span>
                            </div>

                            {/* Return Pickup OTP Card (Active when waiting for Captain pickup) */}
                            {isPendingPickup && ret.returnOtp && (
                              <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-3 rounded-xl shadow-xs flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <KeyRound size={18} className="text-white shrink-0" />
                                  <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider block text-orange-100">
                                      Return Pickup OTP
                                    </span>
                                    <span className="text-base md:text-lg font-black tracking-widest text-white">
                                      {ret.returnOtp}
                                    </span>
                                  </div>
                                </div>
                                <span className="text-[10px] font-medium text-orange-100 max-w-[130px] text-right">
                                  Share with Captain during item collection
                                </span>
                              </div>
                            )}

                            {/* Return Details breakdown */}
                            <div className="text-[11px] text-slate-600 space-y-1 bg-white p-2.5 rounded-xl border border-slate-100">
                              <div className="flex justify-between">
                                <span className="text-slate-400">Reason:</span>
                                <span className="font-semibold text-slate-800 text-right">{ret.reason}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Refund Method:</span>
                                <span className="font-bold text-slate-800">{ret.refundMethod === 'WALLET' ? 'Wallet Credit' : 'Original Payment Source'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Estimated Refund:</span>
                                <span className="font-black text-[#ea580c]">₹{Number(ret.refundAmount || 0).toFixed(2)}</span>
                              </div>
                              {ret.captain?.name && (
                                <div className="flex justify-between pt-1 border-t border-slate-100">
                                  <span className="text-slate-400">Pickup Captain:</span>
                                  <span className="font-bold text-emerald-700">{ret.captain.name} ({ret.captain.vehicleType || 'Partner'})</span>
                                </div>
                              )}
                            </div>

                            {/* Return Process Narrative Note */}
                            <p className="text-[10px] text-slate-500 m-0 italic">
                              {ret.status === 'REQUESTED' && '⏳ Request under review. Once approved, a Captain will be assigned for doorstep pickup.'}
                              {['APPROVED', 'CAPTAIN_ASSIGNMENT_PENDING'].includes(ret.status) && '✓ Return approved. Finding nearest Captain for doorstep collection.'}
                              {['CAPTAIN_ASSIGNED', 'PICKUP_STARTED', 'PICKUP_ARRIVED'].includes(ret.status) && '🚚 Captain is on the way for item collection. Please have the item and OTP ready.'}
                              {['PICKED_UP', 'IN_TRANSIT_TO_SELLER'].includes(ret.status) && '📦 Item collected by Captain. In transit to seller warehouse for quality verification.'}
                              {['RECEIVED_BY_SELLER', 'UNDER_VERIFICATION'].includes(ret.status) && '🔍 Item received at seller facility. Quality and packaging inspection in progress.'}
                              {ret.status === 'VERIFICATION_PASSED' && '✓ Quality check passed! Initiating refund transaction.'}
                              {isCompletedReturn && '🎉 Return completed! Refund amount has been credited.'}
                              {isRejectedReturn && '✕ Return could not be approved or verification failed.'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Initial Return Call-to-Action if no items returned yet */
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <RotateCcw size={17} className="text-[#ea580c]" />
                        <h3 className="text-[13px] md:text-sm font-extrabold text-slate-900 m-0">Return / Replacement</h3>
                      </div>
                      <p className="text-[11px] text-slate-500 m-0">
                        Items eligible for return within <span className="font-bold text-slate-700">7 days of delivery</span>. Easy door-step pickup by Captain.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenReturnModal()}
                      className="px-4 py-2.5 bg-orange-50 hover:bg-orange-100 text-[#ea580c] font-bold text-xs rounded-xl border border-orange-200 cursor-pointer transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-2xs whitespace-nowrap"
                    >
                      <RotateCcw size={14} />
                      Return Product
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Live Delivery Map (captain position + route polyline, only while Out for Delivery) */}
            {isOutForDelivery && captainPosition && (
              <div className="bg-white rounded-2xl p-3 md:p-4 border border-slate-100 shadow-xs flex flex-col gap-2">
                <div className="flex items-center gap-2 px-1">
                  <Truck size={16} className="text-[#ea580c]" />
                  <h3 className="text-[12px] md:text-sm font-extrabold text-slate-900 uppercase tracking-wider m-0">Live Delivery Tracking</h3>
                </div>
                <LiveDeliveryMap captainPosition={captainPosition} destinationAddress={destinationAddress} />
              </div>
            )}

            {isOutForDelivery && deliveryOtp && !order?.deliveryOtpVerified && (
              <div className="bg-amber-50 rounded-2xl p-4 md:p-5 border border-amber-200 shadow-xs flex items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] md:text-xs font-black text-amber-800 uppercase tracking-wider block">Delivery OTP</span>
                  <p className="text-[12px] text-amber-900 m-0 mt-1">Share this code with the delivery captain at your door. They will take a photo after it is verified.</p>
                </div>
                <span className="font-mono text-2xl font-black tracking-widest text-[#ea580c] bg-white px-3 py-2 rounded-xl border border-amber-300 shrink-0">{deliveryOtp}</span>
              </div>
            )}

            {/* Captain Information (ONLY shown when order is NOT yet delivered) */}
            {sellerHasAccepted && captainHasAccepted && order?.captainId && !isDelivered && (
              <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-100 shadow-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-11 h-11 md:w-14 md:h-14 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    <Truck size={24} />
                  </div>
                  <div>
                    <span className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-wider block">Delivery Captain</span>
                    <p className="text-xs md:text-base font-bold text-slate-900 m-0">{order.captainId.name || 'Assigned Partner'}</p>
                    <p className="text-[11px] md:text-xs text-emerald-700 font-semibold m-0">{order.captainId.vehicleType || 'Two Wheeler'} • {captainStatus === 'In Transit' || captainStatus === 'Picked Up' ? 'On the way' : captainStatus === 'At Pickup' || captainStatus === 'Reached Store' ? 'At the store' : 'Delivery accepted'}</p>
                  </div>
                </div>
                {order.captainId.phone && (
                  <a
                    href={`tel:${order.captainId.phone}`}
                    className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 flex items-center justify-center transition-colors shadow-2xs no-underline"
                  >
                    <Phone size={18} />
                  </a>
                )}
              </div>
            )}

            {/* Delivery Address */}
            <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-100 shadow-xs flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                <MapPin size={18} className="text-[#ea580c]" />
                <h3 className="text-[13px] md:text-sm font-extrabold text-slate-900 uppercase tracking-wider m-0">Delivery Address</h3>
              </div>
              <div className="pl-6 flex flex-col gap-1">
                <span className="text-[13px] md:text-sm font-bold text-slate-900">
                  {shippingAddress.fullName || shippingAddress.name || 'Customer'}
                </span>
                <p className="text-[12px] md:text-sm text-slate-600 leading-relaxed m-0">
                  {shippingAddress.addressLine1 || shippingAddress.address}
                  {shippingAddress.addressLine2 && `, ${shippingAddress.addressLine2}`}
                  {shippingAddress.landmark && ` (Near ${shippingAddress.landmark})`}
                  <br />
                  {shippingAddress.city}, {shippingAddress.state} - {shippingAddress.pincode || shippingAddress.zip}
                </p>
                <p className="text-[11px] md:text-xs font-semibold text-slate-500 m-0 mt-1">
                  📞 {shippingAddress.phone}
                </p>
              </div>
            </div>

          </div>

          {/* Right Column (Col 5 on Desktop): Ordered Items List & Payment Summary */}
          <div className="md:col-span-5 flex flex-col gap-4">
            
            {/* Real Order Items List */}
            <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-100 shadow-xs flex flex-col gap-3">
              <h3 className="text-[13px] md:text-sm font-extrabold text-slate-900 uppercase tracking-wider m-0">Ordered Items ({items.length})</h3>
              
              <div className="flex flex-col divide-y divide-slate-100">
                {items.map((item, idx) => {
                  const itemImg = item.image || item.product?.mainImage || grainsImg;
                  const itemName = item.name || item.product?.name || 'Product';
                  const itemPrice = Number(item.price || item.product?.salePrice || 0);
                  const qty = item.quantity || 1;
                  const itemSubtotal = itemPrice * qty;
                  const prodId = item.product?._id || item.product || item.productId || item.id;
                  const itemReview = prodId ? orderReviews[prodId] : null;

                  // Find matching return for this item
                  const itemReturn = orderReturns.find(
                    (r) => String(r.orderItemId) === String(item._id) || String(r.product) === String(prodId)
                  );

                  return (
                    <div key={idx} className="py-3 flex flex-col gap-2 first:pt-0 last:pb-0">
                      <div className="flex gap-3 items-center">
                        <div className="w-[54px] h-[54px] rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                          <img 
                            src={getImageUrl(itemImg, itemName)} 
                            alt={itemName} 
                            className="w-[85%] h-[85%] object-contain" 
                            onError={(e) => handleImageError(e, itemName)}
                          />
                        </div>
                        <div className="flex-1 flex flex-col gap-0.5">
                          <h4 className="text-[13px] md:text-sm font-bold text-slate-900 m-0 line-clamp-1">{itemName}</h4>
                          {variantLabel(item) && (
                            <span className="text-[11px] font-semibold text-[#ea580c]">{variantLabel(item)}</span>
                          )}
                          <span className="text-[12px] font-semibold text-slate-500">
                            ₹{itemPrice.toFixed(2)} × {qty}
                          </span>
                        </div>
                        <span className="text-[14px] md:text-base font-extrabold text-slate-900 shrink-0">
                          ₹{itemSubtotal.toFixed(2)}
                        </span>
                      </div>

                      {/* Delivered Item Actions: Rating & Item-Level Return */}
                      {isDelivered && (
                        <div className="pt-2 border-t border-dashed border-slate-100 flex items-center justify-between flex-wrap gap-2">
                          
                          {/* Rating or Review Status */}
                          <div className="flex items-center gap-1.5">
                            {itemReview ? (
                              <div className="flex items-center gap-1 text-[10px] font-extrabold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                <Star size={10} className="fill-amber-500 text-amber-500" /> Rated {itemReview.rating}/5
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenRateModal(item, itemReview)}
                                className="px-2 py-1 text-[10px] font-bold rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 text-[#ea580c] cursor-pointer flex items-center gap-1 transition-all"
                              >
                                <Star size={10} className="fill-[#ea580c] text-[#ea580c]" /> Rate Product
                              </button>
                            )}
                          </div>

                          {/* Item-Level Return Status or Button */}
                          {itemReturn ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 uppercase">
                                Return {itemReturn.status.replace(/_/g, ' ')}
                              </span>
                              {itemReturn.returnOtp && ['REQUESTED', 'APPROVED', 'CAPTAIN_ASSIGNED', 'PICKUP_STARTED', 'PICKUP_ARRIVED'].includes(itemReturn.status) && (
                                <span className="text-[10px] font-black text-white bg-slate-900 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                                  <KeyRound size={9} /> OTP {itemReturn.returnOtp}
                                </span>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenReturnModal(item)}
                              className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer flex items-center gap-1 transition-all shadow-2xs"
                            >
                              <RotateCcw size={11} className="text-slate-500" />
                              Return Item
                            </button>
                          )}

                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payment & Price Breakdown */}
            <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-100 shadow-xs flex flex-col gap-3">
              <h3 className="text-[13px] md:text-sm font-extrabold text-slate-900 uppercase tracking-wider m-0">Payment Summary</h3>

              <div className="flex flex-col gap-2.5 pt-1">
                <div className="flex justify-between items-center text-[12px] md:text-sm">
                  <span className="font-semibold text-slate-500">Payment Mode</span>
                  <span className="font-bold text-slate-900 uppercase">{paymentMethod}</span>
                </div>
                <div className="flex justify-between items-center text-[12px] md:text-sm">
                  <span className="font-semibold text-slate-500">Payment Status</span>
                  <span className={`font-bold ${paymentStatus === 'Paid' ? 'text-green-600' : 'text-orange-600'}`}>
                    {paymentStatus}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[12px] md:text-sm">
                  <span className="font-semibold text-slate-500">Items Total</span>
                  <span className="font-bold text-slate-900">₹{itemsTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-[12px] md:text-sm">
                  <span className="font-semibold text-slate-500">Delivery Charge</span>
                  {shippingFee === 0 ? (
                    <span className="font-bold text-emerald-600">FREE</span>
                  ) : (
                    <span className="font-bold text-slate-900">₹{shippingFee.toFixed(2)}</span>
                  )}
                </div>
                {codCharge > 0 && (
                  <div className="flex justify-between items-center text-[12px] md:text-sm">
                    <span className="font-semibold text-slate-500">COD Handling Fee</span>
                    <span className="font-bold text-orange-900">+ ₹{codCharge.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-3 mt-1 border-t border-dashed border-slate-200">
                  <span className="text-[14px] md:text-base font-extrabold text-slate-900">Grand Total</span>
                  <span className="text-[16px] md:text-xl font-extrabold text-slate-900">₹{grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* Product Rating Modal */}
      <ProductRatingModal
        isOpen={isRatingModalOpen}
        onClose={() => {
          setIsRatingModalOpen(false);
          setSelectedProductToRate(null);
          setSelectedReviewToEdit(null);
        }}
        product={selectedProductToRate}
        orderId={order?.orderId || order?._id || order?.id}
        existingReview={selectedReviewToEdit}
        onSuccess={handleReviewSuccess}
      />

      {/* Delivery / captain rating after grocery delivery */}
      <RatingModal
        isOpen={isDeliveryRatingOpen}
        onClose={() => setIsDeliveryRatingOpen(false)}
        ride={{
          orderId: order?.orderId || order?._id,
          _id: order?._id,
          captainId: order?.captainId,
          captainName: order?.captainId?.name,
          totalFare: order?.grandTotal || order?.total || 0,
        }}
        role="user"
        onSuccess={(res) => {
          setHasRatedDelivery(true);
          setDeliveryUserRating(res?.rating?.rating || 5);
          setIsDeliveryRatingOpen(false);
        }}
      />

      {/* Item-Level Return Modal */}
      {isReturnModalOpen && selectedItemToReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-100 text-[#ea580c] flex items-center justify-center">
                  <RotateCcw size={18} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 m-0">Item Return & Refund</h3>
                  <span className="text-[11px] font-bold text-slate-400">Order #{orderId}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!submittingReturn) setIsReturnModalOpen(false);
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center cursor-pointer border-none transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleReturnSubmit} className="p-6 overflow-y-auto flex flex-col gap-4">
              
              {returnErrorToast && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
                  <AlertTriangle size={16} className="shrink-0 text-rose-500" />
                  <span>{returnErrorToast}</span>
                </div>
              )}

              {/* Item Selector Dropdown if multiple items */}
              {items.length > 1 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                    Select Item to Return
                  </label>
                  <select
                    value={selectedItemToReturn._id || selectedItemToReturn.product}
                    onChange={(e) => {
                      const found = items.find((it) => (it._id || it.product) === e.target.value);
                      if (found) {
                        setSelectedItemToReturn(found);
                        setReturnQuantity(1);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-[#ea580c] transition-colors"
                  >
                    {items.map((it, idx) => (
                      <option key={idx} value={it._id || it.product}>
                        {it.name || it.product?.name} (Purchased: {it.quantity || 1})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Selected Item Summary Card */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                  <img
                    src={getImageUrl(selectedItemToReturn.image || selectedItemToReturn.product?.mainImage, selectedItemToReturn.name || 'Item')}
                    alt={selectedItemToReturn.name}
                    className="w-[85%] h-[85%] object-contain"
                    onError={(e) => handleImageError(e, selectedItemToReturn.name || 'Item')}
                  />
                </div>
                <div className="flex-1">
                  <h4 className="text-xs md:text-sm font-bold text-slate-900 m-0 line-clamp-1">
                    {selectedItemToReturn.name || selectedItemToReturn.product?.name || 'Item'}
                  </h4>
                  <span className="text-xs font-semibold text-slate-500">
                    Price: ₹{Number(selectedItemToReturn.price || selectedItemToReturn.product?.salePrice || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Quantity Selector */}
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-xs font-bold text-slate-700">Return Quantity:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={returnQuantity <= 1}
                    onClick={() => setReturnQuantity((q) => Math.max(1, q - 1))}
                    className="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-black text-sm flex items-center justify-center disabled:opacity-40 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="text-sm font-black text-slate-900 w-6 text-center">{returnQuantity}</span>
                  <button
                    type="button"
                    disabled={returnQuantity >= (selectedItemToReturn.quantity || 1)}
                    onClick={() => setReturnQuantity((q) => Math.min(selectedItemToReturn.quantity || 1, q + 1))}
                    className="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-black text-sm flex items-center justify-center disabled:opacity-40 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Reason Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  Reason for Return <span className="text-rose-500">*</span>
                </label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-[#ea580c] transition-colors"
                >
                  {RETURN_REASONS.map((reason, idx) => (
                    <option key={idx} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>

              {/* Remarks / Comments */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  Additional Details / Remarks (Optional)
                </label>
                <textarea
                  value={returnRemarks}
                  onChange={(e) => setReturnRemarks(e.target.value)}
                  placeholder="Provide additional details about the defect, wrong item, or reason for return..."
                  rows={2}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs md:text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-[#ea580c] transition-colors resize-none"
                />
              </div>

              {/* Estimated Refund Summary */}
              <div className="p-3 bg-orange-50/70 border border-orange-200/80 rounded-xl flex items-center justify-between text-xs">
                <div>
                  <span className="font-extrabold text-slate-800 block">Estimated Refund</span>
                  <span className="text-[10px] text-slate-500">Credited to wallet / payment source upon verification</span>
                </div>
                <span className="text-base font-black text-[#ea580c]">
                  ₹{(Number(selectedItemToReturn.price || 0) * returnQuantity).toFixed(2)}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={submittingReturn}
                  onClick={() => setIsReturnModalOpen(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border-none cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReturn}
                  className="flex-1 py-2.5 px-4 bg-[#ea580c] hover:bg-[#c2410c] disabled:opacity-60 text-white text-xs font-extrabold rounded-xl border-none cursor-pointer transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {submittingReturn ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw size={15} />
                      <span>Submit Return</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default TrackOrder;
