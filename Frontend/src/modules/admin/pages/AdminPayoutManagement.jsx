import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import API from '../../../services/api';
import { useDebounce } from '../../../hooks/useDebounce';
import {
  Search,
  Store,
  Truck,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Eye,
  Banknote,
  RotateCcw,
} from 'lucide-react';

// Lazy-import the existing ReturnManagement — reuse without duplicating logic
const ReturnManagement = lazy(() =>
  import('./ReturnManagement').then((m) => ({ default: m.ReturnManagement || m.default }))
);

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount || 0);

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const PAYOUT_STATUS_STYLES = {
  PENDING:    'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED:   'bg-blue-50 text-blue-700 border-blue-200',
  PROCESSING: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  PAID:       'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED:   'bg-red-50 text-red-700 border-red-200',
  FAILED:     'bg-rose-50 text-rose-700 border-rose-200',
};

const REFUND_STATUS_STYLES = {
  REQUESTED:  'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED:   'bg-blue-50 text-blue-700 border-blue-200',
  PROCESSING: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  COMPLETED:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED:   'bg-red-50 text-red-700 border-red-200',
};

const StatusBadge = ({ status, styleMap }) => {
  const cls = (styleMap || PAYOUT_STATUS_STYLES)[status] || 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border uppercase tracking-wide ${cls}`}>
      {status}
    </span>
  );
};

// ─────────────────────────────────────────────
// Shared Modal Shell
// ─────────────────────────────────────────────
const Modal = ({ title, onClose, children, maxWidth = 'max-w-md' }) => (
  <div
    className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
    onClick={onClose}
  >
    <div
      className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} p-6 border border-slate-200 max-h-[90vh] overflow-y-auto`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors border-none bg-transparent cursor-pointer"
        >
          <X size={17} className="text-slate-500" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

// ─────────────────────────────────────────────
// Core PayoutManagement — shared by Seller & Captain
// ─────────────────────────────────────────────
const PayoutManagement = ({ recipientType }) => {
  const isSeller = recipientType === 'SELLER';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payouts, setPayouts] = useState([]);
  const [counts, setCounts] = useState({ all: 0, pending: 0, approved: 0, processing: 0, paid: 0, rejected: 0 });
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchInput, setSearchInput] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const debouncedSearch = useDebounce(searchInput, 350);

  const [selectedPayout, setSelectedPayout] = useState(null);
  const [viewModal, setViewModal] = useState(false);
  const [actionModal, setActionModal] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  const [approvedAmount, setApprovedAmount] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [actionRemarks, setActionRemarks] = useState('');

  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter]);

  const fetchPayouts = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true); else setLoading(true);
    try {
      const params = new URLSearchParams({ page, recipientType, limit: 15 });
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await API.get(`/super-admin/payouts?${params}`);
      if (res.data?.success) {
        setPayouts(res.data.payouts || []);
        setTotal(res.data.total || 0);
        setPages(res.data.pages || 1);
        if (res.data.counts) setCounts(res.data.counts);
      }
    } catch (err) {
      console.error('[PayoutManagement] fetch error:', err);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [page, recipientType, statusFilter, debouncedSearch, startDate, endDate]);

  useEffect(() => { fetchPayouts(); }, [fetchPayouts]);

  const openAction = (payout, action) => {
    setSelectedPayout(payout);
    setActionModal(action);
    setActionError('');
    setApprovedAmount(payout.requestedAmount?.toString() || '');
    setRejectionReason('');
    setPaymentReference(payout.paymentReference || '');
    setPaymentMethod('BANK_TRANSFER');
    setActionRemarks('');
  };

  const closeModals = () => { setActionModal(null); setViewModal(false); setSelectedPayout(null); setActionError(''); };

  const handleApprove = async () => {
    setActionLoading(true); setActionError('');
    try {
      const res = await API.put(`/super-admin/payouts/${selectedPayout._id}/approve`, {
        approvedAmount: Number(approvedAmount) || selectedPayout.requestedAmount,
        remarks: actionRemarks,
      });
      if (res.data?.success) { closeModals(); fetchPayouts(true); }
      else setActionError(res.data?.message || 'Approval failed');
    } catch (err) { setActionError(err?.response?.data?.message || 'Approval failed'); }
    finally { setActionLoading(false); }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) { setActionError('Rejection reason is required'); return; }
    setActionLoading(true); setActionError('');
    try {
      const res = await API.put(`/super-admin/payouts/${selectedPayout._id}/reject`, {
        rejectionReason: rejectionReason.trim(), remarks: actionRemarks,
      });
      if (res.data?.success) { closeModals(); fetchPayouts(true); }
      else setActionError(res.data?.message || 'Rejection failed');
    } catch (err) { setActionError(err?.response?.data?.message || 'Rejection failed'); }
    finally { setActionLoading(false); }
  };

  const handleProcess = async () => {
    if (!paymentReference.trim()) { setActionError('Payment reference is required'); return; }
    setActionLoading(true); setActionError('');
    try {
      const res = await API.put(`/super-admin/payouts/${selectedPayout._id}/process`, {
        paymentReference: paymentReference.trim(), paymentMethod, remarks: actionRemarks,
      });
      if (res.data?.success) { closeModals(); fetchPayouts(true); }
      else setActionError(res.data?.message || 'Processing failed');
    } catch (err) { setActionError(err?.response?.data?.message || 'Processing failed'); }
    finally { setActionLoading(false); }
  };

  const statusTabs = [
    { key: 'ALL', label: 'All', count: counts.all },
    { key: 'PENDING', label: 'Pending', count: counts.pending },
    { key: 'APPROVED', label: 'Approved', count: counts.approved },
    { key: 'PROCESSING', label: 'Processing', count: counts.processing },
    { key: 'PAID', label: 'Paid', count: counts.paid },
    { key: 'REJECTED', label: 'Rejected', count: counts.rejected },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            {isSeller ? <Store size={20} className="text-[#ff5500]" /> : <Truck size={20} className="text-[#ff5500]" />}
            {isSeller ? 'Seller Payout Requests' : 'Captain Payout Requests'}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {isSeller ? 'Review and process seller withdrawal requests' : 'Review and process captain payout requests'}
          </p>
        </div>
        <button
          onClick={() => fetchPayouts(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-2">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
              statusFilter === tab.key
                ? 'bg-[#002625] text-white border-[#002625] shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                statusFilter === tab.key ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
              }`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder={`Search ${isSeller ? 'seller' : 'captain'} name, phone, payout ID…`}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#ff5500] transition-colors"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} title="From date"
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#ff5500] transition-colors" />
            <span className="text-slate-300 text-xs">to</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} title="To date"
              className="px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#ff5500] transition-colors" />
            {(searchInput || startDate || endDate) && (
              <button onClick={() => { setSearchInput(''); setStartDate(''); setEndDate(''); }}
                className="px-3 py-2 text-xs text-slate-500 hover:text-red-500 border border-slate-200 rounded-xl hover:bg-red-50 transition-colors cursor-pointer">
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 size={28} className="animate-spin text-[#ff5500]" />
            <p className="text-sm text-slate-400">Loading payout requests…</p>
          </div>
        ) : payouts.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Banknote size={22} className="text-slate-400" />
            </div>
            <p className="text-slate-600 font-semibold text-sm">No payout requests found</p>
            <p className="text-slate-400 text-xs mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Payout ID', isSeller ? 'Seller' : 'Captain', 'Amount', 'Bank / UPI', 'Requested', 'Status', 'Actions'].map((h, i) => (
                      <th key={h} className={`px-5 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider ${
                        h === 'Amount' ? 'text-right' : (h === 'Status' || h === 'Actions') ? 'text-center' : 'text-left'
                      }`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {payouts.map((payout) => (
                    <tr key={payout._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4">
                        <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                          {payout.payoutId || payout._id?.slice(-8)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-[#f0f9f8] flex items-center justify-center shrink-0">
                            {isSeller ? <Store size={14} className="text-[#002625]" /> : <Truck size={14} className="text-[#002625]" />}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-800 text-sm truncate max-w-[140px]">{payout.recipientName || '—'}</p>
                            <p className="text-xs text-slate-400">{payout.recipientPhone || ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <p className="font-bold text-slate-800">{formatCurrency(payout.approvedAmount || payout.requestedAmount)}</p>
                        {payout.approvedAmount && Number(payout.approvedAmount) !== Number(payout.requestedAmount) && (
                          <p className="text-xs text-slate-400 line-through">{formatCurrency(payout.requestedAmount)}</p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-xs text-slate-500 max-w-[130px] truncate">
                          {payout.bankDetails?.upiId ? `UPI: ${payout.bankDetails.upiId}` :
                            payout.bankDetails?.accountNumber ? `${payout.bankDetails.bankName || 'Bank'} ···${payout.bankDetails.accountNumber.slice(-4)}` :
                            <span className="text-slate-300">—</span>}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-xs text-slate-500">{formatDate(payout.createdAt)}</p>
                        {payout.paidAt && <p className="text-[11px] text-emerald-500 font-medium mt-0.5">Paid: {formatDate(payout.paidAt)}</p>}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <StatusBadge status={payout.status} styleMap={PAYOUT_STATUS_STYLES} />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => { setSelectedPayout(payout); setViewModal(true); }}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border-none bg-transparent cursor-pointer" title="View Details">
                            <Eye size={14} />
                          </button>
                          {payout.status === 'PENDING' && (
                            <button onClick={() => openAction(payout, 'APPROVE')}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 text-[11px] font-bold rounded-lg transition-colors border-none cursor-pointer whitespace-nowrap">
                              Approve
                            </button>
                          )}
                          {['APPROVED', 'PROCESSING'].includes(payout.status) && (
                            <button onClick={() => openAction(payout, 'PROCESS')}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 text-[11px] font-bold rounded-lg transition-colors border-none cursor-pointer whitespace-nowrap">
                              Process
                            </button>
                          )}
                          {['PENDING', 'APPROVED', 'PROCESSING'].includes(payout.status) && (
                            <button onClick={() => openAction(payout, 'REJECT')}
                              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-500 text-[11px] font-bold rounded-lg transition-colors border-none cursor-pointer">
                              Reject
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/50">
                <p className="text-xs text-slate-500">{payouts.length} of {total} results · Page {page} of {pages}</p>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
                    <ChevronLeft size={14} />
                  </button>
                  <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modals ── */}

      {/* View Detail */}
      {viewModal && selectedPayout && (
        <Modal title={`Payout · ${selectedPayout.payoutId || selectedPayout._id?.slice(-8)}`} onClose={closeModals} maxWidth="max-w-lg">
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Recipient</p>
                <p className="font-bold text-slate-800">{selectedPayout.recipientName || '—'}</p>
                <p className="text-slate-500 text-xs">{selectedPayout.recipientPhone || ''}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Amount</p>
                <p className="font-bold text-slate-800 text-base">{formatCurrency(selectedPayout.approvedAmount || selectedPayout.requestedAmount)}</p>
                {selectedPayout.approvedAmount && Number(selectedPayout.approvedAmount) !== Number(selectedPayout.requestedAmount) && (
                  <p className="text-xs text-slate-400">Requested: {formatCurrency(selectedPayout.requestedAmount)}</p>
                )}
              </div>
            </div>
            {selectedPayout.bankDetails && (
              <div className="bg-slate-50 rounded-xl p-3">
                <p className="text-[10px] text-slate-400 uppercase font-bold mb-2">Payment Details</p>
                {selectedPayout.bankDetails.upiId ? (
                  <p className="text-slate-700 font-mono text-sm">UPI: {selectedPayout.bankDetails.upiId}</p>
                ) : (
                  <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                    {[['Bank', selectedPayout.bankDetails.bankName], ['Account No.', selectedPayout.bankDetails.accountNumber],
                      ['IFSC', selectedPayout.bankDetails.ifscCode], ['Holder', selectedPayout.bankDetails.accountHolderName]].map(([l, v]) => (
                      <React.Fragment key={l}>
                        <span className="text-slate-400">{l}</span>
                        <span className="font-mono font-medium text-slate-700">{v || '—'}</span>
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-y-2 text-xs">
              <span className="text-slate-400">Status</span><StatusBadge status={selectedPayout.status} styleMap={PAYOUT_STATUS_STYLES} />
              <span className="text-slate-400">Requested</span><span className="font-medium">{formatDate(selectedPayout.createdAt)}</span>
              {selectedPayout.paymentReference && (<><span className="text-slate-400">Ref</span><span className="font-mono font-medium">{selectedPayout.paymentReference}</span></>)}
              {selectedPayout.paidAt && (<><span className="text-slate-400">Paid At</span><span className="font-medium text-emerald-600">{formatDate(selectedPayout.paidAt)}</span></>)}
            </div>
            {selectedPayout.rejectionReason && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-600">
                <span className="font-bold">Rejection: </span>{selectedPayout.rejectionReason}
              </div>
            )}
            {selectedPayout.remarks && (
              <div className="text-xs text-slate-500 bg-slate-50 rounded-xl p-3">
                <span className="font-semibold text-slate-600">Remarks: </span>{selectedPayout.remarks}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Approve */}
      {actionModal === 'APPROVE' && selectedPayout && (
        <Modal title="Approve Payout Request" onClose={closeModals}>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="font-bold text-blue-700 text-sm">{selectedPayout.recipientName}</p>
              <p className="text-blue-500 text-xs mt-0.5">Requested: {formatCurrency(selectedPayout.requestedAmount)}</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Approved Amount (₹)</label>
              <input type="number" value={approvedAmount} onChange={(e) => setApprovedAmount(e.target.value)} min="1"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#ff5500] transition-colors"
                placeholder="Enter approved amount" />
              <p className="text-[11px] text-slate-400 mt-1">Leave as-is to approve the full requested amount.</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Remarks (optional)</label>
              <textarea value={actionRemarks} onChange={(e) => setActionRemarks(e.target.value)} rows={2}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#ff5500] transition-colors resize-none"
                placeholder="Add internal remarks…" />
            </div>
            {actionError && <p className="text-xs text-red-500 bg-red-50 border border-red-100 px-3 py-2 rounded-xl">{actionError}</p>}
            <div className="flex gap-3 pt-1">
              <button onClick={closeModals} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold rounded-xl transition-colors border-none cursor-pointer">Cancel</button>
              <button onClick={handleApprove} disabled={actionLoading}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-colors border-none cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                {actionLoading && <Loader2 size={14} className="animate-spin" />}Approve Payout
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reject */}
      {actionModal === 'REJECT' && selectedPayout && (
        <Modal title="Reject Payout Request" onClose={closeModals}>
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
              <p className="font-bold text-red-700 text-sm">{selectedPayout.recipientName}</p>
              <p className="text-red-400 text-xs mt-0.5">Amount: {formatCurrency(selectedPayout.requestedAmount)}</p>
              <p className="text-red-400 text-xs mt-1 italic">Rejecting restores funds to the recipient's wallet.</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Rejection Reason <span className="text-red-500">*</span></label>
              <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={3}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-red-400 transition-colors resize-none"
                placeholder="Explain the reason for rejection…" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Remarks (optional)</label>
              <input type="text" value={actionRemarks} onChange={(e) => setActionRemarks(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#ff5500] transition-colors"
                placeholder="Internal remarks…" />
            </div>
            {actionError && <p className="text-xs text-red-500 bg-red-50 border border-red-100 px-3 py-2 rounded-xl">{actionError}</p>}
            <div className="flex gap-3 pt-1">
              <button onClick={closeModals} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold rounded-xl transition-colors border-none cursor-pointer">Cancel</button>
              <button onClick={handleReject} disabled={actionLoading}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-colors border-none cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                {actionLoading && <Loader2 size={14} className="animate-spin" />}Reject Payout
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Process / Mark Paid */}
      {actionModal === 'PROCESS' && selectedPayout && (
        <Modal title="Mark Payout as Paid" onClose={closeModals}>
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
              <p className="font-bold text-emerald-700 text-sm">{selectedPayout.recipientName}</p>
              <p className="text-emerald-500 text-xs mt-0.5">Amount: {formatCurrency(selectedPayout.approvedAmount || selectedPayout.requestedAmount)}</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Payment Method</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#ff5500] bg-white transition-colors">
                <option value="BANK_TRANSFER">Bank Transfer (NEFT / IMPS / RTGS)</option>
                <option value="UPI">UPI</option>
                <option value="CASH">Cash</option>
                <option value="CHEQUE">Cheque</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Payment Reference / UTR <span className="text-red-500">*</span></label>
              <input type="text" value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#ff5500] transition-colors font-mono"
                placeholder="Enter UTR, Transaction ID…" />
              <p className="text-[11px] text-slate-400 mt-1">Recorded in payout record and audit log.</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Remarks (optional)</label>
              <input type="text" value={actionRemarks} onChange={(e) => setActionRemarks(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#ff5500] transition-colors"
                placeholder="Internal remarks…" />
            </div>
            {actionError && <p className="text-xs text-red-500 bg-red-50 border border-red-100 px-3 py-2 rounded-xl">{actionError}</p>}
            <div className="flex gap-3 pt-1">
              <button onClick={closeModals} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold rounded-xl transition-colors border-none cursor-pointer">Cancel</button>
              <button onClick={handleProcess} disabled={actionLoading}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors border-none cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                {actionLoading && <Loader2 size={14} className="animate-spin" />}Mark as Paid
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// EXPORT: AdminSellerPayout
// ─────────────────────────────────────────────
export const AdminSellerPayout = () => <PayoutManagement recipientType="SELLER" />;

// ─────────────────────────────────────────────
// EXPORT: AdminCaptainPayout
// ─────────────────────────────────────────────
export const AdminCaptainPayout = () => <PayoutManagement recipientType="CAPTAIN" />;

// ─────────────────────────────────────────────
// Refund List (internal)
// ─────────────────────────────────────────────
const RefundsList = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refunds, setRefunds] = useState([]);
  const [search, setSearch] = useState('');

  const [selectedRefund, setSelectedRefund] = useState(null);
  const [modalStatus, setModalStatus] = useState('COMPLETED');
  const [gatewayRefundId, setGatewayRefundId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchRefunds = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true); else setLoading(true);
    try {
      const res = await API.get('/super-admin/refunds');
      if (res.data?.success) setRefunds(res.data.refunds || []);
    } catch (err) { console.error('[RefundsList] fetch error:', err); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchRefunds(); }, [fetchRefunds]);

  const openProcess = (refund) => {
    setSelectedRefund(refund); setModalStatus('COMPLETED');
    setGatewayRefundId(''); setRemarks(''); setError('');
  };

  const handleProcessSubmit = async () => {
    setActionLoading(true); setError('');
    try {
      const res = await API.put(`/super-admin/refunds/${selectedRefund._id}/process`, {
        status: modalStatus, gatewayRefundId, remarks,
      });
      if (res.data?.success) { setSelectedRefund(null); fetchRefunds(true); }
      else setError(res.data?.message || 'Processing failed');
    } catch (err) { setError(err?.response?.data?.message || 'Processing failed'); }
    finally { setActionLoading(false); }
  };

  const filtered = search.trim()
    ? refunds.filter((r) =>
        r.refundId?.toLowerCase().includes(search.toLowerCase()) ||
        r.orderId?.toLowerCase().includes(search.toLowerCase()) ||
        r.userName?.toLowerCase().includes(search.toLowerCase()) ||
        r.userPhone?.includes(search)
      )
    : refunds;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-slate-500">{refunds.length} refund {refunds.length === 1 ? 'request' : 'requests'}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input type="text" placeholder="Search refund ID, order, customer…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#ff5500] w-56 transition-colors" />
          </div>
          <button onClick={() => fetchRefunds(true)} disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer">
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[#ff5500]" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <RotateCcw size={26} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium text-sm">No refund requests found</p>
          {search && <button onClick={() => setSearch('')} className="mt-2 text-xs text-[#ff5500] hover:underline cursor-pointer bg-transparent border-none">Clear search</button>}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Refund ID', 'Customer', 'Order ID', 'Amount', 'Reason', 'Date', 'Status', 'Action'].map((h) => (
                  <th key={h} className={`px-4 py-3.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider ${
                    h === 'Amount' ? 'text-right' : h === 'Status' || h === 'Action' ? 'text-center' : 'text-left'
                  }`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((refund) => (
                <tr key={refund._id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-4">
                    <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">{refund.refundId || refund._id?.slice(-8)}</span>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-semibold text-slate-800 text-sm">{refund.userName || '—'}</p>
                    <p className="text-xs text-slate-400">{refund.userPhone || ''}</p>
                  </td>
                  <td className="px-4 py-4"><span className="font-mono text-xs text-slate-600">{refund.orderId || '—'}</span></td>
                  <td className="px-4 py-4 text-right"><span className="font-bold text-slate-800">{formatCurrency(refund.amount)}</span></td>
                  <td className="px-4 py-4"><p className="text-xs text-slate-500 max-w-[160px] truncate" title={refund.reason}>{refund.reason || '—'}</p></td>
                  <td className="px-4 py-4"><p className="text-xs text-slate-400">{formatDate(refund.createdAt)}</p></td>
                  <td className="px-4 py-4 text-center"><StatusBadge status={refund.status} styleMap={REFUND_STATUS_STYLES} /></td>
                  <td className="px-4 py-4 text-center">
                    {!['COMPLETED', 'REJECTED'].includes(refund.status) ? (
                      <button onClick={() => openProcess(refund)}
                        className="px-3 py-1 bg-[#002625] hover:bg-[#003836] text-white text-[11px] font-bold rounded-lg transition-colors border-none cursor-pointer">
                        Process
                      </button>
                    ) : (
                      <span className="text-xs text-slate-300 font-medium">Done</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Process Refund Modal */}
      {selectedRefund && (
        <Modal title={`Process Refund · ${selectedRefund.refundId || selectedRefund._id?.slice(-8)}`} onClose={() => setSelectedRefund(null)}>
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-2">
              {[['Customer', selectedRefund.userName], ['Phone', selectedRefund.userPhone], ['Order', selectedRefund.orderId], ['Amount', formatCurrency(selectedRefund.amount)]].map(([l, v]) => (
                <div key={l} className="flex justify-between">
                  <span className="text-slate-400 text-xs">{l}</span>
                  <span className="font-semibold text-xs text-slate-700">{v || '—'}</span>
                </div>
              ))}
              {selectedRefund.reason && (
                <div className="pt-1 border-t border-slate-100">
                  <p className="text-xs text-slate-400">Reason</p>
                  <p className="text-xs text-slate-600 mt-0.5 italic">{selectedRefund.reason}</p>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Update Status</label>
              <select value={modalStatus} onChange={(e) => setModalStatus(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#ff5500] bg-white transition-colors">
                <option value="PROCESSING">Processing</option>
                <option value="COMPLETED">Completed (Refunded)</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
            {modalStatus === 'COMPLETED' && (
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Gateway Refund ID / Reference</label>
                <input type="text" value={gatewayRefundId} onChange={(e) => setGatewayRefundId(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#ff5500] font-mono transition-colors"
                  placeholder="e.g. rfnd_Abc123xyz…" />
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1.5">Remarks</label>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-[#ff5500] resize-none transition-colors"
                placeholder="Internal remarks…" />
            </div>
            {error && <p className="text-xs text-red-500 bg-red-50 border border-red-100 px-3 py-2 rounded-xl">{error}</p>}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setSelectedRefund(null)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold rounded-xl border-none cursor-pointer transition-colors">Cancel</button>
              <button onClick={handleProcessSubmit} disabled={actionLoading}
                className="flex-1 py-2.5 bg-[#002625] hover:bg-[#003836] text-white text-sm font-bold rounded-xl border-none cursor-pointer disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                {actionLoading && <Loader2 size={14} className="animate-spin" />}Update Refund
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// EXPORT: AdminRefundReturn — tabbed Refunds + Returns
// ─────────────────────────────────────────────
export const AdminRefundReturn = () => {
  const [activeTab, setActiveTab] = useState('refunds');

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <RotateCcw size={20} className="text-[#ff5500]" />
          Refund &amp; Return
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">Process customer refunds and manage product return requests</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-white border border-slate-200 rounded-2xl p-1 w-fit shadow-sm">
        {[{ key: 'refunds', label: '💰 Refunds' }, { key: 'returns', label: '📦 Returns' }].map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2 rounded-xl text-sm font-bold transition-all border-none cursor-pointer ${
              activeTab === tab.key ? 'bg-[#002625] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 bg-transparent'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'refunds' ? (
        <RefundsList />
      ) : (
        <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-[#ff5500]" /></div>}>
          <ReturnManagement />
        </Suspense>
      )}
    </div>
  );
};
