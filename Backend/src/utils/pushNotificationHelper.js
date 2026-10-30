import { sendPushNotification } from '../services/firebaseAdmin.js';
import User from '../models/User.model.js';
import Seller from '../models/Seller.model.js';
import Captain from '../models/Captain.model.js';

/**
 * Send push notification to a Customer / User (SOP Standard)
 * @param {string} userId
 * @param {object} payload { title, body, data, icon }
 * @param {boolean} includeMobile
 */
export async function sendNotificationToUser(userId, payload, includeMobile = true) {
  try {
    if (!userId) return;
    const user = await User.findById(userId);
    if (!user) {
      console.warn(`[FCM User] User ${userId} not found for notification`);
      return;
    }

    let tokens = [];
    if (user.fcmTokens && user.fcmTokens.length > 0) {
      tokens = [...tokens, ...user.fcmTokens];
    }
    if (includeMobile && user.fcmTokenMobile && user.fcmTokenMobile.length > 0) {
      tokens = [...tokens, ...user.fcmTokenMobile];
    }

    const uniqueTokens = [...new Set(tokens)];
    if (uniqueTokens.length === 0) {
      console.log(`[FCM User] No FCM tokens registered for user: ${userId}`);
      return;
    }

    await sendPushNotification(uniqueTokens, payload);
  } catch (error) {
    console.error(`[FCM User Error] Failed to send notification to user ${userId}:`, error.message);
  }
}

/**
 * Send push notification to a Merchant / Seller (SOP Standard)
 * @param {string} sellerId
 * @param {object} payload { title, body, data, icon }
 * @param {boolean} includeMobile
 */
export async function sendNotificationToSeller(sellerId, payload, includeMobile = true) {
  try {
    if (!sellerId) return;
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      console.warn(`[FCM Seller] Seller ${sellerId} not found for notification`);
      return;
    }

    let tokens = [];
    if (seller.fcmTokens && seller.fcmTokens.length > 0) {
      tokens = [...tokens, ...seller.fcmTokens];
    }
    if (includeMobile && seller.fcmTokenMobile && seller.fcmTokenMobile.length > 0) {
      tokens = [...tokens, ...seller.fcmTokenMobile];
    }

    const uniqueTokens = [...new Set(tokens)];
    if (uniqueTokens.length === 0) {
      console.log(`[FCM Seller] No FCM tokens registered for seller: ${sellerId}`);
      return;
    }

    await sendPushNotification(uniqueTokens, payload);
  } catch (error) {
    console.error(`[FCM Seller Error] Failed to send notification to seller ${sellerId}:`, error.message);
  }
}

/**
 * Send push notification to a Delivery Captain (SOP Standard)
 * @param {string} captainId
 * @param {object} payload { title, body, data, icon }
 * @param {boolean} includeMobile
 */
export async function sendNotificationToCaptain(captainId, payload, includeMobile = true) {
  try {
    if (!captainId) return;
    const captain = await Captain.findById(captainId);
    if (!captain) {
      console.warn(`[FCM Captain] Captain ${captainId} not found for notification`);
      return;
    }

    let tokens = [];
    if (captain.fcmTokens && captain.fcmTokens.length > 0) {
      tokens = [...tokens, ...captain.fcmTokens];
    }
    if (includeMobile && captain.fcmTokenMobile && captain.fcmTokenMobile.length > 0) {
      tokens = [...tokens, ...captain.fcmTokenMobile];
    }

    const uniqueTokens = [...new Set(tokens)];
    if (uniqueTokens.length === 0) {
      console.log(`[FCM Captain] No FCM tokens registered for captain: ${captainId}`);
      return;
    }

    await sendPushNotification(uniqueTokens, payload);
  } catch (error) {
    console.error(`[FCM Captain Error] Failed to send notification to captain ${captainId}:`, error.message);
  }
}

export default {
  sendNotificationToUser,
  sendNotificationToSeller,
  sendNotificationToCaptain,
};
