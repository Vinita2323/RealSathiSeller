import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Truck, Search, Filter, RefreshCw, Eye, CheckCircle2, Clock, 
  XCircle, AlertCircle, MapPin, User, Phone, Calendar, 
  DollarSign, ArrowRight, ShieldCheck, Download, Star, 
  ChevronRight, ArrowUpDown, Package, FileText, Check, 
  UserCheck, Navigation, Layers, ShieldAlert, Sparkles, X,
  Radio, KeyRound, Image as ImageIcon
} from 'lucide-react';
import { adminTransportService, adminService } from '../../../services/authService';
import { useDebounce } from '../../../hooks/useDebounce';

export const TransportManagement = ({ initialTab = 'ALL' }) => {
  const [activeSubTab, setActiveSubTab] = useState(initialTab);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Search & Filter States
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearchQuery = useDebounce(searchInput, 300);
  const [selectedVehicle, setSelectedVehicle] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Reset page when debounced search query changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchQuery]);

  // Summary Metrics State
  const [stats, setStats] = useState({
    totalBookings: 0,
    searchingCount: 0,
    inProgressCount: 0,
    completedCount: 0,
    cancelledCount: 0,
    totalRevenue: 0,
    totalCaptainEarnings: 0,
  });

  // Modal States
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignBookingTarget, setAssignBookingTarget] = useState(null);
  const [selectedCaptainId, setSelectedCaptainId] = useState('');
  const [customCaptainPayout, setCustomCaptainPayout] = useState('');
  const [availableCaptains, setAvailableCaptains] = useState([]);
  const [assigningCaptain, setAssigningCaptain] = useState(false);

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelTargetBooking, setCancelTargetBooking] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancellingBooking, setCancellingBooking] = useState(false);

  // Fetch Transport Bookings
  const fetchBookings = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const params = {
        status: activeSubTab,
        search: debouncedSearchQuery.trim() || undefined,
        vehicleType: selectedVehicle !== 'ALL' ? selectedVehicle : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        limit,
      };

      const res = await adminTransportService.getAllBookings(params);
      if (res && res.success) {
        setBookings(res.bookings || []);
        if (res.stats) setStats(res.stats);
        if (res.pagination) {
          setTotalPages(res.pagination.pages || 1);
          setTotalCount(res.pagination.total || 0);
        }
      } else {
        setError(res?.message || 'Failed to fetch transport bookings');
      }
    } catch (err) {
      console.error('Error loading admin transport bookings:', err);
      // Keep existing rows on timeout — clearing looked like “no data” (#63)
      setError(
        err?.code === 'ECONNABORTED' || err?.message?.includes('timeout')
          ? 'Request timed out. Showing last loaded bookings — tap Refresh to retry.'
          : (err?.response?.data?.message || err.message || 'Error communicating with backend server.')
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeSubTab, debouncedSearchQuery, selectedVehicle, startDate, endDate, page, limit]);

  // Fetch available captains for manual assignment
  const fetchCaptainsList = async () => {
    try {
      const res = await adminService.getCaptains(true);
      if (res && res.success && Array.isArray(res.captains)) {
        // Filter approved captains
        setAvailableCaptains(res.captains.filter(c => c.status === 'approved'));
      }
    } catch (err) {
      console.warn('Failed to load captains for assignment:', err);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    fetchCaptainsList();
  }, []);

  // Handle Manual Assign Captain
  const handleOpenAssignModal = (booking) => {
    setAssignBookingTarget(booking);
    setSelectedCaptainId(booking.captainId?._id || booking.captainId || '');
    setCustomCaptainPayout(booking.captainEarnings || Number((booking.fareBreakdown?.totalFare * 0.85).toFixed(2)) || '');
    setIsAssignModalOpen(true);
  };

  const handleConfirmAssignCaptain = async (e) => {
    e.preventDefault();
    if (!assignBookingTarget || !selectedCaptainId) return;

    setAssigningCaptain(true);
    try {
      const res = await adminTransportService.assignCaptain(
        assignBookingTarget.bookingId || assignBookingTarget._id,
        selectedCaptainId,
        Number(customCaptainPayout) || 0
      );

      if (res && res.success) {
        setIsAssignModalOpen(false);
        setAssignBookingTarget(null);
        fetchBookings(true);
      } else {
        alert(res?.message || 'Failed to assign captain');
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Error assigning captain');
    } finally {
      setAssigningCaptain(false);
    }
  };

  // Handle Admin Cancel Booking
  const handleOpenCancelModal = (booking) => {
    setCancelTargetBooking(booking);
    setCancelReason('Cancelled by Administrator');
    setIsCancelModalOpen(true);
  };

  const handleConfirmCancelBooking = async (e) => {
    e.preventDefault();
    if (!cancelTargetBooking) return;

    setCancellingBooking(true);
    try {
      const res = await adminTransportService.cancelBooking(
        cancelTargetBooking.bookingId || cancelTargetBooking._id,
        cancelReason
      );

      if (res && res.success) {
        setIsCancelModalOpen(false);
        setCancelTargetBooking(null);
        fetchBookings(true);
      } else {
        alert(res?.message || 'Failed to cancel transport booking');
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Error cancelling booking');
    } finally {
      setCancellingBooking(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (bookings.length === 0) return;
    const headers = [
      'Booking ID',
      'Date',
      'Customer Name',
      'Customer Phone',
      'Pickup Address',
      'Pickup City',
      'Drop Address',
      'Drop City',
      'Vehicle Type',
      'Goods Category',
      'Weight (kg)',
      'Total Fare (₹)',
      'Payment Status',
      'Status',
      'Assigned/Completed Captain Name',
      'Captain Phone',
      'Captain Earnings (₹)',
      'Completed Date'
    ];

    const rows = bookings.map(b => [
      `"${b.bookingId}"`,
      `"${new Date(b.createdAt).toLocaleString('en-IN')}"`,
      `"${b.user?.name || 'Customer'}"`,
      `"${b.user?.phone || ''}"`,
      `"${(b.pickupLocation?.address || '').replace(/"/g, '""')}"`,
      `"${b.pickupLocation?.city || ''}"`,
      `"${(b.dropLocation?.address || '').replace(/"/g, '""')}"`,
      `"${b.dropLocation?.city || ''}"`,
      `"${b.vehicleSnapshot?.name || ''}"`,
      `"${b.goods?.category || ''}"`,
      b.goods?.weightKg || 0,
      b.fareBreakdown?.totalFare || 0,
      `"${b.paymentStatus || 'Pending'}"`,
      `"${b.status}"`,
      `"${b.captainId?.name || 'Unassigned'}"`,
      `"${b.captainId?.phone || ''}"`,
      b.captainEarnings || 0,
      b.rideCompletedAt ? `"${new Date(b.rideCompletedAt).toLocaleString('en-IN')}"` : '""'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sathiseller_transport_logistics_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Status Styling Helper
  const getStatusBadge = (status) => {
    switch (status) {
      case 'RIDE_COMPLETED':
        return {
          label: 'Completed / Delivered',
          color: 'bg-emerald-50 text-emerald-700 border-emerald-300 font-extrabold',
          icon: <CheckCircle2 size={13} className="text-emerald-600" />
        };
      case 'SEARCHING_CAPTAIN':
        return {
          label: 'Searching Captain',
          color: 'bg-amber-50 text-amber-700 border-amber-300 font-bold animate-pulse',
          icon: <Clock size={13} className="text-amber-600" />
        };
      case 'CAPTAIN_ASSIGNED':
        return {
          label: 'Captain Assigned',
          color: 'bg-blue-50 text-blue-700 border-blue-300 font-bold',
          icon: <Truck size={13} className="text-blue-600" />
        };
      case 'CAPTAIN_ARRIVING':
        return {
          label: 'Captain Arriving',
          color: 'bg-indigo-50 text-indigo-700 border-indigo-300 font-bold',
          icon: <Navigation size={13} className="text-indigo-600" />
        };
      case 'CAPTAIN_REACHED_PICKUP':
        return {
          label: 'At Pickup Location',
          color: 'bg-purple-50 text-purple-700 border-purple-300 font-bold',
          icon: <MapPin size={13} className="text-purple-600" />
        };
      case 'RIDE_STARTED':
        return {
          label: 'In Transit / Loaded',
          color: 'bg-cyan-50 text-cyan-800 border-cyan-300 font-bold',
          icon: <Truck size={13} className="text-cyan-600" />
        };
      case 'CAPTAIN_REACHED_DROP':
        return {
          label: 'Reached Destination',
          color: 'bg-teal-50 text-teal-700 border-teal-300 font-bold',
          icon: <MapPin size={13} className="text-teal-600" />
        };
      case 'CANCELLED':
        return {
          label: 'Cancelled',
          color: 'bg-rose-50 text-rose-700 border-rose-300 font-bold',
          icon: <XCircle size={13} className="text-rose-600" />
        };
      default:
        return {
          label: status,
          color: 'bg-slate-50 text-slate-700 border-slate-300 font-medium',
          icon: <Clock size={13} className="text-slate-500" />
        };
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* ── Top Hero Banner ─────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#002625] via-[#044e4b] to-[#002625] text-white rounded-2xl p-6 shadow-md border border-emerald-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-3 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1.5">
              <Truck size={12} /> Vehicle Logistics & Fleet Operations
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white m-0 tracking-tight">
            Transport & Freight Management
          </h1>
          <p className="text-xs md:text-sm text-emerald-100/80 mt-1 mb-0 max-w-2xl">
            Live monitoring of on-demand vehicle logistics, captain dispatch queue, trip milestones, OTP authentications, and delivery completion records.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleExportCSV}
            disabled={bookings.length === 0}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            title="Download CSV report"
          >
            <Download size={15} /> Export CSV
          </button>
          <button
            onClick={() => fetchBookings(true)}
            disabled={refreshing}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer flex items-center gap-1.5 border-none disabled:opacity-50"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh Live ({totalCount})</span>
          </button>
        </div>
      </div>

      {/* ── Summary KPI Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Bookings</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
              <Truck size={16} />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 block">{stats.totalBookings || 0}</span>
            <span className="text-[11px] font-medium text-slate-400">All logistics orders</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-700 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Searching Captain</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Clock size={16} />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-amber-700 block">{stats.searchingCount || 0}</span>
            <span className="text-[11px] font-medium text-amber-600">Pending driver assignment</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-700 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Active In-Transit</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Navigation size={16} />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-blue-700 block">{stats.inProgressCount || 0}</span>
            <span className="text-[11px] font-medium text-blue-600">On-road active freight</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-700 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Delivered Trips</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-emerald-700 block">{stats.completedCount || 0}</span>
            <span className="text-[11px] font-medium text-emerald-600">Successfully completed</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Gross Revenue</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <DollarSign size={16} />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 block">₹{Number(stats.totalRevenue || 0).toLocaleString('en-IN')}</span>
            <span className="text-[11px] font-medium text-slate-500">Payouts: ₹{Number(stats.totalCaptainEarnings || 0).toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* ── Sub-Tab Filter Navigation ───────────────────────────────────────── */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { key: 'ALL', label: 'All Logistics', count: stats.totalBookings },
            { key: 'SEARCHING_CAPTAIN', label: 'Searching Captain', count: stats.searchingCount },
            { key: 'IN_PROGRESS', label: 'Assigned & In Transit', count: stats.inProgressCount },
            { key: 'RIDE_COMPLETED', label: 'Delivered / Completed', count: stats.completedCount },
            { key: 'CANCELLED', label: 'Cancelled', count: stats.cancelledCount },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveSubTab(tab.key);
                setPage(1);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap border-none ${
                activeSubTab === tab.key
                  ? 'bg-[#002625] text-white shadow-xs'
                  : 'bg-transparent text-slate-600 hover:bg-slate-100'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                activeSubTab === tab.key ? 'bg-emerald-400 text-[#002625]' : 'bg-slate-100 text-slate-600'
              }`}>
                {tab.count ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Vehicle Type Filter */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-bold hidden sm:inline">Vehicle:</span>
          <select
            value={selectedVehicle}
            onChange={(e) => {
              setSelectedVehicle(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-emerald-600"
          >
            <option value="ALL">All Vehicles</option>
            <option value="bike">2-Wheeler (Bike)</option>
            <option value="3-wheeler">3-Wheeler (Auto)</option>
            <option value="tata-ace">Tata Ace (Mini Truck)</option>
            <option value="pickup-8ft">Pickup 8ft</option>
          </select>
        </div>
      </div>

      {/* ── Search & Date Filters ───────────────────────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:w-96 relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ID, customer, address, goods, or captain..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-emerald-600 focus:bg-white transition-all font-medium"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="text-[11px] font-bold text-slate-400">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 outline-none font-medium"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="text-[11px] font-bold text-slate-400">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 outline-none font-medium"
            />
          </div>
          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl border-none cursor-pointer"
            >
              Clear Dates
            </button>
          )}
        </div>
      </div>

      {/* ── Main Bookings Data Table ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-24 text-center flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw size={32} className="animate-spin text-emerald-600" />
            <span className="text-sm font-bold text-slate-700">Loading live transportation records...</span>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-rose-600 space-y-2">
            <AlertCircle size={36} className="mx-auto" />
            <h3 className="text-base font-bold m-0">Failed to load transport records</h3>
            <p className="text-xs text-slate-500">{error}</p>
            <button
              onClick={() => fetchBookings(true)}
              className="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold border-none cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : bookings.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-2 text-slate-400">
            <Truck size={44} className="text-slate-300" />
            <h3 className="text-base font-bold text-slate-700 m-0">No Transport Bookings Found</h3>
            <p className="text-xs text-slate-400 max-w-sm">
              {debouncedSearchQuery || selectedVehicle !== 'ALL' || startDate
                ? 'No transport orders match the applied filters. Try adjusting your query.'
                : 'There are no vehicle transport bookings in this status queue.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 uppercase tracking-wider font-extrabold text-[10.5px]">
                  <th className="py-3.5 px-4">Booking ID & Date</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Pickup & Drop Route</th>
                  <th className="py-3.5 px-4">Goods & Vehicle</th>
                  <th className="py-3.5 px-4">Fare & Payment</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Captain Assignment & Completion</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((booking) => {
                  const statusInfo = getStatusBadge(booking.status);
                  const isCompleted = booking.status === 'RIDE_COMPLETED';
                  const isAssigned = ['CAPTAIN_ASSIGNED', 'CAPTAIN_ARRIVING', 'CAPTAIN_REACHED_PICKUP', 'RIDE_STARTED', 'CAPTAIN_REACHED_DROP'].includes(booking.status);
                  const isSearching = booking.status === 'SEARCHING_CAPTAIN';
                  const isCancelled = booking.status === 'CANCELLED';

                  return (
                    <tr key={booking._id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Booking ID & Date */}
                      <td className="py-3.5 px-4 align-top">
                        <span className="font-mono font-black text-slate-900 block text-xs tracking-tight">
                          {booking.bookingId}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium block mt-0.5">
                          {new Date(booking.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium block">
                          {new Date(booking.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                        </span>
                      </td>

                      {/* Customer Info */}
                      <td className="py-3.5 px-4 align-top">
                        <span className="font-bold text-slate-900 block">
                          {booking.user?.name || 'Customer'}
                        </span>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone size={11} className="text-slate-400" />
                          {booking.user?.phone || '—'}
                        </span>
                      </td>

                      {/* Route (Pickup & Drop) */}
                      <td className="py-3.5 px-4 align-top max-w-[220px]">
                        <div className="space-y-1">
                          <div className="flex items-start gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-600 mt-1 shrink-0"></div>
                            <span className="text-[11px] font-medium text-slate-700 line-clamp-1" title={booking.pickupLocation?.address}>
                              {booking.pickupLocation?.address || 'Pickup Point'}
                            </span>
                          </div>
                          <div className="flex items-start gap-1.5">
                            <div className="w-2 h-2 rounded-xs bg-orange-500 mt-1 shrink-0"></div>
                            <span className="text-[11px] font-medium text-slate-700 line-clamp-1" title={booking.dropLocation?.address}>
                              {booking.dropLocation?.address || 'Drop Point'}
                            </span>
                          </div>
                          {booking.distanceKm && (
                            <span className="text-[10px] text-slate-400 font-bold block pl-3.5">
                              {booking.distanceKm} km • ~{booking.estimatedDurationMin || 15} mins
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Goods & Vehicle */}
                      <td className="py-3.5 px-4 align-top">
                        <span className="font-bold text-slate-800 block">
                          {booking.goods?.category || 'General Goods'}
                        </span>
                        <span className="text-[11px] text-slate-500 block">
                          {booking.goods?.weightKg || 0} kg • {booking.goods?.packages || 1} Pkg(s)
                        </span>
                        <span className="inline-block mt-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold text-[10px]">
                          🚛 {booking.vehicleSnapshot?.name || 'Vehicle'}
                        </span>
                      </td>

                      {/* Fare & Payment */}
                      <td className="py-3.5 px-4 align-top">
                        <span className="font-black text-slate-900 block text-xs">
                          ₹{Number(booking.fareBreakdown?.totalFare ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md uppercase block w-max mt-0.5 ${
                          booking.paymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {booking.paymentMethod || 'CASH'} • {booking.paymentStatus || 'Pending'}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4 align-top">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border ${statusInfo.color}`}>
                          {statusInfo.icon}
                          <span>{statusInfo.label}</span>
                        </span>
                      </td>

                      {/* ⭐ CAPTAIN ASSIGNMENT & COMPLETION COLUMN ⭐ */}
                      <td className="py-3.5 px-4 align-top min-w-[200px]">
                        {isCompleted && booking.captainId ? (
                          <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-2.5 space-y-1">
                            <div className="flex items-center gap-1.5 text-emerald-800 font-extrabold text-xs">
                              <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
                              <span>Completed by Captain:</span>
                            </div>
                            <span className="font-black text-slate-900 block text-xs">
                              {booking.captainId.name}
                            </span>
                            <span className="text-[11px] text-slate-600 block">
                              📞 {booking.captainId.phone || '—'}
                            </span>
                            {booking.rideCompletedAt && (
                              <span className="text-[10px] text-emerald-700 font-bold block">
                                Delivered on: {new Date(booking.rideCompletedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} at {new Date(booking.rideCompletedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                              </span>
                            )}
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 pt-1 border-t border-emerald-200/60">
                              <span>Payout: ₹{booking.captainEarnings || 0}</span>
                              {booking.captainId.ratingAverage && (
                                <span className="flex items-center gap-0.5 text-amber-600">
                                  <Star size={10} className="fill-amber-400" /> {booking.captainId.ratingAverage.toFixed(1)}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : isAssigned && booking.captainId ? (
                          <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-2.5 space-y-1">
                            <div className="flex items-center gap-1.5 text-blue-800 font-extrabold text-xs">
                              <Truck size={13} className="text-blue-600 shrink-0" />
                              <span>Assigned to Captain:</span>
                            </div>
                            <span className="font-black text-slate-900 block text-xs">
                              {booking.captainId.name}
                            </span>
                            <span className="text-[11px] text-slate-600 block">
                              📞 {booking.captainId.phone || '—'}
                            </span>
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={() => handleOpenAssignModal(booking)}
                                className="text-[10px] font-bold text-blue-700 hover:underline border-none bg-transparent cursor-pointer p-0"
                              >
                                Re-assign Captain →
                              </button>
                            </div>
                          </div>
                        ) : isSearching ? (
                          <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-2.5 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-amber-800 font-bold text-xs">
                              <Clock size={13} className="text-amber-600 animate-spin" />
                              <span>Searching Driver Pool...</span>
                            </div>
                            <button
                              onClick={() => handleOpenAssignModal(booking)}
                              className="w-full py-1.5 bg-[#002625] hover:bg-[#044e4b] text-white rounded-lg text-[11px] font-black cursor-pointer border-none transition-colors shadow-2xs flex items-center justify-center gap-1"
                            >
                              <UserCheck size={12} /> Assign Captain
                            </button>
                          </div>
                        ) : isCancelled ? (
                          <div className="bg-rose-50/80 border border-rose-200/80 rounded-xl p-2.5 space-y-0.5">
                            <span className="text-rose-800 font-extrabold text-xs block">
                              Cancelled by {booking.cancelledBy || 'User'}
                            </span>
                            <span className="text-[10px] text-slate-600 italic block line-clamp-2" title={booking.cancellationReason}>
                              "{booking.cancellationReason || 'No reason provided'}"
                            </span>
                            {booking.cancelledAt && (
                              <span className="text-[9px] text-slate-400 block">
                                {new Date(booking.cancelledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Unassigned</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 align-top text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedBooking(booking);
                              setIsDetailModalOpen(true);
                            }}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer border-none transition-colors"
                            title="View Full Booking Details"
                          >
                            <Eye size={15} />
                          </button>
                          {!isCompleted && !isCancelled && (
                            <button
                              onClick={() => handleOpenCancelModal(booking)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg cursor-pointer border border-rose-200 transition-colors"
                              title="Cancel Transport Booking"
                            >
                              <XCircle size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && bookings.length > 0 && (
          <div className="p-4 bg-slate-50/80 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing <span className="font-bold text-slate-800">{bookings.length}</span> of <span className="font-bold text-slate-800">{totalCount}</span> bookings
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-bold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed hover:bg-slate-100"
              >
                Previous
              </button>
              <span className="font-bold text-slate-800 px-2">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-bold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed hover:bg-slate-100"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal 1: Full Booking Details Drawer / Modal ─────────────────────── */}
      {isDetailModalOpen && selectedBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-100 flex flex-col animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold">
                  <Truck size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 m-0">
                    Transport Booking #{selectedBooking.bookingId}
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">
                    Placed on {new Date(selectedBooking.createdAt).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 border-none cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Status & Live OTP Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Current Status</span>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border ${getStatusBadge(selectedBooking.status).color}`}>
                      {getStatusBadge(selectedBooking.status).icon}
                      <span>{getStatusBadge(selectedBooking.status).label}</span>
                    </span>
                  </div>
                </div>

                {/* OTP Security Snapshot */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Security OTPs</span>
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 block">Pickup OTP:</span>
                      <span className="font-mono font-black text-sm text-slate-900">{selectedBooking.pickupOtp || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 block">Drop OTP:</span>
                      <span className="font-mono font-black text-sm text-slate-900">{selectedBooking.dropOtp || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Captain Assignment & Completion Box */}
              <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200/80 space-y-3">
                <h4 className="text-xs font-black uppercase text-emerald-900 tracking-wider m-0 flex items-center gap-1.5">
                  <UserCheck size={14} className="text-emerald-700" />
                  Captain Fulfillment Information
                </h4>
                {selectedBooking.captainId ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white p-3.5 rounded-xl border border-emerald-100">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Captain Name</span>
                      <span className="font-black text-slate-900 text-sm">{selectedBooking.captainId.name}</span>
                      <span className="text-[11px] text-slate-500 block">📞 {selectedBooking.captainId.phone}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Vehicle Profile</span>
                      <span className="font-bold text-slate-800">{selectedBooking.captainId.vehicleType || selectedBooking.vehicleSnapshot?.name}</span>
                      <span className="text-[11px] text-slate-500 block">Reg: {selectedBooking.captainId.vehicleNumber || 'Registered'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Captain Payout</span>
                      <span className="font-black text-emerald-700 text-sm">₹{selectedBooking.captainEarnings || 0}</span>
                      {selectedBooking.rideCompletedAt && (
                        <span className="text-[10px] text-emerald-600 font-bold block">
                          Completed: {new Date(selectedBooking.rideCompletedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-xs text-slate-500 flex items-center justify-between">
                    <span>No captain assigned yet. Ride is in searching state.</span>
                    <button
                      onClick={() => {
                        setIsDetailModalOpen(false);
                        handleOpenAssignModal(selectedBooking);
                      }}
                      className="px-3 py-1.5 bg-[#002625] text-white rounded-lg text-xs font-bold border-none cursor-pointer"
                    >
                      Assign Captain Now
                    </button>
                  </div>
                )}
              </div>

              {/* Customer & Route Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Customer Details */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
                  <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider m-0 flex items-center gap-1.5">
                    <User size={13} className="text-slate-500" /> Customer Information
                  </h4>
                  <div className="space-y-1 pt-1">
                    <p className="m-0 font-bold text-slate-900">{selectedBooking.user?.name || 'Customer'}</p>
                    <p className="m-0 text-slate-600">Phone: {selectedBooking.user?.phone || '—'}</p>
                    <p className="m-0 text-slate-600">Email: {selectedBooking.user?.email || '—'}</p>
                  </div>
                </div>

                {/* Goods & Load Info */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
                  <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider m-0 flex items-center gap-1.5">
                    <Package size={13} className="text-slate-500" /> Goods & Cargo Details
                  </h4>
                  <div className="space-y-1 pt-1">
                    <p className="m-0 font-bold text-slate-900">{selectedBooking.goods?.category || 'General Cargo'}</p>
                    <p className="m-0 text-slate-600">Weight: <span className="font-bold">{selectedBooking.goods?.weightKg || 0} kg</span> • Quantity: <span className="font-bold">{selectedBooking.goods?.packages || 1} package(s)</span></p>
                    {selectedBooking.goods?.instructions && (
                      <p className="m-0 text-slate-500 italic">"{selectedBooking.goods.instructions}"</p>
                    )}
                  </div>
                </div>
              </div>

              {(selectedBooking.pickupPhotos?.length > 0 || selectedBooking.dropPhotos?.length > 0 || selectedBooking.proofOfDeliveryUrl) && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3 text-xs">
                  <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider m-0">Goods and delivery photos</h4>
                  {selectedBooking.pickupPhotos?.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {selectedBooking.pickupPhotos.map((photo) => (
                        <a key={photo.url} href={photo.url} target="_blank" rel="noreferrer">
                          <img src={photo.url} alt="Pickup goods" className="w-20 h-20 rounded-xl object-cover border border-slate-200" />
                        </a>
                      ))}
                    </div>
                  )}
                  {(selectedBooking.dropPhotos?.length > 0 || selectedBooking.proofOfDeliveryUrl) && (
                    <div className="flex gap-2 flex-wrap">
                      {[...(selectedBooking.dropPhotos || []).map((photo) => photo.url), selectedBooking.proofOfDeliveryUrl]
                        .filter(Boolean)
                        .filter((url, index, list) => list.indexOf(url) === index)
                        .map((url) => (
                          <a key={url} href={url} target="_blank" rel="noreferrer">
                            <img src={url} alt="Delivery proof" className="w-20 h-20 rounded-xl object-cover border border-slate-200" />
                          </a>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {selectedBooking.returnRoute?.required && (
                <div className="p-4 bg-sky-50 rounded-2xl border border-sky-200 text-xs">
                  <h4 className="text-xs font-black uppercase text-sky-800 tracking-wider m-0">Return route</h4>
                  <p className="m-0 mt-2 text-slate-700">
                    Separate from the delivery trip. Status: {selectedBooking.returnRoute.status || 'PENDING'}.
                    Destination: {selectedBooking.returnRoute.destination?.address || 'Pickup'}.
                  </p>
                </div>
              )}

              {/* Full Route */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3 text-xs">
                <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider m-0 flex items-center gap-1.5">
                  <Navigation size={13} className="text-slate-500" /> Trip Route & GPS Coordinates
                </h4>
                <div className="space-y-2.5 bg-white p-3.5 rounded-xl border border-slate-200">
                  <div className="flex items-start gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 mt-1 shrink-0"></div>
                    <div>
                      <span className="text-[10px] font-bold text-emerald-700 uppercase block">Pickup Location</span>
                      <p className="m-0 font-medium text-slate-800">{selectedBooking.pickupLocation?.address}</p>
                      <span className="text-[10px] text-slate-400">{selectedBooking.pickupLocation?.city}, {selectedBooking.pickupLocation?.state} - {selectedBooking.pickupLocation?.pincode}</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 pt-2 border-t border-slate-100">
                    <div className="w-2.5 h-2.5 rounded-xs bg-orange-500 mt-1 shrink-0"></div>
                    <div>
                      <span className="text-[10px] font-bold text-orange-700 uppercase block">Drop Location</span>
                      <p className="m-0 font-medium text-slate-800">{selectedBooking.dropLocation?.address}</p>
                      <span className="text-[10px] text-slate-400">{selectedBooking.dropLocation?.city}, {selectedBooking.dropLocation?.state} - {selectedBooking.dropLocation?.pincode}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial & Fare Breakdown */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
                <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider m-0 flex items-center gap-1.5">
                  <DollarSign size={13} className="text-slate-500" /> Fare Breakdown & Settlement
                </h4>
                <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex justify-between text-slate-600">
                    <span>Base Fare:</span>
                    <span className="font-semibold">₹{selectedBooking.fareBreakdown?.baseFare ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Distance Charge{selectedBooking.distanceKm != null ? ` (${selectedBooking.distanceKm} km)` : ''}:</span>
                    <span className="font-semibold">₹{selectedBooking.fareBreakdown?.distanceCharge ?? 0}</span>
                  </div>
                  {selectedBooking.fareBreakdown?.waitingCharge > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Waiting Charge:</span>
                      <span className="font-semibold">₹{selectedBooking.fareBreakdown.waitingCharge}</span>
                    </div>
                  )}
                  {selectedBooking.fareBreakdown?.stopsCharge > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Stops Charge:</span>
                      <span className="font-semibold">₹{selectedBooking.fareBreakdown.stopsCharge}</span>
                    </div>
                  )}
                  {selectedBooking.fareBreakdown?.nightSurge > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Night / Peak Surge:</span>
                      <span className="font-semibold">₹{selectedBooking.fareBreakdown.nightSurge}</span>
                    </div>
                  )}
                  {selectedBooking.fareBreakdown?.platformFee > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Platform Fee:</span>
                      <span className="font-semibold">₹{selectedBooking.fareBreakdown?.platformFee}</span>
                    </div>
                  )}
                  {selectedBooking.fareBreakdown?.discount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount Applied:</span>
                      <span className="font-semibold">-₹{selectedBooking.fareBreakdown?.discount}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-slate-100">
                    <span>Total Freight Fare:</span>
                    <span className="text-[#ff5500]">
                      ₹{Number(selectedBooking.fareBreakdown?.totalFare ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status History Timeline */}
              {selectedBooking.statusHistory && selectedBooking.statusHistory.length > 0 && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs">
                  <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider m-0">
                    Trip Milestone History
                  </h4>
                  <div className="space-y-2 pt-1">
                    {selectedBooking.statusHistory.map((hist, hIdx) => (
                      <div key={hIdx} className="flex items-start justify-between bg-white p-2.5 rounded-xl border border-slate-200 text-[11px]">
                        <div>
                          <span className="font-bold text-slate-800 uppercase block">{hist.status}</span>
                          <span className="text-slate-500">{hist.reason || `Updated by ${hist.changedBy}`}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {new Date(hist.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal 2: Manual Assign Captain Modal ───────────────────────────────── */}
      {isAssignModalOpen && assignBookingTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserCheck size={20} className="text-emerald-700" />
                <h3 className="text-base font-black text-slate-900 m-0">Assign Delivery Captain</h3>
              </div>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 border-none cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleConfirmAssignCaptain} className="space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <span className="font-bold text-slate-700 block">Booking: #{assignBookingTarget.bookingId}</span>
                <span className="text-slate-500 block">Required Vehicle: <strong className="text-slate-800">{assignBookingTarget.vehicleSnapshot?.name}</strong></span>
                <span className="text-slate-500 block">Route: {assignBookingTarget.pickupLocation?.city} → {assignBookingTarget.dropLocation?.city}</span>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Select Approved Captain</label>
                <select
                  value={selectedCaptainId}
                  onChange={(e) => setSelectedCaptainId(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600"
                >
                  <option value="">-- Choose Captain --</option>
                  {availableCaptains.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} ({c.phone}) - {c.vehicleType || 'Partner'} {c.isOnline ? '🟢 Online' : '⚪ Offline'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Captain Payout Amount (₹)</label>
                <input
                  type="number"
                  value={customCaptainPayout}
                  onChange={(e) => setCustomCaptainPayout(e.target.value)}
                  placeholder="e.g. 150"
                  required
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl border-none cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigningCaptain || !selectedCaptainId}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl border-none cursor-pointer disabled:opacity-50 flex items-center gap-1"
                >
                  {assigningCaptain && <RefreshCw size={13} className="animate-spin" />}
                  <span>Confirm Assignment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal 3: Admin Cancel Booking Modal ───────────────────────────────── */}
      {isCancelModalOpen && cancelTargetBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <XCircle size={20} className="text-rose-600" />
                <h3 className="text-base font-black text-slate-900 m-0">Cancel Transport Booking</h3>
              </div>
              <button
                onClick={() => setIsCancelModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 border-none cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleConfirmCancelBooking} className="space-y-4 text-xs">
              <p className="text-slate-600 m-0">
                Are you sure you want to cancel Transport Booking <strong className="text-slate-900">#{cancelTargetBooking.bookingId}</strong>?
              </p>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Reason for Cancellation</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Enter reason for cancelling this trip..."
                  rows={3}
                  required
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-800 outline-none focus:border-rose-600 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl border-none cursor-pointer"
                >
                  Keep Booking
                </button>
                <button
                  type="submit"
                  disabled={cancellingBooking || !cancelReason.trim()}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl border-none cursor-pointer disabled:opacity-50 flex items-center gap-1"
                >
                  {cancellingBooking && <RefreshCw size={13} className="animate-spin" />}
                  <span>Cancel Trip</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransportManagement;
