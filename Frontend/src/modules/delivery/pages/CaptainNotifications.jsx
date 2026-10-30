import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { captainService } from '../../../services/authService';

const CaptainNotifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await captainService.getNotifications();
      if (res.success) {
        setNotifications(res.notifications || []);
        setUnreadCount(res.unreadCount || 0);
      }
    } catch (err) {
      console.error('Fetch notifications error:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    try {
      await captainService.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Mark all read error:', err);
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      try {
        await captainService.markNotificationRead(notification._id);
        setNotifications(prev => prev.map(n => n._id === notification._id ? { ...n, read: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (err) {
        console.error('Mark read error:', err);
      }
    }

    // Navigate on job assignment notifications
    if (notification.type === 'JOB_ASSIGNED') {
      navigate('/captain/active-delivery');
    }
  };

  const getIconStyle = (type, read) => {
    if (read) return 'text-slate-400 bg-slate-100';
    const map = {
      'JOB_ASSIGNED': 'text-[#15803d] bg-[#97fc43]/20',
      'PAYMENT': 'text-emerald-600 bg-emerald-100',
      'BONUS': 'text-amber-600 bg-amber-100',
      'ALERT': 'text-red-500 bg-red-100',
      'SYSTEM': 'text-blue-500 bg-blue-100',
    };
    return map[type] || 'text-blue-500 bg-blue-100';
  };

  const getIcon = (type) => {
    const map = {
      'JOB_ASSIGNED': 'local_shipping',
      'PAYMENT': 'account_balance_wallet',
      'BONUS': 'star',
      'ALERT': 'warning',
      'SYSTEM': 'info',
    };
    return map[type] || 'notifications';
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hour${Math.floor(diff / 3600000) > 1 ? 's' : ''} ago`;
    if (diff < 172800000) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="bg-slate-50 font-body-md text-on-surface min-h-screen flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 w-full z-40 bg-gradient-to-r from-[#002625] to-[#0a3d16] shadow-lg rounded-b-3xl px-4 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="font-headline-md text-xl md:text-2xl font-black text-white tracking-tight">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-[10px] text-[#97fc43] font-medium">{unreadCount} unread</p>
            )}
          </div>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-[#97fc43] text-xs font-bold uppercase tracking-wider hover:underline cursor-pointer">
            Mark all read
          </button>
        )}
      </header>

      {/* Content */}
      <main className="pt-24 pb-8 px-4 w-full max-w-md mx-auto flex-1 flex flex-col gap-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="material-symbols-outlined text-5xl text-[#15803d] animate-spin">sync</span>
            <p className="text-sm text-slate-500 font-semibold">Loading notifications…</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
            <span className="material-symbols-outlined text-6xl mb-4 text-slate-300">notifications_off</span>
            <p className="font-bold text-slate-500">No notifications yet</p>
            <p className="text-xs text-slate-400 mt-1">You're all caught up!</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification._id}
              className={`p-4 rounded-2xl border transition-colors cursor-pointer ${
                notification.read
                  ? 'bg-white border-slate-100'
                  : 'bg-[#97fc43]/5 border-[#15803d]/20 shadow-sm'
              }`}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="flex gap-4">
                <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${getIconStyle(notification.type, notification.read)}`}>
                  <span className="material-symbols-outlined text-lg">{getIcon(notification.type)}</span>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className={`text-sm font-bold ${notification.read ? 'text-slate-700' : 'text-[#002625]'}`}>
                      {notification.title}
                    </h3>
                    <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap ml-2">
                      {formatTime(notification.createdAt)}
                    </span>
                  </div>
                  <p className={`text-xs leading-relaxed ${notification.read ? 'text-slate-500' : 'text-slate-600'}`}>
                    {notification.message}
                  </p>
                  {notification.amount && (
                    <p className={`text-xs font-bold mt-1 ${notification.type === 'PAYMENT' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      ₹{notification.amount.toFixed(2)}
                    </p>
                  )}
                  {notification.type === 'JOB_ASSIGNED' && !notification.read && (
                    <button className="mt-2 text-xs text-[#15803d] font-bold flex items-center gap-1">
                      View Assignment <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
};

export default CaptainNotifications;
