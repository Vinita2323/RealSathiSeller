import React, { useState, useEffect, useCallback } from 'react';
import API from '../../../services/api';
import {
  TrendingUp,
  Store,
  Truck,
  Percent,
  RotateCcw,
  Clock,
  RefreshCw,
  Loader2,
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n || 0);

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const STATUS_STYLES = {
  PENDING:    'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED:   'bg-blue-50 text-blue-700 border-blue-200',
  PROCESSING: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  PAID:       'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED:   'bg-red-50 text-red-700 border-red-200',
  REQUESTED:  'bg-amber-50 text-amber-700 border-amber-200',
  COMPLETED:  'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const StatusPill = ({ status }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide ${STATUS_STYLES[status] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
    {status}
  </span>
);

// ─────────────────────────────────────────────
// KPI Card
// ─────────────────────────────────────────────
const KpiCard = ({ icon: Icon, label, value, subLabel, color, onClick }) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-3 ${onClick ? 'cursor-pointer hover:shadow-md hover:border-slate-300 transition-all' : ''}`}
  >
    <div className="flex items-start justify-between">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={18} />
      </div>
      {onClick && <ChevronRight size={14} className="text-slate-300 mt-1" />}
    </div>
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-xl font-bold text-slate-800 mt-0.5 leading-tight">{value}</p>
      {subLabel && <p className="text-[11px] text-slate-400 mt-0.5">{subLabel}</p>}
    </div>
  </div>
);

// ─────────────────────────────────────────────
// Pure-CSS Bar Chart (no external lib)
// ─────────────────────────────────────────────
const RevenueBarChart = ({ data }) => {
  const maxVal = Math.max(...data.map((d) => d.volume), 1);
  return (
    <div className="flex items-end gap-2 h-36 w-full">
      {data.map((d, i) => {
        const pct = Math.max(4, Math.round((d.volume / maxVal) * 100));
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
            <div className="relative w-full flex justify-center">
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                <div className="bg-[#002625] text-white text-[10px] font-semibold px-2 py-1 rounded-lg whitespace-nowrap shadow-lg">
                  {fmt(d.volume)}
                  <br />
                  <span className="font-normal text-white/70">{d.orders} orders</span>
                </div>
                <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-[#002625]" />
              </div>
              {/* Bar — use px height (parent has no sized height for % to resolve) */}
              <div
                className="w-full rounded-t-lg transition-all duration-500 bg-[#002625] group-hover:bg-[#ff5500]"
                style={{ height: `${Math.max(8, Math.round((pct / 100) * 112))}px` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 font-medium truncate w-full text-center">
              {d.month}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export const AdminFinancialDashboard = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // KPI state
  const [metrics, setMetrics] = useState(null);
  const [monthlyChart, setMonthlyChart] = useState([]);

  // Recent lists
  const [recentPayouts, setRecentPayouts] = useState([]);
  const [recentRefunds, setRecentRefunds] = useState([]);

  const fetchAll = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [metricsRes, payoutsRes, refundsRes] = await Promise.all([
        API.get('/super-admin/dashboard/metrics'),
        API.get('/super-admin/payouts?limit=5&page=1'),
        API.get('/super-admin/refunds'),
      ]);

      if (metricsRes.data?.success) {
        setMetrics(metricsRes.data.metrics || null);
        setMonthlyChart(metricsRes.data.monthlyChartData || []);
      }
      if (payoutsRes.data?.success) {
        setRecentPayouts((payoutsRes.data.payouts || []).slice(0, 5));
      }
      if (refundsRes.data?.success) {
        setRecentRefunds((refundsRes.data.refunds || []).slice(0, 5));
      }
    } catch (err) {
      console.error('[AdminFinancialDashboard] fetch error:', err);
      setError('Could not load financial data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Derived KPI values (safe defaults when metrics null) ──
  const totalRevenue         = metrics?.totalPlatformRevenue ?? 0;
  const sellerPayout         = metrics?.totalPendingSellerPayouts ?? 0;
  const sellerPayoutCount    = metrics?.pendingSellerPayoutsCount ?? 0;
  const captainPayout        = metrics?.totalPendingCaptainPayouts ?? 0;
  const captainPayoutCount   = metrics?.pendingCaptainPayoutsCount ?? 0;
  const platformCommission   = metrics?.totalPlatformCommission ?? 0;
  const totalRefunds         = metrics?.totalRefundsAmount ?? 0;
  const totalRefundsCount    = metrics?.totalRefundsCount ?? 0;
  const pendingPayouts       = sellerPayout + captainPayout;
  const pendingPayoutsCount  = sellerPayoutCount + captainPayoutCount;
  const outstandingCaptainCash       = metrics?.outstandingCaptainCash ?? 0;
  const totalCodCollected            = metrics?.totalCodCollected ?? 0;
  const pendingCashSettlementsAmount = metrics?.pendingCashSettlementsAmount ?? 0;
  const pendingCashSettlementsCount  = metrics?.pendingCashSettlementsCount ?? 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 size={32} className="animate-spin text-[#ff5500]" />
        <p className="text-sm text-slate-500">Loading financial data…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      {/* ── Page Header ── */}
      <div className="bg-[#002625] text-white rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-6 -right-6 w-32 h-32 bg-white/5 rounded-full pointer-events-none" />
        <div className="absolute -bottom-8 right-16 w-24 h-24 bg-white/5 rounded-full pointer-events-none" />

        <div className="relative z-10">
          <span className="text-[10px] font-bold uppercase tracking-widest bg-white/15 text-white/80 px-3 py-1 rounded-full">
            Financial Overview
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-white mt-2">
            💰 Financial Dashboard
          </h1>
          <p className="text-xs text-white/70 mt-1">
            Platform revenue, payouts &amp; refund activity at a glance
          </p>
        </div>

        <button
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          className="relative z-10 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between text-rose-700 text-xs">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle size={15} />
            {error}
          </div>
          <button
            onClick={() => fetchAll(true)}
            className="px-3 py-1 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 border-none cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── 6 KPI Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          icon={TrendingUp}
          label="Total Revenue"
          value={fmt(totalRevenue)}
          subLabel="All-time gross orders"
          color="bg-emerald-50 text-emerald-600"
        />
        <KpiCard
          icon={Store}
          label="Seller Payout"
          value={fmt(sellerPayout)}
          subLabel={`${sellerPayoutCount} pending requests`}
          color="bg-blue-50 text-blue-600"
          onClick={() => onNavigate('payout_seller')}
        />
        <KpiCard
          icon={Truck}
          label="Captain Payout"
          value={fmt(captainPayout)}
          subLabel={`${captainPayoutCount} pending requests`}
          color="bg-indigo-50 text-indigo-600"
          onClick={() => onNavigate('payout_captain')}
        />
        <KpiCard
          icon={Percent}
          label="Platform Commission"
          value={fmt(platformCommission)}
          subLabel="Seller commissions earned"
          color="bg-amber-50 text-amber-600"
        />
        <KpiCard
          icon={RotateCcw}
          label="Total Refunds"
          value={fmt(totalRefunds)}
          subLabel={`${totalRefundsCount} refunds processed`}
          color="bg-rose-50 text-rose-600"
          onClick={() => onNavigate('payout_refund_return')}
        />
        <KpiCard
          icon={Clock}
          label="Pending Payouts"
          value={fmt(pendingPayouts)}
          subLabel={`${pendingPayoutsCount} total pending`}
          color="bg-orange-50 text-[#ff5500]"
          onClick={() => onNavigate('payout_seller')}
        />
      </div>

      {/* ── COD & Captain Cash Settlement Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          icon={Banknote}
          label="COD Cash Collected"
          value={fmt(totalCodCollected)}
          subLabel="Lifetime cash collected on delivery"
          color="bg-emerald-50 text-emerald-700"
          onClick={() => onNavigate('payout_captain_settlement')}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Outstanding Captain Cash"
          value={fmt(outstandingCaptainCash)}
          subLabel="Physical cash currently in captains' possession"
          color="bg-amber-50 text-amber-700"
          onClick={() => onNavigate('payout_captain_settlement')}
        />
        <KpiCard
          icon={ShieldCheck}
          label="Pending Cash Settlements"
          value={fmt(pendingCashSettlementsAmount)}
          subLabel={`${pendingCashSettlementsCount} captain settlement${pendingCashSettlementsCount !== 1 ? 's' : ''} awaiting review`}
          color="bg-indigo-50 text-indigo-700"
          onClick={() => onNavigate('payout_captain_settlement')}
        />
      </div>

      {/* ── Revenue Chart ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Revenue Overview</h3>
            <p className="text-xs text-slate-400 mt-0.5">Monthly order volume — last 6 months</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#002625] inline-block" />
              Revenue
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#ff5500] inline-block" />
              Hover
            </span>
          </div>
        </div>

        {monthlyChart.length === 0 ? (
          <div className="flex items-center justify-center h-36 text-sm text-slate-400">
            No revenue data available yet
          </div>
        ) : (
          <>
            <RevenueBarChart data={monthlyChart} />
            {/* Summary row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6 pt-4 border-t border-slate-100">
              {[
                { label: 'This Month', value: fmt(monthlyChart[monthlyChart.length - 1]?.volume) },
                { label: 'Last Month', value: fmt(monthlyChart[monthlyChart.length - 2]?.volume) },
                { label: '6-Month Total', value: fmt(monthlyChart.reduce((s, d) => s + d.volume, 0)) },
              ].map((item) => (
                <div key={item.label} className="bg-slate-50 rounded-xl px-4 py-3">
                  <p className="text-[11px] text-slate-400 font-medium">{item.label}</p>
                  <p className="text-base font-bold text-slate-800 mt-0.5">{item.value}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Bottom Row: Recent Payouts + Recent Refunds ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Recent Payout Requests */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Recent Payout Requests</h3>
              <p className="text-xs text-slate-400 mt-0.5">Latest 5 across seller &amp; captain</p>
            </div>
            <button
              onClick={() => onNavigate('payout_seller')}
              className="flex items-center gap-1 text-xs font-bold text-[#ff5500] hover:underline cursor-pointer bg-transparent border-none"
            >
              View All <ArrowUpRight size={12} />
            </button>
          </div>

          {recentPayouts.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-slate-400">
              <Banknote size={20} className="mr-2 text-slate-300" />
              No payout requests yet
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {recentPayouts.map((p) => (
                <div key={p._id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-[#f0f9f8] flex items-center justify-center shrink-0">
                      {p.recipientType === 'SELLER'
                        ? <Store size={14} className="text-[#002625]" />
                        : <Truck size={14} className="text-[#002625]" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate max-w-[130px]">
                        {p.recipientName || '—'}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {p.recipientType} · {fmtDate(p.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="text-sm font-bold text-slate-800">{fmt(p.requestedAmount)}</p>
                    <StatusPill status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Refund Requests */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Recent Refund Requests</h3>
              <p className="text-xs text-slate-400 mt-0.5">Latest 5 customer refund requests</p>
            </div>
            <button
              onClick={() => onNavigate('payout_refund_return')}
              className="flex items-center gap-1 text-xs font-bold text-[#ff5500] hover:underline cursor-pointer bg-transparent border-none"
            >
              View All <ArrowUpRight size={12} />
            </button>
          </div>

          {recentRefunds.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-slate-400">
              <RotateCcw size={20} className="mr-2 text-slate-300" />
              No refund requests yet
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {recentRefunds.map((r) => (
                <div key={r._id} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 truncate max-w-[140px]">
                      {r.userName || 'Customer'}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {r.orderId ? `Order: ${r.orderId}` : '—'} · {fmtDate(r.createdAt)}
                    </p>
                    {r.reason && (
                      <p className="text-[11px] text-slate-400 italic truncate max-w-[180px]">{r.reason}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <p className="text-sm font-bold text-slate-800">{fmt(r.amount)}</p>
                    <StatusPill status={r.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
