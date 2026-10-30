import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authService } from '../../../services/authService';
import { connectUserSocket, disconnectUserSocket } from '../../../services/userSocket';
import { useAuth } from '../../../context/AuthContext';

const NotificationContext = createContext({
  notifications: [],
  unreadCount: 0,
  loading: false,
  refreshNotifications: async () => {},
  markAsRead: async () => {},
  markAllAsRead: async () => {},
  prependNotification: () => {},
});

export const NotificationProvider = ({ children }) => {
  const { isRoleAuthenticated, userRole } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const isUserLoggedIn = Boolean(
    (typeof isRoleAuthenticated === 'function' && isRoleAuthenticated('user')) ||
    (typeof window !== 'undefined' && localStorage.getItem('sathiseller_user_token'))
  );

  const refreshNotifications = useCallback(async () => {
    if (!localStorage.getItem('sathiseller_user_token')) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    try {
      setLoading(true);
      const res = await authService.getUserNotifications();
      if (res?.success) {
        setNotifications(Array.isArray(res.notifications) ? res.notifications : []);
        setUnreadCount(Number(res.unreadCount) || 0);
      }
    } catch (err) {
      console.warn('[Notifications] fetch failed:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const prependNotification = useCallback((notification) => {
    if (!notification?._id) return;
    setNotifications((prev) => {
      if (prev.some((n) => String(n._id) === String(notification._id))) return prev;
      return [notification, ...prev];
    });
    if (!notification.isRead) {
      setUnreadCount((c) => c + 1);
    }
  }, []);

  const markAsRead = useCallback(async (id) => {
    if (!id) return;
    setNotifications((prev) =>
      prev.map((n) => (String(n._id) === String(id) ? { ...n, isRead: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      const res = await authService.markUserNotificationRead(id);
      if (typeof res?.unreadCount === 'number') {
        setUnreadCount(res.unreadCount);
      }
    } catch (err) {
      console.warn('[Notifications] mark read failed:', err.message);
      refreshNotifications();
    }
  }, [refreshNotifications]);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await authService.markAllUserNotificationsRead();
    } catch (err) {
      console.warn('[Notifications] mark all failed:', err.message);
      refreshNotifications();
    }
  }, [refreshNotifications]);

  // Initial fetch + Socket.IO realtime
  useEffect(() => {
    const token = localStorage.getItem('sathiseller_user_token');
    if (!token || !isUserLoggedIn) {
      disconnectUserSocket();
      setNotifications([]);
      setUnreadCount(0);
      return undefined;
    }

    refreshNotifications();

    const socket = connectUserSocket(token);
    const onNotification = (payload) => {
      if (payload?.notification) {
        prependNotification(payload.notification);
      }
    };

    socket?.on('user:notification', onNotification);

    return () => {
      socket?.off('user:notification', onNotification);
    };
  }, [isUserLoggedIn, userRole, refreshNotifications, prependNotification]);

  // Disconnect on logout
  useEffect(() => {
    if (!isUserLoggedIn) {
      disconnectUserSocket();
    }
  }, [isUserLoggedIn]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        refreshNotifications,
        markAsRead,
        markAllAsRead,
        prependNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);

export default NotificationContext;
