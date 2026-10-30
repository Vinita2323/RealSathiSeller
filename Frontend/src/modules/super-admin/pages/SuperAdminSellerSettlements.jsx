import React, { useState, useEffect, useCallback } from 'react';
import { SuperAdminHeader } from '../components/SuperAdminHeader';
import { superAdminService } from '../../../services/superAdminService';
import { useDebounce } from '../../../hooks/useDebounce';
import { Search, Store, Percent, CheckCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

export const SuperAdminSellerSettlements = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settlements, setSettlements] = useState([]);
  const [summary, setSummary] = useState({
    totalSettledAmount: 0,
    pendingSettlementAmount: 0,
    totalCommissionEarned: 0,
    totalTransactions: 0,
  });
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState('ALL');

  // Reset page when debounced search query changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const fetchSettlements = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      try {
        const res = await superAdminService.getSellerSettlements({
          page,
          status,
          search: debouncedSearch,
          limit: 25,
        });

        if (res.success) {
          setSettlements(res.settlements || []);
          if (res.summary) setSummary(res.summary);
          setPages(res.pages || 1);
        }
      } catch (err) {
        console.error('Fetch seller settlements error:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, status, debouncedSearch]
  );

  useEffect(() => {
    fetchSettlements();
  }, [fetchSettlements]);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans">
      <SuperAdminHeader
        title="Seller Settlements & Commissions"
        subtitle="Audited breakdown of gross sales, platform commissions deducted, and net seller payables"
        onRefresh={() => fetchSettlements(true)}
        refreshing={refreshing}
      />

      <div className="p-6 space-y-5 flex-1 max-w-7xl mx-auto w-full">
        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200/80 p-4.5 rounded-2xl shadow-xs space-y-1">
            <span className="text-slate-500 text-xs font-extrabold uppercase">Total Settled to Sellers</span>
            <p className="text-2xl font-black text-emerald-700 m-0">₹{Number(summary.totalSettledAmount).toFixed(2)}</p>
            <p className="text-[11px] text-slate-500 font-medium m-0">Delivered & credited orders</p>
          </div>
          <div className="bg-white border border-slate-200/80 p-4.5 rounded-2xl shadow-xs space-y-1">
            <span className="text-slate-500 text-xs font-extrabold uppercase">Pending Delivery Settlement</span>
            <p className="text-2xl font-black text-amber-700 m-0">₹{Number(summary.pendingSettlementAmount).toFixed(2)}</p>
            <p className="text-[11px] text-slate-500 font-medium m-0">Orders currently in transit</p>
          </div>
          <div className="bg-white border border-slate-200/80 p-4.5 rounded-2xl shadow-xs space-y-1">
            <span className="text-slate-500 text-xs font-extrabold uppercase">Total Commission Realized</span>
            <p className="text-2xl font-black text-slate-900 m-0">₹{Number(summary.totalCommissionEarned).toFixed(2)}</p>
            <p className="text-[11px] text-emerald-700 font-semibold m-0">Platform earnings share</p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-xs">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Order ID, Seller Name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-[#ff5500]"
            />
          </div>

          <div className="flex items-center gap-2">
            {['ALL', 'SETTLED', 'PENDING'].map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatus(st);
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border-none cursor-pointer transition-all ${
                  status === st ? 'bg-[#002625] text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-slate-200/80 rounded-3xl shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 uppercase tracking-wider font-extrabold text-[11px]">
                <th className="py-3.5 px-4">Order ID</th>
                <th className="py-3.5 px-4">Seller Store</th>
                <th className="py-3.5 px-4">Gross Order</th>
                <th className="py-3.5 px-4">Commission</th>
                <th className="py-3.5 px-4">Net Seller Payable</th>
                <th className="py-3.5 px-4">Settlement Status</th>
                <th className="py-3.5 px-4">Order Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">Loading settlements...</td>
                </tr>
              ) : settlements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">No seller settlement records found.</td>
                </tr>
              ) : (
                settlements.map((s) => (
                  <tr key={s._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#ff5500]">#{s.orderId}</td>
                    <td className="py-3.5 px-4 font-extrabold text-slate-900">{s.sellerName || 'Seller Store'}</td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                      ₹{Number(s.totalAmount || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-amber-700">
                      ₹{Number(s.commissionAmount || 0).toFixed(2)} ({s.commissionRate || 10}%)
                    </td>
                    <td className="py-3.5 px-4 font-black text-slate-900 font-mono text-sm">
                      ₹{Number(s.netSellerAmount || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] font-mono ${
                          s.settlementStatus === 'SETTLED'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {s.settlementStatus || 'PENDING'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(s.createdAt).toLocaleDateString('en-IN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="p-4 bg-slate-50/80 border-t border-slate-200/80 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">
              Page <span className="text-slate-900 font-extrabold">{page}</span> of{' '}
              <span className="text-slate-900 font-extrabold">{pages}</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer shadow-2xs"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-lg bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 disabled:opacity-40 cursor-pointer shadow-2xs"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
