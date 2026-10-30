import React, { useState, useEffect, useCallback } from 'react';
import { SuperAdminHeader } from '../components/SuperAdminHeader';
import { superAdminService } from '../../../services/superAdminService';
import { Search, Truck, Wallet, Banknote, ChevronLeft, ChevronRight } from 'lucide-react';

export const SuperAdminCaptainSettlements = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [captains, setCaptains] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');

  const fetchCaptains = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      try {
        const res = await superAdminService.getCaptainSettlements({ page, limit: 25 });
        if (res.success) {
          setCaptains(res.captains || []);
          setTotal(res.total || 0);
          setPages(res.pages || 1);
        }
      } catch (err) {
        console.error('Fetch captain settlements error:', err);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page]
  );

  useEffect(() => {
    fetchCaptains();
  }, [fetchCaptains]);

  const filtered = captains.filter(
    (c) =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search) ||
      c.vehicleType?.toLowerCase().includes(search.toLowerCase())
  );

  const totalCaptainLiability = captains.reduce((acc, c) => acc + (c.walletBalance || 0), 0);
  const totalCashCollected = captains.reduce((acc, c) => acc + (c.cashCollected || 0), 0);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans">
      <SuperAdminHeader
        title="Captain Settlements & Fleet Balances"
        subtitle="Delivery partner earnings, unwithdrawn wallet balances, and COD cash collected governance"
        onRefresh={() => fetchCaptains(true)}
        refreshing={refreshing}
      />

      <div className="p-6 space-y-5 flex-1 max-w-7xl mx-auto w-full">
        {/* Quick Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200/80 p-4.5 rounded-2xl shadow-xs space-y-1">
            <span className="text-slate-500 text-xs font-extrabold uppercase">Total Captain Liability</span>
            <p className="text-2xl font-black text-amber-700 m-0">₹{Number(totalCaptainLiability).toFixed(2)}</p>
            <p className="text-[11px] text-slate-500 font-medium m-0">Available in captain wallets</p>
          </div>
          <div className="bg-white border border-slate-200/80 p-4.5 rounded-2xl shadow-xs space-y-1">
            <span className="text-slate-500 text-xs font-extrabold uppercase">COD Cash Collected</span>
            <p className="text-2xl font-black text-emerald-700 m-0">₹{Number(totalCashCollected).toFixed(2)}</p>
            <p className="text-[11px] text-slate-500 font-medium m-0">Cash in hand by captains</p>
          </div>
          <div className="bg-white border border-slate-200/80 p-4.5 rounded-2xl shadow-xs space-y-1">
            <span className="text-slate-500 text-xs font-extrabold uppercase">Active Delivery Fleet</span>
            <p className="text-2xl font-black text-slate-900 m-0">{total}</p>
            <p className="text-[11px] text-emerald-700 font-semibold m-0">Registered captains</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white border border-slate-200/80 p-3.5 rounded-2xl shadow-xs">
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Captain Name, Phone, Vehicle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-[#ff5500]"
            />
          </div>
        </div>

        {/* Captains Table */}
        <div className="bg-white border border-slate-200/80 rounded-3xl shadow-xs overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 uppercase tracking-wider font-extrabold text-[11px]">
                <th className="py-3.5 px-4 font-bold">Captain Partner</th>
                <th className="py-3.5 px-4 font-bold">Mobile Phone</th>
                <th className="py-3.5 px-4 font-bold">Vehicle Type</th>
                <th className="py-3.5 px-4 font-bold">Wallet Balance (Payable)</th>
                <th className="py-3.5 px-4 font-bold">Cash Collected (COD)</th>
                <th className="py-3.5 px-4 font-bold">Status</th>
                <th className="py-3.5 px-4 font-bold">Joined Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">Loading captain balances...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">No captain records found.</td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                      <span className="p-1 rounded-md bg-indigo-50 text-indigo-700">
                        <Truck size={14} />
                      </span>
                      <span>{c.name || 'Captain Partner'}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600 font-semibold">{c.phone}</td>
                    <td className="py-3.5 px-4 text-slate-600">{c.vehicleType || 'Two Wheeler'}</td>
                    <td className="py-3.5 px-4 font-black text-amber-700 font-mono text-sm">
                      ₹{Number(c.walletBalance || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      ₹{Number(c.cashCollected || 0).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {c.status || 'Active'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(c.createdAt).toLocaleDateString('en-IN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
