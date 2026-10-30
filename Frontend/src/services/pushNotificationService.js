import { messaging, getToken, onMessage } from '../firebase';
import { isSupported } from 'firebase/messaging';
import { getBaseApiUrl } from './api';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || 'BEpfQY8Farcg3X9t88x_yH0vOxuuXhaeLP6_EPcDS2gpSXVBEdstE-PyJnTHSiUCjWvIvlzNjhNJGOfgZ88pw_0';
const API_URL = getBaseApiUrl();

/**
 * Register background service worker for FCM (SOP Step 5)
 */
export async function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/',
      });
      console.log('✅ [FCM] Service Worker registered successfully:', registration.scope);
      return registration;
    } catch (error) {
      console.warn('⚠️ [FCM] Service Worker registration info:', error.message);
      return null;
    }
  } else {
    console.warn('⚠️ [FCM] Service Workers are not supported in this browser environment');
    return null;
  }
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission() {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('✅ [FCM] Notification permission granted');
        return true;
      } else {
        console.log('❌ [FCM] Notification permission status:', permission);
        return false;
      }
    } catch (err) {
      console.warn('[FCM Permission Error]:', err.message);
      return false;
    }
  }
  return false;
}

/**
 * Get FCM Token using VAPID key and Service Worker registration
 */
export async function getFCMToken() {
  try {
    const supported = await isSupported().catch(() => false);
    if (!supported || !messaging) {
      console.log('ℹ️ [FCM Info] Messaging not supported or running with placeholder credentials');
      return null;
    }

    const registration = await registerServiceWorker();
    if (!registration) return null;

    await registration.update().catch(() => {});

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      console.log('✅ [FCM] Token obtained successfully:', token.slice(0, 16) + '...');
      return token;
    } else {
      console.log('❌ [FCM] No token returned');
      return null;
    }
  } catch (error) {
    console.warn('ℹ️ [FCM Token Info - Ready for live Firebase Project credentials]:', error.message);
    return null;
  }
}

/**
 * Get active auth token from localStorage across user, seller, captain, or admin
 */
const getActiveAuthToken = (preferredRole) => {
  if (preferredRole === 'seller') {
    return localStorage.getItem('seller_token') || localStorage.getItem('token');
  }
  if (preferredRole === 'captain') {
    return localStorage.getItem('captain_token') || localStorage.getItem('token');
  }
  if (preferredRole === 'admin') {
    return localStorage.getItem('admin_token') || localStorage.getItem('token');
  }
  return localStorage.getItem('token') || localStorage.getItem('user_token') || localStorage.getItem('seller_token') || localStorage.getItem('captain_token');
};

/**
 * Register FCM token with the backend database (SOP Step 5)
 * @param {boolean} forceUpdate
 * @param {string} role 'user' | 'seller' | 'captain'
 */
export async function registerFCMToken(forceUpdate = false, role = 'user') {
  try {
    const storageKey = `fcm_token_${role}_web`;
    const savedToken = localStorage.getItem(storageKey);
    if (savedToken && !forceUpdate) {
      return savedToken;
    }

    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      return null;
    }

    const token = await getFCMToken();
    if (!token) {
      // In dummy mode or unsupported environment
      return null;
    }

    const authToken = getActiveAuthToken(role);
    if (!authToken) {
      console.log('[FCM] No auth token present yet. Token will be saved upon login.');
      return token;
    }

    const response = await fetch(`${API_URL}/fcm-tokens/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        token,
        platform: 'web',
      }),
    });

    if (response.ok) {
      localStorage.setItem(storageKey, token);
      console.log(`✅ [FCM] Token successfully registered with backend for ${role}`);
      return token;
    }
  } catch (error) {
    console.warn('[FCM Registration Error]:', error.message);
  }
  return null;
}

/**
 * Remove FCM token on logout
 */
export async function removeFCMToken(role = 'user') {
  try {
    const storageKey = `fcm_token_${role}_web`;
    const token = localStorage.getItem(storageKey);
    const authToken = getActiveAuthToken(role);

    if (token && authToken) {
      await fetch(`${API_URL}/fcm-tokens/remove`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          token,
          platform: 'web',
        }),
      }).catch(() => {});
    }
    localStorage.removeItem(storageKey);
  } catch (e) {}
}

/**
 * Setup foreground notification handler (SOP Step 5)
 */
export function setupForegroundNotificationHandler(customHandler) {
  try {
    if (!messaging) return;

    onMessage(messaging, (payload) => {
      console.log('📬 [FCM] Foreground message received:', payload);

      const title = payload.notification?.title || payload.data?.title || 'Sathi Seller Notification';
      const body = payload.notification?.body || payload.data?.body || '';
      const icon = payload.notification?.icon || payload.data?.icon || '/Logo.png';

      // If browser permission is granted, display rich desktop notification
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body,
            icon,
            data: payload.data,
          });
        } catch (e) {}
      }

      if (typeof customHandler === 'function') {
        customHandler(payload);
      }
    });
  } catch (err) {
    console.warn('[FCM Foreground Handler Warning]:', err.message);
  }
}

/**
 * Initialize push notifications globally on app mount
 */
export async function initializePushNotifications() {
  try {
    await registerServiceWorker();
  } catch (error) {
    console.warn('[FCM Init Warning]:', error.message);
  }
}

export default {
  initializePushNotifications,
  registerFCMToken,
  removeFCMToken,
  setupForegroundNotificationHandler,
  requestNotificationPermission,
  getFCMToken,
};
