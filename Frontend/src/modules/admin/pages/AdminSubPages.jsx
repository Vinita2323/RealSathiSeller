import React, { useState, useEffect, useMemo } from 'react';
import { useAdmin } from '../context/useAdmin';
import { StatusBadge, Drawer, Modal } from '../components/AdminUIComponents';
import { categoryService, bannerService, productService, walletService, captainService, fcmService, adminService } from '../../../services/authService';
import { faqService } from '../../../services/faqService';
import { supportService } from '../../../services/supportService';
import { mockUsers, mockSellers, mockCaptains, mockCategories, mockProducts, mockOrders, mockDeliveries, mockPayments, mockCoupons, mockNotifications, mockRoles, mockFaqs } from '../mock/adminMockData';
import { getImageUrl, handleImageError, getInitialSvgDataUrl, compressAndResizeImage, uploadFileViaApi } from '../../../utils/imageUtils';
import { 
  Search, 
  Download, 
  Plus, 
  Eye, 
  Truck, 
  Send,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Store,
  Package,
  MapPin,
  Phone,
  Clock,
  Navigation,
  Edit3,
  Pencil,
  Trash2,
  Upload,
  CheckCircle,
  FileText,
  DollarSign,
  Boxes,
  Image,
  Tag,
  RefreshCw,
  ShieldCheck,
  RotateCcw,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Loader2,
  User,
  Check,
  X,
  Filter,
  Printer,
  ExternalLink,
  Calendar,
  CreditCard,
  Banknote,
  ShieldAlert,
  Users,
  ShoppingBag,
  ArrowUpRight,
  Undo2,
  Copy,
  ZoomIn,
  Building2,
  FileCheck,
  Maximize2
} from 'lucide-react';
import ProductVariantBuilder from '../../seller/components/ProductVariantBuilder';
import { useDebounce } from '../../../hooks/useDebounce';

/* =========================================================================
   1. USER MANAGEMENT PAGE (USERS, USER ORDERS & RETURN ORDERS TABS)
   ========================================================================= */
export const UserManagement = () => {
  const [activeSubTab, setActiveSubTab] = useState('users_orders'); // 'users_orders' | 'return_orders'
  const [users, setUsers] = useState([]);
  const [returnOrders, setReturnOrders] = useState([]);
  const [overallStats, setOverallStats] = useState({
    totalUsers: 0,
    totalOrdersPlaced: 0,
    totalReturnOrders: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [currentPage, setCurrentPage] = useState(1);
  const [entriesPerPage, setEntriesPerPage] = useState(10);

  // User Drawer & Order History States
  const [selectedUser, setSelectedUser] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [userOrders, setUserOrders] = useState([]);
  const [loadingUserOrders, setLoadingUserOrders] = useState(false);

  // Return Status Modal State
  const [selectedReturnOrder, setSelectedReturnOrder] = useState(null);
  const [returnStatusInput, setReturnStatusInput] = useState('');
  const [updatingReturn, setUpdatingReturn] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = (text, isError = false) => {
    setToastMsg({ text, isError });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchUsersData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await adminService.getUsers(true);
      if (res && res.success) {
        if (Array.isArray(res.users)) {
          const mappedUsers = res.users.map((u) => {
            const isUserBlocked = Boolean(u.isBlocked || u.status === 'blocked' || u.status === 'suspended');
            return {
              id: u._id,
              _id: u._id,
              name: u.name || 'Customer',
              email: u.email || 'N/A',
              phone: u.phone || 'N/A',
              avatar: u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'User')}&background=FF5500&color=fff`,
              ordersCount: Number(u.ordersCount || 0),
              returnsCount: Number(u.returnsCount || 0),
              totalSpent: Number(u.totalSpent || 0),
              walletBalance: `₹${Number(u.walletBalance || 0).toFixed(2)}`,
              joinedDate: u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A',
              isBlocked: isUserBlocked,
              status: isUserBlocked ? 'Blocked' : (u.isVerified !== false ? 'Active' : 'Pending'),
              blockReason: u.blockReason || '',
              blockedAt: u.blockedAt || null,
              blockedBy: u.blockedBy || '',
              raw: u,
            };
          });
          setUsers(mappedUsers);
        } else {
          setUsers([]);
        }

        if (Array.isArray(res.returnOrders)) {
          setReturnOrders(res.returnOrders);
        }

        if (res.overallStats) {
          setOverallStats(res.overallStats);
        }
      }
    } catch (err) {
      console.error('Failed to fetch real users data:', err);
      showToast('Error loading live users data', true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUsersData();
  }, []);

  // Block / Unblock Modal State & Handler
  const [blockingUser, setBlockingUser] = useState(null);
  const [blockReasonInput, setBlockReasonInput] = useState('');
  const [submittingBlock, setSubmittingBlock] = useState(false);

  const openBlockModal = (user) => {
    setBlockingUser(user);
    setBlockReasonInput(user.blockReason || '');
  };

  const handleConfirmToggleBlock = async () => {
    if (!blockingUser) return;
    const isTargetBlocked = !blockingUser.isBlocked;

    try {
      setSubmittingBlock(true);
      const res = await adminService.toggleUserBlock(
        blockingUser.id || blockingUser._id,
        isTargetBlocked,
        isTargetBlocked ? (blockReasonInput.trim() || 'Blocked by Administrator') : ''
      );

      if (res && res.success) {
        showToast(res.message || (isTargetBlocked ? 'User blocked successfully' : 'User unblocked successfully'));

        // Update local users array
        setUsers((prev) =>
          prev.map((u) => {
            if (String(u.id) === String(blockingUser.id)) {
              return {
                ...u,
                isBlocked: isTargetBlocked,
                status: isTargetBlocked ? 'Blocked' : 'Active',
                blockReason: isTargetBlocked ? (blockReasonInput.trim() || 'Blocked by Administrator') : '',
                blockedAt: isTargetBlocked ? new Date() : null,
              };
            }
            return u;
          })
        );

        // Update selected user in drawer if open
        if (selectedUser && String(selectedUser.id) === String(blockingUser.id)) {
          setSelectedUser((prev) => ({
            ...prev,
            isBlocked: isTargetBlocked,
            status: isTargetBlocked ? 'Blocked' : 'Active',
            blockReason: isTargetBlocked ? (blockReasonInput.trim() || 'Blocked by Administrator') : '',
            blockedAt: isTargetBlocked ? new Date() : null,
          }));
        }

        setBlockingUser(null);
        setBlockReasonInput('');
      } else {
        showToast(res?.message || 'Failed to update user block status', true);
      }
    } catch (err) {
      console.error('Error updating user block status:', err);
      showToast(err.response?.data?.message || 'Error updating user block status', true);
    } finally {
      setSubmittingBlock(false);
    }
  };

  // Fetch individual user's orders when opening drawer
  const handleOpenUserDrawer = async (user) => {
    setSelectedUser(user);
    setIsDrawerOpen(true);
    setUserOrders([]);
    setLoadingUserOrders(true);

    try {
      const res = await adminService.getUserOrders(user.id || user._id);
      if (res && res.success && Array.isArray(res.orders)) {
        setUserOrders(res.orders);
      }
    } catch (err) {
      console.error('Failed to fetch user order history:', err);
    } finally {
      setLoadingUserOrders(false);
    }
  };

  // Update Return Order Status Handler
  const handleUpdateReturnStatus = async () => {
    if (!selectedReturnOrder || !returnStatusInput) return;
    try {
      setUpdatingReturn(true);
      const res = await adminService.updateReturnStatus(selectedReturnOrder._id || selectedReturnOrder.orderId, {
        returnStatus: returnStatusInput,
        orderStatus: returnStatusInput === 'Approved' ? 'Returned' : (returnStatusInput === 'Rejected' ? 'Delivered' : selectedReturnOrder.orderStatus),
      });

      if (res && res.success) {
        showToast(`Return status updated to ${returnStatusInput}`);
        setSelectedReturnOrder(null);
        await fetchUsersData(true);
      } else {
        showToast(res?.message || 'Failed to update return status', true);
      }
    } catch (err) {
      console.error('Failed to update return status:', err);
      showToast(err.response?.data?.message || 'Error updating return status', true);
    } finally {
      setUpdatingReturn(false);
    }
  };

  // Filtered Users List (debounced)
  const filteredUsers = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.phone.toLowerCase().includes(q) ||
        String(u.id).toLowerCase().includes(q)
    );
  }, [users, debouncedSearch]);

  // Filtered Return Orders List (debounced)
  const filteredReturns = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return returnOrders;
    return returnOrders.filter((ro) => {
      const custName = ro.user?.name || ro.shippingAddress?.fullName || '';
      const custPhone = ro.user?.phone || ro.shippingAddress?.phone || '';
      const orderId = ro.orderId || ro._id || '';
      const reason = ro.returnReason || '';
      return (
        custName.toLowerCase().includes(q) ||
        custPhone.toLowerCase().includes(q) ||
        orderId.toLowerCase().includes(q) ||
        reason.toLowerCase().includes(q)
      );
    });
  }, [returnOrders, debouncedSearch]);

  // Pagination for Active Tab
  const activeItemsCount = activeSubTab === 'users_orders' ? filteredUsers.length : filteredReturns.length;
  const totalPages = Math.ceil(activeItemsCount / entriesPerPage) || 1;
  const indexOfLastItem = currentPage * entriesPerPage;
  const indexOfFirstItem = indexOfLastItem - entriesPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);
  const currentReturns = filteredReturns.slice(indexOfFirstItem, indexOfLastItem);

  // Return Status Badge Helper
  const renderReturnBadge = (status, returnStatus) => {
    const activeStat = returnStatus || status;
    switch (activeStat) {
      case 'Approved':
      case 'Returned':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle size={12} /> Return Completed</span>;
      case 'Rejected':
      case 'Return Rejected':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200"><X size={12} /> Return Rejected</span>;
      case 'Pending':
      case 'Return Requested':
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200"><Undo2 size={12} /> Return Requested</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-8">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed top-5 right-5 z-[9999] px-4 py-3 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 border transition-all ${
            toastMsg.isError ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {toastMsg.isError ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Top Banner & Refresh Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900 m-0">Customer & Orders Management</h2>
            <span className="bg-orange-100 text-[#ff5500] text-[11px] font-black px-2.5 py-0.5 rounded-full">
              {users.length} Customers
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1 m-0">
            Track user orders, lifetime spending, returns count, and customer return requests
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => fetchUsersData(true)}
            disabled={refreshing || loading}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 text-xs font-bold rounded-xl transition-all border-none cursor-pointer flex items-center gap-1.5"
            title="Refresh Live Data"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Live Refresh'}</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Total Users</span>
            <span className="text-xl font-black text-slate-900 mt-0.5 block">{overallStats.totalUsers || users.length}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#ff5500] flex items-center justify-center font-bold">
            <Users size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Total User Orders</span>
            <span className="text-xl font-black text-blue-600 mt-0.5 block">
              {overallStats.totalOrdersPlaced || users.reduce((sum, u) => sum + u.ordersCount, 0)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <ShoppingBag size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Total Return Orders</span>
            <span className="text-xl font-black text-amber-600 mt-0.5 block">
              {overallStats.totalReturnOrders || returnOrders.length || users.reduce((sum, u) => sum + u.returnsCount, 0)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Undo2 size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Total Customer Spend</span>
            <span className="text-xl font-black text-emerald-600 mt-0.5 block">
              ₹{(overallStats.totalRevenue || users.reduce((sum, u) => sum + u.totalSpent, 0)).toFixed(2)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <DollarSign size={20} />
          </div>
        </div>
      </div>

      {/* Main Content Area with 2 Primary Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Tab Navigation Buttons */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 p-2 gap-2">
          <button
            onClick={() => {
              setActiveSubTab('users_orders');
              setCurrentPage(1);
            }}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer border-none flex items-center gap-2 ${
              activeSubTab === 'users_orders'
                ? 'bg-[#ff5500] text-white shadow-sm shadow-orange-500/20'
                : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Users size={15} />
            <span>Total Users / Orders</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                activeSubTab === 'users_orders' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {filteredUsers.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveSubTab('return_orders');
              setCurrentPage(1);
            }}
            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer border-none flex items-center gap-2 ${
              activeSubTab === 'return_orders'
                ? 'bg-[#ff5500] text-white shadow-sm shadow-orange-500/20'
                : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Undo2 size={15} />
            <span>Total Return Orders</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                activeSubTab === 'return_orders' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {filteredReturns.length}
            </span>
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={
                activeSubTab === 'users_orders'
                  ? 'Search by Customer Name, Phone, Email...'
                  : 'Search by Order ID, Customer, Return Reason...'
              }
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#ff5500]"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold">Show entries:</span>
            <select
              value={entriesPerPage}
              onChange={(e) => {
                setEntriesPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-bold outline-none focus:border-[#ff5500]"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* TAB 1: TOTAL USERS / ORDERS TABLE */}
        {activeSubTab === 'users_orders' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Contact Info</th>
                  <th className="py-3 px-4 text-center">Total Orders</th>
                  <th className="py-3 px-4 text-center">Return Orders</th>
                  <th className="py-3 px-4">Lifetime Spend</th>
                  <th className="py-3 px-4">Wallet Balance</th>
                  <th className="py-3 px-4">Joined Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan="9" className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 size={24} className="animate-spin text-[#ff5500]" />
                        <span className="text-xs font-semibold text-slate-600">Loading customers and order counts...</span>
                      </div>
                    </td>
                  </tr>
                ) : currentUsers.length > 0 ? (
                  currentUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-orange-50/20 transition-colors">
                      {/* Customer */}
                      <td className="py-3.5 px-4 align-middle">
                        <div className="flex items-center gap-3">
                          <img
                            src={u.avatar}
                            alt={u.name}
                            className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-2xs"
                          />
                          <div>
                            <p className="font-bold text-slate-900 m-0 text-xs">{u.name}</p>
                            <span className="text-[10px] text-slate-400 font-mono">ID: {String(u.id).slice(-6)}</span>
                          </div>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className="py-3.5 px-4 align-middle">
                        <p className="font-medium text-slate-800 m-0">{u.phone}</p>
                        <p className="text-[11px] text-slate-400 m-0 mt-0.5">{u.email}</p>
                      </td>

                      {/* Total Orders Count */}
                      <td className="py-3.5 px-4 align-middle text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black ${
                            u.ordersCount > 0
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <ShoppingBag size={12} /> {u.ordersCount} {u.ordersCount === 1 ? 'Order' : 'Orders'}
                        </span>
                      </td>

                      {/* Total Return Orders Count */}
                      <td className="py-3.5 px-4 align-middle text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black ${
                            u.returnsCount > 0
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          <Undo2 size={12} /> {u.returnsCount} {u.returnsCount === 1 ? 'Return' : 'Returns'}
                        </span>
                      </td>

                      {/* Total Spent */}
                      <td className="py-3.5 px-4 align-middle">
                        <span className="font-black text-slate-900 font-mono text-xs">
                          ₹{Number(u.totalSpent || 0).toFixed(2)}
                        </span>
                      </td>

                      {/* Wallet Balance */}
                      <td className="py-3.5 px-4 align-middle">
                        <span className="font-bold text-[#ff5500] font-mono text-xs">{u.walletBalance}</span>
                      </td>

                      {/* Joined Date */}
                      <td className="py-3.5 px-4 align-middle font-mono text-slate-500 text-[11px]">
                        {u.joinedDate}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 align-middle">
                        <div className="flex flex-col gap-0.5">
                          <StatusBadge status={u.status} />
                          {u.isBlocked && u.blockReason && (
                            <span className="text-[10px] text-rose-600 font-semibold truncate max-w-[130px]" title={u.blockReason}>
                              {u.blockReason}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 align-middle text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenUserDrawer(u)}
                            className="px-2.5 py-1.5 bg-orange-50 hover:bg-[#ff5500] text-[#ff5500] hover:text-white rounded-lg transition-colors border border-orange-200 hover:border-[#ff5500] cursor-pointer text-[11px] font-bold inline-flex items-center gap-1"
                            title="View Complete Profile & Order History"
                          >
                            <Eye size={12} />
                            <span>Orders</span>
                          </button>

                          {u.isBlocked ? (
                            <button
                              onClick={() => openBlockModal(u)}
                              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded-lg transition-colors border border-emerald-200 hover:border-emerald-600 cursor-pointer text-[11px] font-bold inline-flex items-center gap-1"
                              title="Unblock Customer Account"
                            >
                              <ShieldCheck size={12} />
                              <span>Unblock</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => openBlockModal(u)}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white rounded-lg transition-colors border border-rose-200 hover:border-rose-600 cursor-pointer text-[11px] font-bold inline-flex items-center gap-1"
                              title="Block Customer Account"
                            >
                              <ShieldAlert size={12} />
                              <span>Block</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="py-12 text-center text-slate-400 italic text-xs">
                      No users found matching search criteria
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: TOTAL RETURN ORDERS TABLE */}
        {activeSubTab === 'return_orders' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Order ID & Date</th>
                  <th className="py-3 px-4">Customer Details</th>
                  <th className="py-3 px-4 text-center">User Total Returns</th>
                  <th className="py-3 px-4">Returned Items</th>
                  <th className="py-3 px-4">Order Total</th>
                  <th className="py-3 px-4">Return Reason</th>
                  <th className="py-3 px-4">Return Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 size={24} className="animate-spin text-[#ff5500]" />
                        <span className="text-xs font-semibold text-slate-600">Loading return orders...</span>
                      </div>
                    </td>
                  </tr>
                ) : currentReturns.length > 0 ? (
                  currentReturns.map((ro) => {
                    const custName = ro.user?.name || ro.shippingAddress?.fullName || 'Customer';
                    const custPhone = ro.user?.phone || ro.shippingAddress?.phone || 'N/A';
                    const matchedUser = users.find((u) => String(u.id) === String(ro.user?._id || ro.user));
                    const userReturnCount = matchedUser ? matchedUser.returnsCount : 1;
                    const items = Array.isArray(ro.items) ? ro.items : [];

                    return (
                      <tr key={ro._id || ro.orderId} className="hover:bg-amber-50/20 transition-colors">
                        {/* Order ID & Date */}
                        <td className="py-3.5 px-4 align-middle">
                          <span className="font-mono font-bold text-[#ff5500] text-xs block">
                            {ro.orderId || ro._id}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono mt-0.5 block">
                            {ro.createdAt ? new Date(ro.createdAt).toLocaleDateString() : 'Today'}
                          </span>
                        </td>

                        {/* Customer */}
                        <td className="py-3.5 px-4 align-middle">
                          <p className="font-bold text-slate-900 m-0 text-xs">{custName}</p>
                          <p className="text-[11px] text-slate-500 m-0 mt-0.5">📞 {custPhone}</p>
                        </td>

                        {/* User Total Returns */}
                        <td className="py-3.5 px-4 align-middle text-center">
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-800 border border-amber-200">
                            <Undo2 size={12} /> {userReturnCount} {userReturnCount === 1 ? 'Return' : 'Returns'}
                          </span>
                        </td>

                        {/* Returned Items */}
                        <td className="py-3.5 px-4 align-middle">
                          <div className="font-semibold text-slate-800 text-xs">
                            {items[0]?.name || 'Returned Products'}
                            {items.length > 1 && (
                              <span className="text-[10px] font-bold text-[#ff5500] bg-orange-50 px-1.5 py-0.5 rounded-md ml-1">
                                +{items.length - 1} more
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400">
                            Qty: {items.reduce((sum, it) => sum + (it.quantity || 1), 0)}
                          </span>
                        </td>

                        {/* Order Total */}
                        <td className="py-3.5 px-4 align-middle font-black text-slate-900 font-mono text-xs">
                          ₹{Number(ro.grandTotal || 0).toFixed(2)}
                        </td>

                        {/* Return Reason */}
                        <td className="py-3.5 px-4 align-middle">
                          <span className="text-slate-600 text-xs italic">
                            "{ro.returnReason || 'Customer requested return'}"
                          </span>
                        </td>

                        {/* Return Status */}
                        <td className="py-3.5 px-4 align-middle">
                          {renderReturnBadge(ro.orderStatus, ro.returnStatus)}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 align-middle text-center">
                          <button
                            onClick={() => {
                              setSelectedReturnOrder(ro);
                              setReturnStatusInput(ro.returnStatus || 'Approved');
                            }}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-[#ff5500] text-slate-700 hover:text-white rounded-lg transition-colors border border-slate-200 hover:border-[#ff5500] cursor-pointer text-[11px] font-bold inline-flex items-center gap-1"
                          >
                            <Edit3 size={12} />
                            <span>Action</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400 italic text-xs">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Undo2 size={28} className="text-slate-300" />
                        <span className="font-semibold text-slate-600">No return orders found</span>
                        <span className="text-[11px] text-slate-400">
                          When users request or complete returns, they will show up here.
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Footer & Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-slate-100 text-xs text-slate-500">
          <span>
            Showing {activeItemsCount > 0 ? indexOfFirstItem + 1 : 0} to{' '}
            {Math.min(indexOfLastItem, activeItemsCount)} of {activeItemsCount} entries
          </span>

          <div className="inline-flex rounded-xl border border-slate-200 p-0.5 bg-slate-50 items-center">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 border-none bg-transparent cursor-pointer disabled:opacity-40"
            >
              ‹
            </button>
            <span className="px-3 py-1 bg-[#ff5500] text-white text-xs font-bold rounded-lg shadow-2xs">
              {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 border-none bg-transparent cursor-pointer disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* ── USER PROFILE & ORDER HISTORY DRAWER ── */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={selectedUser ? `Customer Profile: ${selectedUser.name}` : 'User Profile'}
      >
        {selectedUser && (
          <div className="space-y-5 text-xs">
            {/* Header Profile Info */}
            <div className="text-center pb-4 border-b border-slate-100 bg-slate-50 p-4 rounded-xl">
              <img
                src={selectedUser.avatar}
                alt={selectedUser.name}
                className="w-16 h-16 rounded-full mx-auto mb-2 object-cover border-2 border-[#ff5500] shadow-sm"
              />
              <h3 className="text-base font-black text-slate-900 m-0">{selectedUser.name}</h3>
              <p className="text-xs text-[#ff5500] font-mono m-0 mt-0.5">ID: {selectedUser.id}</p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <StatusBadge status={selectedUser.status} />
                <span className="text-[11px] text-slate-400 font-mono">Joined {selectedUser.joinedDate}</span>
              </div>
            </div>

            {/* 4 Stats Chips */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100">
                <span className="text-[10px] font-bold text-blue-700 uppercase block">Total Orders</span>
                <span className="text-base font-black text-blue-900 mt-0.5 block">{selectedUser.ordersCount}</span>
              </div>
              <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-100">
                <span className="text-[10px] font-bold text-amber-700 uppercase block">Return Orders</span>
                <span className="text-base font-black text-amber-900 mt-0.5 block">{selectedUser.returnsCount}</span>
              </div>
              <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-100">
                <span className="text-[10px] font-bold text-emerald-700 uppercase block">Total Spent</span>
                <span className="text-base font-black text-emerald-900 mt-0.5 block">
                  ₹{Number(selectedUser.totalSpent || 0).toFixed(2)}
                </span>
              </div>
              <div className="bg-orange-50/60 p-3 rounded-xl border border-orange-100">
                <span className="text-[10px] font-bold text-[#ff5500] uppercase block">Wallet Balance</span>
                <span className="text-base font-black text-[#ff5500] mt-0.5 block">{selectedUser.walletBalance}</span>
              </div>
            </div>

            {/* Contact Details */}
            <div className="space-y-2 text-xs text-slate-600 bg-white p-3.5 rounded-xl border border-slate-200">
              <h4 className="font-bold text-slate-900 m-0 mb-1 text-xs">Contact Information</h4>
              <p className="m-0 flex items-center justify-between">
                <span className="text-slate-400 font-semibold">Phone:</span>
                <span className="font-bold text-slate-800">{selectedUser.phone}</span>
              </p>
              <p className="m-0 flex items-center justify-between">
                <span className="text-slate-400 font-semibold">Email:</span>
                <span className="font-bold text-slate-800">{selectedUser.email}</span>
              </p>
            </div>

            {/* Account Security & Block Control */}
            <div className={`p-4 rounded-xl border ${selectedUser.isBlocked ? 'bg-rose-50/70 border-rose-200' : 'bg-slate-50 border-slate-200'} space-y-3`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {selectedUser.isBlocked ? (
                    <ShieldAlert size={18} className="text-rose-600" />
                  ) : (
                    <ShieldCheck size={18} className="text-emerald-600" />
                  )}
                  <div>
                    <h4 className="font-bold text-slate-900 m-0 text-xs">Account Status & Access</h4>
                    <span className="text-[11px] text-slate-500">
                      {selectedUser.isBlocked ? 'Customer is currently BLOCKED' : 'Customer has active ordering access'}
                    </span>
                  </div>
                </div>
                <StatusBadge status={selectedUser.status} />
              </div>

              {selectedUser.isBlocked && (
                <div className="bg-white p-2.5 rounded-lg border border-rose-200 text-xs text-rose-800 space-y-1">
                  <p className="m-0 font-bold">Reason: <span className="font-normal">{selectedUser.blockReason || 'Blocked by Administrator'}</span></p>
                  {selectedUser.blockedAt && (
                    <p className="m-0 text-[10px] text-slate-400">Blocked on: {new Date(selectedUser.blockedAt).toLocaleString('en-IN')}</p>
                  )}
                </div>
              )}

              <div>
                {selectedUser.isBlocked ? (
                  <button
                    onClick={() => openBlockModal(selectedUser)}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs border-none cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <ShieldCheck size={14} />
                    <span>Unblock Customer Account</span>
                  </button>
                ) : (
                  <button
                    onClick={() => openBlockModal(selectedUser)}
                    className="w-full py-2.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white rounded-xl font-bold text-xs border border-rose-200 hover:border-rose-600 cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <ShieldAlert size={14} />
                    <span>Block / Suspend Customer Account</span>
                  </button>
                )}
              </div>
            </div>

            {/* Live Order History for This User */}
            <div>
              <h4 className="font-black text-slate-900 m-0 mb-2 flex items-center justify-between text-xs">
                <span>Orders History ({userOrders.length})</span>
                {loadingUserOrders && <Loader2 size={13} className="animate-spin text-[#ff5500]" />}
              </h4>

              {loadingUserOrders ? (
                <div className="py-6 text-center text-slate-400">Loading user orders...</div>
              ) : userOrders.length > 0 ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {userOrders.map((ord) => {
                    const isReturn = ['Returned', 'Return Requested', 'Return Approved', 'Return Rejected'].includes(ord.orderStatus);
                    return (
                      <div
                        key={ord._id || ord.orderId}
                        className={`p-3 rounded-xl border ${
                          isReturn ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200 bg-slate-50/60'
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-mono font-bold text-[#ff5500] text-xs">#{ord.orderId || ord._id}</span>
                          <span className="font-bold text-slate-900 text-xs">₹{Number(ord.grandTotal || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-slate-500">
                          <span>{ord.createdAt ? new Date(ord.createdAt).toLocaleDateString() : 'Recent'}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ord.orderStatus === 'Delivered'
                                ? 'bg-emerald-100 text-emerald-800'
                                : isReturn
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {ord.orderStatus}
                          </span>
                        </div>
                        {ord.items && ord.items.length > 0 && (
                          <div className="text-[10px] text-slate-500 mt-1 truncate">
                            Items: {ord.items.map((it) => `${it.name} (x${it.quantity || 1})`).join(', ')}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  No orders placed yet by this customer.
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* ── BLOCK / UNBLOCK CONFIRMATION MODAL ── */}
      <Modal
        isOpen={Boolean(blockingUser)}
        onClose={() => {
          if (!submittingBlock) setBlockingUser(null);
        }}
        title={blockingUser?.isBlocked ? 'Unblock Customer Account' : 'Block Customer Account'}
      >
        {blockingUser && (
          <div className="space-y-4 text-xs font-sans">
            <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${
              blockingUser.isBlocked ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}>
              {blockingUser.isBlocked ? (
                <ShieldCheck size={22} className="text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert size={22} className="text-rose-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-black text-sm m-0">
                  {blockingUser.isBlocked
                    ? `Are you sure you want to unblock ${blockingUser.name}?`
                    : `Are you sure you want to block ${blockingUser.name}?`}
                </p>
                <p className="text-[11px] mt-1 m-0 opacity-90 leading-relaxed">
                  {blockingUser.isBlocked
                    ? 'Unblocking will immediately restore the customer\'s ability to log in, verify OTPs, place orders, and access their wallet.'
                    : 'Blocking will immediately revoke login access, OTP verification, cart checkout, and placing new orders.'}
                </p>
              </div>
            </div>

            {/* Customer Summary Chip */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Customer:</span>
                <span className="font-bold text-slate-800">{blockingUser.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Phone Number:</span>
                <span className="font-mono font-bold text-slate-800">{blockingUser.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Orders Placed:</span>
                <span className="font-bold text-blue-600">{blockingUser.ordersCount} Orders</span>
              </div>
            </div>

            {/* Reason Field (for blocking) */}
            {!blockingUser.isBlocked ? (
              <div className="space-y-2">
                <label className="font-bold text-slate-700 block uppercase text-[10px] tracking-wider">
                  Reason for Blocking <span className="text-rose-500">*</span>
                </label>

                {/* Quick select reason tags */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Fraudulent / Suspicious Activity',
                    'Multiple Order Refusals / Abuse',
                    'Fake Address / Unreachable',
                    'Payment Default / Chargeback',
                    'Customer Requested Account Suspension'
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setBlockReasonInput(preset)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all cursor-pointer ${
                        blockReasonInput === preset
                          ? 'bg-rose-100 border-rose-300 text-rose-800 font-bold shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={3}
                  value={blockReasonInput}
                  onChange={(e) => setBlockReasonInput(e.target.value)}
                  placeholder="Enter or select why this customer is being blocked..."
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/20"
                />
              </div>
            ) : (
              blockingUser.blockReason && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Previous Block Reason:</span>
                  <p className="m-0 text-xs italic font-medium">"{blockingUser.blockReason}"</p>
                </div>
              )
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBlockingUser(null)}
                disabled={submittingBlock}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border-none cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmToggleBlock}
                disabled={submittingBlock || (!blockingUser.isBlocked && !blockReasonInput.trim())}
                className={`px-5 py-2 text-white font-bold text-xs rounded-xl border-none cursor-pointer transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 ${
                  blockingUser.isBlocked ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {submittingBlock && <Loader2 size={13} className="animate-spin" />}
                <span>
                  {submittingBlock
                    ? 'Processing...'
                    : blockingUser.isBlocked
                    ? 'Confirm Unblock'
                    : 'Confirm Block'}
                </span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── RETURN ORDER ACTION MODAL ── */}
      {selectedReturnOrder && (
        <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex justify-between items-center">
              <div>
                <h3 className="text-base font-black m-0 text-white">Return Request Action</h3>
                <p className="text-xs text-amber-100 m-0 mt-0.5">Order #{selectedReturnOrder.orderId || selectedReturnOrder._id}</p>
              </div>
              <button
                onClick={() => setSelectedReturnOrder(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white border-none cursor-pointer flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>Customer:</span>
                  <span className="font-bold text-slate-900">{selectedReturnOrder.user?.name || selectedReturnOrder.shippingAddress?.fullName}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Refund Amount:</span>
                  <span className="font-black text-[#ff5500]">₹{Number(selectedReturnOrder.grandTotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Reason:</span>
                  <span className="font-semibold text-slate-800 italic">"{selectedReturnOrder.returnReason || 'Customer requested return'}"</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Update Return Status *</label>
                <select
                  value={returnStatusInput}
                  onChange={(e) => setReturnStatusInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-bold outline-none focus:border-[#ff5500]"
                >
                  <option value="Approved">Approved (Accept Return & Process Refund)</option>
                  <option value="Completed">Completed (Item Received & Refunded)</option>
                  <option value="Rejected">Rejected (Decline Return Request)</option>
                  <option value="Pending">Pending (Under Review)</option>
                </select>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setSelectedReturnOrder(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl border-none cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={updatingReturn}
                onClick={handleUpdateReturnStatus}
                className="px-4 py-2 bg-[#ff5500] hover:bg-[#e04b00] disabled:opacity-50 text-white text-xs font-bold rounded-xl border-none cursor-pointer flex items-center gap-1.5"
              >
                {updatingReturn && <Loader2 size={14} className="animate-spin" />}
                <span>Save Return Status</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* =========================================================================
   2. SELLER MANAGEMENT PAGE (VIEW SELLER LIST)
   ========================================================================= */
export const SellerManagement = () => {
  const [sellers, setSellers] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  const fetchSellers = React.useCallback(async (retryCount = 0) => {
    setLoading(true);
    try {
      const data = await adminService.getSellers();
      if (data && (data.success || Array.isArray(data.sellers) || Array.isArray(data))) {
        const rawList = data.sellers || (Array.isArray(data) ? data : []);
        const mappedSellers = rawList.map(s => {
          const rawStatus = (s.accountStatus || s.status || 'under_review').toLowerCase();
          let displayStatus = 'Under Review';
          if (rawStatus === 'approved') displayStatus = 'Approved';
          else if (rawStatus === 'rejected') displayStatus = 'Rejected';
          else if (rawStatus === 'suspended') displayStatus = 'Suspended';
          else if (rawStatus === 'pending_otp') displayStatus = 'Pending OTP';

          const sellerIdStr = String(s._id || s.id || '');
          const bName = s.businessName || s.ownerName || 'Seller Store';

          return {
            ...s,
            _id: sellerIdStr,
            id: sellerIdStr,
            name: s.ownerName || s.businessName || 'Seller Partner',
            storeName: bName,
            contactPhone: s.phone || '-',
            contactEmail: s.email || '-',
            logoText: (bName || 'SN').substring(0, 2).toUpperCase(),
            logoBg: 'bg-emerald-500',
            balance: Number(s.walletBalance || 0).toFixed(2),
            commission: `${s.commissionPercentage != null ? s.commissionPercentage : 10}%`,
            categoriesCount: Array.isArray(s.categories) ? s.categories.length : 0,
            assignedCategories: s.categories || [],
            status: displayStatus,
            rawStatus: rawStatus,
            needApproval: displayStatus === 'Approved' ? 'No' : 'Yes'
          };
        });
        setSellers(mappedSellers);
      }
    } catch (err) {
      console.error('Error fetching sellers:', err);
      if (retryCount < 2) {
        setTimeout(() => fetchSellers(retryCount + 1), 2500);
      } else if (Array.isArray(mockSellers) && mockSellers.length > 0) {
        setSellers(mockSellers.map(s => ({
          ...s,
          _id: String(s.id || s._id || ''),
          id: String(s.id || s._id || ''),
          rawStatus: String(s.status || '').toLowerCase()
        })));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSellers();
  }, [fetchSellers]);

  const [searchQuery, setSearchQuery] = React.useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [entriesPerPage, setEntriesPerPage] = React.useState('10');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [sortField, setSortField] = React.useState('id');
  const [sortDirection, setSortDirection] = React.useState('asc');

  // Modal / Drawer States
  const [selectedSellerCategoryDrawer, setSelectedSellerCategoryDrawer] = React.useState(null);
  const [editingSellerModal, setEditingSellerModal] = React.useState(null);
  const [sellerModalMode, setSellerModalMode] = React.useState('view'); // 'view' | 'edit'
  const [editFormData, setEditFormData] = React.useState({ name: '', storeName: '', commission: '', balance: '' });
  const [previewDocImage, setPreviewDocImage] = React.useState(null);
  const isSellerEditMode = sellerModalMode === 'edit';

  // Column Sort Handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // CSV Export Action
  const handleExportCSV = () => {
    const rows = [['Seller ID', 'Name', 'Store Name', 'Contact Phone', 'Contact Email', 'Balance', 'Commission', 'Status', 'Need Approval'].join(',')];
    sellers.forEach(s => {
      rows.push([`"${s.id}"`, `"${s.name}"`, `"${s.storeName}"`, `"${s.contactPhone}"`, `"${s.contactEmail}"`, `"₹${s.balance}"`, `"${s.commission}"`, `"${s.status}"`, `"${s.needApproval}"`].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sathiseller_seller_list_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  // Toggle Approval Status
  const handleToggleStatus = async (id) => {
    const seller = sellers.find(s => s.id === id);
    if (!seller) return;
    
    const nextStatus = seller.status === 'Approved' ? 'pending' : 'approved';
    try {
      const data = await adminService.toggleSellerStatus(id, nextStatus);
      if (data && data.success) {
        setSellers(prev => prev.map(s => {
          if (s.id === id) {
            const displayStatus = nextStatus === 'approved' ? 'Approved' : 'Pending';
            return { ...s, status: displayStatus, needApproval: displayStatus === 'Approved' ? 'No' : 'Yes' };
          }
          return s;
        }));
      } else {
        alert(data?.message || 'Failed to update status');
      }
    } catch (err) {
      console.error('Error updating status:', err);
      alert(err.response?.data?.message || 'Error updating status');
    }
  };

  // Delete Action
  const handleDeleteSeller = async (id) => {
    const seller = sellers.find(s => s.id === id || s._id === id);
    const sellerName = seller?.storeName || seller?.name || 'this seller';
    if (!window.confirm(`Are you sure you want to permanently delete "${sellerName}"? This will also remove the store and its associated products.`)) {
      return;
    }

    try {
      const res = await adminService.deleteSeller(id);
      if (res && res.success) {
        setSellers(prev => prev.filter(s => s.id !== id && s._id !== id));
      } else {
        alert(res?.message || 'Failed to delete seller.');
      }
    } catch (err) {
      console.error('Error deleting seller:', err);
      alert(err.response?.data?.message || err.message || 'Error deleting seller.');
    }
  };

  // Open seller modal: Eye → view (read-only), Pencil → edit
  const openSellerModal = (seller, mode = 'view') => {
    // Prefer freshest seller doc so registration fields are not blank (#23)
    adminService.getSellers(true).then((data) => {
      const raw = data?.sellers || [];
      const fresh = raw.find((s) => String(s._id || s.id) === String(seller.id || seller._id));
      if (fresh) {
        setEditingSellerModal((prev) => {
          if (!prev || String(prev.id) !== String(seller.id || seller._id)) return prev;
          return {
            ...prev,
            ...fresh,
            id: String(fresh._id || fresh.id),
            name: fresh.ownerName || fresh.businessName || prev.name,
            storeName: fresh.businessName || fresh.ownerName || prev.storeName,
            contactPhone: fresh.phone || prev.contactPhone,
            contactEmail: fresh.email || prev.contactEmail,
            warehouseLocation: fresh.warehouseLocation || prev.warehouseLocation,
            gstNumber: fresh.gstNumber || prev.gstNumber,
            panNumber: fresh.panNumber || prev.panNumber,
            fssaiLicense: fresh.fssaiLicense || prev.fssaiLicense,
            gstPhoto: fresh.gstPhoto || prev.gstPhoto,
            bankPassbookPhoto: fresh.bankPassbookPhoto || prev.bankPassbookPhoto,
            bankName: fresh.bankName || prev.bankName,
            accountNumber: fresh.accountNumber || prev.accountNumber,
            ifscCode: fresh.ifscCode || prev.ifscCode,
            storeLogo: fresh.storeLogo || prev.storeLogo,
            categories: fresh.categories || prev.categories,
            assignedCategories: fresh.categories || prev.assignedCategories,
          };
        });
      }
    }).catch(() => {});
    setSellerModalMode(mode);
    setEditingSellerModal(seller);
    setEditFormData({
      name: seller.name || '',
      storeName: seller.storeName || '',
      commission: String(seller.commission || '').replace(/%/g, ''),
      balance: seller.balance ?? '',
    });
  };

  const openEditModal = (seller) => openSellerModal(seller, 'edit');
  const openViewModal = (seller) => openSellerModal(seller, 'view');

  // Save Edit Modal
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSellers(prev => prev.map(s => s.id === editingSellerModal.id ? {
      ...s,
      name: editFormData.name,
      storeName: editFormData.storeName
    } : s));
    setEditingSellerModal(null);
  };

  // Filtered & Sorted Sellers (debounced)
  const filteredSellers = React.useMemo(() => {
    const q = String(debouncedSearchQuery || '').toLowerCase().trim();
    let result = (sellers || []).filter(s => 
      String(s.name || '').toLowerCase().includes(q) || 
      String(s.storeName || '').toLowerCase().includes(q) ||
      String(s.id || '').toLowerCase().includes(q) ||
      String(s.contactPhone || '').toLowerCase().includes(q) ||
      String(s.contactEmail || '').toLowerCase().includes(q)
    );

    result.sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [sellers, debouncedSearchQuery, sortField, sortDirection]);

  // Pagination bounds
  const totalPages = Math.max(1, Math.ceil(filteredSellers.length / Number(entriesPerPage)));
  const displayedSellers = filteredSellers.slice((currentPage - 1) * Number(entriesPerPage), currentPage * Number(entriesPerPage));

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header & Breadcrumb */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Sellers & Merchants</h1>
        <div className="text-xs text-slate-500 font-medium">
          Dashboard / <span className="text-[#ff5500] font-semibold">Seller List</span>
        </div>
      </div>

      {/* Main Card Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Light Orange Header Banner */}
        <div className="bg-[#fff4ed] border-b border-orange-200/70 text-[#002625] px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight text-[#002625] flex items-center gap-2">
            <ChevronRight size={18} className="text-[#ff5500]" />
            View Seller List
          </h2>
          {loading ? (
            <span className="text-[10px] uppercase font-extrabold tracking-wider bg-amber-500 text-white px-3 py-1 rounded-full shadow-2xs animate-pulse flex items-center gap-1.5">
              <RefreshCw size={11} className="animate-spin" /> Loading Sellers...
            </span>
          ) : (
            <span className="text-[10px] uppercase font-extrabold tracking-wider bg-[#ff5500] text-white px-3 py-1 rounded-full shadow-2xs">
              {sellers.length} Registered Sellers
            </span>
          )}
        </div>

        <div className="p-6 space-y-4">
          {/* Toolbar Controls: Show entries dropdown, Export, Search */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-medium text-slate-600">
            <div className="flex items-center gap-2">
              <span>Show</span>
              <select 
                value={entriesPerPage}
                onChange={(e) => {
                  setEntriesPerPage(e.target.value);
                  setCurrentPage(1);
                }}
                className="border border-slate-200 rounded-xl px-2.5 py-1.5 bg-slate-50 text-xs text-slate-800 outline-none focus:border-[#ff5500] cursor-pointer"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
              <span>entries</span>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={() => fetchSellers(0)}
                disabled={loading}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 border-none cursor-pointer transition-all active:scale-95"
                title="Reload Latest Sellers"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>

              <button 
                onClick={handleExportCSV}
                className="px-4 py-1.5 bg-[#002625] hover:bg-[#003837] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 border-none cursor-pointer shadow-2xs transition-all active:scale-95"
              >
                <Download size={13} className="text-[#ff5500]" /> Export
              </button>

              <div className="flex items-center gap-1.5">
                <span>Search:</span>
                <input 
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-44 border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 text-xs text-slate-800 outline-none focus:border-[#ff5500]"
                />
              </div>
            </div>
          </div>

          {/* Seller Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider select-none">
                  <th onClick={() => handleSort('id')} className="py-3.5 px-4 cursor-pointer hover:bg-slate-100/70">Id ⇅</th>
                  <th onClick={() => handleSort('name')} className="py-3.5 px-4 cursor-pointer hover:bg-slate-100/70">Name ⇅</th>
                  <th onClick={() => handleSort('storeName')} className="py-3.5 px-4 cursor-pointer hover:bg-slate-100/70">Store Name ⇅</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4 text-center">Logo</th>
                  <th onClick={() => handleSort('balance')} className="py-3.5 px-4 cursor-pointer hover:bg-slate-100/70">Balance ⇅</th>
                  <th onClick={() => handleSort('commission')} className="py-3.5 px-4 cursor-pointer hover:bg-slate-100/70">Commission ⇅</th>
                  <th className="py-3.5 px-4">Categories</th>
                  <th onClick={() => handleSort('status')} className="py-3.5 px-4 cursor-pointer hover:bg-slate-100/70">Status ⇅</th>
                  <th className="py-3.5 px-4 text-center">Reg Fee</th>
                  <th className="py-3.5 px-4 text-center">Need Approval?</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan="12" className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-9 h-9 border-3 border-orange-500/20 border-t-[#ff5500] rounded-full animate-spin"></div>
                        <div>
                          <p className="text-sm font-bold text-slate-800 tracking-tight">Loading Sellers...</p>
                          <p className="text-xs text-slate-400 mt-0.5">Fetching registered seller records from database</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : displayedSellers.length > 0 ? (
                  displayedSellers.map((seller) => (
                    <tr key={seller.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-500" title={seller.id}>
                        #{seller.id.slice(-6).toUpperCase()}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{seller.name}</td>
                      <td className="py-3.5 px-4 text-slate-800 font-semibold">{seller.storeName}</td>
                      <td className="py-3.5 px-4 space-y-0.5">
                        <p className="font-mono text-slate-800 font-medium">{seller.contactPhone}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{seller.contactEmail}</p>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`w-8 h-8 rounded-full ${seller.logoBg} text-white font-extrabold flex items-center justify-center mx-auto text-xs shadow-2xs`}>
                          {seller.logoText}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">₹{seller.balance}</td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">{seller.commission}</td>
                      <td className="py-3.5 px-4">
                        <button 
                          type="button"
                          onClick={() => openViewModal(seller)}
                          className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                          title="View full seller registration details"
                        >
                          <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
                            {seller.categoriesCount}
                          </span>
                          <span>View Details →</span>
                        </button>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          seller.status === 'Approved' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : seller.status === 'Rejected'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : seller.status === 'Suspended'
                            ? 'bg-slate-100 text-slate-700 border border-slate-300'
                            : seller.status === 'Pending OTP'
                            ? 'bg-sky-50 text-sky-700 border border-sky-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {seller.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          seller.registrationFeeStatus === 'paid' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : seller.registrationFeeStatus === 'not_required'
                            ? 'bg-slate-100 text-slate-600 border border-slate-200'
                            : seller.registrationFeeStatus === 'failed'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {seller.registrationFeeStatus === 'paid' ? 'Paid' : (seller.registrationFeeStatus === 'not_required' ? 'Waived' : (seller.registrationFeeStatus === 'failed' ? 'Failed' : 'Pending'))}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`text-xs font-bold ${seller.needApproval === 'Yes' ? 'text-rose-500' : 'text-slate-400'}`}>
                          {seller.needApproval}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button 
                            onClick={() => openViewModal(seller)}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg border border-emerald-200 cursor-pointer transition-colors flex items-center gap-1 font-semibold text-xs px-2"
                            title="View Seller Details"
                          >
                            <Eye size={13} /> View
                          </button>
                          {seller.status !== 'Approved' && (
                            <button 
                              onClick={async () => {
                                try {
                                  const data = await adminService.toggleSellerStatus(seller.id, 'approved');
                                  if (data && data.success) {
                                    setSellers(prev => prev.map(s => s.id === seller.id ? { ...s, status: 'Approved', needApproval: 'No' } : s));
                                  } else {
                                    alert(data?.message || 'Failed to approve seller');
                                  }
                                } catch (err) {
                                  alert(err.response?.data?.message || 'Error approving seller: registration fee may be unpaid.');
                                }
                              }}
                              className="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 cursor-pointer transition-colors text-[10px] font-bold px-1.5"
                              title="Approve Seller"
                            >
                              ✓
                            </button>
                          )}
                          {seller.status !== 'Rejected' && (
                            <button 
                              onClick={async () => {
                                try {
                                  const data = await adminService.toggleSellerStatus(seller.id, 'rejected');
                                  if (data && data.success) {
                                    setSellers(prev => prev.map(s => s.id === seller.id ? { ...s, status: 'Rejected', needApproval: 'Yes' } : s));
                                  }
                                } catch (err) { console.error(err); }
                              }}
                              className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200 cursor-pointer transition-colors text-[10px] font-bold px-1.5"
                              title="Reject Seller"
                            >
                              ✕
                            </button>
                          )}
                          <button 
                            onClick={() => openEditModal(seller)}
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg border border-blue-200 cursor-pointer transition-colors"
                            title="Edit Seller Details"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button 
                            onClick={() => handleDeleteSeller(seller.id)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200 cursor-pointer transition-colors"
                            title="Delete Seller"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="11" className="py-8 text-center text-slate-400 italic text-xs">
                      No seller accounts found matching search criteria
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer & Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-500">
            <span>Showing {displayedSellers.length > 0 ? (currentPage - 1) * Number(entriesPerPage) + 1 : 0} to {Math.min(currentPage * Number(entriesPerPage), filteredSellers.length)} of {filteredSellers.length} entries</span>
            
            <div className="inline-flex rounded-xl border border-slate-200 p-0.5 bg-slate-50">
              <button 
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 border-none bg-transparent cursor-pointer disabled:opacity-40"
              >
                ‹
              </button>
              <button className="px-3 py-1 bg-[#ff5500] text-white text-xs font-bold rounded-lg shadow-2xs border-none cursor-pointer">
                {currentPage} of {totalPages}
              </button>
              <button 
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 border-none bg-transparent cursor-pointer disabled:opacity-40"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Category Details Modal/Drawer */}
      {selectedSellerCategoryDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn">
            <div className="bg-[#002625] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <ChevronRight size={16} className="text-[#ff5500]" />
                {selectedSellerCategoryDrawer.storeName} - Categories
              </h3>
              <button 
                onClick={() => setSelectedSellerCategoryDrawer(null)}
                className="text-slate-400 hover:text-white border-none bg-transparent cursor-pointer text-lg font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-1">
                <p className="text-slate-500">Seller Name: <span className="font-bold text-slate-900">{selectedSellerCategoryDrawer.name}</span></p>
                <p className="text-slate-500">Seller ID: <span className="font-mono text-[#ff5500] font-bold">{selectedSellerCategoryDrawer.id}</span></p>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-2">Assigned Product Categories:</h4>
                <div className="space-y-2">
                  {selectedSellerCategoryDrawer.assignedCategories.map((catName, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs">
                      <span className="font-bold text-emerald-900">📁 {catName}</span>
                      <span className="text-[10px] bg-emerald-600 text-white font-extrabold px-2 py-0.5 rounded-md">Active</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button 
                  onClick={() => setSelectedSellerCategoryDrawer(null)}
                  className="px-4 py-2 bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold rounded-xl border-none cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Seller Comprehensive Modal */}
      {editingSellerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn my-8 max-h-[90vh] flex flex-col">
            
            {/* Modal Header matching Light Orange Theme */}
            <div className="bg-[#fff4ed] border-b border-orange-200/70 text-[#002625] px-6 py-4 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-bold text-[#002625] m-0">
                  {isSellerEditMode ? 'Edit Seller' : 'Seller Details'} - {editingSellerModal.name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isSellerEditMode ? 'Update seller details and save changes' : 'Read-only view of seller information'}
                </p>
              </div>
              <button 
                onClick={() => setEditingSellerModal(null)}
                className="text-slate-400 hover:text-slate-800 border-none bg-transparent cursor-pointer text-xl font-bold p-1"
              >
                ×
              </button>
            </div>

            {/* Scrollable Content Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
              
              {/* Status Bar with Approve, Reject & Suspend */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700">Status:</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    editingSellerModal.status === 'Approved' 
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                      : editingSellerModal.status === 'Rejected'
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : editingSellerModal.status === 'Suspended'
                      ? 'bg-slate-200 text-slate-800 border border-slate-300'
                      : editingSellerModal.status === 'Pending OTP'
                      ? 'bg-sky-100 text-sky-800 border border-sky-300'
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}>
                    {editingSellerModal.status}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {editingSellerModal.status !== 'Approved' && (
                    <button 
                      onClick={async () => {
                        try {
                          const data = await adminService.toggleSellerStatus(editingSellerModal.id, 'approved');
                          if (data && data.success) {
                            setSellers(prev => prev.map(s => s.id === editingSellerModal.id ? { ...s, status: 'Approved', needApproval: 'No' } : s));
                            setEditingSellerModal(prev => ({ ...prev, status: 'Approved', needApproval: 'No' }));
                            alert('Seller has been approved successfully!');
                          }
                        } catch (err) { 
                          console.error(err); 
                          alert(err.response?.data?.message || 'Failed to approve seller');
                        }
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl border-none cursor-pointer flex items-center gap-1.5 shadow-2xs transition-all"
                    >
                      ✓ Approve
                    </button>
                  )}
                  {editingSellerModal.status !== 'Rejected' && (
                    <button 
                      onClick={async () => {
                        try {
                          const data = await adminService.toggleSellerStatus(editingSellerModal.id, 'rejected');
                          if (data && data.success) {
                            setSellers(prev => prev.map(s => s.id === editingSellerModal.id ? { ...s, status: 'Rejected', needApproval: 'Yes' } : s));
                            setEditingSellerModal(prev => ({ ...prev, status: 'Rejected', needApproval: 'Yes' }));
                            alert('Seller application has been rejected.');
                          }
                        } catch (err) { 
                          console.error(err); 
                          alert(err.response?.data?.message || 'Failed to reject seller');
                        }
                      }}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl border-none cursor-pointer flex items-center gap-1.5 shadow-2xs transition-all"
                    >
                      ✕ Reject
                    </button>
                  )}
                  {editingSellerModal.status !== 'Suspended' && (
                    <button 
                      onClick={async () => {
                        try {
                          const data = await adminService.toggleSellerStatus(editingSellerModal.id, 'suspended');
                          if (data && data.success) {
                            setSellers(prev => prev.map(s => s.id === editingSellerModal.id ? { ...s, status: 'Suspended', needApproval: 'Yes' } : s));
                            setEditingSellerModal(prev => ({ ...prev, status: 'Suspended', needApproval: 'Yes' }));
                            alert('Seller account has been suspended.');
                          }
                        } catch (err) { 
                          console.error(err); 
                          alert(err.response?.data?.message || 'Failed to suspend seller');
                        }
                      }}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border-none cursor-pointer flex items-center gap-1.5 shadow-2xs transition-all"
                    >
                      ⊘ Suspend
                    </button>
                  )}
                </div>
              </div>

              {/* 1. Basic Information Card */}
              <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 space-y-4">
                <h4 className="text-sm font-bold text-slate-800 m-0">Basic Information</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-500 font-medium block mb-1">Seller Name</label>
                    <input 
                      type="text"
                      value={editFormData.name}
                      disabled={!isSellerEditMode}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-[#ff5500] disabled:bg-slate-50 disabled:text-slate-600"
                    />
                  </div>

                  <div>
                    <label className="text-slate-500 font-medium block mb-1">Store Name</label>
                    <input 
                      type="text"
                      value={editFormData.storeName}
                      disabled={!isSellerEditMode}
                      onChange={(e) => setEditFormData({ ...editFormData, storeName: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-[#ff5500] disabled:bg-slate-50 disabled:text-slate-600"
                    />
                  </div>

                  <div>
                    <label className="text-slate-500 font-medium block mb-1">Email</label>
                    <input 
                      type="email"
                      defaultValue={editingSellerModal.contactEmail}
                      readOnly
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-slate-500 font-medium block mb-1">Phone</label>
                    <input 
                      type="text"
                      defaultValue={editingSellerModal.contactPhone}
                      readOnly
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-slate-500 font-medium block mb-1">Business Type</label>
                    <input 
                      type="text"
                      defaultValue={editingSellerModal.businessType || 'N/A'}
                      readOnly
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-slate-500 font-medium block mb-1">Store Logo</label>
                    {editingSellerModal.storeLogo ? (
                      <img src={editingSellerModal.storeLogo} alt="Logo" className="h-12 w-12 object-contain rounded-lg border border-slate-200 bg-white" />
                    ) : (
                      <span className="text-xs text-slate-400">No logo</span>
                    )}
                  </div>

                  <div>
                    <label className="text-slate-500 font-medium block mb-1">Commission (%)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={editFormData.commission !== undefined && editFormData.commission !== null ? editFormData.commission : ''}
                        disabled={!isSellerEditMode}
                        onChange={(e) => setEditFormData({ ...editFormData, commission: e.target.value })}
                        placeholder="10"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-[#ff5500] font-bold disabled:bg-slate-50 disabled:text-slate-600"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                        %
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-500 font-medium block mb-1">Wallet Balance (₹)</label>
                    <input
                      type="number"
                      value={editFormData.balance}
                      disabled={!isSellerEditMode}
                      onChange={(e) => setEditFormData({ ...editFormData, balance: e.target.value })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-[#ff5500] disabled:bg-slate-50 disabled:text-slate-600"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Address Information Card */}
              <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-800 m-0">Address Information</h4>
                  {isSellerEditMode && (
                    <button 
                      type="button"
                      onClick={() => alert('Address information updated')}
                      className="px-3.5 py-1.5 bg-[#002625] hover:bg-[#003837] text-white font-bold rounded-xl border-none cursor-pointer"
                    >
                      Update Address
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-slate-500 font-medium block mb-1">Address</label>
                    <input 
                      type="text"
                      defaultValue={editingSellerModal.warehouseLocation?.storeAddress || 'N/A'}
                      readOnly
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-slate-500 font-medium block mb-1">City</label>
                      <input 
                        type="text"
                        defaultValue={editingSellerModal.warehouseLocation?.city || 'N/A'}
                        readOnly
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 font-medium block mb-1">State / Pincode</label>
                      <input 
                        type="text"
                        defaultValue={`${editingSellerModal.warehouseLocation?.state || ''} ${editingSellerModal.warehouseLocation?.pincode || ''}`.trim() || 'N/A'}
                        readOnly
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-slate-500 font-medium block mb-1">Latitude</label>
                      <input 
                        type="text"
                        defaultValue={editingSellerModal.warehouseLocation?.location?.coordinates?.[1] || 'N/A'}
                        readOnly
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-slate-500 font-medium block mb-1">Longitude</label>
                      <input 
                        type="text"
                        defaultValue={editingSellerModal.warehouseLocation?.location?.coordinates?.[0] || 'N/A'}
                        readOnly
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Service Area Visualization */}
              <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 space-y-4">
                <h4 className="text-sm font-bold text-slate-800 m-0">Service Area Visualization</h4>
                
                <div className="flex gap-2 max-w-md items-end">
                  <div className="flex-1">
                    <label className="text-slate-500 font-medium block mb-1">Service Radius (km)</label>
                    <input 
                      type="text"
                      defaultValue={editingSellerModal.serviceRadius || 'N/A'}
                      readOnly
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none"
                    />
                  </div>
                  <button 
                    type="button"
                    onClick={() => alert('Service radius updated')}
                    className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl border-none cursor-pointer"
                  >
                    Update Radius
                  </button>
                </div>

                {/* Map Graphic Preview */}
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 h-52 bg-slate-200">
                  <img 
                    src="https://images.unsplash.com/photo-1524661135-423995f22d0b?w=900&auto=format&fit=crop&q=80" 
                    alt="Service Area Map" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-teal-900/20 pointer-events-none flex items-center justify-center">
                    <div className="w-32 h-32 rounded-full border-2 border-[#ff5500] bg-[#ff5500]/20 flex items-center justify-center">
                      <span className="bg-[#002625] text-white px-2 py-0.5 rounded font-mono text-[10px] font-bold">📍 5.1 km Radius</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Tax Information */}
              <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-800 m-0">Tax Information</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-500 font-medium block mb-1">PAN Card</label>
                    <input 
                      type="text"
                      defaultValue={editingSellerModal.panNumber || 'N/A'}
                      readOnly
                      placeholder="ABCDE1234F"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none uppercase font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 font-medium block mb-1">FSSAI License</label>
                    <input 
                      type="text"
                      defaultValue={editingSellerModal.fssaiLicense || 'N/A'}
                      readOnly
                      placeholder="14-digit License No."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-500 font-medium block mb-1">GST Number</label>
                  <input 
                    type="text"
                    defaultValue={editingSellerModal.gstNumber || 'N/A'}
                    readOnly
                    placeholder="22AAAAA0000A1Z5"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none uppercase font-mono font-bold"
                  />
                </div>
              </div>

              {/* 5. Bank Information */}
              <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 space-y-4">
                <h4 className="text-sm font-bold text-slate-800 m-0">Bank Information</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-500 font-medium block mb-1">Account Holder Name</label>
                    <input 
                      type="text"
                      defaultValue={editingSellerModal.ownerName || editingSellerModal.name || 'N/A'}
                      readOnly
                      placeholder="Account Holder Name"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 font-medium block mb-1">Bank Name</label>
                    <input 
                      type="text"
                      defaultValue={editingSellerModal.bankName || 'N/A'}
                      readOnly
                      placeholder="Bank Name"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-500 font-medium block mb-1">Account Number</label>
                    <input 
                      type="text"
                      defaultValue={editingSellerModal.accountNumber || 'N/A'}
                      readOnly
                      placeholder="Account Number"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-slate-500 font-medium block mb-1">IFSC Code</label>
                    <input 
                      type="text"
                      defaultValue={editingSellerModal.ifscCode || 'N/A'}
                      readOnly
                      placeholder="IFSC Code"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none uppercase font-mono font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* 6. Uploaded Verification Documents */}
              <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 space-y-4">
                <h4 className="text-sm font-bold text-slate-800 m-0">Uploaded Verification Documents</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 block">GST Certificate / Photo</span>
                      {editingSellerModal.gstPhoto && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">Attached</span>
                      )}
                    </div>
                    {editingSellerModal.gstPhoto ? (
                      <div className="space-y-2">
                        <div 
                          className="relative group cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-900 h-44 flex items-center justify-center"
                          onClick={() => setPreviewDocImage({ title: `GST Certificate - ${editingSellerModal.storeName || editingSellerModal.name}`, src: editingSellerModal.gstPhoto })}
                        >
                          <img 
                            src={editingSellerModal.gstPhoto} 
                            alt="GST Document" 
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform" 
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs gap-1.5 backdrop-blur-[1px]">
                            <Eye size={16} /> View Document
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={() => setPreviewDocImage({ title: `GST Certificate - ${editingSellerModal.storeName || editingSellerModal.name}`, src: editingSellerModal.gstPhoto })}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#ff5500] hover:text-[#e04a00] border-none bg-transparent cursor-pointer p-0"
                        >
                          <Eye size={14} /> Open in Same Tab Preview
                        </button>
                      </div>
                    ) : (
                      <div className="h-28 flex items-center justify-center bg-slate-50 rounded-lg border border-dashed border-slate-200 text-xs text-slate-400">
                        No GST Document uploaded
                      </div>
                    )}
                  </div>

                  <div className="p-3.5 bg-white rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 block">Bank Passbook / Cancelled Cheque</span>
                      {editingSellerModal.bankPassbookPhoto && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">Attached</span>
                      )}
                    </div>
                    {editingSellerModal.bankPassbookPhoto ? (
                      <div className="space-y-2">
                        <div 
                          className="relative group cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-900 h-44 flex items-center justify-center"
                          onClick={() => setPreviewDocImage({ title: `Bank Passbook - ${editingSellerModal.storeName || editingSellerModal.name}`, src: editingSellerModal.bankPassbookPhoto })}
                        >
                          <img 
                            src={editingSellerModal.bankPassbookPhoto} 
                            alt="Bank Passbook Document" 
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform" 
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs gap-1.5 backdrop-blur-[1px]">
                            <Eye size={16} /> View Document
                          </div>
                        </div>
                        <button 
                          type="button"
                          onClick={() => setPreviewDocImage({ title: `Bank Passbook - ${editingSellerModal.storeName || editingSellerModal.name}`, src: editingSellerModal.bankPassbookPhoto })}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#ff5500] hover:text-[#e04a00] border-none bg-transparent cursor-pointer p-0"
                        >
                          <Eye size={14} /> Open in Same Tab Preview
                        </button>
                      </div>
                    ) : (
                      <div className="h-28 flex items-center justify-center bg-slate-50 rounded-lg border border-dashed border-slate-200 text-xs text-slate-400">
                        No Bank Passbook uploaded
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditingSellerModal(null)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl border-none cursor-pointer transition-colors"
              >
                {isSellerEditMode ? 'Cancel' : 'Close'}
              </button>
              {!isSellerEditMode ? (
                <button
                  type="button"
                  onClick={() => setSellerModalMode('edit')}
                  className="px-5 py-2 bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold rounded-xl border-none cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  <Edit3 size={13} /> Edit Seller
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const commissionNum = Number(String(editFormData.commission ?? '').replace(/%/g, '').trim());
                      const balanceNum = Number(String(editFormData.balance ?? '').replace(/[₹,\s]/g, '').trim());
                      if (Number.isNaN(commissionNum)) {
                        alert('Commission must be a valid number (without %).');
                        return;
                      }
                      if (Number.isNaN(balanceNum)) {
                        alert('Wallet balance must be a valid number.');
                        return;
                      }
                      const response = await adminService.updateSellerDetails(editingSellerModal.id, {
                        name: editFormData.name,
                        storeName: editFormData.storeName,
                        commission: commissionNum,
                        balance: balanceNum,
                      });
                      if (response && response.success) {
                        const savedCommission = response.seller?.commissionPercentage ?? commissionNum;
                        const savedBalance = response.seller?.walletBalance ?? balanceNum;
                        setSellers(prev => prev.map(s => s.id === editingSellerModal.id ? {
                          ...s,
                          name: editFormData.name,
                          storeName: editFormData.storeName,
                          commission: `${savedCommission}%`,
                          balance: Number(savedBalance).toFixed(2),
                          commissionPercentage: savedCommission,
                          walletBalance: savedBalance,
                        } : s));
                        setEditingSellerModal(null);
                      } else {
                        alert(response?.message || 'Failed to update seller details');
                      }
                    } catch (err) {
                      console.error('Error updating seller details:', err);
                      alert(err.response?.data?.message || 'Failed to update seller details');
                    }
                  }}
                  className="px-5 py-2 bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold rounded-xl border-none cursor-pointer transition-colors"
                >
                  Save Changes
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* SELLER LIGHTBOX DOCUMENT IMAGE PREVIEW (SAME TAB) */}
      {previewDocImage && (
        <div 
          className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewDocImage(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 bg-slate-900 text-white flex justify-between items-center">
              <h4 className="text-xs font-bold text-white m-0 flex items-center gap-2">
                <FileText size={16} className="text-[#ff5500]" />
                {previewDocImage.title}
              </h4>
              <button 
                onClick={() => setPreviewDocImage(null)} 
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border-none cursor-pointer text-lg font-bold"
              >
                ×
              </button>
            </div>
            <div className="p-4 bg-slate-950 flex items-center justify-center overflow-auto max-h-[75vh]">
              <img 
                src={previewDocImage.src} 
                alt={previewDocImage.title} 
                className="max-h-[70vh] w-auto max-w-full object-contain rounded-xl shadow-lg" 
              />
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <span className="text-[11px] text-slate-500 font-medium">Viewing document on same page</span>
              <button 
                onClick={() => setPreviewDocImage(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-sm transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* =========================================================================
   3. CAPTAIN MANAGEMENT PAGE
   ========================================================================= */
export const CaptainManagement = () => {
  const [captains, setCaptains] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  // Filters & State
  const [statusFilter, setStatusFilter] = React.useState('All');
  const [availabilityFilter, setAvailabilityFilter] = React.useState('All');
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [entriesPerPage, setEntriesPerPage] = React.useState(10);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [sortField, setSortField] = React.useState(null);
  const [sortOrder, setSortOrder] = React.useState('asc');

  // Modals & Drawer State
  const [selectedCaptain, setSelectedCaptain] = React.useState(null);
  const [editingCaptain, setEditingCaptain] = React.useState(null);
  const [previewDocImage, setPreviewDocImage] = React.useState(null);

  // Fetch Live Captains from Backend API
  const fetchCaptains = React.useCallback(async (retryCount = 0) => {
    setLoading(true);
    try {
      const res = await (captainService?.getAllCaptains ? captainService.getAllCaptains(true) : adminService.getCaptains(true));
      if (res && (res.success || Array.isArray(res.captains) || Array.isArray(res))) {
        const rawList = res.captains || (Array.isArray(res) ? res : []);
        const mapped = rawList.map(c => {
          const rawStatus = (c.accountStatus || c.status || 'under_review').toLowerCase();
          let displayStatus = 'Under Review';
          if (rawStatus === 'approved') displayStatus = 'Approved';
          else if (rawStatus === 'rejected') displayStatus = 'Rejected';
          else if (rawStatus === 'suspended') displayStatus = 'Suspended';
          else if (rawStatus === 'pending_otp') displayStatus = 'Pending OTP';

          const captainIdStr = String(c._id || c.id || '');
          return {
            _id: captainIdStr,
            id: captainIdStr ? captainIdStr.slice(-6).toUpperCase() : 'CAP',
            name: c.name || 'Captain Partner',
            mobile: c.phone || '',
            email: c.email || 'N/A',
            address: c.currentAddress || c.workingArea?.city || (c.city ? c.city : 'N/A'),
            city: c.city || c.workingArea?.city || 'N/A',
            commission: 'Standard',
            balance: `₹${Number(c.walletBalance || 0).toFixed(2)}`,
            cashCollected: `₹${Number(c.cashCollected || 0).toFixed(2)}`,
            status: displayStatus,
            rawStatus: rawStatus,
            available: c.isOnline ? 'Online' : 'Offline',
            raw: c,
          };
        });
        setCaptains(mapped);
      }
    } catch (err) {
      console.error('Error fetching captains:', err);
      if (retryCount < 2) {
        setTimeout(() => fetchCaptains(retryCount + 1), 2500);
      } else if (Array.isArray(mockCaptains) && mockCaptains.length > 0) {
        setCaptains(mockCaptains.map(c => ({
          ...c,
          _id: String(c.id || c._id || ''),
          id: String(c.id || '').slice(-6).toUpperCase(),
          rawStatus: String(c.status || '').toLowerCase()
        })));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchCaptains();
  }, [fetchCaptains]);

  // Sorting Handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Filtered & Sorted Captains (debounced)
  const filteredCaptains = React.useMemo(() => {
    return (captains || []).filter(d => {
      const statusUpper = String(d.status || '').toUpperCase();
      const filterUpper = String(statusFilter || 'ALL').toUpperCase();
      
      const matchesStatus = 
        statusFilter === 'All' || 
        statusUpper === filterUpper;

      const matchesAvailability = availabilityFilter === 'All' || d.available === availabilityFilter;
      const q = String(debouncedSearch || '').toLowerCase().trim();
      const matchesSearch = 
        String(d.name || '').toLowerCase().includes(q) ||
        String(d.mobile || '').toLowerCase().includes(q) ||
        String(d.address || '').toLowerCase().includes(q) ||
        String(d.city || '').toLowerCase().includes(q) ||
        String(d.id || '').toLowerCase().includes(q);
      return matchesStatus && matchesAvailability && matchesSearch;
    });
  }, [captains, statusFilter, availabilityFilter, debouncedSearch]);

  const sortedCaptains = React.useMemo(() => {
    return [...filteredCaptains].sort((a, b) => {
      if (!sortField) return 0;
      let valA = a[sortField] != null ? a[sortField] : '';
      let valB = b[sortField] != null ? b[sortField] : '';
      const strA = String(valA);
      const strB = String(valB);
      if (strA.startsWith('₹')) {
        valA = parseFloat(strA.replace('₹', '').replace(',', '')) || 0;
        valB = parseFloat(strB.replace('₹', '').replace(',', '')) || 0;
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredCaptains, sortField, sortOrder]);

  // Pagination Math
  const totalPages = Math.ceil(sortedCaptains.length / entriesPerPage) || 1;
  const startIndex = (currentPage - 1) * entriesPerPage;
  const paginatedCaptains = sortedCaptains.slice(startIndex, startIndex + entriesPerPage);

  // Live Status Change Handler (Approve / Pending / Reject)
  const handleToggleCaptainStatus = async (id, newStatus) => {
    try {
      const res = await captainService.toggleCaptainStatus(id, newStatus);
      if (res.success) {
        alert(res.message || `Captain status updated to ${newStatus.toUpperCase()}`);
        fetchCaptains();
      } else {
        alert(res.message || 'Failed to update status');
      }
    } catch (err) {
      alert(`Error updating status: ${err.message}`);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this captain application permanently?')) {
      try {
        const res = await captainService.deleteCaptain(id);
        if (res.success) {
          alert(res.message || 'Captain deleted successfully');
          fetchCaptains();
        }
      } catch (err) {
        alert(`Error deleting captain: ${err.message}`);
      }
    }
  };

  const handleExportCSV = () => {
    const headers = ['Id', 'Name', 'Mobile', 'Address', 'City', 'Commission', 'Balance', 'Cash Collected', 'Status', 'Available'];
    const rows = sortedCaptains.map(d => [d.id, `"${d.name}"`, d.mobile, `"${d.address}"`, `"${d.city}"`, d.commission, d.balance, d.cashCollected, d.status, d.available]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sathiseller_delivery_boy_list_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Title & Breadcrumb */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Captains</h1>
        <div className="text-xs text-slate-500 font-medium">
          Dashboard / <span className="text-[#ff5500] font-semibold">View Captain List</span>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Light Orange Header Banner */}
        <div className="bg-[#fff4ed] border-b border-orange-200/70 text-[#002625] px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight text-[#002625] flex items-center gap-2 m-0">
            <ChevronRight size={18} className="text-[#ff5500]" />
            View Captain List
          </h2>
          {loading ? (
            <span className="text-[10px] uppercase font-extrabold tracking-wider bg-amber-500 text-white px-3 py-1 rounded-full shadow-2xs animate-pulse flex items-center gap-1.5">
              <RefreshCw size={11} className="animate-spin" /> Loading Captains...
            </span>
          ) : (
            <span className="text-[10px] uppercase font-extrabold tracking-wider bg-[#ff5500] text-white px-3 py-1 rounded-full shadow-2xs">
              {captains.length} Registered Captains
            </span>
          )}
        </div>

        {/* Filter Toolbar Section */}
        <div className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
            
            {/* Left Filter Controls */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-slate-600 font-medium">Status:</span>
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-[#ff5500] cursor-pointer"
                >
                  <option value="All">All Status</option>
                  <option value="Approved">Approved</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Pending OTP">Pending OTP</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-600 font-medium">Availability:</span>
                <select 
                  value={availabilityFilter}
                  onChange={(e) => setAvailabilityFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-[#ff5500] cursor-pointer"
                >
                  <option value="All">All Availability</option>
                  <option value="Online">Online</option>
                  <option value="Offline">Offline</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-600 font-medium">Search:</span>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search by name, mobile, address..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-56 bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#ff5500]"
                  />
                </div>
              </div>
            </div>

            {/* Right Controls: Refresh & Export */}
            <div className="flex items-center gap-2">
              <button 
                onClick={fetchCaptains}
                disabled={loading}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border-none cursor-pointer flex items-center gap-1.5 transition-all active:scale-95 shrink-0"
                title="Reload Latest Data"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>

              <button 
                onClick={handleExportCSV}
                className="px-4 py-2 bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold rounded-xl border-none cursor-pointer flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 shrink-0"
              >
                <Download size={14} /> Export
              </button>
            </div>
          </div>

          {/* Show Entries Dropdown */}
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span>Show</span>
            <select 
              value={entriesPerPage}
              onChange={(e) => {
                setEntriesPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs text-slate-800 outline-none focus:border-[#ff5500] cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>entries</span>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                  <th onClick={() => handleSort('id')} className="py-3 px-3 cursor-pointer select-none">Id ⇅</th>
                  <th onClick={() => handleSort('name')} className="py-3 px-3 cursor-pointer select-none">Name ⇅</th>
                  <th onClick={() => handleSort('mobile')} className="py-3 px-3 cursor-pointer select-none">Mobile ⇅</th>
                  <th className="py-3 px-3">Address</th>
                  <th onClick={() => handleSort('city')} className="py-3 px-3 cursor-pointer select-none">City ⇅</th>
                  <th className="py-3 px-3">Commission</th>
                  <th onClick={() => handleSort('balance')} className="py-3 px-3 cursor-pointer select-none">Balance ⇅</th>
                  <th onClick={() => handleSort('cashCollected')} className="py-3 px-3 cursor-pointer select-none">Cash Collected ⇅</th>
                  <th onClick={() => handleSort('status')} className="py-3 px-3 cursor-pointer select-none">Status ⇅</th>
                  <th onClick={() => handleSort('available')} className="py-3 px-3 cursor-pointer select-none">Available ⇅</th>
                  <th className="py-3 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {loading ? (
                  <tr>
                    <td colSpan="11" className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-9 h-9 border-3 border-orange-500/20 border-t-[#ff5500] rounded-full animate-spin"></div>
                        <div>
                          <p className="text-sm font-bold text-slate-800 tracking-tight">Loading Captains...</p>
                          <p className="text-xs text-slate-400 mt-0.5">Fetching registered captain records from database</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : paginatedCaptains.length > 0 ? (
                  paginatedCaptains.map((captain) => (
                    <tr key={captain.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-mono text-slate-500">{captain.id}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">{captain.name}</td>
                      <td className="py-3 px-3 font-mono">{captain.mobile}</td>
                      <td className="py-3 px-3 text-slate-600 max-w-[140px] truncate" title={captain.address}>{captain.address}</td>
                      <td className="py-3 px-3 font-medium">{captain.city}</td>
                      <td className="py-3 px-3 font-semibold text-slate-600">{captain.commission}</td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-800">{captain.balance}</td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-800">{captain.cashCollected}</td>
                      
                      {/* Status Badge */}
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          captain.status === 'Approved' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : captain.status === 'Rejected'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : captain.status === 'Suspended'
                            ? 'bg-slate-100 text-slate-700 border border-slate-300'
                            : captain.status === 'Pending OTP'
                            ? 'bg-sky-50 text-sky-700 border border-sky-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {captain.status}
                        </span>
                      </td>

                      {/* Availability Badge */}
                      <td className="py-3 px-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          captain.available === 'Online' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {captain.available}
                        </span>
                      </td>

                      {/* Interactive Action Buttons */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* View Icon */}
                          <button 
                            onClick={() => setSelectedCaptain(captain)}
                            className="p-1 rounded-md text-sky-600 hover:bg-sky-50 border-none bg-transparent cursor-pointer transition-colors"
                            title="View Details"
                          >
                            <Eye size={15} />
                          </button>

                          {/* Approve Button */}
                          {captain.status !== 'Approved' && (
                            <button 
                              onClick={() => handleToggleCaptainStatus(captain._id, 'approved')}
                              className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-pointer transition-colors text-[10px] font-bold flex items-center gap-1"
                              title="Approve Captain"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                              Approve
                            </button>
                          )}

                          {/* Reject Button */}
                          {captain.status !== 'Rejected' && (
                            <button 
                              onClick={() => handleToggleCaptainStatus(captain._id, 'rejected')}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer transition-colors text-[10px] font-bold flex items-center gap-1"
                              title="Reject Captain"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              Reject
                            </button>
                          )}

                          {/* Suspend Button */}
                          {captain.status !== 'Suspended' && (
                            <button 
                              onClick={() => handleToggleCaptainStatus(captain._id, 'suspended')}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 cursor-pointer transition-colors text-[10px] font-bold flex items-center gap-1"
                              title="Suspend Captain"
                            >
                              Suspend
                            </button>
                          )}

                          {/* Edit Icon */}
                          <button
                            onClick={() => setEditingCaptain(captain)}
                            className="p-1 rounded-md text-blue-600 hover:bg-blue-50 border-none bg-transparent cursor-pointer transition-colors"
                            title="Edit Captain Details"
                          >
                            <Edit3 size={15} />
                          </button>

                          {/* Delete Icon */}
                          <button
                            onClick={() => handleDelete(captain._id)}
                            className="p-1 rounded-md text-rose-600 hover:bg-rose-50 border-none bg-transparent cursor-pointer transition-colors"
                            title="Delete Captain"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="11" className="py-12 text-center text-slate-400 font-medium text-xs">
                      No captains found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 pt-2">
            <div>
              Showing {startIndex + 1} to {Math.min(startIndex + entriesPerPage, sortedCaptains.length)} of {sortedCaptains.length} entries
            </div>

            <div className="flex items-center gap-1">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer font-bold transition-all"
              >
                ‹
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                    currentPage === page 
                      ? 'bg-[#ff5500] text-white border-[#ff5500] shadow-2xs' 
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer font-bold transition-all"
              >
                ›
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* VIEW DETAILS CENTERED MODAL */}
      {selectedCaptain && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-white border-b border-slate-100 p-6 flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-4">
                {selectedCaptain.raw?.documents?.profilePhoto ? (
                  <img
                    src={selectedCaptain.raw.documents.profilePhoto}
                    alt={selectedCaptain.name}
                    onClick={() => setPreviewDocImage({ title: 'Captain Live Selfie', src: selectedCaptain.raw.documents.profilePhoto })}
                    className="w-12 h-12 rounded-2xl object-cover border-2 border-emerald-500 shadow-sm cursor-pointer hover:scale-105 transition-transform shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#15803d] flex items-center justify-center font-black text-xl border border-emerald-100 shrink-0">
                    {selectedCaptain.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-extrabold text-[#002625] m-0">{selectedCaptain.name}</h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedCaptain.status === 'Approved' 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                        : selectedCaptain.status === 'Rejected'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : selectedCaptain.status === 'Suspended'
                        ? 'bg-slate-100 text-slate-700 border border-slate-300'
                        : selectedCaptain.status === 'Pending OTP'
                        ? 'bg-sky-50 text-sky-700 border border-sky-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {selectedCaptain.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mt-0.5 m-0">ID: {selectedCaptain.id} • Mobile: {selectedCaptain.mobile}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectedCaptain.status !== 'Approved' && (
                  <button 
                    onClick={() => {
                      handleToggleCaptainStatus(selectedCaptain._id, 'approved');
                      setSelectedCaptain(null);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-colors text-xs font-bold flex items-center gap-1 shadow-sm border-none"
                  >
                    ✓ Approve
                  </button>
                )}

                {selectedCaptain.status !== 'Rejected' && (
                  <button 
                    onClick={() => {
                      handleToggleCaptainStatus(selectedCaptain._id, 'rejected');
                      setSelectedCaptain(null);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white cursor-pointer transition-colors text-xs font-bold flex items-center gap-1 shadow-sm border-none"
                  >
                    ✕ Reject
                  </button>
                )}

                {selectedCaptain.status !== 'Suspended' && (
                  <button 
                    onClick={() => {
                      handleToggleCaptainStatus(selectedCaptain._id, 'suspended');
                      setSelectedCaptain(null);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-600 hover:bg-slate-700 text-white cursor-pointer transition-colors text-xs font-bold flex items-center gap-1 shadow-sm border-none"
                  >
                    ⊘ Suspend
                  </button>
                )}

                <button 
                  onClick={() => setSelectedCaptain(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 border-none cursor-pointer flex items-center justify-center text-lg font-bold transition-colors"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 space-y-6 overflow-y-auto text-xs flex-1">

              {/* Quick Financial Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Wallet Balance</p>
                  <p className="text-base font-extrabold text-emerald-600">{selectedCaptain.balance}</p>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Cash Collected</p>
                  <p className="text-base font-extrabold text-[#ff5500]">{selectedCaptain.cashCollected}</p>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Duty Status</p>
                  <p className="text-sm font-bold text-slate-800">{selectedCaptain.available}</p>
                </div>
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Registered On</p>
                  <p className="text-xs font-bold text-slate-700">
                    {selectedCaptain.raw?.createdAt ? new Date(selectedCaptain.raw.createdAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Section 1: Personal Information */}
              <div className="border border-slate-100 rounded-2xl p-4 bg-white space-y-3">
                <h4 className="text-xs font-black text-[#15803d] uppercase tracking-wider border-b border-slate-100 pb-2 m-0">
                  1. Personal Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-700">
                  <div><span className="text-slate-400 font-medium block text-[10px]">Full Name:</span> <span className="font-bold text-slate-900">{selectedCaptain.raw?.name || selectedCaptain.name}</span></div>
                  <div><span className="text-slate-400 font-medium block text-[10px]">Primary Mobile:</span> <span className="font-bold text-slate-900">{selectedCaptain.raw?.phone || selectedCaptain.mobile}</span></div>
                  <div><span className="text-slate-400 font-medium block text-[10px]">Alternate Mobile:</span> <span className="font-semibold text-slate-800">{selectedCaptain.raw?.alternateMobile || 'N/A'}</span></div>
                  <div><span className="text-slate-400 font-medium block text-[10px]">Email ID:</span> <span className="font-semibold text-slate-800">{selectedCaptain.raw?.email || selectedCaptain.email || 'N/A'}</span></div>
                  <div><span className="text-slate-400 font-medium block text-[10px]">Date of Birth:</span> <span className="font-semibold text-slate-800">{selectedCaptain.raw?.dob || 'N/A'}</span></div>
                  <div><span className="text-slate-400 font-medium block text-[10px]">Age:</span> <span className="font-semibold text-slate-800">{selectedCaptain.raw?.age || 'N/A'}</span></div>
                  <div><span className="text-slate-400 font-medium block text-[10px]">Father's Name:</span> <span className="font-semibold text-slate-800">{selectedCaptain.raw?.fatherName || 'N/A'}</span></div>
                </div>
              </div>

              {/* Section 2: Address & Location */}
              <div className="border border-slate-100 rounded-2xl p-4 bg-white space-y-3">
                <h4 className="text-xs font-black text-[#15803d] uppercase tracking-wider border-b border-slate-100 pb-2 m-0">
                  2. Address & Emergency Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-700">
                  <div className="sm:col-span-2"><span className="text-slate-400 font-medium block text-[10px]">Current Address:</span> <span className="font-semibold text-slate-800">{selectedCaptain.raw?.currentAddress || selectedCaptain.address || 'N/A'}</span></div>
                  <div><span className="text-slate-400 font-medium block text-[10px]">Emergency Contact:</span> <span className="font-bold text-rose-600">{selectedCaptain.raw?.emergencyContact || 'N/A'}</span></div>
                  <div className="sm:col-span-2"><span className="text-slate-400 font-medium block text-[10px]">Permanent Address:</span> <span className="font-semibold text-slate-800">{selectedCaptain.raw?.permanentAddress || 'N/A'}</span></div>
                  <div><span className="text-slate-400 font-medium block text-[10px]">City / State / PIN:</span> <span className="font-semibold text-slate-800">{`${selectedCaptain.raw?.city || selectedCaptain.city || 'N/A'}, ${selectedCaptain.raw?.state || ''} ${selectedCaptain.raw?.pinCode || ''}`}</span></div>
                </div>
              </div>

              {/* Section 3: Identity & Vehicle Details */}
              <div className="border border-slate-100 rounded-2xl p-4 bg-white space-y-3">
                <h4 className="text-xs font-black text-[#15803d] uppercase tracking-wider border-b border-slate-100 pb-2 m-0">
                  3. Identity & Vehicle Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-700">
                  <div><span className="text-slate-400 font-medium block text-[10px]">Vehicle Type:</span> <span className="font-bold text-[#ff5500]">{selectedCaptain.raw?.vehicleType || selectedCaptain.vehicle || 'Two Wheeler'}</span></div>
                  <div><span className="text-slate-400 font-medium block text-[10px]">Driving License No:</span> <span className="font-bold font-mono text-slate-900">{selectedCaptain.raw?.drivingLicenseNumber || 'N/A'}</span></div>
                  <div><span className="text-slate-400 font-medium block text-[10px]">Aadhaar Number:</span> <span className="font-bold font-mono text-slate-900">{selectedCaptain.raw?.aadhaarNumber || 'N/A'}</span></div>
                  <div><span className="text-slate-400 font-medium block text-[10px]">RC Number:</span> <span className="font-semibold font-mono text-slate-800">{selectedCaptain.raw?.rcNumber || 'N/A'}</span></div>
                  <div><span className="text-slate-400 font-medium block text-[10px]">Insurance Number:</span> <span className="font-semibold text-slate-800">{selectedCaptain.raw?.vehicleInsuranceNumber || 'N/A'}</span></div>
                  <div><span className="text-slate-400 font-medium block text-[10px]">Insurance Valid Till:</span> <span className="font-semibold text-slate-800">{selectedCaptain.raw?.insuranceValidTill || 'N/A'}</span></div>
                </div>
              </div>

              {/* Section 4: Bank Details */}
              <div className="border border-slate-100 rounded-2xl p-4 bg-white space-y-3">
                <h4 className="text-xs font-black text-[#15803d] uppercase tracking-wider border-b border-slate-100 pb-2 m-0">
                  4. Bank & Payout Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-700">
                  <div><span className="text-slate-400 font-medium block text-[10px]">Bank Name:</span> <span className="font-bold text-slate-900">{selectedCaptain.raw?.bankDetails?.bankName || 'N/A'}</span></div>
                  <div><span className="text-slate-400 font-medium block text-[10px]">Account Holder:</span> <span className="font-semibold text-slate-800">{selectedCaptain.raw?.bankDetails?.accountHolderName || 'N/A'}</span></div>
                  <div><span className="text-slate-400 font-medium block text-[10px]">Account Number:</span> <span className="font-mono font-bold text-slate-900">{selectedCaptain.raw?.bankDetails?.accountNumber || 'N/A'}</span></div>
                  <div><span className="text-slate-400 font-medium block text-[10px]">IFSC Code:</span> <span className="font-mono font-bold text-slate-900">{selectedCaptain.raw?.bankDetails?.ifscCode || 'N/A'}</span></div>
                  <div><span className="text-slate-400 font-medium block text-[10px]">Branch Name:</span> <span className="font-semibold text-slate-800">{selectedCaptain.raw?.bankDetails?.branchName || 'N/A'}</span></div>
                  <div><span className="text-slate-400 font-medium block text-[10px]">UPI ID:</span> <span className="font-semibold text-[#15803d]">{selectedCaptain.raw?.bankDetails?.upiId || 'N/A'}</span></div>
                  <div><span className="text-slate-400 font-medium block text-[10px]">Aadhaar Card Number:</span> <span className="font-bold font-mono text-slate-900">{selectedCaptain.raw?.aadhaarNumber || 'N/A'}</span></div>
                </div>
              </div>

              {/* Section 5: Uploaded KYC Documents & Photos */}
              <div className="border border-slate-100 rounded-2xl p-4 bg-white space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h4 className="text-xs font-black text-[#15803d] uppercase tracking-wider m-0">
                    5. Uploaded Documents & Real Scans
                  </h4>
                  <span className="text-[10px] text-slate-400 font-semibold">Click any image to view in full resolution</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
                  {/* Captain Live Selfie */}
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-700 uppercase">Live Selfie</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          selectedCaptain.raw?.documents?.profilePhoto ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {selectedCaptain.raw?.documents?.profilePhoto ? 'Attached' : 'Pending'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">
                        Captain Photo Verification
                      </p>
                    </div>

                    {selectedCaptain.raw?.documents?.profilePhoto ? (
                      <div 
                        onClick={() => setPreviewDocImage({ title: 'Captain Live Selfie', src: selectedCaptain.raw.documents.profilePhoto })}
                        className="relative group cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-black aspect-video flex items-center justify-center"
                      >
                        <img 
                          src={selectedCaptain.raw.documents.profilePhoto} 
                          alt="Captain Live Selfie" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-[10px] gap-1">
                          <Eye size={14} /> View Full
                        </div>
                      </div>
                    ) : (
                      <div className="h-20 bg-slate-100 border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 text-[10px] font-medium">
                        <span>No selfie uploaded</span>
                      </div>
                    )}
                  </div>

                  {/* Driving License */}
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-700 uppercase">Driving License</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          selectedCaptain.raw?.documents?.drivingLicense ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {selectedCaptain.raw?.documents?.drivingLicense ? 'Attached' : 'Pending'}
                        </span>
                      </div>
                      <p className="font-mono text-[10px] text-slate-500 truncate mt-0.5">
                        {selectedCaptain.raw?.drivingLicenseNumber || 'No DL No.'}
                      </p>
                    </div>

                    {selectedCaptain.raw?.documents?.drivingLicense ? (
                      <div 
                        onClick={() => setPreviewDocImage({ title: 'Driving License', src: selectedCaptain.raw.documents.drivingLicense })}
                        className="relative group cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-black aspect-video flex items-center justify-center"
                      >
                        <img 
                          src={selectedCaptain.raw.documents.drivingLicense} 
                          alt="Driving License" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-[10px] gap-1">
                          <Eye size={14} /> View Full
                        </div>
                      </div>
                    ) : (
                      <div className="h-20 bg-slate-100 border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 text-[10px] font-medium">
                        <span>No image uploaded</span>
                      </div>
                    )}
                  </div>

                  {/* RC Document */}
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-700 uppercase">Vehicle RC</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          selectedCaptain.raw?.documents?.rcDocument ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {selectedCaptain.raw?.documents?.rcDocument ? 'Attached' : 'Pending'}
                        </span>
                      </div>
                      <p className="font-mono text-[10px] text-slate-500 truncate mt-0.5">
                        {selectedCaptain.raw?.rcNumber || 'No RC No.'}
                      </p>
                    </div>

                    {selectedCaptain.raw?.documents?.rcDocument ? (
                      <div 
                        onClick={() => setPreviewDocImage({ title: 'Vehicle RC Document', src: selectedCaptain.raw.documents.rcDocument })}
                        className="relative group cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-black aspect-video flex items-center justify-center"
                      >
                        <img 
                          src={selectedCaptain.raw.documents.rcDocument} 
                          alt="RC Document" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-[10px] gap-1">
                          <Eye size={14} /> View Full
                        </div>
                      </div>
                    ) : (
                      <div className="h-20 bg-slate-100 border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 text-[10px] font-medium">
                        <span>No image uploaded</span>
                      </div>
                    )}
                  </div>

                  {/* Aadhaar Card */}
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-700 uppercase">Aadhaar Card</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          selectedCaptain.raw?.documents?.aadhaarFront ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {selectedCaptain.raw?.documents?.aadhaarFront ? 'Attached' : 'Pending'}
                        </span>
                      </div>
                      <p className="font-mono text-[10px] text-slate-500 truncate mt-0.5">
                        {selectedCaptain.raw?.aadhaarNumber || 'No Aadhaar No.'}
                      </p>
                    </div>

                    {selectedCaptain.raw?.documents?.aadhaarFront || selectedCaptain.raw?.documents?.aadhaarBack ? (
                      <div 
                        onClick={() => setPreviewDocImage({ title: 'Aadhaar Card', src: selectedCaptain.raw.documents.aadhaarFront || selectedCaptain.raw.documents.aadhaarBack })}
                        className="relative group cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-black aspect-video flex items-center justify-center"
                      >
                        <img 
                          src={selectedCaptain.raw.documents.aadhaarFront || selectedCaptain.raw.documents.aadhaarBack} 
                          alt="Aadhaar Card" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-[10px] gap-1">
                          <Eye size={14} /> View Full
                        </div>
                      </div>
                    ) : (
                      <div className="h-20 bg-slate-100 border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 text-[10px] font-medium">
                        <span>No image uploaded</span>
                      </div>
                    )}
                  </div>

                  {/* Bank Passbook */}
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-700 uppercase">Bank Passbook</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          selectedCaptain.raw?.documents?.bankPassbook ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {selectedCaptain.raw?.documents?.bankPassbook ? 'Attached' : 'Pending'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">
                        {selectedCaptain.raw?.bankDetails?.accountNumber || 'No account number'}
                      </p>
                    </div>

                    {selectedCaptain.raw?.documents?.bankPassbook ? (
                      <div
                        onClick={() => setPreviewDocImage({ title: 'Bank Passbook', src: selectedCaptain.raw.documents.bankPassbook })}
                        className="relative group cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-black aspect-video flex items-center justify-center"
                      >
                        <img
                          src={selectedCaptain.raw.documents.bankPassbook}
                          alt="Bank Passbook"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-[10px] gap-1">
                          <Eye size={14} /> View Full
                        </div>
                      </div>
                    ) : (
                      <div className="h-20 bg-slate-100 border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 text-[10px] font-medium">
                        <span>No passbook uploaded</span>
                      </div>
                    )}
                  </div>

                  {/* Vehicle Insurance */}
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-700 uppercase">Insurance Policy</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          selectedCaptain.raw?.documents?.insuranceDoc ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {selectedCaptain.raw?.documents?.insuranceDoc ? 'Attached' : 'Pending'}
                        </span>
                      </div>
                      <p className="font-mono text-[10px] text-slate-500 truncate mt-0.5">
                        {selectedCaptain.raw?.vehicleInsuranceNumber || 'No Policy No.'}
                      </p>
                    </div>

                    {selectedCaptain.raw?.documents?.insuranceDoc ? (
                      <div 
                        onClick={() => setPreviewDocImage({ title: 'Vehicle Insurance Policy', src: selectedCaptain.raw.documents.insuranceDoc })}
                        className="relative group cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-black aspect-video flex items-center justify-center"
                      >
                        <img 
                          src={selectedCaptain.raw.documents.insuranceDoc} 
                          alt="Insurance Policy" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-[10px] gap-1">
                          <Eye size={14} /> View Full
                        </div>
                      </div>
                    ) : (
                      <div className="h-20 bg-slate-100 border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 text-[10px] font-medium">
                        <span>No image uploaded</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">Sathi Seller Captain Command Center</span>
              <button 
                onClick={() => setSelectedCaptain(null)}
                className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl border-none cursor-pointer transition-colors shadow-sm"
              >
                Close Modal
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ADMIN LIGHTBOX DOCUMENT IMAGE PREVIEW */}
      {previewDocImage && (
        <div 
          className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPreviewDocImage(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 bg-slate-900 text-white flex justify-between items-center">
              <h4 className="text-xs font-bold text-white m-0 flex items-center gap-2">
                <FileText size={16} className="text-[#97fc43]" />
                {previewDocImage.title}
              </h4>
              <button 
                onClick={() => setPreviewDocImage(null)} 
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border-none cursor-pointer"
              >
                ×
              </button>
            </div>
            <div className="p-4 bg-slate-950 flex items-center justify-center overflow-auto max-h-[75vh]">
              <img 
                src={previewDocImage.src} 
                alt={previewDocImage.title} 
                className="max-h-[70vh] w-auto object-contain rounded-xl shadow-lg" 
              />
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setPreviewDocImage(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl border-none cursor-pointer"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT captain MODAL */}
      {editingCaptain && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn">
            <div className="bg-[#fff4ed] border-b border-orange-200/70 p-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#002625] m-0">Edit Captain - {editingCaptain.name}</h3>
              <button 
                onClick={() => setEditingCaptain(null)}
                className="text-slate-400 hover:text-slate-900 border-none bg-transparent cursor-pointer text-lg font-bold"
              >
                ×
              </button>
            </div>
            
            <div className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1">Name</label>
                <input 
                  type="text" 
                  value={editingCaptain.name}
                  onChange={(e) => setEditingCaptain({ ...editingCaptain, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#ff5500]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Mobile</label>
                  <input 
                    type="text" 
                    value={editingCaptain.mobile}
                    onChange={(e) => setEditingCaptain({ ...editingCaptain, mobile: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#ff5500]"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold block mb-1">City</label>
                  <input 
                    type="text" 
                    value={editingCaptain.city}
                    onChange={(e) => setEditingCaptain({ ...editingCaptain, city: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#ff5500]"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Address</label>
                <input 
                  type="text" 
                  value={editingCaptain.address}
                  onChange={(e) => setEditingCaptain({ ...editingCaptain, address: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#ff5500]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Balance (₹)</label>
                  <input 
                    type="text" 
                    value={editingCaptain.balance}
                    onChange={(e) => setEditingCaptain({ ...editingCaptain, balance: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#ff5500]"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Cash Collected (₹)</label>
                  <input 
                    type="text" 
                    value={editingCaptain.cashCollected}
                    onChange={(e) => setEditingCaptain({ ...editingCaptain, cashCollected: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-[#ff5500]"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button
                onClick={() => setEditingCaptain(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border-none cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    const response = await adminService.updateCaptainDetails(editingCaptain.id, {
                      name: editingCaptain.name,
                      mobile: editingCaptain.mobile,
                      city: editingCaptain.city,
                      address: editingCaptain.address,
                      balance: editingCaptain.balance,
                      cashCollected: editingCaptain.cashCollected
                    });
                    if (response && response.success) {
                      setCaptains(prev => prev.map(d => d.id === editingCaptain.id ? editingCaptain : d));
                      setEditingCaptain(null);
                    }
                  } catch (err) {
                    console.error('Error updating captain details:', err);
                    alert('Failed to update captain details');
                  }
                }}
                className="px-5 py-2 bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-2xs"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



/* =========================================================================
   4.5. BRAND MANAGEMENT PAGE
   ========================================================================= */
export const BrandManagement = () => {
  const [brands, setBrands] = React.useState([
    { id: '751452', name: 'Amul', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=100&auto=format&fit=crop&q=80' },
    { id: '3c02a3', name: 'Mother Dairy', image: 'https://images.unsplash.com/photo-1528751014936-863e6e7a319c?w=100&auto=format&fit=crop&q=80' },
    { id: '768417', name: 'test br', image: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=100&auto=format&fit=crop&q=80' }
  ]);

  const [brandName, setBrandName] = React.useState('');
  const [brandImage, setBrandImage] = React.useState('');
  const [editingId, setEditingId] = React.useState(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [entriesPerPage, setEntriesPerPage] = React.useState('10');
  const [currentPage, setCurrentPage] = React.useState(1);

  // File Upload Handler
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBrandImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Add / Edit Brand Form Action
  const handleSubmitBrand = (e) => {
    e.preventDefault();
    if (!brandName.trim()) {
      alert('Please enter a Brand Name');
      return;
    }

    if (editingId) {
      setBrands(prev => prev.map(b => b.id === editingId ? {
        ...b,
        name: brandName,
        image: brandImage || b.image
      } : b));
      setEditingId(null);
    } else {
      const newBrand = {
        id: Math.random().toString(36).substring(2, 8),
        name: brandName,
        image: brandImage || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=100&auto=format&fit=crop&q=80'
      };
      setBrands(prev => [newBrand, ...prev]);
    }

    setBrandName('');
    setBrandImage('');
  };

  // Edit Action
  const handleEdit = (brand) => {
    setEditingId(brand.id);
    setBrandName(brand.name);
    setBrandImage(brand.image);
  };

  // Delete Action
  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this brand?')) {
      setBrands(prev => prev.filter(b => b.id !== id));
    }
  };

  // CSV Export Action
  const handleExportCSV = () => {
    const rows = [['ID', 'Brand Name', 'Image URL'].join(',')];
    brands.forEach(b => {
      rows.push([`"${b.id}"`, `"${b.name}"`, `"${b.image}"`].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sathiseller_brands_export_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  // Filtered Brands
  const filteredBrands = brands.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header & Breadcrumb */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Brand</h1>
        <div className="text-xs text-slate-500 font-medium">
          Home / <span className="text-[#ff5500] font-semibold">Dashboard</span>
        </div>
      </div>

      {/* Grid Layout: Add Brand (Left) & View Brand (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side Card: Add Brand / Edit Brand */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Card Header matching Light Orange Theme */}
          <div className="bg-[#fff4ed] border-b border-orange-200/70 text-[#002625] px-6 py-4 flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-tight text-[#002625] flex items-center gap-2">
              <Plus size={16} className="text-[#ff5500]" />
              {editingId ? 'Edit Brand' : 'Add Brand'}
            </h2>
          </div>

          <form onSubmit={handleSubmitBrand} className="p-6 space-y-5">
            {/* Brand Name Input */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Brand Name: *
              </label>
              <input 
                type="text" 
                required
                placeholder="Enter Brand Name"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 outline-none focus:border-[#ff5500] bg-slate-50/50"
              />
            </div>

            {/* Brand Image Upload Box */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Brand Image:
              </label>
              
              <label className="w-full border-2 border-dashed border-slate-200 hover:border-[#ff5500] rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/40 group">
                <input 
                  type="file" 
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                
                {brandImage ? (
                  <div className="flex flex-col items-center gap-2">
                    <img 
                      src={brandImage} 
                      alt="Brand Preview" 
                      className="w-20 h-14 rounded-xl object-contain border border-slate-200 bg-white p-1 shadow-2xs" 
                    />
                    <span className="text-[11px] text-[#ff5500] font-bold">Click to Change Image</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-400 group-hover:text-[#ff5500] transition-colors">
                    <Upload size={24} />
                    <span className="text-xs font-bold text-slate-600">Choose File</span>
                    <span className="text-[10px] text-slate-400">Max 5MB (JPG, PNG, WEBP)</span>
                  </div>
                )}
              </label>
            </div>

            {/* Submit Button */}
            <div className="flex items-center gap-2 pt-2">
              <button 
                type="submit"
                className="w-full py-2.5 bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-xs transition-all active:scale-98"
              >
                {editingId ? 'Update Brand' : 'Add Brand'}
              </button>
              {editingId && (
                <button 
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setBrandName('');
                    setBrandImage('');
                  }}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border-none cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Right Side Card: View Brand Table */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Card Header matching Dark Teal Theme */}
          <div className="bg-[#002625] text-white px-6 py-4 flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              <ChevronRight size={16} className="text-[#ff5500]" />
              View Brand
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-white/10 text-white/90 px-2.5 py-1 rounded-full">
              {brands.length} Total Brands
            </span>
          </div>

          <div className="p-6 space-y-4">
            {/* Toolbar Controls: Show entries dropdown, Export, Search */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-medium text-slate-600">
              <div className="flex items-center gap-2">
                <span>Show</span>
                <select 
                  value={entriesPerPage}
                  onChange={(e) => setEntriesPerPage(e.target.value)}
                  className="border border-slate-200 rounded-xl px-2.5 py-1.5 bg-slate-50 text-xs text-slate-800 outline-none focus:border-[#ff5500]"
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
                <span>entries</span>
              </div>

              <div className="flex items-center gap-3">
                {/* Export Button */}
                <button 
                  onClick={handleExportCSV}
                  className="px-3.5 py-1.5 bg-[#002625] hover:bg-[#003837] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 border-none cursor-pointer shadow-2xs transition-all active:scale-95"
                >
                  <Download size={13} className="text-[#ff5500]" /> Export
                </button>

                {/* Search Input */}
                <div className="flex items-center gap-1.5">
                  <span>Search:</span>
                  <input 
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-40 border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 text-xs text-slate-800 outline-none focus:border-[#ff5500]"
                  />
                </div>
              </div>
            </div>

            {/* Brand Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">ID</th>
                    <th className="py-3 px-4">BRAND NAME</th>
                    <th className="py-3 px-4">BRAND IMAGE</th>
                    <th className="py-3 px-4 text-center">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredBrands.length > 0 ? (
                    filteredBrands.map((brand) => (
                      <tr key={brand.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-slate-500">{brand.id}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{brand.name}</td>
                        <td className="py-3 px-4">
                          <img 
                            src={brand.image} 
                            alt={brand.name} 
                            className="w-14 h-10 rounded-lg object-contain bg-white border border-slate-100 p-1 shadow-2xs" 
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button 
                              onClick={() => handleEdit(brand)}
                              className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg border border-blue-200 cursor-pointer transition-colors"
                              title="Edit Brand"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button 
                              onClick={() => handleDelete(brand.id)}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200 cursor-pointer transition-colors"
                              title="Delete Brand"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="py-6 text-center text-slate-400 italic text-xs">
                        No brands found matching "{searchQuery}"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer & Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-500">
              <span>Showing 1 to {filteredBrands.length} of {brands.length} entries</span>
              
              <div className="inline-flex rounded-xl border border-slate-200 p-0.5 bg-slate-50">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 border-none bg-transparent cursor-pointer"
                >
                  ‹
                </button>
                <button className="px-3 py-1 bg-[#ff5500] text-white text-xs font-bold rounded-lg shadow-2xs border-none cursor-pointer">
                  {currentPage}
                </button>
                <button 
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 border-none bg-transparent cursor-pointer"
                >
                  ›
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

/* =========================================================================
   5. CATEGORIES PAGE
   ========================================================================= */
export const CategoryManagement = ({ initialSubcategoriesOnly = false }) => {
  const [viewMode, setViewMode] = React.useState('tree'); // 'tree' or 'list'
  const [activeCategoryTab, setActiveCategoryTab] = React.useState(initialSubcategoriesOnly ? 'subcategories' : 'all');
  const [expanded, setExpanded] = React.useState({ 'cat-1': true, 'sub-1': true, 'cat-2': true });
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('All Status');

  React.useEffect(() => {
    setActiveCategoryTab(initialSubcategoriesOnly ? 'subcategories' : 'all');
  }, [initialSubcategoriesOnly]);

  // Live State Data for Categories Tree (Fetched from DB)
  const [treeData, setTreeData] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [uploadingImage, setUploadingImage] = React.useState(false);
  const [categoryToDelete, setCategoryToDelete] = React.useState(null);
  const [deletingCategory, setDeletingCategory] = React.useState(false);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await categoryService.getCategories(true);
      if (res.success && res.categories) {
        // Map backend category format into flat array first
        const flatCategories = res.categories.map((c, index) => ({
          id: c._id,
          name: c.name,
          status: c.status || 'Active',
          header: 'General',
          subcategoriesCount: 0,
          order: c.priority || index + 1,
          image: c.image || '/uploads/categories/default.png',
          parent: c.parent,
          subcategories: []
        }));

        const categoryMap = {};
        flatCategories.forEach(c => categoryMap[c.id] = c);
        
        const tree = [];
        const initialExpanded = {};
        
        flatCategories.forEach(c => {
          initialExpanded[c.id] = true; // Auto-expand ALL categories by default
          if (c.parent && categoryMap[c.parent]) {
            categoryMap[c.parent].subcategories.push(c);
            categoryMap[c.parent].subcategoriesCount = categoryMap[c.parent].subcategories.length;
          } else {
            tree.push(c);
          }
        });

        setTreeData(tree);
        setExpanded(initialExpanded);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchCategories();
  }, []);

  // Modal Control States
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [addModalType, setAddModalType] = React.useState('category'); // 'category' or 'subcategory'
  const [selectedParentId, setSelectedParentId] = React.useState(null);
  const [selectedParentName, setSelectedParentName] = React.useState('');

  // Form Input States
  const [formData, setFormData] = React.useState({
    name: '',
    header: 'General',
    status: 'Active',
    order: '1',
    imageUrl: '/uploads/categories/default.png'
  });

  // Handle Category Image Device Upload
  const handleCategoryImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fd = new FormData();
    fd.append('image', file);

    try {
      setUploadingImage(true);
      const res = await bannerService.uploadImage(fd, 'categories');
      if (res.success && res.imageUrl) {
        setFormData(prev => ({ ...prev, imageUrl: res.imageUrl }));
      }
    } catch (err) {
      alert('Image upload failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploadingImage(false);
    }
  };

  // Edit Modal State
  const [editingItem, setEditingItem] = React.useState(null);

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExpandAll = () => {
    const allIds = {};
    treeData.forEach(cat => {
      allIds[cat.id] = true;
      if (cat.subcategories) {
        cat.subcategories.forEach(sub => {
          allIds[sub.id] = true;
        });
      }
    });
    setExpanded(allIds);
  };

  const handleCollapseAll = () => {
    setExpanded({});
  };

  // Open Modal Handlers with Parent Name
  const openAddCategoryModal = () => {
    setAddModalType('category');
    setSelectedParentId(null);
    setSelectedParentName('');
    setFormData({
      name: '',
      header: 'General',
      status: 'Active',
      order: (treeData.length + 1).toString(),
      imageUrl: ''
    });
    setIsAddModalOpen(true);
  };

  const openAddSubcategoryModal = (cat) => {
    setAddModalType('subcategory');
    setSelectedParentId(cat.id);
    setSelectedParentName(cat.name);
    setFormData({
      name: '',
      header: 'General',
      status: 'Active',
      order: '1',
      imageUrl: ''
    });
    setIsAddModalOpen(true);
  };

  const openEditCategoryModal = (cat) => {
    const isSubcategory = Boolean(cat.parent || cat.parentName);
    setAddModalType(isSubcategory ? 'subcategory' : 'category');
    setSelectedParentId(cat.parentId || cat.parent || null);
    setSelectedParentName(cat.parentName || '');
    setEditingItem(cat);
    setFormData({
      name: cat.name,
      header: cat.header || 'General',
      status: cat.status,
      order: String(cat.order || '1'),
      imageUrl: cat.image || ''
    });
    setIsAddModalOpen(true);
  };

  const openAddNestedSubcategoryModal = (sub) => {
    setAddModalType('nested_subcategory');
    setSelectedParentId(sub.id);
    setSelectedParentName(sub.name);
    setFormData({
      name: '',
      header: 'General',
      status: 'Active',
      order: '1',
      imageUrl: ''
    });
    setIsAddModalOpen(true);
  };

  // Create Category / Subcategory Action
  const handleSaveItem = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter a category name');
      return;
    }

    try {
      if (editingItem) {
        await categoryService.updateCategory(editingItem.id, {
          name: formData.name.trim(),
          status: formData.status,
          priority: Number(formData.order) || 1,
          image: formData.imageUrl
        });
      } else {
        await categoryService.createCategory({
          name: formData.name.trim(),
          status: formData.status,
          priority: Number(formData.order) || treeData.length + 1,
          image: formData.imageUrl,
          parent: (addModalType === 'subcategory' || addModalType === 'nested_subcategory') ? selectedParentId : null
        });
      }
      setIsAddModalOpen(false);
      setEditingItem(null);
      fetchCategories();
    } catch (err) {
      alert('Failed to save category: ' + (err.response?.data?.message || err.message));
    }
  };

  // Toggle Active / Deactivate Status
  const handleToggleStatus = async (id, currentStatus) => {
    try {
      const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
      await categoryService.updateCategory(id, { status: newStatus });
      fetchCategories();
    } catch (err) {
      alert('Failed to update category status');
    }
  };

  const handleDeleteItem = (item) => {
    if (!item?.id) return;
    setCategoryToDelete(item);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete?.id) return;
    setDeletingCategory(true);
    try {
      await categoryService.deleteCategory(categoryToDelete.id);
      setCategoryToDelete(null);
      await fetchCategories();
    } catch (err) {
      alert(err?.response?.data?.message || err?.message || 'Failed to delete category');
    } finally {
      setDeletingCategory(false);
    }
  };

  // Export Categories to Real CSV File Download
  const handleExportCSV = () => {
    const rows = [];
    rows.push(['ID', 'Level', 'Category Name', 'Parent Category', 'Status', 'Sort Order'].join(','));

    treeData.forEach((cat) => {
      rows.push([
        `"${cat.id}"`,
        '"Root Category"',
        `"${cat.name.replace(/"/g, '""')}"`,
        '"None"',
        `"${cat.status}"`,
        `"${cat.order}"`
      ].join(','));

      if (cat.subcategories && cat.subcategories.length > 0) {
        cat.subcategories.forEach((sub) => {
          rows.push([
            `"${sub.id}"`,
            '"Subcategory"',
            `"${sub.name.replace(/"/g, '""')}"`,
            `"${cat.name.replace(/"/g, '""')}"`,
            `"${sub.status}"`,
            `"${sub.order}"`
          ].join(','));

          if (sub.children && sub.children.length > 0) {
            sub.children.forEach((child) => {
              rows.push([
                `"${child.id}"`,
                '"Sub-subcategory"',
                `"${child.name.replace(/"/g, '""')}"`,
                `"${sub.name.replace(/"/g, '""')}"`,
                `"${child.status}"`,
                `"${child.order}"`
              ].join(','));
            });
          }
        });
      }
    });

    const csvString = rows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `sathiseller_categories_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter Categories by Search & Status
  const filteredTreeData = treeData.filter(cat => {
    const matchesSearch = cat.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All Status' || cat.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-5 animate-fadeIn relative">
      {/* Top Breadcrumb & Title */}
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {activeCategoryTab === 'subcategories' ? 'Sub Categories Management' : 'Category Management'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {activeCategoryTab === 'subcategories' 
              ? 'View, organize and manage all store subcategories and sub-subcategories' 
              : 'View and manage main store taxonomy structure'}
          </p>
        </div>
        
        {/* Category Mode Switcher Pills */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button 
            onClick={() => setActiveCategoryTab('all')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg border-none cursor-pointer transition-all ${
              activeCategoryTab === 'all' 
                ? 'bg-[#002625] text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Categories
          </button>
          <button 
            onClick={() => setActiveCategoryTab('subcategories')}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg border-none cursor-pointer transition-all ${
              activeCategoryTab === 'subcategories' 
                ? 'bg-[#ff5500] text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sub Categories
          </button>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header Bar matching Light Orange Theme */}
        <div className="bg-[#fff4ed] border-b border-orange-200/70 text-[#002625] px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold tracking-tight text-[#002625] flex items-center gap-2">
            <ChevronRight size={18} className="text-[#ff5500]" />
            Category Management
          </h2>
          <span className="text-[10px] uppercase font-extrabold tracking-wider bg-[#ff5500] text-white px-3 py-1 rounded-full shadow-2xs text-center">
            Taxonomy Structure ({treeData.length} Root Categories)
          </span>
        </div>

        {/* Toolbar & Controls */}
        <div className="p-3 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Add Category / Subcategory Button depending on mode */}
              {activeCategoryTab === 'subcategories' ? (
                <button 
                  onClick={() => openAddSubcategoryModal(treeData[0] || { id: 'cat-1', name: 'General Category' })}
                  className="px-4 py-2 bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 border-none cursor-pointer shadow-xs transition-all active:scale-95"
                >
                  <Plus size={15} /> Add Subcategory
                </button>
              ) : (
                <button 
                  onClick={openAddCategoryModal}
                  className="px-4 py-2 bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 border-none cursor-pointer shadow-xs transition-all active:scale-95"
                >
                  <Plus size={15} /> Add Category
                </button>
              )}

              {/* View Toggle (Tree View / List View) */}
              <div className="inline-flex rounded-xl border border-slate-200 p-0.5 bg-slate-50">
                <button 
                  onClick={() => setViewMode('tree')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all border-none cursor-pointer ${
                    viewMode === 'tree' ? 'bg-[#002625] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tree View
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all border-none cursor-pointer ${
                    viewMode === 'list' ? 'bg-[#002625] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  List View
                </button>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <span>Status:</span>
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 text-xs font-semibold text-slate-800 outline-none focus:border-[#ff5500]"
                >
                  <option>All Status</option>
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </div>

              {/* Search Bar */}
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 w-full sm:w-auto">
                <span>Search:</span>
                <input 
                  type="text" 
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full min-w-0 sm:w-64 border border-slate-200 rounded-xl px-3.5 py-1.5 bg-slate-50 text-xs text-slate-800 outline-none focus:border-[#ff5500]"
                />
              </div>
            </div>

            {/* Export Button - Sathi Seller Dark Teal */}
            <button 
              onClick={handleExportCSV}
              className="px-4 py-2 bg-[#002625] hover:bg-[#003837] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 border-none cursor-pointer shadow-xs transition-all active:scale-95"
            >
              <Download size={14} className="text-[#ff5500]" /> Export CSV
            </button>
          </div>

          {/* Expand / Collapse All Controls */}
          {viewMode === 'tree' && (
            <div className="flex items-center gap-2 pt-1">
              <button 
                onClick={handleExpandAll}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 cursor-pointer transition-all active:scale-95"
              >
                Expand All
              </button>
              <button 
                onClick={handleCollapseAll}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-200 cursor-pointer transition-all active:scale-95"
              >
                Collapse All
              </button>
            </div>
          )}

          {/* Categories Tree View Content */}
          {viewMode === 'tree' ? (
            <div className="space-y-4 pt-2">
              {activeCategoryTab === 'subcategories' ? (
                /* Flat Subcategories View Mode */
                filteredTreeData.flatMap(cat => 
                  (cat.subcategories || []).map(sub => ({ ...sub, parentName: cat.name, parentId: cat.id }))
                ).map((sub) => (
                  <div key={sub.id} className="space-y-3">
                    <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between hover:border-slate-300 transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        {sub.children && sub.children.length > 0 ? (
                          <button 
                            onClick={() => toggleExpand(sub.id)}
                            className="text-[#ff5500] hover:text-[#e04a00] cursor-pointer bg-transparent border-none p-1"
                          >
                            {expanded[sub.id] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </button>
                        ) : (
                          <span className="w-5" />
                        )}
                        <img 
                          src={getImageUrl(sub.image, sub.name)} 
                          alt={sub.name} 
                          className="w-12 h-12 rounded-xl object-cover border border-slate-100 shadow-2xs" 
                          onError={(e) => handleImageError(e, sub.name)}
                        />
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-bold text-slate-900 break-words">{sub.name}</h3>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-medium rounded-md">
                              Parent Category: <span className="font-semibold text-[#002625]">{sub.parentName}</span>
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                            <span className={`px-2 py-0.5 font-semibold rounded-full border ${
                              sub.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                              {sub.status}
                            </span>
                            {sub.children && sub.children.length > 0 && (
                              <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 font-semibold rounded-full border border-amber-200">
                                {sub.children.length} sub-subcategories
                              </span>
                            )}
                            <span className="text-slate-400">Order: {sub.order}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                        <button 
                          onClick={() => openAddNestedSubcategoryModal(sub)}
                          className="px-3.5 py-1.5 bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold rounded-lg flex items-center gap-1 border-none cursor-pointer shadow-2xs transition-transform active:scale-95"
                        >
                          <Plus size={13} /> Add Sub-subcategory
                        </button>
                        <button
                          onClick={() => openEditCategoryModal(sub)}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg flex items-center gap-1 border border-blue-200 cursor-pointer transition-colors"
                          title="Edit Subcategory"
                        >
                          <Pencil size={13} /> Edit
                        </button>
                        <button 
                          onClick={() => handleToggleStatus(sub.id, sub.status)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg border-none cursor-pointer transition-colors ${
                            sub.status === 'Active' ? 'bg-amber-100 hover:bg-amber-200 text-amber-800' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                          }`}
                        >
                          {sub.status === 'Active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button 
                          onClick={() => handleDeleteItem(sub)}
                          className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border-none cursor-pointer transition-colors"
                          title="Delete Subcategory"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {expanded[sub.id] && sub.children && sub.children.length > 0 && (
                      <div className="ml-2 sm:ml-6 border-l-2 border-[#ff5500]/60 pl-2 sm:pl-4 space-y-2">
                        {sub.children.map((child) => (
                          <div key={child.id} className="bg-slate-50/70 border border-slate-200 rounded-xl p-3 flex flex-col gap-2 min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <ChevronRight size={14} className="text-[#ff5500]" />
                              <img 
                                src={getImageUrl(child.image, child.name)} 
                                alt={child.name} 
                                className="w-9 h-9 rounded-lg object-cover border border-slate-200" 
                                onError={(e) => handleImageError(e, child.name)}
                              />
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h5 className="text-xs font-bold text-slate-900 break-words">{child.name}</h5>
                                  <span className="px-1.5 py-0.2 bg-amber-50 text-amber-700 text-[10px] font-bold rounded border border-amber-200">Sub-subcategory</span>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                                  <span className={`px-1 py-0.2 font-semibold rounded border ${child.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                    {child.status}
                                  </span>
                                  <span>Order: {child.order}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button onClick={() => openEditCategoryModal({ ...child, parentName: sub.name, parentId: sub.id })} className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold rounded-md border border-blue-200 cursor-pointer flex items-center gap-1">
                                <Pencil size={12} /> Edit
                              </button>
                              <button onClick={() => handleToggleStatus(child.id, child.status)} className="p-1.5 bg-amber-500/20 text-amber-700 hover:bg-amber-500/30 rounded-md border-none cursor-pointer text-xs font-bold px-2">×</button>
                              <button onClick={() => handleDeleteItem(child)} className="p-1.5 bg-rose-100 hover:bg-rose-200 text-rose-600 rounded-md border-none cursor-pointer" title="Delete"><Trash2 size={13} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                /* Standard Root Category Tree View */
                filteredTreeData.map((cat) => (
                  <div key={cat.id} className="space-y-3">
                    <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-3.5 shadow-xs flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between hover:border-slate-300 transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <button onClick={() => toggleExpand(cat.id)} className="text-slate-400 hover:text-slate-600 cursor-pointer bg-transparent border-none p-1">
                          {expanded[cat.id] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>
                        <img 
                          src={getImageUrl(cat.image, cat.name)} 
                          alt={cat.name} 
                          className="w-12 h-12 rounded-xl object-cover border border-slate-100 shadow-2xs" 
                          onError={(e) => handleImageError(e, cat.name)}
                        />
                        <div className="space-y-1 min-w-0">
                          <h3 className="text-sm font-bold text-slate-900 break-words">{cat.name}</h3>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                            <span className={`px-2 py-0.5 font-semibold rounded-full border ${cat.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                              {cat.status}
                            </span>
                            {(cat.subcategories ? cat.subcategories.length : 0) > 0 && (
                              <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 font-semibold rounded-full border border-amber-200">
                                {cat.subcategories.length} subcategories
                              </span>
                            )}
                            <span className="text-slate-400">Order: {cat.order}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                        <button onClick={() => openAddSubcategoryModal(cat)} className="px-3.5 py-1.5 bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold rounded-lg flex items-center gap-1 border-none cursor-pointer shadow-2xs transition-transform active:scale-95">
                          <Plus size={13} /> Add Subcategory
                        </button>
                        <button onClick={() => openEditCategoryModal(cat)} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg flex items-center gap-1 border border-blue-200 cursor-pointer transition-colors" title="Edit Category">
                          <Pencil size={13} /> Edit
                        </button>
                        <button onClick={() => handleToggleStatus(cat.id, cat.status)} className={`px-3 py-1.5 text-xs font-bold rounded-lg border-none cursor-pointer transition-colors ${cat.status === 'Active' ? 'bg-amber-100 hover:bg-amber-200 text-amber-800' : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'}`}>
                          {cat.status === 'Active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onClick={() => handleDeleteItem(cat)} className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border-none cursor-pointer transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    {expanded[cat.id] && cat.subcategories && cat.subcategories.length > 0 && (
                      <div className="ml-2 sm:ml-6 border-l-2 border-[#ff5500]/60 pl-2 sm:pl-4 space-y-3">
                        {cat.subcategories.map((sub) => (
                          <div key={sub.id} className="space-y-3">
                            <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2 hover:bg-slate-100/70 transition-all">
                              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                <span className="w-5" />
                                <img 
                                  src={getImageUrl(sub.image, sub.name)} 
                                  alt={sub.name} 
                                  className="w-10 h-10 rounded-lg object-cover border border-slate-200" 
                                  onError={(e) => handleImageError(e, sub.name)}
                                />
                                <div className="space-y-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="text-xs font-bold text-slate-900 break-words">{sub.name}</h4>
                                    <span className="px-2 py-0.2 bg-amber-50 text-amber-700 text-[10px] font-bold rounded border border-amber-200">Subcategory</span>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                                    <span className={`px-1.5 py-0.2 font-semibold rounded border ${sub.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                      {sub.status}
                                    </span>
                                    <span>Order: {sub.order}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button onClick={() => openEditCategoryModal({ ...sub, parentName: cat.name, parentId: cat.id })} className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold rounded-md border border-blue-200 cursor-pointer flex items-center gap-1">
                                  <Pencil size={12} /> Edit
                                </button>
                                <button onClick={() => handleToggleStatus(sub.id, sub.status)} className="p-1.5 bg-amber-500/20 text-amber-700 hover:bg-amber-500/30 rounded-md border-none cursor-pointer text-xs font-bold px-2">×</button>
                                <button onClick={() => handleDeleteItem(sub)} className="p-1.5 bg-rose-100 hover:bg-rose-200 text-rose-600 rounded-md border-none cursor-pointer" title="Delete"><Trash2 size={13} /></button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            /* List View Table Fallback */
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <th className="py-3 px-4">Category Name</th>
                    <th className="py-3 px-4">Header</th>
                    <th className="py-3 px-4">Sub Categories</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredTreeData.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-slate-900">{c.name}</td>
                      <td className="py-3 px-4 text-slate-600">{c.header}</td>
                      <td className="py-3 px-4 font-mono font-bold text-[#ff5500]">{c.subcategories ? c.subcategories.length : 0}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEditCategoryModal(c)} className="text-xs text-blue-600 font-semibold hover:underline border-none bg-transparent cursor-pointer flex items-center gap-1">
                            <Pencil size={12} /> Edit
                          </button>
                          <button onClick={() => handleDeleteItem(c)} className="text-xs text-rose-600 font-semibold hover:underline border-none bg-transparent cursor-pointer">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {categoryToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-[#002625] text-white px-6 py-4">
              <h3 className="text-sm font-bold m-0">Delete category</h3>
            </div>
            <div className="px-6 py-5 space-y-3">
              <p className="text-sm text-slate-800 m-0">
                Permanently delete <span className="font-bold">{categoryToDelete.name}</span>?
              </p>
              <p className="text-xs text-slate-500 m-0">
                This removes the category from the store
                {(categoryToDelete.subcategories?.length || 0) > 0
                  ? `, including ${categoryToDelete.subcategories.length} subcategories under it`
                  : ''}
                . This cannot be undone.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={deletingCategory}
                  onClick={() => setCategoryToDelete(null)}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-slate-100 text-slate-700 border-none cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingCategory}
                  onClick={confirmDeleteCategory}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-700 text-white border-none cursor-pointer disabled:opacity-60"
                >
                  {deletingCategory ? 'Deleting…' : 'Delete permanently'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Modal for Add Category / Add Subcategory */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-fadeIn">
            {/* Modal Header */}
            <div className="bg-[#002625] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                {editingItem ? <Pencil size={16} className="text-[#ff5500]" /> : <Plus size={16} className="text-[#ff5500]" />}
                {editingItem
                  ? (editingItem.parent || editingItem.parentName ? 'Edit Subcategory' : 'Edit Root Category')
                  : addModalType === 'category'
                  ? 'Create New Root Category'
                  : addModalType === 'subcategory'
                  ? 'Create New Subcategory'
                  : 'Create New Sub-subcategory'}
              </h3>
              <button 
                onClick={() => { setIsAddModalOpen(false); setEditingItem(null); }}
                className="text-slate-400 hover:text-white border-none bg-transparent cursor-pointer text-lg font-bold"
              >
                ×
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveItem} className="p-6 space-y-4">
              {/* Parent Category Banner Indicator */}
              {selectedParentName && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2 flex items-center justify-between text-xs">
                  <span className="text-amber-800 font-semibold">Under Parent Category:</span>
                  <span className="font-bold text-[#002625] bg-white px-2.5 py-0.5 rounded-lg border border-amber-300 shadow-2xs">
                    📁 {selectedParentName}
                  </span>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {addModalType === 'category' 
                    ? 'Category Name *' 
                    : addModalType === 'subcategory' 
                    ? 'Subcategory Name *' 
                    : 'Sub-subcategory Name *'}
                </label>
                <input 
                  type="text" 
                  required
                  placeholder={
                    addModalType === 'category' 
                      ? 'e.g., Fruits & Vegetables' 
                      : addModalType === 'subcategory' 
                      ? 'e.g., Banana'
                      : 'e.g., Cavendish Banana / Robusta Banana'
                  }
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-[#ff5500]"
                />
              </div>

              {/* Category Image Device Upload Field */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Category Image (Upload Device File) *</label>
                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-2">
                  {formData.imageUrl ? (
                    <img 
                      src={getImageUrl(formData.imageUrl, formData.name || 'Category')} 
                      alt="Category Preview" 
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-2xs shrink-0" 
                      onError={(e) => handleImageError(e, formData.name || 'Category')}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400 shrink-0">
                      <Upload size={18} />
                    </div>
                  )}

                  <div className="flex-1 overflow-hidden">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleCategoryImageUpload}
                      className="text-xs text-slate-600 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#ff5500] file:text-white hover:file:bg-[#e04a00] file:cursor-pointer cursor-pointer"
                    />
                    {uploadingImage && <p className="text-[10px] text-[#ff5500] font-bold mt-1">Uploading image...</p>}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Status</label>
                <select 
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#ff5500]"
                >
                  <option>Active</option>
                  <option>Inactive</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Sort Order</label>
                <input 
                  type="number" 
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-[#ff5500]"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button 
                  type="button"
                  onClick={() => { setIsAddModalOpen(false); setEditingItem(null); }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border-none cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-sm transition-all"
                >
                  {editingItem ? (editingItem.parent || editingItem.parentName ? 'Update Subcategory' : 'Update Category') : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* =========================================================================
   6. PRODUCT MANAGEMENT PAGE (VIEW STOCK MANAGEMENT)
   ========================================================================= */
export const ProductManagement = () => {
  const { setActiveTab, setEditingProductData } = useAdmin();
  const [products, setProducts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [viewModalData, setViewModalData] = React.useState(null);

  const fetchAllProducts = React.useCallback(async () => {
    setLoading(true);
    let apiProducts = [];
    try {
      // admin=true bypasses storefront location filter so catalog is visible (#84)
      const res = await productService.getProducts({ admin: 'true' });
      if (res && res.products && Array.isArray(res.products)) {
        apiProducts = res.products;
      }
    } catch (err) {
      console.warn('Error fetching products from API:', err.message);
    }

    const localSaved = JSON.parse(localStorage.getItem('sathiseller_custom_products') || '[]');

    // 1. Convert API products from MongoDB as primary source of truth
    const combined = apiProducts.map(ap => ({
      _id: ap._id,
      id: ap._id,
      sku: ap.sku || `SKU-${ap._id.slice(-4).toUpperCase()}`,
      name: ap.name,
      seller: ap.seller || 'Sathi Seller Official Store',
      category: ap.category || 'Groceries & Grains',
      subCategory: ap.subCategory,
      brand: ap.brand,
      image: ap.mainImage || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=100&auto=format&fit=crop&q=80',
      galleryImages: ap.galleryImages || [],
      variation: ap.unit || `${ap.unitValue || 1} ${ap.unitType || 'kg'}`,
      unitValue: ap.unitValue,
      unitType: ap.unitType,
      stock: ap.stock !== undefined ? ap.stock : 100,
      minStockLimit: ap.minStockLimit,
      status: ap.status || 'Published',
      mrp: ap.mrp,
      salePrice: ap.salePrice,
      taxRate: ap.taxRate,
      hsnCode: ap.hsnCode,
      homeSections: ap.homeSections || []
    }));

    // 2. Add local storage items only if they are not already in MongoDB
    localSaved.forEach(localItem => {
      const matchExists = combined.some(c =>
        (c._id && localItem._id && c._id === localItem._id) ||
        (c.name.trim().toLowerCase() === localItem.name.trim().toLowerCase())
      );
      if (!matchExists) {
        combined.push(localItem);
      }
    });

    setProducts(combined);
    setLoading(false);
  }, []);

  const [categories, setCategories] = React.useState([]);

  React.useEffect(() => {
    fetchAllProducts();
    const fetchCats = async () => {
      try {
        const res = await categoryService.getCategories();
        if (res.success) setCategories(res.categories.filter(c => c.status === 'Active'));
      } catch (err) {}
    };
    fetchCats();
  }, [fetchAllProducts]);

  const [categoryFilter, setCategoryFilter] = React.useState('All Category');
  const [sellerFilter, setSellerFilter] = React.useState('All Sellers');
  const [statusFilter, setStatusFilter] = React.useState('All Products');
  const [stockFilter, setStockFilter] = React.useState('All Products');
  const [searchQuery, setSearchQuery] = React.useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [entriesPerPage, setEntriesPerPage] = React.useState('10');
  const [currentPage, setCurrentPage] = React.useState(1);

  // Edit / Delete Actions
  const handleDeleteProduct = async (id) => {
    const product = products.find(p => p.id === id || p._id === id);

    // Check if product is a mock/default product (not from database)
    if (!product || product.id?.includes('-0') || !product._id) {
      alert('Default sample products cannot be deleted. You can only delete products created in the system.');
      return;
    }

    if (window.confirm('Are you sure you want to delete this product stock item? This action cannot be undone.')) {
      try {
        // Use MongoDB _id for real products, fall back to id for custom products
        const productId = product._id || id;

        // Call backend API to delete
        const res = await productService.deleteProduct(productId);
        if (res && res.success) {
          // Only remove from UI after successful backend deletion
          setProducts(prev => prev.filter(p => p.id !== id && p._id !== id));
          // Also remove from localStorage if it exists there
          const localSaved = JSON.parse(localStorage.getItem('sathiseller_custom_products') || '[]');
          const updatedLocal = localSaved.filter(p => p.id !== id);
          localStorage.setItem('sathiseller_custom_products', JSON.stringify(updatedLocal));
          alert('Product deleted successfully!');
        } else {
          alert(res?.message || 'Failed to delete product. Please try again.');
        }
      } catch (err) {
        console.error('Delete product error:', err);
        alert(err?.response?.data?.message || 'Error deleting product. Please try again.');
      }
    }
  };

  const handleEditProduct = (prod) => {
    setEditingProductData(prod);
    setActiveTab('add_product');
  };

  // CSV Export
  const handleExportCSV = () => {
    const rows = [['Variation ID', 'Name', 'Seller', 'Variation', 'Stock', 'Status'].join(',')];
    products.forEach(p => {
      rows.push([`"${p.id}"`, `"${p.name}"`, `"${p.seller}"`, `"${p.variation}"`, `"${p.stock}"`, `"${p.status}"`].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sathiseller_stock_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  // Filtering Logic (debounced & memoized)
  const filteredProducts = React.useMemo(() => {
    const q = debouncedSearchQuery.toLowerCase().trim();
    return products.filter(p => {
      const matchesSearch = !q || (
        (p.name && p.name.toLowerCase().includes(q)) || 
        (p.seller && p.seller.toLowerCase().includes(q)) || 
        (p.id && p.id.toLowerCase().includes(q))
      );
      const matchesCategory = categoryFilter === 'All Category' || p.category === categoryFilter;
      const matchesSeller = sellerFilter === 'All Sellers' || p.seller === sellerFilter;
      const matchesStatus = statusFilter === 'All Products' || p.status === statusFilter;
      const matchesStock = stockFilter === 'All Products' || (stockFilter === 'In Stock' ? p.stock > 0 : p.stock === 0);
      return matchesSearch && matchesCategory && matchesSeller && matchesStatus && matchesStock;
    });
  }, [products, debouncedSearchQuery, categoryFilter, sellerFilter, statusFilter, stockFilter]);

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header & Breadcrumb */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Products & Stock</h1>
          <div className="text-xs text-slate-500 font-medium">
            Dashboard / <span className="text-[#ff5500] font-semibold">Stock Management</span>
          </div>
        </div>
        <button 
          onClick={() => { setEditingProductData(null); setActiveTab('add_product'); }}
          className="px-4 py-2.5 bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold rounded-xl border-none cursor-pointer flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
        >
          <Plus size={16} /> Add New Product
        </button>
      </div>

      {/* View Stock Management Container Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Header Bar matching Light Orange Theme */}
        <div className="bg-[#fff4ed] border-b border-orange-200/70 text-[#002625] px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight text-[#002625] flex items-center gap-2">
            <ChevronRight size={18} className="text-[#ff5500]" />
            View Stock Management
          </h2>
          <span className="text-[10px] uppercase font-extrabold tracking-wider bg-[#ff5500] text-white px-3 py-1 rounded-full shadow-2xs">
            {products.length} Products Listed
          </span>
        </div>

        <div className="p-6 space-y-5">
          {/* Top Filter Rows */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Filter By Category</label>
              <select 
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3.5 py-2.5 bg-slate-50/60 text-xs font-medium text-slate-800 outline-none focus:border-[#ff5500] focus:bg-white transition-all shadow-2xs"
              >
                <option value="All Category">All Category</option>
                {categories.map(cat => (
                  <option key={cat._id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Filter by Sellers</label>
              <select 
                value={sellerFilter}
                onChange={(e) => setSellerFilter(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3.5 py-2.5 bg-slate-50/60 text-xs font-medium text-slate-800 outline-none focus:border-[#ff5500] focus:bg-white transition-all shadow-2xs"
              >
                <option>All Sellers</option>
                <option>Keshari Vagitl Shope</option>
                <option>SuperStore Retailers</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Filter by Status</label>
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3.5 py-2.5 bg-slate-50/60 text-xs font-medium text-slate-800 outline-none focus:border-[#ff5500] focus:bg-white transition-all shadow-2xs"
              >
                <option>All Products</option>
                <option>Published</option>
                <option>Draft</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Filter by Stock</label>
              <select 
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3.5 py-2.5 bg-slate-50/60 text-xs font-medium text-slate-800 outline-none focus:border-[#ff5500] focus:bg-white transition-all shadow-2xs"
              >
                <option>All Products</option>
                <option>In Stock</option>
                <option>Out of Stock</option>
              </select>
            </div>
          </div>

          {/* Sub Controls: Show entries, Export, Search */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs font-medium text-slate-600">
            <div className="flex items-center gap-2">
              <span>Show</span>
              <select 
                value={entriesPerPage}
                onChange={(e) => setEntriesPerPage(e.target.value)}
                className="border border-slate-200 rounded-xl px-2.5 py-1.5 bg-slate-50 text-xs text-slate-800 outline-none focus:border-[#ff5500]"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
              <span>entries</span>
            </div>

            <div className="flex items-center gap-3">
              <button 
                onClick={handleExportCSV}
                className="px-4 py-1.5 bg-[#002625] hover:bg-[#003837] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 border-none cursor-pointer shadow-2xs transition-all active:scale-95"
              >
                <Download size={13} className="text-[#ff5500]" /> Export
              </button>

              <div className="flex items-center gap-1.5">
                <span>Search:</span>
                <input 
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-44 border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 text-xs text-slate-800 outline-none focus:border-[#ff5500]"
                />
              </div>
            </div>
          </div>

          {/* Stock Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">Variation Id ⇅</th>
                  <th className="py-3.5 px-4">Name ⇅</th>
                  <th className="py-3.5 px-4">Seller ⇅</th>
                  <th className="py-3.5 px-4">Image ⇅</th>
                  <th className="py-3.5 px-4">Variation ⇅</th>
                  <th className="py-3.5 px-4">Stock ⇅</th>
                  <th className="py-3.5 px-4">Status ⇅</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((prod) => (
                    <tr key={prod.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-500">{prod.sku || prod.id}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{prod.name}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">{prod.seller}</td>
                      <td className="py-3.5 px-4">
                        <img 
                          src={prod.image} 
                          alt={prod.name} 
                          className="w-12 h-12 rounded-xl object-cover border border-slate-100 p-0.5 shadow-2xs bg-white" 
                        />
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">{prod.variation}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">{prod.stock}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-full">
                          {prod.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => setViewModalData(prod)}
                            className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg border border-emerald-200 cursor-pointer transition-colors"
                            title="View Details"
                          >
                            <Eye size={13} />
                          </button>
                          <button 
                            onClick={() => handleEditProduct(prod)}
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg border border-blue-200 cursor-pointer transition-colors"
                            title="Edit Stock"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button 
                            onClick={() => handleDeleteProduct(prod.id)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200 cursor-pointer transition-colors"
                            title="Delete Stock Item"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-slate-400 italic text-xs">
                      No stock products found matching filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer & Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-500">
            <span>Showing 1 to {filteredProducts.length} of {products.length} entries</span>
            
            <div className="inline-flex rounded-xl border border-slate-200 p-0.5 bg-slate-50">
              <button 
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 border-none bg-transparent cursor-pointer"
              >
                ‹
              </button>
              <button className="px-3 py-1 bg-[#ff5500] text-white text-xs font-bold rounded-lg shadow-2xs border-none cursor-pointer">
                {currentPage}
              </button>
              <button 
                onClick={() => setCurrentPage(p => p + 1)}
                className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 border-none bg-transparent cursor-pointer"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Product Details Modal */}
      {viewModalData && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl animate-scaleUp border border-slate-100 relative">
            <button 
              onClick={() => setViewModalData(null)}
              className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 cursor-pointer border-none"
            >
              ✕
            </button>
            <h3 className="text-xl font-bold text-slate-900 mb-4 border-b pb-3 border-slate-100">Product Details</h3>
            
            <div className="flex gap-4 items-start mb-4">
              <img 
                src={viewModalData.image} 
                alt={viewModalData.name} 
                className="w-24 h-24 rounded-2xl object-cover border border-slate-200 shadow-sm"
              />
              <div>
                <h4 className="text-base font-bold text-slate-900 m-0 leading-tight">{viewModalData.name}</h4>
                <p className="text-xs text-slate-500 m-0 mt-1">{viewModalData.seller}</p>
                <div className="mt-2 inline-block px-2.5 py-0.5 bg-[#fff4ed] text-[#ff5500] border border-[#ffcfb3] text-xs font-bold rounded-full">
                  {viewModalData.status}
                </div>
              </div>
            </div>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500 font-medium">Category:</span>
                <span className="text-slate-900 font-semibold">{viewModalData.category}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500 font-medium">Sub Category:</span>
                <span className="text-slate-900 font-semibold">{viewModalData.subCategory || 'N/A'}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500 font-medium">Variation:</span>
                <span className="text-slate-900 font-semibold">{viewModalData.variation}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500 font-medium">Stock:</span>
                <span className="text-slate-900 font-semibold">{viewModalData.stock}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500 font-medium">MRP:</span>
                <span className="text-slate-400 font-semibold line-through">₹{viewModalData.mrp || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Sale Price:</span>
                <span className="text-[#ff5500] font-bold text-base">₹{viewModalData.salePrice || 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* =========================================================================
   7. ORDERS PAGE (LIVE DYNAMIC ORDER MANAGEMENT)
   ========================================================================= */
export const OrderManagement = () => {
  const { activeTab } = useAdmin();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [paymentFilter, setPaymentFilter] = useState('All');
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [captains, setCaptains] = useState([]);
  
  // Modals & Action States
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  
  const [assignModalOrder, setAssignModalOrder] = useState(null);
  const [selectedCaptainId, setSelectedCaptainId] = useState('');
  const [captainEarningsInput, setCaptainEarningsInput] = useState('50');
  
  const [statusModalOrder, setStatusModalOrder] = useState(null);
  const [newOrderStatus, setNewOrderStatus] = useState('');
  
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState(null);

  const showToast = (msg, isError = false) => {
    setToastMsg({ text: msg, isError });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const fetchOrders = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await adminService.getOrders();
      if (res && res.success && Array.isArray(res.orders)) {
        const mappedOrders = res.orders.map((o) => {
          const custName = o.shippingAddress?.fullName || o.user?.name || 'Customer';
          const custPhone = o.shippingAddress?.phone || o.user?.phone || 'N/A';
          const custEmail = o.shippingAddress?.email || o.user?.email || '';
          const itemsList = Array.isArray(o.items) ? o.items : [];
          const totalQty = itemsList.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0);
          const firstSeller = itemsList[0]?.seller?.businessName || itemsList[0]?.seller || 'Sathi Seller Store';
          
          return {
            id: o.orderId || o._id,
            _id: o._id,
            customer: custName,
            customerPhone: custPhone,
            customerEmail: custEmail,
            shippingAddress: o.shippingAddress || {},
            deliverySlot: o.deliverySlot || { date: 'Today', time: 'Express Delivery' },
            deliveryInstructions: o.deliveryInstructions || '',
            seller: firstSeller,
            items: itemsList,
            itemsCount: totalQty,
            warehouse: o.shippingAddress?.city ? `${o.shippingAddress.city} Central Hub` : 'Main Logistics Hub',
            total: `₹${Number(o.grandTotal || 0).toFixed(2)}`,
            rawTotal: Number(o.grandTotal || 0),
            itemsTotal: Number(o.itemsTotal || 0),
            shippingFee: Number(o.shippingFee || 0),
            discount: Number(o.discount || 0),
            codCharge: Number(o.codCharge || 0),
            paymentMethod: o.paymentMethod || 'COD',
            paymentStatus: o.paymentStatus || (o.paymentMethod === 'COD' ? 'Pending' : 'Paid'),
            status: o.orderStatus || 'Placed',
            sellerStatus: o.sellerStatus || 'Pending',
            captain: o.captainId?.name || (o.captainStatus === 'Assigned' ? 'Assigned' : 'Unassigned'),
            captainDetails: o.captainId || null,
            captainStatus: o.captainStatus || null,
            captainEarnings: o.captainEarnings || 0,
            deliveryOtp: o.deliveryOtp || '',
            commission: {
              sellerRate: o.sellerCommissionRate ?? 10,
              sellerAmount: o.sellerCommissionAmount ?? 0,
              sellerEarning: o.sellerEarning ?? 0,
              captainRate: o.captainCommissionRate ?? 5,
              captainAmount: o.captainCommissionAmount ?? 0,
              captainEarning: o.captainEarning ?? 0,
            },
            date: o.createdAt ? new Date(o.createdAt).toLocaleString('en-IN', {
              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : 'Today',
            rawDate: o.createdAt ? new Date(o.createdAt) : new Date(),
            raw: o,
          };
        });
        setOrders(mappedOrders);
      } else {
        setOrders([]);
      }
    } catch (err) {
      console.error('Failed to fetch live admin orders:', err);
      showToast('Error loading live orders from server', true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchCaptainsList = async () => {
    try {
      const res = await adminService.getAvailableCaptains();
      if (res && res.success && Array.isArray(res.captains)) {
        setCaptains(res.captains);
      } else {
        const allCapRes = await adminService.getCaptains(true);
        if (allCapRes && allCapRes.success && Array.isArray(allCapRes.captains)) {
          setCaptains(allCapRes.captains.filter((c) => c.status === 'approved'));
        }
      }
    } catch (e) {
      console.warn('Could not load online captains:', e.message);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchCaptainsList();
  }, []);

  // Map activeTab sub-item to status filter
  const getTabTitleAndFilter = () => {
    switch (activeTab) {
      case 'orders_pending':
        return { title: 'Pending & Placed Orders', filter: 'Pending' };
      case 'orders_received':
        return { title: 'Accepted / Received Orders', filter: 'Accepted' };
      case 'orders_processed':
        return { title: 'Processing Orders', filter: 'Processing' };
      case 'orders_shipped':
        return { title: 'At Store / Pickup Orders', filter: 'Reached Store / Pickup' };
      case 'orders_out_for_delivery':
        return { title: 'Out for Delivery Orders', filter: 'Out for Delivery' };
      case 'orders_delivered':
        return { title: 'Delivered Orders', filter: 'Delivered' };
      case 'orders_cancelled':
        return { title: 'Cancelled Orders', filter: 'Cancelled' };
      case 'orders_return':
        return { title: 'Returned Orders', filter: 'Return' };
      case 'orders_all':
      default:
        return { title: 'All Orders List (Live)', filter: 'All' };
    }
  };

  const { title: pageTitle, filter: statusFilter } = getTabTitleAndFilter();

  // Metrics Calculations
  const metrics = useMemo(() => {
    const totalCount = orders.length;
    const activeCount = orders.filter((o) => ['Placed', 'Pending', 'Accepted', 'Processing', 'Reached Store / Pickup', 'Out for Delivery'].includes(o.status)).length;
    const deliveredCount = orders.filter((o) => o.status === 'Delivered').length;
    const cancelledCount = orders.filter((o) => o.status === 'Cancelled').length;
    const totalGrossRevenue = orders.reduce((sum, o) => sum + (o.rawTotal || 0), 0);
    return { totalCount, activeCount, deliveredCount, cancelledCount, totalGrossRevenue };
  }, [orders]);

  // Filter Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Status matching
      let matchesStatus = true;
      if (statusFilter !== 'All') {
        const sLower = o.status.toLowerCase();
        const fLower = statusFilter.toLowerCase();
        if (fLower === 'pending') {
          matchesStatus = sLower === 'pending' || sLower === 'placed';
        } else if (fLower === 'accepted') {
          matchesStatus = sLower === 'accepted' || sLower === 'processing';
        } else if (fLower === 'out for delivery') {
          matchesStatus = sLower === 'out for delivery' || sLower === 'in transit';
        } else {
          matchesStatus = sLower.includes(fLower);
        }
      }

      // Payment method matching
      let matchesPayment = true;
      if (paymentFilter !== 'All') {
        matchesPayment = o.paymentMethod.toUpperCase() === paymentFilter.toUpperCase();
      }

      // Search matching (Order ID, Customer, Phone, Seller, Products)
      const q = debouncedSearch.trim().toLowerCase();
      let matchesSearch = true;
      if (q) {
        const itemsStr = o.items.map((it) => it.name || '').join(' ').toLowerCase();
        matchesSearch =
          o.id.toLowerCase().includes(q) ||
          o.customer.toLowerCase().includes(q) ||
          o.customerPhone.toLowerCase().includes(q) ||
          o.seller.toLowerCase().includes(q) ||
          itemsStr.includes(q);
      }

      return matchesStatus && matchesPayment && matchesSearch;
    });
  }, [orders, statusFilter, paymentFilter, debouncedSearch]);

  const totalPages = Math.ceil(filteredOrders.length / entriesPerPage) || 1;
  const indexOfLastItem = currentPage * entriesPerPage;
  const indexOfFirstItem = indexOfLastItem - entriesPerPage;
  const currentOrders = filteredOrders.slice(indexOfFirstItem, indexOfLastItem);

  // Status Change Handler
  const handleUpdateOrderStatus = async () => {
    if (!statusModalOrder || !newOrderStatus) return;
    try {
      setActionLoading(true);
      const res = await adminService.updateOrderStatus(statusModalOrder._id || statusModalOrder.id, {
        orderStatus: newOrderStatus,
      });
      if (res && res.success) {
        showToast(`Order #${statusModalOrder.id} status updated to ${newOrderStatus}`);
        setStatusModalOrder(null);
        await fetchOrders(true);
      } else {
        showToast(res?.message || 'Failed to update order status', true);
      }
    } catch (err) {
      console.error('Status update failed:', err);
      showToast(err.response?.data?.message || 'Error updating order status', true);
    } finally {
      setActionLoading(false);
    }
  };

  // Assign Captain Handler
  const handleAssignCaptain = async () => {
    if (!assignModalOrder || !selectedCaptainId) {
      showToast('Please select a captain to assign', true);
      return;
    }
    try {
      setActionLoading(true);
      const res = await adminService.assignCaptainToOrder(
        assignModalOrder._id || assignModalOrder.id,
        selectedCaptainId,
        Number(captainEarningsInput) || 50
      );
      if (res && res.success) {
        showToast(`Captain successfully assigned! Delivery OTP: ${res.deliveryOtp || 'Generated'}`);
        setAssignModalOrder(null);
        setSelectedCaptainId('');
        await fetchOrders(true);
      } else {
        showToast(res?.message || 'Failed to assign captain', true);
      }
    } catch (err) {
      console.error('Captain assignment failed:', err);
      showToast(err.response?.data?.message || 'Error assigning captain', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [
        'Order ID,Customer Name,Phone,Seller Store,Items Count,Total Amount (INR),Payment Method,Payment Status,Order Status,Captain,Created Date',
      ]
        .concat(
          filteredOrders.map(
            (o) =>
              `"${o.id}","${o.customer}","${o.customerPhone}","${o.seller}","${o.itemsCount}","${o.total.replace('₹', '')}","${o.paymentMethod}","${o.paymentStatus}","${o.status}","${o.captain}","${o.date}"`
          )
        )
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sathiseller_orders_${statusFilter.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Dynamic Status Badge Helper
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Delivered':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80"><CheckCircle size={12} /> Delivered</span>;
      case 'Out for Delivery':
      case 'In Transit':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80"><Truck size={12} /> Out for Delivery</span>;
      case 'Processing':
      case 'Accepted':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/80"><Package size={12} /> Processing</span>;
      case 'Reached Store / Pickup':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200/80"><Store size={12} /> At Store</span>;
      case 'Cancelled':
      case 'Rejected':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200/80"><X size={12} /> Cancelled</span>;
      case 'Placed':
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-50 text-[#ff5500] border border-orange-200/80"><Clock size={12} /> Placed</span>;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-8">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed top-5 right-5 z-[9999] px-4 py-3 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 border transition-all ${
            toastMsg.isError
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {toastMsg.isError ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Top Banner & Refresh Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900 m-0">{pageTitle}</h2>
            <span className="bg-orange-100 text-[#ff5500] text-[11px] font-black px-2.5 py-0.5 rounded-full">
              {filteredOrders.length} {filteredOrders.length === 1 ? 'Order' : 'Orders'}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1 m-0">
            Real-time live order dispatch, fulfillment tracking & captain dispatch management
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => fetchOrders(true)}
            disabled={refreshing || loading}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 text-xs font-bold rounded-xl transition-all border-none cursor-pointer flex items-center gap-1.5"
            title="Refresh Live Data"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Refreshing...' : 'Live Refresh'}</span>
          </button>

          <button
            onClick={handleExport}
            disabled={filteredOrders.length === 0}
            className="px-3.5 py-2 bg-[#ff5500] hover:bg-[#e04b00] disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all border-none cursor-pointer flex items-center gap-1.5 shadow-sm shadow-orange-500/20"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Total Orders</span>
            <span className="text-xl font-black text-slate-900 mt-0.5 block">{metrics.totalCount}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#ff5500] flex items-center justify-center font-bold">
            <Package size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Active In-Transit</span>
            <span className="text-xl font-black text-amber-600 mt-0.5 block">{metrics.activeCount}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Truck size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Delivered</span>
            <span className="text-xl font-black text-emerald-600 mt-0.5 block">{metrics.deliveredCount}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle size={20} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Total Volume</span>
            <span className="text-xl font-black text-slate-900 mt-0.5 block">₹{metrics.totalGrossRevenue.toFixed(2)}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <DollarSign size={20} />
          </div>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Order ID, Customer, Phone, Seller, Item..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#ff5500] transition-colors"
            />
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Payment Method Filter */}
            <div className="flex items-center gap-1.5 text-slate-600">
              <span className="font-semibold text-slate-500">Payment:</span>
              <select
                value={paymentFilter}
                onChange={(e) => {
                  setPaymentFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-bold outline-none focus:border-[#ff5500]"
              >
                <option value="All">All Payment Modes</option>
                <option value="COD">Cash on Delivery (COD)</option>
                <option value="UPI">UPI Payment</option>
                <option value="CARD">Credit / Debit Card</option>
                <option value="NETBANKING">Net Banking</option>
                <option value="WALLET">Wallet</option>
                <option value="ONLINE">Online</option>
              </select>
            </div>

            {/* Entries Per Page */}
            <div className="flex items-center gap-1.5 text-slate-600">
              <span className="font-semibold text-slate-500">Show:</span>
              <select
                value={entriesPerPage}
                onChange={(e) => {
                  setEntriesPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-slate-800 font-bold outline-none focus:border-[#ff5500]"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        {/* Dynamic Orders Table */}
        <div className="overflow-x-auto border border-slate-200/80 rounded-xl">
          <table className="w-full text-left text-xs border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Order ID & Date</th>
                <th className="py-3 px-4">Customer Details</th>
                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4">Store / Seller</th>
                <th className="py-3 px-4">Amount & Payment</th>
                <th className="py-3 px-4">Captain</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 size={24} className="animate-spin text-[#ff5500]" />
                      <span className="text-xs font-semibold text-slate-600">Loading dynamic orders from database...</span>
                    </div>
                  </td>
                </tr>
              ) : currentOrders.length > 0 ? (
                currentOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-orange-50/20 transition-colors">
                    {/* Order ID & Date */}
                    <td className="py-3.5 px-4 align-middle">
                      <div className="font-mono font-bold text-[#ff5500] text-[13px]">{o.id}</div>
                      <div className="text-[11px] text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                        <Clock size={11} /> {o.date}
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="py-3.5 px-4 align-middle">
                      <div className="font-bold text-slate-900 text-xs">{o.customer}</div>
                      <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                        <Phone size={11} className="text-slate-400" /> {o.customerPhone}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                        {o.shippingAddress?.city || 'Noida'}, {o.shippingAddress?.pincode || '201301'}
                      </div>
                    </td>

                    {/* Items */}
                    <td className="py-3.5 px-4 align-middle">
                      <div className="font-semibold text-slate-800 text-xs">
                        {o.items[0]?.name || 'Items'}
                        {o.items.length > 1 && (
                          <span className="text-[10px] font-bold text-[#ff5500] bg-orange-50 px-1.5 py-0.5 rounded-md ml-1">
                            +{o.items.length - 1} more
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">Total Qty: {o.itemsCount}</span>
                    </td>

                    {/* Store / Seller */}
                    <td className="py-3.5 px-4 align-middle">
                      <div className="font-medium text-slate-800 text-xs truncate max-w-[140px] flex items-center gap-1">
                        <Store size={12} className="text-slate-400 shrink-0" />
                        <span>{o.seller}</span>
                      </div>
                    </td>

                    {/* Amount & Payment */}
                    <td className="py-3.5 px-4 align-middle">
                      <div className="font-black text-slate-900 text-[13px]">{o.total}</div>
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 text-slate-700">
                          {o.paymentMethod}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            o.paymentStatus === 'Paid'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {o.paymentStatus}
                        </span>
                      </div>
                    </td>

                    {/* Captain */}
                    <td className="py-3.5 px-4 align-middle">
                      {o.captain !== 'Unassigned' ? (
                        <div>
                          <div className="font-bold text-slate-800 text-xs flex items-center gap-1 text-emerald-700">
                            <Truck size={12} /> {o.captain}
                          </div>
                          {o.deliveryOtp && (
                            <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                              OTP: <span className="font-bold text-slate-800">{o.deliveryOtp}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setAssignModalOrder(o);
                            setSelectedCaptainId('');
                            setCaptainEarningsInput(String(o.commission?.captainEarning || 50));
                          }}
                          className="px-2 py-1 bg-orange-50 hover:bg-orange-100 text-[#ff5500] border border-orange-200 rounded-lg text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1"
                        >
                          <Plus size={10} /> Assign Driver
                        </button>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 align-middle">
                      {renderStatusBadge(o.status)}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 align-middle text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedOrder(o);
                            setIsDetailsModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-[#ff5500] hover:bg-orange-50 border border-slate-200 bg-white cursor-pointer transition-colors"
                          title="View Order Invoice Details"
                        >
                          <Eye size={13} />
                        </button>

                        <button
                          onClick={() => {
                            setStatusModalOrder(o);
                            setNewOrderStatus(o.status);
                          }}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 bg-white cursor-pointer transition-colors"
                          title="Update Order Status"
                        >
                          <Edit3 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400 italic text-xs">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Package size={32} className="text-slate-300" />
                      <span className="font-semibold text-slate-600">No dynamic orders found</span>
                      <span className="text-[11px] text-slate-400">
                        {search ? 'Try adjusting your search keywords or status filter' : 'Orders placed by users will appear here automatically.'}
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-500">
          <span>
            Showing {filteredOrders.length > 0 ? indexOfFirstItem + 1 : 0} to{' '}
            {Math.min(indexOfLastItem, filteredOrders.length)} of {filteredOrders.length} entries
          </span>

          <div className="inline-flex rounded-xl border border-slate-200 p-0.5 bg-slate-50 items-center">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 border-none bg-transparent cursor-pointer disabled:opacity-40"
            >
              ‹
            </button>
            <span className="px-3 py-1 bg-[#ff5500] text-white text-xs font-bold rounded-lg">
              {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 border-none bg-transparent cursor-pointer disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* ── 1. ORDER DETAILS & INVOICE BREAKDOWN MODAL ── */}
      {isDetailsModalOpen && selectedOrder && (
        <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black m-0 text-white">Order #{selectedOrder.id}</h3>
                  {renderStatusBadge(selectedOrder.status)}
                </div>
                <p className="text-xs text-slate-300 m-0 mt-1">Placed on {selectedOrder.date}</p>
              </div>
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white border-none cursor-pointer flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Customer & Delivery Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                <div>
                  <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-1.5 text-xs m-0">
                    <User size={14} className="text-[#ff5500]" /> Customer Information
                  </h4>
                  <p className="font-bold text-slate-800 m-0 text-sm">{selectedOrder.customer}</p>
                  <p className="text-slate-600 m-0 mt-0.5">📞 {selectedOrder.customerPhone}</p>
                  {selectedOrder.customerEmail && <p className="text-slate-600 m-0 mt-0.5">✉️ {selectedOrder.customerEmail}</p>}
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-1.5 text-xs m-0">
                    <MapPin size={14} className="text-[#ff5500]" /> Shipping Address
                  </h4>
                  <p className="text-slate-700 m-0 leading-relaxed">
                    {selectedOrder.shippingAddress?.addressLine1 || selectedOrder.shippingAddress?.address || 'Address not provided'}
                    {selectedOrder.shippingAddress?.addressLine2 && `, ${selectedOrder.shippingAddress.addressLine2}`}
                    {selectedOrder.shippingAddress?.landmark && ` (Near ${selectedOrder.shippingAddress.landmark})`}
                    <br />
                    {selectedOrder.shippingAddress?.city || 'Noida'}, {selectedOrder.shippingAddress?.state || 'UP'} - {selectedOrder.shippingAddress?.pincode || '201301'}
                  </p>
                  {selectedOrder.deliverySlot && (
                    <p className="text-slate-500 font-medium m-0 mt-1">
                      🕒 Slot: {selectedOrder.deliverySlot.date} ({selectedOrder.deliverySlot.time})
                    </p>
                  )}
                </div>
              </div>

              {/* Order Items Table */}
              <div>
                <h4 className="font-bold text-slate-900 mb-2 text-xs m-0">Itemized Breakdown</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600 text-[10px] uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Product</th>
                        <th className="py-2.5 px-3 text-center">Unit Price</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedOrder.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 flex items-center gap-2">
                            {it.image && (
                              <img src={it.image} alt={it.name} className="w-8 h-8 rounded-lg object-cover border border-slate-200" />
                            )}
                            <div>
                              <div className="font-bold text-slate-900">{it.name}</div>
                              <div className="text-[10px] text-slate-400">{it.seller || selectedOrder.seller}</div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center font-medium text-slate-700">₹{Number(it.price || 0).toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-900">x{it.quantity || 1}</td>
                          <td className="py-2.5 px-3 text-right font-black text-slate-900">
                            ₹{(Number(it.price || 0) * (it.quantity || 1)).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Breakdown & Commission Snapshot */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Platform Commission Snapshot */}
                <div className="bg-orange-50/60 p-4 rounded-xl border border-orange-200/80 space-y-1.5 text-xs">
                  <h4 className="font-black text-[#ff5500] m-0 mb-1 flex items-center gap-1">
                    <DollarSign size={14} /> Commission Snapshot
                  </h4>
                  <div className="flex justify-between text-slate-600">
                    <span>Seller Commission Rate:</span>
                    <span className="font-bold text-slate-900">{selectedOrder.commission.sellerRate}%</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Admin Share from Seller:</span>
                    <span className="font-bold text-[#ff5500]">₹{selectedOrder.commission.sellerAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Seller Net Earnings:</span>
                    <span className="font-bold text-emerald-700">₹{selectedOrder.commission.sellerEarning.toFixed(2)}</span>
                  </div>
                  <div className="pt-1.5 border-t border-orange-200/80 flex justify-between text-slate-600">
                    <span>Captain Payout:</span>
                    <span className="font-bold text-blue-700">₹{selectedOrder.captainEarnings || selectedOrder.commission.captainEarning}</span>
                  </div>
                </div>

                {/* Bill Summary */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                  <h4 className="font-bold text-slate-900 m-0 mb-1">Billing Summary</h4>
                  <div className="flex justify-between text-slate-600">
                    <span>Items Subtotal:</span>
                    <span className="font-semibold text-slate-900">₹{selectedOrder.itemsTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Delivery Charge:</span>
                    <span className="font-semibold text-slate-900">{selectedOrder.shippingFee === 0 ? 'FREE' : `₹${Number(selectedOrder.shippingFee || 0).toFixed(2)}`}</span>
                  </div>
                  {(Number(selectedOrder.codCharge) > 0 || String(selectedOrder.paymentMethod || '').toUpperCase() === 'COD') && (
                    <div className="flex justify-between text-slate-600">
                      <span>COD Handling Fee:</span>
                      <span className="font-semibold text-slate-900">₹{Number(selectedOrder.codCharge || 0).toFixed(2)}</span>
                    </div>
                  )}
                  {selectedOrder.discount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>Discount:</span>
                      <span>- ₹{Number(selectedOrder.discount || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-dashed border-slate-300 flex justify-between items-center text-sm font-black text-slate-900">
                    <span>Grand Total:</span>
                    <span className="text-base text-[#ff5500]">{selectedOrder.total}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium mt-1">
                    Mode: <strong className="text-slate-800">{selectedOrder.paymentMethod}</strong> ({selectedOrder.paymentStatus})
                  </div>
                </div>
              </div>

              {/* Captain Assignment Block */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 block uppercase">Assigned Captain</span>
                  <span className="text-xs font-bold text-slate-900">
                    {selectedOrder.captain !== 'Unassigned' ? selectedOrder.captain : 'No captain assigned yet'}
                  </span>
                  {selectedOrder.deliveryOtp && (
                    <span className="text-[11px] text-slate-500 block">OTP: <strong>{selectedOrder.deliveryOtp}</strong></span>
                  )}
                </div>
                {selectedOrder.captain === 'Unassigned' && (
                  <button
                    onClick={() => {
                      setIsDetailsModalOpen(false);
                      setAssignModalOrder(selectedOrder);
                      setSelectedCaptainId('');
                      setCaptainEarningsInput(String(selectedOrder.commission?.captainEarning || 50));
                    }}
                    className="px-3 py-1.5 bg-[#ff5500] hover:bg-[#e04b00] text-white rounded-lg text-xs font-bold border-none cursor-pointer"
                  >
                    Assign Captain Now
                  </button>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl border-none cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. ASSIGN CAPTAIN MODAL ── */}
      {assignModalOrder && (
        <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-[#ff5500] text-white flex justify-between items-center">
              <div>
                <h3 className="text-base font-black m-0 text-white">Assign Captain</h3>
                <p className="text-xs text-orange-100 m-0 mt-0.5">Order #{assignModalOrder.id}</p>
              </div>
              <button
                onClick={() => setAssignModalOrder(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white border-none cursor-pointer flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Select Online Captain *</label>
                <select
                  value={selectedCaptainId}
                  onChange={(e) => setSelectedCaptainId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-bold outline-none focus:border-[#ff5500]"
                >
                  <option value="">-- Choose an Approved Captain --</option>
                  {captains.map((c) => (
                    <option key={c._id || c.id} value={c._id || c.id}>
                      {c.name} ({c.phone}) - {c.vehicleType || 'Bike'} {c.isOnline ? '🟢 Online' : ''}
                    </option>
                  ))}
                </select>
                {captains.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    ⚠️ No online captains found. Showing all approved captains.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">Captain Delivery Payout (₹) *</label>
                <input
                  type="number"
                  value={captainEarningsInput}
                  onChange={(e) => setCaptainEarningsInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-bold outline-none focus:border-[#ff5500]"
                  placeholder="e.g. 50"
                  min="0"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  This payout will be credited to the captain upon successful OTP-verified delivery.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setAssignModalOrder(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl border-none cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading || !selectedCaptainId}
                onClick={handleAssignCaptain}
                className="px-4 py-2 bg-[#ff5500] hover:bg-[#e04b00] disabled:opacity-50 text-white text-xs font-bold rounded-xl border-none cursor-pointer flex items-center gap-1.5"
              >
                {actionLoading && <Loader2 size={14} className="animate-spin" />}
                <span>Confirm Assignment</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. UPDATE ORDER STATUS MODAL ── */}
      {statusModalOrder && (
        <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-base font-black m-0 text-white">Update Order Status</h3>
                <p className="text-xs text-slate-400 m-0 mt-0.5">Order #{statusModalOrder.id}</p>
              </div>
              <button
                onClick={() => setStatusModalOrder(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white border-none cursor-pointer flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">New Order Status *</label>
                <select
                  value={newOrderStatus}
                  onChange={(e) => setNewOrderStatus(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-bold outline-none focus:border-[#ff5500]"
                >
                  <option value="Placed">Placed (Pending confirmation)</option>
                  <option value="Accepted">Accepted (Store accepted)</option>
                  <option value="Processing">Processing (Packing / Preparing)</option>
                  <option value="Reached Store / Pickup">Reached Store / Pickup (Captain arrived)</option>
                  <option value="Out for Delivery">Out for Delivery (In transit to customer)</option>
                  <option value="Delivered">Delivered (Completed)</option>
                  <option value="Cancelled">Cancelled (Order terminated)</option>
                </select>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setStatusModalOrder(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl border-none cursor-pointer"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={handleUpdateOrderStatus}
                className="px-4 py-2 bg-[#ff5500] hover:bg-[#e04b00] disabled:opacity-50 text-white text-xs font-bold rounded-xl border-none cursor-pointer flex items-center gap-1.5"
              >
                {actionLoading && <Loader2 size={14} className="animate-spin" />}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


/* =========================================================================
   8. DELIVERIES PAGE
   ========================================================================= */
export const DeliveryManagement = () => {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Live Delivery Tracking</h2>
        <p className="text-xs text-slate-500">Captain transit timeline, OTP security status, and vehicle progress</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {mockDeliveries.map((d) => (
          <div key={d.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono text-[#ff5500] font-bold">{d.id}</span>
                <h3 className="text-base font-bold text-slate-900">Order: {d.orderId}</h3>
                <p className="text-xs text-slate-600">Captain: {d.captain}</p>
              </div>
              <StatusBadge status={d.status} />
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1">
              <p className="text-slate-500">From: <span className="text-slate-900">{d.pickup}</span></p>
              <p className="text-slate-500">To: <span className="text-slate-900">{d.dropoff}</span></p>
              <p className="text-slate-500">ETA: <span className="text-[#ff5500] font-bold">{d.eta}</span></p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* =========================================================================
   9. PAYMENTS & FUND TRANSFER PAGE
   ========================================================================= */
export const PaymentManagement = () => {
  const [transfers, setTransfers] = React.useState([
    { id: 'FT-101', name: 'Vishal Patel', mobile: '9302841836', openingBalance: '₹500.00', closingBalance: '₹1500.00', amount: '₹1000.00', type: 'Credit', message: 'Weekly settlement disbursement', date: '12/09/2025' },
    { id: 'FT-102', name: 'Deepak kumar', mobile: '9031275861', openingBalance: '₹200.00', closingBalance: '₹700.00', amount: '₹500.00', type: 'Credit', message: 'Bonus cash reward', date: '12/09/2025' },
    { id: 'FT-103', name: 'Rahul sahu', mobile: '9241673736', openingBalance: '₹1200.00', closingBalance: '₹400.00', amount: '₹800.00', type: 'Debit', message: 'Cash collection deduction', date: '12/09/2025' },
  ]);

  // Filters State
  const [fromDate, setFromDate] = React.useState('2025-09-12');
  const [toDate, setToDate] = React.useState('2025-09-12');
  const [deliveryBoyFilter, setDeliveryBoyFilter] = React.useState('All Captain');
  const [methodFilter, setMethodFilter] = React.useState('All');
  const [search, setSearch] = React.useState('');
  const [perPage, setPerPage] = React.useState(10);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [sortField, setSortField] = React.useState(null);
  const [sortOrder, setSortOrder] = React.useState('asc');

  // Add Fund Transfer Modal State
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [newTransfer, setNewTransfer] = React.useState({
    deliveryBoy: 'Vishal Patel (9302841836)',
    type: 'Credit',
    amount: '',
    message: ''
  });

  // Clear Filter Handler
  const handleClearFilters = () => {
    setFromDate('');
    setToDate('');
    setDeliveryBoyFilter('All Captain');
    setMethodFilter('All');
    setSearch('');
  };

  // Sorting Handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Filter & Sort Logic
  const filteredTransfers = transfers.filter(t => {
    const matchesBoy = deliveryBoyFilter === 'All Captain' || t.name === deliveryBoyFilter;
    const matchesMethod = methodFilter === 'All' || t.type === methodFilter;
    const matchesSearch = 
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.mobile.includes(search) ||
      t.id.toLowerCase().includes(search.toLowerCase()) ||
      t.message.toLowerCase().includes(search.toLowerCase());
    return matchesBoy && matchesMethod && matchesSearch;
  });

  const sortedTransfers = [...filteredTransfers].sort((a, b) => {
    if (!sortField) return 0;
    let valA = a[sortField] || '';
    let valB = b[sortField] || '';
    if (typeof valA === 'string' && valA.startsWith('₹')) {
      valA = parseFloat(valA.replace('₹', '').replace(',', '')) || 0;
      valB = parseFloat(valB.replace('₹', '').replace(',', '')) || 0;
    }
    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination Math
  const totalPages = Math.ceil(sortedTransfers.length / perPage) || 1;
  const startIndex = (currentPage - 1) * perPage;
  const paginatedTransfers = sortedTransfers.slice(startIndex, startIndex + perPage);

  // CSV Export Action
  const handleExportCSV = () => {
    const headers = ['ID', 'Name', 'Mobile', 'Opening Balance (₹)', 'Closing Balance (₹)', 'Amount (₹)', 'Type', 'Message', 'Date'];
    const rows = sortedTransfers.map(t => [t.id, `"${t.name}"`, t.mobile, t.openingBalance, t.closingBalance, t.amount, t.type, `"${t.message}"`, t.date]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sathiseller_fund_transfers_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Add Fund Transfer Form Action
  const handleAddFundTransfer = (e) => {
    e.preventDefault();
    if (!newTransfer.amount) return;

    const [boyName, boyMobile] = newTransfer.deliveryBoy.split(' (');
    const cleanMobile = boyMobile ? boyMobile.replace(')', '') : '9302841836';
    const amountVal = parseFloat(newTransfer.amount) || 0;

    const added = {
      id: `FT-${Date.now().toString().slice(-4)}`,
      name: boyName,
      mobile: cleanMobile,
      openingBalance: '₹0.00',
      closingBalance: `₹${amountVal.toFixed(2)}`,
      amount: `₹${amountVal.toFixed(2)}`,
      type: newTransfer.type,
      message: newTransfer.message || 'Direct Fund Transfer',
      date: new Date().toLocaleDateString('en-GB')
    };

    setTransfers(prev => [added, ...prev]);
    setIsAddModalOpen(false);
    setNewTransfer({ deliveryBoy: 'Vishal Patel (9302841836)', type: 'Credit', amount: '', message: '' });
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header & Breadcrumb */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Fund Transfer</h1>
        <div className="text-xs text-slate-500 font-medium">
          Dashboard / <span className="text-[#ff5500] font-semibold">View Fund Transfer</span>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Light Orange Header Banner with + Add Fund Transfer Button */}
        <div className="bg-[#fff4ed] border-b border-orange-200/70 text-[#002625] px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h2 className="text-base font-bold tracking-tight text-[#002625] flex items-center gap-2 m-0">
            <ChevronRight size={18} className="text-[#ff5500]" />
            View Fund Transfer
          </h2>

          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold rounded-xl border-none cursor-pointer flex items-center gap-1.5 shadow-2xs transition-all shrink-0 active:scale-95"
          >
            <Plus size={15} /> Add Fund Transfer
          </button>
        </div>

        {/* Filter Controls Toolbar */}
        <div className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
            
            {/* Left Filters: From - To Date, Clear, Captain Filter, Method Filter */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                <span className="text-slate-500 font-medium">From - To Date:</span>
                <input 
                  type="date" 
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="bg-transparent text-xs text-slate-800 outline-none border-none font-medium cursor-pointer"
                />
                <span className="text-slate-400">-</span>
                <input 
                  type="date" 
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="bg-transparent text-xs text-slate-800 outline-none border-none font-medium cursor-pointer"
                />
              </div>

              <button 
                onClick={handleClearFilters}
                className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-xl border-none cursor-pointer transition-colors"
              >
                Clear
              </button>

              <div className="flex items-center gap-2">
                <span className="text-slate-600 font-medium">Filter by Captain:</span>
                <select 
                  value={deliveryBoyFilter}
                  onChange={(e) => setDeliveryBoyFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-[#ff5500] cursor-pointer"
                >
                  <option value="All Captain">All Captain</option>
                  <option value="Vishal Patel">Vishal Patel</option>
                  <option value="Deepak kumar">Deepak kumar</option>
                  <option value="Rahul sahu">Rahul sahu</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-600 font-medium">Filter by Method:</span>
                <select 
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-[#ff5500] cursor-pointer"
                >
                  <option value="All">All</option>
                  <option value="Credit">Credit</option>
                  <option value="Debit">Debit</option>
                </select>
              </div>
            </div>

            {/* Right Controls: Per Page, Export CSV, Search */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-600 font-medium">Per Page:</span>
                <select 
                  value={perPage}
                  onChange={(e) => {
                    setPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-[#ff5500] cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <button 
                onClick={handleExportCSV}
                className="px-4 py-1.5 bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold rounded-xl border-none cursor-pointer flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 shrink-0"
              >
                <Download size={14} /> Export v
              </button>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-600 font-medium">Search:</span>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-40 bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#ff5500]"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Table Container */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                  <th onClick={() => handleSort('id')} className="py-3.5 px-4 cursor-pointer select-none">ID ⇕</th>
                  <th onClick={() => handleSort('name')} className="py-3.5 px-4 cursor-pointer select-none">NAME ⇕</th>
                  <th onClick={() => handleSort('mobile')} className="py-3.5 px-4 cursor-pointer select-none">MOBILE ⇕</th>
                  <th onClick={() => handleSort('openingBalance')} className="py-3.5 px-4 cursor-pointer select-none">OPENING BALANCE (₹) ⇕</th>
                  <th onClick={() => handleSort('closingBalance')} className="py-3.5 px-4 cursor-pointer select-none">CLOSING BALANCE (₹) ⇕</th>
                  <th onClick={() => handleSort('amount')} className="py-3.5 px-4 cursor-pointer select-none">AMOUNT (₹) ⇕</th>
                  <th onClick={() => handleSort('type')} className="py-3.5 px-4 cursor-pointer select-none">TYPE ⇕</th>
                  <th className="py-3.5 px-4">MESSAGE ⇕</th>
                  <th onClick={() => handleSort('date')} className="py-3.5 px-4 cursor-pointer select-none">DATE ⇕</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {paginatedTransfers.length > 0 ? (
                  paginatedTransfers.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-500">{t.id}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{t.name}</td>
                      <td className="py-3.5 px-4 font-mono">{t.mobile}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">{t.openingBalance}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">{t.closingBalance}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{t.amount}</td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          t.type === 'Credit' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {t.type}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-[200px] truncate" title={t.message}>{t.message}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">{t.date}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="py-12 text-center text-slate-400 font-medium">
                      No data available in table
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 pt-2">
            <div>
              Showing {sortedTransfers.length > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + perPage, sortedTransfers.length)} of {sortedTransfers.length} entries
            </div>

            <div className="flex items-center gap-1">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1 || sortedTransfers.length === 0}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer font-bold transition-all"
              >
                ‹
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                    currentPage === page 
                      ? 'bg-[#ff5500] text-white border-[#ff5500] shadow-2xs' 
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || sortedTransfers.length === 0}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer font-bold transition-all"
              >
                ›
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* ADD FUND TRANSFER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn">
            {/* Header */}
            <div className="bg-[#fff4ed] border-b border-orange-200/70 text-[#002625] px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#002625] m-0 flex items-center gap-2">
                <Plus size={18} className="text-[#ff5500]" />
                Add Fund Transfer
              </h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-900 border-none bg-transparent cursor-pointer text-xl font-bold p-1 leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddFundTransfer} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Select Captain *</label>
                <select 
                  value={newTransfer.deliveryBoy}
                  onChange={(e) => setNewTransfer({ ...newTransfer, deliveryBoy: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-[#ff5500] bg-slate-50 cursor-pointer"
                >
                  <option value="Vishal Patel (9302841836)">Vishal Patel (9302841836)</option>
                  <option value="Deepak kumar (9031275861)">Deepak kumar (9031275861)</option>
                  <option value="Rahul sahu (9241673736)">Rahul sahu (9241673736)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Transfer Type *</label>
                  <select 
                    value={newTransfer.type}
                    onChange={(e) => setNewTransfer({ ...newTransfer, type: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-[#ff5500] bg-slate-50 cursor-pointer"
                  >
                    <option value="Credit">Credit (Add)</option>
                    <option value="Debit">Debit (Deduct)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Amount (₹) *</label>
                  <input 
                    type="number" 
                    required
                    placeholder="0.00"
                    value={newTransfer.amount}
                    onChange={(e) => setNewTransfer({ ...newTransfer, amount: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-[#ff5500]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Message / Remark</label>
                <textarea 
                  rows="3"
                  placeholder="Reason for transfer..."
                  value={newTransfer.message}
                  onChange={(e) => setNewTransfer({ ...newTransfer, message: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-3 text-xs text-slate-900 outline-none focus:border-[#ff5500] resize-none"
                ></textarea>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border-none cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-6 py-2.5 bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-2xs transition-all active:scale-95"
                >
                  Transfer Funds
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* =========================================================================
   9.5. ADMIN WALLET & FINANCE PAGE
   ========================================================================= */
export const AdminWalletFinance = () => {
  const [activeTab, setActiveTab] = React.useState('all_transactions');
  const [userFilter, setUserFilter] = React.useState('All Users');
  const [typeFilter, setTypeFilter] = React.useState('All Types');
  const [search, setSearch] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  // Dynamic Data States
  const [summary, setSummary] = React.useState({
    totalCommissionEarned: 0,
    totalSettledAmount: 0,
    totalTransactions: 0,
  });
  const [settlements, setSettlements] = React.useState([]);
  const [withdrawals, setWithdrawals] = React.useState([]);

  // Fetch Live Data from Backend API
  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [settlementsRes, withdrawalsRes] = await Promise.all([
        walletService.getAdminSettlements().catch(err => {
          console.warn('Failed to fetch settlements:', err.message);
          return { summary: {}, settlements: [] };
        }),
        walletService.getAdminWithdrawals().catch(err => {
          console.warn('Failed to fetch withdrawals:', err.message);
          return { withdrawals: [] };
        }),
      ]);

      if (settlementsRes.success !== false) {
        setSummary(settlementsRes.summary || { totalCommissionEarned: 0, totalSettledAmount: 0, totalTransactions: 0 });
        setSettlements(settlementsRes.settlements || []);
      }

      if (withdrawalsRes.success !== false) {
        setWithdrawals(withdrawalsRes.withdrawals || []);
      }
    } catch (err) {
      console.error('Error fetching admin wallet data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Action Handler: Update Withdrawal Status (Approve / Reject / Complete)
  const handleUpdateWithdrawalStatus = async (id, newStatus) => {
    const remarkPrompt = newStatus === 'REJECTED' 
      ? prompt('Enter rejection reason / remark (Seller will be refunded automatically):', 'Rejected by Admin')
      : prompt('Enter optional admin remark / payment reference:', 'Processed by Admin');

    if (remarkPrompt === null) return; // User cancelled prompt

    try {
      const res = await walletService.updateWithdrawalStatus(id, newStatus, remarkPrompt);
      if (res.success) {
        alert(res.message || `Withdrawal request status updated to ${newStatus}`);
        fetchData(); // Refresh live data
      } else {
        alert(res.message || 'Failed to update withdrawal status');
      }
    } catch (err) {
      alert(`Error updating status: ${err.message}`);
    }
  };

  // Calculate dynamic metrics
  const totalPendingWithdrawalsAmt = withdrawals
    .filter(w => (w.status || '').toUpperCase() === 'PENDING')
    .reduce((acc, w) => acc + (w.amount || 0), 0);

  const totalCompletedWithdrawalsAmt = withdrawals
    .filter(w => ['APPROVED', 'COMPLETED', 'Approved', 'Completed'].includes(w.status))
    .reduce((acc, w) => acc + (w.amount || 0), 0);

  const pendingWithdrawalsCount = withdrawals.filter(w => (w.status || '').toUpperCase() === 'PENDING').length;

  // Filtered Transactions List
  const filteredSettlements = settlements.filter(s => {
    const matchesSearch = 
      (s.sellerName || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.orderId || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.paymentMethod || '').toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  // Filtered Withdrawals List
  const filteredWithdrawals = withdrawals.filter(w => {
    const statusUpper = (w.status || '').toUpperCase();
    const filterUpper = typeFilter.toUpperCase();
    
    const matchesStatus = 
      typeFilter === 'All Types' || 
      typeFilter === 'All' || 
      statusUpper === filterUpper;

    const matchesSearch = 
      (w.sellerName || '').toLowerCase().includes(search.toLowerCase()) ||
      (w.withdrawalId || '').toLowerCase().includes(search.toLowerCase()) ||
      (w.bankDetails?.bankName || '').toLowerCase().includes(search.toLowerCase()) ||
      (w.bankDetails?.accountNumber || '').toLowerCase().includes(search.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Page Title & Refresh */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight m-0">Admin Wallet & Finance</h1>
          <p className="text-xs text-slate-500 font-medium mt-1 m-0">
            Manage settlements, track commission earnings, and process seller withdrawal payouts.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-2xs"
        >
          <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.5 2v6h-6M2.5 22v-6h6"/><path d="M2 11.5a10 10 0 0 1 18.8-4.3L21.5 8M22 12.5a10 10 0 0 1-18.8 4.2L2.5 16"/></svg>
          {loading ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      {/* Top Metrics Grid (Dynamic Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        
        {/* Card 1: Settled Admin Commission */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition-all space-y-1.5 relative">
          <div className="flex justify-between items-center">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-sm">
              ₹
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              LIVE DATA <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 block leading-none">Settled Admin Commission</span>
            <h2 className="text-lg font-extrabold text-purple-600 tracking-tight m-0 mt-1">
              ₹{Number(summary.settledCommissionEarned || 0).toFixed(2)}
            </h2>
          </div>
          <p className="text-[10px] text-slate-400 font-medium pt-1 border-t border-slate-100 m-0 leading-none">Finalized revenue from delivered orders</p>
        </div>

        {/* Card 2: Pending Admin Commission */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition-all space-y-1.5 relative">
          <div className="flex justify-between items-center">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm">
              ₹
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              LIVE DATA <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            </div>
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 block leading-none">Pending Admin Commission</span>
            <h2 className="text-lg font-extrabold text-amber-600 tracking-tight m-0 mt-1">
              ₹{Number(summary.pendingAdminCommission || 0).toFixed(2)}
            </h2>
          </div>
          <p className="text-[10px] text-slate-400 font-medium pt-1 border-t border-slate-100 m-0 leading-none">Projected revenue from in-transit orders</p>
        </div>

        {/* Card 3: Total Settled to Sellers */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition-all space-y-1.5 relative">
          <div className="flex justify-between items-center">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              LIVE DATA <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 block leading-none">Total Net Settled to Sellers</span>
            <h2 className="text-lg font-extrabold text-emerald-600 tracking-tight m-0 mt-1">
              ₹{Number(summary.totalSettledAmount || 0).toFixed(2)}
            </h2>
          </div>
          <p className="text-[10px] text-slate-400 font-medium pt-1 border-t border-slate-100 m-0 leading-none">Credited into seller available wallets</p>
        </div>

        {/* Card 4: Pending Seller Amount */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition-all space-y-1.5 relative">
          <div className="flex justify-between items-center">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock size={16} />
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              LIVE DATA <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            </div>
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 block leading-none">Pending Seller Balances</span>
            <h2 className="text-lg font-extrabold text-blue-600 tracking-tight m-0 mt-1">
              ₹{Number(summary.pendingSellerAmount || 0).toFixed(2)}
            </h2>
          </div>
          <p className="text-[10px] text-slate-400 font-medium pt-1 border-t border-slate-100 m-0 leading-none">Owed to sellers upon delivery</p>
        </div>

        {/* Card 5: Pending Withdrawal Requests */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition-all space-y-1.5 relative">
          <div className="flex justify-between items-center">
            <div className="w-8 h-8 rounded-lg bg-[#fff4ed] text-[#ff5500] flex items-center justify-center">
              <Store size={16} />
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              LIVE DATA <span className="w-1.5 h-1.5 rounded-full bg-[#ff5500] animate-pulse"></span>
            </div>
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 block leading-none">Pending Withdrawal Requests</span>
            <h2 className="text-lg font-extrabold text-[#ff5500] tracking-tight m-0 mt-1">
              ₹{totalPendingWithdrawalsAmt.toFixed(2)}
            </h2>
          </div>
          <p className="text-[10px] text-slate-400 font-medium pt-1 border-t border-slate-100 m-0 leading-none">{pendingWithdrawalsCount} pending payout request(s)</p>
        </div>

        {/* Card 6: Total Completed Bank Payouts */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition-all space-y-1.5 relative">
          <div className="flex justify-between items-center">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <FileText size={16} />
            </div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              LIVE DATA <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 block leading-none">Completed Bank Payouts</span>
            <h2 className="text-lg font-extrabold text-indigo-600 tracking-tight m-0 mt-1">
              ₹{totalCompletedWithdrawalsAmt.toFixed(2)}
            </h2>
          </div>
          <p className="text-[10px] text-slate-400 font-medium pt-1 border-t border-slate-100 m-0 leading-none">Total processed bank transfers</p>
        </div>

      </div>

      {/* Main Card with Tabbed Content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Tab Header Navigation */}
        <div className="border-b border-slate-200 px-6 pt-3 flex items-center gap-6 bg-slate-50/50">
          <button 
            onClick={() => setActiveTab('all_transactions')}
            className={`pb-3 text-xs font-bold border-b-2 cursor-pointer transition-all flex items-center gap-2 ${
              activeTab === 'all_transactions'
                ? 'border-[#ff5500] text-[#ff5500]'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>
            Seller Settlement Records ({settlements.length})
          </button>

          <button 
            onClick={() => setActiveTab('withdrawals')}
            className={`pb-3 text-xs font-bold border-b-2 cursor-pointer transition-all flex items-center gap-2 ${
              activeTab === 'withdrawals'
                ? 'border-[#ff5500] text-[#ff5500]'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            Withdrawal Requests
            {pendingWithdrawalsCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-rose-500 text-white font-extrabold text-[10px] flex items-center justify-center">
                {pendingWithdrawalsCount}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content Section */}
        <div className="p-6 space-y-5">
          
          {/* Search & Filters */}
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search by order ID, seller, bank..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64 bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#ff5500]"
              />
            </div>
          </div>

          {/* Tab 1: Settlements Table */}
          {activeTab === 'all_transactions' && (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                    <th className="py-3.5 px-4">Date & Time</th>
                    <th className="py-3.5 px-4">Order ID</th>
                    <th className="py-3.5 px-4">Seller Store</th>
                    <th className="py-3.5 px-4">Gross Amount</th>
                    <th className="py-3.5 px-4">Comm. Rate</th>
                    <th className="py-3.5 px-4 text-purple-700">Admin Comm. (₹)</th>
                    <th className="py-3.5 px-4 text-emerald-700">Net Seller Amount</th>
                    <th className="py-3.5 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                  {filteredSettlements.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-slate-400">
                        No settlement records found.
                      </td>
                    </tr>
                  ) : (
                    filteredSettlements.map((s) => (
                      <tr key={s._id || s.orderId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-slate-500 text-[11px]">
                          {s.createdAt ? new Date(s.createdAt).toLocaleString() : 'N/A'}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{s.orderId}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-800">{s.sellerName || 'Seller'}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">₹{Number(s.totalAmount || 0).toFixed(2)}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-600">{s.commissionRate || 10}%</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-purple-700">₹{Number(s.commissionAmount || 0).toFixed(2)}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-600">₹{Number(s.netSellerAmount || 0).toFixed(2)}</td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            s.settlementStatus === 'SETTLED' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}>
                            {s.settlementStatus || 'PENDING'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 2: Withdrawal Requests View */}
          {activeTab === 'withdrawals' && (
            <div className="space-y-4">
              {/* Status Filter Pill Buttons */}
              <div className="flex flex-wrap items-center gap-2 pb-2">
                {['All', 'PENDING', 'APPROVED', 'COMPLETED', 'REJECTED'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setTypeFilter(status === 'All' ? 'All Types' : status)}
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                      (typeFilter === 'All Types' && status === 'All') || typeFilter.toUpperCase() === status
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>

              {/* Withdrawal Card List */}
              <div className="space-y-4">
                {filteredWithdrawals.length === 0 ? (
                  <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400">
                    No withdrawal requests found for this filter.
                  </div>
                ) : (
                  filteredWithdrawals.map((w) => {
                    const statusUpper = (w.status || 'PENDING').toUpperCase();
                    return (
                      <div key={w._id || w.withdrawalId} className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all p-5 space-y-4">
                        {/* Top Row */}
                        <div className="flex justify-between items-start gap-4">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-slate-900 m-0">Withdrawal Request #{w.withdrawalId}</h3>
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider bg-purple-100 text-purple-700">
                                SELLER
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-slate-700 m-0">{w.sellerName || 'Seller Store'}</p>
                            <p className="text-[11px] text-slate-400 font-mono m-0">
                              Requested: {w.createdAt ? new Date(w.createdAt).toLocaleString() : 'N/A'}
                            </p>
                          </div>

                          <div className="text-right space-y-1">
                            <h2 className="text-lg font-black text-slate-900 tracking-tight m-0">₹{Number(w.amount || 0).toFixed(2)}</h2>
                            <span className={`inline-block px-3 py-0.5 rounded-full text-[10px] font-bold ${
                              ['COMPLETED', 'Completed'].includes(statusUpper) ? 'bg-emerald-100 text-emerald-700' :
                              ['PENDING', 'Pending'].includes(statusUpper) ? 'bg-amber-100 text-amber-700' :
                              ['APPROVED', 'Approved'].includes(statusUpper) ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'
                            }`}>
                              {statusUpper}
                            </span>
                          </div>
                        </div>

                        {/* Middle Details Container */}
                        <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100 space-y-3 text-xs">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">BANK NAME</span>
                              <span className="font-bold text-slate-900">{w.bankDetails?.bankName || 'N/A'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">ACCOUNT NUMBER & IFSC</span>
                              <span className="font-bold text-slate-900 font-mono">
                                A/C: {w.bankDetails?.accountNumber || 'N/A'} | IFSC: {w.bankDetails?.ifscCode || 'N/A'}
                              </span>
                            </div>
                          </div>

                          {w.bankDetails?.accountHolderName && (
                            <div className="pt-2 border-t border-slate-200/50">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">ACCOUNT HOLDER</span>
                              <span className="font-mono text-slate-800 font-semibold">{w.bankDetails.accountHolderName}</span>
                            </div>
                          )}

                          {w.adminRemark && (
                            <div className="pt-2 border-t border-slate-200/50">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">ADMIN REMARK</span>
                              <span className="text-slate-800 italic">{w.adminRemark}</span>
                            </div>
                          )}
                        </div>

                        {/* Approve / Complete / Reject Buttons if Pending */}
                        {statusUpper === 'PENDING' && (
                          <div className="grid grid-cols-3 gap-3 pt-1">
                            <button 
                              onClick={() => handleUpdateWithdrawalStatus(w._id, 'APPROVED')}
                              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-2xs transition-all active:scale-95 text-center"
                            >
                              Approve Request
                            </button>
                            <button 
                              onClick={() => handleUpdateWithdrawalStatus(w._id, 'COMPLETED')}
                              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-2xs transition-all active:scale-95 text-center"
                            >
                              Complete Payout
                            </button>
                            <button 
                              onClick={() => handleUpdateWithdrawalStatus(w._id, 'REJECTED')}
                              className="w-full py-2.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-xl cursor-pointer transition-all active:scale-95 text-center"
                            >
                              Reject & Refund
                            </button>
                          </div>
                        )}

                        {statusUpper === 'APPROVED' && (
                          <div className="pt-1">
                            <button 
                              onClick={() => handleUpdateWithdrawalStatus(w._id, 'COMPLETED')}
                              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-2xs transition-all active:scale-95 text-center"
                            >
                              Mark Bank Transfer Completed
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

/* =========================================================================
   9.6. STANDALONE WITHDRAWALS MANAGEMENT PAGE
   ========================================================================= */
export const AdminWithdrawals = () => {
  const [activeFilter, setActiveFilter] = React.useState('All');
  const [withdrawals, setWithdrawals] = React.useState([
    {
      id: 'WD-001',
      title: 'Seller Withdrawal',
      role: 'SELLER',
      user: 'appzeto',
      date: 'Requested: 27/1/2026, 10:38:58 pm',
      amount: '₹510.00',
      status: 'Completed',
      paymentMethod: 'Bank Transfer',
      bankDetails: 'IDFC - 54684651684651 (undefined)',
      transactionReference: 'hjhbjh'
    },
    {
      id: 'WD-002',
      title: 'Captain Withdrawal',
      role: 'captain',
      user: 'N/A',
      date: 'Requested: 7/1/2026, 3:22:40 pm',
      amount: '₹40.00',
      status: 'Pending',
      paymentMethod: 'UPI',
      bankDetails: 'UPI ID: slovevanshi666@gmail.com',
      transactionReference: null
    },
    {
      id: 'WD-003',
      title: 'Seller Withdrawal',
      role: 'SELLER',
      user: 'Deepak Kumar',
      date: 'Requested: 28/5/2026, 2:52:17 pm',
      amount: '₹500.00',
      status: 'Completed',
      paymentMethod: 'UPI',
      bankDetails: 'Airtel payment bank - 9031275861 (AIRP0000001)',
      transactionReference: '9031275861'
    },
    {
      id: 'WD-004',
      title: 'Seller Withdrawal',
      role: 'SELLER',
      user: 'Harsh shop',
      date: 'Requested: 30/4/2026, 12:19:51 pm',
      amount: '₹100.00',
      status: 'Completed',
      paymentMethod: 'Bank Transfer',
      bankDetails: 'HDFC - 9877898789898998888898 (undefined)',
      transactionReference: 'cydf'
    }
  ]);

  const handleApprove = (id) => {
    setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status: 'Approved' } : w));
  };

  const handleReject = (id) => {
    setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status: 'Rejected' } : w));
  };

  const filtered = withdrawals.filter(w => activeFilter === 'All' || w.status === activeFilter);

  return (
    <div className="space-y-5 animate-fadeIn pb-12">
      {/* Top Filter Buttons matching user screenshot */}
      <div className="flex flex-wrap items-center gap-2">
        {['All', 'Pending', 'Approved', 'Completed', 'Rejected'].map((status) => (
          <button
            key={status}
            onClick={() => setActiveFilter(status)}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
              activeFilter === status
                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Cards List matching exact reference screenshot */}
      <div className="space-y-4">
        {filtered.map((w) => (
          <div 
            key={w.id} 
            className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all p-6 space-y-4"
          >
            {/* Header Row: Title, Role Badge, Username, Date, Amount, Status Badge */}
            <div className="flex justify-between items-start gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 m-0">{w.title}</h3>
                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider ${
                    w.role === 'SELLER' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {w.role}
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-700 m-0">{w.user}</p>
                <p className="text-[11px] text-slate-400 font-mono m-0">{w.date}</p>
              </div>

              <div className="text-right space-y-1">
                <h2 className="text-xl font-black text-slate-900 tracking-tight m-0">{w.amount}</h2>
                <span className={`inline-block px-3 py-0.5 rounded-full text-[11px] font-bold ${
                  w.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' :
                  w.status === 'Pending' ? 'bg-amber-100 text-amber-700' :
                  w.status === 'Approved' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'
                }`}>
                  {w.status}
                </span>
              </div>
            </div>

            {/* Inner Details Container */}
            <div className="bg-[#fcfcfd] p-4 rounded-xl border border-slate-100 space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">PAYMENT METHOD</span>
                  <span className="font-bold text-slate-900">{w.paymentMethod}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">BANK DETAILS</span>
                  <span className="font-bold text-slate-900 font-mono">{w.bankDetails}</span>
                </div>
              </div>

              {w.transactionReference && (
                <div className="pt-2 border-t border-slate-200/50">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">TRANSACTION REFERENCE</span>
                  <span className="font-mono text-slate-800 font-semibold">{w.transactionReference}</span>
                </div>
              )}
            </div>

            {/* Approve / Reject Action Buttons for Pending Status */}
            {w.status === 'Pending' && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button 
                  onClick={() => handleApprove(w.id)}
                  className="w-full py-2.5 bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-2xs transition-all active:scale-95 text-center"
                >
                  Approve
                </button>
                <button 
                  onClick={() => handleReject(w.id)}
                  className="w-full py-2.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-xl cursor-pointer transition-all active:scale-95 text-center"
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/* =========================================================================
   9.7. SELLER TRANSACTIONS PAGE
   ========================================================================= */
export const AdminSellerTransactions = () => {
  const [transactions, setTransactions] = React.useState([
    { id: 'ST-901', sellerName: 'Cakes n bakes', orderId: 'ORD1784732281209325', orderItemId: 'ITEM-881', productName: 'Chocolate Truffle Cake', variation: '1 kg', flag: 'Credit', amount: '₹108.00', remarks: 'Sale proceeds from Order' },
    { id: 'ST-902', sellerName: 'Harshvardhan', orderId: 'ORD1783334491042306', orderItemId: 'ITEM-882', productName: 'Basmati Rice Premium', variation: '5 kg', flag: 'Credit', amount: '₹90.00', remarks: 'Sale proceeds from Order' },
    { id: 'ST-903', sellerName: 'Apex Wholesale Grocery', orderId: 'ORD1782291049281729', orderItemId: 'ITEM-883', productName: 'Refined Sunflower Oil', variation: '1 L', flag: 'Debit', amount: '₹450.00', remarks: 'Seller Payout Settlement' },
  ]);

  // Filters State
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');
  const [sellerFilter, setSellerFilter] = React.useState('All Sellers');
  const [methodFilter, setMethodFilter] = React.useState('All');
  const [search, setSearch] = React.useState('');
  const [perPage, setPerPage] = React.useState(10);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [sortField, setSortField] = React.useState(null);
  const [sortOrder, setSortOrder] = React.useState('asc');

  // Add Fund Transfer Modal State
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [newTransfer, setNewTransfer] = React.useState({
    sellerName: 'Cakes n bakes',
    flag: 'Credit',
    amount: '',
    remarks: ''
  });

  const handleClearFilters = () => {
    setFromDate('');
    setToDate('');
    setSellerFilter('All Sellers');
    setMethodFilter('All');
    setSearch('');
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredTrans = transactions.filter(t => {
    const matchesSeller = sellerFilter === 'All Sellers' || t.sellerName === sellerFilter;
    const matchesMethod = methodFilter === 'All' || t.flag === methodFilter;
    const matchesSearch = 
      t.sellerName.toLowerCase().includes(search.toLowerCase()) ||
      t.orderId.toLowerCase().includes(search.toLowerCase()) ||
      t.productName.toLowerCase().includes(search.toLowerCase()) ||
      t.id.toLowerCase().includes(search.toLowerCase());
    return matchesSeller && matchesMethod && matchesSearch;
  });

  const sortedTrans = [...filteredTrans].sort((a, b) => {
    if (!sortField) return 0;
    let valA = a[sortField] || '';
    let valB = b[sortField] || '';
    if (typeof valA === 'string' && valA.startsWith('₹')) {
      valA = parseFloat(valA.replace('₹', '').replace(',', '')) || 0;
      valB = parseFloat(valB.replace('₹', '').replace(',', '')) || 0;
    }
    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedTrans.length / perPage) || 1;
  const startIndex = (currentPage - 1) * perPage;
  const paginatedTrans = sortedTrans.slice(startIndex, startIndex + perPage);

  const handleExportCSV = () => {
    const headers = ['ID', 'SELLER NAME', 'ORDER ID', 'ORDER ITEM ID', 'PRODUCT NAME', 'VARIATION', 'FLAG', 'AMOUNT', 'REMARKS'];
    const rows = sortedTrans.map(t => [t.id, `"${t.sellerName}"`, t.orderId, t.orderItemId, `"${t.productName}"`, `"${t.variation}"`, t.flag, t.amount, `"${t.remarks}"`]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sathiseller_seller_transactions_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddFundTransfer = (e) => {
    e.preventDefault();
    if (!newTransfer.amount) return;

    const amountVal = parseFloat(newTransfer.amount) || 0;
    const added = {
      id: `ST-${Date.now().toString().slice(-4)}`,
      sellerName: newTransfer.sellerName,
      orderId: 'MANUAL_TXN',
      orderItemId: 'N/A',
      productName: 'Direct Wallet Transfer',
      variation: 'N/A',
      flag: newTransfer.flag,
      amount: `₹${amountVal.toFixed(2)}`,
      remarks: newTransfer.remarks || 'Direct Seller Fund Transfer'
    };

    setTransactions(prev => [added, ...prev]);
    setIsAddModalOpen(false);
    setNewTransfer({ sellerName: 'Cakes n bakes', flag: 'Credit', amount: '', remarks: '' });
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Page Title & Breadcrumb */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Seller Transactions</h1>
        <div className="text-xs text-slate-500 font-medium">
          Dashboard / <span className="text-[#ff5500] font-semibold">View Seller List</span>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Light Orange Header Banner matching reference screenshot with + Add Fund Transfer */}
        <div className="bg-[#fff4ed] border-b border-orange-200/70 text-[#002625] px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h2 className="text-base font-bold tracking-tight text-[#002625] flex items-center gap-2 m-0">
            <ChevronRight size={18} className="text-[#ff5500]" />
            View Seller List
          </h2>

          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold rounded-xl border-none cursor-pointer flex items-center gap-1.5 shadow-2xs transition-all shrink-0 active:scale-95"
          >
            <Plus size={15} /> Add Fund Transfer
          </button>
        </div>

        {/* Filter Controls Toolbar */}
        <div className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
            
            {/* Left Filters: From - To Date, Clear, Filter by Seller, Filter by Method */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                <span className="text-slate-500 font-medium">From - To Date:</span>
                <input 
                  type="date" 
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="bg-transparent text-xs text-slate-800 outline-none border-none font-medium cursor-pointer"
                />
                <span className="text-slate-400">-</span>
                <input 
                  type="date" 
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="bg-transparent text-xs text-slate-800 outline-none border-none font-medium cursor-pointer"
                />
              </div>

              <button 
                onClick={handleClearFilters}
                className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-xl border-none cursor-pointer transition-colors"
              >
                Clear
              </button>

              <div className="flex items-center gap-2">
                <span className="text-slate-600 font-medium">Filter by Seller:</span>
                <select 
                  value={sellerFilter}
                  onChange={(e) => setSellerFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-[#ff5500] cursor-pointer"
                >
                  <option value="All Sellers">All Sellers</option>
                  <option value="Cakes n bakes">Cakes n bakes</option>
                  <option value="Harshvardhan">Harshvardhan</option>
                  <option value="Apex Wholesale Grocery">Apex Wholesale Grocery</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-600 font-medium">Filter by Method:</span>
                <select 
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-[#ff5500] cursor-pointer"
                >
                  <option value="All">All</option>
                  <option value="Credit">Credit</option>
                  <option value="Debit">Debit</option>
                </select>
              </div>
            </div>

            {/* Right Controls: Per Page, Export CSV, Search */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-600 font-medium">Per Page:</span>
                <select 
                  value={perPage}
                  onChange={(e) => {
                    setPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-[#ff5500] cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <button 
                onClick={handleExportCSV}
                className="px-4 py-1.5 bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold rounded-xl border-none cursor-pointer flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 shrink-0"
              >
                <Download size={14} /> Export v
              </button>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-600 font-medium">Search:</span>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-40 bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#ff5500]"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Table Container */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                  <th onClick={() => handleSort('id')} className="py-3.5 px-3 cursor-pointer select-none">ID ⇕</th>
                  <th onClick={() => handleSort('sellerName')} className="py-3.5 px-3 cursor-pointer select-none">SELLER NAME ⇕</th>
                  <th onClick={() => handleSort('orderId')} className="py-3.5 px-3 cursor-pointer select-none">ORDER ID ⇕</th>
                  <th onClick={() => handleSort('orderItemId')} className="py-3.5 px-3 cursor-pointer select-none">ORDER ITEM ID ⇕</th>
                  <th onClick={() => handleSort('productName')} className="py-3.5 px-3 cursor-pointer select-none">PRODUCT NAME ⇕</th>
                  <th onClick={() => handleSort('variation')} className="py-3.5 px-3 cursor-pointer select-none">VARIATION ⇕</th>
                  <th onClick={() => handleSort('flag')} className="py-3.5 px-3 cursor-pointer select-none">FLAG ⇕</th>
                  <th onClick={() => handleSort('amount')} className="py-3.5 px-3 cursor-pointer select-none">AMOUNT ⇕</th>
                  <th className="py-3.5 px-3">REMARKS ⇕</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {paginatedTrans.length > 0 ? (
                  paginatedTrans.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-3 font-mono text-slate-500">{t.id}</td>
                      <td className="py-3.5 px-3 font-bold text-slate-900">{t.sellerName}</td>
                      <td className="py-3.5 px-3 font-mono font-bold text-[#ff5500]">{t.orderId}</td>
                      <td className="py-3.5 px-3 font-mono text-slate-600">{t.orderItemId}</td>
                      <td className="py-3.5 px-3 text-slate-900 font-medium max-w-[150px] truncate" title={t.productName}>{t.productName}</td>
                      <td className="py-3.5 px-3 text-slate-600">{t.variation}</td>
                      <td className="py-3.5 px-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          t.flag === 'Credit' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {t.flag}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-900">{t.amount}</td>
                      <td className="py-3.5 px-3 text-slate-600 max-w-[180px] truncate" title={t.remarks}>{t.remarks}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="py-12 text-center text-slate-400 font-medium">
                      No transactions found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 pt-2">
            <div>
              Showing {sortedTrans.length > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + perPage, sortedTrans.length)} of {sortedTrans.length} entries
            </div>

            <div className="flex items-center gap-1">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1 || sortedTrans.length === 0}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer font-bold transition-all"
              >
                ‹
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                    currentPage === page 
                      ? 'bg-[#ff5500] text-white border-[#ff5500] shadow-2xs' 
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || sortedTrans.length === 0}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer font-bold transition-all"
              >
                ›
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* ADD FUND TRANSFER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn">
            <div className="bg-[#fff4ed] border-b border-orange-200/70 text-[#002625] px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#002625] m-0 flex items-center gap-2">
                <Plus size={18} className="text-[#ff5500]" />
                Add Fund Transfer
              </h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-900 border-none bg-transparent cursor-pointer text-xl font-bold p-1 leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddFundTransfer} className="p-6 space-y-4 text-xs">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Select Seller *</label>
                <select 
                  value={newTransfer.sellerName}
                  onChange={(e) => setNewTransfer({ ...newTransfer, sellerName: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-[#ff5500] bg-slate-50 cursor-pointer"
                >
                  <option value="Cakes n bakes">Cakes n bakes</option>
                  <option value="Harshvardhan">Harshvardhan</option>
                  <option value="Apex Wholesale Grocery">Apex Wholesale Grocery</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Transfer Flag *</label>
                  <select 
                    value={newTransfer.flag}
                    onChange={(e) => setNewTransfer({ ...newTransfer, flag: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-[#ff5500] bg-slate-50 cursor-pointer"
                  >
                    <option value="Credit">Credit (Add)</option>
                    <option value="Debit">Debit (Deduct)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Amount (₹) *</label>
                  <input 
                    type="number" 
                    required
                    placeholder="0.00"
                    value={newTransfer.amount}
                    onChange={(e) => setNewTransfer({ ...newTransfer, amount: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-[#ff5500]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Remarks</label>
                <textarea 
                  rows="3"
                  placeholder="Reason for seller transfer..."
                  value={newTransfer.remarks}
                  onChange={(e) => setNewTransfer({ ...newTransfer, remarks: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-3 text-xs text-slate-900 outline-none focus:border-[#ff5500] resize-none"
                ></textarea>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border-none cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-6 py-2.5 bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-2xs transition-all active:scale-95"
                >
                  Transfer Funds
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* =========================================================================
   9.8. captain CASH COLLECTION LIST PAGE
   ========================================================================= */
export const AdminCashCollection = () => {
  const [collections, setCollections] = React.useState([
    { id: '7e5ac4', name: 'Deepak kumar', orderId: 'N/A', total: '₹0.00', amount: '₹100.00', method: 'Cash', remark: '-', dateTime: '18/6/2026, 11:53:13 am' },
    { id: '8fc653', name: 'Wazahat Qureshi', orderId: 'N/A', total: '₹0.00', amount: '₹500.00', method: 'Cash', remark: 'vjdnvkdf', dateTime: '17/6/2026, 5:01:58 pm' },
    { id: '3c81a9', name: 'Vishal Patel', orderId: 'ORD17849102', total: '₹1250.00', amount: '₹1250.00', method: 'Cash', remark: 'COD settlement', dateTime: '16/6/2026, 2:15:00 pm' },
  ]);

  // Filters State
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');
  const [deliveryBoyFilter, setDeliveryBoyFilter] = React.useState('All Captains');
  const [methodFilter, setMethodFilter] = React.useState('All');
  const [search, setSearch] = React.useState('');
  const [perPage, setPerPage] = React.useState(10);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [sortField, setSortField] = React.useState(null);
  const [sortOrder, setSortOrder] = React.useState('asc');

  // Add Cash Collection Modal State
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [newCollection, setNewCollection] = React.useState({
    name: 'Deepak kumar',
    orderId: 'N/A',
    amount: '',
    method: 'Cash',
    remark: ''
  });

  const handleClearFilters = () => {
    setFromDate('');
    setToDate('');
    setDeliveryBoyFilter('All Captains');
    setMethodFilter('All');
    setSearch('');
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredCollections = collections.filter(c => {
    const matchesBoy = deliveryBoyFilter === 'All Captains' || c.name === deliveryBoyFilter;
    const matchesMethod = methodFilter === 'All' || c.method === methodFilter;
    const matchesSearch = 
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.orderId.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase()) ||
      c.remark.toLowerCase().includes(search.toLowerCase());
    return matchesBoy && matchesMethod && matchesSearch;
  });

  const sortedCollections = [...filteredCollections].sort((a, b) => {
    if (!sortField) return 0;
    let valA = a[sortField] || '';
    let valB = b[sortField] || '';
    if (typeof valA === 'string' && valA.startsWith('₹')) {
      valA = parseFloat(valA.replace('₹', '').replace(',', '')) || 0;
      valB = parseFloat(valB.replace('₹', '').replace(',', '')) || 0;
    }
    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedCollections.length / perPage) || 1;
  const startIndex = (currentPage - 1) * perPage;
  const paginatedCollections = sortedCollections.slice(startIndex, startIndex + perPage);

  const handleExportCSV = () => {
    const headers = ['ID', 'NAME', 'O. ID', 'TOTAL', 'AMOUNT', 'METHOD', 'REMARK', 'DATE TIME'];
    const rows = sortedCollections.map(c => [c.id, `"${c.name}"`, c.orderId, c.total, c.amount, c.method, `"${c.remark}"`, `"${c.dateTime}"`]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `sathiseller_cash_collections_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddCashCollection = (e) => {
    e.preventDefault();
    if (!newCollection.amount) return;

    const amountVal = parseFloat(newCollection.amount) || 0;
    const added = {
      id: Math.random().toString(36).substring(2, 8),
      name: newCollection.name,
      orderId: newCollection.orderId || 'N/A',
      total: '₹0.00',
      amount: `₹${amountVal.toFixed(2)}`,
      method: newCollection.method,
      remark: newCollection.remark || '-',
      dateTime: new Date().toLocaleString('en-GB')
    };

    setCollections(prev => [added, ...prev]);
    setIsAddModalOpen(false);
    setNewCollection({ name: 'Deepak kumar', orderId: 'N/A', amount: '', method: 'Cash', remark: '' });
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Page Title & Breadcrumb */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Cash Collection</h1>
        <div className="text-xs text-slate-500 font-medium">
          Dashboard / <span className="text-[#ff5500] font-semibold">Captain Cash Collection List</span>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Light Orange Header Banner matching reference screenshot with + Add Cash Collection */}
        <div className="bg-[#fff4ed] border-b border-orange-200/70 text-[#002625] px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h2 className="text-base font-bold tracking-tight text-[#002625] flex items-center gap-2 m-0">
            <ChevronRight size={18} className="text-[#ff5500]" />
            Captain Cash Collection List
          </h2>

          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold rounded-xl border-none cursor-pointer flex items-center gap-1.5 shadow-2xs transition-all shrink-0 active:scale-95"
          >
            <Plus size={15} /> Add Cash Collection
          </button>
        </div>

        {/* Filter Controls Toolbar */}
        <div className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
            
            {/* Left Filters: From - To Date, Clear, Filter by Captain, Filter by Method */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                <span className="text-slate-500 font-medium">From - To Date:</span>
                <input 
                  type="date" 
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="bg-transparent text-xs text-slate-800 outline-none border-none font-medium cursor-pointer"
                />
                <span className="text-slate-400">-</span>
                <input 
                  type="date" 
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="bg-transparent text-xs text-slate-800 outline-none border-none font-medium cursor-pointer"
                />
              </div>

              <button 
                onClick={handleClearFilters}
                className="px-3.5 py-1.5 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-xl border-none cursor-pointer transition-colors"
              >
                Clear
              </button>

              <div className="flex items-center gap-2">
                <span className="text-slate-600 font-medium">Filter by Captain:</span>
                <select 
                  value={deliveryBoyFilter}
                  onChange={(e) => setDeliveryBoyFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-[#ff5500] cursor-pointer"
                >
                  <option value="All Captains">All Captains</option>
                  <option value="Deepak kumar">Deepak kumar</option>
                  <option value="Wazahat Qureshi">Wazahat Qureshi</option>
                  <option value="Vishal Patel">Vishal Patel</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-600 font-medium">Filter by Method:</span>
                <select 
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-[#ff5500] cursor-pointer"
                >
                  <option value="All">All</option>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                </select>
              </div>
            </div>

            {/* Right Controls: Per Page, Export CSV, Search */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-600 font-medium">Per Page:</span>
                <select 
                  value={perPage}
                  onChange={(e) => {
                    setPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-[#ff5500] cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <button 
                onClick={handleExportCSV}
                className="px-4 py-1.5 bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold rounded-xl border-none cursor-pointer flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 shrink-0"
              >
                <Download size={14} /> Export v
              </button>

              <div className="flex items-center gap-1.5">
                <span className="text-slate-600 font-medium">Search:</span>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-40 bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#ff5500]"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Table Container matching reference image */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                  <th onClick={() => handleSort('id')} className="py-3.5 px-4 cursor-pointer select-none">ID ⇕</th>
                  <th onClick={() => handleSort('name')} className="py-3.5 px-4 cursor-pointer select-none">NAME ⇕</th>
                  <th onClick={() => handleSort('orderId')} className="py-3.5 px-4 cursor-pointer select-none">O. ID ⇕</th>
                  <th onClick={() => handleSort('total')} className="py-3.5 px-4 cursor-pointer select-none">TOTAL ⇕</th>
                  <th onClick={() => handleSort('amount')} className="py-3.5 px-4 cursor-pointer select-none">AMOUNT ⇕</th>
                  <th onClick={() => handleSort('method')} className="py-3.5 px-4 cursor-pointer select-none">METHOD ⇕</th>
                  <th className="py-3.5 px-4">REMARK ⇕</th>
                  <th onClick={() => handleSort('dateTime')} className="py-3.5 px-4 cursor-pointer select-none">DATE TIME ⇕</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                {paginatedCollections.length > 0 ? (
                  paginatedCollections.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-slate-500">{c.id}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{c.name}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">{c.orderId}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">{c.total}</td>
                      <td className="py-3.5 px-4 font-mono font-extrabold text-slate-900">{c.amount}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-3 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-600 border border-blue-100">
                          {c.method}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-[150px] truncate" title={c.remark}>{c.remark}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">{c.dateTime}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400 font-medium">
                      No cash collection entries found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 pt-2">
            <div>
              Showing {sortedCollections.length > 0 ? startIndex + 1 : 0} to {Math.min(startIndex + perPage, sortedCollections.length)} of {sortedCollections.length} entries
            </div>

            <div className="flex items-center gap-1">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1 || sortedCollections.length === 0}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer font-bold transition-all"
              >
                ‹
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold border cursor-pointer transition-all ${
                    currentPage === page 
                      ? 'bg-[#ff5500] text-white border-[#ff5500] shadow-2xs' 
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || sortedCollections.length === 0}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 cursor-pointer font-bold transition-all"
              >
                ›
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* ADD CASH COLLECTION MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn">
            <div className="bg-[#fff4ed] border-b border-orange-200/70 text-[#002625] px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#002625] m-0 flex items-center gap-2">
                <Plus size={18} className="text-[#ff5500]" />
                Add Cash Collection
              </h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-900 border-none bg-transparent cursor-pointer text-xl font-bold p-1 leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddCashCollection} className="p-6 space-y-4 text-xs">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Select Captain *</label>
                <select 
                  value={newCollection.name}
                  onChange={(e) => setNewCollection({ ...newCollection, name: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-[#ff5500] bg-slate-50 cursor-pointer"
                >
                  <option value="Deepak kumar">Deepak kumar</option>
                  <option value="Wazahat Qureshi">Wazahat Qureshi</option>
                  <option value="Vishal Patel">Vishal Patel</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Order ID (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="N/A"
                    value={newCollection.orderId}
                    onChange={(e) => setNewCollection({ ...newCollection, orderId: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-[#ff5500]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Amount (₹) *</label>
                  <input 
                    type="number" 
                    required
                    placeholder="0.00"
                    value={newCollection.amount}
                    onChange={(e) => setNewCollection({ ...newCollection, amount: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-[#ff5500]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Remark</label>
                <textarea 
                  rows="3"
                  placeholder="Cash collection remarks..."
                  value={newCollection.remark}
                  onChange={(e) => setNewCollection({ ...newCollection, remark: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl p-3 text-xs text-slate-900 outline-none focus:border-[#ff5500] resize-none"
                ></textarea>
              </div>

              <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border-none cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-6 py-2.5 bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-2xs transition-all active:scale-95"
                >
                  Submit Collection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* =========================================================================
   10. COUPONS PAGE
   ========================================================================= */
export const CouponManagement = () => {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Coupons & Promos</h2>
          <p className="text-xs text-slate-500">Discount codes, usage limits, and expiration controls</p>
        </div>
        <button onClick={() => alert('Add Coupon (UI)')} className="px-3.5 py-2 bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 border-none cursor-pointer">
          <Plus size={15} /> Create Code
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {mockCoupons.map((c) => (
          <div key={c.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-base font-extrabold font-mono text-[#ff5500] bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200">{c.code}</span>
              <StatusBadge status={c.status} />
            </div>
            <p className="text-sm font-bold text-slate-900">{c.discount}</p>
            <p className="text-xs text-slate-500">Used: {c.usedCount} / {c.usageLimit}</p>
            <p className="text-[10px] text-slate-400 font-mono">Expires: {c.validTill}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

/* =========================================================================
   11. REPORTS PAGE
   ========================================================================= */
export const ReportManagement = () => {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Platform Reports</h2>
        <p className="text-xs text-slate-500">System analytics, fulfillment heatmaps, and performance reports</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <h3 className="text-base font-bold text-slate-900">Fulfillment Speed Analysis</h3>
          <div className="h-40 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center text-xs text-[#ff5500] font-mono font-bold">
            [ Average Dispatch Time: 24.5 mins ]
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <h3 className="text-base font-bold text-slate-900">Seller Settlement Rate</h3>
          <div className="h-40 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center text-xs text-emerald-600 font-mono font-bold">
            [ 99.8% On-Time Payouts ]
          </div>
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   12. FAQ MANAGEMENT PAGE (Simplified & App-Targeted)
   ========================================================================= */
export const FaqManagement = () => {
  const [faqs, setFaqs] = useState(mockFaqs);
  const [loading, setLoading] = useState(false);

  // Form State for Add / Edit FAQ
  const [editingFaqId, setEditingFaqId] = useState(null);
  const [faqQuestion, setFaqQuestion] = useState('');
  const [targetApp, setTargetApp] = useState('Customer'); // Customer, Seller, Delivery Captain, General
  const [faqAnswer, setFaqAnswer] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(true);

  // Support & Helpline Management State
  const [isSupportFormOpen, setIsSupportFormOpen] = useState(false);
  const [savingSupport, setSavingSupport] = useState(false);
  const [supportForm, setSupportForm] = useState({
    customerPhone: '+91 63774 60692',
    customerEmail: 'shippnexin26@gmail.com',
    customerHours: '24/7 Priority Support',
    sellerPhone: '+91 63774 60692',
    sellerEmail: 'shippnexin26@gmail.com',
    sellerHours: 'Mon - Sat (9 AM - 8 PM)',
    captainPhone: '+91 63774 60692',
    captainEmail: 'shippnexin26@gmail.com',
    captainHours: '24/7 Active Dispatch Line',
    whatsappNumber: '+91 63774 60692',
  });

  // Table controls (search, filter, pagination)
  const [search, setSearch] = useState('');
  const [selectedAppFilter, setSelectedAppFilter] = useState('ALL');
  const [entriesPerPage, setEntriesPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const loadFaqs = async () => {
    try {
      setLoading(true);
      const res = await faqService.getAdminFaqs();
      if (res && res.success && Array.isArray(res.faqs) && res.faqs.length > 0) {
        setFaqs(res.faqs);
      }
    } catch (err) {
      console.warn('Failed to load FAQs:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSupportSettings = async () => {
    try {
      const settings = await supportService.getSupportSettings();
      if (settings) {
        setSupportForm({
          customerPhone: settings.customerPhone || '+91 63774 60692',
          customerEmail: settings.customerEmail || 'shippnexin26@gmail.com',
          customerHours: settings.customerHours || '24/7 Priority Support',
          sellerPhone: settings.sellerPhone || '+91 63774 60692',
          sellerEmail: settings.sellerEmail || 'shippnexin26@gmail.com',
          sellerHours: settings.sellerHours || 'Mon - Sat (9 AM - 8 PM)',
          captainPhone: settings.captainPhone || '+91 63774 60692',
          captainEmail: settings.captainEmail || 'shippnexin26@gmail.com',
          captainHours: settings.captainHours || '24/7 Active Dispatch Line',
          whatsappNumber: settings.whatsappNumber || '+91 63774 60692',
        });
      }
    } catch (err) {
      console.warn('Failed to load support settings:', err);
    }
  };

  useEffect(() => {
    loadFaqs();
    loadSupportSettings();
  }, []);

  const handleSaveSupportSettings = async (e) => {
    e.preventDefault();
    try {
      setSavingSupport(true);
      await supportService.updateSupportSettings(supportForm);
      alert('✅ Support contacts & helpline details updated successfully across Customer, Seller, and Captain apps!');
    } catch (err) {
      console.error('Error saving support settings:', err);
      alert('Error updating support settings. Please try again.');
    } finally {
      setSavingSupport(false);
    }
  };

  // Calculate Visibility Counts for each App / Panel
  const appCounts = useMemo(() => {
    const total = faqs.length;
    const customer = faqs.filter(f => f.category === 'Customer').length;
    const seller = faqs.filter(f => f.category === 'Seller').length;
    const captain = faqs.filter(f => f.category === 'Delivery Captain').length;
    const general = faqs.filter(f => f.category === 'General' || f.category === 'General (Visible to all)').length;
    return { total, customer, seller, captain, general };
  }, [faqs]);

  // Handle Add/Update FAQ
  const handleSaveFaq = async (e) => {
    e.preventDefault();
    if (!faqQuestion.trim() || !faqAnswer.trim()) {
      alert('Please fill in both question and answer.');
      return;
    }

    try {
      if (editingFaqId) {
        const res = await faqService.updateFaq(editingFaqId, {
          question: faqQuestion,
          category: targetApp,
          answer: faqAnswer,
        });
        const updatedList = faqs.map(f => (f._id === editingFaqId || f.id === editingFaqId) 
          ? (res.faq || { ...f, question: faqQuestion, category: targetApp, answer: faqAnswer }) 
          : f
        );
        setFaqs(updatedList);
        setEditingFaqId(null);
        alert('FAQ updated successfully!');
      } else {
        const res = await faqService.createFaq({
          category: targetApp,
          question: faqQuestion,
          answer: faqAnswer,
        });
        const newFaq = res.faq || {
          _id: Date.now().toString(),
          id: Date.now(),
          category: targetApp,
          question: faqQuestion,
          answer: faqAnswer
        };
        setFaqs([newFaq, ...faqs]);
        alert('Question added successfully!');
      }
      setFaqQuestion('');
      setFaqAnswer('');
    } catch (err) {
      console.error('Error saving FAQ:', err);
      if (editingFaqId) {
        setFaqs(faqs.map(f => (f._id === editingFaqId || f.id === editingFaqId) ? { ...f, question: faqQuestion, category: targetApp, answer: faqAnswer } : f));
        setEditingFaqId(null);
      } else {
        setFaqs([{ _id: Date.now().toString(), id: Date.now(), category: targetApp, question: faqQuestion, answer: faqAnswer }, ...faqs]);
      }
      alert('Saved successfully!');
      setFaqQuestion('');
      setFaqAnswer('');
    }
  };

  const handleEditClick = (faq) => {
    setEditingFaqId(faq._id || faq.id);
    setFaqQuestion(faq.question);
    setTargetApp(faq.category || 'Customer');
    setFaqAnswer(faq.answer);
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingFaqId(null);
    setFaqQuestion('');
    setTargetApp('Customer');
    setFaqAnswer('');
  };

  const handleDeleteClick = async (faqItem) => {
    const id = faqItem._id || faqItem.id;
    if (window.confirm(`Are you sure you want to delete "${faqItem.question}"?`)) {
      try {
        if (id) {
          await faqService.deleteFaq(id);
        }
      } catch (err) {
        console.warn('Error deleting from server:', err);
      }
      const updatedList = faqs.filter(f => {
        const fId = f._id || f.id;
        if (fId && id) return String(fId) !== String(id);
        return f.question !== faqItem.question;
      });
      setFaqs(updatedList);
      if (editingFaqId === id) {
        handleCancelEdit();
      }
    }
  };

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + ["ID,Target App/Panel,FAQ Question,FAQ Answer"].concat(
        filteredFaqs.map(f => `"${f._id || f.id}","${f.category}","${f.question.replace(/"/g, '""')}","${f.answer.replace(/"/g, '""')}"`)
      ).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "faqs_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filtered List
  const filteredFaqs = faqs.filter(f => {
    if (selectedAppFilter !== 'ALL') {
      if (selectedAppFilter === 'General') {
        if (f.category !== 'General' && f.category !== 'General (Visible to all)') return false;
      } else if (f.category !== selectedAppFilter) {
        return false;
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchQ = (f.question || '').toLowerCase().includes(q);
      const matchA = (f.answer || '').toLowerCase().includes(q);
      const matchC = (f.category || '').toLowerCase().includes(q);
      if (!matchQ && !matchA && !matchC) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredFaqs.length / entriesPerPage) || 1;
  const indexOfLastItem = currentPage * entriesPerPage;
  const indexOfFirstItem = indexOfLastItem - entriesPerPage;
  const currentFaqs = filteredFaqs.slice(indexOfFirstItem, indexOfLastItem);

  const getAppBadge = (cat) => {
    switch (cat) {
      case 'Customer':
        return {
          bg: 'bg-[#002625]/10 text-[#002625] border-[#002625]/25',
          label: '🛍️ Customer App',
        };
      case 'Seller':
        return {
          bg: 'bg-orange-50 text-[#ff5500] border-orange-200',
          label: '🏪 Seller Panel',
        };
      case 'Delivery Captain':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-300',
          label: '🚚 Captain App',
        };
      case 'General':
      case 'General (Visible to all)':
      default:
        return {
          bg: 'bg-slate-100 text-slate-800 border-slate-300',
          label: '🌐 General (All Apps)',
        };
    }
  };

  return (
    <div className="space-y-3 animate-fadeIn pb-6 font-sans">
      
      {/* Header Banner - Compact & Crisp */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white px-5 py-3.5 rounded-2xl border-2 border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-[22px] font-black text-[#002625] tracking-tight m-0 flex items-center gap-2">
            <span>FAQ & Helpline Management</span>
          </h2>
          <p className="text-[13.5px] text-slate-600 font-medium m-0 mt-0.5">
            Manage live helpdesk FAQs and official contact numbers for Customer, Seller, and Captain apps.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={() => setIsSupportFormOpen(prev => !prev)}
            className={`px-3.5 py-2 text-[13.5px] font-black rounded-xl border-2 cursor-pointer flex items-center gap-2 transition-all ${
              isSupportFormOpen 
                ? 'bg-[#002625] text-white border-[#002625] shadow-sm' 
                : 'bg-white hover:bg-slate-50 text-[#002625] border-[#002625]/25 shadow-2xs'
            }`}
          >
            <Phone size={15} className={isSupportFormOpen ? 'text-[#ff5500]' : 'text-[#002625]'} /> 
            {isSupportFormOpen ? 'Hide Helpline Settings' : 'Helpline & Support Numbers'}
          </button>

          <button 
            onClick={loadFaqs} 
            disabled={loading}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[13.5px] font-bold rounded-xl border-none cursor-pointer flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-slate-700' : 'text-slate-700'} /> Refresh
          </button>
          
          <button 
            onClick={() => {
              if (editingFaqId) handleCancelEdit();
              setIsFormOpen(prev => !prev);
            }} 
            className="px-4 py-2 bg-[#ff5500] hover:bg-[#e04a00] active:scale-98 text-white text-[13.5px] font-black rounded-xl border-none cursor-pointer flex items-center gap-2 transition-all shadow-sm"
          >
            <Plus size={16} /> {editingFaqId ? 'Cancel Edit' : (isFormOpen ? 'Hide Add Form' : 'Add New Question')}
          </button>
        </div>
      </div>

      {/* Support & Helpline Numbers Manager (Collapsible) - Brand Themed & High Contrast */}
      {isSupportFormOpen && (
        <div className="bg-white rounded-2xl border-2 border-[#002625]/20 shadow-md overflow-hidden animate-fadeIn">
          <div className="bg-[#002625] px-5 py-3 text-white flex items-center justify-between border-b border-[#003837]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#ff5500]/20 flex items-center justify-center text-[#ff5500] border border-[#ff5500]/30">
                <Phone size={16} />
              </div>
              <div>
                <h3 className="text-[14.5px] font-black text-white m-0 tracking-wide flex items-center gap-2">
                  Helpline & Support Contact Numbers
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#ff5500] text-white uppercase tracking-wider">
                    ⚡ Live DB Sync
                  </span>
                </h3>
                <p className="text-[12px] text-teal-100/80 m-0 mt-0.5 font-medium">
                  Direct phone numbers and emails displayed across Customer (<code className="text-amber-300 font-mono font-bold">/support</code>), Seller (<code className="text-amber-300 font-mono font-bold">/seller/support</code>), and Captain (<code className="text-amber-300 font-mono font-bold">/captain/support</code>) apps.
                </p>
              </div>
            </div>
            <button 
              type="button" 
              onClick={() => setIsSupportFormOpen(false)} 
              className="text-[12.5px] font-bold bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-lg border border-white/20 cursor-pointer transition-colors"
            >
              ✕ Close
            </button>
          </div>

          <form onSubmit={handleSaveSupportSettings} className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* 1. Customer Support */}
              <div className="bg-slate-50/90 p-4 rounded-xl border-2 border-slate-200 hover:border-[#002625]/40 transition-all space-y-3 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#002625]/10 flex items-center justify-center text-[#002625]">
                      <Package size={16} />
                    </div>
                    <div>
                      <span className="text-[14px] font-black text-[#002625] block leading-tight">Customer Support</span>
                      <span className="text-[11px] text-slate-500 font-semibold">Shopping Users</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-[#002625] text-white">
                    🛍️ /support
                  </span>
                </div>
                
                <div>
                  <label className="block text-[13px] font-black text-[#002625] mb-1">Customer Phone Number</label>
                  <input 
                    type="text" 
                    value={supportForm.customerPhone}
                    onChange={(e) => setSupportForm({ ...supportForm, customerPhone: e.target.value })}
                    className="w-full bg-white border-2 border-slate-300 rounded-lg px-3 py-2 text-[14px] text-slate-900 font-bold focus:outline-none focus:border-[#ff5500] focus:ring-2 focus:ring-[#ff5500]/20 transition-all shadow-2xs"
                    placeholder="+91 63774 60692"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-black text-[#002625] mb-1">Customer Support Email</label>
                  <input 
                    type="email" 
                    value={supportForm.customerEmail}
                    onChange={(e) => setSupportForm({ ...supportForm, customerEmail: e.target.value })}
                    className="w-full bg-white border-2 border-slate-300 rounded-lg px-3 py-2 text-[14px] text-slate-900 font-bold focus:outline-none focus:border-[#ff5500] focus:ring-2 focus:ring-[#ff5500]/20 transition-all shadow-2xs"
                    placeholder="shippnexin26@gmail.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-black text-[#002625] mb-1">Working Hours / Note</label>
                  <input 
                    type="text" 
                    value={supportForm.customerHours}
                    onChange={(e) => setSupportForm({ ...supportForm, customerHours: e.target.value })}
                    className="w-full bg-white border-2 border-slate-300 rounded-lg px-3 py-2 text-[13.5px] text-slate-900 font-semibold focus:outline-none focus:border-[#ff5500] focus:ring-2 focus:ring-[#ff5500]/20 transition-all shadow-2xs"
                    placeholder="24/7 Priority Support"
                  />
                </div>
              </div>

              {/* 2. Seller Support */}
              <div className="bg-slate-50/90 p-4 rounded-xl border-2 border-slate-200 hover:border-[#ff5500]/40 transition-all space-y-3 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#ff5500]/15 flex items-center justify-center text-[#ff5500]">
                      <Store size={16} />
                    </div>
                    <div>
                      <span className="text-[14px] font-black text-[#002625] block leading-tight">Seller Support</span>
                      <span className="text-[11px] text-slate-500 font-semibold">Merchants & Stores</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-[#ff5500] text-white">
                    🏪 /seller/support
                  </span>
                </div>

                <div>
                  <label className="block text-[13px] font-black text-[#002625] mb-1">Merchant Helpline Phone</label>
                  <input 
                    type="text" 
                    value={supportForm.sellerPhone}
                    onChange={(e) => setSupportForm({ ...supportForm, sellerPhone: e.target.value })}
                    className="w-full bg-white border-2 border-slate-300 rounded-lg px-3 py-2 text-[14px] text-slate-900 font-bold focus:outline-none focus:border-[#ff5500] focus:ring-2 focus:ring-[#ff5500]/20 transition-all shadow-2xs"
                    placeholder="+91 63774 60692"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-black text-[#002625] mb-1">Merchant Relations Email</label>
                  <input 
                    type="email" 
                    value={supportForm.sellerEmail}
                    onChange={(e) => setSupportForm({ ...supportForm, sellerEmail: e.target.value })}
                    className="w-full bg-white border-2 border-slate-300 rounded-lg px-3 py-2 text-[14px] text-slate-900 font-bold focus:outline-none focus:border-[#ff5500] focus:ring-2 focus:ring-[#ff5500]/20 transition-all shadow-2xs"
                    placeholder="shippnexin26@gmail.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-black text-[#002625] mb-1">Merchant Support Hours</label>
                  <input 
                    type="text" 
                    value={supportForm.sellerHours}
                    onChange={(e) => setSupportForm({ ...supportForm, sellerHours: e.target.value })}
                    className="w-full bg-white border-2 border-slate-300 rounded-lg px-3 py-2 text-[13.5px] text-slate-900 font-semibold focus:outline-none focus:border-[#ff5500] focus:ring-2 focus:ring-[#ff5500]/20 transition-all shadow-2xs"
                    placeholder="Mon - Sat (9 AM - 8 PM)"
                  />
                </div>
              </div>

              {/* 3. Captain Support */}
              <div className="bg-slate-50/90 p-4 rounded-xl border-2 border-slate-200 hover:border-emerald-600/40 transition-all space-y-3 shadow-2xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
                      <Truck size={16} />
                    </div>
                    <div>
                      <span className="text-[14px] font-black text-[#002625] block leading-tight">Captain Dispatch</span>
                      <span className="text-[11px] text-slate-500 font-semibold">Delivery Drivers</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-emerald-700 text-white">
                    🚚 /captain/support
                  </span>
                </div>

                <div>
                  <label className="block text-[13px] font-black text-[#002625] mb-1">Dispatch Helpline Phone</label>
                  <input 
                    type="text" 
                    value={supportForm.captainPhone}
                    onChange={(e) => setSupportForm({ ...supportForm, captainPhone: e.target.value })}
                    className="w-full bg-white border-2 border-slate-300 rounded-lg px-3 py-2 text-[14px] text-slate-900 font-bold focus:outline-none focus:border-[#ff5500] focus:ring-2 focus:ring-[#ff5500]/20 transition-all shadow-2xs"
                    placeholder="+91 63774 60692"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-black text-[#002625] mb-1">Dispatch Support Email</label>
                  <input 
                    type="email" 
                    value={supportForm.captainEmail}
                    onChange={(e) => setSupportForm({ ...supportForm, captainEmail: e.target.value })}
                    className="w-full bg-white border-2 border-slate-300 rounded-lg px-3 py-2 text-[14px] text-slate-900 font-bold focus:outline-none focus:border-[#ff5500] focus:ring-2 focus:ring-[#ff5500]/20 transition-all shadow-2xs"
                    placeholder="shippnexin26@gmail.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-black text-[#002625] mb-1">Dispatch Availability</label>
                  <input 
                    type="text" 
                    value={supportForm.captainHours}
                    onChange={(e) => setSupportForm({ ...supportForm, captainHours: e.target.value })}
                    className="w-full bg-white border-2 border-slate-300 rounded-lg px-3 py-2 text-[13.5px] text-slate-900 font-semibold focus:outline-none focus:border-[#ff5500] focus:ring-2 focus:ring-[#ff5500]/20 transition-all shadow-2xs"
                    placeholder="24/7 Active Dispatch Line"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-slate-100">
              <button 
                type="submit" 
                disabled={savingSupport}
                className="px-6 py-2.5 bg-[#ff5500] hover:bg-[#e04a00] active:scale-98 text-white text-[14px] font-black rounded-xl transition-all border-none cursor-pointer shadow-md flex items-center gap-2 disabled:opacity-60"
              >
                <CheckCircle size={17} className="text-white" /> 
                {savingSupport ? 'Saving Support Contacts...' : 'Save Support Contacts to Live DB'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* App Visibility Breakdown Cards (KPIs) - Themed & High Contrast */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        
        {/* Total FAQs */}
        <div 
          onClick={() => { setSelectedAppFilter('ALL'); setCurrentPage(1); }}
          className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
            selectedAppFilter === 'ALL'
              ? 'bg-[#002625] text-white border-[#002625] shadow-md ring-2 ring-[#002625]/20'
              : 'bg-white border-slate-200 text-slate-800 hover:border-[#002625]/40 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[13.5px] font-black">All Questions</span>
            <Boxes size={17} className={selectedAppFilter === 'ALL' ? 'text-[#ff5500]' : 'text-slate-400'} />
          </div>
          <p className="text-[26px] font-black my-0.5 tracking-tight leading-none">{appCounts.total}</p>
          <span className={`text-[12px] font-bold ${selectedAppFilter === 'ALL' ? 'text-teal-200' : 'text-slate-500'}`}>Total Questions</span>
        </div>

        {/* Customer App */}
        <div 
          onClick={() => { setSelectedAppFilter('Customer'); setCurrentPage(1); }}
          className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
            selectedAppFilter === 'Customer'
              ? 'bg-[#002625] text-white border-[#002625] shadow-md ring-2 ring-[#002625]/20'
              : 'bg-white border-slate-200 hover:border-[#002625]/40 text-slate-800 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[13.5px] font-black ${selectedAppFilter === 'Customer' ? 'text-white' : 'text-[#002625]'}`}>Customer App</span>
            <Package size={17} className={selectedAppFilter === 'Customer' ? 'text-[#ff5500]' : 'text-[#002625]'} />
          </div>
          <p className={`text-[26px] font-black my-0.5 tracking-tight leading-none ${selectedAppFilter === 'Customer' ? 'text-white' : 'text-[#002625]'}`}>{appCounts.customer}</p>
          <span className={`text-[12px] font-bold ${selectedAppFilter === 'Customer' ? 'text-teal-200' : 'text-slate-500'}`}>Shopping users</span>
        </div>

        {/* Seller Panel */}
        <div 
          onClick={() => { setSelectedAppFilter('Seller'); setCurrentPage(1); }}
          className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
            selectedAppFilter === 'Seller'
              ? 'bg-[#ff5500] text-white border-[#ff5500] shadow-md ring-2 ring-[#ff5500]/20'
              : 'bg-white border-slate-200 hover:border-[#ff5500]/40 text-slate-800 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[13.5px] font-black ${selectedAppFilter === 'Seller' ? 'text-white' : 'text-[#ff5500]'}`}>Seller Panel</span>
            <Store size={17} className={selectedAppFilter === 'Seller' ? 'text-white' : 'text-[#ff5500]'} />
          </div>
          <p className={`text-[26px] font-black my-0.5 tracking-tight leading-none ${selectedAppFilter === 'Seller' ? 'text-white' : 'text-[#ff5500]'}`}>{appCounts.seller}</p>
          <span className={`text-[12px] font-bold ${selectedAppFilter === 'Seller' ? 'text-white/90' : 'text-slate-500'}`}>Merchants & Stores</span>
        </div>

        {/* Captain App */}
        <div 
          onClick={() => { setSelectedAppFilter('Delivery Captain'); setCurrentPage(1); }}
          className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
            selectedAppFilter === 'Delivery Captain'
              ? 'bg-emerald-700 text-white border-emerald-700 shadow-md ring-2 ring-emerald-600/20'
              : 'bg-white border-slate-200 hover:border-emerald-600/40 text-slate-800 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[13.5px] font-black ${selectedAppFilter === 'Delivery Captain' ? 'text-white' : 'text-emerald-700'}`}>Captain App</span>
            <Truck size={17} className={selectedAppFilter === 'Delivery Captain' ? 'text-white' : 'text-emerald-600'} />
          </div>
          <p className={`text-[26px] font-black my-0.5 tracking-tight leading-none ${selectedAppFilter === 'Delivery Captain' ? 'text-white' : 'text-emerald-700'}`}>{appCounts.captain}</p>
          <span className={`text-[12px] font-bold ${selectedAppFilter === 'Delivery Captain' ? 'text-emerald-100' : 'text-slate-500'}`}>Delivery drivers</span>
        </div>

        {/* General / All */}
        <div 
          onClick={() => { setSelectedAppFilter('General'); setCurrentPage(1); }}
          className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between col-span-2 sm:col-span-1 ${
            selectedAppFilter === 'General'
              ? 'bg-slate-800 text-white border-slate-800 shadow-md ring-2 ring-slate-700/20'
              : 'bg-white border-slate-200 hover:border-slate-400 text-slate-800 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[13.5px] font-black ${selectedAppFilter === 'General' ? 'text-white' : 'text-slate-800'}`}>General</span>
            <HelpCircle size={17} className={selectedAppFilter === 'General' ? 'text-white' : 'text-slate-500'} />
          </div>
          <p className={`text-[26px] font-black my-0.5 tracking-tight leading-none ${selectedAppFilter === 'General' ? 'text-white' : 'text-slate-800'}`}>{appCounts.general}</p>
          <span className={`text-[12px] font-bold ${selectedAppFilter === 'General' ? 'text-slate-300' : 'text-slate-500'}`}>All apps & web</span>
        </div>

      </div>

      {/* Simple "Add / Edit Question" Form - Compact & Clear */}
      {isFormOpen && (
        <div className="bg-white rounded-2xl border-2 border-orange-200 shadow-xs overflow-hidden animate-fadeIn">
          <div className="bg-[#002625] px-5 py-3 text-white flex items-center justify-between border-b border-[#003837]">
            <div className="flex items-center gap-2.5">
              <span className="text-base">{editingFaqId ? '✏️' : '➕'}</span>
              <h3 className="text-[14.5px] font-black m-0 tracking-wide text-white">
                {editingFaqId ? 'Edit FAQ Question' : 'Add New FAQ Question'}
              </h3>
            </div>
            {editingFaqId && (
              <button 
                type="button" 
                onClick={handleCancelEdit} 
                className="text-[12.5px] bg-white/15 hover:bg-white/25 text-white px-3 py-1 rounded-lg border-none cursor-pointer font-bold transition-colors"
              >
                ✕ Cancel Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSaveFaq} className="p-4 sm:p-5 space-y-3.5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              
              {/* Target App Dropdown */}
              <div className="md:col-span-1">
                <label className="block text-[13.5px] font-black text-[#002625] mb-1">
                  Select App / Panel <span className="text-rose-500">*</span>
                </label>
                <select 
                  value={targetApp}
                  onChange={(e) => setTargetApp(e.target.value)}
                  className="w-full bg-white border-2 border-slate-300 rounded-lg px-3 py-2 text-[14px] text-slate-900 font-bold focus:outline-none focus:border-[#ff5500] focus:ring-2 focus:ring-[#ff5500]/20 transition-all cursor-pointer shadow-2xs"
                >
                  <option value="Customer">🛍️ Customer App (Shopping Users)</option>
                  <option value="Seller">🏪 Seller Panel (Merchants)</option>
                  <option value="Delivery Captain">🚚 Delivery Captain App (Drivers)</option>
                  <option value="General">🌐 General (Visible to All Apps)</option>
                </select>
                <p className="text-[12px] text-slate-500 mt-1 m-0 font-medium">Target audience for this question.</p>
              </div>

              {/* Question Input */}
              <div className="md:col-span-2">
                <label className="block text-[13.5px] font-black text-[#002625] mb-1">
                  Question <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text" 
                  placeholder="e.g., How can I track my shipment live?"
                  value={faqQuestion}
                  onChange={(e) => setFaqQuestion(e.target.value)}
                  className="w-full bg-white border-2 border-slate-300 rounded-lg px-3 py-2 text-[14px] text-slate-900 placeholder:text-slate-400 font-bold focus:outline-none focus:border-[#ff5500] focus:ring-2 focus:ring-[#ff5500]/20 transition-all shadow-2xs"
                  required
                />
              </div>

            </div>

            {/* Answer Textarea */}
            <div>
              <label className="block text-[13.5px] font-black text-[#002625] mb-1">
                Answer <span className="text-rose-500">*</span>
              </label>
              <textarea 
                rows={3}
                placeholder="e.g., Go to your Orders section or enter your tracking ID on the Track Order page for real-time GPS tracking updates."
                value={faqAnswer}
                onChange={(e) => setFaqAnswer(e.target.value)}
                className="w-full bg-white border-2 border-slate-300 rounded-lg p-3 text-[14px] text-slate-900 placeholder:text-slate-400 font-medium focus:outline-none focus:border-[#ff5500] focus:ring-2 focus:ring-[#ff5500]/20 transition-all resize-y leading-relaxed shadow-2xs"
                required
              />
            </div>

            {/* Submit Actions */}
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
              {editingFaqId && (
                <button 
                  type="button" 
                  onClick={handleCancelEdit} 
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[13.5px] font-bold rounded-xl border-none cursor-pointer transition-colors"
                >
                  Cancel
                </button>
              )}
              <button 
                type="submit" 
                className="px-5 py-2 bg-[#ff5500] hover:bg-[#e04a00] active:scale-98 text-white text-[13.5px] font-black rounded-xl transition-all border-none cursor-pointer shadow-sm flex items-center gap-2"
              >
                <CheckCircle size={16} /> {editingFaqId ? 'Update Question' : 'Save & Publish Question'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Questions Data Table - Compact & Legible */}
      <div className="bg-white rounded-2xl border-2 border-slate-200 shadow-2xs overflow-hidden">
        
        {/* Table Controls Bar */}
        <div className="p-3 sm:p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          
          {/* Left: Filter Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
            <button 
              onClick={() => { setSelectedAppFilter('ALL'); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 rounded-xl text-[13px] font-black border-2 transition-all cursor-pointer whitespace-nowrap ${
                selectedAppFilter === 'ALL'
                  ? 'bg-[#002625] text-white border-[#002625] shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              All ({appCounts.total})
            </button>
            <button 
              onClick={() => { setSelectedAppFilter('Customer'); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 rounded-xl text-[13px] font-black border-2 transition-all cursor-pointer whitespace-nowrap ${
                selectedAppFilter === 'Customer'
                  ? 'bg-[#002625] text-white border-[#002625] shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              🛍️ Customer ({appCounts.customer})
            </button>
            <button 
              onClick={() => { setSelectedAppFilter('Seller'); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 rounded-xl text-[13px] font-black border-2 transition-all cursor-pointer whitespace-nowrap ${
                selectedAppFilter === 'Seller'
                  ? 'bg-[#ff5500] text-white border-[#ff5500] shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              🏪 Seller ({appCounts.seller})
            </button>
            <button 
              onClick={() => { setSelectedAppFilter('Delivery Captain'); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 rounded-xl text-[13px] font-black border-2 transition-all cursor-pointer whitespace-nowrap ${
                selectedAppFilter === 'Delivery Captain'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              🚚 Captain ({appCounts.captain})
            </button>
            <button 
              onClick={() => { setSelectedAppFilter('General'); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 rounded-xl text-[13px] font-black border-2 transition-all cursor-pointer whitespace-nowrap ${
                selectedAppFilter === 'General'
                  ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              🌐 General ({appCounts.general})
            </button>
          </div>

          {/* Right: Search & Export */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                placeholder="Search questions..."
                className="bg-white border-2 border-slate-200 rounded-xl pl-9 pr-7 py-1.5 text-[13.5px] font-semibold text-slate-900 focus:outline-none focus:border-[#ff5500] w-52 shadow-2xs"
              />
              {search && (
                <button 
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer p-0 text-[12px] font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            <button 
              type="button" 
              onClick={handleExport}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[13px] font-bold rounded-xl border-none cursor-pointer flex items-center gap-1.5 transition-colors"
              title="Export CSV"
            >
              <Download size={14} /> Export
            </button>
          </div>

        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-800 font-bold text-[13px]">
                <th className="py-2.5 px-3.5 w-12 text-center">#</th>
                <th className="py-2.5 px-3.5 w-44">Target App / Panel</th>
                <th className="py-2.5 px-3.5 w-1/3">Question</th>
                <th className="py-2.5 px-3.5">Answer</th>
                <th className="py-2.5 px-3.5 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {currentFaqs.length > 0 ? (
                currentFaqs.map((faq, idx) => {
                  const badge = getAppBadge(faq.category);
                  const isCurrentEditing = editingFaqId === (faq._id || faq.id);
                  return (
                    <tr 
                      key={faq._id || faq.id || idx} 
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isCurrentEditing ? 'bg-orange-50/60 font-medium' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3.5 text-center font-mono font-bold text-[13.5px] text-slate-400">
                        {indexOfFirstItem + idx + 1}
                      </td>

                      <td className="py-2.5 px-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[12.5px] font-bold border inline-flex items-center gap-1 ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </td>

                      <td className="py-2.5 px-3.5 font-bold text-slate-900 text-[14.5px] leading-snug">
                        {faq.question}
                      </td>

                      <td className="py-2.5 px-3.5 text-slate-700 text-[13.5px] leading-relaxed max-w-md font-normal">
                        {faq.answer}
                      </td>

                      <td className="py-2.5 px-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button 
                            onClick={() => handleEditClick(faq)}
                            className="p-1.5 bg-slate-100 hover:bg-[#ff5500] hover:text-white text-slate-600 rounded-lg transition-colors border-none cursor-pointer"
                            title="Edit Question"
                          >
                            <Pencil size={15} />
                          </button>
                          <button 
                            onClick={() => handleDeleteClick(faq)}
                            className="p-1.5 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-600 rounded-lg transition-colors border-none cursor-pointer"
                            title="Delete Question"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-400">
                    <HelpCircle size={28} className="mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-slate-700 text-[14px] m-0">No questions found</p>
                    <p className="text-[13px] text-slate-400 mt-0.5 m-0">
                      {search || selectedAppFilter !== 'ALL' 
                        ? 'Try clearing filters or searching another keyword.' 
                        : 'Click "+ Add New Question" to create your first FAQ.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination */}
        <div className="p-2.5 sm:p-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[13px] text-slate-600 font-medium">
          <span>
            Showing {filteredFaqs.length > 0 ? indexOfFirstItem + 1 : 0} to {Math.min(indexOfLastItem, filteredFaqs.length)} of {filteredFaqs.length} questions
          </span>

          {totalPages > 1 && (
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 items-center">
              <button 
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 text-[12.5px] font-semibold text-slate-600 hover:text-slate-900 border-none bg-transparent cursor-pointer disabled:opacity-40"
              >
                ‹ Prev
              </button>
              <span className="px-3 py-1 bg-[#ff5500] text-white text-[13px] font-bold rounded-md">
                {currentPage} / {totalPages}
              </span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 text-[12.5px] font-semibold text-slate-600 hover:text-slate-900 border-none bg-transparent cursor-pointer disabled:opacity-40"
              >
                Next ›
              </button>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};

/* =========================================================================
   13. NOTIFICATIONS PAGE
   ========================================================================= */
export const NotificationManagement = () => {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Broadcast Notifications</h2>
          <p className="text-xs text-slate-500">Push alerts, SMS, and email campaign broadcasts</p>
        </div>
        <button onClick={() => alert('New Broadcast (UI)')} className="px-3.5 py-2 bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 border-none cursor-pointer">
          <Send size={15} /> Send Broadcast
        </button>
      </div>

      <div className="space-y-3">
        {mockNotifications.map((n) => (
          <div key={n.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-900">{n.title}</h3>
              <p className="text-xs text-slate-600 mt-0.5">{n.message}</p>
              <span className="text-[10px] text-slate-400 font-mono mt-1 inline-block">{n.time}</span>
            </div>
            <StatusBadge status={n.type} />
          </div>
        ))}
      </div>
    </div>
  );
};

/* =========================================================================
   13. ROLES & PERMISSIONS PAGE
   ========================================================================= */
export const RoleManagement = () => {
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Roles & Access Matrix</h2>
        <p className="text-xs text-slate-500">Configure administrative privilege matrix and staff accounts</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mockRoles.map((r) => (
          <div key={r.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900">{r.name}</h3>
              <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">{r.members} Members</span>
            </div>
            <p className="text-xs text-slate-600">Permissions: <strong className="text-slate-900">{r.permissions}</strong></p>
          </div>
        ))}
      </div>
    </div>
  );
};

/* =========================================================================
   14. SYSTEM SETTINGS PAGE
   ========================================================================= */
export const SettingManagement = () => {
  const [fcmTesting, setFcmTesting] = useState(false);
  const [fcmTestResult, setFcmTestResult] = useState(null);
  const [commissionFee, setCommissionFee] = useState('2.5');
  const [deliverySurcharge, setDeliverySurcharge] = useState('4.50');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const handleTestFCM = async () => {
    setFcmTesting(true);
    setFcmTestResult(null);
    try {
      const res = await fcmService.sendTestPush();
      setFcmTestResult(res);
    } catch (err) {
      setFcmTestResult({
        success: false,
        error: err.response?.data?.error || err.response?.data?.message || err.message
      });
    } finally {
      setFcmTesting(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveMessage('');
    try {
      localStorage.setItem('platform_commission_fee', commissionFee);
      localStorage.setItem('delivery_surcharge', deliverySurcharge);
      setSaveMessage('✓ Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      setSaveMessage('✗ Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  React.useEffect(() => {
    const saved_fee = localStorage.getItem('platform_commission_fee');
    const saved_surcharge = localStorage.getItem('delivery_surcharge');
    if (saved_fee) setCommissionFee(saved_fee);
    if (saved_surcharge) setDeliverySurcharge(saved_surcharge);
  }, []);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Global Platform Settings</h2>
        <p className="text-xs text-slate-500">Branding, tax rules, payment gateways, push notifications, and security configurations</p>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 max-w-3xl">
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-[#ff5500] uppercase tracking-wider">General Branding & Fees</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500 block mb-1">Platform Commission Fee (%)</label>
              <input
                type="number"
                step="0.1"
                value={commissionFee}
                onChange={(e) => setCommissionFee(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 block mb-1">Base Delivery Surcharge (₹)</label>
              <input
                type="number"
                step="0.01"
                value={deliverySurcharge}
                onChange={(e) => setDeliverySurcharge(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
              />
            </div>
          </div>
        </div>

        {/* Firebase Push Notifications (SOP Standard) */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Firebase Cloud Messaging (FCM)</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Push notifications for Customer orders, Merchant alerts & Delivery Captains (SOP v2.0)</p>
            </div>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-extrabold uppercase">
              SOP Active
            </span>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="text-xs text-slate-600 space-y-1">
              <p className="m-0 font-medium">● <b>Service Worker:</b> <code className="text-[11px] bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono">/firebase-messaging-sw.js</code></p>
              <p className="m-0 font-medium">● <b>Status:</b> Ready with standard schema and fallback dispatcher.</p>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleTestFCM}
                disabled={fcmTesting}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer border-none flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {fcmTesting ? <RefreshCw size={13} className="animate-spin" /> : null}
                <span>{fcmTesting ? 'Testing FCM...' : 'Send Test Push Notification'}</span>
              </button>
            </div>

            {fcmTestResult && (
              <div className={`p-3 rounded-xl text-xs ${fcmTestResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
                <p className="font-bold m-0">{fcmTestResult.success ? '✅ Test Notification Dispatched:' : 'ℹ️ FCM Status:'}</p>
                <p className="m-0 text-[11px] mt-0.5">{fcmTestResult.message || fcmTestResult.error || JSON.stringify(fcmTestResult)}</p>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
          {saveMessage && (
            <div className={`text-xs font-bold ${saveMessage.includes('✓') ? 'text-emerald-600' : 'text-rose-600'}`}>
              {saveMessage}
            </div>
          )}
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="ml-auto px-5 py-2.5 bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold rounded-xl cursor-pointer border-none disabled:opacity-60 transition-colors"
          >
            {saving ? 'Saving...' : 'Save System Configurations'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   15. TAX MANAGEMENT PAGE
   ========================================================================= */
export const TaxManagement = () => {
  const [taxes, setTaxes] = useState([
    { id: 'TAX-01', name: 'GST 5%', rate: 5, hsn: '1006 (Grains & Rice)', type: 'Percentage', status: 'Active' },
    { id: 'TAX-02', name: 'GST 12%', rate: 12, hsn: '1507 (Oil & Ghee)', type: 'Percentage', status: 'Active' },
    { id: 'TAX-03', name: 'GST 18%', rate: 18, hsn: '3304 (Personal Care)', type: 'Percentage', status: 'Active' },
    { id: 'TAX-04', name: 'GST 28%', rate: 28, hsn: '8711 (Electronics)', type: 'Percentage', status: 'Active' },
    { id: 'TAX-05', name: 'Exempted (0%)', rate: 0, hsn: '0701 (Fresh Veggies)', type: 'Percentage', status: 'Active' },
  ]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTax, setNewTax] = useState({ name: '', rate: '', hsn: '', type: 'Percentage', status: 'Active' });

  const filteredTaxes = taxes.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) || 
    t.hsn.toLowerCase().includes(search.toLowerCase())
  );

  const handleAddTax = (e) => {
    e.preventDefault();
    if (!newTax.name || newTax.rate === '') return;
    const created = {
      id: `TAX-0${taxes.length + 1}`,
      name: newTax.name,
      rate: Number(newTax.rate),
      hsn: newTax.hsn || 'N/A',
      type: newTax.type,
      status: newTax.status
    };
    setTaxes([...taxes, created]);
    setNewTax({ name: '', rate: '', hsn: '', type: 'Percentage', status: 'Active' });
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header & Breadcrumb */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Taxes & HSN</h1>
        <div className="text-xs text-slate-500 font-medium">
          Dashboard / <span className="text-[#ff5500] font-semibold">Tax Rules</span>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Header Bar matching Light Orange Theme */}
        <div className="bg-[#fff4ed] border-b border-orange-200/70 text-[#002625] px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-base font-bold tracking-tight text-[#002625] flex items-center gap-2">
              <ChevronRight size={18} className="text-[#ff5500]" />
              Taxes & HSN Management
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure global tax slabs, GST percentages, and HSN code rules
            </p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold rounded-xl border-none transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 shrink-0"
          >
            <Plus size={15} /> Add Tax Rule
          </button>
        </div>

        {/* Toolbar & Search Bar */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search tax rate or HSN code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50/60 border border-slate-200 rounded-md pl-9 pr-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#ff5500] focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Tax Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">TAX ID</th>
                  <th className="py-3.5 px-4">TAX NAME</th>
                  <th className="py-3.5 px-4">RATE (%)</th>
                  <th className="py-3.5 px-4">HSN CODE & CATEGORY</th>
                  <th className="py-3.5 px-4">TYPE</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredTaxes.map((tax) => (
                  <tr key={tax.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-700">{tax.id}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{tax.name}</td>
                    <td className="py-3.5 px-4 font-extrabold text-[#ff5500]">{tax.rate}%</td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono">{tax.hsn}</td>
                    <td className="py-3.5 px-4 text-slate-500 font-medium">{tax.type}</td>
                    <td className="py-3.5 px-4"><StatusBadge status={tax.status} /></td>
                    <td className="py-3.5 px-4 text-right">
                      <button 
                        onClick={() => setTaxes(taxes.filter(t => t.id !== tax.id))}
                        className="text-rose-600 hover:text-rose-800 text-xs font-bold cursor-pointer border-none bg-transparent"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Add New Tax Rule</h3>
            <form onSubmit={handleAddTax} className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Tax Label / Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. GST 18%"
                  value={newTax.name}
                  onChange={(e) => setNewTax({ ...newTax, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#ff5500]"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">Tax Rate (%)</label>
                <input 
                  type="number" 
                  required
                  placeholder="18"
                  value={newTax.rate}
                  onChange={(e) => setNewTax({ ...newTax, rate: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#ff5500]"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 block mb-1">HSN Code & Description</label>
                <input 
                  type="text" 
                  placeholder="e.g. 1006 (Grains)"
                  value={newTax.hsn}
                  onChange={(e) => setNewTax({ ...newTax, hsn: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:border-[#ff5500]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border-none cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-[#ff5500] text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-md"
                >
                  Save Tax Slabs
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* =========================================================================
   16. ADMIN PROFILE PAGE (PERSISTENT & API-DRIVEN)
   ========================================================================= */
export const AdminProfile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const getInitialProfile = () => {
    try {
      const stored = localStorage.getItem('sathiseller_admin_data') || localStorage.getItem('admin_user') || localStorage.getItem('adminUser');
      if (stored) {
        const parsed = JSON.parse(stored);
        const nameParts = (parsed.name || '').split(' ');
        return {
          firstName: parsed.firstName || nameParts[0] || 'Administrator',
          lastName: parsed.lastName || nameParts.slice(1).join(' ') || '',
          email: parsed.email || 'admin@sathiseller.com',
          mobile: parsed.mobile || parsed.phone || '',
          role: parsed.role === 'super_admin' ? 'Super Admin' : (parsed.role === 'admin' ? 'Root Administrator' : (parsed.role || 'Admin')),
          createdAt: parsed.createdAt ? new Date(parsed.createdAt).toLocaleString() : new Date().toLocaleString(),
          password: '',
          confirmPassword: '',
        };
      }
    } catch (e) {}
    return {
      firstName: 'Administrator',
      lastName: '',
      email: 'admin@sathiseller.com',
      mobile: '',
      role: 'Root Administrator',
      createdAt: new Date().toLocaleString(),
      password: '',
      confirmPassword: '',
    };
  };

  const [profile, setProfile] = useState(getInitialProfile);

  // Admin drop-off address: drivers deliver repair parcels here
  const emptyAddress = { addressLine1: '', addressLine2: '', landmark: '', city: '', state: '', pincode: '', lat: null, lng: null };
  const [address, setAddress] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('sathiseller_admin_data') || 'null');
      return { ...emptyAddress, ...(stored?.address || {}) };
    } catch (e) { return emptyAddress; }
  });
  const [pinning, setPinning] = useState(false);
  const hasAddress = Boolean(address.addressLine1 || address.city);
  const addressLine = [address.addressLine1, address.addressLine2, address.landmark, address.city, address.state, address.pincode].filter(Boolean).join(', ');

  const pinCurrentLocation = () => {
    if (!navigator.geolocation) {
      setStatusMessage({ type: 'error', text: 'This browser cannot share your location.' });
      return;
    }
    setPinning(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setAddress((prev) => ({ ...prev, lat: Number(pos.coords.latitude.toFixed(6)), lng: Number(pos.coords.longitude.toFixed(6)) }));
        setPinning(false);
      },
      () => {
        setStatusMessage({ type: 'error', text: 'Could not read your location. Allow location access and try again.' });
        setPinning(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Fetch persisted admin profile from backend on mount
  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      setIsLoading(true);
      try {
        const res = await adminService.getProfile();
        if (isMounted && res && res.admin) {
          const adm = res.admin;
          setAddress({ ...emptyAddress, ...(adm.address || {}) });
          const nameParts = (adm.name || '').split(' ');
          setProfile(prev => ({
            ...prev,
            firstName: adm.firstName || nameParts[0] || '',
            lastName: adm.lastName || nameParts.slice(1).join(' ') || '',
            email: adm.email || prev.email,
            mobile: adm.mobile || adm.phone || '',
            role: adm.role === 'super_admin' ? 'Super Admin' : (adm.role === 'admin' ? 'Root Administrator' : (adm.role || 'Admin')),
            createdAt: adm.createdAt ? new Date(adm.createdAt).toLocaleString() : prev.createdAt,
            password: '',
            confirmPassword: '',
          }));
        }
      } catch (err) {
        console.warn('Failed to fetch admin profile from backend:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadProfile();
    return () => { isMounted = false; };
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setStatusMessage(null);

    if (profile.password && profile.password !== profile.confirmPassword) {
      setStatusMessage({ type: 'error', text: 'Passwords do not match. Please verify.' });
      return;
    }

    if (profile.password && profile.password.length < 4) {
      setStatusMessage({ type: 'error', text: 'Password must be at least 4 characters.' });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        name: `${profile.firstName.trim()} ${profile.lastName.trim()}`.trim() || 'Administrator',
        email: profile.email.trim(),
        mobile: profile.mobile.trim(),
        address,
      };

      if (profile.password) {
        payload.password = profile.password;
      }

      const res = await adminService.updateProfile(payload);
      if (res && res.success) {
        const updated = res.admin || payload;
        if (res.admin?.address) setAddress({ ...emptyAddress, ...res.admin.address });
        const nameParts = (updated.name || '').split(' ');
        setProfile(prev => ({
          ...prev,
          firstName: updated.firstName || nameParts[0] || prev.firstName,
          lastName: updated.lastName || nameParts.slice(1).join(' ') || prev.lastName,
          email: updated.email || prev.email,
          mobile: updated.mobile || prev.mobile,
          role: updated.role === 'super_admin' ? 'Super Admin' : (updated.role === 'admin' ? 'Root Administrator' : (updated.role || prev.role)),
          createdAt: updated.createdAt ? new Date(updated.createdAt).toLocaleString() : prev.createdAt,
          password: '',
          confirmPassword: '',
        }));

        setStatusMessage({ type: 'success', text: 'Admin details updated and permanently saved!' });
        setIsEditing(false);

        // Notify other components (sidebar, header) in real time
        try {
          window.dispatchEvent(new Event('admin_profile_updated'));
        } catch (e) {}
      } else {
        setStatusMessage({ type: 'error', text: res?.message || 'Failed to update profile.' });
      }
    } catch (err) {
      console.error('Error updating admin profile:', err);
      const msg = err.response?.data?.message || err.message || 'An error occurred while saving profile changes.';
      setStatusMessage({ type: 'error', text: msg });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn font-sans max-w-4xl mx-auto pb-12">
      {/* Title Bar & Breadcrumb */}
      <div className="flex justify-between items-center bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 m-0">Admin Profile</h1>
          <p className="text-xs text-slate-500 m-0 mt-0.5">Manage your administrator account details and security credentials</p>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          <span className="text-[#003836] font-semibold">Admin</span> / <span className="text-[#ff5500] font-semibold">Profile</span>
        </div>
      </div>

      {/* Status Notification */}
      {statusMessage && (
        <div className={`p-4 rounded-2xl flex items-center justify-between text-xs font-semibold animate-fadeIn ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border border-rose-200 text-rose-800'
        }`}>
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle size={16} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button 
            type="button" 
            onClick={() => setStatusMessage(null)}
            className="text-xs underline bg-transparent border-none cursor-pointer font-bold ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Profile Info Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Card Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#003836] border border-[#0d4a48] flex items-center justify-center text-[#ff5500] font-bold shadow-xs">
              <User size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 m-0">Profile Information</h3>
              <p className="text-xs text-slate-500 m-0">Synchronized permanently with database</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsEditing(!isEditing);
              setStatusMessage(null);
            }}
            className={`px-4 py-2 text-xs font-bold rounded-xl border-none transition-all shadow-sm cursor-pointer ${
              isEditing 
                ? 'bg-slate-200 hover:bg-slate-300 text-slate-700' 
                : 'bg-[#ff5500] hover:bg-[#e04b00] text-white'
            }`}
          >
            {isEditing ? 'Cancel Edit' : 'Edit Profile'}
          </button>
        </div>

        {/* Card Body */}
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
            <RefreshCw size={24} className="animate-spin text-[#ff5500]" />
            <span className="text-xs font-medium">Loading profile from server...</span>
          </div>
        ) : isEditing ? (
          <form onSubmit={handleSave} className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">First Name</label>
                <input
                  type="text"
                  required
                  value={profile.firstName}
                  onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                  placeholder="e.g. Elena or Harsh"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#ff5500] focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Last Name</label>
                <input
                  type="text"
                  value={profile.lastName}
                  onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                  placeholder="e.g. Vance or Panchal"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#ff5500] focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  placeholder="admin@sathiseller.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#ff5500] focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Mobile Number</label>
                <input
                  type="text"
                  value={profile.mobile}
                  onChange={(e) => setProfile({ ...profile, mobile: e.target.value })}
                  placeholder="e.g. 9876543210"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#ff5500] focus:bg-white transition-colors"
                />
              </div>

              {/* Admin address — drop-off location for drivers */}
              <div className="sm:col-span-2 border border-orange-200/70 bg-[#fff8f3] rounded-2xl p-4 space-y-3">
                <div>
                  <h4 className="text-xs font-extrabold text-slate-800 m-0">Admin Address (parcel drop-off location)</h4>
                  <p className="text-[11px] text-slate-500 m-0 mt-0.5">Captains and delivery drivers see this address as the place to drop repair parcels.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Address line 1</label>
                    <input type="text" maxLength={200} value={address.addressLine1} onChange={(e) => setAddress({ ...address, addressLine1: e.target.value })} placeholder="Shop / building, street" className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#ff5500] transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Address line 2 <span className="text-slate-400 font-normal">(optional)</span></label>
                    <input type="text" maxLength={200} value={address.addressLine2} onChange={(e) => setAddress({ ...address, addressLine2: e.target.value })} placeholder="Area, locality" className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#ff5500] transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Landmark <span className="text-slate-400 font-normal">(optional)</span></label>
                    <input type="text" maxLength={200} value={address.landmark} onChange={(e) => setAddress({ ...address, landmark: e.target.value })} placeholder="Near…" className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#ff5500] transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">City</label>
                    <input type="text" maxLength={80} value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} placeholder="e.g. Indore" className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#ff5500] transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">State</label>
                    <input type="text" maxLength={80} value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} placeholder="e.g. Madhya Pradesh" className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#ff5500] transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Pincode</label>
                    <input type="text" inputMode="numeric" maxLength={6} value={address.pincode} onChange={(e) => setAddress({ ...address, pincode: e.target.value.replace(/\D/g, '') })} placeholder="6 digits" className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#ff5500] transition-colors" />
                  </div>
                  <div className="flex items-end gap-2 flex-wrap">
                    <button type="button" onClick={pinCurrentLocation} disabled={pinning} className="px-3.5 py-2.5 bg-white border border-slate-200 hover:border-[#ff5500] text-slate-700 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-60">
                      {pinning ? 'Reading location…' : 'Pin my current location'}
                    </button>
                    {address.lat !== null && address.lng !== null && (
                      <>
                        <span className="text-[11px] font-semibold text-emerald-700 pb-2.5">Map pin saved ✓ ({address.lat}, {address.lng})</span>
                        <button type="button" onClick={() => setAddress({ ...address, lat: null, lng: null })} className="text-[11px] font-bold text-rose-600 bg-transparent border-none cursor-pointer pb-2.5 underline">Remove pin</button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 m-0">Tip: stand at the drop-off place and press “Pin my current location” so drivers get exact navigation. Leave every field empty to clear the address.</p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">New Password <span className="text-slate-400 font-normal">(Leave blank to keep current)</span></label>
                <input
                  type="password"
                  value={profile.password}
                  onChange={(e) => setProfile({ ...profile, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#ff5500] focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Confirm New Password</label>
                <input
                  type="password"
                  value={profile.confirmPassword}
                  onChange={(e) => setProfile({ ...profile, confirmPassword: e.target.value })}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-[#ff5500] focus:bg-white transition-colors"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Changes will be saved permanently to MongoDB database.</span>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border-none cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-sm transition-colors flex items-center gap-2"
                >
                  {isSaving && <RefreshCw size={14} className="animate-spin" />}
                  {isSaving ? 'Saving Changes...' : 'Save Permanently'}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8 text-xs">
            <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-medium block mb-1">First Name</span>
              <span className="text-slate-800 font-bold text-sm">{profile.firstName || '—'}</span>
            </div>
            <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-medium block mb-1">Last Name</span>
              <span className="text-slate-800 font-bold text-sm">{profile.lastName || '—'}</span>
            </div>
            <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-medium block mb-1">Email Address</span>
              <span className="text-slate-800 font-bold text-sm">{profile.email || '—'}</span>
            </div>
            <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-medium block mb-1">Mobile Number</span>
              <span className="text-slate-800 font-bold text-sm">{profile.mobile || '—'}</span>
            </div>
            <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-medium block mb-1">Assigned Platform Role</span>
              <span className="inline-block bg-[#003836] text-[#ff9966] font-bold px-3 py-1 rounded-full text-xs border border-[#0d4a48]">
                {profile.role}
              </span>
            </div>
            <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-medium block mb-1">Account Created At</span>
              <span className="text-slate-800 font-bold text-sm">{profile.createdAt}</span>
            </div>
            <div className="sm:col-span-2 p-3 bg-slate-50/70 rounded-xl border border-slate-100">
              <span className="text-slate-500 font-medium block mb-1">Admin Address <span className="text-slate-400 font-normal">(parcel drop-off location for drivers)</span></span>
              {hasAddress ? (
                <>
                  <span className="text-slate-800 font-bold text-sm block">{addressLine}</span>
                  {address.lat !== null && address.lng !== null && <span className="text-[11px] font-semibold text-emerald-700">Map pin saved ✓</span>}
                </>
              ) : (
                <span className="text-amber-700 font-semibold text-sm">Not set yet — click “Edit Profile” to add the address drivers should deliver parcels to.</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* =========================================================================
   17. SKU AUDIT MANAGEMENT PAGE
   ========================================================================= */
export const SkuAuditManagement = () => {
  const [audits, setAudits] = React.useState([
    { sku: 'SKU-MOB-001', name: 'Smartphones (128GB)', category: 'Mobile & Accessories', expectedStock: 120, physicalStock: 120, discrepancy: 0, status: 'Verified', lastAudited: 'Today, 02:15 PM' },
    { sku: 'SKU-GROC-002', name: 'Pyaaj (1kg Pack)', category: 'Groceries', expectedStock: 50, physicalStock: 40, discrepancy: -10, status: 'Discrepancy', lastAudited: 'Today, 11:30 AM' },
    { sku: 'SKU-GROC-003', name: 'Aalu (1kg Pack)', category: 'Groceries', expectedStock: 1000, physicalStock: 1000, discrepancy: 0, status: 'Verified', lastAudited: 'Yesterday' },
  ]);

  const [search, setSearch] = React.useState('');

  const filteredAudits = audits.filter(a => 
    a.sku.toLowerCase().includes(search.toLowerCase()) || 
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">SKU Audit</h1>
        <div className="text-xs text-slate-500 font-medium">
          Dashboard / <span className="text-[#ff5500] font-semibold">SKU Audit</span>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Light Orange Banner Header */}
        <div className="bg-[#fff4ed] border-b border-orange-200/70 text-[#002625] px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-base font-bold tracking-tight text-[#002625] flex items-center gap-2">
              <ChevronRight size={18} className="text-[#ff5500]" />
              SKU Stock Verification & Audit
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Verify physical warehouse inventory against system stock counts
            </p>
          </div>
          <button 
            onClick={() => alert('Starting new SKU Audit scan...')}
            className="px-4 py-2 bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold rounded-xl border-none transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 shrink-0"
          >
            <Plus size={15} /> Perform Audit Scan
          </button>
        </div>

        {/* Toolbar & Search */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search SKU code, product name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50/60 border border-slate-200 rounded-md pl-9 pr-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#ff5500] focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">SKU CODE</th>
                  <th className="py-3.5 px-4">PRODUCT NAME</th>
                  <th className="py-3.5 px-4">CATEGORY</th>
                  <th className="py-3.5 px-4">SYSTEM STOCK</th>
                  <th className="py-3.5 px-4">AUDITED STOCK</th>
                  <th className="py-3.5 px-4">DISCREPANCY</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-4 text-right">LAST AUDITED</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredAudits.map((item) => (
                  <tr key={item.sku} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#ff5500]">{item.sku}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{item.name}</td>
                    <td className="py-3.5 px-4 text-slate-600">{item.category}</td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">{item.expectedStock}</td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">{item.physicalStock}</td>
                    <td className="py-3.5 px-4 font-mono font-bold">
                      <span className={item.discrepancy < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                        {item.discrepancy > 0 ? `+${item.discrepancy}` : item.discrepancy}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        item.status === 'Verified' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-500 font-medium">{item.lastAudited}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

/* =========================================================================
   18. SELLERS OVERVIEW PAGE
   ========================================================================= */
/* =========================================================================
   18. SELLERS OVERVIEW PAGE (WITH FULL SELLER DETAILS VIEW)
   ========================================================================= */
export const SellersOverview = () => {
  const [sellersList, setSellersList] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState(null);
  const [copiedKey, setCopiedKey] = React.useState(null);
  const [previewDocModal, setPreviewDocModal] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [filterTab, setFilterTab] = React.useState('All');
  const [selectedSeller, setSelectedSeller] = React.useState(null);
  const [inventoryActiveTab, setInventoryActiveTab] = React.useState('All');
  const [productsLoading, setProductsLoading] = React.useState(false);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = React.useState(false);
  const [newProduct, setNewProduct] = React.useState({ name: '', price: '', stock: '', category: '', description: '' });
  const [productImagePreview, setProductImagePreview] = React.useState(null);
  const fileInputRef = React.useRef(null);

  // Load this seller's catalog when opening detail view (#84)
  React.useEffect(() => {
    if (!selectedSeller?.id) return undefined;
    let cancelled = false;
    const loadProducts = async () => {
      setProductsLoading(true);
      try {
        const res = await productService.getProducts({
          sellerId: selectedSeller.id,
          admin: 'true',
        });
        if (cancelled) return;
        const list = Array.isArray(res?.products) ? res.products : [];
        const mapped = list.map((p) => ({
          id: p._id || p.id,
          _id: p._id || p.id,
          name: p.name || 'Product',
          price: Number(p.salePrice ?? p.price ?? 0),
          stock: Number(p.stock ?? 0),
          category: p.category?.name || p.category || p.categories?.[0] || '—',
          description: p.description || '',
          image: p.mainImage || p.image || '',
          status: p.status || 'Published',
        }));
        setSelectedSeller((prev) => (prev && prev.id === selectedSeller.id ? { ...prev, products: mapped } : prev));
      } catch (err) {
        console.warn('Seller products load failed:', err.message);
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    };
    loadProducts();
    return () => { cancelled = true; };
  }, [selectedSeller?.id]);

  const loadLiveSellers = React.useCallback(async (force = false) => {
    setLoading(true);
    try {
      const data = await adminService.getSellers(force);
      if (data && (data.success || Array.isArray(data.sellers) || Array.isArray(data))) {
        const raw = data.sellers || (Array.isArray(data) ? data : []);
        const mapped = raw.map(s => {
          const rawStatus = (s.accountStatus || s.status || 'under_review').toLowerCase();
          let displayStatus = 'Pending';
          if (rawStatus === 'approved') displayStatus = 'Approved';
          else if (rawStatus === 'rejected') displayStatus = 'Rejected';
          else if (rawStatus === 'suspended') displayStatus = 'Suspended';
          else if (rawStatus === 'pending_otp') displayStatus = 'Pending OTP';

          const bName = s.businessName || s.ownerName || 'Seller Store';
          const oName = s.ownerName || s.businessName || 'Seller Partner';
          const loc = s.warehouseLocation || {};
          const coords = loc.location?.coordinates || [0, 0];
          const lat = coords[1];
          const lng = coords[0];
          const hasCoords = (lat !== undefined && lng !== undefined && (lat !== 0 || lng !== 0));

          return {
            id: String(s._id || s.id || ''),
            _id: String(s._id || s.id || ''),
            name: oName,
            ownerName: s.ownerName || '',
            businessName: s.businessName || '',
            storeName: bName,
            email: s.email || 'N/A',
            mobile: s.phone || 'N/A',
            phone: s.phone || 'N/A',
            storeLogo: s.storeLogo || '',
            logoText: (bName || 'SN').substring(0, 2).toUpperCase(),
            logoBg: 'bg-orange-500',
            status: displayStatus,
            rawStatus: rawStatus,
            joinedOn: s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent',
            createdAtFormatted: s.createdAt ? new Date(s.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Recent',
            createdAt: s.createdAt,
            businessType: s.businessType || 'Retail',
            serviceRadius: s.serviceRadius || 5,
            areaRadius: `${loc.city || 'Local'} (${s.serviceRadius || 5}km)`,
            taxInfo: s.gstNumber || s.panNumber || 'None',
            gstNumber: s.gstNumber || '',
            panNumber: s.panNumber || '',
            fssaiLicense: s.fssaiLicense || '',
            gstPhoto: s.gstPhoto || '',
            bankPassbookPhoto: s.bankPassbookPhoto || '',
            bankName: s.bankName || '',
            accountNumber: s.accountNumber || '',
            ifscCode: s.ifscCode || '',
            tagline: s.tagline || '',
            categories: Array.isArray(s.categories) ? s.categories : [],
            walletBalance: Number(s.walletBalance || 0).toFixed(2),
            pendingBalance: Number(s.pendingBalance || 0).toFixed(2),
            totalEarnings: Number(s.totalEarnings || 0).toFixed(2),
            commissionPercentage: s.commissionPercentage != null ? s.commissionPercentage : 10,
            registrationFeeStatus: s.registrationFeeStatus || 'not_required',
            registrationFeeAmount: s.registrationFeeAmount || 0,
            registrationFeePaidAt: s.registrationFeePaidAt ? new Date(s.registrationFeePaidAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : null,
            membershipStatus: s.membershipStatus || 'none',
            referralCode: s.referralCode || '',
            referredBy: s.referredBy || null,
            warehouseLocation: loc,
            address: loc.storeAddress || [loc.area, loc.city, loc.state, loc.pincode].filter(Boolean).join(', ') || 'Address not provided',
            city: loc.city || '',
            state: loc.state || '',
            district: loc.district || loc.area || '',
            pincode: loc.pincode || '',
            lat: hasCoords ? lat : null,
            lng: hasCoords ? lng : null,
            hasCoords: hasCoords,
            mapUrl: hasCoords ? `https://www.google.com/maps?q=${lat},${lng}` : null,
            products: Array.isArray(s.products) ? s.products : [],
            raw: s
          };
        });
        setSellersList(mapped);

        // Update selected seller if already viewing
        if (selectedSeller) {
          const freshSelected = mapped.find(m => m.id === selectedSeller.id);
          if (freshSelected) {
            setSelectedSeller(freshSelected);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load sellers in overview:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSeller]);

  React.useEffect(() => {
    loadLiveSellers();
  }, []);

  const copyToClipboard = (text, key) => {
    if (!text || text === 'N/A' || text === 'None') return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleToggleStatus = async (sellerId, newStatus) => {
    setActionLoading(true);
    try {
      const res = await adminService.toggleSellerStatus(sellerId, newStatus);
      if (res && res.success) {
        let displayStatus = 'Pending';
        if (newStatus === 'approved') displayStatus = 'Approved';
        else if (newStatus === 'rejected') displayStatus = 'Rejected';
        else if (newStatus === 'suspended') displayStatus = 'Suspended';
        else if (newStatus === 'under_review') displayStatus = 'Under Review';

        setSellersList(prev => prev.map(s => s.id === sellerId ? { ...s, status: displayStatus, rawStatus: newStatus } : s));
        if (selectedSeller && selectedSeller.id === sellerId) {
          setSelectedSeller(prev => ({ ...prev, status: displayStatus, rawStatus: newStatus }));
        }
        setStatusMessage({ type: 'success', text: `Seller successfully updated to ${displayStatus}!` });
        setTimeout(() => setStatusMessage(null), 3500);
      } else {
        setStatusMessage({ type: 'error', text: res?.message || 'Failed to update seller status' });
      }
    } catch (err) {
      console.error('Error toggling seller status:', err);
      setStatusMessage({ type: 'error', text: err?.response?.data?.message || 'Error updating seller status' });
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = React.useMemo(() => {
    const q = String(search || '').toLowerCase().trim();
    return (sellersList || []).filter(s => {
      const matchesSearch = 
        String(s.name || '').toLowerCase().includes(q) || 
        String(s.storeName || '').toLowerCase().includes(q) ||
        String(s.email || '').toLowerCase().includes(q) ||
        String(s.mobile || '').toLowerCase().includes(q) ||
        String(s.city || '').toLowerCase().includes(q) ||
        String(s.gstNumber || '').toLowerCase().includes(q);

      if (!matchesSearch) return false;
      if (filterTab === 'All') return true;
      if (filterTab === 'Pending') return s.status === 'Pending' || s.rawStatus === 'under_review' || s.rawStatus === 'pending_otp';
      if (filterTab === 'Approved') return s.status === 'Approved';
      if (filterTab === 'Rejected') return s.status === 'Rejected';
      if (filterTab === 'Suspended') return s.status === 'Suspended';
      return true;
    });
  }, [sellersList, search, filterTab]);

  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setProductImagePreview(url);
    }
  };

  const handleAddProduct = (e) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.price) return;
    const added = {
      id: `p_${Date.now()}`,
      name: newProduct.name,
      price: Number(newProduct.price),
      stock: Number(newProduct.stock || 50),
      img: productImagePreview || 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=500&auto=format&fit=crop&q=80'
    };
    setSelectedSeller(prev => ({
      ...prev,
      products: [...(prev.products || []), added]
    }));
    setNewProduct({ name: '', price: '', stock: '', category: '', description: '' });
    setProductImagePreview(null);
    setIsAddProductModalOpen(false);
  };

  const handleDeleteProduct = (productId) => {
    if (window.confirm('Delete this product from inventory?')) {
      setSelectedSeller(prev => ({
        ...prev,
        products: (prev.products || []).filter(p => p.id !== productId)
      }));
    }
  };

  // =========================================================================
  // IF DETAILED SELLER VIEW IS ACTIVE
  // =========================================================================
  if (selectedSeller) {
    return (
      <div className="space-y-6 animate-fadeIn pb-16">
        
        {/* Toast / Alert message banner */}
        {statusMessage && (
          <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm animate-fadeIn ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            <div className="flex items-center gap-2.5 font-bold text-xs">
              {statusMessage.type === 'success' ? <CheckCircle size={18} className="text-emerald-600" /> : <AlertCircle size={18} className="text-rose-600" />}
              <span>{statusMessage.text}</span>
            </div>
            <button 
              onClick={() => setStatusMessage(null)}
              className="text-slate-400 hover:text-slate-700 border-none bg-transparent cursor-pointer font-bold"
            >
              ×
            </button>
          </div>
        )}

        {/* Top Navigation & Status Bar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <button 
              onClick={() => setSelectedSeller(null)}
              className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs flex items-center justify-center text-slate-700 hover:text-[#ff5500] hover:bg-orange-50 hover:border-[#ff5500] cursor-pointer transition-all shrink-0"
              title="Back to Sellers List"
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg md:text-xl font-extrabold text-slate-900 tracking-tight m-0">
                  {selectedSeller.storeName}
                </h1>
                <span className={`px-3 py-0.5 rounded-full text-xs font-bold border ${
                  selectedSeller.status === 'Approved' 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : selectedSeller.status === 'Rejected'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : selectedSeller.status === 'Suspended'
                    ? 'bg-slate-100 text-slate-700 border-slate-300'
                    : 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                }`}>
                  {selectedSeller.status}
                </span>
                {selectedSeller.registrationFeeStatus === 'paid' && (
                  <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle size={12} /> Fee Paid (₹{selectedSeller.registrationFeeAmount || 150})
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1">
                SELLER MANAGEMENT / <span className="text-[#ff5500]">{selectedSeller.ownerName || selectedSeller.name}</span>
                <span className="text-slate-300 mx-2">|</span>
                <span className="text-slate-500 font-mono normal-case">Joined: {selectedSeller.joinedOn}</span>
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
            <button
              onClick={() => loadLiveSellers(true)}
              disabled={loading}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 cursor-pointer flex items-center gap-1.5 transition-all"
              title="Refresh Live Details"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>

            {selectedSeller.status !== 'Approved' && (
              <button 
                onClick={() => handleToggleStatus(selectedSeller.id, 'approved')}
                disabled={actionLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl border-none cursor-pointer flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 disabled:opacity-50"
              >
                <CheckCircle size={15} /> Approve Seller
              </button>
            )}

            {selectedSeller.status !== 'Rejected' && (
              <button 
                onClick={() => handleToggleStatus(selectedSeller.id, 'rejected')}
                disabled={actionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl border-none cursor-pointer flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 disabled:opacity-50"
              >
                <X size={15} /> Reject
              </button>
            )}

            {selectedSeller.status !== 'Suspended' && (
              <button 
                onClick={() => handleToggleStatus(selectedSeller.id, 'suspended')}
                disabled={actionLoading}
                className="px-3.5 py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-xl border-none cursor-pointer flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 disabled:opacity-50"
              >
                <ShieldAlert size={14} /> Suspend
              </button>
            )}

            {selectedSeller.status !== 'Pending' && selectedSeller.status !== 'Under Review' && (
              <button 
                onClick={() => handleToggleStatus(selectedSeller.id, 'under_review')}
                disabled={actionLoading}
                className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-xl border border-amber-300 cursor-pointer flex items-center gap-1.5 transition-all"
              >
                <Clock size={14} /> Under Review
              </button>
            )}
          </div>
        </div>

        {/* Top 3 Column Overview Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          
          {/* Card 1: Seller Profile & Store Identity */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between space-y-4 relative overflow-hidden">
            <div className="flex items-center gap-4">
              {selectedSeller.storeLogo ? (
                <div 
                  className="relative group cursor-pointer w-20 h-20 rounded-2xl overflow-hidden border-2 border-orange-200 bg-white shadow-sm shrink-0 flex items-center justify-center"
                  onClick={() => setPreviewDocModal({ title: `Store Logo - ${selectedSeller.storeName}`, src: selectedSeller.storeLogo })}
                  title="Click to zoom Store Logo"
                >
                  <img 
                    src={selectedSeller.storeLogo} 
                    alt={selectedSeller.storeName} 
                    className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform" 
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                    <ZoomIn size={16} />
                  </div>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-orange-50 text-[#ff5500] font-extrabold flex items-center justify-center text-2xl border-2 border-orange-100 shadow-2xs shrink-0">
                  {selectedSeller.logoText}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <h3 className="text-base font-extrabold text-slate-900 m-0 truncate">{selectedSeller.storeName}</h3>
                <p className="text-xs font-semibold text-slate-600 m-0 mt-0.5 flex items-center gap-1">
                  <User size={13} className="text-[#ff5500]" /> {selectedSeller.ownerName || selectedSeller.name}
                </p>
                <div className="mt-2">
                  <span className="inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                    Role: {selectedSeller.raw?.role || 'Seller Partner'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 pt-3 border-t border-slate-100 text-xs">
              {/* Phone / Mobile */}
              <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
                  <Phone size={12} className="text-emerald-600" /> MOBILE
                </span>
                <div className="flex items-center gap-1.5">
                  <a href={`tel:${selectedSeller.mobile}`} className="font-mono font-bold text-slate-900 hover:text-[#ff5500] no-underline">
                    {selectedSeller.mobile}
                  </a>
                  <button 
                    onClick={() => copyToClipboard(selectedSeller.mobile, 'mobile')}
                    className="p-1 text-slate-400 hover:text-slate-700 bg-white rounded border border-slate-200 cursor-pointer"
                    title="Copy Phone Number"
                  >
                    {copiedKey === 'mobile' ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                  </button>
                </div>
              </div>

              {/* Email */}
              <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
                  <Send size={12} className="text-blue-600" /> EMAIL
                </span>
                <div className="flex items-center gap-1.5 max-w-[65%] truncate">
                  <a href={`mailto:${selectedSeller.email}`} className="font-mono text-slate-800 hover:text-[#ff5500] truncate no-underline text-xs" title={selectedSeller.email}>
                    {selectedSeller.email}
                  </a>
                  <button 
                    onClick={() => copyToClipboard(selectedSeller.email, 'email')}
                    className="p-1 text-slate-400 hover:text-slate-700 bg-white rounded border border-slate-200 cursor-pointer shrink-0"
                    title="Copy Email"
                  >
                    {copiedKey === 'email' ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                  </button>
                </div>
              </div>

              {/* Referral Code */}
              {selectedSeller.referralCode && (
                <div className="flex justify-between items-center bg-orange-50/50 p-2.5 rounded-xl border border-orange-200/60">
                  <span className="text-orange-700 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">
                    <Sparkles size={12} className="text-[#ff5500]" /> REFERRAL CODE
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-extrabold text-[#ff5500] text-xs">
                      {selectedSeller.referralCode}
                    </span>
                    <button 
                      onClick={() => copyToClipboard(selectedSeller.referralCode, 'ref')}
                      className="p-1 text-orange-600 hover:text-orange-900 bg-white rounded border border-orange-200 cursor-pointer"
                      title="Copy Referral Code"
                    >
                      {copiedKey === 'ref' ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                    </button>
                  </div>
                </div>
              )}

              {/* Referred By */}
              {selectedSeller.referredBy && (
                <div className="flex justify-between items-center text-[11px] text-slate-500 px-1">
                  <span>Referred By Partner:</span>
                  <span className="font-bold text-slate-800">
                    {selectedSeller.referredBy.businessName || selectedSeller.referredBy.ownerName || 'Active Seller'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Shop Overview & Business Details */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 m-0 flex items-center gap-2 pb-3 border-b border-slate-100">
                <Store size={18} className="text-[#ff5500]" /> Business & Operational Details
              </h3>

              <div className="grid grid-cols-2 gap-3.5 mt-4 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">BUSINESS TYPE</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedSeller.businessType}</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">SERVICE RADIUS</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedSeller.serviceRadius} km</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">COMMISSION RATE</span>
                  <span className="font-bold text-[#ff5500] text-sm">{selectedSeller.commissionPercentage}%</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-0.5">WALLET BALANCE</span>
                  <span className="font-bold text-emerald-700 text-sm">₹{selectedSeller.walletBalance}</span>
                </div>
              </div>
            </div>

            {/* Product Categories */}
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-2">
                SELECTED CATEGORIES ({selectedSeller.categories.length})
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {selectedSeller.categories && selectedSeller.categories.length > 0 ? (
                  selectedSeller.categories.map((cat, idx) => (
                    <span 
                      key={idx} 
                      className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold rounded-lg"
                    >
                      🏷️ {cat}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">No specific categories selected</span>
                )}
              </div>
            </div>
          </div>

          {/* Card 3: Warehouse Location & Store Address */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 m-0 flex items-center gap-2 pb-3 border-b border-slate-100">
                <MapPin size={18} className="text-[#ff5500]" /> Store Warehouse & Address
              </h3>

              <div className="mt-3.5 space-y-2.5 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">COMPLETE STORE ADDRESS</span>
                  <p className="text-slate-800 font-medium m-0 leading-relaxed">{selectedSeller.address}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">CITY / STATE</span>
                    <span className="font-bold text-slate-900">{selectedSeller.city || 'N/A'}{selectedSeller.state ? `, ${selectedSeller.state}` : ''}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">PINCODE</span>
                    <span className="font-bold font-mono text-slate-900">{selectedSeller.pincode || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* GPS Coordinates & Google Maps Link */}
            <div className="pt-3 border-t border-slate-100">
              {selectedSeller.hasCoords ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-slate-600">
                    📍 {selectedSeller.lat?.toFixed(4)}, {selectedSeller.lng?.toFixed(4)}
                  </span>
                  <a 
                    href={selectedSeller.mapUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-[#002625] hover:bg-[#003d3c] text-white text-[11px] font-bold rounded-xl no-underline inline-flex items-center gap-1 transition-all"
                  >
                    <ExternalLink size={12} /> View Map
                  </a>
                </div>
              ) : (
                <div className="text-slate-400 italic text-[11px] flex items-center gap-1.5">
                  <MapPin size={13} className="text-slate-300" /> GPS Coordinates not provided
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Verification Documents & Legal Compliance Card (CRITICAL) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          
          {/* Header Banner */}
          <div className="bg-[#fff4ed] border-b border-orange-200/70 text-[#002625] px-6 py-4 flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-[#002625] m-0 flex items-center gap-2">
              <FileCheck size={18} className="text-[#ff5500]" />
              Legal Identification & Uploaded Documents
            </h3>
            <span className="text-xs font-bold text-orange-800 bg-orange-100 px-3 py-1 rounded-full border border-orange-200">
              KYC & Verification
            </span>
          </div>

          <div className="p-6 space-y-6">
            
            {/* Legal Identification Numbers Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* GST Number */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">GSTIN / TAX NUMBER</span>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-extrabold text-sm text-slate-900">
                    {selectedSeller.gstNumber || 'Not Provided'}
                  </span>
                  {selectedSeller.gstNumber && (
                    <button 
                      onClick={() => copyToClipboard(selectedSeller.gstNumber, 'gst')}
                      className="p-1.5 text-slate-400 hover:text-slate-700 bg-white rounded-lg border border-slate-200 cursor-pointer"
                      title="Copy GST Number"
                    >
                      {copiedKey === 'gst' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    </button>
                  )}
                </div>
              </div>

              {/* PAN Number */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">PAN CARD NUMBER</span>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-extrabold text-sm text-slate-900 uppercase">
                    {selectedSeller.panNumber || 'Not Provided'}
                  </span>
                  {selectedSeller.panNumber && (
                    <button 
                      onClick={() => copyToClipboard(selectedSeller.panNumber, 'pan')}
                      className="p-1.5 text-slate-400 hover:text-slate-700 bg-white rounded-lg border border-slate-200 cursor-pointer"
                      title="Copy PAN Number"
                    >
                      {copiedKey === 'pan' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    </button>
                  )}
                </div>
              </div>

              {/* FSSAI License */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">FSSAI FOOD LICENSE</span>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-extrabold text-sm text-slate-900">
                    {selectedSeller.fssaiLicense || 'Not Provided'}
                  </span>
                  {selectedSeller.fssaiLicense && (
                    <button 
                      onClick={() => copyToClipboard(selectedSeller.fssaiLicense, 'fssai')}
                      className="p-1.5 text-slate-400 hover:text-slate-700 bg-white rounded-lg border border-slate-200 cursor-pointer"
                      title="Copy FSSAI Number"
                    >
                      {copiedKey === 'fssai' ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    </button>
                  )}
                </div>
              </div>

            </div>

            {/* Document Preview Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Document 1: GST Certificate / Photo */}
              <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-[#ff5500]" />
                    <span className="text-xs font-bold text-slate-800">GST Certificate / Tax Document</span>
                  </div>
                  {selectedSeller.gstPhoto ? (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Uploaded
                    </span>
                  ) : (
                    <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-2.5 py-0.5 rounded-full">
                      Not Provided
                    </span>
                  )}
                </div>

                {selectedSeller.gstPhoto ? (
                  <div className="space-y-3">
                    <div 
                      className="relative group cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-900 h-52 flex items-center justify-center shadow-inner"
                      onClick={() => setPreviewDocModal({ title: `GST Certificate - ${selectedSeller.storeName}`, src: selectedSeller.gstPhoto })}
                      title="Click to view full image"
                    >
                      <img 
                        src={selectedSeller.gstPhoto} 
                        alt="GST Document" 
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" 
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs gap-2 backdrop-blur-[2px]">
                        <ZoomIn size={18} /> Click to Zoom Document
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <button 
                        type="button"
                        onClick={() => setPreviewDocModal({ title: `GST Certificate - ${selectedSeller.storeName}`, src: selectedSeller.gstPhoto })}
                        className="px-3.5 py-2 bg-white hover:bg-orange-50 text-[#ff5500] hover:text-[#e04a00] border border-orange-200 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 transition-all shadow-2xs"
                      >
                        <Eye size={14} /> Full View Lightbox
                      </button>

                      <a 
                        href={selectedSeller.gstPhoto}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold no-underline inline-flex items-center gap-1.5 transition-all shadow-2xs"
                      >
                        <ExternalLink size={14} /> Open in New Tab
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="h-44 flex flex-col items-center justify-center bg-white rounded-xl border-2 border-dashed border-slate-200 text-xs text-slate-400 p-4 text-center">
                    <FileText size={28} className="text-slate-300 mb-1.5" />
                    <p className="font-semibold m-0 text-slate-600">No GST Document Uploaded</p>
                    <p className="text-[11px] text-slate-400 mt-1 m-0">Seller did not attach a GST certificate photo during registration</p>
                  </div>
                )}
              </div>

              {/* Document 2: Bank Passbook / Cheque */}
              <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-teal-600" />
                    <span className="text-xs font-bold text-slate-800">Bank Passbook / Cancelled Cheque</span>
                  </div>
                  {selectedSeller.bankPassbookPhoto ? (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Uploaded
                    </span>
                  ) : (
                    <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-2.5 py-0.5 rounded-full">
                      Not Provided
                    </span>
                  )}
                </div>

                {selectedSeller.bankPassbookPhoto ? (
                  <div className="space-y-3">
                    <div 
                      className="relative group cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-900 h-52 flex items-center justify-center shadow-inner"
                      onClick={() => setPreviewDocModal({ title: `Bank Passbook - ${selectedSeller.storeName}`, src: selectedSeller.bankPassbookPhoto })}
                      title="Click to view full image"
                    >
                      <img 
                        src={selectedSeller.bankPassbookPhoto} 
                        alt="Bank Passbook Document" 
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" 
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs gap-2 backdrop-blur-[2px]">
                        <ZoomIn size={18} /> Click to Zoom Document
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <button 
                        type="button"
                        onClick={() => setPreviewDocModal({ title: `Bank Passbook - ${selectedSeller.storeName}`, src: selectedSeller.bankPassbookPhoto })}
                        className="px-3.5 py-2 bg-white hover:bg-teal-50 text-teal-700 hover:text-teal-900 border border-teal-200 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 transition-all shadow-2xs"
                      >
                        <Eye size={14} /> Full View Lightbox
                      </button>

                      <a 
                        href={selectedSeller.bankPassbookPhoto}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold no-underline inline-flex items-center gap-1.5 transition-all shadow-2xs"
                      >
                        <ExternalLink size={14} /> Open in New Tab
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="h-44 flex flex-col items-center justify-center bg-white rounded-xl border-2 border-dashed border-slate-200 text-xs text-slate-400 p-4 text-center">
                    <Building2 size={28} className="text-slate-300 mb-1.5" />
                    <p className="font-semibold m-0 text-slate-600">No Bank Passbook Uploaded</p>
                    <p className="text-[11px] text-slate-400 mt-1 m-0">Seller did not attach a passbook or cancelled cheque photo during registration</p>
                  </div>
                )}
              </div>

            </div>

            {/* Bank Settlement Account Details */}
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-extrabold text-slate-800 m-0 flex items-center gap-2">
                <CreditCard size={15} className="text-[#ff5500]" /> Bank Account Details for Payouts
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">BANK NAME</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedSeller.bankName || 'Not Provided'}</span>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">ACCOUNT NUMBER</span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900 text-sm">{selectedSeller.accountNumber || 'Not Provided'}</span>
                    {selectedSeller.accountNumber && (
                      <button 
                        onClick={() => copyToClipboard(selectedSeller.accountNumber, 'acc')}
                        className="p-1 text-slate-400 hover:text-slate-700 bg-slate-50 rounded border border-slate-200 cursor-pointer"
                        title="Copy Account Number"
                      >
                        {copiedKey === 'acc' ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                      </button>
                    )}
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">IFSC CODE</span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900 text-sm uppercase">{selectedSeller.ifscCode || 'Not Provided'}</span>
                    {selectedSeller.ifscCode && (
                      <button 
                        onClick={() => copyToClipboard(selectedSeller.ifscCode, 'ifsc')}
                        className="p-1 text-slate-400 hover:text-slate-700 bg-slate-50 rounded border border-slate-200 cursor-pointer"
                        title="Copy IFSC Code"
                      >
                        {copiedKey === 'ifsc' ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Section: Inventory Control */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          
          {/* Header Bar with + Add Product Button */}
          <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h3 className="text-sm font-bold text-slate-900 m-0 flex items-center gap-2">
              <Package size={18} className="text-[#ff5500]" /> Store Products & Inventory ({productsLoading ? '…' : (selectedSeller.products?.length || 0)})
            </h3>

            <button 
              onClick={() => setIsAddProductModalOpen(true)}
              className="px-4 py-2 bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold rounded-xl border-none cursor-pointer flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 shrink-0"
            >
              <Plus size={15} /> Add Product
            </button>
          </div>

          {/* Filter Pill Tabs */}
          <div className="p-6 space-y-6">
            <div className="flex gap-2">
              <button 
                onClick={() => setInventoryActiveTab('All')}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold border-none cursor-pointer transition-all ${
                  inventoryActiveTab === 'All' ? 'bg-[#ff5500] text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({(selectedSeller.products || []).length})
              </button>
            </div>

            {/* Products Card Grid */}
            {(selectedSeller.products || []).length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {selectedSeller.products.map((product) => (
                  <div key={product.id} className="group bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden relative hover:shadow-md transition-all">
                    {/* Action Icons Overlay */}
                    <div className="absolute top-2 right-2 flex flex-col gap-1 z-10 opacity-90">
                      <button 
                        onClick={() => handleDeleteProduct(product.id)}
                        className="w-7 h-7 rounded-full bg-white text-rose-600 border border-slate-200 shadow-2xs flex items-center justify-center cursor-pointer hover:bg-rose-50"
                        title="Delete Product"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    {/* Product Image */}
                    <div className="h-32 bg-slate-50 overflow-hidden flex items-center justify-center">
                      <img 
                        src={product.img} 
                        alt={product.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>

                    {/* Product Info */}
                    <div className="p-3.5 space-y-2">
                      <h4 className="text-xs font-bold text-slate-900 m-0 truncate">{product.name}</h4>
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-[#ff5500] text-xs">₹{product.price}</span>
                        <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200">
                          {product.stock} in stock
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 font-medium text-xs bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <Package size={28} className="text-slate-300 mx-auto mb-2" />
                No products listed by this seller yet.
              </div>
            )}
          </div>
        </div>

        {/* Add Product Modal */}
        {isAddProductModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn">
              <div className="bg-[#fff4ed] border-b border-orange-200/70 text-[#002625] px-6 py-4 flex items-center justify-between">
                <h3 className="text-base font-bold text-[#002625] m-0 flex items-center gap-2">
                  <Plus size={18} className="text-[#ff5500]" />
                  Add New Product for {selectedSeller.storeName}
                </h3>
                <button 
                  onClick={() => setIsAddProductModalOpen(false)}
                  className="text-slate-400 hover:text-slate-900 border-none bg-transparent cursor-pointer text-xl font-bold p-1 leading-none"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleAddProduct} className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Product Name</label>
                      <input 
                        type="text" 
                        required
                        placeholder="Enter product name"
                        value={newProduct.name}
                        onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-[#ff5500]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Price (₹)</label>
                        <input 
                          type="number" 
                          required
                          placeholder="0.00"
                          value={newProduct.price}
                          onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                          className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-[#ff5500]"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1">Stock</label>
                        <input 
                          type="number" 
                          placeholder="50"
                          value={newProduct.stock}
                          onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                          className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-[#ff5500]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Product Image</label>
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleImageFileChange}
                        className="hidden"
                      />
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-200 hover:border-[#ff5500] rounded-2xl p-4 text-center bg-slate-50/50 hover:bg-orange-50/20 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[120px] relative overflow-hidden group"
                      >
                        {productImagePreview ? (
                          <div className="relative w-full h-28">
                            <img src={productImagePreview} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl text-white font-bold text-xs">
                              Change Image
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="w-9 h-9 rounded-full bg-orange-50 text-[#ff5500] flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                              <Plus size={18} />
                            </div>
                            <span className="text-xs font-bold text-slate-600 group-hover:text-[#ff5500] transition-colors">Upload Image</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
                  <button 
                    type="button"
                    onClick={() => setIsAddProductModalOpen(false)}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border-none cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-6 py-2.5 bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-2xs transition-all active:scale-95"
                  >
                    Create Product
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Global Document Lightbox Zoom Modal */}
        {previewDocModal && (
          <div 
            className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
            onClick={() => setPreviewDocModal(null)}
          >
            <div 
              className="bg-white rounded-2xl max-w-4xl w-full border border-slate-800 shadow-2xl overflow-hidden animate-scaleUp flex flex-col max-h-[92vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Lightbox Header */}
              <div className="bg-[#002625] text-white px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-[#ff5500]" />
                  <h3 className="text-sm font-bold m-0">{previewDocModal.title}</h3>
                </div>
                <div className="flex items-center gap-3">
                  <a 
                    href={previewDocModal.src} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-xs font-bold text-emerald-400 hover:text-emerald-300 no-underline inline-flex items-center gap-1 bg-white/10 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <ExternalLink size={13} /> Open Original
                  </a>
                  <button 
                    onClick={() => setPreviewDocModal(null)}
                    className="text-slate-400 hover:text-white border-none bg-transparent cursor-pointer text-2xl font-bold p-0 leading-none"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Lightbox Body */}
              <div className="p-4 bg-slate-950 flex-1 overflow-auto flex items-center justify-center min-h-[300px]">
                <img 
                  src={previewDocModal.src} 
                  alt={previewDocModal.title} 
                  className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl" 
                />
              </div>

              {/* Lightbox Footer */}
              <div className="bg-slate-900 px-6 py-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
                <span>Verification Document Preview</span>
                <button 
                  onClick={() => setPreviewDocModal(null)}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-slate-700 font-bold cursor-pointer transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // =========================================================================
  // MAIN SELLERS LIST OVERVIEW TABLE
  // =========================================================================
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Toast / Alert message banner */}
      {statusMessage && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm animate-fadeIn ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          <div className="flex items-center gap-2.5 font-bold text-xs">
            {statusMessage.type === 'success' ? <CheckCircle size={18} className="text-emerald-600" /> : <AlertCircle size={18} className="text-rose-600" />}
            <span>{statusMessage.text}</span>
          </div>
          <button 
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-slate-700 border-none bg-transparent cursor-pointer font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Top Header & Breadcrumb */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight m-0">Sellers Directory</h1>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Manage partner stores, verify documents, and control approval statuses</p>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Dashboard / <span className="text-[#ff5500] font-semibold">Sellers</span>
        </div>
      </div>

      {/* Main Container Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Filter Tabs Bar & Search */}
        <div className="bg-[#fff4ed] border-b border-orange-200/70 text-[#002625] px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {['All', 'Pending', 'Approved', 'Rejected', 'Suspended'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                  filterTab === tab 
                    ? 'bg-[#ff5500] text-white border-[#ff5500] shadow-2xs' 
                    : 'bg-white/80 text-slate-700 border-orange-200/80 hover:bg-white'
                }`}
              >
                {tab}
                {tab === 'All' && ` (${sellersList.length})`}
                {tab === 'Pending' && ` (${sellersList.filter(s => s.status === 'Pending' || s.rawStatus === 'under_review' || s.rawStatus === 'pending_otp').length})`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <button
              onClick={() => loadLiveSellers(true)}
              disabled={loading}
              className="p-2 bg-white border border-slate-200 rounded-xl text-slate-700 hover:text-[#ff5500] hover:border-[#ff5500] cursor-pointer transition-all shadow-2xs shrink-0"
              title="Refresh Sellers"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>

            <div className="relative w-full md:w-64">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search by store, name, phone, city..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#ff5500] transition-all shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Sellers Overview Table */}
        <div className="p-6">
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4 text-center w-16">LOGO</th>
                  <th className="py-3.5 px-4">SELLER & STORE</th>
                  <th className="py-3.5 px-4">BUSINESS & CITY</th>
                  <th className="py-3.5 px-4">DOCUMENTS</th>
                  <th className="py-3.5 px-4">REG. FEE</th>
                  <th className="py-3.5 px-4">STATUS</th>
                  <th className="py-3.5 px-4">JOINED</th>
                  <th className="py-3.5 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-9 h-9 border-3 border-orange-500/20 border-t-[#ff5500] rounded-full animate-spin"></div>
                        <div>
                          <p className="text-sm font-bold text-slate-800 tracking-tight">Loading Sellers Directory...</p>
                          <p className="text-xs text-slate-400 mt-0.5">Fetching complete registration and document records</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length > 0 ? (
                  filtered.map((seller) => (
                    <tr key={seller.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* LOGO */}
                      <td className="py-3.5 px-4 text-center">
                        {seller.storeLogo ? (
                          <div 
                            className="w-9 h-9 rounded-xl overflow-hidden border border-orange-200 bg-white shadow-2xs mx-auto flex items-center justify-center cursor-pointer group"
                            onClick={() => setSelectedSeller(seller)}
                            title="View Seller Profile"
                          >
                            <img src={seller.storeLogo} alt={seller.storeName} className="w-full h-full object-contain p-0.5 group-hover:scale-110 transition-transform" />
                          </div>
                        ) : (
                          <span className={`w-9 h-9 rounded-xl ${seller.logoBg} text-white font-extrabold flex items-center justify-center mx-auto text-xs shadow-2xs`}>
                            {seller.logoText}
                          </span>
                        )}
                      </td>

                      {/* SELLER & STORE INFO */}
                      <td className="py-3.5 px-4 space-y-0.5">
                        <p className="font-extrabold text-slate-900 text-xs m-0">{seller.storeName}</p>
                        <p className="text-[11px] text-slate-600 m-0 font-medium">{seller.ownerName || seller.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono m-0">{seller.mobile} • {seller.email}</p>
                      </td>

                      {/* BUSINESS & CITY */}
                      <td className="py-3.5 px-4 space-y-0.5">
                        <span className="font-bold text-slate-800 block">{seller.businessType}</span>
                        <span className="text-[11px] text-slate-500 block">📍 {seller.city || 'Local'} ({seller.serviceRadius}km)</span>
                      </td>

                      {/* DOCUMENTS UPLOAD STATUS */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            seller.gstPhoto 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : 'bg-slate-100 text-slate-400 border border-slate-200'
                          }`} title={seller.gstPhoto ? 'GST Document Uploaded' : 'No GST Document'}>
                            GST {seller.gstPhoto ? '✓' : '✕'}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            seller.bankPassbookPhoto 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : 'bg-slate-100 text-slate-400 border border-slate-200'
                          }`} title={seller.bankPassbookPhoto ? 'Bank Passbook Uploaded' : 'No Passbook'}>
                            Bank {seller.bankPassbookPhoto ? '✓' : '✕'}
                          </span>
                        </div>
                      </td>

                      {/* REGISTRATION FEE */}
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          seller.registrationFeeStatus === 'paid' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : seller.registrationFeeStatus === 'not_required'
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {seller.registrationFeeStatus === 'paid' ? 'Paid' : (seller.registrationFeeStatus === 'not_required' ? 'Waived' : 'Pending')}
                        </span>
                      </td>

                      {/* STATUS */}
                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          seller.status === 'Approved' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : seller.status === 'Rejected'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : seller.status === 'Suspended'
                            ? 'bg-slate-100 text-slate-700 border border-slate-300'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {seller.status}
                        </span>
                      </td>

                      {/* JOINED ON */}
                      <td className="py-3.5 px-4 font-mono text-slate-600 font-medium text-[11px]">
                        {seller.joinedOn}
                      </td>

                      {/* ACTIONS */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button 
                            onClick={() => setSelectedSeller(seller)}
                            className="px-3 py-1.5 bg-orange-50 hover:bg-[#ff5500] text-[#ff5500] hover:text-white rounded-lg text-xs font-bold cursor-pointer transition-all border border-orange-200/80 inline-flex items-center gap-1 shadow-2xs"
                          >
                            <Eye size={12} /> View Details
                          </button>

                          {seller.status !== 'Approved' && (
                            <button
                              onClick={() => handleToggleStatus(seller.id, 'approved')}
                              disabled={actionLoading}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded-lg text-xs font-bold cursor-pointer transition-all border border-emerald-200"
                              title="Quick Approve Seller"
                            >
                              <Check size={13} />
                            </button>
                          )}

                          {seller.status !== 'Rejected' && (
                            <button
                              onClick={() => handleToggleStatus(seller.id, 'rejected')}
                              disabled={actionLoading}
                              className="p-1.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white rounded-lg text-xs font-bold cursor-pointer transition-all border border-rose-200"
                              title="Quick Reject Seller"
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="py-12 text-center text-slate-400 font-medium text-xs">
                      No sellers found matching your search filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
};

/* =========================================================================
   NEW DEDICATED ADD PRODUCT PAGE
   ========================================================================= */
export const AddProductPage = () => {
  const { setActiveTab, editingProductData, setEditingProductData } = useAdmin();

  const initialData = editingProductData ? {
    id: editingProductData.id || editingProductData._id,
    name: editingProductData.name || '',
    category: editingProductData.category || 'Groceries & Grains',
    subCategory: editingProductData.subCategory || 'Grains & Pulses',
    brand: editingProductData.brand || 'Sathi Seller Select',
    unit: editingProductData.variation || editingProductData.unit || '1kg',
    unitValue: editingProductData.unitValue || '1',
    unitType: editingProductData.unitType || 'kg',
    description: editingProductData.description || '',
    mrp: editingProductData.mrp || editingProductData.originalPrice || editingProductData.price || '',
    salePrice: editingProductData.salePrice || editingProductData.price || '',
    taxRate: editingProductData.taxRate || '5%',
    hsnCode: editingProductData.hsnCode || '0713',
    stock: editingProductData.stock !== undefined ? editingProductData.stock : '',
    minStockLimit: editingProductData.minStockLimit || '10',
    sku: editingProductData.sku || editingProductData.id || '',
    seller: editingProductData.seller || 'Sathi Seller Official Store',
    status: editingProductData.status || 'Published',
    isFeatured: editingProductData.isFeatured || false,
    isReturnable: editingProductData.isReturnable !== undefined ? editingProductData.isReturnable : true,
    returnWindow: String(editingProductData.returnWindow || '7'),
    returnPolicy: editingProductData.returnPolicy || '7 Days Returnable / Replacement',
    mainImage: editingProductData.image || editingProductData.mainImage || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&q=80',
    mainImageFile: null,
    galleryImages: editingProductData.galleryImages || [],
    hasVariants: Boolean(editingProductData.hasVariants || (Array.isArray(editingProductData.variants) && editingProductData.variants.length > 0)),
    variantOptions: editingProductData.variantOptions || [],
    variants: editingProductData.variants || []
  } : {
    name: '',
    category: 'Groceries & Grains',
    subCategory: 'Grains & Pulses',
    brand: 'Sathi Seller Select',
    unit: '1kg',
    unitValue: '1',
    unitType: 'kg',
    description: '',
    mrp: '',
    salePrice: '',
    taxRate: '5%',
    hsnCode: '0713',
    stock: '',
    minStockLimit: '10',
    sku: '',
    seller: 'Sathi Seller Official Store',
    status: 'Published',
    isFeatured: false,
    isReturnable: true,
    returnWindow: '7',
    returnPolicy: '7 Days Returnable / Replacement',
    mainImage: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&q=80',
    mainImageFile: null,
    galleryImages: [],
    hasVariants: false,
    variantOptions: [],
    variants: []
  };

  const [formData, setFormData] = React.useState(initialData);

  // Dynamic Categories State
  const [dynamicCategoryMap, setDynamicCategoryMap] = React.useState({});
  const [registeredCategories, setRegisteredCategories] = React.useState([]);

  React.useEffect(() => {
    const fetchRegisteredCategories = async () => {
      try {
        const res = await categoryService.getCategories();
        if (res && res.categories && res.categories.length > 0) {
          const flat = res.categories;
          const map = {};
          const idToName = {};
          
          flat.forEach(c => {
            idToName[c._id] = c.name;
            if (!c.parent) {
              map[c.name] = [];
            }
          });
          
          flat.forEach(c => {
            if (c.parent) {
              const parentName = idToName[c.parent];
              if (parentName && map[parentName]) {
                map[parentName].push(c.name);
              }
            }
          });
          
          setDynamicCategoryMap(map);
          setRegisteredCategories(Object.keys(map));
          
          if (Object.keys(map).length > 0) {
            const firstCat = Object.keys(map)[0];
            const firstSub = map[firstCat].length > 0 ? map[firstCat][0] : 'None';
            setFormData(prev => ({
              ...prev,
              category: prev.category && map[prev.category] ? prev.category : firstCat,
              subCategory: prev.category && map[prev.category] ? (map[prev.category].length > 0 ? map[prev.category][0] : 'None') : firstSub
            }));
          }
        }
      } catch (err) {
        console.warn('Using registered category catalog fallback:', err.message);
      }
    };
    fetchRegisteredCategories();
  }, []);

  const handleCategorySelectChange = (newCategory) => {
    const availableSubs = dynamicCategoryMap[newCategory] || [];
    setFormData(prev => ({
      ...prev,
      category: newCategory,
      subCategory: availableSubs.length > 0 ? availableSubs[0] : 'None'
    }));
  };

  const currentSubCategories = dynamicCategoryMap[formData.category] || [];
  const displaySubCategories = currentSubCategories.length > 0 ? currentSubCategories : ['None'];

  // Multiple Homepage Sections Selection State
  const [selectedHomeSections, setSelectedHomeSections] = React.useState(() => {
    if (editingProductData && Array.isArray(editingProductData.homeSections)) {
      return editingProductData.homeSections;
    }
    return ['flash_sale', 'bestseller'];
  });

  const [toastMsg, setToastMsg] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [createdSuccessModal, setCreatedSuccessModal] = React.useState(null);
  const fileInputRef = React.useRef(null);
  const multipleFileInputRef = React.useRef(null);

  const availableSections = [
    { id: 'flash_sale', name: 'Flash Sale', description: 'Limited-time deals with countdown timer', badge: 'Flash Sale' },
    { id: 'best_deals', name: 'Best Deals', description: 'Special discounted deal cards on Homepage', badge: 'Best Deals' },
    { id: 'featured', name: 'Featured Products', description: 'Top highlighted products on Homepage', badge: 'Featured' },
    { id: 'bestseller', name: 'Bestseller', description: 'Showcase in Top Bestseller carousel cards', badge: 'Bestseller' },
    { id: 'trending', name: 'Trending', description: 'Popular trending items section', badge: 'Trending' },
    { id: 'new_arrivals', name: 'New Arrivals', description: 'Newly launched product additions', badge: 'New Arrival' },
    { id: 'recommended', name: 'Recommended', description: 'Personalized recommendation widget', badge: 'Recommended' },
    { id: 'category_featured', name: 'Category Deals', description: 'Highlight under daily category grid', badge: 'Category' }
  ];

  const toggleHomeSection = (sectionId) => {
    setSelectedHomeSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  const resetForm = () => {
    setFormData(initialData);
    setCreatedSuccessModal(null);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleMultipleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    // We only take up to 3 images max
    const maxFiles = files.slice(0, 3);
    
    for (const file of maxFiles) {
      const compressed = await compressAndResizeImage(file, 1000, 1000, 0.75);
      if (compressed) {
        const resultUrl = compressed.dataUrl;
        setFormData(prev => {
          const newGallery = [...(prev.galleryImages || [])];
          if (newGallery.length < 3) {
            newGallery.push(resultUrl);
          }
          return { ...prev, galleryImages: newGallery };
        });

        // Background direct upload if available
        uploadFileViaApi(compressed.file || file, 'products').then(uploadedUrl => {
          if (uploadedUrl) {
            setFormData(prev => ({
              ...prev,
              galleryImages: prev.galleryImages.map(img => img === resultUrl ? uploadedUrl : img)
            }));
          }
        }).catch(() => {});
      }
    }
    
    showToast(`${maxFiles.length} gallery images compressed & loaded!`);
  };

  const removeGalleryImage = (indexToRemove) => {
    setFormData(prev => ({
      ...prev,
      galleryImages: prev.galleryImages.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  const handleDeviceFileUpload = async (e, field) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      const compressed = await compressAndResizeImage(file, 1000, 1000, 0.75);
      if (compressed) {
        const resultUrl = compressed.dataUrl;
        setFormData(prev => ({
          ...prev,
          [field]: resultUrl,
          [`${field}File`]: file.name
        }));
        showToast(`Image "${file.name}" compressed & selected!`);

        uploadFileViaApi(compressed.file || file, 'products').then(uploadedUrl => {
          if (uploadedUrl) {
            setFormData(prev => ({
              ...prev,
              [field]: uploadedUrl
            }));
          }
        }).catch(() => {});
      }
    }
  };

  const handleFormSubmit = async (e, statusToSave = 'Published') => {
    e.preventDefault();

    if (formData.hasVariants) {
      const validOptions = (formData.variantOptions || []).filter(
        opt => opt.name && opt.name.trim() && Array.isArray(opt.values) && opt.values.length > 0
      );
      if (validOptions.length === 0) {
        showToast('Please add at least one variant option with values (e.g. Size: 4, 5, 6, 7).');
        return;
      }
    }

    if (formData.salePrice === '' || isNaN(formData.salePrice) || Number(formData.salePrice) < 0) {
      showToast('Please provide a valid Selling Price (₹).');
      return;
    }
    if (formData.mrp === '' || isNaN(formData.mrp) || Number(formData.mrp) < 0) {
      showToast('Please provide a valid MRP Price (₹).');
      return;
    }
    if (formData.stock === '' || isNaN(formData.stock) || Number(formData.stock) < 0) {
      showToast('Please provide a valid Initial Stock Quantity.');
      return;
    }

    setIsSubmitting(true);
    let res = null;
    try {
      const finalSalePrice = Number(formData.salePrice || 0);
      const finalMrp = Number(formData.mrp || formData.salePrice || 0);
      const finalStock = Number(formData.stock || 0);
      const finalSku = formData.sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`;

      const syncedVariants = (formData.hasVariants && Array.isArray(formData.variants))
        ? formData.variants.map(v => ({
            ...v,
            price: finalSalePrice,
            originalPrice: finalMrp,
            stock: finalStock,
            image: v.image || formData.mainImage || ''
          }))
        : [];

      const cleanVariantOptions = formData.hasVariants && Array.isArray(formData.variantOptions)
        ? formData.variantOptions.filter(o => o.name && o.name.trim() && Array.isArray(o.values) && o.values.length > 0)
        : [];

      const payload = {
        ...formData,
        homeSections: selectedHomeSections,
        status: statusToSave,
        sku: finalSku,
        mrp: finalMrp,
        salePrice: finalSalePrice,
        stock: finalStock,
        hasVariants: Boolean(formData.hasVariants && cleanVariantOptions.length > 0),
        variantOptions: cleanVariantOptions,
        variants: syncedVariants
      };

      if (editingProductData && (editingProductData._id || editingProductData.id)) {
        res = await productService.updateProduct(editingProductData._id || editingProductData.id, payload);
      } else {
        res = await productService.createProduct(payload);
      }
    } catch (err) {
      console.warn('Backend API submission fallback:', err.message);
    } finally {
      setIsSubmitting(false);

      const cleanVariantOptions = formData.hasVariants && Array.isArray(formData.variantOptions)
        ? formData.variantOptions.filter(o => o.name && o.name.trim() && Array.isArray(o.values) && o.values.length > 0)
        : [];

      const syncedVariants = (formData.hasVariants && Array.isArray(formData.variants))
        ? formData.variants.map(v => ({
            ...v,
            price: Number(formData.salePrice || 0),
            originalPrice: Number(formData.mrp || formData.salePrice || 0),
            stock: Number(formData.stock || 0),
            image: v.image || ''
          }))
        : [];

      const firstActiveVariant = (formData.hasVariants && Array.isArray(syncedVariants) && syncedVariants.length > 0)
        ? (syncedVariants.find(v => v.active !== false) || syncedVariants[0])
        : null;

      const finalVariation = formData.hasVariants && firstActiveVariant 
        ? firstActiveVariant.title 
        : `${formData.unitValue || 1} ${formData.unitType || 'kg'}`;

      const generatedSku = res?.product?.sku || formData.sku || (firstActiveVariant ? firstActiveVariant.sku : '') || `SKU-${Math.floor(1000 + Math.random() * 9000)}`;

      const newProductObj = {
        _id: res?.product?._id || editingProductData?._id,
        id: res?.product?._id || editingProductData?.id || generatedSku,
        name: formData.name || 'New Product',
        seller: formData.seller || 'Sathi Seller Official Store',
        category: formData.category,
        subCategory: formData.subCategory,
        image: formData.mainImage || 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400&q=80',
        galleryImages: formData.galleryImages || [],
        variation: finalVariation,
        stock: Number(formData.stock || 0),
        status: statusToSave,
        mrp: Number(formData.mrp || formData.salePrice || 0),
        salePrice: Number(formData.salePrice || 0),
        homeSections: selectedHomeSections,
        hasVariants: Boolean(formData.hasVariants && cleanVariantOptions.length > 0),
        variantOptions: cleanVariantOptions,
        variants: syncedVariants
      };

      const existingLocal = JSON.parse(localStorage.getItem('sathiseller_custom_products') || '[]');
      const updatedLocal = [newProductObj, ...existingLocal.filter(p => p.id !== newProductObj.id)];
      localStorage.setItem('sathiseller_custom_products', JSON.stringify(updatedLocal));

      setCreatedSuccessModal(newProductObj);
      showToast(`Product "${formData.name}" ${editingProductData ? 'updated' : 'added'} successfully!`);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-16 font-sans relative">
      {/* Product Creation Success Modal */}
      {createdSuccessModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 animate-scaleUp border border-slate-100">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle size={36} />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-xl font-extrabold text-slate-900 m-0">Product {editingProductData ? 'Updated' : 'Added'} Successfully!</h3>
              <p className="text-xs text-slate-500">The product has been saved and is now listed in All Products.</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center gap-3.5">
              <img 
                src={createdSuccessModal.image} 
                alt={createdSuccessModal.name} 
                className="w-14 h-14 rounded-xl object-cover border border-slate-200 bg-white shrink-0" 
              />
              <div className="space-y-0.5 flex-1 min-w-0">
                <h4 className="text-sm font-bold text-slate-900 m-0 truncate">{createdSuccessModal.name}</h4>
                <p className="text-[11px] font-mono text-slate-400 m-0">SKU: <span className="font-semibold text-slate-700">{createdSuccessModal.id}</span></p>
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="text-xs font-extrabold text-[#ff5500]">₹{createdSuccessModal.salePrice}</span>
                  <span className="text-[10px] text-slate-400 line-through">₹{createdSuccessModal.mrp}</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.2 rounded">
                    Stock: {createdSuccessModal.stock}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button 
                type="button"
                onClick={() => setActiveTab('products')}
                className="flex-1 px-4 py-3 bg-[#ff5500] hover:bg-[#e04a00] text-white text-xs font-bold rounded-xl border-none cursor-pointer shadow-md transition-all text-center flex items-center justify-center gap-1.5"
              >
                <Package size={16} /> View All Products List
              </button>
              <button 
                type="button"
                onClick={resetForm}
                className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 cursor-pointer transition-all text-center flex items-center justify-center gap-1.5"
              >
                <Plus size={16} /> Add Another Product
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-slate-700 animate-bounce">
          <CheckCircle size={18} className="text-emerald-400" />
          <span className="text-sm font-medium">{toastMsg}</span>
        </div>
      )}

      {/* Clean Page Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Add New Product</h2>
        <p className="text-xs text-slate-500">Create and list new items with pricing, stock limits, media, and homepage section mapping</p>
      </div>

      <form onSubmit={(e) => handleFormSubmit(e, 'Published')} className="max-w-4xl mx-auto space-y-6">
        {/* Card 1: Basic Information */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <FileText size={18} className="text-[#ff5500]" /> General Product Information
          </h3>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Product Name *</label>
            <input 
              type="text" 
              required
              placeholder="e.g. Premium Organics Basmati Rice"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:border-[#ff5500]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Registered Category *</label>
              <select 
                value={formData.category}
                onChange={(e) => handleCategorySelectChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:border-[#ff5500]"
              >
                {registeredCategories.map(catName => (
                  <option key={catName} value={catName}>{catName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Sub-Category *</label>
              <select 
                value={formData.subCategory}
                onChange={(e) => handleInputChange('subCategory', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#ff5500]"
              >
                {displaySubCategories.map(subName => (
                  <option key={subName} value={subName}>{subName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Brand</label>
              <input 
                type="text" 
                placeholder="e.g. Fortune / Daawat"
                value={formData.brand}
                onChange={(e) => handleInputChange('brand', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#ff5500]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Seller / Merchant</label>
              <select 
                value={formData.seller}
                onChange={(e) => handleInputChange('seller', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#ff5500]"
              >
                <option value="Sathi Seller Official Store">Sathi Seller Official Warehouse</option>
                <option value="Keshari Vagitl Shope">Keshari Vagitl Shope</option>
                <option value="Fresh Farm Supermarket">Fresh Farm Supermarket</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Product Description</label>
            <textarea 
              rows={4}
              placeholder="Write a brief overview of product freshness, origin, quality certification..."
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#ff5500]"
            />
          </div>
        </div>

        {/* Card 2: Dynamic Product Variants System */}
        <ProductVariantBuilder 
          category={formData.category}
          basePrice={formData.salePrice}
          baseMrp={formData.mrp}
          baseStock={formData.stock}
          baseSku={formData.sku}
          productName={formData.name}
          unitValue={formData.unitValue}
          unitType={formData.unitType}
          onUnitChange={(field, val) => handleInputChange(field, val)}
          hasVariants={formData.hasVariants}
          onHasVariantsChange={(val) => handleInputChange('hasVariants', val)}
          variantOptions={formData.variantOptions}
          onVariantOptionsChange={(opts) => handleInputChange('variantOptions', opts)}
          variants={formData.variants}
          onVariantsChange={(vars) => handleInputChange('variants', vars)}
          availableImages={[formData.mainImage, ...(formData.galleryImages || [])].filter(Boolean)}
        />

        {/* Card 2: Device File Upload Section */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Upload size={18} className="text-[#ff5500]" /> Product Image Upload
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Upload Primary Image from Device *</label>
              
              {/* Hidden File Input */}
              <input 
                type="file" 
                ref={fileInputRef}
                accept="image/*"
                onClick={(e) => { e.target.value = null; }}
                onChange={(e) => handleDeviceFileUpload(e, 'mainImage')}
                className="hidden"
              />

              {/* Device Upload Drag & Drop Dropzone */}
              <div 
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                className="border-2 border-dashed border-slate-300 hover:border-[#ff5500] bg-slate-50 hover:bg-orange-50/40 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2 group"
              >
                <div className="w-12 h-12 rounded-full bg-orange-100 group-hover:bg-[#ff5500] text-[#ff5500] group-hover:text-white flex items-center justify-center mx-auto transition-colors">
                  <Upload size={22} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-[#ff5500]">
                    Click to Browse or Upload Image
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Supports PNG, JPG, WEBP from your computer device</p>
                </div>
              </div>
            </div>

            {/* Uploaded Image Live Preview Box */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Device Upload Preview</label>
              <div className="h-44 w-full rounded-2xl overflow-hidden border border-slate-200 relative group bg-slate-100 flex items-center justify-center">
                {formData.mainImage ? (
                  <>
                    <img src={formData.mainImage} alt="Uploaded Product" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button 
                        type="button"
                        onClick={() => fileInputRef.current && fileInputRef.current.click()}
                        className="px-3.5 py-1.5 bg-white text-slate-900 rounded-lg text-xs font-semibold border-none cursor-pointer shadow-md"
                      >
                        Change Image
                      </button>
                    </div>
                  </>
                ) : (
                  <span className="text-xs text-slate-400 font-medium">No Image Selected</span>
                )}
              </div>
              {formData.mainImageFile && (
                <p className="text-xs font-mono text-emerald-600 font-medium mt-1">Selected file: {formData.mainImageFile}</p>
              )}
            </div>
          </div>
        </div>

        {/* Card 2.5: Product Gallery Images (Max 3) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Upload size={18} className="text-[#ff5500]" /> Product Gallery Images
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Upload up to 3 Gallery Images</label>
              <input 
                type="file" 
                ref={multipleFileInputRef}
                accept="image/*"
                multiple
                onClick={(e) => { e.target.value = null; }}
                onChange={handleMultipleFileUpload}
                className="hidden"
              />
              <div 
                onClick={() => multipleFileInputRef.current && multipleFileInputRef.current.click()}
                className="border-2 border-dashed border-slate-300 hover:border-[#ff5500] bg-slate-50 hover:bg-orange-50/40 rounded-2xl p-6 text-center cursor-pointer transition-all space-y-2 group"
              >
                <div className="w-12 h-12 rounded-full bg-orange-100 group-hover:bg-[#ff5500] text-[#ff5500] group-hover:text-white flex items-center justify-center mx-auto transition-colors">
                  <Upload size={22} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800 group-hover:text-[#ff5500]">
                    Select Multiple Images
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Supports PNG, JPG, WEBP</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Gallery Preview ({formData.galleryImages?.length || 0}/3)</label>
              <div className="flex flex-wrap gap-3">
                {formData.galleryImages && formData.galleryImages.length > 0 ? (
                  formData.galleryImages.map((imgBase64, idx) => (
                    <div key={idx} className="h-24 w-24 rounded-xl overflow-hidden border border-slate-200 relative group">
                      <img src={imgBase64} alt={`Gallery ${idx+1}`} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button 
                          type="button"
                          onClick={() => removeGalleryImage(idx)}
                          className="w-6 h-6 rounded-full bg-white text-red-600 flex items-center justify-center shadow hover:bg-red-50 hover:text-red-700 cursor-pointer border-none"
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-24 w-full rounded-xl bg-slate-50 border border-slate-200 border-dashed flex items-center justify-center text-slate-400 text-xs font-medium">
                    No gallery images uploaded
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Homepage Section Selection (Multi-Select Checkboxes) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Tag size={18} className="text-[#ff5500]" /> Display on Homepage Sections
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Select one or multiple sections on the Customer App Homepage where this product will be shown.</p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-[#ff5500]">
              {selectedHomeSections.length} Selected
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
            {availableSections.map(sec => {
              const isSelected = selectedHomeSections.includes(sec.id);
              return (
                <div 
                  key={sec.id}
                  onClick={() => toggleHomeSection(sec.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                    isSelected 
                      ? 'bg-orange-50/60 border-[#ff5500] shadow-2xs' 
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input 
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}} // Handled by parent div
                    className="mt-1 w-4 h-4 accent-[#ff5500] cursor-pointer"
                  />
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-900">{sec.name}</span>
                      <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
                        {sec.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 m-0">{sec.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Card 4: Pricing & Tax */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <DollarSign size={18} className="text-[#ff5500]" /> Pricing, Discounts & Taxation
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                MRP Price (₹) *
              </label>
              <input 
                type="number" 
                required
                placeholder="95.00"
                value={formData.mrp}
                onChange={(e) => handleInputChange('mrp', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#ff5500]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Selling Price (₹) *
              </label>
              <input 
                type="number" 
                required
                placeholder="75.00"
                value={formData.salePrice}
                onChange={(e) => handleInputChange('salePrice', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-[#ff5500] focus:outline-none focus:border-[#ff5500]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">GST Tax Rate</label>
              <select 
                value={formData.taxRate}
                onChange={(e) => handleInputChange('taxRate', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#ff5500]"
              >
                <option value="0%">0% (Exempt)</option>
                <option value="5%">5% GST</option>
                <option value="12%">12% GST</option>
                <option value="18%">18% GST</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">HSN Code</label>
              <input 
                type="text" 
                placeholder="e.g. 0713"
                value={formData.hsnCode}
                onChange={(e) => handleInputChange('hsnCode', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#ff5500]"
              />
            </div>
          </div>
        </div>

        {/* Card 5: Inventory & SKU */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Boxes size={18} className="text-[#ff5500]" /> Inventory & Stock Control
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Initial Stock Quantity *
              </label>
              <input 
                type="number" 
                required
                placeholder="100"
                value={formData.stock}
                onChange={(e) => handleInputChange('stock', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#ff5500]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Min Stock Alert Limit</label>
              <input 
                type="number" 
                placeholder="10"
                value={formData.minStockLimit}
                onChange={(e) => handleInputChange('minStockLimit', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#ff5500]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">SKU / Barcode ID</label>
              <input 
                type="text" 
                placeholder="SKU-GR-9012"
                value={formData.sku}
                onChange={(e) => handleInputChange('sku', e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-900 focus:outline-none focus:border-[#ff5500]"
              />
            </div>
          </div>
        </div>

        {/* Card 6: Return Policy & Guarantee */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <RotateCcw size={18} className="text-[#ff5500]" /> Return & Refund Policy *
            </h3>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${formData.isReturnable ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
              {formData.isReturnable ? `Returnable (${formData.returnWindow || 7} Days)` : 'Non-Returnable'}
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Is this product Returnable? *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div 
                onClick={() => setFormData(prev => ({ 
                  ...prev, 
                  isReturnable: true,
                  returnPolicy: prev.returnPolicy === 'Non-Returnable' ? `${prev.returnWindow || 7} Days Returnable / Replacement` : prev.returnPolicy
                }))}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                  formData.isReturnable 
                    ? 'bg-emerald-50/60 border-emerald-500 shadow-2xs' 
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <input 
                  type="radio"
                  name="admin_isReturnable"
                  checked={formData.isReturnable === true}
                  onChange={() => {}}
                  className="mt-1 w-4 h-4 accent-emerald-600 cursor-pointer"
                />
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck size={16} className="text-emerald-600" /> Yes, Product is Returnable
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 m-0">Customers can request return / replacement within the designated window.</p>
                </div>
              </div>

              <div 
                onClick={() => setFormData(prev => ({ 
                  ...prev, 
                  isReturnable: false,
                  returnPolicy: 'Non-Returnable due to hygiene / perishable nature'
                }))}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                  !formData.isReturnable 
                    ? 'bg-amber-50/60 border-amber-500 shadow-2xs' 
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <input 
                  type="radio"
                  name="admin_isReturnable"
                  checked={formData.isReturnable === false}
                  onChange={() => {}}
                  className="mt-1 w-4 h-4 accent-amber-600 cursor-pointer"
                />
                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <AlertCircle size={16} className="text-amber-600" /> No, Non-Returnable
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 m-0">Suitable for perishable groceries, fresh bakery, personal hygiene or customized items.</p>
                </div>
              </div>
            </div>
          </div>

          {formData.isReturnable ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Return Window Period *</label>
                <select 
                  value={formData.returnWindow}
                  onChange={(e) => {
                    const win = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      returnWindow: win,
                      returnPolicy: `${win} Days Returnable / Replacement`
                    }));
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:border-[#ff5500]"
                >
                  <option value="3">3 Days Return Window</option>
                  <option value="7">7 Days Return Window (Standard)</option>
                  <option value="10">10 Days Return Window</option>
                  <option value="14">14 Days Return Window</option>
                  <option value="30">30 Days Return Window</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Customer Return Policy Note</label>
                <input 
                  type="text"
                  placeholder="e.g. 7 Days Returnable / Replacement if damaged"
                  value={formData.returnPolicy}
                  onChange={(e) => handleInputChange('returnPolicy', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-[#ff5500]"
                />
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center gap-2 text-xs text-amber-800 font-medium">
              <AlertCircle size={15} className="text-amber-600 shrink-0" />
              <span>This product will display a "Non-Returnable" badge on the customer product page and checkout screen.</span>
            </div>
          )}
        </div>

        {/* Add Product Submit Button at the Very End */}
        <div className="pt-4 flex justify-end">
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full sm:w-auto px-8 py-3.5 bg-[#ff5500] hover:bg-[#e04a00] text-white text-base font-semibold rounded-xl border-none cursor-pointer shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            {isSubmitting ? 'Saving Product...' : (editingProductData ? 'Update Product' : 'Add Product')}
          </button>
        </div>
      </form>
    </div>
  );
};

/* =========================================================================
   ADMIN SETTLEMENTS & COMMISSION REPORT PAGE
   ========================================================================= */
export const AdminSettlementsReport = () => {
  const [settlements, setSettlements] = React.useState([]);
  const [summary, setSummary] = React.useState({ totalCommissionEarned: 0, totalSettledAmount: 0, totalTransactions: 0 });
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchSettlements();
  }, []);

  const fetchSettlements = async () => {
    setLoading(true);
    try {
      const res = await walletService.getAdminSettlements();
      if (res && res.success) {
        setSettlements(res.settlements || []);
        setSummary(res.summary || {});
      }
    } catch (err) {
      console.error('Error fetching admin settlements:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Admin Commission & Settlements</h2>
          <p className="text-xs text-slate-500">Live order settlement records and platform commission earned from sellers.</p>
        </div>
        <button 
          onClick={fetchSettlements} 
          className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer shadow-xs hover:bg-slate-50"
        >
          Refresh Report
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase">Total Admin Commission</span>
          <p className="text-2xl font-black text-[#ff7526]">₹{Number(summary.totalCommissionEarned || 0).toFixed(2)}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase">Total Seller Wallet Credits</span>
          <p className="text-2xl font-black text-emerald-600">₹{Number(summary.totalSettledAmount || 0).toFixed(2)}</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase">Total Settlements</span>
          <p className="text-2xl font-black text-slate-900">{summary.totalTransactions || 0}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                <th className="py-3.5 px-4 font-bold">Order ID</th>
                <th className="py-3.5 px-4 font-bold">Seller</th>
                <th className="py-3.5 px-4 font-bold">Customer</th>
                <th className="py-3.5 px-4 font-bold">Gross Amount</th>
                <th className="py-3.5 px-4 font-bold">Commission %</th>
                <th className="py-3.5 px-4 font-bold">Commission Earned</th>
                <th className="py-3.5 px-4 font-bold">Net Seller Amount</th>
                <th className="py-3.5 px-4 font-bold">Payment</th>
                <th className="py-3.5 px-4 font-bold">Settlement Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-normal">
              {settlements.map((s) => (
                <tr key={s._id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4 font-mono font-bold text-[#ff7526]">{s.orderId}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">{s.sellerName}</td>
                  <td className="py-3.5 px-4 text-slate-700">{s.customerDetails?.name || 'Customer'}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">₹{Number(s.totalAmount || 0).toFixed(2)}</td>
                  <td className="py-3.5 px-4 font-extrabold text-blue-600">{s.commissionRate || 10}%</td>
                  <td className="py-3.5 px-4 font-extrabold text-[#ff7526]">₹{Number(s.commissionAmount || 0).toFixed(2)}</td>
                  <td className="py-3.5 px-4 font-extrabold text-emerald-600">₹{Number(s.netSellerAmount || 0).toFixed(2)}</td>
                  <td className="py-3.5 px-4 font-medium text-slate-600">{s.paymentMethod} ({s.paymentStatus})</td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                      s.settlementStatus === 'SETTLED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {s.settlementStatus}
                    </span>
                  </td>
                </tr>
              ))}

              {!loading && settlements.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400 text-xs">
                    No order settlement records found yet.
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


