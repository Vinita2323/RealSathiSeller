import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  ChevronLeft,
  Truck,
  Check,
  Package,
  IndianRupee,
  Loader2,
  AlertCircle,
  Phone,
  KeyRound,
  ShieldCheck,
  MapPin,
  RefreshCw,
  Star,
} from 'lucide-react';
import { transportService } from '../../../../services/transportService';
import RatingModal from '../../../../components/RatingModal';
import LiveDeliveryMap from '../../components/LiveDeliveryMap';
import { calculateDistanceKm } from '../../../../utils/geocodeUtils';

// Map backend status to human-readable labels
const PHASE_COPY = {
  SEARCHING_CAPTAIN: 'Searching for a captain.',
  CAPTAIN_ASSIGNED: 'A captain is assigned and can navigate to pickup.',
  CAPTAIN_ARRIVING: 'The captain is travelling to the pickup location.',
  CAPTAIN_REACHED_PICKUP: 'The captain has arrived at pickup.',
  RIDE_STARTED: 'The ride has started. The captain is travelling to the drop.',
  CAPTAIN_REACHED_DROP: 'The captain has arrived at the destination.',
  RIDE_COMPLETED: 'Delivery is complete.',
  CANCELLED: 'This booking was cancelled.',
};

const TRACKING_STATUSES = [
  'CAPTAIN_ASSIGNED',
  'CAPTAIN_ARRIVING',
  'CAPTAIN_REACHED_PICKUP',
  'RIDE_STARTED',
  'CAPTAIN_REACHED_DROP',
];

