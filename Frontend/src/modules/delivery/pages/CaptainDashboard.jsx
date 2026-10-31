import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import CaptainBottomNav from '../components/CaptainBottomNav';
import IncomingGigModal from '../components/IncomingGigModal';
import { captainService, returnService, getCachedCaptainDashboard } from '../../../services/authService';
import { transportService } from '../../../services/transportService';
import { markJobAsDismissed, isJobDismissed } from '../utils/jobDismissal';
import { MapService } from '../../../services/MapService';

const CaptainDashboard = () => {
  const navigate = useNavigate();
  const cachedInit = getCachedCaptainDashboard();

  const [isOnline, setIsOnline] = useState(() => {
    if (cachedInit?.stats?.isOnline !== undefined) return cachedInit.stats.isOnline;
    const saved = localStorage.getItem('sathiseller_captain_online');
    return saved !== null ? saved === 'true' : true;
  });
  const [activeDay, setActiveDay] = useState(() => {
    const today = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[today.getDay()];
  });
  const [loading, setLoading] = useState(!cachedInit);
  const [stats, setStats] = useState(() => cachedInit?.stats || {
    todayEarnings: 0,
    totalBookings: 0,
    deliveredToday: 0,
    pendingCount: 0,
  });
  const [pendingOrders, setPendingOrders] = useState(() => cachedInit?.pendingOrders || []);
  const [transportRequests, setTransportRequests] = useState(() => cachedInit?.transportRequests || []);
  const [returnPickups, setReturnPickups] = useState([]);
  const [activeTransport, setActiveTransport] = useState(() => cachedInit?.activeTransport || null);
  const [taskFilter, setTaskFilter] = useState('all');
  const [cardActionLoading, setCardActionLoading] = useState(null);
  const [weeklyEarnings, setWeeklyEarnings] = useState(() => {
    const wData = cachedInit?.weeklyEarnings || [];
    if (!wData.length) return [];
    const maxVal = Math.max(...wData.map((d) => d.value), 500);
    return wData.map((d, i) => ({
      ...d,
      fillPercent: d.value > 0 ? Math.max(Math.round((d.value / maxVal) * 100), 16) : 10,
      current: i === wData.length - 1,
    }));
  });
  const [selectedDetailTask, setSelectedDetailTask] = useState(null);

  // ── Incoming Gig Overlay Modal State (Queue + Dismiss tracking) ──
  const [incomingJob, setIncomingJob] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Location modal state
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationMode, setLocationMode] = useState(null);
  const [manualAddress, setManualAddress] = useState('');
  const [manualPredictions, setManualPredictions] = useState([]);
  const [manualSearching, setManualSearching] = useState(false);
  const [detectedLocation, setDetectedLocation] = useState(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [savedLocation, setSavedLocation] = useState(() => {
    return localStorage.getItem('sathiseller_captain_location') || null;
  });
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const manualInputRef = useRef(null);
  const manualDebounceRef = useRef(null);
  const watchIdRef = useRef(null);
  const lastLocationPostRef = useRef(0);

  // ── Body Scroll Lock when Modals are Open ─────────────────────
  useEffect(() => {
    if (selectedDetailTask || incomingJob || showLocationModal) {
      const originalOverflow = document.body.style.overflow;
      const originalTouchAction = document.body.style.touchAction;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      return () => {
        document.body.style.overflow = originalOverflow || '';
        document.body.style.touchAction = originalTouchAction || '';
      };
    }
  }, [selectedDetailTask, incomingJob, showLocationModal]);

  // ── Fetch Dashboard Stats & Incoming Requests ─────────────────
  const fetchDashboard = useCallback(async (isBackground = false) => {
    const hasCached = !!getCachedCaptainDashboard();
    if (!isBackground && !hasCached) setLoading(true);
    try {
      const [res, retRes] = await Promise.allSettled([
        captainService.getDashboardStats(isBackground),
        returnService.getCaptainReturnJobs('available'),
      ]);

      const retList = retRes.status === 'fulfilled' && retRes.value?.success ? retRes.value.returnJobs || [] : [];
      setReturnPickups(retList);

      if (res.status === 'fulfilled' && res.value?.success) {
        const dashData = res.value;
        const orders = dashData.pendingOrders || [];
        const tRequests = dashData.transportRequests || [];
        setPendingOrders(orders);
        setTransportRequests(tRequests);
        setActiveTransport(dashData.activeTransport || null);

        setStats({
          ...dashData.stats,
          pendingCount: (dashData.stats?.pendingCount || 0) + retList.length,
        });

        const wData = dashData.weeklyEarnings || [];
        const maxVal = Math.max(...wData.map((d) => d.value), 500);
        setWeeklyEarnings(
          wData.map((d, i) => ({
            ...d,
            fillPercent: d.value > 0 ? Math.max(Math.round((d.value / maxVal) * 100), 16) : 10,
            current: i === wData.length - 1,
          }))
        );

        if (dashData.stats.isOnline !== undefined) {
          setIsOnline(dashData.stats.isOnline);
          localStorage.setItem('sathiseller_captain_online', String(dashData.stats.isOnline));
        }

        const today = new Date();
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        setActiveDay(days[today.getDay()]);

        // Auto-popup return requests first (#52)
        const newReturn = retList.find(
          (r) =>
            !isJobDismissed(r) &&
            ['CAPTAIN_ASSIGNMENT_PENDING', 'PENDING', 'REQUESTED', 'ASSIGNED'].includes(
              String(r.status || r.captainStatus || '').toUpperCase()
            )
        );
        if (newReturn && !incomingJob) {
          setIncomingJob({
            ...newReturn,
            isReturn: true,
            isTransport: false,
            orderId: newReturn.returnId || newReturn._id,
            pickupAddress: newReturn.customerAddress,
            dropAddress: newReturn.sellerAddress || newReturn.sellerName,
            customerAddress: newReturn.customerAddress,
            sellerAddress: newReturn.sellerAddress,
          });
          return;
        }

        // Auto-popup white modal for incoming transport requests matching this captain (never repeats if dismissed)
        const newTransport = tRequests.find((t) => !isJobDismissed(t));
        if (newTransport && !incomingJob) {
          setIncomingJob({ ...newTransport, isTransport: true });
          return;
        }

        // Auto-popup white modal for newly assigned e-commerce orders (never repeats if dismissed)
        const newAssignedOrder = orders.find(
          (o) => o.captainStatus === 'Assigned' && !isJobDismissed(o)
        );
        if (newAssignedOrder && !incomingJob) {
          setIncomingJob({ ...newAssignedOrder, isTransport: false });
        }
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [incomingJob]);

  // Initial fetch
  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // #48 — notification bell uses unread notifications, not pending jobs
  useEffect(() => {
    const loadUnread = async () => {
      try {
        const res = await captainService.getNotifications();
        if (res?.success) {
          setUnreadNotifCount(
            Number(res.unreadCount ?? (Array.isArray(res.notifications)
              ? res.notifications.filter((n) => !n.isRead && !n.read).length
              : 0))
          );
        }
      } catch {
        /* ignore */
      }
    };
    loadUnread();
    const t = setInterval(loadUnread, 30000);
    return () => clearInterval(t);
  }, []);

  // Poll every 10 seconds while online, but not while the tab is hidden
  useEffect(() => {
    if (!isOnline) return;
    const interval = setInterval(() => {
      if (document.hidden) return;
      fetchDashboard(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [isOnline, fetchDashboard]);

  // ── Live Location Tracking ──────────────────────────────────────
  useEffect(() => {
    if (isOnline && navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        async (position) => {
          // GPS fires every few seconds; only report location every 15s
          const nowTs = Date.now();
          if (nowTs - lastLocationPostRef.current < 15000) return;
          lastLocationPostRef.current = nowTs;
          const { latitude, longitude } = position.coords;
          try {
            await captainService.updateLocation(latitude, longitude);
          } catch (e) {}
        },
        (error) => console.error('Geolocation watch error:', error),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
    } else {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    }
    return () => {
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [isOnline]);

  // ── Online Toggle ──────────────────────────────────────────────
  const handleOnlineToggle = async (e) => {
    e?.preventDefault?.();
    const newStatus = typeof e?.target?.checked === 'boolean' ? e.target.checked : !isOnline;
    setIsOnline(newStatus);
    localStorage.setItem('sathiseller_captain_online', String(newStatus));
    try {
      const res = await captainService.updateOnlineStatus(newStatus);
      if (res && res.isOnline !== undefined) {
        setIsOnline(Boolean(res.isOnline));
        localStorage.setItem('sathiseller_captain_online', String(res.isOnline));
      }
      fetchDashboard(true);
    } catch (err) {
      console.error('Status update error:', err);
      setIsOnline(!newStatus);
      localStorage.setItem('sathiseller_captain_online', String(!newStatus));
      alert(err?.response?.data?.message || err?.message || 'Failed to update online status');
    }
  };

  // ── Accept Job (Hides Modal & Navigates to Active Ride Screen) ──
  const handleAcceptJob = async (job) => {
    if (!job) return;
    setActionLoading(true);
    try {
      markJobAsDismissed(job);
      if (job.isReturn) {
        const returnId = job._id || job.returnId;
        await returnService.captainAcceptReturnJob(returnId);
        setIncomingJob(null);
        await fetchDashboard(true);
        navigate(`/captain/active-delivery?type=return&returnId=${returnId}`);
        return;
      }
      if (job.isTransport) {
        const bookingId = job.bookingId || job._id;
        await transportService.captainAcceptRequest(bookingId);
      } else {
        const orderId = job.orderId || job._id;
        await captainService.acceptJob(orderId);
      }
      setIncomingJob(null); // Modal closes immediately
      await fetchDashboard(true);
      if (job.isTransport) {
        navigate(`/captain/active-delivery?type=transport&bookingId=${job.bookingId || job._id}`);
      } else {
        navigate(`/captain/active-delivery?type=order&orderId=${job.orderId || job._id}`);
      }
    } catch (err) {
      console.error('Accept job error:', err);
      alert(err?.response?.data?.message || err?.message || 'Failed to accept job.');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Reject Job (Hides Modal & Never Reappears on Any Screen) ────
  const handleRejectJob = async (job) => {
    if (!job) return;
    markJobAsDismissed(job);
    setIncomingJob(null); // Modal closes immediately
    setActionLoading(true);
    try {
      if (job.isReturn) {
        // Returns: dismiss only (no dedicated reject API on popup path)
        await fetchDashboard(true);
        return;
      }
      const id = job.bookingId || job.orderId || job._id;
      if (job.isTransport) {
        await transportService.captainRejectRequest(id);
      } else {
        await captainService.rejectJob(id);
      }
      await fetchDashboard(true);
    } catch (err) {
      console.error('Reject job error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Dismiss Modal ───────────────────────────────────────────────
  const handleDismissModal = (job) => {
    if (job) {
      markJobAsDismissed(job);
    }
    setIncomingJob(null);
  };

  // ── Card Actions for Today's Incomplete / In-Process Section ──────
  const handleCardAcceptOrder = async (order) => {
    setCardActionLoading(order._id);
    try {
      markJobAsDismissed(order);
      await captainService.acceptJob(order.orderId || order._id);
      await fetchDashboard(true);
      navigate(`/captain/active-delivery?type=order&orderId=${order.orderId || order._id}`);
    } catch (err) {
      console.error('Accept order error:', err);
      alert(err?.response?.data?.message || 'Failed to accept order.');
    } finally {
      setCardActionLoading(null);
    }
  };

  const handleCardRejectOrder = async (order) => {
    setCardActionLoading(order._id);
    try {
      markJobAsDismissed(order);
      const id = order.orderId || order._id;
      await captainService.rejectJob(id);
      await fetchDashboard(true);
    } catch (err) {
      console.error('Reject order error:', err);
    } finally {
      setCardActionLoading(null);
    }
  };

  const handleCardAcceptTransport = async (request) => {
    setCardActionLoading(request._id);
    try {
      markJobAsDismissed(request);
      const id = request.bookingId || request._id;
      await transportService.captainAcceptRequest(id);
      await fetchDashboard(true);
      navigate(`/captain/active-delivery?type=transport&bookingId=${request.bookingId || request._id}`);
    } catch (err) {
      console.error('Accept transport error:', err);
      alert(err?.response?.data?.message || err?.message || 'Failed to accept request.');
    } finally {
      setCardActionLoading(null);
    }
  };

  const handleCardRejectTransport = async (request) => {
    setCardActionLoading(request._id);
    try {
      markJobAsDismissed(request);
      const id = request.bookingId || request._id;
      await transportService.captainRejectRequest(id);
      await fetchDashboard(true);
    } catch (err) {
      console.error('Reject transport error:', err);
    } finally {
      setCardActionLoading(null);
    }
  };

  const handleCardAcceptReturn = async (ret) => {
    setCardActionLoading(ret._id);
    try {
      markJobAsDismissed(ret);
      const id = ret._id || ret.returnId;
      await returnService.captainAcceptReturnJob(id);
      await fetchDashboard(true);
      navigate(`/captain/active-delivery?type=return&returnId=${id}`);
    } catch (err) {
      console.error('Accept return pickup error:', err);
      alert(err?.response?.data?.message || err?.message || 'Failed to accept return pickup.');
    } finally {
      setCardActionLoading(null);
    }
  };

  const getDeliveryStatusBadge = (status) => {
    switch (status) {
      case 'In Transit':
        return { label: 'In Transit', bg: 'bg-orange-100 text-orange-800 border-orange-200', icon: 'local_shipping' };
      case 'Picked Up':
        return { label: 'Picked Up', bg: 'bg-amber-100 text-amber-800 border-amber-200', icon: 'inventory_2' };
      case 'At Pickup':
        return { label: 'At Pickup / Store', bg: 'bg-blue-100 text-blue-800 border-blue-200', icon: 'storefront' };
      case 'Accepted':
        return { label: 'Accepted / Head to Store', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: 'task_alt' };
      case 'Assigned':
        return { label: 'Assigned (Pending Accept)', bg: 'bg-purple-100 text-purple-800 border-purple-200', icon: 'schedule' };
      default:
        return { label: status || 'Pending', bg: 'bg-slate-100 text-slate-700 border-slate-200', icon: 'info' };
    }
  };

  const getTransportStatusBadge = (status) => {
    switch (status) {
      case 'CAPTAIN_ASSIGNED':
      case 'CAPTAIN_ARRIVING':
        return { label: 'Captain Arriving', bg: 'bg-sky-100 text-sky-800 border-sky-200', icon: 'near_me' };
      case 'CAPTAIN_REACHED_PICKUP':
        return { label: 'At Pickup Point', bg: 'bg-amber-100 text-amber-800 border-amber-200', icon: 'location_on' };
      case 'RIDE_STARTED':
        return { label: 'In Transit / Haulage Started', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: 'local_shipping' };
      case 'CAPTAIN_REACHED_DROP':
        return { label: 'At Drop Point', bg: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: 'where_to_vote' };
      default:
        return { label: 'Live Trip Active', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: 'navigation' };
    }
  };

  // ── Location Modal Helpers (Google Maps Integrated) ───────────
  const handleAutoDetect = async () => {
    setLocationMode('auto');
    setLocationError('');
    setDetectingLocation(true);
    setDetectedLocation(null);

    try {
      const coords = await MapService.getCurrentCoordinates();
      const detailed = await MapService.reverseGeocode(coords.lat, coords.lng);
      setDetectedLocation({
        lat: detailed.latitude || detailed.lat,
        lng: detailed.longitude || detailed.lng,
        address: detailed.formattedAddress || detailed.address,
        detailed,
      });
    } catch (err) {
      console.error('Captain auto-detect error:', err);
      setLocationError(err.message || 'Unable to retrieve your GPS location. Please allow location permissions.');
    } finally {
      setDetectingLocation(false);
    }
  };

  // Live typing debouncer for manual Google Places suggestions
  const handleManualInputChange = (e) => {
    const val = e.target.value;
    setManualAddress(val);
    setLocationError('');

    if (manualDebounceRef.current) {
      clearTimeout(manualDebounceRef.current);
    }

    if (!val.trim()) {
      setManualPredictions([]);
      setManualSearching(false);
      return;
    }

    setManualSearching(true);
    manualDebounceRef.current = setTimeout(async () => {
      try {
        const results = await MapService.getPlacePredictions(val);
        setManualPredictions(results);
      } catch (err) {
        console.error('Captain manual place predictions error:', err);
      } finally {
        setManualSearching(false);
      }
    }, 280);
  };

  // Selecting a suggested location from Google Places
  const handleSelectManualPrediction = async (p) => {
    setManualSearching(true);
    try {
      const fullDetails = await MapService.getPlaceDetails(p.placeId);
      setManualAddress(fullDetails.formattedAddress);
      setDetectedLocation({
        lat: fullDetails.latitude || fullDetails.lat,
        lng: fullDetails.longitude || fullDetails.lng,
        address: fullDetails.formattedAddress,
        detailed: fullDetails,
      });
      setManualPredictions([]);
    } catch (err) {
      console.error('Failed to resolve manual place:', err);
      setLocationError('Could not fetch complete address details for this location.');
    } finally {
      setManualSearching(false);
    }
  };

  const handleSaveLocation = async () => {
    const finalLocation = detectedLocation;
    const finalAddress = finalLocation?.address || manualAddress.trim();

    if (!finalAddress) return;

    setSavedLocation(finalAddress);
    localStorage.setItem('sathiseller_captain_location', finalAddress);

    if (finalLocation?.lat && finalLocation?.lng) {
      try {
        await captainService.updateLocation(finalLocation.lat, finalLocation.lng);
      } catch (e) {
        console.warn('Backend location update notification failed:', e?.message);
      }
    }
    setShowLocationModal(false);
  };

  const openLocationModal = () => {
    setShowLocationModal(true);
    setLocationMode(null);
    setDetectedLocation(null);
    setDetectingLocation(false);
    setLocationError('');
    setManualAddress('');
    setManualPredictions([]);
    setManualSearching(false);
  };

  return (
    <div className="bg-[#f8fafc] font-body-md text-slate-800 min-h-screen pb-24 select-none">
      {/* Spacious, Modern Glass Header */}
      <header className="fixed top-0 left-0 w-full z-40 bg-white/90 backdrop-blur-xl border-b border-slate-100/90 shadow-[0_1px_15px_rgba(0,0,0,0.02)] px-4 py-2.5">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img src="/DeliveryLogo.png" alt="Delivery Logo" className="h-8 object-contain" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-full">
              Captain
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOnlineToggle}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-xs transition-all cursor-pointer border ${
                isOnline
                  ? 'bg-emerald-50 text-[#15803d] border-emerald-200 shadow-2xs'
                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200/70'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isOnline ? 'bg-[#15803d] animate-pulse' : 'bg-slate-400'
                }`}
              />
              <span className="tracking-tight">{isOnline ? 'Online' : 'Offline'}</span>
            </button>

            <button
              onClick={openLocationModal}
              title={savedLocation || 'Set Location'}
              className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-100 flex items-center justify-center text-slate-600 transition-all cursor-pointer relative"
            >
              <span
                className="material-symbols-outlined text-lg"
                style={{ color: savedLocation ? '#15803d' : undefined }}
              >
                location_on
              </span>
              {savedLocation && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#15803d] rounded-full ring-2 ring-white"></span>
              )}
            </button>

            <button
              onClick={() => navigate('/captain/notifications')}
              className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 border border-slate-100 flex items-center justify-center text-slate-600 transition-all cursor-pointer relative"
            >
              <span className="material-symbols-outlined text-lg">notifications</span>
              {unreadNotifCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white animate-ping"></span>
              )}
              {unreadNotifCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white"></span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 🚨 MINIMAL WHITE INCOMING GIG MODAL OVER CONTENT          */}
      {/* (Shows Pickup -> Drop, Distance, Earnings, Reject, Accept) */}
      {/* ────────────────────────────────────────────────────────── */}
      <IncomingGigModal
        job={incomingJob}
        onAccept={handleAcceptJob}
        onReject={handleRejectJob}
        onClose={() => handleDismissModal(incomingJob)}
        actionLoading={actionLoading}
      />

      {/* Location Modal */}
      {showLocationModal && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowLocationModal(false);
          }}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 pb-8 sm:pb-5 max-h-[85dvh] flex flex-col"
            style={{ animation: 'slideUpModal 0.28s cubic-bezier(.4,0,.2,1)' }}
          >
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4 sm:hidden shrink-0"></div>
            <div className="flex items-center justify-between mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-50 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#366b00] text-base">location_on</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-800 m-0">Set Your Location</h3>
                  <span className="text-[10px] font-semibold text-slate-400">Powered by Google Maps</span>
                </div>
              </div>
              <button
                onClick={() => setShowLocationModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 transition-colors cursor-pointer border-none bg-transparent"
              >
                <span className="material-symbols-outlined text-base text-slate-500">close</span>
              </button>
            </div>

            <div className="space-y-3 mb-4 overflow-y-auto flex-1 [&::-webkit-scrollbar]:hidden pr-0.5">
              {/* Option 1: Detect Automatically */}
              <button
                type="button"
                onClick={handleAutoDetect}
                className={`w-full flex items-start gap-3 p-3.5 rounded-2xl border-2 transition-all cursor-pointer text-left ${
                  locationMode === 'auto'
                    ? 'border-[#366b00] bg-emerald-50/50'
                    : 'border-slate-200 bg-slate-50 hover:border-emerald-300'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100/60 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[#366b00] text-xl">my_location</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-xs text-slate-800 m-0">Detect Location Automatically</p>
                  <p className="text-[10.5px] text-slate-500 mt-0.5 leading-snug">
                    Use device GPS + Google Geocoding
                  </p>
                  {locationMode === 'auto' && detectingLocation && (
                    <p className="text-[10.5px] text-[#366b00] mt-1.5 font-semibold animate-pulse">
                      Detecting exact location…
                    </p>
                  )}
                  {locationMode === 'auto' && detectedLocation && !detectingLocation && (
                    <div className="mt-2 p-2 bg-white rounded-lg border border-emerald-200">
                      <p className="text-[11px] text-slate-800 font-bold leading-snug m-0">
                        📍 {detectedLocation.address}
                      </p>
                      {detectedLocation.lat && detectedLocation.lng && (
                        <p className="text-[9.5px] text-emerald-700 font-mono font-semibold mt-1 m-0">
                          Coords: {detectedLocation.lat.toFixed(4)}, {detectedLocation.lng.toFixed(4)}
                        </p>
                      )}
                    </div>
                  )}
                  {locationMode === 'auto' && locationError && (
                    <p className="text-[10.5px] text-red-500 mt-1.5 font-semibold">{locationError}</p>
                  )}
                </div>
                {locationMode === 'auto' && !detectingLocation && detectedLocation && (
                  <span className="material-symbols-outlined text-[#366b00] text-base shrink-0">
                    check_circle
                  </span>
                )}
              </button>

              {/* Option 2: Enter Manually with Google Places Search */}
              <div
                onClick={() => {
                  setLocationMode('manual');
                  setLocationError('');
                  setTimeout(() => manualInputRef.current?.focus(), 100);
                }}
                className={`w-full flex flex-col p-3.5 rounded-2xl border-2 transition-all cursor-pointer text-left ${
                  locationMode === 'manual'
                    ? 'border-[#366b00] bg-emerald-50/50'
                    : 'border-slate-200 bg-slate-50 hover:border-emerald-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100/60 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-[#366b00] text-xl">edit_location_alt</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs text-slate-800 m-0">Enter Location Manually</p>
                    <p className="text-[10.5px] text-slate-500 mt-0.5 leading-snug">
                      Search building, street, landmark, or city
                    </p>
                  </div>
                </div>

                {locationMode === 'manual' && (
                  <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
                    <div className="relative flex items-center bg-white border border-slate-300 rounded-xl overflow-hidden focus-within:border-[#366b00]">
                      <input
                        ref={manualInputRef}
                        type="text"
                        value={manualAddress}
                        onChange={handleManualInputChange}
                        placeholder="Search landmark, hub, or address…"
                        className="w-full bg-transparent px-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none"
                      />
                      {manualSearching && (
                        <span className="material-symbols-outlined text-sm text-slate-400 animate-spin pr-2.5">
                          progress_activity
                        </span>
                      )}
                    </div>

                    {/* Predictions list */}
                    {manualPredictions.length > 0 && (
                      <div className="bg-white border border-slate-200 rounded-xl max-h-36 overflow-y-auto divide-y divide-slate-100 shadow-sm">
                        {manualPredictions.map((p) => (
                          <div
                            key={p.placeId}
                            onClick={() => handleSelectManualPrediction(p)}
                            className="p-2 hover:bg-slate-50 cursor-pointer flex items-center gap-2 text-left"
                          >
                            <span className="material-symbols-outlined text-xs text-slate-400">location_on</span>
                            <div className="min-w-0 flex-1">
                              <span className="text-[11px] font-bold text-slate-800 block truncate">{p.mainText}</span>
                              <span className="text-[9.5px] text-slate-500 block truncate">{p.secondaryText}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Selected manual address preview */}
                    {detectedLocation && locationMode === 'manual' && manualPredictions.length === 0 && (
                      <div className="p-2 bg-white rounded-lg border border-emerald-200">
                        <p className="text-[11px] text-slate-800 font-bold leading-snug m-0">
                          📍 {detectedLocation.address}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleSaveLocation}
              disabled={
                !locationMode ||
                (locationMode === 'auto' && (!detectedLocation || detectingLocation)) ||
                (locationMode === 'manual' && !manualAddress.trim())
              }
              className="w-full py-3 bg-[#366b00] text-white font-bold text-sm rounded-xl transition-all hover:bg-[#2d5800] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 border-none"
            >
              Confirm Location
            </button>
          </div>
        </div>
      )}

      {/* Spacious Main Container */}
      <main className="pt-18 md:pt-20 px-4 max-w-2xl mx-auto space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="material-symbols-outlined text-5xl text-[#15803d] animate-spin">sync</span>
            <p className="text-sm text-slate-500 font-semibold">Loading dashboard…</p>
          </div>
        ) : (
          <>
            {/* Unified Spacious Partner Financial Card */}
            <section className="bg-white rounded-2xl p-4 md:p-5 border border-slate-100 shadow-[0_4px_25px_rgba(0,0,0,0.03)] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Today's Net Earnings</p>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-[#15803d] font-bold text-lg">₹</span>
                    <span className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight leading-none">
                      {stats.todayEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Temporarily commented out: Captain Membership Plans
                  <button
                    onClick={() => navigate('/captain/membership')}
                    className="px-3 py-1.5 rounded-full bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-sky-100"
                  >
                    <span className="material-symbols-outlined text-sm">workspace_premium</span>
                    <span>Plans</span>
                  </button>
                  */}
                  <button
                    onClick={() => navigate('/captain/wallet')}
                    className="px-3.5 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100/80 text-[#15803d] text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">account_balance_wallet</span>
                    <span>Wallet</span>
                    <span className="material-symbols-outlined text-xs">chevron_right</span>
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 grid grid-cols-3 divide-x divide-slate-100 text-center">
                <div className="px-2">
                  <p className="text-base md:text-lg font-black text-slate-800 leading-none">{stats.totalBookings}</p>
                  <p className="text-[10px] font-semibold text-slate-400 mt-1">Lifetime Bookings</p>
                </div>
                <div className="px-2">
                  <p className="text-base md:text-lg font-black text-slate-800 leading-none">{stats.deliveredToday}</p>
                  <p className="text-[10px] font-semibold text-slate-400 mt-1">Delivered Today</p>
                </div>
                <div className="px-2">
                  <p className="text-base md:text-lg font-black text-[#15803d] leading-none">
                    {String(stats.pendingCount).padStart(2, '0')}
                  </p>
                  <p className="text-[10px] font-semibold text-slate-400 mt-1">Pending Tasks</p>
                </div>
              </div>
            </section>

            {/* Weekly Activity & Earnings Chart */}
            {weeklyEarnings.length > 0 && (
              <section className="bg-white p-4 rounded-2xl border border-slate-100 shadow-[0_4px_25px_rgba(0,0,0,0.03)] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-50 text-[#15803d] flex items-center justify-center">
                      <span className="material-symbols-outlined text-sm font-bold">bar_chart</span>
                    </div>
                    <span className="text-xs font-bold text-slate-800 tracking-tight">Weekly Activity</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400">
                    7-Day Total: <span className="font-black text-[#15803d]">₹{weeklyEarnings.reduce((acc, curr) => acc + (curr.value || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </span>
                </div>

                <div className="grid grid-cols-7 gap-2 pt-1">
                  {weeklyEarnings.map((d) => {
                    const isSelected = activeDay === d.day;
                    const hasEarnings = d.value > 0;
                    return (
                      <button
                        key={d.day}
                        onClick={() => setActiveDay(d.day)}
                        className={`flex flex-col items-center gap-1.5 p-1 rounded-xl transition-all cursor-pointer ${
                          isSelected ? 'bg-emerald-50/80 ring-1 ring-[#15803d]/30' : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* Bar Track & Fill */}
                        <div className="w-full h-13 bg-slate-100 rounded-lg flex flex-col justify-end p-0.5 overflow-hidden">
                          <div
                            className={`w-full rounded-md transition-all duration-300 ${
                              isSelected
                                ? 'bg-[#15803d]'
                                : hasEarnings
                                ? 'bg-emerald-500'
                                : d.current
                                ? 'bg-emerald-300'
                                : 'bg-slate-200'
                            }`}
                            style={{ height: `${d.fillPercent || 10}%` }}
                          />
                        </div>
                        {/* Day Label */}
                        <span
                          className={`text-[10px] font-bold leading-none ${
                            isSelected
                              ? 'text-[#15803d] font-black'
                              : d.current
                              ? 'text-slate-800 font-bold'
                              : 'text-slate-400'
                          }`}
                        >
                          {d.day}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Day Footer */}
                {activeDay && weeklyEarnings.find((d) => d.day === activeDay) && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <span className="text-slate-500 font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#15803d]"></span>
                      <span>{activeDay} Earnings</span>
                    </span>
                    <span className="font-black text-[#15803d]">
                      ₹{(weeklyEarnings.find((d) => d.day === activeDay)?.value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
              </section>
            )}

            {/* Active Service Areas Utility Card */}
            <section
              onClick={() => navigate('/captain/service-areas')}
              className="bg-white rounded-2xl p-3.5 flex items-center gap-3.5 border border-slate-100 shadow-[0_4px_25px_rgba(0,0,0,0.03)] cursor-pointer hover:border-emerald-200 hover:shadow-md transition-all active:scale-[0.99]"
            >
              <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-50 text-[#15803d] flex items-center justify-center">
                <span className="material-symbols-outlined text-xl font-bold">radar</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-xs text-slate-800 leading-tight">Service Coverage Area</p>
                {savedLocation ? (
                  <p className="text-[11px] text-[#15803d] font-medium mt-0.5 leading-snug truncate flex items-center gap-1">
                    <span>📍 {savedLocation}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Tap to view active sellers in your range
                  </p>
                )}
              </div>
              <span className="material-symbols-outlined text-slate-400 text-lg shrink-0">chevron_right</span>
            </section>

            {/* ────────────────────────────────────────────────────────── */}
            {/* TODAY'S PENDING & IN-PROCESS ORDERS / TASKS SECTION       */}
            {/* ────────────────────────────────────────────────────────── */}
            {!savedLocation && (
              <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                <span className="material-symbols-outlined text-amber-600 text-xl">location_off</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-amber-900 m-0">Set your location to see nearby requests</p>
                  <p className="text-[11px] text-amber-800/80 mt-0.5 m-0">
                    Pending jobs are hidden until you enable GPS or pick a service area.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowLocationModal(true)}
                    className="mt-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg border-none cursor-pointer"
                  >
                    Set Location
                  </button>
                </div>
              </section>
            )}
            {savedLocation && (() => {
              const inProgressOrders = pendingOrders.filter((o) =>
                ['Accepted', 'At Pickup', 'Picked Up', 'In Transit'].includes(o.captainStatus)
              );
              const assignedPending = pendingOrders.filter((o) => o.captainStatus === 'Assigned');
              const activeCount = (activeTransport ? 1 : 0) + inProgressOrders.length;
              const totalCount = activeCount + assignedPending.length + transportRequests.length + returnPickups.length;

              // Build prioritized list of all matching items based on current taskFilter
              const allMatchingTasks = [];
              if (activeTransport && (taskFilter === 'all' || taskFilter === 'active' || taskFilter === 'requests')) {
                allMatchingTasks.push({ type: 'activeTransport', data: activeTransport });
              }
              if (taskFilter === 'all' || taskFilter === 'active') {
                inProgressOrders.forEach((order) => allMatchingTasks.push({ type: 'inProgressOrder', data: order }));
              }
              if (taskFilter === 'all' || taskFilter === 'assigned') {
                assignedPending.forEach((order) => allMatchingTasks.push({ type: 'assignedPending', data: order }));
              }
              if (taskFilter === 'all' || taskFilter === 'requests') {
                transportRequests.forEach((req) => allMatchingTasks.push({ type: 'transportRequest', data: req }));
              }
              if (taskFilter === 'all' || taskFilter === 'returns') {
                returnPickups.forEach((ret) => allMatchingTasks.push({ type: 'returnPickup', data: ret }));
              }

              // Show ONLY 3 order cards on this dashboard page as requested
              const visibleTasks = allMatchingTasks.slice(0, 3);

              return (
                <section className="space-y-3 pt-1">
                  {/* Clean & Simple Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-sm text-slate-900 tracking-tight">
                        Today's Pending Orders
                      </h2>
                      {totalCount > 0 && (
                        <span className="px-2 py-0.5 bg-emerald-50 text-[#15803d] border border-emerald-200/60 text-[10px] font-black rounded-full">
                          {totalCount}
                        </span>
                      )}
                    </div>
                    {totalCount > 0 && (
                      <button
                        onClick={() => navigate('/captain/jobs')}
                        className="text-xs text-[#15803d] font-bold flex items-center gap-0.5 hover:underline cursor-pointer"
                      >
                        View All
                        <span className="material-symbols-outlined text-sm">chevron_right</span>
                      </button>
                    )}
                  </div>

                  {/* Filter Pills */}
                  {totalCount > 0 && (
                    <div className="flex gap-2 overflow-x-auto hide-scrollbar py-0.5">
                      <button
                        onClick={() => setTaskFilter('all')}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                          taskFilter === 'all'
                            ? 'bg-[#15803d] text-white shadow-2xs'
                            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                        }`}
                      >
                        All ({totalCount})
                      </button>
                      {activeCount > 0 && (
                        <button
                          onClick={() => setTaskFilter('active')}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                            taskFilter === 'active'
                              ? 'bg-[#15803d] text-white shadow-2xs'
                              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          In Process ({activeCount})
                        </button>
                      )}
                      {assignedPending.length > 0 && (
                        <button
                          onClick={() => setTaskFilter('assigned')}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                            taskFilter === 'assigned'
                              ? 'bg-[#15803d] text-white shadow-2xs'
                              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                          }`}
                        >
                          Pending ({assignedPending.length})
                        </button>
                      )}
                      {transportRequests.length > 0 && (
                        <button
                          onClick={() => setTaskFilter('requests')}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                            taskFilter === 'requests'
                              ? 'bg-[#15803d] text-white shadow-2xs'
                              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                          }`}
                        >
                          Requests ({transportRequests.length})
                        </button>
                      )}
                      {returnPickups.length > 0 && (
                        <button
                          onClick={() => setTaskFilter('returns')}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                            taskFilter === 'returns'
                              ? 'bg-[#ea580c] text-white shadow-2xs'
                              : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                          }`}
                        >
                          Returns ({returnPickups.length})
                        </button>
                      )}
                    </div>
                  )}

                  {/* Empty State */}
                  {totalCount === 0 ? (
                    <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-2xs flex flex-col items-center gap-2.5 text-center">
                      <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#15803d] flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl font-bold">check_circle</span>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-800">All Orders Completed</p>
                        <p className="text-[11px] text-slate-400">
                          You have no pending or in-process orders right now.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {visibleTasks.map((item) => {
                        if (item.type === 'activeTransport') {
                          const activeTransport = item.data;
                          return (
                            <div
                              key={activeTransport._id || activeTransport.bookingId}
                              className="bg-white p-3.5 sm:p-4 rounded-xl border border-emerald-200/80 shadow-2xs hover:shadow-md transition-all space-y-2.5 overflow-hidden"
                            >
                              {/* Top Row: ID & Earnings */}
                              <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                                  <span className="font-mono text-xs font-bold text-slate-800 truncate">
                                    #{activeTransport.bookingId}
                                  </span>
                                </div>
                                <span className="text-sm sm:text-base font-black text-[#15803d] shrink-0">
                                  ₹{(activeTransport.captainEarnings || 0).toFixed(2)}
                                </span>
                              </div>

                              {/* Sub-Header: Badges */}
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 shrink-0 flex items-center gap-1">
                                    <span>🚚</span> Transport
                                  </span>
                                  {(() => {
                                    const badge = getTransportStatusBadge(activeTransport.status);
                                    return (
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${badge.bg}`}>
                                        {badge.label}
                                      </span>
                                    );
                                  })()}
                                </div>
                                <span className="text-xs font-medium text-slate-500 truncate">
                                  {activeTransport.goods?.category} • {activeTransport.goods?.weightKg}kg
                                </span>
                              </div>

                              {/* Route Timeline */}
                              <div className="bg-slate-50/80 p-2.5 sm:p-3 rounded-lg border border-slate-100 text-xs space-y-2">
                                <div className="flex items-start gap-2">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0"></span>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-[8px] font-bold text-emerald-700 uppercase tracking-wider block">Pickup</span>
                                    <p className="font-semibold text-slate-800 text-xs leading-tight line-clamp-1">
                                      {(typeof activeTransport.pickupLocation === 'string' ? activeTransport.pickupLocation : activeTransport.pickupLocation?.address) || 'Pickup Location'}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="w-2 h-2 rounded-full bg-orange-500 mt-1 shrink-0"></span>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-[8px] font-bold text-orange-700 uppercase tracking-wider block">Drop</span>
                                    <p className="font-semibold text-slate-800 text-xs leading-tight line-clamp-1">
                                      {(typeof activeTransport.dropLocation === 'string' ? activeTransport.dropLocation : activeTransport.dropLocation?.address) || 'Drop Destination'}
                                    </p>
                                  </div>
                                </div>
                                {activeTransport.distanceKm && (
                                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1.5 border-t border-slate-200/50">
                                    <span>📍 {activeTransport.distanceKm} km</span>
                                    <span>📦 {activeTransport.goods?.packages || 1} package(s)</span>
                                    <span>💳 {activeTransport.paymentMethod || 'CASH'}</span>
                                  </div>
                                )}
                              </div>

                              {/* Action Buttons: View Details & Start Ride */}
                              <div className="flex items-center gap-2 pt-0.5">
                                <button
                                  onClick={() => setSelectedDetailTask({ ...activeTransport, isTransport: true })}
                                  className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 text-slate-700 font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                >
                                  <span className="material-symbols-outlined text-base">info</span>
                                  <span>View Details</span>
                                </button>
                                <button
                                  onClick={() => navigate(`/captain/active-delivery?type=transport&bookingId=${activeTransport.bookingId || activeTransport._id}`)}
                                  className="flex-1 py-2 bg-[#15803d] hover:bg-[#166534] text-white font-bold text-xs rounded-lg shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98]"
                                >
                                  <span className="material-symbols-outlined text-base">navigation</span>
                                  <span>Start Ride</span>
                                  <span className="material-symbols-outlined text-base">chevron_right</span>
                                </button>
                              </div>
                            </div>
                          );
                        }

                        if (item.type === 'inProgressOrder') {
                          const order = item.data;
                          const badge = getDeliveryStatusBadge(order.captainStatus);
                          return (
                            <div
                              key={order._id}
                              className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all space-y-2.5 overflow-hidden"
                            >
                              <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shrink-0"></span>
                                  <span className="font-mono text-xs font-bold text-slate-800 truncate">
                                    #{order.orderId}
                                  </span>
                                </div>
                                <span className="text-sm sm:text-base font-black text-[#15803d] shrink-0">
                                  ₹{(order.captainEarnings || 0).toFixed(2)}
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 shrink-0 flex items-center gap-1">
                                    <span>📦</span> Delivery
                                  </span>
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${badge.bg}`}>
                                    {badge.label}
                                  </span>
                                </div>
                                <span className="text-xs font-medium text-slate-500 truncate">
                                  {order.items?.length || 1} Item(s)
                                </span>
                              </div>

                              <div className="bg-slate-50/80 p-2.5 sm:p-3 rounded-lg border border-slate-100 text-xs space-y-1.5">
                                <div className="flex items-start gap-2">
                                  <span className="w-2 h-2 rounded-full bg-orange-500 mt-1 shrink-0"></span>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-[8px] font-bold text-orange-700 uppercase tracking-wider block">Drop Address</span>
                                    <p className="font-semibold text-slate-800 text-xs leading-tight line-clamp-1">
                                      {order.shippingAddress?.addressLine1}
                                      {order.shippingAddress?.city ? `, ${order.shippingAddress?.city}` : ''}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1.5 border-t border-slate-200/50">
                                  <span className="truncate">
                                    👤 {order.user?.name || order.shippingAddress?.fullName || 'Customer'}
                                  </span>
                                  {order.deliverySlot?.time && (
                                    <span className="font-semibold text-slate-700 shrink-0">{order.deliverySlot.time}</span>
                                  )}
                                </div>
                              </div>

                              {/* Action Buttons: View Details & Start Ride */}
                              <div className="flex items-center gap-2 pt-0.5">
                                <button
                                  onClick={() => setSelectedDetailTask(order)}
                                  className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 text-slate-700 font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                >
                                  <span className="material-symbols-outlined text-base">info</span>
                                  <span>View Details</span>
                                </button>
                                <button
                                  onClick={() => navigate(`/captain/active-delivery?type=order&orderId=${order.orderId || order._id}`)}
                                  className="flex-1 py-2 bg-[#15803d] hover:bg-[#166534] text-white font-bold text-xs rounded-lg shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98]"
                                >
                                  <span className="material-symbols-outlined text-base">navigation</span>
                                  <span>Start Ride</span>
                                  <span className="material-symbols-outlined text-base">chevron_right</span>
                                </button>
                              </div>
                            </div>
                          );
                        }

                        if (item.type === 'assignedPending') {
                          const order = item.data;
                          const isActing = cardActionLoading === order._id;
                          return (
                            <div
                              key={order._id}
                              className="bg-white p-3.5 sm:p-4 rounded-xl border border-purple-200/90 shadow-2xs hover:shadow-md transition-all space-y-2.5 overflow-hidden"
                            >
                              <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0"></span>
                                  <span className="font-mono text-xs font-bold text-slate-800 truncate">
                                    #{order.orderId}
                                  </span>
                                </div>
                                <span className="text-sm sm:text-base font-black text-[#15803d] shrink-0">
                                  ₹{(order.captainEarnings || 0).toFixed(2)}
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 shrink-0 flex items-center gap-1">
                                    <span>📦</span> Delivery
                                  </span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 border border-purple-200 shrink-0">
                                    Assigned
                                  </span>
                                </div>
                                <span className="text-xs font-medium text-slate-500 truncate">
                                  {order.items?.length || 1} Item(s)
                                </span>
                              </div>

                              <div className="bg-slate-50/80 p-2.5 sm:p-3 rounded-lg border border-slate-100 text-xs space-y-1.5">
                                {order.pickupAddress && (
                                  <div className="flex items-start gap-2">
                                    <span className="w-2 h-2 rounded-full bg-violet-500 mt-1 shrink-0"></span>
                                    <div className="flex-1 min-w-0">
                                      <span className="text-[8px] font-bold text-violet-700 uppercase tracking-wider block">Pickup · {order.sellerName || 'Store'}</span>
                                      <p className="font-semibold text-slate-800 text-xs leading-tight line-clamp-1">{order.pickupAddress}</p>
                                    </div>
                                  </div>
                                )}
                                <div className="flex items-start gap-2">
                                  <span className="w-2 h-2 rounded-full bg-purple-500 mt-1 shrink-0"></span>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-[8px] font-bold text-purple-700 uppercase tracking-wider block">Drop Address</span>
                                    <p className="font-semibold text-slate-800 text-xs leading-tight line-clamp-1">
                                      {order.shippingAddress?.addressLine1}
                                      {order.shippingAddress?.city ? `, ${order.shippingAddress?.city}` : ''}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1.5 border-t border-slate-200/50">
                                  <span className="truncate">
                                    👤 {order.user?.name || order.shippingAddress?.fullName || 'Customer'}
                                  </span>
                                  {order.deliverySlot?.time && (
                                    <span className="font-semibold text-slate-700 shrink-0">{order.deliverySlot.time}</span>
                                  )}
                                </div>
                              </div>

                              {/* Action Buttons: View Details & Start Ride */}
                              <div className="flex gap-2 pt-0.5">
                                <button
                                  onClick={() => setSelectedDetailTask(order)}
                                  className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 text-slate-700 font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                >
                                  <span className="material-symbols-outlined text-base">info</span>
                                  <span>View Details</span>
                                </button>
                                <button
                                  onClick={() => handleCardRejectOrder(order)}
                                  disabled={isActing}
                                  className="flex-1 py-2 bg-white hover:bg-red-50 border border-red-200 text-red-600 font-bold text-xs rounded-lg transition-all cursor-pointer disabled:opacity-60"
                                >
                                  Reject
                                </button>
                                <button
                                  onClick={() => handleCardAcceptOrder(order)}
                                  disabled={isActing}
                                  className="flex-1 py-2 bg-[#15803d] hover:bg-[#166534] text-white font-bold text-xs rounded-lg shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-60"
                                >
                                  {isActing ? 'Accepting…' : 'Accept'}
                                </button>
                              </div>
                            </div>
                          );
                        }

                        if (item.type === 'transportRequest') {
                          const req = item.data;
                          const isActing = cardActionLoading === req._id;
                          return (
                            <div
                              key={req._id}
                              className="bg-white p-3.5 sm:p-4 rounded-xl border border-amber-200/90 shadow-2xs hover:shadow-md transition-all space-y-2.5 overflow-hidden"
                            >
                              <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                                  <span className="font-mono text-xs font-bold text-slate-800 truncate">
                                    #{req.bookingId}
                                  </span>
                                </div>
                                <span className="text-sm sm:text-base font-black text-[#15803d] shrink-0">
                                  ₹{(req.captainEarnings || 0).toFixed(2)}
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 shrink-0 flex items-center gap-1">
                                    <span>🚚</span> Transport
                                  </span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                                    Ride Request
                                  </span>
                                </div>
                                <span className="text-xs font-medium text-slate-500 truncate">
                                  {req.goods?.category} • {req.goods?.weightKg}kg
                                </span>
                              </div>

                              <div className="bg-slate-50/80 p-2.5 sm:p-3 rounded-lg border border-slate-100 text-xs space-y-2">
                                <div className="flex items-start gap-2">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0"></span>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-[8px] font-bold text-emerald-700 uppercase tracking-wider block">Pickup</span>
                                    <p className="font-semibold text-slate-800 text-xs leading-tight line-clamp-1">
                                      {(typeof req.pickupLocation === 'string' ? req.pickupLocation : req.pickupLocation?.address) || 'Pickup Location'}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="w-2 h-2 rounded-full bg-orange-500 mt-1 shrink-0"></span>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-[8px] font-bold text-orange-700 uppercase tracking-wider block">Drop</span>
                                    <p className="font-semibold text-slate-800 text-xs leading-tight line-clamp-1">
                                      {(typeof req.dropLocation === 'string' ? req.dropLocation : req.dropLocation?.address) || 'Drop Destination'}
                                    </p>
                                  </div>
                                </div>
                                {req.distanceKm && (
                                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1.5 border-t border-slate-200/50">
                                    <span>📍 {req.distanceKm} km</span>
                                    <span>📦 {req.goods?.packages || 1} pkg(s)</span>
                                    <span>⚡ Request ready</span>
                                  </div>
                                )}
                              </div>

                              {/* Action Buttons: View Details & Accept Request (Clean text without icons) */}
                              <div className="flex gap-2 pt-0.5">
                                <button
                                  onClick={() => setSelectedDetailTask({ ...req, isTransport: true })}
                                  className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 text-slate-700 font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center"
                                >
                                  View Details
                                </button>
                                <button
                                  onClick={() => handleCardAcceptTransport(req)}
                                  disabled={isActing}
                                  className="flex-1 py-2 bg-[#15803d] hover:bg-[#166534] text-white font-bold text-xs rounded-lg shadow-2xs transition-all cursor-pointer flex items-center justify-center disabled:opacity-60"
                                >
                                  {isActing ? 'Claiming…' : 'Accept Request'}
                                </button>
                              </div>
                            </div>
                          );
                        }

                        if (item.type === 'returnPickup') {
                          const ret = item.data;
                          const isActing = cardActionLoading === ret._id;
                          const isAssignedToMe = ret.status === 'CAPTAIN_ASSIGNED' || ['PICKUP_STARTED', 'PICKUP_ARRIVED', 'PICKED_UP', 'IN_TRANSIT_TO_SELLER'].includes(ret.status);
                          return (
                            <div
                              key={ret._id || ret.returnId}
                              className="bg-white p-3.5 sm:p-4 rounded-xl border border-orange-200/90 shadow-2xs hover:shadow-md transition-all space-y-2.5 overflow-hidden"
                            >
                              <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse shrink-0"></span>
                                  <span className="font-mono text-xs font-bold text-slate-800 truncate">
                                    #{ret.returnId}
                                  </span>
                                </div>
                                <span className="text-sm sm:text-base font-black text-[#15803d] shrink-0">
                                  ₹{(ret.captainEarnings || 40).toFixed(2)}
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-2 text-xs">
                                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-50 text-[#ea580c] border border-orange-200 shrink-0 flex items-center gap-1">
                                    <span>↩️</span> Return Pickup
                                  </span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                                    {isAssignedToMe ? 'Assigned' : 'Available'}
                                  </span>
                                </div>
                                <span className="text-xs font-medium text-slate-500 truncate">
                                  📦 {ret.productName} (×{ret.quantity || 1})
                                </span>
                              </div>

                              <div className="bg-slate-50/80 p-2.5 sm:p-3 rounded-lg border border-slate-100 text-xs space-y-2">
                                <div className="flex items-start gap-2">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0"></span>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-[8px] font-bold text-emerald-700 uppercase tracking-wider block">Pickup From (Customer)</span>
                                    <p className="font-semibold text-slate-800 text-xs leading-tight line-clamp-1">
                                      {ret.customerAddress?.addressLine1 || ret.customerAddress?.city || 'Customer Address'}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="w-2 h-2 rounded-full bg-orange-500 mt-1 shrink-0"></span>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-[8px] font-bold text-orange-700 uppercase tracking-wider block">Deliver To (Seller)</span>
                                    <p className="font-semibold text-slate-800 text-xs leading-tight line-clamp-1">
                                      {ret.sellerName || 'Sathi Seller Store'} ({ret.sellerAddress?.city || 'Warehouse'})
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="flex gap-2 pt-0.5">
                                <button
                                  onClick={() => setSelectedDetailTask({
                                    ...ret,
                                    orderId: ret.returnId,
                                    shippingAddress: ret.customerAddress,
                                  })}
                                  className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 text-slate-700 font-bold text-xs rounded-lg transition-all cursor-pointer flex items-center justify-center"
                                >
                                  Details
                                </button>
                                {isAssignedToMe ? (
                                  <button
                                    onClick={() => navigate(`/captain/active-delivery?type=return&returnId=${ret._id || ret.returnId}`)}
                                    className="flex-1 py-2 bg-[#15803d] hover:bg-[#166534] text-white font-bold text-xs rounded-lg shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1"
                                  >
                                    <span>Continue</span>
                                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleCardAcceptReturn(ret)}
                                    disabled={isActing}
                                    className="flex-1 py-2 bg-[#ea580c] hover:bg-[#c2410c] text-white font-bold text-xs rounded-lg shadow-2xs transition-all cursor-pointer flex items-center justify-center disabled:opacity-60"
                                  >
                                    {isActing ? 'Accepting…' : 'Accept Pickup'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        }

                        return null;
                      })}

                      {/* View All Button if more than 3 */}
                      {allMatchingTasks.length > 3 && (
                        <button
                          onClick={() => navigate('/captain/jobs')}
                          className="w-full py-2.5 bg-white hover:bg-slate-50 border border-slate-200/90 text-[#15803d] font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <span>View All ({allMatchingTasks.length}) Orders</span>
                          <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </button>
                      )}
                    </div>
                  )}
                </section>
              );
            })()}
          </>
        )}
      </main>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 📋 VIEW DETAILS MODAL (Sticky Frame, Scroll Lock & Minimized Radius) */}
      {/* ────────────────────────────────────────────────────────── */}
      {selectedDetailTask && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-hidden touch-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedDetailTask(null);
          }}
        >
          <div
            className="w-full sm:max-w-lg bg-white rounded-xl shadow-2xl flex flex-col max-h-[86vh] overflow-hidden border border-slate-100"
            style={{ animation: 'slideUpModal 0.28s cubic-bezier(.4,0,.2,1)' }}
          >
            {/* Sticky Top Header */}
            <div className="sticky top-0 z-10 bg-white px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black text-slate-900">
                  #{selectedDetailTask.bookingId || selectedDetailTask.orderId}
                </span>
                {selectedDetailTask.isTransport ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                    <span>🚚</span> Transport
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1">
                    <span>📦</span> Delivery
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedDetailTask(null)}
                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer transition-colors"
                title="Close"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {/* Scrollable Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 overscroll-contain">
              {/* Earnings Banner */}
              <div className="bg-emerald-50/90 p-3 rounded-lg border border-emerald-200/90 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Captain Payout</p>
                  <p className="text-xl font-black text-[#15803d]">
                    ₹{(selectedDetailTask.captainEarnings || selectedDetailTask.estimatedEarnings || 0).toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white text-emerald-800 border border-emerald-200 block mb-0.5">
                    {selectedDetailTask.paymentMethod || 'CASH'} • {selectedDetailTask.paymentStatus || 'Pending'}
                  </span>
                  <span className="text-[9px] text-emerald-700 font-medium">Guaranteed Earnings</span>
                </div>
              </div>

              {/* Customer & Contact Details Card */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-[#15803d]">person</span>
                    <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">Customer Contact Details</span>
                  </div>
                  {(() => {
                    const phone =
                      selectedDetailTask.customerPhone ||
                      selectedDetailTask.user?.phone ||
                      selectedDetailTask.shippingAddress?.phone;
                    return phone ? (
                      <a
                        href={`tel:${phone}`}
                        className="px-2.5 py-1 rounded-md bg-[#15803d] hover:bg-[#166534] text-white text-[11px] font-bold flex items-center gap-1 transition-colors shadow-2xs"
                      >
                        <span className="material-symbols-outlined text-xs">call</span>
                        <span>Call Customer</span>
                      </a>
                    ) : null;
                  })()}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Customer Name</span>
                    <p className="font-bold text-slate-800 text-xs mt-0.5">
                      {selectedDetailTask.customerName ||
                        selectedDetailTask.user?.name ||
                        selectedDetailTask.shippingAddress?.fullName ||
                        'Customer'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Contact Number</span>
                    {(() => {
                      const phone =
                        selectedDetailTask.customerPhone ||
                        selectedDetailTask.user?.phone ||
                        selectedDetailTask.shippingAddress?.phone;
                      return phone ? (
                        <a href={`tel:${phone}`} className="font-bold text-[#15803d] text-xs mt-0.5 hover:underline flex items-center gap-0.5">
                          <span>📞 {phone}</span>
                        </a>
                      ) : (
                        <p className="text-slate-400 font-medium text-xs mt-0.5">Not provided</p>
                      );
                    })()}
                  </div>

                  {(selectedDetailTask.customerEmail || selectedDetailTask.user?.email || selectedDetailTask.shippingAddress?.email) && (
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Email Address</span>
                      <p className="font-semibold text-slate-700 text-xs mt-0.5 truncate">
                        {selectedDetailTask.customerEmail || selectedDetailTask.user?.email || selectedDetailTask.shippingAddress?.email}
                      </p>
                    </div>
                  )}

                  {selectedDetailTask.shippingAddress?.altPhone && (
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Alternate Phone</span>
                      <a href={`tel:${selectedDetailTask.shippingAddress.altPhone}`} className="font-bold text-slate-700 text-xs mt-0.5 hover:underline">
                        📞 {selectedDetailTask.shippingAddress.altPhone}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Route Timeline */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 text-xs space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0"></span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Pickup Location</span>
                    <p className="font-bold text-slate-900 text-xs mt-0.5">
                      {selectedDetailTask.pickupLocation?.address || 'Seller / Store Location'}
                    </p>
                    {selectedDetailTask.pickupLocation?.landmark && (
                      <p className="text-[10px] text-slate-500">Landmark: {selectedDetailTask.pickupLocation.landmark}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 mt-1 shrink-0"></span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Drop Location</span>
                    <p className="font-bold text-slate-900 text-xs mt-0.5">
                      {selectedDetailTask.dropLocation?.address ||
                        selectedDetailTask.shippingAddress?.addressLine1 ||
                        selectedDetailTask.shippingAddress?.city ||
                        'Customer Address'}
                    </p>
                    {selectedDetailTask.shippingAddress?.addressLine2 && (
                      <p className="text-[10px] text-slate-500">{selectedDetailTask.shippingAddress.addressLine2}</p>
                    )}
                    {selectedDetailTask.dropLocation?.landmark && (
                      <p className="text-[10px] text-slate-500">Landmark: {selectedDetailTask.dropLocation.landmark}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Cargo / Items & Distance Specifications */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Items / Cargo</span>
                  <p className="font-bold text-slate-800 text-xs mt-0.5 truncate">
                    {selectedDetailTask.goods?.category || `${selectedDetailTask.items?.length || 1} Item(s)`}
                  </p>
                  {selectedDetailTask.goods?.packages && (
                    <p className="text-[10px] text-slate-500">{selectedDetailTask.goods.packages} package(s)</p>
                  )}
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Weight & Distance</span>
                  <p className="font-bold text-slate-800 text-xs mt-0.5">
                    {selectedDetailTask.goods?.weightKg ? `${selectedDetailTask.goods.weightKg} kg` : 'Standard Weight'}{' '}
                    {selectedDetailTask.distanceKm ? `• 📍 ${selectedDetailTask.distanceKm} km` : ''}
                  </p>
                  {selectedDetailTask.deliverySlot?.time && (
                    <p className="text-[10px] text-slate-500">Slot: {selectedDetailTask.deliverySlot.time}</p>
                  )}
                </div>
              </div>

              {/* Special Instructions (if any) */}
              {(selectedDetailTask.deliveryInstructions || selectedDetailTask.goods?.instructions) && (
                <div className="bg-amber-50/70 p-2.5 rounded-lg border border-amber-200/80 text-xs">
                  <span className="text-[9px] font-bold text-amber-800 uppercase tracking-wider block">Delivery Instructions</span>
                  <p className="text-[11px] text-amber-900 font-medium mt-0.5">
                    {selectedDetailTask.deliveryInstructions || selectedDetailTask.goods?.instructions}
                  </p>
                </div>
              )}
            </div>

            {/* Sticky Bottom Action Buttons */}
            <div className="sticky bottom-0 z-10 bg-white px-4 py-3 border-t border-slate-100 flex gap-2 shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
              <button
                onClick={() => setSelectedDetailTask(null)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const isTrp = selectedDetailTask?.isTransport || selectedDetailTask?.bookingId;
                  const targetUrl = isTrp
                    ? `/captain/active-delivery?type=transport&bookingId=${selectedDetailTask.bookingId || selectedDetailTask._id}`
                    : `/captain/active-delivery?type=order&orderId=${selectedDetailTask.orderId || selectedDetailTask._id}`;
                  setSelectedDetailTask(null);
                  navigate(targetUrl);
                }}
                className="flex-2 py-2 bg-[#15803d] hover:bg-[#166534] text-white font-bold text-xs rounded-lg shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98]"
              >
                <span className="material-symbols-outlined text-base">navigation</span>
                <span>Start Ride</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes modalSlideUp {
          from { transform: translateY(30px) scale(0.96); opacity: 0; }
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes slideUpModal {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <CaptainBottomNav />
    </div>
  );
};

export default CaptainDashboard;
