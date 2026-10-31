import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAFml5AgfwKdYsx4lNHKVbnWUrlrltM4B0',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'sathiseller-975a6.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'sathiseller-975a6',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'sathiseller-975a6.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '479252024510',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:479252024510:web:8f452e0c0bcd417eb122ef',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-MZCMPHECE7',
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
