import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, CheckCheck, Package, Truck, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
};

const typeIcon = (type) => {
  switch (type) {
    case 'ORDER_PLACED':
      return Package;
    case 'ORDER_CONFIRMED':
      return CheckCircle2;
    case 'ORDER_OUT_FOR_DELIVERY':
      return Truck;
    case 'ORDER_DELIVERED':
      return CheckCircle2;
    case 'ORDER_CANCELLED':
      return XCircle;
    case 'ORDER_FAILED':
      return AlertTriangle;
    default:
      return Bell;
  }
};

const Notifications = () => {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const token = typeof window !== 'undefined' ? localStorage.getItem('sathiseller_user_token') : null;

  useEffect(() => {
    if (token) refreshNotifications();
  }, [token, refreshNotifications]);

  const handleOpen = async (notif) => {
    if (!notif.isRead) {
      await markAsRead(notif._id);
    }
    if (notif.orderId || notif.order) {
      navigate('/track-order', {
        state: {
          order: {
            _id: notif.order,
            orderId: notif.orderId,
          },
        },
      });
    }
  };

  return (
    <div className="h-[100dvh] md:h-auto md:min-h-screen bg-slate-50 md:bg-[#f8fafc] font-sans text-slate-800 relative max-w-[480px] md:max-w-4xl mx-auto shadow-[0_0_20px_rgba(0,0,0,0.05)] md:shadow-none flex flex-col md:py-8 md:px-6 overflow-hidden md:overflow-visible">
      {/* Mobile Header */}
      <header className="flex md:hidden items-center gap-3 py-4 px-5 bg-gradient-to-r from-[#ea580c] to-[#f97316] rounded-b-[20px] shadow-sm z-10 relative mb-2">
        <ArrowLeft size={22} color="white" className="cursor-pointer" onClick={() => navigate(-1)} />
        <h2 className="text-[20px] font-semibold m-0 text-white flex-1">Notifications</h2>
        {token && unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllAsRead}
            className="text-[11px] font-bold text-white/95 bg-white/20 border border-white/30 rounded-lg px-2.5 py-1 cursor-pointer"
          >
            Mark all read
          </button>
        )}
      </header>

      {/* Desktop Breadcrumbs & Header */}
      <div className="hidden md:flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <button onClick={() => navigate(-1)} className="hover:text-orange-600 font-medium cursor-pointer border-none bg-transparent flex items-center gap-1">
              <ArrowLeft size={16} /> Back
            </button>
            <span>/</span>
            <span className="text-slate-800 font-bold">Activity</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 m-0">Notifications</h1>
        </div>
        <div className="flex items-center gap-3">
          {token && unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-slate-50"
            >
              <CheckCheck size={14} />
              Mark all as read
            </button>
          )}
          <div className="flex items-center gap-2 text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100">
            <Bell size={16} />
            {unreadCount > 0 ? `${unreadCount} unread` : 'Recent Updates'}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-0 py-4 md:py-0 pb-20 md:pb-12 [&::-webkit-scrollbar]:hidden flex flex-col gap-3 md:gap-4 md:overflow-visible">
        {!token && (
          <div className="bg-white rounded-2xl p-6 text-center border border-slate-100 shadow-sm">
            <Bell size={28} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-semibold text-slate-700 m-0 mb-1">Sign in to view notifications</p>
            <p className="text-xs text-slate-500 m-0 mb-4">Order updates will appear here after you log in.</p>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="px-4 py-2 rounded-xl bg-[#ea580c] text-white text-xs font-bold border-none cursor-pointer"
            >
              Login
            </button>
          </div>
        )}

        {token && loading && notifications.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-8 m-0">Loading notifications...</p>
        )}

        {token && !loading && notifications.length === 0 && (
          <div className="bg-white rounded-2xl p-6 text-center border border-slate-100 shadow-sm">
            <Bell size={28} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-semibold text-slate-700 m-0">No notifications yet</p>
            <p className="text-xs text-slate-500 m-0 mt-1">You will see order updates here in real time.</p>
          </div>
        )}

        {notifications.map((notif) => {
          const Icon = typeIcon(notif.type);
          const isNew = !notif.isRead;
          return (
            <button
              key={notif._id}
              type="button"
              onClick={() => handleOpen(notif)}
              className={`bg-white rounded-[16px] p-4 flex gap-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)] border-l-[4px] text-left cursor-pointer border-y border-r border-slate-100 ${isNew ? 'border-l-[#ff5500]' : 'border-l-slate-200'}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isNew ? 'bg-orange-50 text-[#ff5500]' : 'bg-slate-100 text-slate-400'}`}>
                <Icon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1 gap-2">
                  <h4 className={`text-[14px] font-bold m-0 ${isNew ? 'text-slate-800' : 'text-slate-600'}`}>{notif.title}</h4>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">{formatRelativeTime(notif.createdAt)}</span>
                </div>
                <p className="text-[12px] text-slate-500 leading-relaxed m-0">{notif.message}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default Notifications;
