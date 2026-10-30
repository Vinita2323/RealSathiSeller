import React, { useState, useEffect, useCallback } from 'react';
import { StatWidget, StatusBadge } from '../components/AdminUIComponents';
import { adminService } from '../../../services/authService';
import { 
  Users, 
  Store, 
  Truck, 
  ShoppingCart, 
  DollarSign, 
  Clock, 
  AlertTriangle, 
  UserCheck, 
  ArrowUpRight,
  TrendingUp,
  Plus,
  List,
  Layers,
  Package,
  ClipboardList,
  CheckCircle2,
  XCircle,
  ShoppingBag,
  RefreshCw,
  Loader2,
  Calendar
} from 'lucide-react';

export const AdminDashboard = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCategories: 0,
    totalSubcategories: 0,
    totalProducts: 0,
    productSoldOut: 0,
    lowStockProducts: 0,
    totalOrders: 0,
    completedOrders: 0,
    pendingOrders: 0,
    cancelledOrders: 0,
    totalSellers: 0,
    pendingSellerApprovals: 0,
    totalCaptains: 0,
    activeCaptains: 0,
    revenueToday: 0,
    totalVolume: 0,
  });

  const [revenueChartData, setRevenueChartData] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [topSellers, setTopSellers] = useState([]);

  // Table pagination & page size states
  const [orderEntries, setOrderEntries] = useState(10);
  const [orderPage, setOrderPage] = useState(1);
  const [sellerEntries, setSellerEntries] = useState(10);
  const [sellerPage, setSellerPage] = useState(1);

  const fetchDashboardData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await adminService.getDashboardStats();
      if (res && res.success) {
        if (res.stats) setStats(res.stats);
        if (Array.isArray(res.revenueChartData)) setRevenueChartData(res.revenueChartData);
        if (Array.isArray(res.recentOrders)) setRecentOrders(res.recentOrders);
        if (Array.isArray(res.topSellers)) setTopSellers(res.topSellers);
      }
    } catch (err) {
      console.error('Failed to fetch live admin dashboard stats:', err);
      setError(err.message || 'Failed to load live data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Order pagination slice
  const paginatedOrders = recentOrders.slice(
    (orderPage - 1) * orderEntries,
    orderPage * orderEntries
  );
  const totalOrderPages = Math.max(1, Math.ceil(recentOrders.length / orderEntries));

  // Seller pagination slice
  const paginatedSellers = topSellers.slice(
    (sellerPage - 1) * sellerEntries,
    sellerPage * sellerEntries
  );
  const totalSellerPages = Math.max(1, Math.ceil(topSellers.length / sellerEntries));

  // Max revenue in chart for proportional bar calculation
  const maxChartRevenue = revenueChartData.length > 0 
    ? Math.max(...revenueChartData.map(d => Number(d.revenue) || 0), 1)
    : 1;

  return (
    <div className="space-y-6 animate-fadeIn pb-10">
      {/* Orange Hero Banner matching Seller Dashboard Overview */}
      <div className="bg-[#ff5500] text-white rounded-2xl p-6 shadow-sm relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="relative z-10">
          <span className="text-[11px] font-bold uppercase tracking-wider bg-white/20 text-white px-3 py-1 rounded-full">
            SUPER ADMIN DASHBOARD OVERVIEW (LIVE DATA)
          </span>
          <h1 className="text-2xl md:text-3xl font-bold text-white mt-2 tracking-tight">
            Welcome back, System Administrator! 👋
          </h1>
          <p className="text-xs md:text-sm text-white/90 mt-1 max-w-xl">
            Here is your live real-time platform performance, seller compliance queue, delivery operations, and financial metrics.
          </p>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <button 
            onClick={() => onNavigate('sellers')}
            className="px-4 py-2.5 bg-white text-[#ff5500] hover:bg-slate-100 text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5 border-none"
          >
            <UserCheck size={16} />
            <span>Pending Approvals ({stats.pendingSellerApprovals ?? 0})</span>
          </button>
          <button 
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            title="Refresh Live Data"
            className="p-2.5 bg-black/20 hover:bg-black/30 text-white rounded-xl transition-all cursor-pointer border border-white/20 flex items-center justify-center"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading && !refreshing && (
        <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center flex flex-col items-center justify-center gap-3">
          <Loader2 size={32} className="animate-spin text-[#ff5500]" />
          <p className="text-sm font-semibold text-slate-600">Loading live platform statistics from database...</p>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between text-rose-700 text-xs">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle size={16} />
            <span>Could not refresh live statistics: {error}</span>
          </div>
          <button 
            onClick={() => fetchDashboardData(true)} 
            className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Primary 10 Metrics Cards Grid (Compact) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
        {/* Total User */}
        <div 
          onClick={() => onNavigate('users')}
          className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-sm transition-all duration-200 group cursor-pointer flex flex-col justify-between"
        >
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center mb-1.5 shrink-0">
            <Users size={15} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 leading-tight">Total User</p>
            <h3 className="text-lg font-bold text-slate-900 group-hover:text-[#ff5500] transition-colors mt-0.5 leading-none">
              {stats.totalUsers ?? 0}
            </h3>
          </div>
        </div>

        {/* Total Category */}
        <div 
          onClick={() => onNavigate('categories')}
          className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-sm transition-all duration-200 group cursor-pointer flex flex-col justify-between"
        >
          <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center mb-1.5 shrink-0">
            <List size={15} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 leading-tight">Total Category</p>
            <h3 className="text-lg font-bold text-slate-900 group-hover:text-[#ff5500] transition-colors mt-0.5 leading-none">
              {stats.totalCategories ?? 0}
            </h3>
          </div>
        </div>

        {/* Total Subcategory */}
        <div 
          onClick={() => onNavigate('categories')}
          className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-sm transition-all duration-200 group cursor-pointer flex flex-col justify-between"
        >
          <div className="w-7 h-7 rounded-lg bg-pink-50 text-pink-500 flex items-center justify-center mb-1.5 shrink-0">
            <Layers size={15} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 leading-tight">Total Subcategory</p>
            <h3 className="text-lg font-bold text-slate-900 group-hover:text-[#ff5500] transition-colors mt-0.5 leading-none">
              {stats.totalSubcategories ?? 0}
            </h3>
          </div>
        </div>

        {/* Total Product */}
        <div 
          onClick={() => onNavigate('products')}
          className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-sm transition-all duration-200 group cursor-pointer flex flex-col justify-between"
        >
          <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center mb-1.5 shrink-0">
            <ShoppingBag size={15} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 leading-tight">Total Product</p>
            <h3 className="text-lg font-bold text-slate-900 group-hover:text-[#ff5500] transition-colors mt-0.5 leading-none">
              {stats.totalProducts ?? 0}
            </h3>
          </div>
        </div>

        {/* Total Orders */}
        <div 
          onClick={() => onNavigate('orders')}
          className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-sm transition-all duration-200 group cursor-pointer flex flex-col justify-between"
        >
          <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-500 flex items-center justify-center mb-1.5 shrink-0">
            <ClipboardList size={15} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 leading-tight">Total Orders</p>
            <h3 className="text-lg font-bold text-slate-900 group-hover:text-[#ff5500] transition-colors mt-0.5 leading-none">
              {stats.totalOrders ?? 0}
            </h3>
          </div>
        </div>

        {/* Completed Orders */}
        <div 
          onClick={() => onNavigate('orders')}
          className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-sm transition-all duration-200 group cursor-pointer flex flex-col justify-between"
        >
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-1.5 shrink-0">
            <CheckCircle2 size={15} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 leading-tight">Completed Orders</p>
            <h3 className="text-lg font-bold text-slate-900 group-hover:text-[#ff5500] transition-colors mt-0.5 leading-none">
              {stats.completedOrders ?? 0}
            </h3>
          </div>
        </div>

        {/* Pending Orders */}
        <div 
          onClick={() => onNavigate('orders')}
          className="bg-white p-3 rounded-xl border border-emerald-400/80 shadow-2xs hover:shadow-sm transition-all duration-200 group cursor-pointer flex flex-col justify-between"
        >
          <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-500 flex items-center justify-center mb-1.5 shrink-0">
            <ClipboardList size={15} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 leading-tight">Pending Orders</p>
            <h3 className="text-lg font-bold text-slate-900 group-hover:text-[#ff5500] transition-colors mt-0.5 leading-none">
              {stats.pendingOrders ?? 0}
            </h3>
          </div>
        </div>

        {/* Cancelled Orders */}
        <div 
          onClick={() => onNavigate('orders')}
          className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-sm transition-all duration-200 group cursor-pointer flex flex-col justify-between"
        >
          <div className="w-7 h-7 rounded-lg bg-red-50 text-red-500 flex items-center justify-center mb-1.5 shrink-0">
            <XCircle size={15} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 leading-tight">Cancelled Orders</p>
            <h3 className="text-lg font-bold text-slate-900 group-hover:text-[#ff5500] transition-colors mt-0.5 leading-none">
              {stats.cancelledOrders ?? 0}
            </h3>
          </div>
        </div>

        {/* Product Sold Out */}
        <div 
          onClick={() => onNavigate('products')}
          className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-sm transition-all duration-200 group cursor-pointer flex flex-col justify-between"
        >
          <div className="w-7 h-7 rounded-lg bg-pink-50 text-pink-500 flex items-center justify-center mb-1.5 shrink-0">
            <ShoppingBag size={15} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 leading-tight">Product Sold Out</p>
            <h3 className="text-lg font-bold text-slate-900 group-hover:text-[#ff5500] transition-colors mt-0.5 leading-none">
              {stats.productSoldOut ?? 0}
            </h3>
          </div>
        </div>

        {/* Product low on Stock */}
        <div 
          onClick={() => onNavigate('products')}
          className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-sm transition-all duration-200 group cursor-pointer flex flex-col justify-between"
        >
          <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center mb-1.5 shrink-0">
            <ShoppingBag size={15} />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 leading-tight">Product low on Stock</p>
            <h3 className="text-lg font-bold text-slate-900 group-hover:text-[#ff5500] transition-colors mt-0.5 leading-none">
              {stats.lowStockProducts ?? 0}
            </h3>
          </div>
        </div>
      </div>

      {/* Secondary Operations Grid (Compact) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <StatWidget 
          title="TOTAL SELLERS" 
          value={String(stats.totalSellers ?? 0)} 
          change={`${stats.pendingSellerApprovals ?? 0} pending`} 
          isPositive={stats.pendingSellerApprovals === 0} 
          isAlert={stats.pendingSellerApprovals > 0}
          icon={Store}
          onClick={() => onNavigate('sellers')}
        />
        <StatWidget 
          title="TOTAL CAPTAINS" 
          value={String(stats.totalCaptains ?? 0)} 
          change={`${stats.activeCaptains ?? 0} online`} 
          isPositive={true} 
          icon={Truck}
          onClick={() => onNavigate('captains')}
        />
        <StatWidget 
          title="TOTAL CUSTOMERS" 
          value={String(stats.totalUsers ?? 0)} 
          change="Registered" 
          isPositive={true} 
          icon={Users}
          onClick={() => onNavigate('users')}
        />
        <StatWidget 
          title="REVENUE TODAY" 
          value={`₹${Number(stats.revenueToday ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} 
          change="Live Sync" 
          isPositive={true} 
          icon={DollarSign}
          onClick={() => onNavigate('wallet')}
        />
      </div>

      {/* Charts Section */}
      <div className="w-full">
        {/* Revenue & Growth Chart */}
        <div className="w-full bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp size={16} className="text-[#ff5500]" />
                Weekly Revenue & Sales Trend
              </h3>
              <p className="text-[11px] text-slate-500">Live 7-day revenue aggregation across all orders</p>
            </div>
            <span className="text-[11px] font-medium bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 size={12} /> Live DB
            </span>
          </div>

          {/* Bar Chart */}
          <div className="h-48 flex items-end justify-between gap-4 pt-4 px-2 border-b border-slate-100">
            {revenueChartData.length > 0 ? (
              revenueChartData.map((item, idx) => {
                const itemRev = Number(item.revenue) || 0;
                const heightPercent = maxChartRevenue > 0 
                  ? Math.max(12, Math.round((itemRev / maxChartRevenue) * 85))
                  : 12;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 group relative h-full justify-end">
                    <span className="text-[11px] font-mono font-bold text-slate-700 mb-0.5">
                      {itemRev >= 1000 ? `₹${(itemRev / 1000).toFixed(1)}k` : `₹${itemRev}`}
                    </span>
                    <div 
                      className="w-full bg-[#ff5500] hover:bg-[#e04a00] rounded-t-lg transition-all duration-300 min-h-[14px] shadow-xs"
                      style={{ height: `${heightPercent}%` }}
                      title={`${item.date}: ₹${itemRev} (${item.orders || 0} orders)`}
                    />
                    <span className="text-xs font-semibold text-slate-600">{item.month}</span>
                  </div>
                );
              })
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                No revenue trend data recorded for the past 7 days.
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 mt-3 pt-1">
            <span className="flex items-center gap-2 font-medium">
              <span className="w-3 h-3 rounded-md bg-[#ff5500] inline-block" /> Gross Platform Sales (Last 7 Days)
            </span>
            <span className="font-mono text-slate-800 font-bold text-sm">
              Total Platform Volume: ₹{Number(stats.totalVolume ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>


      {/* New Orders & Top Sellers Tables (Styled according to Sathi Seller Theme) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* View New Orders */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            {/* Header Banner matching Sathi Seller Dark Teal Theme */}
            <div className="bg-[#002625] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                <ShoppingCart size={18} className="text-[#ff5500]" />
                View New Orders ({recentOrders.length})
              </h3>
              <span className="text-[10px] uppercase font-bold tracking-wider bg-white/10 text-white/90 px-2.5 py-1 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Live DB Feed
              </span>
            </div>

            <div className="p-5 space-y-4">
              {/* Show Entries Control */}
              <div className="flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <span>Show</span>
                  <select 
                    value={orderEntries} 
                    onChange={(e) => {
                      setOrderEntries(Number(e.target.value));
                      setOrderPage(1);
                    }}
                    className="border border-slate-200 rounded-lg px-2.5 py-1 bg-slate-50 text-xs font-semibold text-slate-800 outline-none focus:border-[#ff5500]"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                  </select>
                  <span>entries</span>
                </div>
                <button 
                  onClick={() => onNavigate('orders')}
                  className="text-xs text-[#ff5500] font-bold hover:underline bg-transparent border-none cursor-pointer flex items-center gap-1"
                >
                  View All Orders <ArrowUpRight size={12} />
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-3.5">ORDER ID</th>
                      <th className="py-3 px-3.5">CUSTOMER</th>
                      <th className="py-3 px-3.5">DATE</th>
                      <th className="py-3 px-3.5">STATUS</th>
                      <th className="py-3 px-3.5 text-right">AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {paginatedOrders.length > 0 ? (
                      paginatedOrders.map((ord) => {
                        const custName = ord.user?.name || ord.shippingAddress?.fullName || 'Customer';
                        const custPhone = ord.user?.phone || ord.shippingAddress?.phone || '';
                        const dateFormatted = ord.createdAt 
                          ? new Date(ord.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                          : 'Recent';
                        const grandTotalFormatted = `₹${Number(ord.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
                        const displayStatus = ord.orderStatus || 'Placed';

                        return (
                          <tr key={ord._id || ord.orderId} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3.5 font-mono font-bold text-[#ff5500]">
                              {ord.orderId || String(ord._id).slice(-8)}
                            </td>
                            <td className="py-3 px-3.5">
                              <div className="font-semibold text-slate-900">{custName}</div>
                              {custPhone && <div className="text-[10px] text-slate-400 font-mono">{custPhone}</div>}
                            </td>
                            <td className="py-3 px-3.5 text-slate-500 font-mono text-[11px]">{dateFormatted}</td>
                            <td className="py-3 px-3.5">
                              <StatusBadge status={displayStatus} />
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900">
                              {grandTotalFormatted}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                          No orders placed in database yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Footer Pagination Controls */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
            <span>
              Showing {recentOrders.length === 0 ? 0 : (orderPage - 1) * orderEntries + 1} to{' '}
              {Math.min(orderPage * orderEntries, recentOrders.length)} of {recentOrders.length} entries
            </span>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setOrderPage(p => Math.max(1, p - 1))}
                disabled={orderPage <= 1}
                className="px-3 py-1 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed bg-white"
              >
                &lt;
              </button>
              <button className="px-3 py-1 border border-[#ff5500] bg-[#ff5500] text-white rounded-lg font-bold shadow-xs">
                {orderPage}
              </button>
              <button 
                onClick={() => setOrderPage(p => Math.min(totalOrderPages, p + 1))}
                disabled={orderPage >= totalOrderPages}
                className="px-3 py-1 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed bg-white"
              >
                &gt;
              </button>
            </div>
          </div>
        </div>

        {/* View Top Seller */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            {/* Header Banner matching Sathi Seller Dark Teal Theme */}
            <div className="bg-[#002625] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                <Store size={18} className="text-[#ff5500]" />
                View Top Sellers ({topSellers.length})
              </h3>
              <span className="text-[10px] uppercase font-bold tracking-wider bg-white/10 text-white/90 px-2.5 py-1 rounded-full">
                Leaderboard
              </span>
            </div>

            <div className="p-5 space-y-4">
              {/* Show Entries Control */}
              <div className="flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <span>Show</span>
                  <select 
                    value={sellerEntries} 
                    onChange={(e) => {
                      setSellerEntries(Number(e.target.value));
                      setSellerPage(1);
                    }}
                    className="border border-slate-200 rounded-lg px-2.5 py-1 bg-slate-50 text-xs font-semibold text-slate-800 outline-none focus:border-[#ff5500]"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                  </select>
                  <span>entries</span>
                </div>
                <button 
                  onClick={() => onNavigate('sellers')}
                  className="text-xs text-[#ff5500] font-bold hover:underline bg-transparent border-none cursor-pointer flex items-center gap-1"
                >
                  Manage Sellers <ArrowUpRight size={12} />
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-3.5">SELLER ID</th>
                      <th className="py-3 px-3.5">SELLER / OWNER</th>
                      <th className="py-3 px-3.5">STORE NAME</th>
                      <th className="py-3 px-3.5 text-right">TOTAL EARNINGS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {paginatedSellers.length > 0 ? (
                      paginatedSellers.map((seller) => {
                        const sellerId = seller._id ? String(seller._id) : '—';
                        const ownerName = seller.ownerName || seller.businessName || 'Merchant';
                        const businessName = seller.businessName || 'Sathi Seller Store';
                        const earningsFormatted = `₹ ${Number(seller.totalEarnings || seller.walletBalance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

                        return (
                          <tr key={seller._id || seller.phone} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3.5 font-mono text-slate-500 truncate max-w-[120px]" title={sellerId}>
                              {sellerId.slice(-8)}
                            </td>
                            <td className="py-3 px-3.5">
                              <div className="font-semibold text-slate-900">{ownerName}</div>
                              {seller.phone && <div className="text-[10px] text-slate-400 font-mono">{seller.phone}</div>}
                            </td>
                            <td className="py-3 px-3.5 text-[#ff5500] font-medium">
                              {businessName}
                            </td>
                            <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900">
                              {earningsFormatted}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400 text-xs">
                          No sellers registered in database yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Footer Pagination Controls */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
            <span>
              Showing {topSellers.length === 0 ? 0 : (sellerPage - 1) * sellerEntries + 1} to{' '}
              {Math.min(sellerPage * sellerEntries, topSellers.length)} of {topSellers.length} entries
            </span>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => setSellerPage(p => Math.max(1, p - 1))}
                disabled={sellerPage <= 1}
                className="px-3 py-1 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed bg-white"
              >
                &lt;
              </button>
              <button className="px-3 py-1 border border-[#ff5500] bg-[#ff5500] text-white rounded-lg font-bold shadow-xs">
                {sellerPage}
              </button>
              <button 
                onClick={() => setSellerPage(p => Math.min(totalSellerPages, p + 1))}
                disabled={sellerPage >= totalSellerPages}
                className="px-3 py-1 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed bg-white"
              >
                &gt;
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

