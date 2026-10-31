// Firebase Cloud Messaging Service Worker (SOP Standard)
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Dynamically parse Firebase configuration from registration URL query parameters (loaded from .env)
const swUrlParams = new URLSearchParams(self.location.search);

const firebaseConfig = {
  apiKey: swUrlParams.get('apiKey') || "AIzaSyAFml5AgfwKdYsx4lNHKVbnWUrlrltM4B0",
  authDomain: swUrlParams.get('authDomain') || "sathiseller-975a6.firebaseapp.com",
  projectId: swUrlParams.get('projectId') || "sathiseller-975a6",
  storageBucket: swUrlParams.get('storageBucket') || "sathiseller-975a6.firebasestorage.app",
  messagingSenderId: swUrlParams.get('messagingSenderId') || "479252024510",
  appId: swUrlParams.get('appId') || "1:479252024510:web:8f452e0c0bcd417eb122ef",
  measurementId: swUrlParams.get('measurementId') || "G-MZCMPHECE7"
};

try {
  // Initialize Firebase in Service Worker
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  // Handle background push messages
  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background push message:', payload);
    
    const notificationTitle = payload.notification?.title || payload.data?.title || 'Sathi Seller Notification';
    const notificationOptions = {
      body: payload.notification?.body || payload.data?.body || '',
      icon: payload.notification?.icon || payload.data?.icon || '/Logo.png',
      badge: '/Logo.png',
      data: payload.data || {},
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (err) {
  console.warn('[firebase-messaging-sw.js init warning]:', err.message);
}

// Handle notification click and navigation (SOP Standard)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const data = event.notification.data;
  const targetUrl = data?.link || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && targetUrl !== '/') {
            return client.navigate(targetUrl);
          }
          return client;
        }
      }
      // Otherwise open new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
