import React, { useState, useEffect } from 'react';
import {
  DollarSign, CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw,
  Search, Filter, Calendar, ArrowUpRight, ShieldCheck, History,
  FileText, ExternalLink, Eye, X, Edit3, Sparkles, Check, ToggleLeft, ToggleRight, Loader2,
  Truck, UserCheck, CreditCard, Banknote, HelpCircle
} from 'lucide-react';
import { captainRegistrationFeeService } from '../../../services/authService';

const STATUS_BADGES = {
  paid: { label: 'Paid', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle },
  pending: { label: 'Pending', bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  created: { label: 'Created', bg: 'bg-blue-50 text-blue-700 border-blue-200', icon: Clock },
  failed: { label: 'Failed', bg: 'bg-rose-50 text-rose-700 border-rose-200', icon: XCircle },
  cancelled: { label: 'Cancelled', bg: 'bg-slate-50 text-slate-700 border-slate-200', icon: XCircle },
};

export const CaptainRegistrationFeeAdmin = () => {
  // State for Fee Configuration
  const [config, setConfig] = useState(null);
  const [stats, setStats] = useState({ totalRevenue: 0, totalPaidCaptains: 0, pendingPayments: 0 });
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
      const res = await captainRegistrationFeeService.adminGetConfig();
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
      console.error('Failed to load captain fee configuration:', err);
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
      const res = await captainRegistrationFeeService.adminGetPayments(params);
      if (res && res.success) {
        setPayments(res.payments || []);
        setPagination({
          page: res.pagination?.page || 1,
          limit: res.pagination?.limit || 15,
          total: res.pagination?.total || 0,
          totalPages: res.pagination?.totalPages || 1,
        });
      }
    } catch (err) {
      console.error('Failed to load captain fee payments:', err);
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
      const res = await captainRegistrationFeeService.adminUpdateConfig({
        amount: Number(editForm.amount),
        isActive: editForm.isActive,
        description: editForm.description,
        reason: editForm.changeReason || 'Admin updated captain registration fee configuration',
      });

      if (res && res.success) {
        setConfig(res.config);
        setIsEditModalOpen(false);
        setFeedbackMsg({ type: 'success', text: 'Captain registration fee updated successfully.' });
        setTimeout(() => setFeedbackMsg({ type: '', text: '' }), 4000);
      } else {
        setFeedbackMsg({ type: 'error', text: res?.message || 'Failed to update fee configuration.' });
      }
    } catch (err) {
      console.error('Update captain fee error:', err);
      setFeedbackMsg({ type: 'error', text: err.response?.data?.message || 'Error updating fee.' });
    } finally {
      setSavingConfig(false);
    }
  };

  // Toggle Fee Active/Inactive directly
  const handleToggleActive = async () => {
    if (!config) return;
    const newStatus = !config.isActive;
    try {
      setSavingConfig(true);
      const res = await captainRegistrationFeeService.adminUpdateConfig({
        amount: config.amount,
        isActive: newStatus,
        description: config.description,
        reason: `Admin ${newStatus ? 'enabled' : 'disabled'} captain registration fee`,
      });
      if (res && res.success) {
        setConfig(res.config);
        setEditForm(prev => ({ ...prev, isActive: newStatus }));
        setFeedbackMsg({
          type: 'success',
          text: `Captain registration fee is now ${newStatus ? 'ACTIVE' : 'INACTIVE'}.`
        });
        setTimeout(() => setFeedbackMsg({ type: '', text: '' }), 4000);
      }
    } catch (err) {
      console.error('Toggle status error:', err);
      setFeedbackMsg({ type: 'error', text: 'Failed to update status.' });
    } finally {
      setSavingConfig(false);
    }
  };

  const openPaymentDetails = (payment) => {
    setSelectedPayment(payment);
    setIsDetailsModalOpen(true);
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto text-slate-800 font-sans">
      
      {/* Header with Title and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
              <Truck size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Captain Registration Fee Management
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure delivery captain onboarding fee, verify transactions, and monitor platform revenue.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => { fetchConfig(); fetchPayments(pagination.page); }}
            className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw size={15} className={loadingPayments || loadingConfig ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={() => setIsHistoryModalOpen(true)}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200"
          >
            <History size={15} />
            <span>Audit History</span>
          </button>

          <button
            onClick={() => setIsEditModalOpen(true)}
            className="px-4 py-2.5 bg-[#15803d] hover:bg-[#166534] text-white rounded-xl text-xs font-extrabold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Edit3 size={15} />
            <span>Edit Fee Settings</span>
          </button>
        </div>
      </div>

      {/* Feedback Alert Notification */}
      {feedbackMsg.text && (
        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between transition-all animate-in fade-in duration-200 border ${
          feedbackMsg.type === 'success'
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <div className="flex items-center gap-2.5">
            {feedbackMsg.type === 'success' ? <CheckCircle size={18} className="text-emerald-600" /> : <AlertTriangle size={18} className="text-rose-600" />}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg({ type: '', text: '' })} className="text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Stat Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Fee Amount */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider">Active Fee Amount</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign size={17} />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-black text-slate-900">
                ₹{config ? config.amount : '...'}
              </span>
              <span className="text-[11px] font-bold text-slate-400 ml-1">/ Captain</span>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
              config?.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
            }`}>
              {config?.isActive ? 'Active' : 'Disabled'}
            </span>
          </div>
        </div>

        {/* Card 2: Total Revenue Collected */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider">Total Revenue</span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <Banknote size={17} />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900">
              ₹{stats.totalRevenue ? stats.totalRevenue.toLocaleString('en-IN') : 0}
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">Collected from verified registrations</p>
          </div>
        </div>

        {/* Card 3: Paid Captains */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider">Paid Captains</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <UserCheck size={17} />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900">
              {stats.totalPaidCaptains || 0}
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">Captains completed fee payment</p>
          </div>
        </div>

        {/* Card 4: Pending / Incomplete Payments */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider">Pending Orders</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock size={17} />
            </div>
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900">
              {stats.pendingPayments || 0}
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">Initiated & awaiting payment</p>
          </div>
        </div>
      </div>

      {/* Configuration Quick Control Panel */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border border-emerald-800/40">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-extrabold rounded-full uppercase tracking-wider">
              Registration Fee Status
            </span>
            <span className="text-xs text-slate-300">
              Updated by <strong className="text-white">{config?.updatedBy || 'Admin'}</strong>
            </span>
          </div>
          <h2 className="text-lg sm:text-xl font-black text-white">
            Delivery Captain Onboarding Fee: ₹{config?.amount || 150} ({config?.isActive ? 'ACTIVE' : 'INACTIVE'})
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            {config?.description || 'One-time onboarding and background verification fee for new delivery captain registrations.'}
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
          <button
            onClick={handleToggleActive}
            disabled={savingConfig}
            className={`flex-1 md:flex-initial px-5 py-3 rounded-2xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
              config?.isActive
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black'
            }`}
          >
            {savingConfig ? (
              <Loader2 size={16} className="animate-spin" />
            ) : config?.isActive ? (
              <>
                <ToggleRight size={18} /> Disable Registration Fee
              </>
            ) : (
              <>
                <ToggleLeft size={18} /> Enable Registration Fee
              </>
            )}
          </button>

          <button
            onClick={() => setIsEditModalOpen(true)}
            className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-bold text-xs transition-all border border-white/15 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Edit3 size={15} /> Change Amount
          </button>
        </div>
      </div>

      {/* Payments List Table Section */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Table Controls & Filter Bar */}
        <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl overflow-x-auto">
            {['all', 'paid', 'pending', 'failed'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold capitalize transition-all cursor-pointer whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Search & Date Filters */}
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search name, phone, order ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-600 font-medium"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-700 outline-none focus:border-emerald-600"
                title="Start Date"
              />
              <span className="text-slate-400 text-xs">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs text-slate-700 outline-none focus:border-emerald-600"
                title="End Date"
              />
              <button
                type="submit"
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
              >
                Filter
              </button>
            </div>
          </form>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4 sm:px-6">Captain Details</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">Razorpay Reference</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loadingPayments ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Loader2 size={24} className="animate-spin mx-auto text-emerald-600 mb-2" />
                    <span>Loading payment records...</span>
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 space-y-2">
                    <FileText size={32} className="mx-auto text-slate-300" />
                    <p className="font-bold text-slate-600">No payment records found</p>
                    <p className="text-[11px]">Transactions will appear here when delivery captains register.</p>
                  </td>
                </tr>
              ) : (
                payments.map((p) => {
                  const badge = STATUS_BADGES[p.status] || STATUS_BADGES.pending;
                  const StatusIcon = badge.icon;
                  return (
                    <tr key={p._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-4 sm:px-6">
                        <div className="font-bold text-slate-900">
                          {p.captainDetails?.name || p.captainId?.name || 'Captain Partner'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          +91 {p.captainDetails?.phone || p.captainId?.phone || 'N/A'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {p.captainDetails?.vehicleType || p.captainId?.vehicleType || 'Motorcycle'} • {p.captainDetails?.city || p.captainId?.city || 'India'}
                        </div>
                      </td>

                      <td className="py-4 px-4 font-black text-slate-900">
                        ₹{p.amount}
                        <span className="text-[10px] text-slate-400 font-normal ml-1">INR</span>
                      </td>

                      <td className="py-4 px-4">
                        <div className="font-mono text-[11px] text-slate-700 font-bold">
                          {p.transactionReference}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">
                          Order: {p.gatewayOrderId || 'N/A'}
                        </div>
                        {p.gatewayPaymentId && (
                          <div className="font-mono text-[10px] text-emerald-600 font-medium">
                            Pay ID: {p.gatewayPaymentId}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.bg}`}>
                          <StatusIcon size={12} />
                          <span>{badge.label}</span>
                        </span>
                      </td>

                      <td className="py-4 px-4 text-slate-500 text-[11px]">
                        <div>{new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                        <div className="text-[10px] text-slate-400">{new Date(p.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>

                      <td className="py-4 px-4 sm:px-6 text-right">
                        <button
                          onClick={() => openPaymentDetails(p)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1 border border-slate-200"
                        >
                          <Eye size={13} /> Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <strong className="text-slate-800">{payments.length}</strong> of{' '}
            <strong className="text-slate-800">{pagination.total}</strong> records
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchPayments(pagination.page - 1)}
              disabled={pagination.page <= 1 || loadingPayments}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all disabled:opacity-40 cursor-pointer"
            >
              Previous
            </button>
            <span className="font-bold text-slate-700">
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>
            <button
              onClick={() => fetchPayments(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loadingPayments}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ✏️ EDIT CONFIGURATION MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 border border-slate-100 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">
                  ₹
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Update Captain Registration Fee</h3>
                  <p className="text-xs text-slate-500">Change fee amount and operational status</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Fee Amount (₹ INR) *</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={editForm.amount}
                    onChange={(e) => setEditForm(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="150"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-600"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  Set to 0 to make registration free for all new delivery captains.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Status</label>
                <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <input
                    type="checkbox"
                    id="feeActiveCheck"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="w-4 h-4 text-emerald-600 rounded-md focus:ring-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="feeActiveCheck" className="font-bold text-slate-800 cursor-pointer">
                    Enable Captain Registration Fee Requirement
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Public Description / Note</label>
                <textarea
                  rows={2}
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="One-time onboarding and background verification fee..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 outline-none focus:border-emerald-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Reason for Update (Audit Trail) *</label>
                <input
                  type="text"
                  required
                  value={editForm.changeReason}
                  onChange={(e) => setEditForm(prev => ({ ...prev, changeReason: e.target.value }))}
                  placeholder="e.g. Revised seasonal onboarding cost for captains"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="px-5 py-2.5 bg-[#15803d] hover:bg-[#166534] text-white font-extrabold rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingConfig ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📜 TRANSACTION DETAILS MODAL */}
      {isDetailsModalOpen && selectedPayment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 border border-slate-100 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <CreditCard size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Transaction Details</h3>
                  <p className="text-[11px] font-mono text-slate-400">{selectedPayment.transactionReference}</p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">Captain Name:</span>
                  <span className="font-bold text-slate-900">
                    {selectedPayment.captainDetails?.name || selectedPayment.captainId?.name || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">Mobile Number:</span>
                  <span className="font-mono font-bold text-slate-800">
                    +91 {selectedPayment.captainDetails?.phone || selectedPayment.captainId?.phone || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">Vehicle Type:</span>
                  <span className="font-bold text-slate-800">
                    {selectedPayment.captainDetails?.vehicleType || selectedPayment.captainId?.vehicleType || 'Motorcycle'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">City:</span>
                  <span className="font-bold text-slate-800">
                    {selectedPayment.captainDetails?.city || selectedPayment.captainId?.city || 'India'}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">Amount Paid:</span>
                  <span className="font-black text-emerald-700 text-sm">₹{selectedPayment.amount} INR</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">Payment Status:</span>
                  <span className="font-bold capitalize text-slate-900">{selectedPayment.status}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">Gateway:</span>
                  <span className="font-bold uppercase text-slate-800">{selectedPayment.gateway || 'Razorpay'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">Razorpay Order ID:</span>
                  <span className="font-mono text-[11px] text-slate-700">{selectedPayment.gatewayOrderId || 'N/A'}</span>
                </div>
                {selectedPayment.gatewayPaymentId && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold">Razorpay Payment ID:</span>
                    <span className="font-mono text-[11px] text-emerald-700 font-bold">{selectedPayment.gatewayPaymentId}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-bold">Initiated At:</span>
                  <span className="text-slate-700">{new Date(selectedPayment.createdAt).toLocaleString('en-IN')}</span>
                </div>
                {selectedPayment.paidAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold">Paid At:</span>
                    <span className="text-emerald-700 font-bold">{new Date(selectedPayment.paidAt).toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsDetailsModalOpen(false)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl cursor-pointer text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📜 AUDIT HISTORY MODAL */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 border border-slate-100 animate-in fade-in zoom-in duration-150 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                  <History size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Fee Configuration Audit History</h3>
                  <p className="text-xs text-slate-500">Chronological log of changes made by administrators</p>
                </div>
              </div>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 text-xs">
              {(!config?.history || config.history.length === 0) ? (
                <div className="py-8 text-center text-slate-400">
                  No historical configuration records logged yet.
                </div>
              ) : (
                config.history.map((h, idx) => (
                  <div key={idx} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-sm">₹{h.amount} INR</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          h.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {h.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(h.changedAt).toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="text-slate-700">
                      <strong>Reason:</strong> {h.reason || 'Configuration updated'}
                    </div>

                    <div className="text-[11px] text-slate-400">
                      Modified by: <strong className="text-slate-600">{h.changedBy || 'Admin'}</strong>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl cursor-pointer text-xs"
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

export default CaptainRegistrationFeeAdmin;
