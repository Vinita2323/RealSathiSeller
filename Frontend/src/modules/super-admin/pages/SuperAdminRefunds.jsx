import React, { useState, useEffect, useCallback } from 'react';
import { SuperAdminHeader } from '../components/SuperAdminHeader';
import { superAdminService } from '../../../services/superAdminService';
import { RotateCcw, Search, Check, X, AlertCircle, Loader2 } from 'lucide-react';

export const SuperAdminRefunds = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refunds, setRefunds] = useState([]);
  const [search, setSearch] = useState('');

  // Process Modal State
  const [selectedRefund, setSelectedRefund] = useState(null);
  const [modalStatus, setModalStatus] = useState('COMPLETED');
  const [gatewayRefundId, setGatewayRefundId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchRefunds = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await superAdminService.getRefunds();
      if (res.success) {
        setRefunds(res.refunds || []);
      }
    } catch (err) {
      console.error('Fetch refunds error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRefunds();
  }, [fetchRefunds]);

  const handleProcessSubmit = async () => {
    if (!selectedRefund) return;
    setActionLoading(true);
    setError('');

    try {
      const res = await superAdminService.processRefund(selectedRefund._id, {
        status: modalStatus,
        gatewayRefundId,
        remarks,
      });

      if (res.success) {
        setSelectedRefund(null);
        fetchRefunds();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update refund');
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = refunds.filter(
    (r) =>
      r.refundId?.toLowerCase().includes(search.toLowerCase()) ||
      r.orderId?.toLowerCase().includes(search.toLowerCase()) ||
      r.userName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans">
      <SuperAdminHeader
        title="Refunds & Returns Governance"
        subtitle="Customer order refunds, gateway refund tracking, and ledger reconciliation"
        onRefresh={() => fetchRefunds(true)}
        refreshing={refreshing}
      />

      <div className="p-6 space-y-5 flex-1 max-w-7xl mx-auto w-full">
        {/* Search */}
        <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-xs flex items-center justify-between">
          <div className="relative max-w-md w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Refund ID, Order ID, Customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-[#ff5500]"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200/80 rounded-3xl shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 uppercase tracking-wider font-extrabold text-[11px]">
                <th className="py-3.5 px-4">Refund ID</th>
                <th className="py-3.5 px-4">Order ID</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Refund Amount</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Gateway Ref</th>
                <th className="py-3.5 px-4">Created Date</th>
                <th className="py-3.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">Loading refunds...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">No refund records found.</td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#ff5500]">{r.refundId}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">#{r.orderId}</td>
                    <td className="py-3.5 px-4 text-slate-800 font-semibold">{r.userName || 'Customer'}</td>
                    <td className="py-3.5 px-4 font-black text-rose-700 font-mono text-sm">
                      ₹{Number(r.amount).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                          r.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : r.status === 'PENDING'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">{r.gatewayRefundId || '—'}</td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(r.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => {
                          setSelectedRefund(r);
                          setModalStatus(r.status || 'COMPLETED');
                          setGatewayRefundId(r.gatewayRefundId || '');
                          setRemarks(r.remarks || '');
                          setError('');
                        }}
                        className="px-3 py-1.5 bg-[#002625] hover:bg-[#003837] text-white font-extrabold rounded-xl border-none cursor-pointer transition-all shadow-2xs text-[11px] active:scale-95"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {selectedRefund && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-[#002625] m-0">Process Refund {selectedRefund.refundId}</h3>
              <button
                onClick={() => setSelectedRefund(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer border-none"
              >
                <X size={16} />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 font-extrabold mb-1">Status</label>
                <select
                  value={modalStatus}
                  onChange={(e) => setModalStatus(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-bold outline-none focus:border-[#ff5500]"
                >
                  <option value="COMPLETED">Completed / Refunded</option>
                  <option value="PENDING">Pending Approval</option>
                  <option value="FAILED">Failed</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-extrabold mb-1">Razorpay / Gateway Refund ID</label>
                <input
                  type="text"
                  placeholder="e.g. rfnd_xxxxxxxxxxxxxx"
                  value={gatewayRefundId}
                  onChange={(e) => setGatewayRefundId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold outline-none focus:border-[#ff5500]"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-extrabold mb-1">Remarks</label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Refund notes or justification..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 outline-none focus:border-[#ff5500]"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                disabled={actionLoading}
                onClick={handleProcessSubmit}
                className="flex-1 py-2.5 bg-[#ff5500] hover:bg-[#ea4e00] text-white font-extrabold rounded-xl border-none cursor-pointer shadow-md active:scale-95"
              >
                {actionLoading ? 'Saving...' : 'Update Refund Status'}
              </button>
              <button
                onClick={() => setSelectedRefund(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl border-none cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
