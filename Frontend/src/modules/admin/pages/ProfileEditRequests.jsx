import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  Store, 
  Truck, 
  Search, 
  Filter, 
  RefreshCw, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Eye, 
  AlertTriangle, 
  ShieldCheck, 
  FileText, 
  Building2, 
  UserCheck, 
  Check, 
  X, 
  ArrowRight,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Layers,
  Sparkles
} from 'lucide-react';
import { profileEditRequestService } from '../../../services/authService';
import { useDebounce } from '../../../hooks/useDebounce';

export const ProfileEditRequests = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({
    totalPending: 0,
    sellerPending: 0,
    captainPending: 0,
    userPending: 0,
    totalApproved: 0,
    totalRejected: 0,
  });

  // Filter & Pagination States
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearchQuery = useDebounce(searchInput, 300);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Reset page when debounced search query changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchQuery]);

  // Selected Request for Modal
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [modalFeedback, setModalFeedback] = useState({ type: '', message: '' });

  // Lightbox for document zoom
  const [lightboxImage, setLightboxImage] = useState(null);

  const fetchRequests = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = {
        role: roleFilter,
        status: statusFilter,
        search: debouncedSearchQuery,
        page,
        limit: 10,
      };

      const res = await profileEditRequestService.getAdminEditRequests(params);
      if (res && res.success) {
        setRequests(res.requests || []);
        setStats(res.stats || {});
        setTotalPages(res.pages || 1);
        setTotalCount(res.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch profile edit requests:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [roleFilter, statusFilter, debouncedSearchQuery, page]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleOpenModal = (req) => {
    setSelectedRequest(req);
    setAdminNote('');
    setModalFeedback({ type: '', message: '' });
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    setActionLoading(true);
    setModalFeedback({ type: '', message: '' });

    try {
      const res = await profileEditRequestService.approveEditRequest(selectedRequest._id);
      if (res && res.success) {
        setModalFeedback({ type: 'success', message: 'Profile updates approved and applied successfully!' });
        setTimeout(() => {
          setSelectedRequest(null);
          fetchRequests(true);
        }, 1200);
      } else {
        setModalFeedback({ type: 'error', message: res.message || 'Approval failed' });
      }
    } catch (err) {
      console.error('Approve error:', err);
      setModalFeedback({ type: 'error', message: err.response?.data?.message || 'Server error approving request.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    setActionLoading(true);
    setModalFeedback({ type: '', message: '' });

    try {
      const res = await profileEditRequestService.rejectEditRequest(selectedRequest._id, adminNote);
      if (res && res.success) {
        setModalFeedback({ type: 'success', message: 'Edit request rejected.' });
        setTimeout(() => {
          setSelectedRequest(null);
          fetchRequests(true);
        }, 1200);
      } else {
        setModalFeedback({ type: 'error', message: res.message || 'Rejection failed' });
      }
    } catch (err) {
      console.error('Reject error:', err);
      setModalFeedback({ type: 'error', message: err.response?.data?.message || 'Server error rejecting request.' });
    } finally {
      setActionLoading(false);
    }
  };

  const formatValueDisplay = (val, type = 'normal') => {
    if (val === null || val === undefined || val === '') {
      if (type === 'old') {
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-500 italic">Not Previously Set (Empty)</span>;
      }
      if (type === 'new') {
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 italic">Removed / Cleared</span>;
      }
      return <span className="text-slate-400 italic font-normal">None / Empty</span>;
    }
    if (typeof val === 'boolean') {
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${val ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
          {val ? 'Yes' : 'No'}
        </span>
      );
    }
    if (Array.isArray(val)) {
      if (val.length === 0) {
        return type === 'old' 
          ? <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-500 italic">None Selected</span>
          : <span className="text-slate-400 italic">None</span>;
      }
      return (
        <div className="flex flex-wrap gap-1">
          {val.map((item, idx) => (
            <span key={idx} className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
              type === 'new' ? 'bg-emerald-100 text-emerald-900 border border-emerald-200' : 'bg-slate-100 text-slate-800'
            }`}>
              {String(item)}
            </span>
          ))}
        </div>
      );
    }
    if (typeof val === 'object') {
      return <pre className="text-[10px] font-mono whitespace-pre-wrap bg-white p-2 rounded border border-slate-200">{JSON.stringify(val, null, 2)}</pre>;
    }
    // Check if it's an image URL
    if (typeof val === 'string' && (val.startsWith('http') || val.startsWith('data:image')) && (val.includes('cloudinary') || val.includes('/uploads/') || val.startsWith('data:image'))) {
      return (
        <div className="flex items-center gap-2.5">
          <img 
            src={val} 
            alt="Preview" 
            className="w-14 h-14 rounded-lg object-cover border border-slate-200 cursor-pointer shadow-2xs hover:scale-105 transition-transform bg-white" 
            onClick={() => setLightboxImage(val)}
          />
          <button
            type="button"
            onClick={() => setLightboxImage(val)}
            className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg border border-blue-200 cursor-pointer transition-colors"
          >
            <Eye size={12} /> View Full
          </button>
        </div>
      );
    }
    return (
      <span className={type === 'new' ? 'text-emerald-900 font-bold' : 'text-slate-700 font-medium'}>
        {String(val)}
      </span>
    );
  };

  const getRoleBadge = (role) => {
    switch (role?.toLowerCase()) {
      case 'seller':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-200">
            <Store size={12} /> Seller Store
          </span>
        );
      case 'captain':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <Truck size={12} /> Delivery Captain
          </span>
        );
      case 'user':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <Users size={12} /> Customer
          </span>
        );
    }
  };

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 size={12} /> Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
            <XCircle size={12} /> Rejected
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
            <Clock size={12} /> Pending Verification
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn font-sans">
      
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-6 sm:p-7 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider bg-white/10 text-white/90 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-[#ff7526]" /> PROFILE VERIFICATION QUEUE
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-2 tracking-tight">
            Profile Edit & Verification Requests
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Review, compare, and authorize live profile, banking, tax, and KYC document updates submitted by Sellers, Captains, and Customers.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => fetchRequests(true)}
            disabled={refreshing}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Queue'}</span>
          </button>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total Pending</span>
            <Clock size={18} className="text-amber-500" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900">{stats.totalPending || 0}</p>
          <span className="text-[11px] text-amber-700 font-semibold block">Awaiting administrator audit</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Seller Edits</span>
            <Store size={18} className="text-[#ff7526]" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-[#ff7526]">{stats.sellerPending || 0}</p>
          <span className="text-[11px] text-slate-500 font-medium block">Bank, GST & store info</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Captain Edits</span>
            <Truck size={18} className="text-emerald-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600">{stats.captainPending || 0}</p>
          <span className="text-[11px] text-slate-500 font-medium block">KYC, Vehicle & payout</span>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Customer Edits</span>
            <Users size={18} className="text-blue-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-blue-600">{stats.userPending || 0}</p>
          <span className="text-[11px] text-slate-500 font-medium block">Personal contact & DOB</span>
        </div>
      </div>

      {/* Control Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Role Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl flex-wrap">
            {[
              { id: 'all', label: 'All Roles', count: totalCount },
              { id: 'seller', label: 'Sellers', count: stats.sellerPending },
              { id: 'captain', label: 'Captains', count: stats.captainPending },
              { id: 'user', label: 'Customers', count: stats.userPending },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setRoleFilter(tab.id); setPage(1); }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none flex items-center gap-1.5 ${
                  roleFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 bg-transparent'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { id: 'pending', label: 'Pending Review' },
              { id: 'approved', label: 'Approved' },
              { id: 'rejected', label: 'Rejected' },
              { id: 'all', label: 'All Statuses' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setStatusFilter(tab.id); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-none ${
                  statusFilter === tab.id
                    ? 'bg-white text-[#ff7526] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 bg-transparent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name, phone, email..."
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-[#ff7526] focus:bg-white transition-all"
            />
          </div>

        </div>
      </div>

      {/* Main Table Content */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading && !refreshing ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <Loader2 size={32} className="animate-spin text-[#ff7526]" />
            <p className="text-xs font-semibold text-slate-500">Loading edit requests...</p>
          </div>
        ) : requests.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-bold">
                  <th className="px-5 py-3.5">Requester Identity</th>
                  <th className="px-5 py-3.5">Role</th>
                  <th className="px-5 py-3.5">Modified Fields</th>
                  <th className="px-5 py-3.5">Submitted On</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {requests.map((req) => (
                  <tr key={req._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{req.requesterName || 'Partner'}</h4>
                        <div className="flex items-center gap-2 mt-0.5 text-slate-500 text-[11px]">
                          <span>📞 +91 {req.requesterPhone}</span>
                          {req.requesterEmail && <span>• ✉️ {req.requesterEmail}</span>}
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      {getRoleBadge(req.requesterRole)}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {req.changedFields && req.changedFields.length > 0 ? (
                          req.changedFields.map((f, idx) => (
                            <span 
                              key={idx} 
                              className="px-2 py-0.5 bg-orange-50 text-[#ff7526] border border-orange-200/70 rounded-md text-[10px] font-bold"
                            >
                              {f.label || f.field}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400">Profile updates</span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <span className="font-medium text-slate-600 block">
                        {new Date(req.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {new Date(req.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      {getStatusBadge(req.status)}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => handleOpenModal(req)}
                        className="px-3.5 py-1.5 bg-[#ff7526] hover:bg-[#e65507] text-white rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer border-none inline-flex items-center gap-1.5"
                      >
                        <Eye size={13} />
                        <span>Review & Compare</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-20 text-center space-y-3">
            <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <CheckCircle2 size={28} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">No Profile Edit Requests Found</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                There are currently no profile update requests matching your selected filter criteria.
              </p>
            </div>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>Showing page {page} of {totalPages} ({totalCount} total requests)</span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────────── */}
      {/* 🔍 DIFF & APPROVAL COMPARISON MODAL                       */}
      {/* ────────────────────────────────────────────────────────── */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-5 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh] border border-slate-200">
            
            {/* Modal Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <ShieldCheck size={20} className="text-[#ff7526]" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-base tracking-tight">Audit Profile Modification Request</h3>
                    {getRoleBadge(selectedRequest.requesterRole)}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Requester: <strong className="text-white">{selectedRequest.requesterName}</strong> (+91 {selectedRequest.requesterPhone})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors border-none cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Feedback Alert */}
            {modalFeedback.message && (
              <div className={`px-5 py-3 text-xs font-bold flex items-center gap-2 ${
                modalFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200' : 'bg-red-50 text-red-800 border-b border-red-200'
              }`}>
                {modalFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                <span>{modalFeedback.message}</span>
              </div>
            )}

            {/* Modal Body: Side-by-Side Diff Table */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
              
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Submission Timestamp</span>
                  <p className="font-bold text-slate-800 mt-0.5">
                    {new Date(selectedRequest.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Current Status</span>
                  <div className="mt-0.5">{getStatusBadge(selectedRequest.status)}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Fields Changed</span>
                  <p className="font-bold text-[#ff7526] mt-0.5">{selectedRequest.changedFields?.length || 0} fields modified</p>
                </div>
              </div>

              {/* Side-by-Side Comparison Matrix */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers size={14} className="text-[#ff7526]" /> Field-by-Field Diff Comparison
                </h4>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                        <th className="px-4 py-3 w-1/4">Modified Field</th>
                        <th className="px-4 py-3 w-3/8 bg-red-50/40 text-red-800">Current / Previous Value</th>
                        <th className="px-4 py-3 w-3/8 bg-emerald-50/40 text-emerald-800">Proposed New Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {selectedRequest.changedFields && selectedRequest.changedFields.length > 0 ? (
                        selectedRequest.changedFields.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3.5 font-bold text-slate-800 align-top">
                              <span className="block text-slate-900">{item.label}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{item.field}</span>
                            </td>

                            {/* Previous Value */}
                            <td className="px-4 py-3.5 bg-red-50/20 text-slate-600 align-top border-l border-r border-slate-100">
                              {formatValueDisplay(item.oldValue, 'old')}
                            </td>

                            {/* New Proposed Value */}
                            <td className="px-4 py-3.5 bg-emerald-50/30 text-slate-900 font-semibold align-top">
                              {formatValueDisplay(item.newValue, 'new')}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="3" className="px-4 py-8 text-center text-slate-400">
                            No specific field diff details available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Admin Note Input (For Rejections or Approvals) */}
              {selectedRequest.status === 'pending' && (
                <div className="space-y-1.5 pt-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Administrator Note / Rejection Reason <span className="text-slate-400 font-normal">(Optional for approval, required for rejection)</span>
                  </label>
                  <input
                    type="text"
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="e.g. Approved after reviewing PAN & GST certificate with ministry portal."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#ff7526] focus:bg-white transition-all"
                  />
                </div>
              )}

              {selectedRequest.adminNote && (
                <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Admin Note On Record:</span>
                  <p className="text-slate-800 font-medium">{selectedRequest.adminNote}</p>
                </div>
              )}

            </div>

            {/* Modal Action Controls Footer */}
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold rounded-xl cursor-pointer w-full sm:w-auto"
              >
                Close Window
              </button>

              {selectedRequest.status === 'pending' && (
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleReject}
                    className="flex-1 sm:flex-initial px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer border-none shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={15} />}
                    <span>Reject Request</span>
                  </button>

                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={handleApprove}
                    className="flex-1 sm:flex-initial px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer border-none shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={15} />}
                    <span>Approve & Update Profile</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Fullscreen Lightbox Preview for Documents */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-[60] bg-black/85 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-3xl max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxImage} alt="Fullscreen View" className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl" />
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white text-slate-900 flex items-center justify-center font-bold shadow-lg cursor-pointer border-none"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProfileEditRequests;
