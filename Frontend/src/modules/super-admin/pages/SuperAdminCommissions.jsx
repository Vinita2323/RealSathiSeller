import React, { useState, useEffect, useCallback } from 'react';
import { SuperAdminHeader } from '../components/SuperAdminHeader';
import { superAdminService } from '../../../services/superAdminService';
import { Percent, Search, Store, Edit3, X, Check, AlertCircle } from 'lucide-react';

export const SuperAdminCommissions = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sellers, setSellers] = useState([]);
  const [search, setSearch] = useState('');

  // Edit Modal State
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [newRate, setNewRate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchCommissions = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await superAdminService.getCommissions();
      if (res.success) {
        setSellers(res.sellers || []);
      }
    } catch (err) {
      console.error('Fetch commissions error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCommissions();
  }, [fetchCommissions]);

  const handleUpdate = async () => {
    if (!selectedSeller) return;
    const rate = Number(newRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      setError('Please enter a valid rate between 0% and 100%');
      return;
    }

    setActionLoading(true);
    setError('');

    try {
      const res = await superAdminService.updateSellerCommission(selectedSeller._id, {
        commissionPercentage: rate,
        remarks,
      });

      if (res.success) {
        setSelectedSeller(null);
        fetchCommissions();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update commission');
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = sellers.filter(
    (s) =>
      s.businessName?.toLowerCase().includes(search.toLowerCase()) ||
      s.ownerName?.toLowerCase().includes(search.toLowerCase()) ||
      s.phone?.includes(search)
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans">
      <SuperAdminHeader
        title="Commission Governance Authority"
        subtitle="Exclusive authority to configure, audit, and modify platform seller commission percentages"
        onRefresh={() => fetchCommissions(true)}
        refreshing={refreshing}
      />

      <div className="p-6 space-y-5 flex-1 max-w-7xl mx-auto w-full">
        {/* Search */}
        <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-sm flex items-center justify-between flex-wrap gap-3">
          <div className="relative max-w-md w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Seller Store, Owner, Phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-[#002625] focus:bg-white transition-all"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Governing <span className="text-[#002625] font-bold">{sellers.length}</span> registered stores
          </span>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200/80 rounded-3xl shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-mono text-[11px]">
                <th className="py-3.5 px-4 font-bold">Seller Store</th>
                <th className="py-3.5 px-4 font-bold">Owner & Phone</th>
                <th className="py-3.5 px-4 font-bold">Current Commission</th>
                <th className="py-3.5 px-4 font-bold">Commission Deducted</th>
                <th className="py-3.5 px-4 font-bold">Total Earnings</th>
                <th className="py-3.5 px-4 font-bold">Wallet Balance</th>
                <th className="py-3.5 px-4 font-bold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">Loading commissions...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">No seller stores found.</td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                        <Store size={14} />
                      </span>
                      <span>{s.businessName || 'Seller Store'}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <div className="font-medium text-slate-800">{s.ownerName || 'Partner'}</div>
                      <span className="text-[10px] text-slate-400 font-mono">{s.phone}</span>
                    </td>
                    <td className="py-3.5 px-4 font-black text-emerald-600 font-mono text-sm">
                      {s.commissionPercentage ?? 10}%
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-amber-600">
                      ₹{Number(s.totalCommissionDeducted || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600 font-medium">
                      ₹{Number(s.totalEarnings || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-[#002625]">
                      ₹{Number(s.walletBalance || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => {
                          setSelectedSeller(s);
                          setNewRate(String(s.commissionPercentage ?? 10));
                          setRemarks('');
                          setError('');
                        }}
                        className="px-3 py-1.5 bg-[#002625] hover:bg-[#003837] text-white font-bold rounded-xl border-none cursor-pointer flex items-center gap-1.5 mx-auto shadow-sm transition-all text-[11px]"
                      >
                        <Edit3 size={12} />
                        <span>Edit Rate</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Commission Modal */}
      {selectedSeller && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs text-slate-800">
            <h4 className="text-base font-bold text-slate-900 m-0">
              Update Commission: {selectedSeller.businessName}
            </h4>
            <p className="text-slate-500 m-0 leading-relaxed">
              All future orders for this seller will be settled using this platform commission rate.
            </p>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-semibold">
                {error}
              </div>
            )}

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Commission Percentage (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 font-mono font-bold text-base outline-none focus:border-[#002625] focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Audit Remarks / Justification</label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. High volume tier renegotiation"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 outline-none focus:border-[#002625] focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                disabled={actionLoading}
                onClick={handleUpdate}
                className="flex-1 py-2.5 bg-[#ff5500] hover:bg-[#ea4e00] text-white font-bold rounded-xl border-none cursor-pointer shadow-sm transition-all"
              >
                {actionLoading ? 'Saving Rate...' : 'Confirm Rate Update'}
              </button>
              <button
                onClick={() => setSelectedSeller(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl border-none cursor-pointer transition-all"
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
