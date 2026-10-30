import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { transportService } from '../../../services/transportService';
import { captainService } from '../../../services/authService';

const LogisticsNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const requestedType = searchParams.get('type') || location.state?.type; // 'order' | 'transport'
  const requestedOrderId = searchParams.get('orderId') || location.state?.orderId;
  const requestedBookingId = searchParams.get('bookingId') || location.state?.bookingId;

  const [activeItem, setActiveItem] = useState(null);
  const [isTransport, setIsTransport] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchActiveMission = useCallback(async () => {
    setLoading(true);
    try {
      if (requestedType === 'order' || requestedOrderId) {
        const orderRes = await captainService.getActiveDelivery();
        if (orderRes.success && orderRes.order) {
          setActiveItem(orderRes.order);
          setIsTransport(false);
        } else {
          setActiveItem(null);
        }
        setLoading(false);
        return;
      }

      if (requestedType === 'transport' || requestedBookingId) {
        const transportRes = await transportService.captainGetActiveRide();
        if (transportRes.success && transportRes.booking) {
          setActiveItem(transportRes.booking);
          setIsTransport(true);
        } else {
          setActiveItem(null);
        }
        setLoading(false);
        return;
      }

      // Check both concurrently
      const [orderRes, transportRes] = await Promise.allSettled([
        captainService.getActiveDelivery(),
        transportService.captainGetActiveRide(),
      ]);

      const foundOrder = orderRes.status === 'fulfilled' && orderRes.value?.success ? orderRes.value.order : null;
      const foundTransport = transportRes.status === 'fulfilled' && transportRes.value?.success ? transportRes.value.booking : null;

      if (foundOrder && !foundTransport) {
        setActiveItem(foundOrder);
        setIsTransport(false);
      } else if (foundTransport && !foundOrder) {
        setActiveItem(foundTransport);
        setIsTransport(true);
      } else if (foundOrder && foundTransport) {
        setActiveItem(foundOrder);
        setIsTransport(false);
      } else {
        setActiveItem(null);
      }
    } catch (err) {
      console.error('Fetch navigation mission error:', err);
      setActiveItem(null);
    } finally {
      setLoading(false);
    }
  }, [requestedType, requestedOrderId, requestedBookingId]);

  useEffect(() => {
    fetchActiveMission();
  }, [fetchActiveMission]);

  if (loading) {
    return (
      <div className="bg-[#002625] min-h-screen flex flex-col items-center justify-center gap-3 text-white">
        <span className="material-symbols-outlined text-4xl text-[#97fc43] animate-spin">sync</span>
        <p className="text-xs font-bold text-slate-300">Loading Navigation Telemetry…</p>
      </div>
    );
  }

  if (!activeItem) {
    return (
      <div className="bg-slate-50 min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
          <span className="material-symbols-outlined text-3xl">navigation</span>
        </div>
        <h2 className="text-lg font-black text-slate-800 mb-1">No Active Navigation Mission</h2>
        <p className="text-xs text-slate-500 max-w-xs mb-6">
          You don't have an active transport trip or delivery assigned right now.
        </p>
        <button
          onClick={() => navigate('/captain/jobs')}
          className="px-6 py-3 bg-[#15803d] hover:bg-[#166534] text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-colors"
        >
          View Job Queue
        </button>
      </div>
    );
  }

  const tripId = isTransport ? activeItem.bookingId : activeItem.orderId;
  const customerName = isTransport
    ? activeItem.user?.name || 'Transport Customer'
    : activeItem.shippingAddress?.fullName || activeItem.user?.name || 'Customer';
  const customerPhone = isTransport
    ? activeItem.user?.phone || ''
    : activeItem.shippingAddress?.phone || activeItem.user?.phone || '';
  const pickupAddress = isTransport
    ? (typeof activeItem.pickupLocation === 'string' ? activeItem.pickupLocation : activeItem.pickupLocation?.address) || 'Pickup Location'
    : 'Seller Warehouse Hub';
  const dropAddress = isTransport
    ? (typeof activeItem.dropLocation === 'string' ? activeItem.dropLocation : activeItem.dropLocation?.address) || 'Drop Destination'
    : `${activeItem.shippingAddress?.addressLine1 || ''}, ${activeItem.shippingAddress?.city || ''}`;
  const distanceKm = activeItem.distanceKm ? `${activeItem.distanceKm} km` : 'Live Route';
  const estTime = activeItem.estimatedDurationMin ? `${activeItem.estimatedDurationMin} mins` : '15-25 mins';
  const payout = activeItem.captainEarnings || 0;

  const returnUrl = isTransport
    ? `/captain/active-delivery?type=transport&bookingId=${activeItem.bookingId || activeItem._id}`
    : `/captain/active-delivery?type=order&orderId=${activeItem.orderId || activeItem._id}`;

  const handleOpenGoogleMaps = () => {
    const destinationQuery = encodeURIComponent(dropAddress);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destinationQuery}`, '_blank');
  };

  const handleCallCustomer = () => {
    if (customerPhone) window.location.href = `tel:${customerPhone}`;
  };

  return (
    <div className="bg-[#f8fafc] font-sans min-h-screen text-slate-800 flex flex-col justify-between">
      {/* Header */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-4 py-3 bg-[#002625] text-white shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(returnUrl)}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer border-none"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </button>
          <div>
            <span className="text-[9px] font-black uppercase text-[#97fc43] tracking-wider block leading-none">
              ACTIVE NAVIGATION
            </span>
            <span className="text-xs font-mono font-bold text-white block mt-0.5">
              #{tripId}
            </span>
          </div>
        </div>

        <button
          onClick={handleCallCustomer}
          className="px-3 py-1.5 rounded-lg bg-[#97fc43] text-[#002625] text-xs font-black flex items-center gap-1 cursor-pointer border-none"
        >
          <span className="material-symbols-outlined text-sm">call</span>
          Call
        </button>
      </header>

      {/* Main Content Area */}
      <main className="pt-16 pb-28 px-4 max-w-md mx-auto w-full space-y-4 flex-1">
        {/* Real Dynamic Route Card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 space-y-3 mt-2">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              TRIP ROUTE
            </span>
            <span className="text-xs font-bold text-[#15803d] bg-emerald-50 px-2 py-0.5 rounded-md">
              Payout: ₹{Number(payout).toFixed(2)}
            </span>
          </div>

          {/* Timeline */}
          <div className="space-y-3">
            {/* Pickup */}
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-emerald-100 text-[#047857] flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-xs">storefront</span>
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[9px] font-black text-[#047857] uppercase tracking-wider block">
                  PICKUP
                </span>
                <p className="font-bold text-xs text-slate-900 leading-snug">
                  {pickupAddress}
                </p>
              </div>
            </div>

            {/* Connecting dot */}
            <div className="pl-2.5 my-0">
              <div className="w-0.5 h-3 bg-slate-200"></div>
            </div>

            {/* Drop */}
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-orange-100 text-[#ff5500] flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-xs">location_on</span>
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[9px] font-black text-[#ff5500] uppercase tracking-wider block">
                  DROP DESTINATION
                </span>
                <p className="font-bold text-xs text-slate-900 leading-snug">
                  {dropAddress}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Telemetry Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">
              DISTANCE
            </span>
            <span className="text-xl font-black text-slate-900 block mt-0.5">
              {distanceKm}
            </span>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">
              EST. TIME
            </span>
            <span className="text-xl font-black text-[#15803d] block mt-0.5">
              {estTime}
            </span>
          </div>
        </div>

        {/* Customer Details */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-700">
              {customerName.charAt(0).toUpperCase()}
            </div>
            <div>
              <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">
                CUSTOMER
              </span>
              <p className="font-bold text-xs text-slate-900">
                {customerName}
              </p>
              {customerPhone && (
                <p className="text-[11px] text-slate-500 font-medium">
                  {customerPhone}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={handleOpenGoogleMaps}
            className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer border border-blue-200 transition-colors"
          >
            <span className="material-symbols-outlined text-base">directions</span>
            Maps
          </button>
        </div>
      </main>

      {/* Bottom Action Bar */}
      <footer className="fixed bottom-0 left-0 w-full z-40 bg-white border-t border-slate-200/80 p-3.5 shadow-lg">
        <div className="max-w-md mx-auto flex gap-2.5">
          <button
            onClick={handleOpenGoogleMaps}
            className="flex-1 py-3 bg-[#002625] hover:bg-[#0a3d16] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-base text-[#97fc43]">navigation</span>
            Open Turn-by-Turn Maps
          </button>

          <button
            onClick={() => navigate(returnUrl)}
            className="py-3 px-4 bg-[#15803d] hover:bg-[#166534] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-colors"
          >
            Verify Arrival
          </button>
        </div>
      </footer>
    </div>
  );
};

export default LogisticsNavigation;
