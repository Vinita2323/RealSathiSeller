import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SuperAdminHeader } from '../components/SuperAdminHeader';
import { superAdminService } from '../../../services/superAdminService';
import {
  DollarSign,
  TrendingUp,
  Store,
  Truck,
  ArrowUpRight,
  Clock,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Percent,
  Wallet,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  Loader2,
  RefreshCw,
} from 'lucide-react';

export const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await superAdminService.getDashboardMetrics();
      if (res.success) {
        setData(res);
      }
    } catch (err) {
      console.error('Super Admin Metrics Error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load financial metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const metrics = data?.metrics || {};
  const monthlyChartData = data?.monthlyChartData || [];
  const recentLedger = data?.recentLedger || [];

  const maxChartVolume = Math.max(
    ...(monthlyChartData.map((d) => Number(d.volume) || 0)),
    1
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans">
      <SuperAdminHeader
        title="Financial Dashboard"
        subtitle="Single-authority platform treasury, settlements, and liability governance"
        onRefresh={() => fetchData(true)}
        refreshing={refreshing}
      />

      <div className="p-6 space-y-6 flex-1 max-w-7xl mx-auto w-full">
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-semibold flex items-center justify-between shadow-2xs">
            <span>{error}</span>
            <button
              onClick={() => fetchData(true)}
              className="underline bg-transparent border-none text-rose-700 cursor-pointer font-bold"
            >
              Retry
            </button>
          </div>
        )}

        {/* 1. Hero Treasury Banner */}
        <div className="bg-gradient-to-r from-[#002625] via-[#003837] to-[#043d3a] rounded-3xl p-6 sm:p-7 shadow-md relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-white border border-[#0d4a48]">
          <div className="relative z-10 space-y-2 max-w-2xl">
            <span className="text-[10.5px] font-mono font-extrabold tracking-widest uppercase bg-[#ff5500] text-white px-3 py-1 rounded-full shadow-xs">
              CENTRAL TREASURY OVERVIEW
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight m-0">
              Platform Gross Revenue: ₹{Number(metrics.totalPlatformRevenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </h2>
            <p className="text-xs sm:text-sm text-teal-100/90 font-medium m-0 leading-relaxed">
              Recorded across {metrics.totalCustomerTransactions || 0} customer orders. Total platform commission realized:{' '}
              <span className="text-emerald-300 font-extrabold">₹{Number(metrics.totalPlatformCommission || 0).toFixed(2)}</span>.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 relative z-10">
            <button
              onClick={() => navigate('/super-admin/payouts')}
              className="px-4 py-2.5 bg-[#ff5500] hover:bg-[#ea4e00] text-white font-extrabold text-xs rounded-xl border-none cursor-pointer flex items-center gap-2 shadow-md transition-all active:scale-95"
            >
              <ArrowUpRight size={16} />
              <span>Review Payouts ({Number(metrics.pendingSellerPayoutsCount || 0) + Number(metrics.pendingCaptainPayoutsCount || 0)})</span>
            </button>
            <button
              onClick={() => navigate('/super-admin/financial-adjustments')}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/20 cursor-pointer flex items-center gap-2 transition-all active:scale-95"
            >
              <Wallet size={16} />
              <span>Manual Adjustment</span>
            </button>
          </div>
        </div>

        {/* 2. Key Metrics Grid (12 Primary Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Platform Commission */}
          <div className="bg-white border border-slate-200/80 hover:border-emerald-500/50 p-4.5 rounded-2xl shadow-xs hover:shadow-sm transition-all space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Platform Commission</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                <Percent size={18} />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 m-0">
              ₹{Number(metrics.totalPlatformCommission || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-emerald-700 font-semibold m-0">Net platform realized revenue</p>
          </div>

          {/* Card 2: Total Seller Earnings */}
          <div className="bg-white border border-slate-200/80 hover:border-blue-500/50 p-4.5 rounded-2xl shadow-xs hover:shadow-sm transition-all space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Total Seller Earnings</span>
              <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
                <Store size={18} />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 m-0">
              ₹{Number(metrics.totalSellerEarnings || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-slate-500 font-medium m-0">Cumulative seller share</p>
          </div>

          {/* Card 3: Total Captain Earnings */}
          <div className="bg-white border border-slate-200/80 hover:border-amber-500/50 p-4.5 rounded-2xl shadow-xs hover:shadow-sm transition-all space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Total Captain Earnings</span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                <Truck size={18} />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 m-0">
              ₹{Number(metrics.totalCaptainEarnings || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-slate-500 font-medium m-0">Delivery & transport fees</p>
          </div>

          {/* Card 4: Outstanding Liabilities */}
          <div className="bg-white border border-amber-200 hover:border-amber-400 p-4.5 rounded-2xl shadow-xs hover:shadow-sm transition-all space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Outstanding Liabilities</span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                <Wallet size={18} />
              </div>
            </div>
            <p className="text-2xl font-black text-amber-700 m-0">
              ₹{Number(metrics.totalOutstandingLiabilities || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-slate-500 font-medium m-0">Held in seller & captain wallets</p>
          </div>

          {/* Card 5: Pending Seller Payouts */}
          <div className="bg-white border border-slate-200/80 hover:border-purple-500/50 p-4.5 rounded-2xl shadow-xs hover:shadow-sm transition-all space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Pending Seller Payouts</span>
              <div className="p-2 rounded-xl bg-purple-50 text-purple-700">
                <Clock size={18} />
              </div>
            </div>
            <p className="text-2xl font-black text-purple-800 m-0">
              ₹{Number(metrics.totalPendingSellerPayouts || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-purple-700 font-semibold m-0">
              {metrics.pendingSellerPayoutsCount || 0} requests awaiting review
            </p>
          </div>

          {/* Card 6: Pending Captain Payouts */}
          <div className="bg-white border border-slate-200/80 hover:border-indigo-500/50 p-4.5 rounded-2xl shadow-xs hover:shadow-sm transition-all space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Pending Captain Payouts</span>
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
                <Clock size={18} />
              </div>
            </div>
            <p className="text-2xl font-black text-indigo-800 m-0">
              ₹{Number(metrics.totalPendingCaptainPayouts || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-indigo-700 font-semibold m-0">
              {metrics.pendingCaptainPayoutsCount || 0} requests awaiting review
            </p>
          </div>

          {/* Card 7: Completed Payouts */}
          <div className="bg-white border border-slate-200/80 hover:border-emerald-500/50 p-4.5 rounded-2xl shadow-xs hover:shadow-sm transition-all space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Completed Payouts</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                <CheckCircle size={18} />
              </div>
            </div>
            <p className="text-2xl font-black text-emerald-700 m-0">
              ₹{Number(metrics.totalCompletedPayouts || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-slate-500 font-medium m-0">
              {metrics.totalCompletedPayoutsCount || 0} successfully settled
            </p>
          </div>

          {/* Card 8: Pending Settlements */}
          <div className="bg-white border border-slate-200/80 hover:border-amber-500/50 p-4.5 rounded-2xl shadow-xs hover:shadow-sm transition-all space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Pending Settlements</span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                <Layers size={18} />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 m-0">
              ₹{Number(metrics.totalPendingSettlements || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-slate-500 font-medium m-0">
              {metrics.pendingSettlementsCount || 0} orders in delivery transit
            </p>
          </div>

          {/* Card 9: Today's Transactions Volume */}
          <div className="bg-white border border-slate-200/80 hover:border-emerald-500/50 p-4.5 rounded-2xl shadow-xs hover:shadow-sm transition-all space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Today's Transactions</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                <Calendar size={18} />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 m-0">
              ₹{Number(metrics.todayTransactionsVolume || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-slate-500 font-medium m-0">
              {metrics.todayTransactionsCount || 0} orders processed today
            </p>
          </div>

          {/* Card 10: Today's Payouts Settled */}
          <div className="bg-white border border-slate-200/80 hover:border-blue-500/50 p-4.5 rounded-2xl shadow-xs hover:shadow-sm transition-all space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Today's Payouts Settled</span>
              <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
                <CheckCircle size={18} />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-900 m-0">
              ₹{Number(metrics.todayPayoutsAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-slate-500 font-medium m-0">
              {metrics.todayPayoutsCount || 0} payouts completed today
            </p>
          </div>

          {/* Card 11: Total Refunds */}
          <div className="bg-white border border-rose-200 hover:border-rose-400 p-4.5 rounded-2xl shadow-xs hover:shadow-sm transition-all space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Total Refunds</span>
              <div className="p-2 rounded-xl bg-rose-50 text-rose-700">
                <RotateCcw size={18} />
              </div>
            </div>
            <p className="text-2xl font-black text-rose-700 m-0">
              ₹{Number(metrics.totalRefundsAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-slate-500 font-medium m-0">
              {metrics.totalRefundsCount || 0} completed refund requests
            </p>
          </div>

          {/* Card 12: Seller vs Captain Liabilities */}
          <div className="bg-white border border-slate-200/80 hover:border-teal-500/50 p-4.5 rounded-2xl shadow-xs hover:shadow-sm transition-all space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Liability Distribution</span>
              <div className="p-2 rounded-xl bg-teal-50 text-[#002625]">
                <Building2 size={18} />
              </div>
            </div>
            <div className="flex items-baseline justify-between text-xs pt-1">
              <span className="text-slate-500 font-bold">Sellers:</span>
              <span className="font-extrabold text-slate-900">₹{Number(metrics.sellerOutstandingLiability || 0).toFixed(2)}</span>
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-500 font-bold">Captains:</span>
              <span className="font-extrabold text-slate-900">₹{Number(metrics.captainOutstandingLiability || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* 3. Monthly Volume Visual & Liabilities Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Monthly Transaction Volume Chart */}
          <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-[#002625] m-0">Monthly Transaction Volume</h3>
                <p className="text-xs text-slate-500 m-0">Gross order volume processed by platform (past 6 months)</p>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                Audited
              </span>
            </div>

            <div className="h-48 flex items-end justify-between gap-3 pt-6 px-2">
              {monthlyChartData.map((item, idx) => {
                const heightPct = Math.max(8, Math.round((item.volume / maxChartVolume) * 100));
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                    <div className="text-[11px] font-bold text-[#ff5500] opacity-0 group-hover:opacity-100 transition-opacity font-mono">
                      ₹{Number(item.volume).toFixed(0)}
                    </div>
                    <div
                      style={{ height: `${heightPct}%` }}
                      className="w-full bg-gradient-to-t from-[#002625] to-[#ff5500] rounded-xl transition-all duration-500 group-hover:brightness-110 shadow-xs"
                    />
                    <span className="text-[11px] font-bold text-slate-600 font-mono truncate max-w-[60px]">
                      {item.month}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Payout Approval Direct Action */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-5 flex flex-col justify-between">
            <div className="space-y-3">
              <h3 className="text-base font-black text-[#002625] m-0">Payout Approval Queue</h3>
              <p className="text-xs text-slate-500 m-0 leading-relaxed">
                Requires Super Admin authorization before money can be released from platform accounts.
              </p>

              <div className="space-y-3 pt-2">
                <div
                  onClick={() => navigate('/super-admin/payouts?tab=SELLER')}
                  className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl cursor-pointer transition-all flex items-center justify-between shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
                      <Store size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-slate-900 m-0">Seller Payouts</p>
                      <p className="text-[11px] text-slate-500 m-0">
                        {metrics.pendingSellerPayoutsCount || 0} Pending Requests
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-purple-700">
                    ₹{Number(metrics.totalPendingSellerPayouts || 0).toFixed(2)}
                  </span>
                </div>

                <div
                  onClick={() => navigate('/super-admin/payouts?tab=CAPTAIN')}
                  className="p-3.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl cursor-pointer transition-all flex items-center justify-between shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                      <Truck size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-slate-900 m-0">Captain Payouts</p>
                      <p className="text-[11px] text-slate-500 m-0">
                        {metrics.pendingCaptainPayoutsCount || 0} Pending Requests
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-indigo-700">
                    ₹{Number(metrics.totalPendingCaptainPayouts || 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/super-admin/payouts')}
              className="w-full py-2.5 bg-[#002625] hover:bg-[#003837] text-white font-extrabold text-xs rounded-xl border-none cursor-pointer flex items-center justify-center gap-2 transition-all shadow-xs active:scale-95"
            >
              <span>Manage All Payout Requests</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* 4. Recent Central Ledger Entries */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-[#002625] m-0">Recent Central Ledger Entries</h3>
              <p className="text-xs text-slate-500 m-0">Immutable, audited real-time platform financial movements</p>
            </div>
            <button
              onClick={() => navigate('/super-admin/transactions')}
              className="text-xs text-[#ff5500] hover:text-[#ea4e00] font-bold bg-transparent border-none cursor-pointer flex items-center gap-1"
            >
              <span>View Full Ledger</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 uppercase tracking-wider font-extrabold text-[10.5px]">
                  <th className="py-3 px-3">Txn ID</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Party</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentLedger.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                      No central ledger transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  recentLedger.map((txn) => (
                    <tr key={txn._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-[#ff5500]">{txn.transactionId}</td>
                      <td className="py-3 px-3 font-semibold text-slate-800">{txn.category?.replace(/_/g, ' ')}</td>
                      <td className="py-3 px-3 text-slate-600">{txn.entityName || txn.entityType}</td>
                      <td className="py-3 px-3 font-black text-slate-900 font-mono">₹{Number(txn.amount || 0).toFixed(2)}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full font-extrabold font-mono text-[10px] ${
                            txn.type === 'CREDIT'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {txn.type}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {txn.status || 'SUCCESS'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 font-mono text-[11px]">
                        {new Date(txn.createdAt).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
