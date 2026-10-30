import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign, CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw,
  Search, Filter, Calendar, ArrowUpRight, ShieldCheck, History,
  FileText, ExternalLink, Eye, X, Edit3, Sparkles, Check, ToggleLeft, ToggleRight, Loader2
} from 'lucide-react';
import { sellerRegistrationFeeService } from '../../../services/authService';

const STATUS_BADGES = {
  paid: { label: 'Paid', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle },
  pending: { label: 'Pending', bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  failed: { label: 'Failed', bg: 'bg-rose-50 text-rose-700 border-rose-200', icon: XCircle },
  refunded: { label: 'Refunded', bg: 'bg-purple-50 text-purple-700 border-purple-200', icon: ArrowUpRight },
};

export const SellerRegistrationFeeAdmin = () => {
  // State for Fee Configuration
  const [config, setConfig] = useState(null);
  const [stats, setStats] = useState({ totalPaidAmount: 0, totalPaidCount: 0, totalPendingCount: 0 });
  const [loadingConfig, setLoadingConfig] = useState(true);

  // State for Payments List
  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loadingPayments, setLoadingPayments] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Edit Form State
  const [editForm, setEditForm] = useState({
    amount: 150,
    isActive: true,
    description: '',
    changeReason: '',
  });
  const [savingConfig, setSavingConfig] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState({ type: '', text: '' });

  // Fetch Fee Configuration
  const fetchConfig = async () => {
    try {
      setLoadingConfig(true);
      const res = await sellerRegistrationFeeService.adminGetConfig();
      if (res && res.success) {
        setConfig(res.config);
        if (res.stats) setStats(res.stats);
        setEditForm({
          amount: res.config.amount,
          isActive: res.config.isActive,
          description: res.config.description || '',
          changeReason: '',
        });
      }
    } catch (err) {
      console.error('Failed to load fee configuration:', err);
    } finally {
      setLoadingConfig(false);
    }
  };

  // Fetch Payments List
  const fetchPayments = async (page = 1) => {
    try {
      setLoadingPayments(true);
      const params = {
        page,
        limit: pagination.limit,
        status: statusFilter,
        search: searchQuery,
        startDate,
        endDate,
      };
      const res = await sellerRegistrationFeeService.adminGetPayments(params);
      if (res && res.success) {
        setPayments(res.payments || []);
        setPagination({
          page: res.pagination?.page || 1,
          limit: res.pagination?.limit || 15,
          total: res.pagination?.total || 0,
          totalPages: res.pagination?.totalPages || 1,
        });
        if (res.stats) {
          setStats(res.stats);
        }
      }
    } catch (err) {
      console.error('Failed to load fee payments:', err);
    } finally {
      setLoadingPayments(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    fetchPayments(1);
  }, [statusFilter, startDate, endDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchPayments(1);
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (editForm.amount === '' || Number(editForm.amount) < 0) {
      setFeedbackMsg({ type: 'error', text: 'Registration fee amount must be 0 or greater.' });
      return;
    }

    try {
      setSavingConfig(true);
      setFeedbackMsg({ type: '', text: '' });
      const res = await sellerRegistrationFeeService.adminUpdateConfig({
        amount: Number(editForm.amount),
        isActive: editForm.isActive,
        description: editForm.description,
        changeReason: editForm.changeReason || 'Admin updated registration fee configuration',
      });

      if (res && res.success) {
        setConfig(res.config);
        setIsEditModalOpen(false);
        setFeedbackMsg({ type: 'success', text: 'Seller registration fee updated successfully.' });
        setTimeout(() => setFeedbackMsg({ type: '', text: '' }), 4000);
      } else {
        setFeedbackMsg({ type: 'error', text: res?.message || 'Failed to update fee configuration.' });
      }
    } catch (err) {
      console.error('Update fee error:', err);
      setFeedbackMsg({ type: 'error', text: err.response?.data?.message || 'Error updating fee.' });
    } finally {
      setSavingConfig(false);
    }
  };

  // Toggle Fee Active/Inactive directly
  const handleToggleActive = async () => {
    if (!config) return;
    try {
      const newActive = !config.isActive;
      const res = await sellerRegistrationFeeService.adminUpdateConfig({
        amount: config.amount,
        isActive: newActive,
        description: config.description,
        changeReason: `Admin ${newActive ? 'activated' : 'deactivated'} registration fee requirement`,
      });
      if (res && res.success) {
        setConfig(res.config);
        setFeedbackMsg({
          type: 'success',
          text: `Registration fee ${newActive ? 'activated' : 'deactivated'} successfully.`,
        });
        setTimeout(() => setFeedbackMsg({ type: '', text: '' }), 3000);
      }
    } catch (err) {
      console.error('Toggle status error:', err);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 text-orange-700 text-xs font-bold uppercase tracking-wider mb-2 border border-orange-100">
            <Sparkles size={14} className="text-[#ff5500]" />
            Seller Onboarding Finance
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Seller Registration Fee</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage dynamic one-time onboarding fees and inspect seller registration payment records.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchConfig();
              fetchPayments(pagination.page);
            }}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-2 transition-colors cursor-pointer border-none"
            title="Refresh"
          >
            <RefreshCw size={15} />
            Refresh
          </button>

          <button
            onClick={() => {
              if (config) {
                setEditForm({
                  amount: config.amount,
                  isActive: config.isActive,
                  description: config.description || '',
                  changeReason: '',
                });
              }
              setIsEditModalOpen(true);
            }}
            className="px-4 py-2.5 bg-[#ff5500] hover:bg-[#e64d00] text-white font-bold text-xs rounded-xl flex items-center gap-2 transition-colors cursor-pointer border-none shadow-sm"
          >
            <Edit3 size={15} />
            Edit Fee Config
          </button>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackMsg.text && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-2.5 animate-in fade-in ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {feedbackMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Fee Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Active Fee</span>
            <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#ff5500] flex items-center justify-center">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="mt-3">
            {loadingConfig ? (
              <div className="h-8 w-20 bg-slate-100 animate-pulse rounded"></div>
            ) : (
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-slate-900">₹{config?.amount ?? 150}</span>
                <span className="text-xs font-semibold text-slate-400">/ seller</span>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Status:</span>
              <button
                onClick={handleToggleActive}
                className={`font-bold inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] cursor-pointer border-none ${
                  config?.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {config?.isActive ? <ToggleRight size={16} className="text-emerald-600" /> : <ToggleLeft size={16} />}
                {config?.isActive ? 'Active' : 'Disabled (Waived)'}
              </button>
            </div>
          </div>
        </div>

        {/* Total Revenue Collected */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Revenue</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900">
              ₹{Number(stats.totalPaidAmount || 0).toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Collected from verified registrations
            </p>
          </div>
        </div>

        {/* Total Paid Sellers */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Paid Sellers</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900">
              {stats.totalPaidCount || 0}
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Sellers cleared registration fee
            </p>
          </div>
        </div>

        {/* History & Audit Quick Link */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Audit History</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <History size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">
              {config?.history?.length || 0} Changes
            </div>
            <button
              onClick={() => setIsHistoryModalOpen(true)}
              className="mt-2 text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 bg-transparent border-none cursor-pointer p-0"
            >
              View Configuration Log &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Payment Transactions Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 m-0">Registration Fee Transactions</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing {payments.length} of {pagination.total} seller registration fee transactions
            </p>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <form onSubmit={handleSearchSubmit} className="relative min-w-[240px]">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search seller, store, phone, order ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-[#ff5500] focus:bg-white transition-all"
              />
            </form>

            {/* Status Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#ff5500] cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="paid">Paid Only</option>
              <option value="pending">Pending Only</option>
              <option value="failed">Failed Only</option>
              <option value="refunded">Refunded Only</option>
            </select>

            {/* Date Filters */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-[#ff5500]"
                title="Start Date"
              />
              <span>to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-[#ff5500]"
                title="End Date"
              />
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          {loadingPayments ? (
            <div className="py-16 flex flex-col items-center justify-center">
              <Loader2 size={30} className="animate-spin text-[#ff5500] mb-2" />
              <p className="text-xs text-slate-500 font-medium">Loading transactions...</p>
            </div>
          ) : payments.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <FileText size={36} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">No payment records found</p>
              <p className="text-xs text-slate-400 mt-1">Try adjusting your search query or filters.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Seller / Store</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Payment Type</th>
                  <th className="py-3 px-4">Transaction / Order ID</th>
                  <th className="py-3 px-4">Payment Status</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 font-medium">
                {payments.map((p) => {
                  const badge = STATUS_BADGES[p.status] || STATUS_BADGES.pending;
                  const BadgeIcon = badge.icon;
                  const sellerName = p.sellerDetails?.businessName || p.sellerId?.businessName || '—';
                  const ownerName = p.sellerDetails?.ownerName || p.sellerId?.ownerName || '';
                  const phone = p.sellerDetails?.phone || p.sellerId?.phone || '';

                  return (
                    <tr key={p._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{sellerName}</div>
                        <div className="text-[11px] text-slate-500">
                          {ownerName && <span>{ownerName} &bull; </span>}
                          <span>+91 {phone}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-black text-slate-900 text-sm">₹{p.amount}</span>
                        <span className="text-[10px] text-slate-400 block uppercase font-bold">{p.currency || 'INR'}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 text-[10px] font-mono font-bold border border-orange-200">
                          {p.paymentType}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                        <div
                          className="truncate max-w-[180px] font-bold text-slate-800"
                          title={p.transactionReference || p.gatewayOrderId || p.razorpayOrderId}
                        >
                          Txn: {p.transactionReference || p.gatewayOrderId || p.razorpayOrderId || '—'}
                        </div>
                        <div
                          className="truncate max-w-[180px] text-[10px] text-slate-500"
                          title={p.gatewayOrderId || p.razorpayOrderId}
                        >
                          Ord: {p.gatewayOrderId || p.razorpayOrderId || '—'}
                        </div>
                        {(p.gatewayPaymentId || p.razorpayPaymentId) && (
                          <div
                            className="text-[10px] text-slate-400 truncate max-w-[180px]"
                            title={p.gatewayPaymentId || p.razorpayPaymentId}
                          >
                            Pay: {p.gatewayPaymentId || p.razorpayPaymentId}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badge.bg}`}>
                          <BadgeIcon size={12} />
                          {badge.label}
                        </span>
                        {p.failureReason && (
                          <div className="text-[10px] text-rose-600 truncate max-w-[140px] mt-0.5" title={p.failureReason}>
                            {p.failureReason}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        {formatDate(p.createdAt)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedPayment(p);
                            setIsDetailsModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors cursor-pointer border-none"
                          title="View Details"
                        >
                          <Eye size={13} />
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total records)
            </span>
            <div className="flex gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => fetchPayments(pagination.page - 1)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold disabled:opacity-40 cursor-pointer border-none"
              >
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchPayments(pagination.page + 1)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold disabled:opacity-40 cursor-pointer border-none"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Fee Configuration Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-orange-50 text-[#ff5500] rounded-lg">
                  <DollarSign size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 m-0">Edit Registration Fee</h3>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Fee Amount (₹ INR) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={editForm.amount}
                    onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                    className="w-full pl-8 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-[#ff5500] transition-all"
                    placeholder="e.g. 150, 199, 299"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Future seller registrations will be charged this exact amount. Set to 0 or disable if waived.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Fee Status
                </label>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="isActive"
                      checked={editForm.isActive === true}
                      onChange={() => setEditForm({ ...editForm, isActive: true })}
                      className="text-[#ff5500] focus:ring-[#ff5500]"
                    />
                    <span className="text-xs font-semibold text-slate-800">Active (Fee Mandatory)</span>
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="isActive"
                      checked={editForm.isActive === false}
                      onChange={() => setEditForm({ ...editForm, isActive: false })}
                      className="text-[#ff5500] focus:ring-[#ff5500]"
                    />
                    <span className="text-xs font-semibold text-slate-800">Inactive (Fee Waived)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Public Description <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-[#ff5500]"
                  placeholder="e.g. One-time platform onboarding & document verification fee"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Reason for Change / Admin Note *
                </label>
                <textarea
                  rows={2}
                  required
                  value={editForm.changeReason}
                  onChange={(e) => setEditForm({ ...editForm, changeReason: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-[#ff5500]"
                  placeholder="e.g. Updating onboarding price for Q3 promotion"
                />
                <p className="text-[11px] text-slate-400 mt-0.5">
                  This note is preserved in the audit log along with your admin timestamp.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer bg-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="px-4 py-2 bg-[#ff5500] hover:bg-[#e64d00] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer border-none disabled:opacity-50 flex items-center gap-1.5"
                >
                  {savingConfig ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Configuration'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Details Modal */}
      {isDetailsModalOpen && selectedPayment && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <FileText size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 m-0">Payment Transaction Details</h3>
              </div>
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Business / Store:</span>
                  <span className="font-bold text-slate-900">
                    {selectedPayment.sellerDetails?.businessName || selectedPayment.sellerId?.businessName || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Owner Name:</span>
                  <span className="font-bold text-slate-900">
                    {selectedPayment.sellerDetails?.ownerName || selectedPayment.sellerId?.ownerName || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Phone:</span>
                  <span className="font-bold text-slate-900">
                    +91 {selectedPayment.sellerDetails?.phone || selectedPayment.sellerId?.phone || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-semibold">Email:</span>
                  <span className="font-bold text-slate-900">
                    {selectedPayment.sellerDetails?.email || selectedPayment.sellerId?.email || '—'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Amount</span>
                  <span className="text-lg font-black text-slate-900">₹{selectedPayment.amount}</span>
                  <span className="text-[10px] text-slate-500 font-medium uppercase ml-1">({selectedPayment.currency})</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-400 font-bold block text-[10px] uppercase">Payment Status</span>
                  <span className="text-sm font-bold text-slate-900 uppercase">{selectedPayment.status}</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 font-mono text-[11px] border border-slate-200 break-all">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">Payment Type:</span>
                  <span className="text-orange-700 font-bold">{selectedPayment.paymentType}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">Transaction ID:</span>
                  <span className="text-slate-800">{selectedPayment.transactionReference || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">Razorpay Order ID:</span>
                  <span className="text-slate-800">{selectedPayment.gatewayOrderId || selectedPayment.razorpayOrderId || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">Razorpay Payment ID:</span>
                  <span className="text-slate-800">{selectedPayment.gatewayPaymentId || selectedPayment.razorpayPaymentId || '—'}</span>
                </div>
                {selectedPayment.failureReason && (
                  <div>
                    <span className="text-rose-400 block text-[10px] uppercase font-sans font-bold">Failure Reason:</span>
                    <span className="text-rose-700">{selectedPayment.failureReason}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">Initiated At:</span>
                  <span className="text-slate-700 font-sans">{formatDate(selectedPayment.createdAt)}</span>
                </div>
                {selectedPayment.paidAt && (
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-sans font-bold">Verified / Paid At:</span>
                    <span className="text-emerald-700 font-sans">{formatDate(selectedPayment.paidAt)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="text-right pt-2">
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer border-none"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Audit Modal */}
      {isHistoryModalOpen && config && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 space-y-4 animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 m-0">Configuration Audit Trail</h3>
                  <p className="text-xs text-slate-500 font-medium">History of all registration fee adjustments</p>
                </div>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-3 pr-1">
              {(!config.history || config.history.length === 0) ? (
                <p className="text-xs text-slate-400 text-center py-6">No historical changes recorded yet.</p>
              ) : (
                config.history.map((h, i) => (
                  <div key={i} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-sm">₹{h.amount}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          h.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {h.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">{formatDate(h.changedAt)}</span>
                    </div>

                    {h.reason && (
                      <p className="text-xs text-slate-700 m-0 font-medium">
                        <span className="font-semibold text-slate-500">Reason: </span>
                        {h.reason}
                      </p>
                    )}

                    {h.changedBy && (
                      <p className="text-[11px] text-slate-400 m-0">
                        Admin: <span className="font-semibold text-slate-600">{h.changedBy.name || h.changedBy.email || 'Admin'}</span>
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="text-right pt-2 shrink-0 border-t border-slate-100">
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer border-none"
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
