import React, { useState, useEffect, useMemo } from 'react';
import {
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Truck,
  Store,
  User,
  AlertCircle,
  ArrowRight,
  Eye,
  Package,
  DollarSign,
  Calendar,
  MapPin,
  Phone,
  Filter,
  CheckSquare,
  X,
  Undo2,
  ChevronDown,
} from 'lucide-react';
import { returnService, adminService } from '../../../services/authService';
import { useDebounce } from '../../../hooks/useDebounce';

export const ReturnManagement = () => {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearchQuery = useDebounce(searchInput, 300);
  const [toastMsg, setToastMsg] = useState(null);

  // Available captains for assignment
  const [captains, setCaptains] = useState([]);

  // Modals state
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Captain assign modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningReturn, setAssigningReturn] = useState(null);
  const [selectedCaptainId, setSelectedCaptainId] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  // Verification modal
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyingReturn, setVerifyingReturn] = useState(null);
  const [verifyChecklist, setVerifyChecklist] = useState({
    correctItem: true,
    undamaged: true,
    packagingIntact: true,
    originalTagsPresent: true,
  });
  const [verifyNotes, setVerifyNotes] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);

  const showToast = (text, isError = false) => {
    setToastMsg({ text, isError });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchReturns = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await returnService.getAdminReturns();
      if (res && res.success && Array.isArray(res.returns)) {
        setReturns(res.returns);
      } else {
        setReturns([]);
      }
    } catch (err) {
      console.error('Failed to fetch admin returns:', err);
      showToast('Error loading return requests from server', true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchCaptains = async () => {
    try {
      const res = await adminService.getCaptains(true);
      if (res && res.success && Array.isArray(res.captains)) {
        setCaptains(res.captains.filter((c) => c.status === 'approved' || c.isApproved));
      }
    } catch (err) {
      console.warn('Failed to load captains:', err);
    }
  };

  useEffect(() => {
    fetchReturns();
    fetchCaptains();
  }, []);

  // Quick Action: Approve / Reject
  const handleApproveOrReject = async (returnId, action, rejectionReason = '') => {
    try {
      const res = await returnService.adminApproveReturn(returnId, action, rejectionReason);
      if (res && res.success) {
        showToast(`Return request ${action === 'APPROVE' ? 'Approved' : 'Rejected'} successfully`);
        fetchReturns(true);
      } else {
        showToast(res?.message || 'Action failed', true);
      }
    } catch (err) {
      showToast(err?.response?.data?.message || err?.message || 'Error processing request', true);
    }
  };

  // Quick Action: Assign Captain
  const handleAssignCaptainSubmit = async () => {
    if (!assigningReturn || !selectedCaptainId) {
      showToast('Please select a Captain to assign', true);
      return;
    }
    setAssignLoading(true);
    try {
      const res = await returnService.adminAssignCaptain(
        assigningReturn._id || assigningReturn.returnId,
        selectedCaptainId
      );
      if (res && res.success) {
        showToast('Captain assigned for return pickup!');
        setShowAssignModal(false);
        setAssigningReturn(null);
        setSelectedCaptainId('');
        fetchReturns(true);
      } else {
        showToast(res?.message || 'Assignment failed', true);
      }
    } catch (err) {
      showToast(err?.response?.data?.message || err?.message || 'Failed to assign captain', true);
    } finally {
      setAssignLoading(false);
    }
  };

  // Quick Action: Verify Return (Pass / Fail)
  const handleVerifySubmit = async (outcome) => {
    if (!verifyingReturn) return;
    setVerifyLoading(true);
    try {
      const isPassed = outcome === 'PASSED';
      const res = await returnService.adminVerifyReturn(
        verifyingReturn._id || verifyingReturn.returnId,
        {
          verificationPassed: isPassed,
          outcome,
          checklist: verifyChecklist,
          failureReason: isPassed ? '' : 'Product failed admin quality inspection.',
          verifierNotes: verifyNotes,
          inspectionNotes: verifyNotes,
        }
      );
      if (res && res.success) {
        showToast(
          isPassed
            ? 'Return inspection passed! Refund credited to customer wallet.'
            : 'Return inspection marked as failed.'
        );
        setShowVerifyModal(false);
        setVerifyingReturn(null);
        setVerifyNotes('');
        fetchReturns(true);
      } else {
        showToast(res?.message || 'Verification update failed', true);
      }
    } catch (err) {
      showToast(err?.response?.data?.message || err?.message || 'Verification error', true);
    } finally {
      setVerifyLoading(false);
    }
  };

  // Metrics calculation
  const metrics = useMemo(() => {
    const total = returns.length;
    const requested = returns.filter((r) => r.status === 'REQUESTED').length;
    const activeLogistics = returns.filter((r) =>
      ['APPROVED', 'CAPTAIN_ASSIGNMENT_PENDING', 'CAPTAIN_ASSIGNED', 'PICKUP_STARTED', 'PICKUP_ARRIVED', 'PICKED_UP', 'IN_TRANSIT_TO_SELLER'].includes(r.status)
    ).length;
    const underInspection = returns.filter((r) =>
      ['RECEIVED_BY_SELLER', 'UNDER_VERIFICATION'].includes(r.status)
    ).length;
    const completed = returns.filter((r) =>
      ['VERIFICATION_PASSED', 'REFUNDED', 'COMPLETED'].includes(r.status)
    ).length;
    const rejected = returns.filter((r) =>
      ['REJECTED', 'VERIFICATION_FAILED', 'CANCELLED'].includes(r.status)
    ).length;
    const totalRefundValue = returns
      .filter((r) => ['VERIFICATION_PASSED', 'REFUNDED', 'COMPLETED'].includes(r.status))
      .reduce((sum, r) => sum + (Number(r.refundAmount) || 0), 0);

    return { total, requested, activeLogistics, underInspection, completed, rejected, totalRefundValue };
  }, [returns]);

  // Filtered Returns (debounced)
  const filteredReturns = useMemo(() => {
    return returns.filter((r) => {
      // Tab filter
      if (activeTab === 'REQUESTED' && r.status !== 'REQUESTED') return false;
      if (activeTab === 'PICKUP' && !['APPROVED', 'CAPTAIN_ASSIGNMENT_PENDING', 'CAPTAIN_ASSIGNED', 'PICKUP_STARTED', 'PICKUP_ARRIVED'].includes(r.status)) return false;
      if (activeTab === 'IN_TRANSIT' && !['PICKED_UP', 'IN_TRANSIT_TO_SELLER'].includes(r.status)) return false;
      if (activeTab === 'INSPECTION' && !['RECEIVED_BY_SELLER', 'UNDER_VERIFICATION'].includes(r.status)) return false;
      if (activeTab === 'COMPLETED' && !['VERIFICATION_PASSED', 'REFUNDED', 'COMPLETED'].includes(r.status)) return false;
      if (activeTab === 'REJECTED' && !['REJECTED', 'VERIFICATION_FAILED', 'CANCELLED'].includes(r.status)) return false;

      // Search query
      if (debouncedSearchQuery.trim()) {
        const q = debouncedSearchQuery.toLowerCase();
        const rId = (r.returnId || '').toLowerCase();
        const oId = (r.orderId || '').toLowerCase();
        const pName = (r.productName || r.product?.title || '').toLowerCase();
        const cName = (r.customer?.name || r.user?.name || '').toLowerCase();
        const sName = (r.seller?.storeName || r.seller?.businessName || '').toLowerCase();
        return rId.includes(q) || oId.includes(q) || pName.includes(q) || cName.includes(q) || sName.includes(q);
      }

      return true;
    });
  }, [returns, activeTab, debouncedSearchQuery]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'REQUESTED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200"><Clock size={12} /> Return Requested</span>;
      case 'APPROVED':
      case 'CAPTAIN_ASSIGNMENT_PENDING':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200"><CheckCircle size={12} /> Approved (Pending Captain)</span>;
      case 'CAPTAIN_ASSIGNED':
      case 'PICKUP_STARTED':
      case 'PICKUP_ARRIVED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-800 border border-indigo-200"><Truck size={12} /> Pickup in Progress</span>;
      case 'PICKED_UP':
      case 'IN_TRANSIT_TO_SELLER':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200"><Truck size={12} /> Returning to Seller</span>;
      case 'RECEIVED_BY_SELLER':
      case 'UNDER_VERIFICATION':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-50 text-orange-800 border border-orange-200"><CheckSquare size={12} /> Under Inspection</span>;
      case 'VERIFICATION_PASSED':
      case 'REFUNDED':
      case 'COMPLETED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200"><CheckCircle size={12} /> Refunded & Completed</span>;
      case 'VERIFICATION_FAILED':
      case 'REJECTED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-800 border border-red-200"><XCircle size={12} /> Return Rejected</span>;
      case 'CANCELLED':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">Cancelled</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-50 text-slate-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Toast */}
      {toastMsg && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl border text-sm font-bold flex items-center gap-2 ${
          toastMsg.isError ? 'bg-red-50 text-red-800 border-red-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
        }`}>
          {toastMsg.isError ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#002625] via-[#053835] to-[#0a3d16] text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-white/10">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-[#97fc43]/20 rounded-xl text-[#97fc43]">
              <Undo2 size={20} />
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-[#97fc43]">Reverse Logistics Central</span>
          </div>
          <h1 className="text-2xl font-black">Item-Level Return & Refund Management</h1>
          <p className="text-xs text-white/70 mt-0.5">
            Monitor customer return requests, assign internal delivery captains for doorstep pickup, verify items, and track wallet refunds.
          </p>
        </div>

        <button
          onClick={() => fetchReturns(true)}
          disabled={refreshing}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-bold text-xs backdrop-blur-sm border border-white/20 transition-all cursor-pointer shrink-0 disabled:opacity-50"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          <span>{refreshing ? 'Syncing…' : 'Sync Returns'}</span>
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Returns</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{metrics.total}</p>
        </div>
        <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 shadow-xs">
          <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Pending Approval</p>
          <p className="text-2xl font-black text-amber-900 mt-1">{metrics.requested}</p>
        </div>
        <div className="bg-blue-50/70 p-4 rounded-2xl border border-blue-200 shadow-xs">
          <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Captain Logistics</p>
          <p className="text-2xl font-black text-blue-900 mt-1">{metrics.activeLogistics}</p>
        </div>
        <div className="bg-orange-50/70 p-4 rounded-2xl border border-orange-200 shadow-xs">
          <p className="text-[11px] font-bold text-orange-700 uppercase tracking-wider">Under Inspection</p>
          <p className="text-2xl font-black text-orange-900 mt-1">{metrics.underInspection}</p>
        </div>
        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 shadow-xs">
          <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Refund Completed</p>
          <p className="text-2xl font-black text-emerald-900 mt-1">{metrics.completed}</p>
        </div>
        <div className="bg-emerald-100/50 p-4 rounded-2xl border border-emerald-300 shadow-xs">
          <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Total Refunded</p>
          <p className="text-xl font-black text-emerald-900 mt-1">₹{metrics.totalRefundValue.toFixed(2)}</p>
        </div>
      </div>

      {/* Tabs & Search Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row justify-between gap-3">
          {/* Tab buttons */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'ALL', label: 'All Returns' },
              { id: 'REQUESTED', label: 'Requested' },
              { id: 'PICKUP', label: 'Pickup Pending' },
              { id: 'IN_TRANSIT', label: 'In Transit' },
              { id: 'INSPECTION', label: 'Inspection' },
              { id: 'COMPLETED', label: 'Completed' },
              { id: 'REJECTED', label: 'Rejected' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#002625] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search box */}
          <div className="relative min-w-[280px]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search Return ID, Order ID, Customer, Product…"
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#002625] focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* Returns Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw size={28} className="animate-spin mx-auto text-[#002625]" />
            <p className="text-xs font-bold text-slate-500">Loading return requests…</p>
          </div>
        ) : filteredReturns.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Package size={40} className="mx-auto text-slate-300" />
            <p className="text-sm font-bold text-slate-700">No return requests found</p>
            <p className="text-xs text-slate-400">Try adjusting your status filter or search keywords.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Return ID / Date</th>
                  <th className="py-3.5 px-4">Product / Order</th>
                  <th className="py-3.5 px-4">Customer & Pickup</th>
                  <th className="py-3.5 px-4">Seller Store</th>
                  <th className="py-3.5 px-4">Assigned Captain</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReturns.map((ret) => {
                  const retId = ret.returnId || (ret._id ? `RET-${ret._id.slice(-6).toUpperCase()}` : 'RET');
                  const pName = ret.productName || ret.product?.title || 'Product';
                  const pImg = ret.productImage || ret.product?.mainImage || '';
                  const cName = ret.customer?.name || ret.user?.name || ret.pickupAddress?.fullName || 'Customer';
                  const cPhone = ret.customer?.phone || ret.user?.phone || ret.pickupAddress?.phone || 'N/A';
                  const sName = ret.seller?.storeName || ret.seller?.businessName || 'Sathi Seller Store';
                  const capName = ret.captain?.name || null;
                  const dateStr = ret.createdAt ? new Date(ret.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

                  return (
                    <tr key={ret._id || ret.returnId} className="hover:bg-slate-50/70 transition-colors">
                      {/* ID & Date */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>#{retId}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">{dateStr}</span>
                        {ret.returnOtp && ['APPROVED', 'CAPTAIN_ASSIGNED', 'PICKUP_STARTED', 'PICKUP_ARRIVED'].includes(ret.status) && (
                          <span className="inline-block mt-1 bg-emerald-50 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                            OTP: {ret.returnOtp}
                          </span>
                        )}
                      </td>

                      {/* Product / Order */}
                      <td className="py-3.5 px-4 max-w-[220px]">
                        <div className="flex gap-2.5 items-center">
                          {pImg ? (
                            <img src={pImg} alt={pName} className="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0" />
                          ) : (
                            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                              <Package size={16} className="text-slate-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">{pName}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Qty: <span className="font-bold text-slate-800">{ret.quantity || 1}</span> • Refund: <span className="font-bold text-[#15803d]">₹{ret.refundAmount || 0}</span>
                            </p>
                            <p className="text-[10px] text-blue-600 font-semibold truncate">
                              Order #{ret.orderId || (ret.order?._id ? ret.order._id.slice(-6) : '')}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Customer & Pickup */}
                      <td className="py-3.5 px-4 max-w-[200px]">
                        <p className="font-bold text-slate-900">{cName}</p>
                        <p className="text-[10px] text-slate-500">{cPhone}</p>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5" title={typeof ret.pickupAddress === 'string' ? ret.pickupAddress : ret.pickupAddress?.addressLine1}>
                          {typeof ret.pickupAddress === 'string' ? ret.pickupAddress : `${ret.pickupAddress?.addressLine1 || ''}, ${ret.pickupAddress?.city || ''}`}
                        </p>
                      </td>

                      {/* Seller Store */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <Store size={13} className="text-[#002625]" />
                          <span>{sName}</span>
                        </div>
                        {ret.reason && (
                          <span className="text-[10px] text-red-600 font-medium block truncate max-w-[160px] mt-0.5" title={ret.reason}>
                            Reason: {ret.reason}
                          </span>
                        )}
                      </td>

                      {/* Assigned Captain */}
                      <td className="py-3.5 px-4">
                        {capName ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full bg-[#366b00]/20 text-[#366b00] flex items-center justify-center font-bold text-[10px]">
                              {capName.slice(0, 1)}
                            </div>
                            <span className="font-bold text-slate-800">{capName}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-amber-600 font-semibold italic">Unassigned</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        {getStatusBadge(ret.status)}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Approve/Reject for REQUESTED */}
                          {ret.status === 'REQUESTED' && (
                            <>
                              <button
                                onClick={() => handleApproveOrReject(ret._id || ret.returnId, 'APPROVE')}
                                title="Approve Return Request"
                                className="p-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <CheckCircle size={15} />
                              </button>
                              <button
                                onClick={() => {
                                  const reason = window.prompt('Enter rejection reason:');
                                  if (reason) handleApproveOrReject(ret._id || ret.returnId, 'REJECT', reason);
                                }}
                                title="Reject Return Request"
                                className="p-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <XCircle size={15} />
                              </button>
                            </>
                          )}

                          {/* Assign Captain */}
                          {['APPROVED', 'CAPTAIN_ASSIGNMENT_PENDING', 'CAPTAIN_ASSIGNED'].includes(ret.status) && (
                            <button
                              onClick={() => {
                                setAssigningReturn(ret);
                                setSelectedCaptainId(ret.captain?._id || ret.captainId || '');
                                setShowAssignModal(true);
                              }}
                              title="Assign / Reassign Captain"
                              className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Truck size={12} />
                              <span>{ret.captain ? 'Reassign' : 'Assign'}</span>
                            </button>
                          )}

                          {/* Inspect / Verify (if received at seller store or previously failed) */}
                          {['RECEIVED_BY_SELLER', 'UNDER_VERIFICATION', 'VERIFICATION_FAILED', 'REJECTED'].includes(ret.status) && (
                            <button
                              onClick={() => {
                                setVerifyingReturn(ret);
                                setShowVerifyModal(true);
                              }}
                              title={['VERIFICATION_FAILED', 'REJECTED'].includes(ret.status) ? 'Re-inspect & Override Refund' : 'Quality Inspection & Refund'}
                              className={`px-2.5 py-1 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-xs ${
                                ['VERIFICATION_FAILED', 'REJECTED'].includes(ret.status)
                                  ? 'bg-amber-600 hover:bg-amber-700'
                                  : 'bg-[#366b00] hover:bg-[#2d5800]'
                              }`}
                            >
                              <CheckSquare size={12} />
                              <span>{['VERIFICATION_FAILED', 'REJECTED'].includes(ret.status) ? 'Re-Inspect' : 'Inspect'}</span>
                            </button>
                          )}

                          {/* View details */}
                          <button
                            onClick={() => {
                              setSelectedReturn(ret);
                              setShowDetailsModal(true);
                            }}
                            title="View Full Details"
                            className="p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAL 1: ASSIGN CAPTAIN MODAL ── */}
      {showAssignModal && assigningReturn && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-3xl max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Truck size={18} className="text-[#366b00]" />
                <span>Assign Captain for Return Pickup</span>
              </h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs space-y-1">
              <p className="font-bold text-slate-800">
                Return: #{assigningReturn.returnId}
              </p>
              <p className="text-slate-600">
                Item: {assigningReturn.productName} (Qty: {assigningReturn.quantity || 1})
              </p>
              <p className="text-slate-600">
                Customer: {assigningReturn.customer?.name || assigningReturn.user?.name}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Select Captain:</label>
              <select
                value={selectedCaptainId}
                onChange={(e) => setSelectedCaptainId(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#366b00]"
              >
                <option value="">-- Choose an Approved Captain --</option>
                {captains.map((cap) => (
                  <option key={cap._id} value={cap._id}>
                    {cap.name} ({cap.phone || 'No phone'}) - {cap.vehicleType || 'Bike'}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssignCaptainSubmit}
                disabled={assignLoading || !selectedCaptainId}
                className="flex-1 py-2.5 bg-[#366b00] text-white font-bold text-xs rounded-xl hover:bg-[#2d5800] transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md"
              >
                {assignLoading ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                <span>Assign & Dispatch</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2: QUALITY INSPECTION & VERIFICATION MODAL ── */}
      {showVerifyModal && verifyingReturn && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-3xl max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <CheckSquare size={18} className="text-[#366b00]" />
                <span>Return Quality Inspection Checklist</span>
              </h3>
              <button
                onClick={() => setShowVerifyModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="font-bold text-slate-800">Return ID: #{verifyingReturn.returnId}</span>
                <span className="font-bold text-[#15803d]">Refund: ₹{verifyingReturn.refundAmount}</span>
              </div>
              <p className="text-slate-600">Product: {verifyingReturn.productName} (Qty: {verifyingReturn.quantity || 1})</p>
              <p className="text-slate-600">Reason: {verifyingReturn.reason}</p>
            </div>

            {/* Checklist items */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-slate-700 block">Inspection Checklist:</label>
              {[
                { key: 'correctItem', label: 'Item matches original order SKU / title' },
                { key: 'undamaged', label: 'Item is undamaged & in acceptable condition' },
                { key: 'packagingIntact', label: 'Original product packaging intact / box present' },
                { key: 'originalTagsPresent', label: 'Security tags / labels attached (if applicable)' },
              ].map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center gap-2.5 p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer text-xs"
                >
                  <input
                    type="checkbox"
                    checked={verifyChecklist[key]}
                    onChange={(e) =>
                      setVerifyChecklist((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                    className="w-4 h-4 text-[#366b00] rounded focus:ring-0 cursor-pointer"
                  />
                  <span className="font-medium text-slate-800">{label}</span>
                </label>
              ))}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">Inspection Notes (Optional):</label>
              <textarea
                value={verifyNotes}
                onChange={(e) => setVerifyNotes(e.target.value)}
                placeholder="Enter quality check remarks or condition notes…"
                rows={2}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#366b00]"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleVerifySubmit('FAILED')}
                disabled={verifyLoading}
                className="flex-1 py-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                Reject / Fail Check
              </button>
              <button
                type="button"
                onClick={() => handleVerifySubmit('PASSED')}
                disabled={verifyLoading}
                className="flex-1 py-3 bg-[#15803d] hover:bg-[#166534] text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-colors flex items-center justify-center gap-1.5"
              >
                {verifyLoading ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                <span>Pass & Trigger Refund</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: FULL DETAILS & TIMELINE DRAWER ── */}
      {showDetailsModal && selectedReturn && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-3xl max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-lg text-slate-900">Return #{selectedReturn.returnId}</h3>
                <p className="text-xs text-slate-400">Order #{selectedReturn.orderId}</p>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Status Banner */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Current Stage</span>
                <div className="mt-1">{getStatusBadge(selectedReturn.status)}</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Refund Amount</span>
                <span className="text-xl font-black text-[#15803d] block mt-0.5">₹{selectedReturn.refundAmount}</span>
              </div>
            </div>

            {/* Product & Order Info */}
            <div className="space-y-2">
              <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider">Item Details</h4>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex gap-3 items-center">
                {selectedReturn.productImage && (
                  <img
                    src={selectedReturn.productImage}
                    alt={selectedReturn.productName}
                    className="w-14 h-14 object-cover rounded-xl border border-slate-200"
                  />
                )}
                <div className="flex-1">
                  <p className="font-bold text-sm text-slate-900">{selectedReturn.productName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Unit Price: ₹{selectedReturn.unitPrice} • Return Qty: {selectedReturn.quantity}
                  </p>
                  <p className="text-xs text-red-600 font-medium mt-1">Reason: {selectedReturn.reason}</p>
                  {selectedReturn.customerNotes && (
                    <p className="text-[11px] text-slate-500 italic mt-0.5">"{selectedReturn.customerNotes}"</p>
                  )}
                </div>
              </div>
            </div>

            {/* Timeline Audit Logs */}
            <div className="space-y-2 pt-2">
              <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider">Return Audit History</h4>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5 max-h-48 overflow-y-auto">
                {Array.isArray(selectedReturn.timeline) && selectedReturn.timeline.length > 0 ? (
                  selectedReturn.timeline.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs">
                      <div className="w-2 h-2 rounded-full bg-[#366b00] mt-1.5 shrink-0" />
                      <div>
                        <p className="font-bold text-slate-800">{item.status}</p>
                        <p className="text-[11px] text-slate-500">{item.note || item.message}</p>
                        <span className="text-[10px] text-slate-400">
                          {item.timestamp ? new Date(item.timestamp).toLocaleString('en-IN') : ''}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic">No timeline entries recorded yet.</p>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              {selectedReturn.status === 'REQUESTED' && (
                <>
                  <button
                    onClick={() => {
                      const reason = window.prompt('Enter rejection reason:');
                      if (reason) {
                        handleApproveOrReject(selectedReturn._id || selectedReturn.returnId, 'REJECT', reason);
                        setShowDetailsModal(false);
                      }
                    }}
                    className="flex-1 py-2.5 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs rounded-xl border border-rose-200 cursor-pointer"
                  >
                    Reject Request
                  </button>
                  <button
                    onClick={() => {
                      handleApproveOrReject(selectedReturn._id || selectedReturn.returnId, 'APPROVE');
                      setShowDetailsModal(false);
                    }}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle size={14} />
                    Approve & Dispatch
                  </button>
                </>
              )}

              {['APPROVED', 'CAPTAIN_ASSIGNMENT_PENDING', 'CAPTAIN_ASSIGNED'].includes(selectedReturn.status) && (
                <button
                  onClick={() => {
                    setAssigningReturn(selectedReturn);
                    setSelectedCaptainId(selectedReturn.captain?._id || selectedReturn.captainId || '');
                    setShowDetailsModal(false);
                    setShowAssignModal(true);
                  }}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Truck size={14} />
                  <span>{selectedReturn.captain ? 'Reassign Captain' : 'Assign Captain'}</span>
                </button>
              )}

              {['RECEIVED_BY_SELLER', 'UNDER_VERIFICATION', 'VERIFICATION_FAILED', 'REJECTED'].includes(selectedReturn.status) && (
                <button
                  onClick={() => {
                    setVerifyingReturn(selectedReturn);
                    setShowDetailsModal(false);
                    setShowVerifyModal(true);
                  }}
                  className="flex-1 py-2.5 bg-[#366b00] hover:bg-[#2d5800] text-white font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <CheckSquare size={14} />
                  <span>{['VERIFICATION_FAILED', 'REJECTED'].includes(selectedReturn.status) ? 'Re-Inspect & Trigger Refund' : 'Perform Inspection & Trigger Refund'}</span>
                </button>
              )}

              <button
                onClick={() => setShowDetailsModal(false)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReturnManagement;