const pointFrom = (loc) => {
  if (loc?.lat == null || loc?.lng == null) return null;
  const lat = Number(loc.lat);
  const lng = Number(loc.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  return { lat, lng };
};

const captainPointFrom = (booking) => {
  const live = pointFrom(booking?.liveLocation);
  if (live) return { ...live, updatedAt: booking.liveLocation?.updatedAt };
  const coords = booking?.captainId?.liveLocation?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const point = pointFrom({ lng: coords[0], lat: coords[1] });
  return point;
};

const STATUS_LABELS = {
  SEARCHING_CAPTAIN: 'Searching for Captain',
  CAPTAIN_ASSIGNED: 'Captain Assigned',
  CAPTAIN_ARRIVING: 'Captain on the Way',
  CAPTAIN_REACHED_PICKUP: 'Captain at Pickup',
  RIDE_STARTED: 'In Transit / Ride Started',
  CAPTAIN_REACHED_DROP: 'Captain at Destination',
  RIDE_COMPLETED: 'Delivered & Completed',
  CANCELLED: 'Cancelled',
};

// The ordered milestone steps for progress bar
const TIMELINE_STEPS = [
  { status: 'SEARCHING_CAPTAIN', label: 'Booking Created' },
  { status: 'CAPTAIN_ASSIGNED', label: 'Captain Assigned' },
  { status: 'RIDE_STARTED', label: 'Goods Picked Up' },
  { status: 'CAPTAIN_REACHED_DROP', label: 'Reached Destination' },
  { status: 'RIDE_COMPLETED', label: 'Delivered' },
];

const STATUS_ORDER = [
  'SEARCHING_CAPTAIN',
  'CAPTAIN_ASSIGNED',
  'CAPTAIN_ARRIVING',
  'CAPTAIN_REACHED_PICKUP',
  'RIDE_STARTED',
  'CAPTAIN_REACHED_DROP',
  'RIDE_COMPLETED',
];

const isCompleted = (stepStatus, bookingStatus) => {
  if (bookingStatus === 'CANCELLED') return false;
  return STATUS_ORDER.indexOf(bookingStatus) >= STATUS_ORDER.indexOf(stepStatus);
};

const TransportBookingDetails = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const bookingId = location.state?.bookingId;
  const [booking, setBooking] = useState(location.state?.booking || null);
  const [loading, setLoading] = useState(!location.state?.booking);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [hasAutoOpenedRating, setHasAutoOpenedRating] = useState(false);

  const fetchBooking = useCallback(async (isSilent = false) => {
    if (!bookingId) return;
    try {
      if (!isSilent) setLoading(true);
      const data = await transportService.getBookingDetails(bookingId);
      setBooking(data.booking);
      setError(null);

      // Auto-open rating modal if ride is completed and user hasn't rated yet
      if (data.booking?.status === 'RIDE_COMPLETED' && !data.booking?.hasUserRated && !hasAutoOpenedRating) {
        setShowRatingModal(true);
        setHasAutoOpenedRating(true);
      }
    } catch (err) {
      if (!isSilent) setError('Could not load booking details.');
    } finally {
      if (!isSilent) setLoading(false);
      setRefreshing(false);
    }
  }, [bookingId, hasAutoOpenedRating]);

  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  // Check initial booking state on mount to auto-open rating modal if already completed
  useEffect(() => {
    if (booking?.status === 'RIDE_COMPLETED' && !booking?.hasUserRated && !hasAutoOpenedRating) {
      setShowRatingModal(true);
      setHasAutoOpenedRating(true);
    }
  }, [booking, hasAutoOpenedRating]);

  // Auto-poll active bookings every 5 seconds for live captain progression & OTP triggers
  useEffect(() => {
    if (!booking || ['RIDE_COMPLETED', 'CANCELLED'].includes(booking.status)) return;
    const interval = setInterval(() => {
      fetchBooking(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [booking, fetchBooking]);

  const handleRatingSuccess = (res) => {
    setBooking((prev) => ({
      ...prev,
      hasUserRated: true,
      userRating: res.rating?.rating || 5,
      userReview: res.rating?.review || '',
      userFeedbackTags: res.rating?.feedbackTags || [],
    }));
  };

  if (!bookingId) return <Navigate to="/orders" replace />;

  if (loading) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 size={32} className="animate-spin text-[#047857]" />
        <span className="text-[14px] font-medium">Loading booking details...</span>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="h-[100dvh] flex flex-col items-center justify-center p-6 text-center gap-3">
        <AlertCircle size={40} className="text-red-400" />
        <p className="text-[15px] text-slate-600">{error || 'Booking not found.'}</p>
        <button className="bg-[#047857] text-white px-6 py-2 rounded-xl font-bold" onClick={() => navigate('/orders')}>
          Go to Orders
        </button>
      </div>
    );
  }

  const bId = booking.bookingId || booking._id;
  const bStatus = booking.status || 'SEARCHING_CAPTAIN';
  const bPickup = booking.pickupLocation?.address || booking.pickup || '—';
  const bDrop = booking.dropLocation?.address || booking.drop || '—';
  const bFare = Number(booking.fareBreakdown?.totalFare ?? booking.totalFare ?? booking.fare ?? 0);
  const bVehicle = booking.vehicleSnapshot?.name || booking.vehicle?.name || 'Vehicle';
  const bCategory = booking.goods?.category || '—';
  const bWeight = booking.goods?.weightKg || booking.goods?.weight || '—';
  const bPackages = booking.goods?.packages || '—';
  const bInstructions = booking.goods?.instructions || '';
  const bDate = booking.createdAt
    ? new Date(booking.createdAt).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';
  const bDistanceKm = booking.distanceKm || null;
  const bPayment = booking.paymentMethod || 'CASH';
  const captain = booking.captainId;

  // Determine active OTP card to show
  const showPickupOtp =
    ['CAPTAIN_ASSIGNED', 'CAPTAIN_ARRIVING', 'CAPTAIN_REACHED_PICKUP'].includes(bStatus) &&
    booking.pickupOtp &&
    !booking.pickupOtpVerified;

  const showDropOtp =
    ['RIDE_STARTED', 'CAPTAIN_REACHED_DROP'].includes(bStatus) &&
    booking.dropOtp &&
    !booking.dropOtpVerified;

  const showLiveTracking = TRACKING_STATUSES.includes(bStatus);
  const captainPosition = showLiveTracking ? captainPointFrom(booking) : null;
  const headingToDrop = ['RIDE_STARTED', 'CAPTAIN_REACHED_DROP'].includes(bStatus);
  const targetLocation = headingToDrop ? booking.dropLocation : booking.pickupLocation;
  const targetPosition = pointFrom(targetLocation);
  const pickupPosition = pointFrom(booking.pickupLocation);
  const dropPosition = pointFrom(booking.dropLocation);
  const liveDistanceKm = calculateDistanceKm(captainPosition, targetPosition);
  const liveEtaMin = liveDistanceKm != null ? Math.max(2, Math.round((liveDistanceKm / 25) * 60)) : null;
  const pickupPhotoUrls = (booking.pickupPhotos || []).map((photo) => photo.url).filter(Boolean);
  const dropPhotoUrls = [
    ...(booking.dropPhotos || []).map((photo) => photo.url),
    booking.proofOfDeliveryUrl,
  ].filter(Boolean);

  return (
    <div className="h-[100dvh] md:h-auto md:min-h-screen bg-[#f8fafc] font-sans text-slate-800 relative max-w-[480px] md:max-w-6xl mx-auto shadow-[0_0_20px_rgba(0,0,0,0.05)] md:shadow-none flex flex-col md:py-8 md:px-6 overflow-hidden md:overflow-visible">
      {/* Mobile Header */}
      <header className="flex md:hidden items-center justify-between py-4 px-4 bg-white z-10 sticky top-0 border-b border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-3">
          <button className="bg-transparent border-none cursor-pointer p-0 flex items-center" onClick={() => navigate(-1)}>
            <ChevronLeft size={24} className="text-slate-700" />
          </button>
          <h2 className="text-[16px] font-bold tracking-tight m-0 text-slate-800">Transport Tracking</h2>
        </div>
        <button
          onClick={() => { setRefreshing(true); fetchBooking(false); }}
          className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg p-1.5 cursor-pointer transition-colors"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin text-[#047857]' : ''} />
        </button>
      </header>

      {/* Desktop Header */}
      <div className="hidden md:flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <button onClick={() => navigate('/orders', { state: { tab: 'transport' } })} className="hover:text-emerald-700 font-medium cursor-pointer border-none bg-transparent flex items-center gap-1">
              <ChevronLeft size={16} /> Transport Orders
            </button>
            <span>/</span>
            <span className="text-slate-800 font-bold">{bId}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 m-0">Transport Live Tracking</h1>
        </div>
        <button
          onClick={() => { setRefreshing(true); fetchBooking(false); }}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs cursor-pointer"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin text-[#047857]' : ''} />
          <span>Refresh Status</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 md:px-0 py-5 md:py-0 pb-[40px] md:pb-12 [&::-webkit-scrollbar]:hidden flex flex-col md:grid md:grid-cols-12 md:gap-6 md:items-start md:overflow-visible [grid-auto-flow:dense]">
        {/* ── STAGE 1: PICKUP OTP CARD (HIGHLIGHTED) ── */}
        {showPickupOtp && (
          <div className="md:col-span-7 md:col-start-1 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl p-4 md:p-6 shadow-md border border-emerald-500 flex items-center justify-between animate-fade-in-up">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-200 flex items-center gap-1.5">
                <KeyRound size={14} /> Pickup Verification OTP
              </span>
              <span className="text-[32px] font-black tracking-widest leading-tight font-mono text-white mt-1">
                {booking.pickupOtp}
              </span>
              <span className="text-[11px] text-emerald-100 font-medium">
                Share this 4-digit OTP with the captain when ready to load goods.
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
              <KeyRound size={24} />
            </div>
          </div>
        )}

        {/* ── STAGE 2: DROP OTP CARD (HIGHLIGHTED) ── */}
        {showDropOtp && (
          <div className="md:col-span-7 md:col-start-1 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-2xl p-4 md:p-6 shadow-md border border-amber-500 flex items-center justify-between animate-fade-in-up">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-200 flex items-center gap-1.5">
                <ShieldCheck size={14} /> Drop Delivery OTP
              </span>
              <span className="text-[32px] font-black tracking-widest leading-tight font-mono text-white mt-1">
                {booking.dropOtp}
              </span>
              <span className="text-[11px] text-amber-100 font-medium">
                Share this 4-digit OTP with the captain upon arrival to complete delivery.
              </span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
              <ShieldCheck size={24} />
            </div>
          </div>
        )}

        {/* Top Summary Card */}
        <div className="md:col-span-7 md:col-start-1 bg-white rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-sm border border-slate-100 flex flex-col gap-3">
          <div className="flex justify-between items-start">
            <div className="flex flex-col gap-0.5">
              <span className="text-[14px] font-extrabold text-slate-900 m-0">{bId}</span>
              <span className="text-[11px] font-medium text-slate-400">{bDate}</span>
            </div>
            <span
              className={`text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded ${
                bStatus === 'CANCELLED'
                  ? 'bg-red-100 text-red-600'
                  : bStatus === 'RIDE_COMPLETED'
                  ? 'bg-green-100 text-green-700'
                  : bStatus === 'RIDE_STARTED'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-orange-100 text-orange-600'
              }`}
            >
              {STATUS_LABELS[bStatus] || bStatus}
            </span>
          </div>
          <p className="text-[12px] text-slate-600 m-0">{PHASE_COPY[bStatus] || STATUS_LABELS[bStatus]}</p>

          <div className="w-full h-px bg-slate-100" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center text-slate-700">
                <Truck size={20} />
              </div>
              <div className="flex flex-col">
                <span className="text-[14px] font-bold text-slate-800">{bVehicle}</span>
                <span className="text-[12px] text-slate-500">
                  {bCategory} • {bWeight}KG
                </span>
              </div>
            </div>
            <span className="text-[16px] font-extrabold text-slate-900 flex items-center">
              <IndianRupee size={14} strokeWidth={3} /> {bFare.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex gap-2">
            {bDistanceKm && (
              <span className="text-[11px] font-bold bg-orange-50 text-orange-600 px-2 py-1 rounded">
                {bDistanceKm} km
              </span>
            )}
            <span className="text-[11px] font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded">
              {bPayment}
            </span>
          </div>
        </div>

        {showLiveTracking && (
          <div className="md:col-span-12 bg-white rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-sm border border-slate-100 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[14px] font-bold text-slate-800 m-0">Captain live location</h3>
                <p className="text-[11px] text-slate-500 m-0 mt-1">
                  {headingToDrop ? 'Travelling to the drop location.' : 'Travelling to the pickup location.'}
                  {liveDistanceKm != null ? ` ${liveDistanceKm} km · about ${liveEtaMin} min.` : ''}
                </p>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                Live
              </span>
            </div>
            {captainPosition ? (
              <LiveDeliveryMap
                captainPosition={captainPosition}
                destinationPosition={targetPosition}
                destinationAddress={targetLocation?.address}
                pickupPosition={pickupPosition}
                dropPosition={dropPosition}
              />
            ) : (
              <p className="text-[12px] text-slate-500 bg-slate-50 rounded-xl px-3 py-3 m-0">
                Waiting for the captain's GPS. This screen updates on its own once a location is received.
              </p>
            )}
          </div>
        )}

        {(pickupPhotoUrls.length > 0 || dropPhotoUrls.length > 0) && (
          <div className="md:col-span-12 bg-white rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-sm border border-slate-100">
            <h3 className="text-[14px] font-bold text-slate-800 mb-3">Photos</h3>
            {pickupPhotoUrls.length > 0 && (
              <div className="mb-3">
                <p className="text-[11px] font-bold uppercase text-slate-400 mb-2">Goods at pickup</p>
                <div className="flex gap-2 overflow-x-auto">
                  {pickupPhotoUrls.map((url) => (
                    <img key={url} src={url} alt="Goods at pickup" className="w-20 h-20 rounded-xl object-cover border border-slate-200" />
                  ))}
                </div>
              </div>
            )}
            {dropPhotoUrls.length > 0 && (
              <div>
                <p className="text-[11px] font-bold uppercase text-slate-400 mb-2">Delivery proof</p>
                <div className="flex gap-2 overflow-x-auto">
                  {[...new Set(dropPhotoUrls)].map((url) => (
                    <img key={url} src={url} alt="Delivery proof" className="w-20 h-20 rounded-xl object-cover border border-slate-200" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Assigned Captain Card (if assigned) */}
        {captain && (
          <div className="md:col-span-5 md:col-start-8 bg-white rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-sm border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-emerald-50 rounded-full flex items-center justify-center text-[#047857] font-bold text-base border border-emerald-100">
                {captain.name ? captain.name.charAt(0).toUpperCase() : 'C'}
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Assigned Captain</span>
                <span className="text-[14px] font-bold text-slate-800">{captain.name || 'Captain Partner'}</span>
                <span className="text-[12px] text-slate-500">{captain.vehicleType || 'Transport Vehicle'}</span>
              </div>
            </div>
            {captain.phone && (
              <button
                onClick={() => window.open(`tel:${captain.phone}`, '_self')}
                className="w-10 h-10 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#047857] border border-emerald-200 flex items-center justify-center cursor-pointer transition-colors"
              >
                <Phone size={18} />
              </button>
            )}
          </div>
        )}

        {/* Booking Status Timeline */}
        <div className="md:col-span-7 md:col-start-1 bg-white rounded-2xl md:rounded-3xl p-5 md:p-6 shadow-sm border border-slate-100">
          <h3 className="text-[14px] md:text-base font-bold text-slate-800 mb-5">Ride Timeline</h3>
          <div className="relative pl-3">
            <div className="absolute left-[23px] top-2 bottom-6 w-0.5 bg-slate-100"></div>
            {TIMELINE_STEPS.map((step, idx) => {
              const done = isCompleted(step.status, bStatus);
              const historyEntry = booking.statusHistory?.find((h) => h.status === step.status);
              const timeStr = historyEntry?.timestamp
                ? new Date(historyEntry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : null;

              return (
                <div key={idx} className={`relative flex gap-4 ${idx !== TIMELINE_STEPS.length - 1 ? 'mb-6' : ''}`}>
                  <div className="relative z-10">
                    {done ? (
                      <div className="w-6 h-6 rounded-full bg-[#047857] flex items-center justify-center border-2 border-white shadow-sm">
                        <Check size={12} className="text-white" strokeWidth={4} />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center border-2 border-white">
                        <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col flex-1 pb-1">
                    <span className={`text-[13px] md:text-[14px] font-bold ${done ? 'text-slate-800' : 'text-slate-400'}`}>
                      {step.label}
                    </span>
                    {timeStr && <span className="text-[11px] text-slate-500 mt-0.5">{timeStr}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Locations Card (pickup → stops → drop) */}
        <div className="md:col-span-5 md:col-start-8 bg-white rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-sm border border-slate-100 flex gap-4">
          <div className="flex flex-col items-center mt-1.5 mb-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#047857]"></div>
            <div className="w-0.5 flex-1 bg-slate-200 my-1"></div>
            {(Array.isArray(booking.stops) ? booking.stops : []).map((_, si) => (
              <React.Fragment key={`stop-dot-${si}`}>
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-amber-200"></div>
                <div className="w-0.5 flex-1 bg-slate-200 my-1"></div>
              </React.Fragment>
            ))}
            <div className="w-2.5 h-2.5 rounded-sm bg-[#ff5500]"></div>
          </div>
          <div className="flex-1 flex flex-col justify-between gap-4 py-0.5">
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Pickup Address</span>
              <span className="text-[13px] md:text-[14px] font-medium text-slate-800 leading-snug">{bPickup}</span>
            </div>
            {(Array.isArray(booking.stops) ? booking.stops : []).map((stop, si) => (
              <div key={`stop-${si}`} className="flex flex-col">
                <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider mb-0.5">
                  Stop {si + 1}
                </span>
                <span className="text-[13px] md:text-[14px] font-medium text-slate-800 leading-snug">
                  {stop?.address || stop?.city || 'Intermediate stop'}
                </span>
              </div>
            ))}
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Drop Address</span>
              <span className="text-[13px] md:text-[14px] font-medium text-slate-800 leading-snug">{bDrop}</span>
            </div>
          </div>
        </div>

        {/* ── STAGE 3: POST-RIDE RATING CARD ── */}
        {bStatus === 'RIDE_COMPLETED' && (
          <div className="md:col-span-7 md:col-start-1 bg-white rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-sm border border-emerald-100 flex flex-col gap-3">
            {booking.hasUserRated ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-500 border border-amber-200 flex items-center justify-center font-bold">
                    <Star size={20} className="fill-amber-400 text-amber-400" />
                  </div>
                  <div>
                    <span className="text-xs md:text-sm font-bold text-slate-800 block">
                      You rated {captain?.name || 'Captain'} {booking.userRating}/5 ⭐
                    </span>
                    {booking.userReview ? (
                      <span className="text-[11px] md:text-xs text-slate-500 italic block mt-0.5 line-clamp-1">
                        "{booking.userReview}"
                      </span>
                    ) : (
                      <span className="text-[10px] md:text-xs text-emerald-600 font-medium block">
                        Rating submitted successfully
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setShowRatingModal(true)}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-xl border border-slate-200 cursor-pointer transition-colors"
                >
                  View
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold">
                    <Star size={20} className="fill-amber-400 text-amber-400" />
                  </div>
                  <div>
                    <span className="text-xs md:text-sm font-bold text-slate-900 block">Rate Your Captain</span>
                    <span className="text-[11px] md:text-xs text-slate-500 font-medium">How was your trip experience?</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowRatingModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-extrabold rounded-xl shadow-xs cursor-pointer border-none transition-all flex items-center gap-1.5"
                >
                  <Star size={13} className="fill-white" />
                  <span>Rate Captain</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Goods Information Card */}
        <div className="md:col-span-5 md:col-start-8 bg-white rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-sm border border-slate-100">
          <h3 className="text-[14px] md:text-base font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Package size={16} className="text-[#047857]" /> Goods Information
          </h3>
          <div className="grid grid-cols-2 gap-y-3 gap-x-4">
            <div className="flex flex-col">
              <span className="text-[11px] text-slate-500 font-medium mb-0.5">Category</span>
              <span className="text-[13px] font-semibold text-slate-800">{bCategory}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-slate-500 font-medium mb-0.5">Total Weight</span>
              <span className="text-[13px] font-semibold text-slate-800">{bWeight} KG</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-slate-500 font-medium mb-0.5">Packages</span>
              <span className="text-[13px] font-semibold text-slate-800">{bPackages} Boxes</span>
            </div>
          </div>
          {bInstructions && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col">
              <span className="text-[11px] text-slate-500 font-medium mb-1">Instructions</span>
              <span className="text-[12px] italic text-slate-700">{bInstructions}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── RATING MODAL POPUP ── */}
      <RatingModal
        isOpen={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        ride={booking}
        role="user"
        onSuccess={handleRatingSuccess}
      />
    </div>
  );
};

export default TransportBookingDetails;
