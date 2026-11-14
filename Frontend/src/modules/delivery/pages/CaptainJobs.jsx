import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CaptainBottomNav from '../components/CaptainBottomNav';
import { captainService, returnService } from '../../../services/authService';
import repairService from '../../../services/repairService';
import { markJobAsDismissed } from '../utils/jobDismissal';
import RatingModal from '../../../components/RatingModal';

const CaptainJobs = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') === 'transport' ? 'deliveries' : searchParams.get('tab')) || 'deliveries';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [acceptedJob, setAcceptedJob] = useState(null);
  const [selectedDetailJob, setSelectedDetailJob] = useState(null);
  const [ratingJob, setRatingJob] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [returnJobs, setReturnJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [counts, setCounts] = useState({ transport: 0, deliveries: 0, returns: 0, completed: 0 });
  const [repairDone, setRepairDone] = useState([]); // completed repair legs of this captain (shown under Completed)
  useEffect(() => {
    if (activeTab !== 'completed') return undefined;
    let cancelled = false;
    const loadDone = async () => {
      try {
        const res = await repairService.captain.getJobs('history');
        const rows = (res?.bookings || []).flatMap((b) => (b.completedLegs || []).map((l) => ({ ...l, booking: b })));
        rows.sort((x, y) => new Date(y.at || 0) - new Date(x.at || 0));
        if (!cancelled) setRepairDone(rows);
      } catch { /* silent */ }
    };
    loadDone();
    const t = setInterval(() => { if (!document.hidden) loadDone(); }, 15000);
    return () => { cancelled = true; clearInterval(t); };
  }, [activeTab]);

  const [repairCount, setRepairCount] = useState(0); // active Repair & Services pickups + deliveries for this captain

  // Keep the Repair tab count fresh (repair jobs themselves live on /captain/repair-jobs)
  useEffect(() => {
    let cancelled = false;
    const loadRepairCount = async () => {
      if (document.hidden) return;
      try {
        const [p, d] = await Promise.all([repairService.captain.getJobs('pickups'), repairService.captain.getJobs('deliveries')]);
        if (!cancelled) setRepairCount((p?.count || 0) + (d?.count || 0));
      } catch { /* silent */ }
    };
    loadRepairCount();
    const t = setInterval(loadRepairCount, 10000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // Sync tab with URL search parameter if changed externally
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && tabParam !== 'transport' && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const fetchTabCounts = useCallback(async () => {
    try {
      const [delivRes, retRes, compRes] = await Promise.allSettled([
        captainService.getJobs('deliveries'),
        returnService.getCaptainReturnJobs('available'),
        captainService.getJobs('completed'),
      ]);
      setCounts({
        deliveries: delivRes.status === 'fulfilled' ? (delivRes.value.orders?.length || 0) : 0,
        returns: retRes.status === 'fulfilled' ? (retRes.value.returnJobs?.length || 0) : 0,
        completed: compRes.status === 'fulfilled' ? (compRes.value.orders?.length || 0) : 0,
      });
    } catch (e) {}
  }, []);

  const fetchJobs = useCallback(async (tab, silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (tab === 'returns') {
        const res = await returnService.getCaptainReturnJobs('available');
        const retList = res.returnJobs || [];
        setReturnJobs(retList);
        setCounts((prev) => ({ ...prev, returns: retList.length }));
      } else {
        const res = await captainService.getJobs(tab);
        // Transport rides are no longer part of the captain app
        const orderList = (res.orders || []).filter((o) => !o.isTransport && !String(o.orderId || o.bookingId || '').startsWith('TRB'));
        setJobs(orderList);
        setCounts((prev) => ({ ...prev, [tab]: orderList.length }));
      }
    } catch (err) {
      console.error('Fetch jobs error:', err);
      if (tab === 'returns') setReturnJobs([]);
      else setJobs([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs(activeTab);
    fetchTabCounts();
    const interval = setInterval(() => {
      if (document.hidden) return;
      fetchJobs(activeTab, true);
      fetchTabCounts();
    }, 10000);
    return () => clearInterval(interval);
  }, [activeTab, fetchJobs, fetchTabCounts]);

  const handleTabChange = (tab) => {
    if (tab === 'repair') { navigate('/captain/repair-jobs'); return; }
    setActiveTab(tab);
    setSearchParams({ tab });
    setSearchQuery('');
  };

  // Accept normal delivery order
  const handleAcceptOrder = async (order) => {
    setActionLoading(order._id);
    try {
      markJobAsDismissed(order);
      await captainService.acceptJob(order.orderId || order._id);
      setAcceptedJob(order);
      fetchJobs(activeTab);
    } catch (err) {
      console.error('Accept job error:', err);
      alert(err?.response?.data?.message || 'Failed to accept job.');
    } finally {
      setActionLoading(null);
    }
  };

  // Reject normal delivery order
  const handleRejectOrder = async (order) => {
    setActionLoading(order._id);
    try {
      markJobAsDismissed(order);
      await captainService.rejectJob(order.orderId || order._id);
      fetchJobs(activeTab);
    } catch (err) {
      console.error('Reject job error:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // Accept return pickup request
  const handleAcceptReturn = async (ret) => {
    setActionLoading(ret._id);
    try {
      markJobAsDismissed(ret);
      await returnService.captainAcceptReturnJob(ret._id || ret.returnId);
      setAcceptedJob({
        ...ret,
        isReturn: true,
        orderId: ret.returnId,
        captainEarnings: ret.captainEarnings || 40,
        shippingAddress: ret.customerAddress,
      });
      fetchJobs('returns');
    } catch (err) {
      console.error('Accept return error:', err);
      alert(err?.response?.data?.message || 'Failed to accept return pickup job.');
    } finally {
      setActionLoading(null);
    }
  };

  const confirmJobAcceptance = () => {
    if (!acceptedJob) {
      navigate('/captain/active-delivery');
      return;
    }
    if (acceptedJob.isReturn) {
      navigate(`/captain/active-delivery?type=return&returnId=${acceptedJob._id || acceptedJob.returnId}`);
      return;
    }
    const isTrp = acceptedJob.isTransport || acceptedJob.bookingId;
    const url = isTrp
      ? `/captain/active-delivery?type=transport&bookingId=${acceptedJob.bookingId || acceptedJob._id}`
      : `/captain/active-delivery?type=order&orderId=${acceptedJob.orderId || acceptedJob._id}`;
    navigate(url);
  };

  // Normalize order data for delivery and completed tabs
  const normalizeOrder = (order) => ({
    _id: order._id,
    orderId: order.orderId || order.bookingId,
    bookingId: order.bookingId,
    captainStatus: order.captainStatus || (order.status === 'RIDE_COMPLETED' ? 'Delivered' : order.status),
    captainEarnings: order.captainEarnings || order.estimatedEarnings || 0,
    itemCount: order.items?.length || order.goods?.packages || 1,
    customerName: order.user?.name || order.shippingAddress?.fullName || order.customerName || 'Customer',
    customerPhone: order.user?.phone || order.shippingAddress?.phone || order.customerPhone || '',
    dropAddress: order.dropLocation?.address || order.shippingAddress?.addressLine1 || '',
    dropCity: order.dropLocation?.city || order.shippingAddress?.city || '',
    dropState: order.dropLocation?.state || order.shippingAddress?.state || '',
    items: order.items || [],
    deliverySlot: order.deliverySlot || {},
    assignedAt: order.captainAssignedAt || order.createdAt,
    goods: order.goods,
    pickupLocation: order.pickupLocation,
    dropLocation: order.dropLocation,
    isTransport: order.isTransport || order.orderId?.startsWith('TRB') || order.bookingId?.startsWith('TRB'),
    paymentMethod: order.paymentMethod || (order.isTransport ? 'Prepaid' : 'COD'),
    paymentStatus: order.paymentStatus || 'Pending',
    grandTotal: order.grandTotal || order.totalAmount || 0,
  });

  const filteredJobs = jobs.filter((o) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      o.orderId?.toLowerCase().includes(q) ||
      o.bookingId?.toLowerCase().includes(q) ||
      o.shippingAddress?.fullName?.toLowerCase().includes(q) ||
      o.shippingAddress?.city?.toLowerCase().includes(q) ||
      o.shippingAddress?.addressLine1?.toLowerCase().includes(q) ||
      o.user?.name?.toLowerCase().includes(q) ||
      o.customerName?.toLowerCase().includes(q) ||
      o.dropLocation?.address?.toLowerCase().includes(q) ||
      o.pickupLocation?.address?.toLowerCase().includes(q) ||
      o.goods?.category?.toLowerCase().includes(q)
    );
  });

  const filteredReturns = returnJobs.filter((r) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      r.returnId?.toLowerCase().includes(q) ||
      r.orderId?.toLowerCase().includes(q) ||
      r.customerName?.toLowerCase().includes(q) ||
      r.productName?.toLowerCase().includes(q) ||
      r.reason?.toLowerCase().includes(q) ||
      r.customerAddress?.city?.toLowerCase().includes(q) ||
      r.customerAddress?.addressLine1?.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (status) => {
    const map = {
      'In Transit': 'bg-[#ff6000]/15 text-[#ff6000]',
      'Picked Up': 'bg-amber-100 text-amber-800',
      'Accepted': 'bg-[#0a3d16] text-[#86efac]',
      'Assigned': 'bg-purple-100 text-purple-700',
      'Delivered': 'bg-emerald-100 text-emerald-800',
      'CAPTAIN_ASSIGNMENT_PENDING': 'bg-orange-100 text-orange-800',
      'CAPTAIN_ASSIGNED': 'bg-blue-100 text-blue-800',
    };
    return map[status] || 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="bg-[#f8fafc] font-body-md text-slate-800 min-h-screen pb-24">
      {/* Top App Bar */}
      <header className="fixed top-0 left-0 w-full z-40 bg-gradient-to-r from-[#002625] to-[#0a3d16] shadow-lg rounded-b-3xl px-4 py-4 border-b border-white/10">
        <div className="max-w-xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="font-headline-md text-xl md:text-2xl font-black text-white tracking-tight leading-tight">
              Job Queue
            </h1>
            <p className="text-[10px] md:text-xs text-[#97fc43] font-medium tracking-wide uppercase mt-0.5">
              Available & Assigned Trips
            </p>
          </div>
          <button
            onClick={() => fetchJobs(activeTab)}
            className="w-9 h-9 flex items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white rounded-xl transition-colors cursor-pointer shadow-sm"
          >
            <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>
              refresh
            </span>
          </button>
        </div>
      </header>

      <main className="pt-24 px-3.5 max-w-xl mx-auto space-y-3.5 mt-1">
        {/* Search */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Trip ID, Customer or Location..."
            className="w-full bg-white border border-slate-200/90 rounded-xl py-2.5 pl-10 pr-3 text-xs font-medium shadow-2xs focus:ring-2 focus:ring-secondary/40 focus:outline-none placeholder:text-slate-400"
          />
        </div>

        {/* Tab Pills: 1. Transport Requests, 2. Delivery, 3. Return Pickups, 4. Completed */}
        <div className="flex gap-2 overflow-x-auto hide-scrollbar py-0.5">
          {[
            { key: 'deliveries', label: 'Delivery', icon: 'package_2', count: activeTab === 'deliveries' ? jobs.length : undefined },
            { key: 'returns', label: 'Return Pickups', icon: 'keyboard_return', count: counts.returns },
            { key: 'repair', label: 'Repair', icon: 'build', count: repairCount },
            { key: 'completed', label: 'Completed', icon: 'check_circle', count: activeTab === 'completed' ? jobs.length + repairDone.length : undefined },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shadow-2xs ${
                activeTab === tab.key
                  ? 'bg-[#15803d] text-white shadow-sm'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/90'
              }`}
            >
              <span className="material-symbols-outlined text-[17px]">{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count !== undefined && !loading && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="material-symbols-outlined text-5xl text-[#366b00] animate-spin">sync</span>
            <p className="text-sm text-slate-500 font-semibold">Loading available jobs…</p>
          </div>
        )}

        {/* ── TAB 2 & 3: DELIVERY ORDERS & COMPLETED ── */}
        {!loading && activeTab === 'completed' && repairDone.length > 0 && (
          <section className="space-y-2.5">
            <h3 className="text-[13px] font-extrabold text-slate-700 m-0 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-[#15803d]">build</span> Repair jobs completed
            </h3>
            {repairDone.map((row) => (
              <div key={`${row.booking._id}-${row.leg}`} className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-extrabold text-sm text-slate-900 m-0 truncate">{row.booking.brand} {row.booking.model}</p>
                    <p className="text-[11px] font-semibold text-slate-400 m-0">{row.booking.categoryName} · #{row.booking.bookingId}</p>
                  </div>
                  <span className="shrink-0 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {row.leg === 'pickup' ? 'Pickup done' : 'Delivered'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{row.at ? new Date(row.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  <span className="font-extrabold text-[#15803d]">{row.earnings > 0 ? `+ ₹${Number(row.earnings).toFixed(2)}` : 'Earnings pending'}</span>
                </div>
              </div>
            ))}
          </section>
        )}

        {!loading && activeTab !== 'transport' && activeTab !== 'returns' && (
          <>
            {filteredJobs.length === 0 && !(activeTab === 'completed' && repairDone.length > 0) ? (
              <div className="bg-white rounded-xl p-8 border border-slate-200/80 flex flex-col items-center gap-3 text-center">
                <span className="material-symbols-outlined text-5xl text-slate-300">
                  {activeTab === 'completed' ? 'task_alt' : 'package_2'}
                </span>
                <p className="font-bold text-slate-700">
                  {activeTab === 'completed' ? 'No completed trips or deliveries yet' : 'No active delivery orders assigned'}
                </p>
                <p className="text-xs text-slate-400">
                  {activeTab === 'completed'
                    ? 'Your completed product deliveries and repair jobs will appear here.'
                    : 'Assigned e-commerce packages will appear here once online.'}
                </p>
              </div>
            ) : (
              filteredJobs.map((order) => {
                const job = normalizeOrder(order);
                const isActing = actionLoading === order._id;
                const isTransport = order.isTransport || job.orderId?.startsWith('TRB');
                return (
                  <div
                    key={job._id}
                    className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all space-y-2.5 overflow-hidden"
                  >
                    {/* Header Row 1: ID and Price */}
                    <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${isTransport ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                        <span className="font-mono text-xs font-bold text-slate-800 truncate">
                          #{job.orderId}
                        </span>
                      </div>
                      <span className="text-sm sm:text-base font-black text-[#15803d] shrink-0">
                        ₹{job.captainEarnings.toFixed(2)}
                      </span>
                    </div>

                    {/* Header Row 2: Badge & Status */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        {isTransport ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 shrink-0 flex items-center gap-1">
                            <span>🚚</span> Transport
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 shrink-0 flex items-center gap-1">
                            <span>📦</span> Delivery
                          </span>
                        )}
                        {job.paymentMethod && (
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 border ${
                              job.paymentMethod === 'COD' || job.paymentMethod === 'CASH'
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            }`}
                          >
                            {job.paymentMethod === 'COD' || job.paymentMethod === 'CASH'
                              ? `COD (Collect ₹${Number(job.grandTotal || 0).toFixed(0)})`
                              : 'PREPAID'}
                          </span>
                        )}
                        <span className="text-xs font-medium text-slate-700 truncate">
                          {job.customerName}
                        </span>
                      </div>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-md shrink-0 ${getStatusBadge(
                          job.captainStatus
                        )}`}
                      >
                        {job.captainStatus?.toUpperCase() || 'ASSIGNED'}
                      </span>
                    </div>

                    {/* Route Info */}
                    <div className="bg-slate-50/80 p-2.5 sm:p-3 rounded-lg border border-slate-100 space-y-1.5 text-xs">
                      {order.pickupLocation?.address && (
                        <div className="flex items-start gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0"></span>
                          <div className="flex-1 min-w-0">
                            <span className="text-[8px] font-bold text-emerald-700 uppercase tracking-wider block">Pickup</span>
                            <p className="font-semibold text-slate-800 text-xs leading-tight line-clamp-1">{order.pickupLocation.address}</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-500 mt-1 shrink-0"></span>
                        <div className="flex-1 min-w-0">
                          <span className="text-[8px] font-bold text-orange-700 uppercase tracking-wider block">Drop</span>
                          <p className="font-semibold text-slate-800 text-xs leading-tight line-clamp-1">{job.dropAddress}</p>
                          {job.dropCity && (
                            <p className="text-[10px] text-slate-400 mt-0.5">{job.dropCity}, {job.dropState}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1 pt-1 border-t border-slate-200/50">
                        <span className="material-symbols-outlined text-[13px]">
                          {isTransport ? 'scale' : 'inventory_2'}
                        </span>
                        {isTransport
                          ? `${order.goods?.category || 'Transport'} • ${order.goods?.weightKg || ''}kg`
                          : `${job.itemCount} item${job.itemCount !== 1 ? 's' : ''}${job.deliverySlot?.time ? ` • ${job.deliverySlot.time}` : ''}`}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-0.5">
                      {activeTab === 'completed' ? (
                        <>
                          <button
                            onClick={() => setSelectedDetailJob(order)}
                            className="flex-1 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 py-2 rounded-lg text-xs font-bold text-slate-800 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">info</span>
                            <span>Details</span>
                          </button>
                          {isTransport && (
                            order.hasCaptainRated ? (
                              <span className="px-3 py-2 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-lg text-xs font-bold flex items-center gap-1 shrink-0">
                                <span>⭐</span> Rated {order.captainRating}/5
                              </span>
                            ) : (
                              <button
                                onClick={() => setRatingJob(order)}
                                className="flex-1 bg-[#15803d] hover:bg-[#166534] text-white py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-2xs transition-colors cursor-pointer border-none"
                              >
                                <span className="material-symbols-outlined text-sm">star</span>
                                <span>Rate User</span>
                              </button>
                            )
                          )}
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setSelectedDetailJob(order)}
                            className="w-1/2 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 py-2 rounded-lg text-xs font-bold text-slate-800 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[16px]">info</span>
                            <span>View Details</span>
                          </button>
                          {job.captainStatus === 'Assigned' ? (
                            <button
                              onClick={() => handleAcceptOrder(order)}
                              disabled={isActing}
                              className="w-1/2 bg-[#15803d] hover:bg-[#166534] py-2 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1 shadow-2xs transition-all cursor-pointer disabled:opacity-60"
                            >
                              {isActing ? (
                                <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                              ) : (
                                'Accept Job'
                              )}
                              {!isActing && <span className="material-symbols-outlined text-base">arrow_forward</span>}
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                const isTrp = isTransport || order?.bookingId;
                                const url = isTrp
                                  ? `/captain/active-delivery?type=transport&bookingId=${order.bookingId || order._id}`
                                  : `/captain/active-delivery?type=order&orderId=${order.orderId || order._id}`;
                                navigate(url);
                              }}
                              className="w-1/2 bg-[#15803d] hover:bg-[#166534] py-2 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1 shadow-2xs transition-all cursor-pointer"
                            >
                              Continue
                              <span className="material-symbols-outlined text-base">arrow_forward</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}

        {/* ── TAB 3: RETURN PICKUPS ── */}
        {!loading && activeTab === 'returns' && (
          <>
            {filteredReturns.length === 0 ? (
              <div className="bg-white rounded-xl p-8 border border-slate-200/80 flex flex-col items-center gap-3 text-center">
                <span className="material-symbols-outlined text-5xl text-slate-300">keyboard_return</span>
                <p className="font-bold text-slate-700">No Return Pickups Available</p>
                <p className="text-xs text-slate-400">
                  When customers in your service area request product returns, return pickup jobs will appear here in real-time.
                </p>
              </div>
            ) : (
              filteredReturns.map((ret) => {
                const isActing = actionLoading === ret._id;
                const isAssignedToMe = ret.status === 'CAPTAIN_ASSIGNED' || ['PICKUP_STARTED', 'PICKUP_ARRIVED', 'PICKED_UP', 'IN_TRANSIT_TO_SELLER'].includes(ret.status);

                return (
                  <div
                    key={ret._id || ret.returnId}
                    className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200/90 shadow-2xs hover:shadow-md transition-all space-y-2.5 overflow-hidden"
                  >
                    {/* Header Row: ID and Earnings */}
                    <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-xs font-black text-slate-900 truncate">
                          #{ret.returnId}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-orange-50 text-[#ea580c] border border-orange-200 shrink-0">
                          Return Pickup
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-400 font-semibold block">Payout</span>
                        <span className="font-headline-md text-base font-black text-[#15803d]">
                          ₹{(ret.captainEarnings || 40).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Customer Info & Product summary */}
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Customer</span>
                        <p className="font-bold text-slate-900 m-0">{ret.customerName}</p>
                      </div>
                      {ret.customerPhone && (
                        <a
                          href={`tel:${ret.customerPhone}`}
                          className="px-2 py-1 bg-[#15803d] text-white rounded-lg text-[11px] font-bold flex items-center gap-1 no-underline shadow-2xs"
                        >
                          <span className="material-symbols-outlined text-xs">call</span> Call
                        </a>
                      )}
                    </div>

                    {/* Pickup & Return Destinations */}
                    <div className="space-y-1.5 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                      <div className="flex items-start gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0"></span>
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Pickup From (Customer)</span>
                          <p className="font-bold text-slate-800 text-[11px] m-0 leading-tight">
                            {ret.customerAddress?.addressLine1}, {ret.customerAddress?.city} - {ret.customerAddress?.pincode}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 pt-1 border-t border-slate-200/50">
                        <span className="w-2 h-2 rounded-full bg-orange-500 mt-1 shrink-0"></span>
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Deliver To (Seller / Store)</span>
                          <p className="font-bold text-slate-800 text-[11px] m-0 leading-tight">
                            {ret.sellerName || 'Sathi Seller Warehouse'}
                            {ret.sellerAddress
                              ? ` — ${[
                                  ret.sellerAddress?.storeAddress || ret.sellerAddress?.addressLine1,
                                  ret.sellerAddress?.city,
                                  ret.sellerAddress?.pincode,
                                ]
                                  .filter(Boolean)
                                  .join(', ')}`
                              : ' (Store)'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Product & Reason badge */}
                    <div className="text-[11px] text-slate-600 flex items-center justify-between pt-0.5">
                      <span className="font-bold text-slate-800 truncate max-w-[200px]">
                        📦 {ret.productName} (×{ret.quantity})
                      </span>
                      <span className="text-[10px] text-slate-500 italic truncate max-w-[140px]">
                        Reason: {ret.reason}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-0.5">
                      <button
                        onClick={() => setSelectedDetailJob({
                          ...ret,
                          isReturn: true,
                          orderId: ret.returnId,
                          shippingAddress: ret.customerAddress,
                          customerAddress: ret.customerAddress,
                          sellerAddress: ret.sellerAddress,
                          sellerName: ret.sellerName,
                        })}
                        className="w-1/2 bg-slate-50 hover:bg-slate-100 border border-slate-200/90 py-2 rounded-lg text-xs font-bold text-slate-800 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">info</span>
                        <span>Details</span>
                      </button>

                      {isAssignedToMe ? (
                        <button
                          onClick={() => navigate(`/captain/active-delivery?type=return&returnId=${ret._id || ret.returnId}`)}
                          className="w-1/2 bg-[#15803d] hover:bg-[#166534] py-2 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1 shadow-2xs transition-all cursor-pointer"
                        >
                          <span>Continue Pickup</span>
                          <span className="material-symbols-outlined text-base">arrow_forward</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAcceptReturn(ret)}
                          disabled={isActing}
                          className="w-1/2 bg-[#ea580c] hover:bg-[#c2410c] py-2 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-1 shadow-2xs transition-all cursor-pointer disabled:opacity-60"
                        >
                          {isActing ? (
                            <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                          ) : (
                            'Accept Pickup'
                          )}
                          {!isActing && <span className="material-symbols-outlined text-base">arrow_forward</span>}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </main>

      {/* Accept Confirmation Modal */}
      {acceptedJob && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white p-5 rounded-xl max-w-md w-full border border-slate-100 shadow-2xl space-y-3">
            <div className="w-10 h-10 bg-emerald-100 text-[#15803d] rounded-full flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-xl font-bold">check_circle</span>
            </div>
            <div className="text-center space-y-0.5">
              <h3 className="font-bold text-base text-slate-900">Job Accepted!</h3>
              <p className="text-xs text-slate-500">
                Payout: <span className="font-bold text-[#15803d]">₹{(acceptedJob.captainEarnings || 0).toFixed(2)}</span>
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg text-xs space-y-1.5 border border-slate-100">
              <p className="font-bold text-slate-900">
                {acceptedJob.isReturn ? 'Return' : 'Trip'} #{acceptedJob.orderId || acceptedJob.returnId || acceptedJob.bookingId}
              </p>
              {acceptedJob.isReturn ? (
                <>
                  <p className="text-slate-600">
                    <span className="font-bold text-emerald-700">Pickup:</span>{' '}
                    {[acceptedJob.customerAddress?.addressLine1, acceptedJob.customerAddress?.city, acceptedJob.customerAddress?.pincode]
                      .filter(Boolean)
                      .join(', ') || 'Customer address'}
                  </p>
                  <p className="text-slate-600">
                    <span className="font-bold text-orange-700">Deliver to:</span>{' '}
                    {acceptedJob.sellerName || 'Seller'}
                    {acceptedJob.sellerAddress
                      ? ` — ${[acceptedJob.sellerAddress?.addressLine1 || acceptedJob.sellerAddress?.storeAddress, acceptedJob.sellerAddress?.city]
                          .filter(Boolean)
                          .join(', ')}`
                      : ''}
                  </p>
                </>
              ) : (
                <p className="text-slate-500">
                  Destination: {acceptedJob.shippingAddress?.city || acceptedJob.dropLocation?.address}
                </p>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setAcceptedJob(null)}
                className="flex-1 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Stay Here
              </button>
              <button
                onClick={confirmJobAcceptance}
                className="flex-1 py-2 rounded-lg bg-[#15803d] hover:bg-[#166534] text-white text-xs font-bold shadow-2xs transition-all cursor-pointer"
              >
                Start Navigation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* 📋 VIEW DETAILS MODAL                                     */}
      {/* ────────────────────────────────────────────────────────── */}
      {selectedDetailJob && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-hidden touch-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedDetailJob(null);
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
                  #{selectedDetailJob.bookingId || selectedDetailJob.orderId}
                </span>
                {selectedDetailJob.isReturn || selectedDetailJob.returnId ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-orange-50 text-orange-800 border border-orange-200 flex items-center gap-1">
                    <span>↩️</span> Return
                  </span>
                ) : selectedDetailJob.isTransport || selectedDetailJob.orderId?.startsWith('TRB') || selectedDetailJob.bookingId ? (
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
                onClick={() => setSelectedDetailJob(null)}
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
                    ₹{(selectedDetailJob.captainEarnings || selectedDetailJob.estimatedEarnings || 0).toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white text-emerald-800 border border-emerald-200 block mb-0.5">
                    {selectedDetailJob.paymentMethod || 'CASH'} • {selectedDetailJob.captainStatus || 'Completed'}
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
                      selectedDetailJob.customerPhone ||
                      selectedDetailJob.user?.phone ||
                      selectedDetailJob.shippingAddress?.phone;
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
                      {selectedDetailJob.customerName ||
                        selectedDetailJob.user?.name ||
                        selectedDetailJob.shippingAddress?.fullName ||
                        'Customer'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Contact Number</span>
                    {(() => {
                      const phone =
                        selectedDetailJob.customerPhone ||
                        selectedDetailJob.user?.phone ||
                        selectedDetailJob.shippingAddress?.phone;
                      return phone ? (
                        <a href={`tel:${phone}`} className="font-bold text-[#15803d] text-xs mt-0.5 hover:underline flex items-center gap-0.5">
                          <span>📞 {phone}</span>
                        </a>
                      ) : (
                        <p className="text-slate-400 font-medium text-xs mt-0.5">Not provided</p>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Route Timeline */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 text-xs space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0"></span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      {selectedDetailJob.isReturn || selectedDetailJob.returnId ? 'Pickup From (Customer)' : 'Pickup Location'}
                    </span>
                    <p className="font-bold text-slate-900 text-xs mt-0.5">
                      {selectedDetailJob.isReturn || selectedDetailJob.returnId
                        ? [
                            selectedDetailJob.customerAddress?.addressLine1,
                            selectedDetailJob.customerAddress?.city,
                            selectedDetailJob.customerAddress?.pincode,
                          ]
                            .filter(Boolean)
                            .join(', ') ||
                          selectedDetailJob.shippingAddress?.addressLine1 ||
                          'Customer address'
                        : selectedDetailJob.pickupLocation?.address || 'Store / Warehouse'}
                    </p>
                  </div>
                </div>
                {Array.isArray(selectedDetailJob.stops) &&
                  selectedDetailJob.stops.filter(Boolean).map((stop, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 mt-1 shrink-0"></span>
                      <div className="flex-1 min-w-0">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                          Stop {idx + 1}
                        </span>
                        <p className="font-bold text-slate-900 text-xs mt-0.5">
                          {typeof stop === 'string'
                            ? stop
                            : stop?.address ||
                              [stop?.addressLine1, stop?.city, stop?.pincode].filter(Boolean).join(', ') ||
                              `Stop ${idx + 1}`}
                        </p>
                      </div>
                    </div>
                  ))}
                <div className="flex items-start gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 mt-1 shrink-0"></span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                      {selectedDetailJob.isReturn || selectedDetailJob.returnId ? 'Deliver To (Seller)' : 'Drop Location'}
                    </span>
                    <p className="font-bold text-slate-900 text-xs mt-0.5">
                      {selectedDetailJob.isReturn || selectedDetailJob.returnId
                        ? [
                            selectedDetailJob.sellerName,
                            selectedDetailJob.sellerAddress?.storeAddress ||
                              selectedDetailJob.sellerAddress?.addressLine1,
                            selectedDetailJob.sellerAddress?.city,
                          ]
                            .filter(Boolean)
                            .join(' — ') || 'Seller store / warehouse'
                        : selectedDetailJob.dropLocation?.address ||
                          selectedDetailJob.shippingAddress?.addressLine1 ||
                          selectedDetailJob.shippingAddress?.city ||
                          'Customer Address'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Items / Goods Info */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Items / Cargo</span>
                  <p className="font-bold text-slate-800 text-xs mt-0.5 truncate">
                    {selectedDetailJob.goods?.category || `${selectedDetailJob.items?.length || 1} Item(s)`}
                  </p>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Weight / Distance</span>
                  <p className="font-bold text-slate-800 text-xs mt-0.5">
                    {selectedDetailJob.goods?.weightKg ? `${selectedDetailJob.goods.weightKg} kg` : ''}{' '}
                    {selectedDetailJob.distanceKm ? `• 📍 ${selectedDetailJob.distanceKm} km` : ''}
                  </p>
                </div>
              </div>
            </div>

            {/* Sticky Bottom Action Buttons */}
            <div className="sticky bottom-0 z-10 bg-white px-4 py-3 border-t border-slate-100 flex gap-2 shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
              <button
                onClick={() => setSelectedDetailJob(null)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rating Modal for Captain rating user */}
      <RatingModal
        isOpen={Boolean(ratingJob)}
        onClose={() => setRatingJob(null)}
        ride={ratingJob}
        role="captain"
        onSuccess={(res) => {
          setJobs((prev) =>
            prev.map((j) =>
              (j.bookingId === ratingJob?.bookingId || j._id === ratingJob?._id)
                ? { ...j, hasCaptainRated: true, captainRating: res.rating?.rating || 5 }
                : j
            )
          );
          setRatingJob(null);
        }}
      />

      <CaptainBottomNav />
    </div>
  );
};

export default CaptainJobs;
