import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { getFirebaseCredentials } from '../config/firebase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let firebaseApp = null;
let messagingInstance = null;
let isFirebaseInitialized = false;

// Initialize Firebase Admin SDK based on SOP
try {
  let credential = null;
  const config = getFirebaseCredentials();

  if (config && config.project_id && config.private_key) {
    credential = cert(config);
    console.log('✅ [FCM] Loaded Firebase credentials directly from environment variable');
  } else {
    // Fallback check for service account file if path explicitly given
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH 
      ? path.resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
      : path.resolve(__dirname, '../../config/firebase-service-account.json');

    if (fs.existsSync(serviceAccountPath)) {
      try {
        const serviceAccountRaw = fs.readFileSync(serviceAccountPath, 'utf8');
        const serviceAccount = JSON.parse(serviceAccountRaw);
        if (serviceAccount && serviceAccount.project_id && serviceAccount.private_key && !serviceAccount.private_key.includes('YOUR_PRIVATE_KEY')) {
          if (typeof serviceAccount.private_key === 'string') {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
          }
          credential = cert(serviceAccount);
        }
      } catch (e) {}
    }
  }

  if (credential) {
    if (getApps().length === 0) {
      firebaseApp = initializeApp({ credential });
    } else {
      firebaseApp = getApps()[0];
    }
    messagingInstance = getMessaging(firebaseApp);
    isFirebaseInitialized = true;
    console.log('✅ [FCM] Firebase Admin SDK initialized successfully');
  } else {
    console.log('ℹ️ [FCM Info] Firebase credentials in dummy/log mode. Ready for live Firebase service account key.');
  }
} catch (error) {
  console.warn('ℹ️ [FCM Setup Info]:', error.message);
}

/**
 * Send push notification to multiple tokens (SOP Standard)
 * @param {string[]} tokens Array of FCM device tokens
 * @param {object} payload { title, body, data, icon }
 */
export async function sendPushNotification(tokens, payload) {
  try {
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    // Filter valid non-empty tokens
    const validTokens = [...new Set(tokens.filter(t => typeof t === 'string' && t.trim().length > 0))];
    if (validTokens.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    if (!isFirebaseInitialized || !messagingInstance) {
      console.log(`📡 [FCM Push Notification Simulated] Target Tokens (${validTokens.length}):`, {
        title: payload.title,
        body: payload.body,
        data: payload.data,
      });
      return {
        successCount: validTokens.length,
        failureCount: 0,
        mock: true,
      };
    }

    const message = {
      notification: {
        title: payload.title || 'Sathi Seller Notification',
        body: payload.body || '',
      },
      data: payload.data ? Object.fromEntries(
        Object.entries(payload.data).map(([k, v]) => [k, String(v)])
      ) : {},
      tokens: validTokens,
    };

    if (payload.icon) {
      message.notification.imageUrl = payload.icon;
    }

    const response = await messagingInstance.sendEachForMulticast(message);
    console.log(`✅ [FCM] Sent: ${response.successCount} messages, Failed: ${response.failureCount} messages`);
    
    return response;
  } catch (error) {
    console.error('❌ [FCM Error sending notification]:', error.message);
    return { successCount: 0, failureCount: tokens.length, error: error.message };
  }
}

export default {
  sendPushNotification,
};
