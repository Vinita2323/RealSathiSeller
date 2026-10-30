import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded from Backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Loads Firebase Service Account credentials purely from environment variables.
 */
export const getFirebaseCredentials = () => {
  // Option 1: Full JSON string from FIREBASE_CONFIG
  if (process.env.FIREBASE_CONFIG) {
    try {
      const config = typeof process.env.FIREBASE_CONFIG === 'string'
        ? JSON.parse(process.env.FIREBASE_CONFIG)
        : process.env.FIREBASE_CONFIG;

      if (config.private_key && typeof config.private_key === 'string') {
        config.private_key = config.private_key.replace(/\\n/g, '\n');
      }
      return config;
    } catch (err) {
      console.warn('[FCM Config] Failed to parse process.env.FIREBASE_CONFIG:', err.message);
    }
  }

  // Option 2: Individual environment variables
  if (process.env.FIREBASE_PROJECT_ID && (process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_CLIENT_EMAIL)) {
    return {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || '',
      private_key: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL || '',
      client_id: process.env.FIREBASE_CLIENT_ID || '',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.FIREBASE_CLIENT_EMAIL || '')}`,
      universe_domain: 'googleapis.com',
    };
  }

  return null;
};

export default getFirebaseCredentials;
