import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  IndianRupee, 
  Package, 
  CreditCard, 
  Loader2, 
  AlertCircle, 
  MapPin, 
  Truck,
  Banknote,
  Smartphone,
  Wallet,
  Check,
  X,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { useTransport } from '../../context/TransportContext';
import { transportService } from '../../../../services/transportService';
import { loadRazorpaySdk } from '../../../../utils/razorpay';
import { MapService } from '../../../../services/MapService';

const ROAD_DISTANCE_FACTOR = 1.25;

const resolveCoords = (loc) => {
  if (!loc) return null;
  const lat = loc.lat ?? loc.latitude;
  const lng = loc.lng ?? loc.longitude;
  if (lat == null || lng == null) return null;
  return { lat: Number(lat), lng: Number(lng) };
};

/** Single-leg: prefer Google driving km; else crow-flies × 1.25 (same as backend). */
const resolveSegmentDrivingKm = async (from, to) => {
  const origin = resolveCoords(from);
  const dest = resolveCoords(to);
  if (!origin || !dest) return null;
  try {
    const matrix = await MapService.calculateDistanceAndDuration(origin, dest);
    if (matrix?.distanceKm > 0) return Number(matrix.distanceKm);
  } catch (_) {}
  const R = 6371;
  const dLatRad = ((dest.lat - origin.lat) * Math.PI) / 180;
  const dLonRad = ((dest.lng - origin.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLatRad / 2) * Math.sin(dLatRad / 2) +
    Math.cos((origin.lat * Math.PI) / 180) * Math.cos((dest.lat * Math.PI) / 180) *
    Math.sin(dLonRad / 2) * Math.sin(dLonRad / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(1, Math.round(R * c * ROAD_DISTANCE_FACTOR * 100) / 100);
};

/** Full trip: pickup → stops → drop (sums each leg). */
const resolveDrivingDistanceKm = async (pickup, drop, stops = []) => {
  const points = [pickup, ...(Array.isArray(stops) ? stops.filter(Boolean) : []), drop].filter(Boolean);
  if (points.length < 2) return resolveSegmentDrivingKm(pickup, drop);
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const leg = await resolveSegmentDrivingKm(points[i], points[i + 1]);
    if (leg == null) return null;
    total += leg;
  }
  return Math.max(1, Math.round(total * 100) / 100);
};

const PAYMENT_METHODS = [
  {
    id: 'CASH',
    name: 'Cash on Delivery',
    tagline: 'Pay directly to driver upon pickup/delivery',
    icon: Banknote,
    badge: 'Default',
    badgeColor: 'bg-emerald-100 text-emerald-800',
    iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  },
  {
    id: 'UPI',
    name: 'UPI / QR Code',
    tagline: 'Google Pay, PhonePe, Paytm, BHIM & all UPI apps',
    icon: Smartphone,
    badge: 'Instant',
    badgeColor: 'bg-purple-100 text-purple-800',
    iconBg: 'bg-purple-50 text-purple-600 border-purple-100',
  },
  {
    id: 'CARD',
    name: 'Credit / Debit Card',
    tagline: 'Visa, MasterCard, RuPay, Maestro & International',
    icon: CreditCard,
    badge: null,
    badgeColor: '',
    iconBg: 'bg-blue-50 text-blue-600 border-blue-100',
  },
  {
    id: 'WALLET',
    name: 'Sathi Seller Wallet',
    tagline: 'Instant 1-click payment from your account balance',
    icon: Wallet,
    badge: null,
    badgeColor: '',
    iconBg: 'bg-amber-50 text-amber-600 border-amber-100',
  },
];

const FareSummary = () => {
  const navigate = useNavigate();
  const { activeBooking, clearActiveBooking } = useTransport();

  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  // Helper to extract clean display/payload address
  const getCleanAddress = (loc) => {
    if (!loc) return '';
    if (typeof loc === 'string') return loc;
    return loc.formattedAddress || loc.address || loc.name || '';
  };

  // Instant local fare calculation (0ms latency optimistic UI)
  const calculateLocalEstimate = useCallback(() => {
    if (!activeBooking.vehicle) return null;
    const v = activeBooking.vehicle;
    const pLat = activeBooking.pickup?.lat ?? activeBooking.pickup?.latitude;
    const pLng = activeBooking.pickup?.lng ?? activeBooking.pickup?.longitude;
    const dLat = activeBooking.drop?.lat ?? activeBooking.drop?.latitude;
    const dLng = activeBooking.drop?.lng ?? activeBooking.drop?.longitude;

    let dist = 5.0;
    if (pLat != null && pLng != null && dLat != null && dLng != null) {
      const R = 6371;
      const dLatRad = ((dLat - pLat) * Math.PI) / 180;
      const dLonRad = ((dLng - pLng) * Math.PI) / 180;
      const a =
        Math.sin(dLatRad / 2) * Math.sin(dLatRad / 2) +
        Math.cos((pLat * Math.PI) / 180) * Math.cos((dLat * Math.PI) / 180) *
        Math.sin(dLonRad / 2) * Math.sin(dLonRad / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      dist = Math.max(1, Math.round(R * c * ROAD_DISTANCE_FACTOR * 100) / 100);
    }

    const baseFare = v.baseFare || 30;
    const perKmFare = v.perKmFare || 10;
    const minimumFare = v.minimumFare || 50;
    const platformFee = v.platformFee || 10;
    const distanceCharge = Math.round(dist * perKmFare * 100) / 100;
    const rawFare = baseFare + distanceCharge;
    const cappedFare = Math.max(rawFare, minimumFare);
    const totalFare = Math.round((cappedFare + platformFee) * 100) / 100;

    return {
      distanceKm: dist,
      estimatedDurationMin: Math.max(10, Math.round(dist * 2.5)),
      fareBreakdown: {
        baseFare,
        distanceCharge,
        platformFee,
        discount: 0,
        totalFare,
      },
    };
  }, [activeBooking.vehicle, activeBooking.pickup, activeBooking.drop]);

  const [fareEstimate, setFareEstimate] = useState(() => calculateLocalEstimate());
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState(null);

  // Sync with backend fare calculation seamlessly in the background
  const vehicleId = activeBooking.vehicle?._id;
  const pickupRaw = activeBooking.pickup;
  const dropRaw = activeBooking.drop;

  useEffect(() => {
    if (!vehicleId || !pickupRaw || !dropRaw) return;

    let isMounted = true;
    const fetchEstimate = async () => {
      try {
        setEstimateError(null);

        const pickupAddr = getCleanAddress(pickupRaw) || 'Pickup Location';
        const dropAddr = getCleanAddress(dropRaw) || 'Drop Location';
        const drivingKm = await resolveDrivingDistanceKm(
          pickupRaw,
          dropRaw,
          (activeBooking.stops || []).filter(Boolean)
        );

        const payload = {
          pickupLocation: {
            address: pickupAddr,
            lat: pickupRaw?.lat ?? pickupRaw?.latitude ?? null,
            lng: pickupRaw?.lng ?? pickupRaw?.longitude ?? null,
          },
          dropLocation: {
            address: dropAddr,
            lat: dropRaw?.lat ?? dropRaw?.latitude ?? null,
            lng: dropRaw?.lng ?? dropRaw?.longitude ?? null,
          },
          vehicleTypeId: vehicleId,
          distanceKm: drivingKm || undefined,
          stops: (activeBooking.stops || []).filter(Boolean),
        };

        const data = await transportService.getFareEstimate(payload);
        if (isMounted && data && data.estimate) {
          setFareEstimate(data.estimate);
        }
      } catch (err) {
        console.warn('Fare estimate sync notice:', err);
      }
    };

    fetchEstimate();

    return () => {
      isMounted = false;
    };
  }, [vehicleId, pickupRaw, dropRaw, activeBooking.stops]);

  // Create booking or launch Razorpay checkout
  const handleBookVehicle = async () => {
    if (bookingLoading) return;
    setBookingLoading(true);
    setBookingError(null);

    const pickupAddr = getCleanAddress(activeBooking.pickup);
    const dropAddr = getCleanAddress(activeBooking.drop);

    const drivingKm = await resolveDrivingDistanceKm(
      activeBooking.pickup,
      activeBooking.drop,
      (activeBooking.stops || []).filter(Boolean)
    );

    const basePayload = {
      pickupLocation: {
        address: pickupAddr,
        landmark: activeBooking.pickup?.landmark || '',
        city: activeBooking.pickup?.city || '',
        state: activeBooking.pickup?.state || '',
        pincode: activeBooking.pickup?.pincode || activeBooking.pickup?.postalCode || '',
        lat: activeBooking.pickup?.lat ?? activeBooking.pickup?.latitude ?? null,
        lng: activeBooking.pickup?.lng ?? activeBooking.pickup?.longitude ?? null,
      },
      dropLocation: {
        address: dropAddr,
        landmark: activeBooking.drop?.landmark || '',
        city: activeBooking.drop?.city || '',
        state: activeBooking.drop?.state || '',
        pincode: activeBooking.drop?.pincode || activeBooking.drop?.postalCode || '',
        lat: activeBooking.drop?.lat ?? activeBooking.drop?.latitude ?? null,
        lng: activeBooking.drop?.lng ?? activeBooking.drop?.longitude ?? null,
      },
      stops: (activeBooking.stops || []).filter(Boolean).map((s) => ({
        address: getCleanAddress(s),
        city: s?.city || '',
        lat: s?.lat ?? s?.latitude ?? null,
        lng: s?.lng ?? s?.longitude ?? null,
      })),
      goods: {
        category: activeBooking.goods?.category || 'Other',
        customCategory: activeBooking.goods?.customCategory || '',
        weightKg: parseFloat(activeBooking.goods?.weight) || 1,
        packages: parseInt(activeBooking.goods?.packages) || 1,
        instructions: activeBooking.goods?.instructions || '',
      },
      vehicleTypeId: activeBooking.vehicle._id,
      paymentMethod,
      distanceKm: drivingKm || fareEstimate?.distanceKm || undefined,
    };

    // ── 1. Cash On Delivery Flow ──────────────────────────────────────────
    if (paymentMethod === 'CASH') {
      try {
        const result = await transportService.createBooking(basePayload);
        clearActiveBooking();
        navigate('/transport/success', {
          state: { bookingId: result.booking.bookingId, booking: result.booking },
        });
      } catch (err) {
        console.error('Booking creation failed:', err);
        setBookingError(err?.message || 'Booking failed. Please try again.');
        setBookingLoading(false);
      }
      return;
    }

    // ── 2. Online Payment Gateway (Razorpay) Flow ─────────────────────────
    try {
      const isLoaded = await loadRazorpaySdk();
      if (!isLoaded || !window.Razorpay) {
        setBookingLoading(false);
        setBookingError('Razorpay Checkout failed to load. Please check your internet connection.');
        return;
      }

      // Step A: Create payment order on backend
      const orderData = await transportService.createPaymentOrder(basePayload);
      if (!orderData || !orderData.orderId) {
        throw new Error(orderData?.message || 'Unable to initiate payment gateway');
      }

      // Step B: Setup Razorpay Modal Options with prefilled customer details
      const userName = localStorage.getItem('sathiseller_user_name') || '';
      const userEmail = localStorage.getItem('sathiseller_user_email') || '';
      const userPhone = localStorage.getItem('sathiseller_user_phone') || '';

      const razorpayOptions = {
        key: orderData.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_live_TgHKKogdCDai1c',
        amount: orderData.amountPaise || Math.round(orderData.amount * 100),
        currency: orderData.currency || 'INR',
        name: 'Sathi Seller Transport',
        description: `Booking payment for ${activeBooking.vehicle.name} (₹${orderData.amount})`,
        order_id: orderData.orderId,
        prefill: {
          name: userName,
          email: userEmail,
          contact: userPhone,
        },
        theme: {
          color: '#047857',
        },
        handler: async function (response) {
          try {
            setBookingLoading(true);
            setBookingError(null);

            const verifyPayload = {
              ...basePayload,
              paymentMethod,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            };

            const verifyRes = await transportService.verifyPayment(verifyPayload);

            if (verifyRes && verifyRes.success && verifyRes.booking) {
              clearActiveBooking();
              navigate('/transport/success', {
                state: { bookingId: verifyRes.booking.bookingId, booking: verifyRes.booking },
              });
            } else {
              setBookingError(verifyRes?.message || 'Payment verification failed. Please contact support.');
              setBookingLoading(false);
            }
          } catch (verErr) {
            console.error('Payment verification failed:', verErr);
            setBookingError(verErr?.message || verErr?.response?.data?.message || 'Payment verification error.');
            setBookingLoading(false);
          }
        },
        modal: {
          ondismiss: function () {
            setBookingLoading(false);
            setBookingError('Payment was cancelled. You can change payment method or retry anytime.');
          },
        },
      };

      const rzpInstance = new window.Razorpay(razorpayOptions);
      rzpInstance.on('payment.failed', function (resp) {
        console.error('Razorpay payment failed:', resp.error);
        setBookingLoading(false);
        setBookingError(resp.error?.description || 'Payment failed. Please try another payment method.');
      });
      rzpInstance.open();
    } catch (err) {
      console.error('Razorpay initialization failed:', err);
      setBookingError(err?.message || 'Failed to start payment. Please try again.');
      setBookingLoading(false);
    }
  };

  // Guard: redirect if no vehicle selected
  if (!activeBooking.vehicle) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center p-5 text-center">
        <h2 className="text-[18px] font-bold text-slate-800 mb-2">No Booking Data</h2>
        <p className="text-[14px] text-slate-500 mb-6">Please start your booking from the Transport Home.</p>
        <button className="bg-[#047857] text-white px-6 py-2 rounded-lg font-bold" onClick={() => navigate('/transport')}>Go Home</button>
      </div>
    );
  }

  const pickupText = getCleanAddress(activeBooking.pickup) || 'Pickup Location';
  const dropText = getCleanAddress(activeBooking.drop) || 'Drop Location';
  const fare = fareEstimate?.fareBreakdown;
  const totalFare = fare?.totalFare || 0;

  const currentPaymentInfo = PAYMENT_METHODS.find(m => m.id === paymentMethod) || PAYMENT_METHODS[0];
  const CurrentIcon = currentPaymentInfo.icon;

  return (
    <div className="h-[100dvh] bg-[#f8fafc] font-sans text-slate-800 relative max-w-[480px] mx-auto shadow-[0_0_20px_rgba(0,0,0,0.05)] flex flex-col overflow-hidden">
      
      {/* Header */}
      <header className="flex items-center py-4 px-4 bg-white z-10 sticky top-0 border-b border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
        <button className="bg-transparent border-none cursor-pointer p-0 flex items-center" onClick={() => navigate(-1)}>
          <ChevronLeft size={24} className="text-slate-700" />
        </button>
        <h2 className="text-[16px] font-bold tracking-tight m-0 text-slate-800 ml-3">Fare Summary</h2>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5 pb-[110px] [&::-webkit-scrollbar]:hidden flex flex-col gap-4">

        {/* Locations */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex gap-4">
          <div className="flex flex-col items-center mt-1.5 mb-1.5 shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-[#047857] shrink-0"></div>
            {activeBooking.stops && activeBooking.stops.filter(Boolean).map((_, sIdx) => (
              <React.Fragment key={`dot_${sIdx}`}>
                <div className="w-0.5 flex-1 min-h-[14px] bg-slate-200 my-0.5"></div>
                <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>
              </React.Fragment>
            ))}
            <div className="w-0.5 flex-1 min-h-[14px] bg-slate-200 my-0.5"></div>
            <div className="w-2.5 h-2.5 rounded-sm bg-[#ff5500] shrink-0"></div>
          </div>
          <div className="flex-1 flex flex-col justify-between gap-3 py-0.5">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Pickup</span>
              <span className="text-[14px] font-semibold text-slate-800">{pickupText}</span>
            </div>
            {activeBooking.stops && activeBooking.stops.filter(Boolean).map((stopAddr, sIdx) => (
              <div key={`stop_${sIdx}`} className="flex flex-col">
                <span className="text-[11px] font-bold text-blue-500 uppercase tracking-wider mb-0.5">Stop {sIdx + 1}</span>
                <span className="text-[14px] font-semibold text-slate-800">{typeof stopAddr === 'string' ? stopAddr : stopAddr.address}</span>
              </div>
            ))}
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Drop</span>
              <span className="text-[14px] font-semibold text-slate-800">{dropText}</span>
            </div>
          </div>
        </div>

        {/* Vehicle & Goods */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-700 border border-slate-100">
              <Truck size={24} />
            </div>
            <div className="flex flex-col">
              <h3 className="text-[14px] font-bold text-slate-800 m-0 mb-0.5">{activeBooking.vehicle.name}</h3>
              <span className="text-[12px] text-slate-500 flex items-center gap-1">
                <Package size={12} /> {activeBooking.goods?.category} • {activeBooking.goods?.weight}KG
              </span>
            </div>
          </div>
          {fareEstimate && (
            <div className="text-[13px] font-bold text-[#ff5500] bg-orange-50 px-2.5 py-1 rounded-lg">
              {fareEstimate.distanceKm} KM
            </div>
          )}
        </div>

        {/* Fare Breakdown */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h3 className="text-[14px] font-bold text-slate-800 mb-4">Fare Breakdown</h3>

          {estimateLoading && (
            <div className="flex items-center justify-center py-6 gap-2 text-slate-400">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-[13px]">Calculating fare...</span>
            </div>
          )}

          {estimateError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-3">
              <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="text-[12px] text-red-600">{estimateError}</span>
                <button onClick={fetchFareEstimate} className="block text-[12px] font-bold text-red-600 underline mt-1 bg-transparent border-none cursor-pointer p-0">Retry</button>
              </div>
            </div>
          )}

          {fare && !estimateLoading && (
            <>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[13px] text-slate-600">Base Fare</span>
                <span className="text-[13px] font-medium text-slate-800">₹{fare.baseFare}</span>
              </div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[13px] text-slate-600">Distance Charge ({fareEstimate.distanceKm} km)</span>
                <span className="text-[13px] font-medium text-slate-800">₹{fare.distanceCharge}</span>
              </div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[13px] text-slate-600">Platform Fee</span>
                <span className="text-[13px] font-medium text-slate-800">₹{fare.platformFee}</span>
              </div>
              {fare.discount > 0 && (
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[13px] text-emerald-600">Discount</span>
                  <span className="text-[13px] font-medium text-emerald-600">−₹{fare.discount}</span>
                </div>
              )}
              <div className="w-full h-px bg-slate-100 my-4"></div>
              <div className="flex justify-between items-center">
                <span className="text-[15px] font-bold text-slate-800">Total Amount</span>
                <span className="text-[18px] font-extrabold text-slate-900 flex items-center">
                  <IndianRupee size={16} strokeWidth={3} /> {totalFare}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Payment Method Card with interactive Change Trigger */}
        <div 
          onClick={() => setPaymentModalOpen(true)}
          className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:border-emerald-200 transition-all cursor-pointer flex items-center justify-between gap-3 group"
        >
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border ${currentPaymentInfo.iconBg} shrink-0 transition-transform group-hover:scale-105`}>
              <CurrentIcon size={20} />
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Payment Method</span>
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-black text-slate-900">{currentPaymentInfo.name}</span>
                {currentPaymentInfo.badge && (
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${currentPaymentInfo.badgeColor}`}>
                    {currentPaymentInfo.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500 line-clamp-1">{currentPaymentInfo.tagline}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setPaymentModalOpen(true); }}
            className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-[12px] transition-colors cursor-pointer border-none flex items-center gap-1 shrink-0"
          >
            <span>Change</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* API booking error */}
        {bookingError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
            <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
            <span className="text-[13px] text-red-700">{bookingError}</span>
          </div>
        )}

      </div>

      {/* Book Button */}
      <div className="absolute bottom-0 left-0 w-full py-4 px-5 pb-6 bg-white border-t border-slate-100 shadow-[0_-10px_20px_rgba(0,0,0,0.03)] z-[90]">
        <button
          className={`w-full rounded-xl py-4 px-8 text-[16px] font-bold flex items-center justify-between cursor-pointer transition-all duration-200 ${!estimateLoading && !bookingLoading ? 'bg-[#047857] text-white shadow-[0_4px_12px_rgba(4,120,87,0.2)] active:scale-[0.98]' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
          onClick={handleBookVehicle}
          disabled={estimateLoading || bookingLoading || !!estimateError}
        >
          {bookingLoading ? (
            <span className="flex items-center gap-2 mx-auto">
              <Loader2 size={18} className="animate-spin" />
              {paymentMethod === 'CASH' ? 'Booking Vehicle...' : 'Processing Payment...'}
            </span>
          ) : (
            <>
              <span>{paymentMethod === 'CASH' ? 'Book Vehicle' : 'Pay & Book Vehicle'}</span>
              {fare && (
                <span className="flex items-center text-[18px] font-black">
                  <IndianRupee size={16} strokeWidth={3} /> {totalFare}
                </span>
              )}
            </>
          )}
        </button>
      </div>

      {/* 💳 PAYMENT METHOD SELECTION BOTTOM SHEET / MODAL */}
      {paymentModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-t-3xl sm:rounded-3xl max-w-[480px] w-full p-5 sm:p-6 shadow-2xl space-y-4 border border-slate-100 animate-in slide-in-from-bottom duration-200"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-[16px] font-black text-slate-900 m-0">Choose Payment Method</h3>
                <p className="text-[11px] text-slate-500 m-0 mt-0.5">Select how you want to pay for this transport trip</p>
              </div>
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors border-none"
              >
                <X size={16} />
              </button>
            </div>

            {/* Methods List */}
            <div className="space-y-2.5 py-1">
              {PAYMENT_METHODS.map((method) => {
                const MethodIcon = method.icon;
                const isSelected = paymentMethod === method.id;
                return (
                  <div
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-emerald-50/60 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${method.iconBg} shrink-0`}>
                        <MethodIcon size={19} />
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className={`text-[13px] font-bold ${isSelected ? 'text-emerald-950' : 'text-slate-800'}`}>
                            {method.name}
                          </span>
                          {method.badge && (
                            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${method.badgeColor}`}>
                              {method.badge}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500 leading-tight mt-0.5">
                          {method.tagline}
                        </span>
                      </div>
                    </div>

                    {/* Radio Indicator */}
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                      isSelected
                        ? 'bg-[#047857] border-[#047857] text-white shadow-xs'
                        : 'border-slate-300 bg-white'
                    }`}>
                      {isSelected && <Check size={12} strokeWidth={3} />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Confirm Action Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="w-full py-3.5 bg-[#047857] hover:bg-[#036348] text-white font-extrabold text-[13px] rounded-xl shadow-md transition-all cursor-pointer border-none flex items-center justify-center gap-1.5"
              >
                <span>Confirm Payment Method</span>
                <Check size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default FareSummary;

