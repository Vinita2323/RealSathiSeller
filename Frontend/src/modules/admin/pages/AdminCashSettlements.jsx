import React, { useState, useEffect, useCallback } from 'react';
import API from '../../../services/api';
import { useDebounce } from '../../../hooks/useDebounce';
import {
  Search,
  Truck,
  X,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  Eye,
  AlertTriangle,
  Banknote,
  DollarSign,
  ShieldCheck,
  FileText,
  Clock,
  ExternalLink,
} from 'lucide-react';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
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

const STATUS_BADGES = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
};

export const AdminCashSettlements = () => {
  const [settlements, setSettlements] = useState([]);
  const [summary, setSummary] = useState({
    totalOutstanding: 0,
    totalCodCollected: 0,
    pendingSettlementAmount: 0,
    pendingSettlementCount: 0,
    approvedSettlementAmount: 0,
    approvedSettlementCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Selected settlement modal
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [adminRemarks, setAdminRemarks] = useState('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [actionErrorMsg, setActionErrorMsg] = useState('');
  const [previewImage, setPreviewImage] = useState(null);

  const fetchSettlements = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);

      const res = await API.get(`/admin/captain-cash-settlements?${params.toString()}`);
      if (res.data?.success) {
        setSettlements(res.data.settlements || []);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      }
    } catch (err) {
      console.error('Fetch settlements error:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  const handleProcess = async (action) => {
    if (!selectedSettlement) return;
    setActionLoading(true);
    setActionSuccessMsg('');
    setActionErrorMsg('');

    try {
      const res = await API.put(`/admin/captain-cash-settlements/${selectedSettlement._id}`, {
        action,
        adminRemarks,
      });

      if (res.data?.success) {
        setActionSuccessMsg(
          `Settlement #${selectedSettlement.settlementId} successfully ${
            action === 'APPROVE' ? 'approved & deducted from captain balance' : 'rejected'
          }.`
        );
        setTimeout(() => {
          setSelectedSettlement(null);
          setActionSuccessMsg('');
          setAdminRemarks('');
          fetchSettlements();
        }, 1200);
      } else {
        setActionErrorMsg(res.data?.message || 'Processing failed.');
      }
    } catch (err) {
      setActionErrorMsg(err?.response?.data?.message || err?.message || 'Failed to process settlement.');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredSettlements = settlements.filter((s) => {
    if (!debouncedSearch) return true;
    const term = debouncedSearch.toLowerCase();
    const idMatch = s.settlementId?.toLowerCase().includes(term);
    const nameMatch = (s.captainName || s.captainId?.name)?.toLowerCase().includes(term);
    const phoneMatch = (s.captainPhone || s.captainId?.phone)?.includes(term);
    const refMatch = s.transactionReference?.toLowerCase().includes(term);
    return idMatch || nameMatch || phoneMatch || refMatch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#002625] text-white flex items-center justify-center font-bold">
              <Banknote size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Captain Cash Settlements</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Verify and settle physical Cash on Delivery (COD) amounts collected by delivery captains
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={fetchSettlements}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Outstanding Cash */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Outstanding Captain Cash
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              ₹
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {formatCurrency(summary.totalOutstanding)}
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">Total unsettled cash in captains' hands</p>
          </div>
        </div>

        {/* Total Lifetime COD Collected */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Lifetime COD Collected
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Truck size={18} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {formatCurrency(summary.totalCodCollected)}
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">Total cash collected on completed orders</p>
          </div>
        </div>

        {/* Pending Settlements */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
              Pending Settlements
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock size={18} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {formatCurrency(summary.pendingSettlementAmount)}
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {summary.pendingSettlementCount} request{summary.pendingSettlementCount !== 1 ? 's' : ''} awaiting approval
            </p>
          </div>
        </div>

        {/* Approved Settlements */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">
              Approved Settlements
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {formatCurrency(summary.approvedSettlementAmount)}
            </span>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {summary.approvedSettlementCount} settlements settled to date
            </p>
          </div>
        </div>
      </div>

      {/* ── Table Filter and Search ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-full sm:w-auto">
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`flex-1 sm:flex-initial px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[#002625] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Captain, Phone, Ref..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#002625]"
            />
          </div>
        </div>

        {/* Settlements Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50/50">
                <th className="py-3 px-3">Settlement ID</th>
                <th className="py-3 px-3">Captain Details</th>
                <th className="py-3 px-3">Outstanding Cash</th>
                <th className="py-3 px-3">Settlement Amount</th>
                <th className="py-3 px-3">Payment Mode / Ref</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Loader2 size={24} className="animate-spin text-[#002625] mx-auto mb-2" />
                    Loading captain cash settlements…
                  </td>
                </tr>
              ) : filteredSettlements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Banknote size={32} className="mx-auto text-slate-300 mb-2" />
                    No cash settlements found.
                  </td>
                </tr>
              ) : (
                filteredSettlements.map((s) => {
                  const captain = s.captainId || {};
                  const currentOutstanding =
                    captain.outstandingCash !== undefined
                      ? captain.outstandingCash
                      : s.outstandingBefore || 0;

                  return (
                    <tr key={s._id} className="hover:bg-slate-50/80 transition-colors">
                      {/* ID */}
                      <td className="py-3.5 px-3">
                        <span className="font-mono font-bold text-slate-900 block">
                          #{s.settlementId}
                        </span>
                      </td>

                      {/* Captain */}
                      <td className="py-3.5 px-3">
                        <span className="font-bold text-slate-900 block">
                          {s.captainName || captain.name || 'Captain Partner'}
                        </span>
                        <span className="text-[11px] text-slate-500 block">
                          📞 {s.captainPhone || captain.phone || '—'}
                        </span>
                      </td>

                      {/* Outstanding Cash */}
                      <td className="py-3.5 px-3">
                        <span className="font-mono font-bold text-amber-700 block">
                          {formatCurrency(currentOutstanding)}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          Lifetime: {formatCurrency(captain.totalCodCollected || 0)}
                        </span>
                      </td>

                      {/* Settle Amount */}
                      <td className="py-3.5 px-3">
                        <span className="font-mono font-black text-slate-900 text-sm block">
                          {formatCurrency(s.amount)}
                        </span>
                      </td>

                      {/* Mode & Reference */}
                      <td className="py-3.5 px-3">
                        <span className="font-bold text-slate-700 block">
                          {s.paymentMode?.replace('_', ' ') || 'Bank Transfer'}
                        </span>
                        {s.transactionReference ? (
                          <span className="font-mono text-[10px] text-slate-500 block truncate max-w-[120px]">
                            Ref: {s.transactionReference}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 block">—</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                        {formatDate(s.createdAt)}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border uppercase tracking-wider ${
                            STATUS_BADGES[s.status] || 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedSettlement(s);
                            setAdminRemarks(s.adminRemarks || '');
                            setActionSuccessMsg('');
                            setActionErrorMsg('');
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-[#002625] hover:text-white text-slate-700 rounded-xl font-bold text-xs transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          <Eye size={12} />
                          {s.status === 'PENDING' ? 'Review & Settle' : 'View Details'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── VERIFICATION & DETAIL MODAL ── */}
      {selectedSettlement && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 border border-slate-100 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Banknote size={18} className="text-[#002625]" />
                  Settlement #{selectedSettlement.settlementId}
                </h3>
                <span className="text-xs text-slate-400">
                  Requested on {formatDate(selectedSettlement.createdAt)}
                </span>
              </div>
              <button
                onClick={() => setSelectedSettlement(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Captain & Amount Overview Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">CAPTAIN DETAILS</span>
                <span className="text-xs font-bold text-slate-900 block mt-1">
                  {selectedSettlement.captainName || selectedSettlement.captainId?.name}
                </span>
                <span className="text-[11px] text-slate-600 block">
                  📞 {selectedSettlement.captainPhone || selectedSettlement.captainId?.phone}
                </span>
              </div>

              <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200">
                <span className="text-[10px] font-bold uppercase text-emerald-700 block">
                  SETTLEMENT AMOUNT
                </span>
                <span className="text-lg font-black text-emerald-950 font-mono block mt-0.5">
                  {formatCurrency(selectedSettlement.amount)}
                </span>
                <span className="text-[10.5px] font-bold text-emerald-800 block">
                  Mode: {selectedSettlement.paymentMode?.replace('_', ' ')}
                </span>
              </div>
            </div>

            {/* Financial Balance Impact */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <span className="text-[10px] font-bold uppercase text-slate-500 block">
                CAPTAIN COD CASH BALANCE IMPACT
              </span>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">Current Outstanding:</span>
                <span className="font-mono font-bold text-amber-800">
                  {formatCurrency(
                    selectedSettlement.captainId?.outstandingCash !== undefined
                      ? selectedSettlement.captainId?.outstandingCash
                      : selectedSettlement.outstandingBefore
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">Settlement Deduction:</span>
                <span className="font-mono font-bold text-emerald-700">
                  - {formatCurrency(selectedSettlement.amount)}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs font-bold">
                <span className="text-slate-800">Expected Outstanding After Approval:</span>
                <span className="font-mono font-black text-slate-900">
                  {formatCurrency(
                    Math.max(
                      0,
                      (selectedSettlement.captainId?.outstandingCash !== undefined
                        ? selectedSettlement.captainId?.outstandingCash
                        : selectedSettlement.outstandingBefore) - selectedSettlement.amount
                    )
                  )}
                </span>
              </div>
            </div>

            {/* Reference & Remarks */}
            <div className="space-y-2 text-xs">
              {selectedSettlement.transactionReference && (
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-600">UTR / Ref Number:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {selectedSettlement.transactionReference}
                  </span>
                </div>
              )}

              {selectedSettlement.remarks && (
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-600 block mb-0.5">Captain Remarks:</span>
                  <p className="text-slate-800 m-0">{selectedSettlement.remarks}</p>
                </div>
              )}

              {/* Proof Document */}
              {selectedSettlement.proofDocument && (
                <div className="space-y-1.5">
                  <span className="font-bold text-slate-600 block">Payment Proof / Screenshot:</span>
                  <div
                    onClick={() => setPreviewImage(selectedSettlement.proofDocument)}
                    className="relative w-full h-36 rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-100 cursor-pointer group"
                  >
                    <img
                      src={selectedSettlement.proofDocument}
                      alt="Proof Document"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs gap-1">
                      <ExternalLink size={14} /> Click to Expand
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Admin Remarks Input */}
            {selectedSettlement.status === 'PENDING' ? (
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Admin Verification Remarks
                </label>
                <textarea
                  rows={2}
                  value={adminRemarks}
                  onChange={(e) => setAdminRemarks(e.target.value)}
                  placeholder="e.g. Verified via Bank Statement UTR / Cash deposited at counter"
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#002625] resize-none"
                />
              </div>
            ) : selectedSettlement.adminRemarks ? (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <span className="font-bold text-slate-700 block">Admin Remarks:</span>
                <p className="text-slate-800 mt-0.5 m-0">{selectedSettlement.adminRemarks}</p>
                {selectedSettlement.processedAt && (
                  <span className="text-[10px] text-slate-400 block mt-1">
                    Processed at: {formatDate(selectedSettlement.processedAt)}
                  </span>
                )}
              </div>
            ) : null}

            {/* Success & Error Banners */}
            {actionSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-2xl text-center">
                {actionSuccessMsg}
              </div>
            )}
            {actionErrorMsg && (
              <div className="p-3 bg-red-50 border border-red-300 text-red-800 text-xs font-bold rounded-2xl text-center">
                {actionErrorMsg}
              </div>
            )}

            {/* Modal Bottom Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedSettlement(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl cursor-pointer"
              >
                Close
              </button>

              {selectedSettlement.status === 'PENDING' && (
                <>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleProcess('REJECT')}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-2xl shadow-sm cursor-pointer transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <XCircle size={14} />
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleProcess('APPROVE')}
                    className="flex-2 py-3 bg-[#002625] hover:bg-[#0b3d3b] text-white font-extrabold text-xs rounded-2xl shadow-md cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {actionLoading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <CheckCircle size={14} />
                    )}
                    Verify & Approve Settlement
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── IMAGE PREVIEW MODAL ── */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <img src={previewImage} alt="Payment Proof Full" className="max-w-full max-h-[85vh] rounded-2xl object-contain" />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCashSettlements;
