import React, { useState, useEffect } from 'react';
import { 
  Search, Download, ChevronDown, Eye, CheckCircle2, XCircle, AlertCircle, 
  RefreshCw, FileText, FileSpreadsheet, User, Phone, MapPin, CreditCard, Calendar, Box, Package, ArrowRight, Volume2, Truck
} from 'lucide-react';
import { orderService } from '../../../services/authService';
import { getImageUrl, handleImageError } from '../../../utils/imageUtils';
import { selectedVariantRows, variantSummary } from '../../../utils/variantLabel';

const formatSellerPaymentLabel = (n) => {
  const method = String(n?.paymentMethod || '').toUpperCase();
  const status = String(n?.paymentStatus || '').trim();
  const delivered = String(n?.status || '').toUpperCase() === 'DELIVERED';
  const isCod = method === 'COD' || method.includes('CASH');
  if (isCod) {
    if (delivered || status === 'Paid') return { method: n.paymentMethod || 'COD', status: 'Completed' };
    return { method: n.paymentMethod || 'COD', status: 'Collect on delivery' };
  }
  if (status === 'Paid' || status === 'Completed') return { method: n.paymentMethod || 'Online', status: 'Completed' };
  if (status === 'Pending' || !status) return { method: n.paymentMethod || 'Online', status: 'Pending' };
  return { method: n.paymentMethod || 'Online', status };
};

const OrderLine = ({ item, compact = false }) => {
  const rows = selectedVariantRows(item);
  const sku = String(item.variantSku || item.sku || '').trim();
  return (
    <div className="space-y-0.5 min-w-0">
      <h4 className={`${compact ? 'text-xs leading-tight' : 'text-sm leading-snug'} font-bold text-slate-900 m-0`}>{item.name}</h4>
      {sku ? (
        <p className={`${compact ? 'text-[10px]' : 'text-[11px]'} text-slate-500 m-0`}>
          SKU: <span className="font-semibold text-slate-700">{sku}</span>
        </p>
      ) : null}
      {rows.length > 0 && (
        <div className="pt-0.5">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 m-0">Selected Options</p>
          {rows.map((row) => (
            <p key={`${row.name}:${row.value}`} className={`${compact ? 'text-[11px]' : 'text-xs'} text-slate-800 m-0`}>
              <span className="text-slate-500">{row.name}</span>
              <span className="text-slate-300"> : </span>
              <span className="font-semibold">{row.value}</span>
            </p>
          ))}
        </div>
      )}
      <p className={`${compact ? 'text-[11px]' : 'text-xs'} text-slate-500 m-0`}>
        Unit Price: <span className="font-semibold text-slate-700">₹{item.price}</span> &times; <span className="font-extrabold text-slate-900">{item.quantity} Qty</span>
      </p>
    </div>
  );
};

