import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, IndianRupee, ShoppingBag, 
  Package, Clock, CheckCircle2, AlertCircle, ArrowRight, Plus, Calendar, RefreshCw, Truck, XCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authService, orderService, productService } from '../../../services/authService';

const Dashboard = () => {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState('This Week');
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [productsCount, setProductsCount] = useState(0);
  const [seller, setSeller] = useState(() => {
    try {
      const cached = localStorage.getItem('sathiseller_seller_data');
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      return null;
    }
  });

  const fetchDashboardData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      // 1. Fetch Seller Profile
      const profRes = await authService.getSellerProfile().catch(() => null);
      if (profRes?.seller) {
        setSeller(profRes.seller);
      }

      // 2. Fetch Seller Order Notifications
      const notifRes = await orderService.getSellerNotifications().catch(() => null);
      if (notifRes && Array.isArray(notifRes.notifications)) {
        setNotifications(notifRes.notifications);
      }

      // 3. Fetch Seller Products Count
      const activeSeller = profRes?.seller || seller;
      const sellerId = activeSeller?._id || activeSeller?.id;
      const sName = activeSeller?.businessName || activeSeller?.ownerName;
      const prodParams = {};
      if (sellerId) prodParams.sellerId = sellerId;
      if (sName) prodParams.seller = sName;
      const prodRes = await productService.getProducts(prodParams).catch(() => null);
      let apiProds = prodRes?.products && Array.isArray(prodRes.products) ? prodRes.products : [];
      setProductsCount(apiProds.length);
    } catch (err) {
      console.error('Error loading dashboard dynamic data:', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Live auto-refresh polling every 20 seconds for real-time order updates
    const timer = setInterval(() => {
      fetchDashboardData(true);
    }, 20000);

    const handleStatusEvent = (e) => {
      if (e.detail?.isOnline !== undefined) {
        setSeller(prev => prev ? ({ ...prev, isOnline: e.detail.isOnline }) : prev);
      }
    };
    window.addEventListener('seller_status_changed', handleStatusEvent);

    return () => {
      clearInterval(timer);
      window.removeEventListener('seller_status_changed', handleStatusEvent);
    };
  }, []);

  const handleQuickGoOnline = async () => {
    try {
      const res = await authService.updateSellerOnlineStatus(true);
      if (res && res.success) {
        setSeller(prev => ({ ...prev, isOnline: true }));
      }
    } catch (err) {
      console.error('Failed to go online:', err);
    }
  };

  const sellerName = seller?.ownerName || seller?.businessName || seller?.name || 'Seller';
  const storeName = seller?.businessName ? seller.businessName : 'your store';

  // --- Dynamic Time Range Filter Function ---
  const filterByTimeRange = (items, range) => {
    const now = new Date();
    return items.filter(item => {
      if (!item.createdAt) return true;
      const itemDate = new Date(item.createdAt);
      if (isNaN(itemDate.getTime())) return true;

      if (range === 'Today') {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        return itemDate >= startOfToday;
      }
      if (range === 'This Week') {
        const dayOfWeek = now.getDay();
        const distanceToMonday = (dayOfWeek + 6) % 7;
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMonday, 0, 0, 0);
        return itemDate >= startOfWeek;
      }
      if (range === 'This Month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        return itemDate >= startOfMonth;
      }
      return true; // 'All Time'
    });
  };

  const activeNotifications = filterByTimeRange(notifications, timeRange);
  const validNotifications = activeNotifications.filter(n => n.status !== 'REJECTED' && n.status !== 'Rejected');
  
  const totalRevenue = validNotifications.reduce((sum, n) => sum + Number(n.totalAmount || 0), 0);
  const totalOrders = activeNotifications.length;
  const productsSold = validNotifications.reduce((sum, n) => {
    const itemQtySum = (n.items || []).reduce((iqSum, item) => iqSum + Number(item.quantity || 1), 0);
    return sum + itemQtySum;
  }, 0);

  const pendingDispatches = activeNotifications.filter(n => 
    n.status === 'NEW' || n.status === 'VIEWED' || n.status === 'ACCEPTED' || n.status === 'OUT_FOR_DELIVERY' || n.status === 'Out for Delivery'
  ).length;

  // --- Order Fulfillment Status Counts ---
  const pendingPackaging = activeNotifications.filter(n => n.status === 'NEW' || n.status === 'VIEWED').length;
  const acceptedOrders = activeNotifications.filter(n => n.status === 'ACCEPTED' || n.status === 'Accepted').length;
  const outForDelivery = activeNotifications.filter(n => n.status === 'OUT_FOR_DELIVERY' || n.status === 'Out for Delivery').length;
  const delivered = activeNotifications.filter(n => n.status === 'DELIVERED' || n.status === 'Delivered').length;
  const rejected = activeNotifications.filter(n => n.status === 'REJECTED' || n.status === 'Rejected').length;

  const totalFulfillmentCount = activeNotifications.length || 1;

  // --- Adaptive Dynamic Sales Analytics Chart Data ---
  let chartTitle = 'Weekly Revenue & Sales Trend';
  let chartSubtitle = 'Real gross sales revenue by day this week';
  let chartData = [];
  let peakLabel = 'Mon';
  let peakVal = 0;
  let avgSales = '0.00';

  if (timeRange === 'Today') {
    chartTitle = "Today's Hourly Revenue Trend";
    chartSubtitle = "Hourly sales revenue breakdown for today";
    const hours = ['6 AM', '9 AM', '12 PM', '3 PM', '6 PM', '9 PM', '12 AM'];
    const hourSlots = { '6 AM': 0, '9 AM': 0, '12 PM': 0, '3 PM': 0, '6 PM': 0, '9 PM': 0, '12 AM': 0 };

    validNotifications.forEach(n => {
      if (n.createdAt) {
        const d = new Date(n.createdAt);
        const h = d.getHours();
        let slot = '6 AM';
        if (h >= 21) slot = '12 AM';
        else if (h >= 18) slot = '9 PM';
        else if (h >= 15) slot = '6 PM';
        else if (h >= 12) slot = '3 PM';
        else if (h >= 9) slot = '12 PM';
        else if (h >= 6) slot = '9 AM';
        else slot = '6 AM';
        hourSlots[slot] += Number(n.totalAmount || 0);
      }
    });

    const maxSale = Math.max(...Object.values(hourSlots), 1);
    chartData = hours.map(hr => {
      const amt = hourSlots[hr] || 0;
      const valPercent = maxSale > 0 ? Math.max(Math.round((amt / maxSale) * 100), amt > 0 ? 15 : 5) : 5;
      return {
        label: hr,
        val: valPercent,
        amount: `₹${amt.toFixed(2)}`,
        rawAmt: amt
      };
    });
    avgSales = (totalRevenue / Math.max(hours.length, 1)).toFixed(2);
  } else if (timeRange === 'This Month') {
    chartTitle = 'Monthly Revenue & Sales Trend';
    chartSubtitle = 'Weekly sales breakdown for the current month';
    const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'];
    const weekSlots = { 'Week 1': 0, 'Week 2': 0, 'Week 3': 0, 'Week 4': 0, 'Week 5': 0 };

    validNotifications.forEach(n => {
      if (n.createdAt) {
        const d = new Date(n.createdAt);
        const dayOfMonth = d.getDate();
        let slot = 'Week 1';
        if (dayOfMonth > 28) slot = 'Week 5';
        else if (dayOfMonth > 21) slot = 'Week 4';
        else if (dayOfMonth > 14) slot = 'Week 3';
        else if (dayOfMonth > 7) slot = 'Week 2';
        weekSlots[slot] += Number(n.totalAmount || 0);
      }
    });

    const maxSale = Math.max(...Object.values(weekSlots), 1);
    chartData = weeks.map(wk => {
      const amt = weekSlots[wk] || 0;
      const valPercent = maxSale > 0 ? Math.max(Math.round((amt / maxSale) * 100), amt > 0 ? 15 : 5) : 5;
      return {
        label: wk,
        val: valPercent,
        amount: `₹${amt.toFixed(2)}`,
        rawAmt: amt
      };
    });
    avgSales = (totalRevenue / 4).toFixed(2);
  } else if (timeRange === 'All Time') {
    chartTitle = 'All-Time Revenue & Sales Trend';
    chartSubtitle = 'Monthly gross sales distribution';
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const last6Months = [];
    const monthSlots = {};
    for (let i = 5; i >= 0; i--) {
      const mDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mName = monthNames[mDate.getMonth()];
      last6Months.push(mName);
      monthSlots[mName] = 0;
    }

    validNotifications.forEach(n => {
      if (n.createdAt) {
        const d = new Date(n.createdAt);
        const mName = monthNames[d.getMonth()];
        if (monthSlots[mName] !== undefined) {
          monthSlots[mName] += Number(n.totalAmount || 0);
        }
      }
    });

    const maxSale = Math.max(...Object.values(monthSlots), 1);
    chartData = last6Months.map(mName => {
      const amt = monthSlots[mName] || 0;
      const valPercent = maxSale > 0 ? Math.max(Math.round((amt / maxSale) * 100), amt > 0 ? 15 : 5) : 5;
      return {
        label: mName,
        val: valPercent,
        amount: `₹${amt.toFixed(2)}`,
        rawAmt: amt
      };
    });
    avgSales = (totalRevenue / Math.max(last6Months.length, 1)).toFixed(2);
  } else {
    // Default 'This Week'
    chartTitle = 'Weekly Revenue & Sales Trend';
    chartSubtitle = 'Real gross sales revenue by day this week';
    const orderedDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const daySalesMap = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };

    validNotifications.forEach(n => {
      if (n.createdAt) {
        const d = new Date(n.createdAt);
        const dayName = dayNames[d.getDay()];
        if (dayName && daySalesMap[dayName] !== undefined) {
          daySalesMap[dayName] += Number(n.totalAmount || 0);
        }
      }
    });

    const maxDaySale = Math.max(...Object.values(daySalesMap), 1);
    chartData = orderedDays.map(day => {
      const amt = daySalesMap[day] || 0;
      const valPercent = maxDaySale > 0 ? Math.max(Math.round((amt / maxDaySale) * 100), amt > 0 ? 15 : 5) : 5;
      return {
        label: day,
        val: valPercent,
        amount: `₹${amt.toFixed(2)}`,
        rawAmt: amt
      };
    });
    avgSales = (totalRevenue / 7).toFixed(2);
  }

  // Calculate Peak Interval
  chartData.forEach(cd => {
    if (cd.rawAmt >= peakVal) {
      peakVal = cd.rawAmt;
      peakLabel = cd.label;
    }
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-sans pb-12">
      
      {/* Top Welcome Header Banner */}
      <div className="bg-gradient-to-r from-[#ff7526] via-[#ff6814] to-[#e65507] rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1.5 z-10">
          <div className="flex items-center gap-2">
            <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider backdrop-blur-xs">
              Seller Dashboard Overview
            </span>
            <button
              onClick={() => fetchDashboardData(false)}
              className="p-1.5 text-white/90 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition-all border-none cursor-pointer flex items-center justify-center"
              title="Refresh Real-time Data"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white pt-1">
            Welcome back, {sellerName}! 👋
          </h1>
          <p className="text-sm font-normal text-white/90 max-w-xl">
            Here is your live store performance, sales revenue analytics, and order dispatches for <strong className="font-semibold text-white">{storeName}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-3 z-10 shrink-0">
          <button 
            onClick={() => navigate('/seller/product/add')}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-[#ff7526] font-extrabold text-sm rounded-xl border-none cursor-pointer transition-all shadow-sm flex items-center gap-2 active:scale-95"
          >
            <Plus size={18} />
            Add New Product
          </button>
        </div>

        {/* Decorative background glow circle */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
      </div>

      {/* Offline Notice Banner */}
      {seller && seller.isOnline === false && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
              <AlertCircle size={22} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900 m-0">Your Store is Currently Offline</h4>
              <p className="text-xs text-amber-700 m-0 mt-0.5">
                Customers cannot view your store or buy your products while you are offline. Switch to Online when you are ready to accept orders.
              </p>
            </div>
          </div>
          <button
            onClick={handleQuickGoOnline}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs border-none cursor-pointer whitespace-nowrap transition-colors"
          >
            Switch to Online Now
          </button>
        </div>
      )}

      {/* Time Range Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 text-slate-700 text-sm font-normal">
          <Calendar size={18} className="text-[#ff7526]" />
          <span>Showing stats for:</span>
          <span className="font-extrabold text-slate-900">{timeRange}</span>
        </div>

        <div className="flex items-center gap-2">
          {['Today', 'This Week', 'This Month', 'All Time'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                timeRange === range
                  ? 'bg-[#ff7526] text-white shadow-2xs font-extrabold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Main Key Performance Indicator (KPI) Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* KPI 1: Revenue */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Revenue</span>
            <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200 text-[#ff7526] flex items-center justify-center shadow-2xs">
              <IndianRupee size={18} />
            </div>
          </div>
          <div>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900">₹{totalRevenue.toFixed(2)}</h3>
            <p className="text-xs font-semibold text-emerald-600 mt-1 flex items-center gap-1">
              <TrendingUp size={14} /> Live Real-time Earnings ({timeRange})
            </p>
          </div>
        </div>

        {/* KPI 2: Total Orders */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Orders</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shadow-2xs">
              <ShoppingBag size={18} />
            </div>
          </div>
          <div>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900">{totalOrders}</h3>
            <p className="text-xs font-semibold text-emerald-600 mt-1 flex items-center gap-1">
              <TrendingUp size={14} /> Customer Orders Received ({timeRange})
            </p>
          </div>
        </div>

        {/* KPI 3: Products Sold */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Products Sold</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shadow-2xs">
              <Package size={18} />
            </div>
          </div>
          <div>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900">{productsSold}</h3>
            <p className="text-xs font-semibold text-blue-600 mt-1 flex items-center gap-1">
              <Package size={14} /> Across {productsCount} Store Products
            </p>
          </div>
        </div>

        {/* KPI 4: Pending Dispatches */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Actions</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shadow-2xs">
              <Clock size={18} />
            </div>
          </div>
          <div>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900">{pendingDispatches}</h3>
            <p className="text-xs font-semibold text-amber-600 mt-1 flex items-center gap-1">
              <AlertCircle size={14} /> Active Orders Pending Action
            </p>
          </div>
        </div>

      </div>

      {/* Grid Section: Sales Analytics Chart & Order Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Sales Analytics Chart Card */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">{chartTitle}</h3>
              <p className="text-xs font-normal text-slate-400 mt-0.5">{chartSubtitle}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <span className="w-3 h-3 rounded-full bg-[#ff7526]"></span>
                Gross Sales (₹)
              </div>
            </div>
          </div>

          {/* Bar Chart Container */}
          <div className="h-64 flex items-end justify-between gap-3 pt-6 px-2">
            {chartData.map((item, i) => (
              <div key={i} className="w-full flex flex-col items-center group relative cursor-pointer">
                {/* Tooltip on Hover */}
                <div className="absolute -top-9 bg-slate-900 text-white text-xs font-bold py-1 px-2.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity shadow-md pointer-events-none z-10 whitespace-nowrap">
                  {item.amount}
                </div>

                {/* Bar */}
                <div className="w-full max-w-[42px] bg-slate-100 rounded-t-lg relative overflow-hidden h-[210px] flex items-end">
                  <div 
                    className="w-full bg-gradient-to-t from-[#ff7526] to-[#ff9e66] rounded-t-lg transition-all duration-500 group-hover:from-[#e65507] group-hover:to-[#ff7526]"
                    style={{ height: `${item.val}%` }}
                  ></div>
                </div>

                {/* Interval / Day Label */}
                <span className="mt-3 text-xs font-extrabold text-slate-600">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 font-normal gap-2">
            <span>Peak Sales Interval: <strong className="font-extrabold text-slate-900">{peakLabel} (₹{peakVal.toFixed(2)})</strong></span>
            <span>Avg. Sales: <strong className="font-extrabold text-slate-900">₹{avgSales}</strong></span>
          </div>
        </div>

        {/* Order Fulfillment Status Breakdown */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-extrabold text-slate-900">Order Fulfillment</h3>
            <p className="text-xs font-normal text-slate-400 mt-0.5">Live status breakdown of customer orders ({timeRange})</p>
          </div>

          <div className="space-y-4">
            <FulfillmentRow label="New / Pending" count={pendingPackaging} color="bg-amber-500" total={totalFulfillmentCount} />
            <FulfillmentRow label="Accepted Orders" count={acceptedOrders} color="bg-emerald-500" total={totalFulfillmentCount} />
            <FulfillmentRow label="Out for Delivery" count={outForDelivery} color="bg-blue-500" total={totalFulfillmentCount} />
            <FulfillmentRow label="Delivered Orders" count={delivered} color="bg-green-600" total={totalFulfillmentCount} />
            <FulfillmentRow label="Rejected Orders" count={rejected} color="bg-rose-500" total={totalFulfillmentCount} />
          </div>

          <div className="pt-2">
            <button 
              onClick={() => navigate('/seller/orders')}
              className="w-full py-2.5 bg-orange-50 hover:bg-orange-100/80 text-[#ff7526] font-extrabold text-xs rounded-xl cursor-pointer transition-colors border border-orange-200 flex items-center justify-center gap-1.5"
            >
              Manage All Orders
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

      </div>

      {/* Main Card Container: Recent Orders */}
      <div className="rounded-2xl overflow-hidden shadow-sm border border-slate-200 bg-white">
        
        {/* Title Banner */}
        <div className="bg-[#ff7526] px-5 py-3.5 flex justify-between items-center">
          <h2 className="text-white font-extrabold text-lg tracking-wide">Recent Customer Orders</h2>
          <button 
            onClick={() => navigate('/seller/orders')}
            className="text-white/90 hover:text-white text-xs font-bold bg-transparent border-none cursor-pointer flex items-center gap-1"
          >
            View All Orders ({notifications.length})
            <ArrowRight size={14} />
          </button>
        </div>

        {/* Recent Orders Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-100">
                <th className="px-6 py-4 font-bold">Order ID</th>
                <th className="px-6 py-4 font-bold">Customer Details</th>
                <th className="px-6 py-4 font-bold">Date & Time</th>
                <th className="px-6 py-4 font-bold">Amount</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-sm font-normal text-slate-700 divide-y divide-slate-100">
              {(activeNotifications.length > 0 ? activeNotifications : notifications).slice(0, 5).map((order) => (
                <tr key={order._id || order.orderId} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 font-extrabold text-[#ff7526] font-mono">{order.orderId}</td>
                  <td className="px-6 py-4 font-bold text-slate-900">
                    {order.customerDetails?.name || 'Customer'}
                    <span className="block text-xs font-normal text-slate-400 mt-0.5">
                      {order.items?.length || 0} Item{(order.items?.length || 0) > 1 ? 's' : ''}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-normal text-xs">
                    {new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-6 py-4 font-extrabold text-slate-900">₹{Number(order.totalAmount || 0).toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => navigate('/seller/orders')}
                      className="px-3.5 py-1.5 bg-slate-100 hover:bg-orange-50 hover:text-[#ff7526] border border-slate-200 rounded-xl font-bold text-xs cursor-pointer transition-colors"
                    >
                      View Order
                    </button>
                  </td>
                </tr>
              ))}

              {!loading && notifications.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 text-sm font-normal">
                    No customer orders received yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
};

const FulfillmentRow = ({ label, count, color, total }) => {
  const percentage = Math.round((Number(count) / total) * 100);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-normal">
        <span className="text-slate-700 font-medium">{label}</span>
        <span className="text-slate-900 font-extrabold">{count}</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
};

const OrderStatusBadge = ({ status }) => {
  if (status === 'DELIVERED' || status === 'Delivered') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-green-100 text-green-800 border border-green-300 uppercase">
        <CheckCircle2 size={13} />
        Delivered
      </span>
    );
  }
  if (status === 'OUT_FOR_DELIVERY' || status === 'Out for Delivery') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase">
        <Truck size={13} />
        Out for Delivery
      </span>
    );
  }
  if (status === 'ACCEPTED' || status === 'Accepted') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
        <CheckCircle2 size={13} />
        Accepted
      </span>
    );
  }
  if (status === 'REJECTED' || status === 'Rejected') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-red-50 text-red-700 border border-red-200 uppercase">
        <XCircle size={13} />
        Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase">
      <AlertCircle size={13} />
      New Order
    </span>
  );
};

export default Dashboard;
