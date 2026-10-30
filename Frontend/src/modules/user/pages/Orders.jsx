import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Package, ArrowLeft, SlidersHorizontal, Check, Loader2 } from 'lucide-react';
import { useOrder } from '../context/OrderContext';
import { orderService, getCachedUserOrders } from '../../../services/authService';
import { getImageUrl, handleImageError } from '../../../utils/imageUtils';

const formatRawOrdersData = (rawList = []) => {
  return rawList.map(o => {
    let displayStatus = (o.orderStatus || o.status || 'Placed').trim();
    if (displayStatus === 'Payment Pending' || (o.paymentStatus === 'Pending' && o.paymentMethod && o.paymentMethod !== 'COD' && displayStatus !== 'Placed' && displayStatus !== 'Cancelled')) {
      displayStatus = 'Payment Pending';
    }
    if (o.orderStatus === 'Refund Completed' || o.refundStatus === 'Completed' || o.returnStatus === 'Refunded') {
      displayStatus = 'Refund Completed';
    } else if (o.orderStatus === 'Returned' || o.returnStatus === 'Completed') {
      displayStatus = 'Returned';
    } else if (o.orderStatus === 'Return Approved' || o.returnStatus === 'Approved') {
      displayStatus = 'Return Approved';
    } else if (o.orderStatus === 'Return Requested' || o.returnStatus === 'Pending' || o.returnStatus === 'Requested') {
      displayStatus = 'Return Requested';
    } else if (o.orderStatus === 'Return Rejected' || o.returnStatus === 'Rejected') {
      displayStatus = 'Return Rejected';
    }

    return {
      id: o.orderId || o._id,
      _id: o._id,
      date: o.createdAt 
        ? new Date(o.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : 'Recent',
      status: displayStatus,
      rejectionReason: o.rejectionReason || '',
      items: o.items || [],
      total: o.grandTotal || o.total || 0,
      itemCount: (o.items || []).reduce((acc, i) => acc + (i.quantity || 1), 0),
      rawOrder: o,
    };
  });
};

const Orders = () => {
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  
  // Instant Initial State from Cache (0ms latency)
  const [serverOrders, setServerOrders] = useState(() => {
    const cached = getCachedUserOrders();
    if (cached && Array.isArray(cached.orders) && cached.orders.length > 0) {
      return formatRawOrdersData(cached.orders);
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    const cached = getCachedUserOrders();
    return !(cached && Array.isArray(cached.orders) && cached.orders.length > 0);
  });

  const filterOptions = ['All', 'Placed', 'Processing', 'Out for Delivery', 'Delivered', 'Refund Completed', 'Cancelled'];

  const { orders: contextOrders } = useOrder();

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await orderService.getOrders(true);
        if (res && res.success && res.orders) {
          setServerOrders(formatRawOrdersData(res.orders));
        }
      } catch (err) {
        console.error('Failed to fetch backend orders:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const allOrders = serverOrders.length > 0 ? serverOrders : contextOrders;

  const getStatusColor = (status) => {
    switch (status) {
      case 'Payment Pending': return 'text-amber-700 font-bold bg-amber-50 border-amber-200';
      case 'Placed': return 'text-orange-600 font-bold bg-orange-50 border-orange-200';
      case 'Accepted': return 'text-emerald-600 font-extrabold bg-emerald-50 border-emerald-200';
      case 'Rejected': return 'text-red-600 font-extrabold bg-red-50 border-red-200';
      case 'Processing': return 'text-[#ff5500] font-bold bg-orange-50 border-orange-200';
      case 'Out for Delivery': return 'text-blue-600 font-bold bg-blue-50 border-blue-200';
      case 'Delivered': return 'text-emerald-600 font-extrabold bg-emerald-50 border-emerald-200';
      case 'Cancelled': return 'text-red-500 font-bold bg-red-50 border-red-200';
      case 'Refund Completed':
      case 'Refunded':
        return 'text-emerald-700 font-black bg-emerald-50 border-emerald-300';
      case 'Return Requested':
        return 'text-amber-700 font-bold bg-amber-50 border-amber-200';
      case 'Return Approved':
        return 'text-teal-700 font-bold bg-teal-50 border-teal-200';
      case 'Return Rejected':
        return 'text-rose-700 font-bold bg-rose-50 border-rose-200';
      case 'Returned':
        return 'text-purple-700 font-bold bg-purple-50 border-purple-200';
      default: return 'text-slate-600 font-medium bg-slate-50 border-slate-200';
    }
  };

  const filteredOrders = allOrders.filter(order => {
    const matchesSearch = String(order.id).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = selectedFilter === 'All' || order.status === selectedFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="w-full h-[100dvh] md:h-auto md:min-h-screen bg-[#f8fafc] font-sans text-slate-800 relative shadow-none flex flex-col overflow-hidden md:overflow-visible px-0 md:px-5 md:py-6">
      
      {/* Mobile Peach Header */}
      <header className="md:hidden flex flex-col gap-0 py-4 px-5 bg-[#ffece1] z-10">
        <div className="flex items-center gap-4">
          <ArrowLeft size={24} className="text-[#1e1b4b] cursor-pointer" onClick={() => navigate(-1)} />
          <h2 className="text-[20px] font-medium m-0 text-[#1e1b4b]">My Orders</h2>
        </div>
      </header>

      {/* Desktop Header Banner */}
      <div className="hidden md:flex flex-col bg-white border border-slate-100 rounded-2xl p-6 shadow-xs mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900 m-0">My Orders</h1>
            <p className="text-sm text-slate-500 mt-1 mb-0">Track active deliveries and review order status</p>
          </div>
          <button 
            onClick={() => navigate('/order-history')}
            className="flex items-center gap-2 px-4 py-2 bg-orange-50 hover:bg-orange-100 text-[#ff5500] font-bold text-sm rounded-xl border border-orange-200 cursor-pointer transition-colors"
          >
            <Package size={16} /> Complete Order History →
          </button>
        </div>
      </div>

      {/* Quick Link to Order History */}
      <div className="bg-[#fff4ed] border-b border-orange-200/70 px-5 py-2.5 flex items-center justify-between text-xs shrink-0">
        <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
          <Package size={14} className="text-[#ff5500]" />
          <span>Looking for complete order history?</span>
        </div>
        <button 
          onClick={() => navigate('/order-history')}
          className="text-[#ff5500] hover:text-[#d97706] font-extrabold border-none bg-transparent cursor-pointer p-0 underline"
        >
          View Order History →
        </button>
      </div>

      {/* Search & Filters */}
      <div className="px-5 py-4 bg-[#f8fafc] flex gap-3 z-10">
        <div className="flex-1 bg-white border border-slate-200 rounded-xl flex items-center px-3 gap-2">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input 
            type="text" 
            placeholder="Search orders by ID..." 
            className="w-full bg-transparent border-none py-2.5 text-[14px] outline-none text-slate-700 placeholder:text-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {/* Filter Dropdown Container */}
        <div className="relative">
          <button 
            onClick={() => setIsFilterModalOpen(!isFilterModalOpen)}
            className={`h-full bg-white border ${selectedFilter !== 'All' ? 'border-[#ff5500] text-[#ff5500]' : 'border-slate-200 text-slate-700'} rounded-xl px-4 flex items-center gap-2 cursor-pointer active:scale-95 transition-transform`}
          >
            <SlidersHorizontal size={16} className={selectedFilter !== 'All' ? 'text-[#ff5500]' : 'text-slate-600'} />
            <span className="text-[14px] font-medium">Filters {selectedFilter !== 'All' && '(1)'}</span>
          </button>

          {/* Dropdown Menu */}
          {isFilterModalOpen && (
            <>
              {/* Invisible overlay to close dropdown when clicking outside */}
              <div 
                className="fixed inset-0 z-[90]"
                onClick={() => setIsFilterModalOpen(false)}
              ></div>
              <div className="absolute top-full mt-2 right-0 w-[180px] bg-white rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden z-[100] animate-fade-in-up origin-top-right">
                {filterOptions.map((option) => (
                  <div 
                    key={option}
                    className={`flex justify-between items-center px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${selectedFilter === option ? 'bg-orange-50/50' : ''}`}
                    onClick={() => {
                      setSelectedFilter(option);
                      setIsFilterModalOpen(false);
                    }}
                  >
                    <span className={`text-[14px] ${selectedFilter === option ? 'font-bold text-[#ff5500]' : 'font-medium text-slate-600'}`}>
                      {option}
                    </span>
                    {selectedFilter === option && <Check size={16} className="text-[#ff5500]" />}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Order List */}
      <div className="flex-1 overflow-y-auto px-5 md:px-0 pb-[100px] md:pb-12 pt-2 md:pt-0 [&::-webkit-scrollbar]:hidden md:overflow-visible">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 size={32} className="animate-spin text-[#ff5500]" />
            <span className="text-sm font-bold text-slate-700">Loading your orders...</span>
          </div>
        ) : filteredOrders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredOrders.map((order, index) => {
              const rawImg = order.items?.[0]?.image;
              const prodImg = order.items?.[0]?.product?.mainImage || order.items?.[0]?.product?.image;
              const firstItemImg = (rawImg && !rawImg.includes('photo-1586201375761-83865001e31c') ? rawImg : null) || prodImg || rawImg;
              const firstItemName = order.items?.[0]?.name || order.items?.[0]?.product?.name || order.id || 'Order';
              return (
                <div key={index} className="bg-white rounded-[16px] md:rounded-2xl p-4 md:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 flex flex-col justify-between gap-3 hover:shadow-md transition-shadow">
                  
                  {/* Top Row: Icon, ID/Date, Status */}
                  <div className="flex items-start justify-between">
                    <div className="flex gap-3 items-center">
                      <div className="w-[44px] h-[44px] md:w-12 md:h-12 rounded-[12px] bg-[#f0f3f6] flex items-center justify-center shrink-0 overflow-hidden">
                        <img 
                          src={getImageUrl(firstItemImg, firstItemName)} 
                          alt="Order Item" 
                          className="w-full h-full object-cover" 
                          onError={(e) => handleImageError(e, firstItemName)}
                        />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[14px] md:text-base font-extrabold text-slate-900 tracking-tight">{order.id}</span>
                        <span className="text-[12px] font-medium text-slate-500">{order.date}</span>
                      </div>
                    </div>
                    <span className={`text-[12px] md:text-xs font-bold px-2.5 py-1 rounded-full border ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="w-full h-px bg-slate-100 my-0.5"></div>

                  {/* Bottom Row: Items, Price, Link */}
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] md:text-sm font-bold text-slate-500">{order.itemCount} Items</span>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-[15px] md:text-lg font-extrabold text-slate-900">₹{order.total}.00</span>
                      <button 
                        onClick={() => navigate('/track-order', { state: { order: order.rawOrder || order } })}
                        className="bg-transparent border-none text-[#ff5500] hover:text-[#d97706] text-[12px] md:text-xs font-extrabold cursor-pointer p-0 transition-colors"
                      >
                        View Details →
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-[20px] flex flex-col items-center justify-center py-16 shadow-[0_4px_24px_rgba(0,0,0,0.03)] border border-slate-100 mt-2">
            <Package size={48} className="text-slate-300 mb-4" strokeWidth={1.5} />
            <span className="text-[15px] font-medium text-slate-600">No active shopping orders found.</span>
            <button 
              onClick={() => navigate('/order-history')}
              className="mt-3 px-4 py-2 bg-orange-50 text-[#ff5500] font-bold text-xs rounded-xl border border-orange-200 cursor-pointer"
            >
              View Full Order History
            </button>
          </div>
        )}
      </div>

    </div>
  );
};

export default Orders;
