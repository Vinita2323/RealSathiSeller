// Firebase Cloud Messaging Service Worker (SOP Standard)
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Firebase configuration (Live Project)
const firebaseConfig = {
  apiKey: "AIzaSyCmU2Q2FhjKfmvqlZG24RWnBBR9DhtZ_DI",
  authDomain: "shippnex-f25bc.firebaseapp.com",
  projectId: "shippnex-f25bc",
  storageBucket: "shippnex-f25bc.firebasestorage.app",
  messagingSenderId: "476273943325",
  appId: "1:476273943325:web:ecc2922d24278a0c3977f4",
  measurementId: "G-K19Y3NFK2H"
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