const Orders = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // Active Order Modal State
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [modalMode, setModalMode] = useState('BIG'); // 'SMALL' for auto new order popup, 'BIG' for view details
  const [viewingProofUrl, setViewingProofUrl] = useState(null);

  // Rejection Modal State
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState('Product unavailable');
  const [customReasonText, setCustomReasonText] = useState('');

  const playOrderRingtone = () => {
    try {
      const audio = new Audio('/SellerOrder.mpeg');
      audio.type = 'audio/mpeg';
      audio.play().catch((e) => {
        console.log('Audio file playback info:', e.message);
        // Fallback Web Audio API chime tone
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, ctx.currentTime);
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.5);
        } catch (err) {}
      });
    } catch (err) {
      console.warn('Audio ringtone error:', err);
    }
  };

  const fetchSellerOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await orderService.getSellerNotifications();
      if (res && res.notifications && Array.isArray(res.notifications)) {
        setNotifications(res.notifications);
        
        // Refresh an already-open details modal. Never treat a refreshed row as a new order.
        setSelectedNotification(prev => {
          if (!prev) return null;
          const fresh = res.notifications.find(n => n._id === prev._id);
          return fresh || prev;
        });
      }
    } catch (err) {
      console.warn('Error fetching seller notifications:', err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchSellerOrders();

    const handleOrderUpdate = (e) => {
      if (e.detail && Array.isArray(e.detail)) {
        setNotifications(e.detail);
      }
    };

    window.addEventListener('seller-order-update', handleOrderUpdate);

    // Poll every 5 seconds for real-time incoming order notifications
    const interval = setInterval(() => {
      fetchSellerOrders(true);
    }, 5000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('seller-order-update', handleOrderUpdate);
    };
  }, []);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const handleOpenOrderModal = async (notification, mode = 'BIG') => {
    setSelectedNotification(notification);
    setModalMode(mode);
    if (notification.status === 'NEW') {
      try {
        await orderService.markNotificationViewed(notification._id);
        setNotifications(prev => prev.map(n => n._id === notification._id ? { ...n, status: 'VIEWED' } : n));
      } catch (e) {}
    }
  };

  const handleAcceptOrder = async (notification) => {
    if (!notification) return;
    setActionLoading(true);
    try {
      const res = await orderService.acceptSellerOrder(notification._id);
      window.dispatchEvent(new CustomEvent('seller-order-handled', { detail: { id: notification._id } }));
      showToast(`Order #${notification.orderId} Accepted Successfully! 🎉`);
      
      const updatedObj = res.notification || { ...notification, status: 'ACCEPTED', acceptedAt: new Date() };
      setNotifications(prev => prev.map(n => n._id === notification._id ? updatedObj : n));

      if (modalMode === 'SMALL') {
        setSelectedNotification(null); // Close compact popup modal upon acceptance!
      } else {
        setSelectedNotification(updatedObj); // Update full details modal state
      }
    } catch (err) {
      showToast(`Error accepting order: ${err.response?.data?.message || err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateStatus = async (notification, newStatus) => {
    if (!notification) return;
    if (newStatus === 'REJECTED' || newStatus === 'Rejected') {
      setRejectionModalOpen(true);
      return;
    }

    setActionLoading(true);
    try {
      const res = await orderService.updateSellerOrderStatus(notification._id, newStatus);
      window.dispatchEvent(new CustomEvent('seller-order-handled', { detail: { id: notification._id } }));
      showToast(`Order #${notification.orderId} status changed to "${newStatus}"! 🎉`);
      
      const targetStatus = (res.notification && res.notification.status)
        ? res.notification.status
        : (newStatus === 'Out for Delivery' ? 'OUT_FOR_DELIVERY' : (newStatus === 'Delivered' ? 'DELIVERED' : (newStatus === 'Accepted' ? 'ACCEPTED' : newStatus)));

      const updatedObj = { ...(res.notification || notification), status: targetStatus };
      setSelectedNotification(updatedObj);
      setNotifications(prev => prev.map(n => n._id === notification._id ? updatedObj : n));
    } catch (err) {
      showToast(`Error updating order status: ${err.response?.data?.message || err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectOrderSubmit = async (e) => {
    e.preventDefault();
    if (!selectedNotification) return;

    const finalReason = selectedReason === 'Other' ? customReasonText.trim() : selectedReason;
    if (!finalReason) {
      alert('Please select or specify a reason for order rejection.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await orderService.rejectSellerOrder(selectedNotification._id, {
        rejectionReason: selectedReason,
        customReason: customReasonText
      });
      window.dispatchEvent(new CustomEvent('seller-order-handled', { detail: { id: selectedNotification._id } }));

      showToast(`Order #${selectedNotification.orderId} Rejected`);
      
      const updatedObj = res.notification || { 
        ...selectedNotification, 
        status: 'REJECTED', 
        rejectionReason: finalReason, 
        rejectedAt: new Date() 
      };
      
      setSelectedNotification(updatedObj);
      setNotifications(prev => prev.map(n => n._id === selectedNotification._id ? updatedObj : n));
      setRejectionModalOpen(false);
      setCustomReasonText('');
    } catch (err) {
      showToast(`Error rejecting order: ${err.response?.data?.message || err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered Notifications List
  const filteredNotifications = notifications.filter(n => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = (n.orderId || '').toLowerCase().includes(search) ||
                          (n.customerDetails?.name || '').toLowerCase().includes(search) ||
                          (n.customerDetails?.phone || '').toLowerCase().includes(search) ||
                          (n.deliveryAddress?.city || '').toLowerCase().includes(search);

    let matchesStatus = true;
    if (statusFilter !== 'All') {
      if (statusFilter === 'Pending') matchesStatus = n.status === 'NEW' || n.status === 'VIEWED';
      else if (statusFilter === 'Accepted') matchesStatus = n.status === 'ACCEPTED' || n.status === 'Accepted';
      else if (statusFilter === 'Out for Delivery') matchesStatus = n.status === 'OUT_FOR_DELIVERY' || n.status === 'Out for Delivery';
      else if (statusFilter === 'Delivered') matchesStatus = n.status === 'DELIVERED' || n.status === 'Delivered';
      else if (statusFilter === 'Rejected') matchesStatus = n.status === 'REJECTED' || n.status === 'Rejected';
    }

    const nDate = new Date(n.createdAt).toISOString().slice(0, 10);
    const matchesFrom = !fromDate || nDate >= fromDate;
    const matchesTo = !toDate || nDate <= toDate;

    return matchesSearch && matchesStatus && matchesFrom && matchesTo;
  });

  const newOrdersCount = notifications.filter(n => n.status === 'NEW').length;

  const exportOrders = (format = 'csv') => {
    if (filteredNotifications.length === 0) {
      alert('No orders available to export for current filter criteria.');
      return;
    }

    const headers = ['Order ID', 'Customer Name', 'Phone', 'Address', 'Order Date', 'Items Total', 'Total Amount', 'Payment', 'Status'];
    const rows = filteredNotifications.map(n => [
      `"${n.orderId}"`,
      `"${n.customerDetails?.name || 'Customer'}"`,
      `"${n.customerDetails?.phone || ''}"`,
      `"${n.deliveryAddress?.addressLine1 || ''}, ${n.deliveryAddress?.city || ''}"`,
      `"${new Date(n.createdAt).toLocaleString()}"`,
      `"${n.items?.length || 0} Products"`,
      `"₹${n.totalAmount}"`,
      `"${n.paymentMethod} (${n.paymentStatus})"`,
      `"${n.status}"`
    ]);

    const csvString = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Seller_Orders_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 font-sans relative">
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-slate-700 animate-bounce">
          <CheckCircle2 size={18} className="text-emerald-400" />
          <span className="text-sm font-medium">{toastMsg}</span>
        </div>
      )}

      {/* Prominent New Order Incoming Alert Bar */}
      {newOrdersCount > 0 && (
        <div className="bg-gradient-to-r from-orange-500 to-[#ff7526] text-white rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-bold text-white shrink-0 shadow-inner">
              <Package size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-white text-[#ff7526] text-[11px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  New Order Alert
                </span>
                <span className="text-xs text-white/90 font-mono">
                  {newOrdersCount} Pending Action
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-white m-0 mt-0.5">
                You have {newOrdersCount} new customer order{newOrdersCount > 1 ? 's' : ''} waiting for acceptance!
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={playOrderRingtone}
              className="p-2.5 bg-white/20 hover:bg-white/30 text-white rounded-xl border-none cursor-pointer shadow-xs transition-all active:scale-95 flex items-center justify-center"
              title="Play Order Ringtone Alert"
            >
              <Volume2 size={18} />
            </button>
            <button
              onClick={() => {
                const newest = notifications.find(n => n.status === 'NEW');
                if (newest) handleOpenOrderModal(newest, 'SMALL');
                playOrderRingtone();
              }}
              className="px-5 py-2.5 bg-white text-[#ff7526] hover:bg-orange-50 font-extrabold text-xs rounded-xl border-none cursor-pointer shadow-md transition-all active:scale-95 flex items-center gap-1.5"
            >
              Review New Order <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Main Unified Single Card Container */}
      <div className="rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-white">
        
        {/* Light Orange Header Title Banner */}
        <div className="bg-[#ff7526] px-5 py-3.5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h2 className="text-white font-semibold text-lg tracking-wide">Seller Incoming Orders & History</h2>
            <button
              onClick={() => fetchSellerOrders()}
              className="p-1 text-white/80 hover:text-white rounded-md bg-white/10 hover:bg-white/20 transition-all border-none cursor-pointer flex items-center gap-1 text-xs"
              title="Refresh Orders"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
          <span className="text-white/90 text-xs font-medium">Total Orders: {filteredNotifications.length}</span>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 text-sm font-normal text-slate-700">
          
          {/* From - To Date Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-600 font-normal">Order Date Range</span>
            <div className="flex items-center gap-1 bg-slate-50 p-1 border border-slate-200 rounded-lg">
              <input 
                type="date" 
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-transparent border-none outline-none text-slate-700 text-sm font-normal cursor-pointer"
              />
              <span className="text-slate-400 font-normal">-</span>
              <input 
                type="date" 
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-transparent border-none outline-none text-slate-700 text-sm font-normal cursor-pointer"
              />
            </div>
          </div>

          {/* Status Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-normal">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white outline-none focus:border-[#ff7526] cursor-pointer text-sm font-normal transition-all"
            >
              <option value="All">All Status</option>
              <option value="Pending">Pending Action (New / Viewed)</option>
              <option value="Accepted">Accepted Orders</option>
              <option value="Rejected">Rejected Orders</option>
            </select>
          </div>

          {/* Page Size Dropdown */}
          <div>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white outline-none focus:border-[#ff7526] cursor-pointer text-sm font-normal"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          {/* Search Field */}
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-normal">Search:</span>
            <input
              type="text"
              placeholder="Search Order ID, Customer, City..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 outline-none focus:border-[#ff7526] text-sm font-normal w-48 sm:w-64 transition-all"
            />
          </div>

          {/* Export Button & Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="bg-[#ff7526] hover:bg-[#e65507] text-white font-medium py-1.5 px-4 rounded-lg shadow-sm transition-colors cursor-pointer border-none flex items-center gap-1.5 text-sm"
            >
              <Download size={15} />
              Export
              <ChevronDown size={15} />
            </button>

            {/* Export Dropdown Menu */}
            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-20 animate-in fade-in zoom-in-95 duration-150">
                <button
                  onClick={() => exportOrders('csv')}
                  className="w-full px-4 py-2.5 text-left text-sm font-normal text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer bg-transparent border-none"
                >
                  <FileText size={16} className="text-[#ff7526]" />
                  Export as CSV
                </button>
                <button
                  onClick={() => exportOrders('excel')}
                  className="w-full px-4 py-2.5 text-left text-sm font-normal text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer bg-transparent border-none"
                >
                  <FileSpreadsheet size={16} className="text-emerald-600" />
                  Export as Excel (.csv)
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Orders Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[13px] uppercase tracking-wider border-b border-slate-100">
                <th className="px-5 py-4 font-semibold">Order ID</th>
                <th className="px-5 py-4 font-semibold">Customer Details</th>
                <th className="px-5 py-4 font-semibold">City / Location</th>
                <th className="px-5 py-4 font-semibold">Order Date & Time</th>
                <th className="px-5 py-4 font-semibold">Items</th>
                <th className="px-5 py-4 font-semibold">Total Amount</th>
                <th className="px-5 py-4 font-semibold">Payment</th>
                <th className="px-5 py-4 font-semibold">Status</th>
                <th className="px-5 py-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="text-[15px] font-normal text-slate-700 divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-500 text-sm font-medium">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw size={16} className="animate-spin text-[#ff7526]" />
                      Loading incoming order notifications...
                    </div>
                  </td>
                </tr>
              ) : filteredNotifications.slice(0, pageSize).map((n) => (
                <tr key={n._id} className={`hover:bg-slate-50/80 transition-colors ${n.status === 'NEW' ? 'bg-orange-50/40 font-medium' : ''}`}>
                  <td className="px-5 py-4 font-bold text-slate-900 font-mono flex items-center gap-1.5">
                    {n.status === 'NEW' && <span className="w-2 h-2 rounded-full bg-[#ff7526] animate-ping shrink-0" title="New incoming order" />}
                    {n.orderId}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900">{n.customerDetails?.name || 'Customer'}</span>
                      <span className="text-[12px] text-slate-400 font-normal">{n.customerDetails?.phone || '-'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm font-normal text-slate-600">
                    {n.deliveryAddress?.city || 'City'}, {n.deliveryAddress?.state || ''}
                  </td>
                  <td className="px-5 py-4 text-xs font-normal text-slate-600">
                    {new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-5 py-4 font-normal text-sm">
                    <div className="flex flex-col gap-0.5 max-w-[220px]">
                      <span>{n.items?.length || 0} Products</span>
                      {(Array.isArray(n.items) ? n.items : []).map((item, idx) => {
                        const summary = variantSummary(item);
                        if (!summary) return null;
                        return (
                          <span key={`${n._id}-var-${idx}`} className="text-[11px] font-semibold text-[#ff7526] leading-snug">
                            {item?.name ? `${item.name}: ` : ''}{summary}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-5 py-4 font-extrabold text-[#ff7526]">
                    ₹{Number(n.totalAmount || 0).toFixed(2)}
                  </td>
                  <td className="px-5 py-4 text-xs font-normal text-slate-600">
                    {(() => {
                      const pay = formatSellerPaymentLabel(n);
                      return (
                        <>
                          <span className="font-semibold">{pay.method}</span>{' '}
                          <span className={pay.status === 'Completed' ? 'text-emerald-600 font-semibold' : 'text-amber-600'}>({pay.status})</span>
                        </>
                      );
                    })()}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1 items-start">
                      <NotificationStatusBadge status={n.status} />
                      {n.pickupOtp && (
                        <div className="flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-300 px-1.5 py-0.5 rounded-md shadow-2xs">
                          <span>🔑 Pickup OTP:</span>
                          <span className="font-mono font-black text-[#ff7526]">{n.pickupOtp}</span>
                          {n.pickupOtpVerified && <span className="text-emerald-700">✓</span>}
                        </div>
                      )}
                      {n.proofOfDeliveryUrl && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingProofUrl(n.proofOfDeliveryUrl);
                          }}
                          className="text-[10.5px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 cursor-pointer flex items-center gap-1 transition-all"
                        >
                          📸 View Proof
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button 
                      onClick={() => handleOpenOrderModal(n, 'BIG')}
                      className={`px-3.5 py-1.5 rounded-xl font-bold text-xs cursor-pointer transition-all border shadow-2xs ${
                        n.status === 'NEW'
                          ? 'bg-[#ff7526] text-white border-[#ff7526] hover:bg-[#e65507]'
                          : 'bg-slate-100 hover:bg-orange-50 hover:text-[#ff7526] text-slate-700 border-slate-200'
                      }`}
                    >
                      View Order Details
                    </button>
                  </td>
                </tr>
              ))}

              {!loading && filteredNotifications.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400 text-sm font-normal">
                    No orders found matching your filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3A. SMALL MODAL - COMPACT POPUP FOR INCOMING NEW ORDERS */}
      {/* ------------------------------------------------------------- */}
      {selectedNotification && modalMode === 'SMALL' && (
        <div 
          onClick={() => setSelectedNotification(null)}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden my-4 animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header Banner - Vibrant Orange */}
            <div className="bg-[#ff7526] text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase bg-white text-[#ff7526] px-2 py-0.5 rounded-full tracking-wider shadow-2xs">
                    NEW ORDER ALERT
                  </span>
                  <span className="text-xs text-white/90 font-mono font-medium">
                    ID: {selectedNotification.orderId}
                  </span>
                </div>
                <h2 className="text-lg font-extrabold text-white m-0 leading-tight">Incoming Customer Order</h2>
                <p className="text-[11px] text-white/80 m-0">
                  Received on {new Date(selectedNotification.createdAt).toLocaleDateString()} at {new Date(selectedNotification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              <button 
                type="button"
                onClick={() => setSelectedNotification(null)} 
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center border-none cursor-pointer text-base font-bold transition-all shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Modal Body Content (Compact) */}
            <div className="p-4 space-y-3.5 max-h-[70vh] overflow-y-auto text-slate-800">
              
              {/* Customer Details Card */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1">
                <div className="flex items-center gap-1.5 border-b border-slate-200/60 pb-1">
                  <User size={14} className="text-[#ff7526]" />
                  <span className="text-[11px] font-extrabold uppercase text-slate-700 tracking-wider">Customer Details</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <p className="font-bold text-slate-900 text-sm m-0">{selectedNotification.customerDetails?.name || 'Customer'}</p>
                    {selectedNotification.customerDetails?.email && (
                      <p className="text-slate-500 m-0 text-[11px] font-normal">{selectedNotification.customerDetails.email}</p>
                    )}
                  </div>
                  <a 
                    href={`tel:${selectedNotification.customerDetails?.phone}`} 
                    className="text-blue-600 font-semibold underline flex items-center gap-1 text-xs bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100"
                  >
                    <Phone size={12} className="text-blue-500" />
                    {selectedNotification.customerDetails?.phone || 'No phone'}
                  </a>
                </div>
              </div>

              {/* Ordered Items List */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                  <div className="flex items-center gap-1.5">
                    <Box size={15} className="text-[#ff7526]" />
                    <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider m-0">Ordered Items ({selectedNotification.items?.length || 0})</h3>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                  {selectedNotification.items && selectedNotification.items.map((item, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <img 
                          src={getImageUrl(item.image, item.name)} 
                          alt={item.name} 
                          className="w-11 h-11 rounded-lg object-cover border border-slate-200 bg-slate-100 shrink-0"
                          onError={(e) => handleImageError(e, item.name)}
                        />
                        <OrderLine item={item} compact />
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-extrabold text-slate-900">₹{Number(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Store Pickup OTP Badge for Handover */}
              {selectedNotification.pickupOtp && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-3 rounded-xl border border-amber-300 flex items-center justify-between gap-2 shadow-2xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 block flex items-center gap-1">
                      🔐 STORE PICKUP OTP (FOR DELIVERY BOY)
                    </span>
                    <p className="text-[11px] text-slate-600 m-0">
                      Share this 4-digit code when delivery captain arrives at your store
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-xl font-black tracking-wider text-[#ff7526] bg-white px-2.5 py-1 rounded-lg border border-amber-300 shadow-inner">
                      {selectedNotification.pickupOtp}
                    </span>
                  </div>
                </div>
              )}

              {/* Proof of Delivery Photo (Uploaded by Captain) */}
              {selectedNotification.proofOfDeliveryUrl && (
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-300 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      onClick={() => setViewingProofUrl(selectedNotification.proofOfDeliveryUrl)}
                      className="w-12 h-12 rounded-lg overflow-hidden border border-emerald-400 cursor-pointer shrink-0 bg-white shadow-2xs hover:opacity-90"
                    >
                      <img
                        src={selectedNotification.proofOfDeliveryUrl}
                        alt="Proof"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-900 block flex items-center gap-1">
                        📸 DELIVERY PHOTO PROOF
                      </span>
                      <p className="text-[11px] text-emerald-800 m-0 truncate">
                        Captured at customer doorstep
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewingProofUrl(selectedNotification.proofOfDeliveryUrl)}
                    className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] rounded-lg border-none cursor-pointer shrink-0 shadow-2xs"
                  >
                    View Photo
                  </button>
                </div>
              )}

              {/* Payment Details & Total Seller Amount */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[#ff7526] shrink-0 shadow-2xs">
                    <CreditCard size={16} />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Payment Method</span>
                    <p className="text-xs font-bold text-slate-800 m-0">
                      {(() => {
                        const pay = formatSellerPaymentLabel(selectedNotification);
                        return <>{pay.method} (<span className={pay.status === 'Completed' ? 'text-emerald-600' : 'text-amber-600'}>{pay.status}</span>)</>;
                      })()}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Amount</span>
                  <span className="text-lg font-black text-[#ff7526]">₹{Number(selectedNotification.totalAmount || 0).toFixed(2)}</span>
                </div>
              </div>

            </div>

            {/* Modal Bottom Action Buttons */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setRejectionModalOpen(true)}
                className="px-4 py-2 bg-white hover:bg-red-50 text-red-600 hover:text-red-700 font-bold text-xs rounded-xl border border-red-200 cursor-pointer shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <XCircle size={15} /> Reject Order
              </button>

              <button
                type="button"
                disabled={actionLoading}
                onClick={() => handleAcceptOrder(selectedNotification)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl border-none cursor-pointer shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 size={15} /> {actionLoading ? 'Accepting...' : 'Accept Order'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3B. BIG MODAL - FULL DETAILS & ORDER MANAGEMENT MODAL */}
      {/* ------------------------------------------------------------- */}
      {selectedNotification && modalMode === 'BIG' && (
        <div 
          onClick={() => setSelectedNotification(null)}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden my-4 animate-in zoom-in-95 duration-150"
          >
            {/* Modal Top Header Banner - Vibrant Orange Header */}
            <div className="bg-[#ff7526] text-white p-5 sm:p-6 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase bg-white text-[#ff7526] px-2.5 py-0.5 rounded-full tracking-wider shadow-2xs">
                    ORDER DETAILS
                  </span>
                  <span className="text-xs text-white/90 font-mono font-medium">
                    ID: {selectedNotification.orderId}
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-white m-0 leading-tight">Order Details & Management</h2>
                <p className="text-xs text-white/80 m-0">
                  Received on {new Date(selectedNotification.createdAt).toLocaleDateString()} at {new Date(selectedNotification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              <button 
                type="button"
                onClick={() => setSelectedNotification(null)} 
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center border-none cursor-pointer text-lg font-bold transition-all shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Modal Body Content (Full Layout) */}
            <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto text-slate-800">
              
              {/* Dynamic Status Alert Banner */}
              {(selectedNotification.status === 'REJECTED' || selectedNotification.status === 'Rejected') && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3 text-red-700 text-xs">
                  <XCircle size={22} className="shrink-0 mt-0.5 text-red-600" />
                  <div>
                    <h4 className="text-xs font-extrabold m-0 uppercase tracking-wider">Order Status: REJECTED</h4>
                    <p className="text-[11px] m-0 mt-0.5 text-red-600 font-medium">
                      Reason: <span className="font-bold text-slate-800">"{selectedNotification.rejectionReason || 'Unable to fulfill order'}"</span>
                    </p>
                  </div>
                </div>
              )}

              {(selectedNotification.status === 'ACCEPTED' || selectedNotification.status === 'Accepted') && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3 text-emerald-800 text-xs">
                  <CheckCircle2 size={22} className="shrink-0 mt-0.5 text-emerald-600" />
                  <div>
                    <h4 className="text-xs font-extrabold m-0 uppercase tracking-wider">Order Status: ACCEPTED</h4>
                    <p className="text-[11px] m-0 mt-0.5 text-emerald-700 font-medium">
                      Order accepted and ready for dispatch.
                    </p>
                  </div>
                </div>
              )}

              {(selectedNotification.status === 'OUT_FOR_DELIVERY' || selectedNotification.status === 'Out for Delivery') && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3 text-blue-800 text-xs">
                  <Truck size={22} className="shrink-0 mt-0.5 text-blue-600" />
                  <div>
                    <h4 className="text-xs font-extrabold m-0 uppercase tracking-wider">Order Status: OUT FOR DELIVERY</h4>
                    <p className="text-[11px] m-0 mt-0.5 text-blue-700 font-medium">
                      Package is currently out for delivery to the customer's address.
                    </p>
                  </div>
                </div>
              )}

              {(selectedNotification.status === 'DELIVERED' || selectedNotification.status === 'Delivered') && (
                <div className="bg-green-100 border border-green-300 rounded-2xl p-4 flex items-start gap-3 text-green-900 text-xs">
                  <CheckCircle2 size={22} className="shrink-0 mt-0.5 text-green-700" />
                  <div>
                    <h4 className="text-xs font-extrabold m-0 uppercase tracking-wider">Order Status: DELIVERED</h4>
                    <p className="text-[11px] m-0 mt-0.5 text-green-800 font-medium">
                      Order has been successfully delivered to the customer.
                    </p>
                  </div>
                </div>
              )}

              {/* Store Pickup OTP Handover Card */}
              {selectedNotification.pickupOtp && (
                <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 p-4 rounded-2xl border-2 border-amber-300 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-[#ff7526] text-white flex items-center justify-center font-black text-xl shadow-xs shrink-0">
                      🔑
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase text-amber-950 tracking-wider">
                          STORE PICKUP OTP
                        </span>
                        {selectedNotification.pickupOtpVerified ? (
                          <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            ✓ Verified & Picked Up by Captain
                          </span>
                        ) : (
                          <span className="text-[10px] font-extrabold bg-amber-200/90 text-amber-950 border border-amber-400 px-2.5 py-0.5 rounded-full animate-pulse">
                            Share with Delivery Boy
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-amber-900/80 m-0 mt-0.5 font-medium">
                        Delivery captain must ask and verify this 4-digit OTP when picking up package from your store.
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 w-full sm:w-auto flex sm:flex-col justify-between sm:justify-end items-center sm:items-end">
                    <span className="text-[10px] text-amber-800 font-bold uppercase block">OTP CODE</span>
                    <span className="font-mono text-2xl font-black tracking-widest text-[#ff7526] bg-white px-3.5 py-1 rounded-xl border border-amber-300 shadow-inner inline-block sm:mt-0.5">
                      {selectedNotification.pickupOtp}
                    </span>
                  </div>
                </div>
              )}

              {/* Order Status Change Access Controls */}
              <div className="bg-orange-50/60 p-4 rounded-2xl border border-orange-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase text-slate-800 tracking-wider">Change Order Status</span>
                  <NotificationStatusBadge status={selectedNotification.status} />
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={actionLoading || ['ACCEPTED', 'Accepted', 'PACKED', 'Packed', 'PROCESSING', 'Processing', 'OUT_FOR_DELIVERY', 'Out for Delivery', 'DELIVERED', 'Delivered'].includes(selectedNotification.status)}
                    onClick={() => handleUpdateStatus(selectedNotification, 'ACCEPTED')}
                    className={`px-3.5 py-1.5 rounded-xl font-bold text-xs cursor-pointer border transition-all ${
                      ['ACCEPTED', 'Accepted', 'PACKED', 'Packed', 'OUT_FOR_DELIVERY', 'Out for Delivery', 'DELIVERED', 'Delivered'].includes(selectedNotification.status)
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-300'
                    }`}
                  >
                    ✓ Accept Order
                  </button>

                  <button
                    type="button"
                    disabled={actionLoading || !['ACCEPTED', 'Accepted'].includes(selectedNotification.status)}
                    onClick={() => handleUpdateStatus(selectedNotification, 'PACKED')}
                    className={`px-3.5 py-1.5 rounded-xl font-bold text-xs cursor-pointer border transition-all ${
                      ['PACKED', 'Packed', 'OUT_FOR_DELIVERY', 'Out for Delivery', 'DELIVERED', 'Delivered'].includes(selectedNotification.status)
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-white hover:bg-violet-50 text-violet-700 border-violet-300'
                    }`}
                  >
                    Packed
                  </button>

                  <button
                    type="button"
                    disabled={actionLoading || !['PACKED', 'Packed', 'OUT_FOR_DELIVERY', 'Out for Delivery'].includes(selectedNotification.status) || selectedNotification.status === 'OUT_FOR_DELIVERY'}
                    onClick={() => handleUpdateStatus(selectedNotification, 'Out for Delivery')}
                    className={`px-3.5 py-1.5 rounded-xl font-bold text-xs cursor-pointer border transition-all ${
                      selectedNotification.status === 'OUT_FOR_DELIVERY' || selectedNotification.status === 'Out for Delivery'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white hover:bg-blue-50 text-blue-700 border-blue-300'
                    }`}
                  >
                    🚚 Out for Delivery
                  </button>

                  <button
                    type="button"
                    disabled={actionLoading || !['PACKED', 'Packed', 'OUT_FOR_DELIVERY', 'Out for Delivery', 'DELIVERED', 'Delivered'].includes(selectedNotification.status) || selectedNotification.status === 'DELIVERED'}
                    onClick={() => handleUpdateStatus(selectedNotification, 'Delivered')}
                    className={`px-3.5 py-1.5 rounded-xl font-bold text-xs cursor-pointer border transition-all ${
                      selectedNotification.status === 'DELIVERED' || selectedNotification.status === 'Delivered'
                        ? 'bg-green-700 text-white border-green-700'
                        : 'bg-white hover:bg-green-50 text-green-800 border-green-300'
                    }`}
                  >
                    📦 Delivered
                  </button>

                  <button
                    type="button"
                    disabled={actionLoading || selectedNotification.status === 'REJECTED'}
                    onClick={() => setRejectionModalOpen(true)}
                    className={`px-3.5 py-1.5 rounded-xl font-bold text-xs cursor-pointer border transition-all ${
                      selectedNotification.status === 'REJECTED' || selectedNotification.status === 'Rejected'
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white hover:bg-red-50 text-red-600 border-red-300'
                    }`}
                  >
                    ✕ Reject Order
                  </button>
                </div>
              </div>

              {/* Grid 1: Customer Details & Delivery Address Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Customer Info Card */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
                    <User size={16} className="text-[#ff7526]" />
                    <span className="text-xs font-extrabold uppercase text-slate-700 tracking-wider">Customer Details</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <p className="font-bold text-slate-900 text-sm m-0">{selectedNotification.customerDetails?.name || 'Customer'}</p>
                    <p className="text-slate-600 m-0 flex items-center gap-1.5 font-medium">
                      <Phone size={13} className="text-slate-400" />
                      <a href={`tel:${selectedNotification.customerDetails?.phone}`} className="text-blue-600 underline font-mono">
                        {selectedNotification.customerDetails?.phone || 'No phone provided'}
                      </a>
                    </p>
                    {selectedNotification.customerDetails?.email && (
                      <p className="text-slate-500 m-0 font-normal">{selectedNotification.customerDetails.email}</p>
                    )}
                  </div>
                </div>

                {/* Delivery Address Details Card */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-[#ff7526]" />
                      <span className="text-xs font-extrabold uppercase text-slate-700 tracking-wider">Delivery Address</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-white border border-slate-200 rounded-md text-slate-600">
                      {selectedNotification.deliveryAddress?.addressType || 'Home'}
                    </span>
                  </div>
                  <div className="space-y-0.5 text-xs text-slate-700 font-medium">
                    <p className="m-0 font-semibold">{selectedNotification.deliveryAddress?.addressLine1 || 'Street Address'}</p>
                    {selectedNotification.deliveryAddress?.addressLine2 && <p className="m-0 text-slate-500">{selectedNotification.deliveryAddress.addressLine2}</p>}
                    {selectedNotification.deliveryAddress?.landmark && <p className="m-0 text-slate-400">Landmark: {selectedNotification.deliveryAddress.landmark}</p>}
                    <p className="m-0 font-bold text-slate-900 pt-0.5">
                      {selectedNotification.deliveryAddress?.city || 'City'}, {selectedNotification.deliveryAddress?.state || 'State'} - <span className="font-mono text-[#ff7526]">{selectedNotification.deliveryAddress?.pincode}</span>
                    </p>
                  </div>
                </div>

              </div>

              {/* Ordered Items List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <Box size={18} className="text-[#ff7526]" />
                    <h3 className="text-sm font-extrabold text-slate-900 m-0">Ordered Items ({selectedNotification.items?.length || 0})</h3>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">Belonging to your store</span>
                </div>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                  {selectedNotification.items && selectedNotification.items.map((item, idx) => (
                    <div key={idx} className="p-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                      <div className="flex items-center gap-3.5">
                        <img 
                          src={getImageUrl(item.image, item.name)} 
                          alt={item.name} 
                          className="w-14 h-14 rounded-xl object-cover border border-slate-200 bg-slate-100 shrink-0"
                          onError={(e) => handleImageError(e, item.name)}
                        />
                        <OrderLine item={item} />
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-sm font-extrabold text-slate-900">₹{Number(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Proof of Delivery Photo (Uploaded by Captain upon delivery) */}
              {selectedNotification.proofOfDeliveryUrl ? (
                <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200/90 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-800 text-lg font-bold">photo_camera</span>
                      <span className="text-xs font-black uppercase text-emerald-900 tracking-wider">Proof of Delivery (Uploaded by Captain)</span>
                    </div>
                    <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                      ✓ Verified Drop-off
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div 
                      onClick={() => setViewingProofUrl(selectedNotification.proofOfDeliveryUrl)}
                      className="w-full sm:w-44 h-36 rounded-xl overflow-hidden border-2 border-emerald-400 shadow-sm cursor-pointer group relative bg-white shrink-0"
                    >
                      <img 
                        src={selectedNotification.proofOfDeliveryUrl} 
                        alt="Delivery Proof" 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold text-xs gap-1 transition-opacity">
                        <Eye size={16} /> Click to Enlarge
                      </div>
                    </div>

                    <div className="flex-1 space-y-1.5 text-xs">
                      <p className="font-bold text-slate-800 m-0">Real Delivery Photo Evidence</p>
                      <p className="text-slate-600 text-[11.5px] m-0 leading-relaxed">
                        This real package drop-off photo was captured and uploaded by the delivery captain upon OTP confirmation at the customer doorstep.
                      </p>
                      <button
                        type="button"
                        onClick={() => setViewingProofUrl(selectedNotification.proofOfDeliveryUrl)}
                        className="mt-1 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] rounded-lg border-none cursor-pointer flex items-center gap-1.5 shadow-2xs"
                      >
                        <Eye size={13} /> View Full-Size Proof
                      </button>
                    </div>
                  </div>
                </div>
              ) : (selectedNotification.status === 'DELIVERED' || selectedNotification.status === 'Delivered') ? (
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs text-slate-500 flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-slate-400 text-lg">info</span>
                  <span>Delivered with OTP verification. No photo proof uploaded by captain.</span>
                </div>
              ) : null}

              {/* Payment Details & Total Seller Amount */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[#ff7526] shrink-0 shadow-2xs">
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 font-semibold uppercase">Payment Details</span>
                    <p className="text-xs font-bold text-slate-800 m-0 mt-0.5">
                      Method: <span className="font-extrabold text-slate-900">{selectedNotification.paymentMethod}</span>
                    </p>
                    <p className="text-[11px] text-slate-500 m-0">
                      Status: <span className={`font-bold ${formatSellerPaymentLabel(selectedNotification).status === 'Completed' ? 'text-emerald-600' : 'text-amber-600'}`}>{formatSellerPaymentLabel(selectedNotification).status}</span>
                    </p>
                  </div>
                </div>

                <div className="text-right w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
                  <span className="text-xs text-slate-400 font-semibold uppercase block">Total Seller Amount</span>
                  <span className="text-2xl font-black text-[#ff7526]">₹{Number(selectedNotification.totalAmount || 0).toFixed(2)}</span>
                </div>
              </div>

            </div>

            {/* Modal Bottom Footer Actions */}
            <div className="p-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs font-semibold text-slate-500">
                Order ID: <span className="font-bold text-slate-900 font-mono">{selectedNotification.orderId}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNotification(null)}
                className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl border-none cursor-pointer shadow-sm transition-all"
              >
                Close Order Details
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. REJECTION CONFIRMATION & REASON MODAL DIALOG */}
      {/* ------------------------------------------------------------- */}
      {rejectionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2 m-0">
                <AlertCircle size={20} className="text-red-500" /> Reject Order Confirmation
              </h3>
              <button 
                type="button"
                onClick={() => setRejectionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 border-none bg-transparent font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 m-0">
              Please select a reason for rejecting Order <span className="font-bold text-slate-900 font-mono">#{selectedNotification?.orderId}</span>. The customer will be notified with this reason.
            </p>

            <form onSubmit={handleRejectOrderSubmit} className="space-y-4">
              <div className="space-y-2">
                {[
                  'Product unavailable',
                  'Unable to fulfill order',
                  'Out of stock',
                  'Delivery issue',
                  'Other'
                ].map((reason) => (
                  <label 
                    key={reason}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all text-xs font-semibold ${
                      selectedReason === reason 
                        ? 'bg-red-50/70 border-red-300 text-red-900 shadow-2xs' 
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <input 
                      type="radio" 
                      name="rejectionReason" 
                      value={reason}
                      checked={selectedReason === reason}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      className="accent-red-600 cursor-pointer"
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>

              {selectedReason === 'Other' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Specify Custom Reason *</label>
                  <textarea 
                    rows={3}
                    required
                    placeholder="Enter specific reason for rejecting order..."
                    value={customReasonText}
                    onChange={(e) => setCustomReasonText(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:border-red-500"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectionModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold rounded-xl border-none cursor-pointer shadow-md transition-all active:scale-95"
                >
                  {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. FULL-SIZE PROOF OF DELIVERY LIGHTBOX MODAL */}
      {viewingProofUrl && (
        <div 
          onClick={() => setViewingProofUrl(null)}
          className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh] border border-slate-200"
          >
            <div className="px-5 py-3.5 bg-white border-b border-slate-100 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-700 text-lg font-bold">photo_camera</span>
                <h3 className="text-sm font-extrabold text-slate-900 m-0">Proof of Delivery (Real Drop-off Photo)</h3>
              </div>
              <button 
                onClick={() => setViewingProofUrl(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer border-none"
              >
                ✕
              </button>
            </div>
            <div className="p-4 bg-slate-100 flex items-center justify-center overflow-auto max-h-[70vh]">
              <img 
                src={viewingProofUrl} 
                alt="Full Delivery Proof" 
                className="w-auto max-w-full h-auto max-h-[66vh] object-contain rounded-xl shadow-md"
              />
            </div>
            <div className="p-3.5 bg-white border-t border-slate-100 flex justify-between items-center shrink-0">
              <span className="text-xs text-slate-500 font-medium">Uploaded by Delivery Captain upon OTP delivery</span>
              <button
                onClick={() => setViewingProofUrl(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl border-none cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

const NotificationStatusBadge = ({ status }) => {
  let style = 'bg-slate-100 text-slate-700 border border-slate-200';
  let label = status;

  if (status === 'NEW') {
    style = 'bg-orange-100 text-[#ff7526] border border-orange-300 animate-pulse';
    label = 'NEW ORDER';
  } else if (status === 'VIEWED') {
    style = 'bg-amber-50 text-amber-700 border border-amber-200';
    label = 'VIEWED';
  } else if (status === 'ACCEPTED' || status === 'Accepted') {
    style = 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    label = 'ACCEPTED';
  } else if (status === 'PACKED' || status === 'Packed') {
    style = 'bg-violet-50 text-violet-700 border border-violet-200';
    label = 'PACKED';
  } else if (status === 'Reached Store' || status === 'At Pickup' || status === 'Reached Store / Pickup') {
    style = 'bg-indigo-50 text-indigo-700 border border-indigo-200 font-extrabold';
    label = 'CAPTAIN AT STORE';
  } else if (status === 'OUT_FOR_DELIVERY' || status === 'Out for Delivery' || status === 'In Transit') {
    style = 'bg-blue-50 text-blue-700 border border-blue-200 font-extrabold';
    label = 'OUT FOR DELIVERY';
  } else if (status === 'DELIVERED' || status === 'Delivered') {
    style = 'bg-green-100 text-green-800 border border-green-300 font-extrabold';
    label = 'DELIVERED';
  } else if (status === 'REJECTED' || status === 'Rejected') {
    style = 'bg-red-50 text-red-700 border border-red-200';
    label = 'REJECTED';
  }

  return <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase ${style}`}>{label}</span>;
};

export default Orders;
