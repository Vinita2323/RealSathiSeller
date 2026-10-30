import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCmU2Q2FhjKfmvqlZG24RWnBBR9DhtZ_DI',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'shippnex-f25bc.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'shippnex-f25bc',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'shippnex-f25bc.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '476273943325',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:476273943325:web:ecc2922d24278a0c3977f4',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-K19Y3NFK2H',
};

let app = null;
let messaging = null;

try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }

  // Check if browser environment supports FCM service workers
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    isSupported().then((supported) => {
      if (supported) {
        messaging = getMessaging(app);
      }
    }).catch(() => {});
  }
} catch (err) {
  console.warn('[Firebase Init Warning]:', err.message);
}

export { app, messaging, getToken, onMessage };
export default app;
