import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, CheckCircle2, XCircle, AlertCircle, Phone, MapPin, 
  Box, CreditCard, User, Volume2, VolumeX, ArrowRight, Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { orderService } from '../../../../services/authService';
import { getImageUrl, handleImageError } from '../../../../utils/imageUtils';
import { variantLabel } from '../../../../utils/variantLabel';

const SellerOrderNotifier = () => {
  const navigate = useNavigate();
  
  const [activeNewOrder, setActiveNewOrder] = useState(null);
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState('Unable to fulfill order');
  const [customReasonText, setCustomReasonText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [isMuted, setIsMuted] = useState(false);

  const knownOrderIdsRef = useRef(new Set());
  const notifiedOrderIdsRef = useRef(new Set());
  const baselineReadyRef = useRef(false);
  const activeOrderIdRef = useRef(null);
  const pendingQueueRef = useRef([]);
  const isMutedRef = useRef(false);
  const audioRef = useRef(null);
  const ringtoneIntervalRef = useRef(null);
  const isPollingRef = useRef(false);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  // Play Sound / Ringtone
  const playRingtone = () => {
    if (isMutedRef.current) return;

    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/SellerOrder.mpeg');
        audioRef.current.loop = true;
      }
      audioRef.current.currentTime = 0;
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((e) => {
          // Autoplay was prevented or fallback to Web Audio API
          triggerWebAudioChime();
        });
      }
    } catch (err) {
      triggerWebAudioChime();
    }
  };

  const triggerWebAudioChime = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 tone
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch (e) {}
  };

  const stopRingtone = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
  };

  const presentNextNewOrder = () => {
    if (activeOrderIdRef.current) return;
    const next = pendingQueueRef.current.shift();
    if (!next) return;
    const id = String(next._id);
    notifiedOrderIdsRef.current.add(id);
    activeOrderIdRef.current = id;
    console.info('[SellerOrderNotifier] opening incoming modal for new order', next.orderId);
    setActiveNewOrder(next);
    playRingtone();
  };

  const closeIncomingModal = () => {
    activeOrderIdRef.current = null;
    setActiveNewOrder(null);
    stopRingtone();
    presentNextNewOrder();
  };

  // Polling loop for active seller orders across ALL pages.
  // The first response is the baseline. Only an order id that appears after that,
  // and is still status NEW, can open the incoming modal.
  const pollSellerOrders = async () => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;
    try {
      const res = await orderService.getSellerNotifications({ limit: 15 });
      if (res && res.notifications && Array.isArray(res.notifications)) {
        const notifications = res.notifications;
        window.dispatchEvent(new CustomEvent('seller-order-update', { detail: notifications }));

        if (!baselineReadyRef.current) {
          notifications.forEach((n) => knownOrderIdsRef.current.add(String(n._id)));
          baselineReadyRef.current = true;
          console.info('[SellerOrderNotifier] baseline', knownOrderIdsRef.current.size, 'existing orders; no incoming modal');
          return;
        }

        for (const n of notifications) {
          const id = String(n._id);
          if (knownOrderIdsRef.current.has(id)) continue;
          knownOrderIdsRef.current.add(id);
          if (n.status === 'NEW' && !notifiedOrderIdsRef.current.has(id)) {
            pendingQueueRef.current.push(n);
          }
        }

        if (activeOrderIdRef.current) {
          const current = notifications.find((n) => String(n._id) === activeOrderIdRef.current);
          if (current && current.status !== 'NEW') {
            console.info('[SellerOrderNotifier] order', current.orderId, 'is now', current.status, '; closing incoming modal');
            activeOrderIdRef.current = null;
            setActiveNewOrder(null);
            stopRingtone();
          }
        }

        presentNextNewOrder();
      }
    } catch (err) {
      // Ignore network silent errors during background poll
    } finally {
      isPollingRef.current = false;
    }
  };

  useEffect(() => {
    const markHandled = (id) => {
      if (!id) return;
      const key = String(id);
      knownOrderIdsRef.current.add(key);
      notifiedOrderIdsRef.current.add(key);
      pendingQueueRef.current = pendingQueueRef.current.filter((n) => String(n._id) !== key);
      if (activeOrderIdRef.current === key) {
        activeOrderIdRef.current = null;
        setActiveNewOrder(null);
        stopRingtone();
        presentNextNewOrder();
      }
    };
    const onHandled = (event) => markHandled(event.detail?.id);

    pollSellerOrders();
    const interval = setInterval(pollSellerOrders, 10000);
    window.addEventListener('seller-order-handled', onHandled);
    return () => {
      clearInterval(interval);
      window.removeEventListener('seller-order-handled', onHandled);
      stopRingtone();
    };
  }, []);

  const handleDismissPopup = () => {
    if (activeNewOrder) {
      notifiedOrderIdsRef.current.add(String(activeNewOrder._id));
      orderService.markNotificationViewed(activeNewOrder._id).catch(() => {});
    }
    closeIncomingModal();
  };

  const handleAcceptOrder = async () => {
    if (!activeNewOrder) return;
    setActionLoading(true);
    knownOrderIdsRef.current.add(String(activeNewOrder._id));
    notifiedOrderIdsRef.current.add(String(activeNewOrder._id));
    try {
      await orderService.acceptSellerOrder(activeNewOrder._id);
      showToast(`Order #${activeNewOrder.orderId} Accepted Successfully! 🎉`);
      closeIncomingModal();
      pollSellerOrders();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to accept order.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectOrderSubmit = async (e) => {
    e.preventDefault();
    if (!activeNewOrder) return;
    const finalReason = selectedReason === 'Other' ? customReasonText.trim() : selectedReason;
    if (!finalReason) {
      alert('Please specify a rejection reason.');
      return;
    }

    setActionLoading(true);
    knownOrderIdsRef.current.add(String(activeNewOrder._id));
    notifiedOrderIdsRef.current.add(String(activeNewOrder._id));
    try {
      await orderService.rejectSellerOrder(activeNewOrder._id, finalReason);
      showToast(`Order #${activeNewOrder.orderId} Rejected.`);
      setRejectionModalOpen(false);
      setCustomReasonText('');
      closeIncomingModal();
      pollSellerOrders();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to reject order.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-[100] px-4 py-3 bg-emerald-600 text-white rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold animate-bounce">
          <CheckCircle2 size={18} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* INCOMING NEW ORDER GLOBAL POPUP MODAL */}
      {/* ------------------------------------------------------------- */}
      {activeNewOrder && !rejectionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in zoom-in-95 duration-200 relative ring-4 ring-[#ff7526]/30"
          >
            {/* Modal Top Header - Vibrant Orange Banner with Sound Indicator */}
            <div className="bg-[#ff7526] text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-white shrink-0 animate-bounce">
                  <Bell size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase bg-white text-[#ff7526] px-2 py-0.5 rounded-md tracking-wider">
                      NEW ORDER ARRIVED
                    </span>
                    <span className="text-xs text-white/90 font-mono font-bold">
                      #{activeNewOrder.orderId}
                    </span>
                  </div>
                  <h2 className="text-base sm:text-lg font-extrabold text-white m-0 mt-0.5">
                    Incoming Customer Order
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (isMutedRef.current) {
                      isMutedRef.current = false;
                      setIsMuted(false);
                      playRingtone();
                    } else {
                      isMutedRef.current = true;
                      setIsMuted(true);
                      stopRingtone();
                    }
                  }}
                  title={isMuted ? 'Unmute Ringtone' : 'Mute Ringtone'}
                  className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 text-white border-none cursor-pointer flex items-center justify-center transition-colors"
                >
                  {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} className="animate-pulse" />}
                </button>

                <button 
                  type="button"
                  onClick={handleDismissPopup} 
                  title="Dismiss / View Later"
                  className="w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center border-none cursor-pointer text-sm font-bold transition-all"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-5 space-y-3.5 max-h-[68vh] overflow-y-auto text-slate-800 font-sans">
              
              {/* Customer Details Card */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-1">
                <div className="flex items-center gap-1.5 border-b border-slate-200/60 pb-1">
                  <User size={13} className="text-[#ff7526]" />
                  <span className="text-[10px] font-extrabold uppercase text-slate-700 tracking-wider">Customer Details</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <p className="font-bold text-slate-900 text-xs sm:text-sm m-0">
                      {activeNewOrder.customerDetails?.name || 'Customer'}
                    </p>
                    {activeNewOrder.customerDetails?.email && (
                      <p className="text-slate-500 m-0 text-[10px] font-normal">{activeNewOrder.customerDetails.email}</p>
                    )}
                  </div>
                  {activeNewOrder.customerDetails?.phone && (
                    <a 
                      href={`tel:${activeNewOrder.customerDetails?.phone}`} 
                      className="text-blue-600 font-bold underline flex items-center gap-1 text-[11px] bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100"
                    >
                      <Phone size={11} className="text-blue-500" />
                      {activeNewOrder.customerDetails?.phone}
                    </a>
                  )}
                </div>
              </div>

              {/* Delivery Address Details */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-1">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-1">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={13} className="text-[#ff7526]" />
                    <span className="text-[10px] font-extrabold uppercase text-slate-700 tracking-wider">Delivery Location</span>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-600">
                    {activeNewOrder.deliveryAddress?.addressType || 'Home'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-700 font-medium m-0 leading-tight">
                  {activeNewOrder.deliveryAddress?.addressLine1}
                  {activeNewOrder.deliveryAddress?.landmark ? `, ${activeNewOrder.deliveryAddress.landmark}` : ''}
                  , {activeNewOrder.deliveryAddress?.city} - <span className="font-bold text-[#ff7526]">{activeNewOrder.deliveryAddress?.pincode}</span>
                </p>
              </div>

              {/* Ordered Items List */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                  <div className="flex items-center gap-1.5">
                    <Box size={13} className="text-[#ff7526]" />
                    <h3 className="text-[11px] font-extrabold text-slate-900 uppercase tracking-wider m-0">
                      Ordered Items ({activeNewOrder.items?.length || 0})
                    </h3>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white max-h-40 overflow-y-auto">
                  {activeNewOrder.items && activeNewOrder.items.map((item, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <img 
                          src={getImageUrl(item.image, item.name)} 
                          alt={item.name} 
                          className="w-10 h-10 rounded-lg object-cover border border-slate-200 bg-slate-100 shrink-0"
                          onError={(e) => handleImageError(e, item.name)}
                        />
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-bold text-slate-900 m-0 leading-tight">{item.name}</h4>
                          {variantLabel(item) && (
                            <p className="text-[10px] font-semibold text-[#ff7526] m-0">{variantLabel(item)}</p>
                          )}
                          <p className="text-[10px] text-slate-500 m-0">
                            ₹{item.price} &times; <span className="font-bold text-slate-800">{item.quantity} Qty</span>
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-extrabold text-slate-900">₹{Number(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Details & Total Amount */}
              <div className="bg-orange-50/70 p-3 rounded-2xl border border-orange-200/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white border border-orange-200 flex items-center justify-center text-[#ff7526] shrink-0">
                    <CreditCard size={15} />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase block">Payment Method</span>
                    <p className="text-xs font-bold text-slate-800 m-0">
                      {activeNewOrder.paymentMethod} (<span className="text-amber-700">{activeNewOrder.paymentStatus}</span>)
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[9px] text-slate-500 font-bold uppercase block">Total Amount</span>
                  <span className="text-lg font-black text-[#ff7526]">₹{Number(activeNewOrder.totalAmount || 0).toFixed(2)}</span>
                </div>
              </div>

            </div>

            {/* Modal Bottom Action Buttons */}
            <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  notifiedOrderIdsRef.current.add(String(activeNewOrder._id));
                  navigate('/seller/orders');
                  closeIncomingModal();
                }}
                className="px-3 py-2 text-slate-600 hover:text-slate-900 font-bold text-xs bg-transparent border-none cursor-pointer flex items-center gap-1"
              >
                <span>View in Orders</span>
                <ArrowRight size={13} />
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setRejectionModalOpen(true)}
                  className="px-3.5 py-2 bg-white hover:bg-red-50 text-red-600 font-bold text-xs rounded-xl border border-red-200 cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                >
                  <XCircle size={14} /> Reject
                </button>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleAcceptOrder}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl border-none cursor-pointer shadow-md transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle2 size={15} /> {actionLoading ? 'Accepting...' : 'Accept Order'}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* REJECTION REASON CONFIRMATION MODAL */}
      {/* ------------------------------------------------------------- */}
      {rejectionModalOpen && activeNewOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5 m-0">
                <AlertCircle size={16} className="text-red-500" /> Reject Order #{activeNewOrder.orderId}
              </h3>
              <button 
                type="button"
                onClick={() => setRejectionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 border-none bg-transparent font-bold text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 m-0">
              Select reason for rejecting this order:
            </p>

            <form onSubmit={handleRejectOrderSubmit} className="space-y-3">
              <div className="space-y-1.5">
                {[
                  'Product unavailable',
                  'Out of stock',
                  'Unable to fulfill order',
                  'Store busy / Closed',
                  'Other'
                ].map((reason) => (
                  <label 
                    key={reason}
                    className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer transition-all text-xs font-semibold ${
                      selectedReason === reason 
                        ? 'bg-red-50 border-red-300 text-red-900' 
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="rejectionReason" 
                      value={reason}
                      checked={selectedReason === reason}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      className="accent-red-600 cursor-pointer"
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>

              {selectedReason === 'Other' && (
                <div>
                  <textarea 
                    rows={2}
                    required
                    placeholder="Enter reason..."
                    value={customReasonText}
                    onChange={(e) => setCustomReasonText(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:border-red-500"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setRejectionModalOpen(false)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-sm"
                >
                  {actionLoading ? 'Rejecting...' : 'Confirm Reject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default SellerOrderNotifier;
