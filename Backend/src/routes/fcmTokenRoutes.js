import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import User from '../models/User.model.js';
import Seller from '../models/Seller.model.js';
import Captain from '../models/Captain.model.js';
import { sendPushNotification } from '../services/firebaseAdmin.js';

const router = express.Router();

// Helper to get entity model based on authenticated user role
const getEntityModel = (role) => {
  if (role === 'seller') return Seller;
  if (role === 'captain') return Captain;
  return User;
};

// ──────────────────────────────────────────────
// POST /api/fcm-tokens/save or POST /api/fcm-tokens
// Save Web FCM Token (Max 10 per account as per SOP)
// ──────────────────────────────────────────────
router.post(['/save', '/'], protect(), async (req, res) => {
  try {
    const { token, platform = 'web' } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role || 'user';

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, message: 'Valid FCM token is required' });
    }

    const Model = getEntityModel(userRole);
    const entity = await Model.findById(userId);

    if (!entity) {
      return res.status(404).json({ success: false, message: `${userRole} record not found` });
    }

    if (platform === 'web') {
      if (!entity.fcmTokens) entity.fcmTokens = [];
      if (!entity.fcmTokens.includes(token)) {
        entity.fcmTokens.push(token);
        // Limit to 10 tokens as per SOP
        if (entity.fcmTokens.length > 10) {
          entity.fcmTokens = entity.fcmTokens.slice(-10);
        }
      }
    } else if (platform === 'mobile') {
      if (!entity.fcmTokenMobile) entity.fcmTokenMobile = [];
      if (!entity.fcmTokenMobile.includes(token)) {
        entity.fcmTokenMobile.push(token);
        // Limit to 10 tokens as per SOP
        if (entity.fcmTokenMobile.length > 10) {
          entity.fcmTokenMobile = entity.fcmTokenMobile.slice(-10);
        }
      }
    }

    await entity.save();
    console.log(`✅ [FCM] Saved ${platform} token for ${userRole} ${userId}`);

    res.json({ success: true, message: 'FCM token saved successfully' });
  } catch (error) {
    console.error('❌ [FCM Save Error]:', error);
    res.status(500).json({ success: false, error: 'Failed to save token' });
  }
});

// ──────────────────────────────────────────────
// POST /api/fcm-tokens/mobile/save
// Save Mobile FCM Token (Max 10 per account as per SOP)
// ──────────────────────────────────────────────
router.post('/mobile/save', protect(), async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role || 'user';

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, message: 'Valid FCM token is required' });
    }

    const Model = getEntityModel(userRole);
    const entity = await Model.findById(userId);

    if (!entity) {
      return res.status(404).json({ success: false, message: `${userRole} record not found` });
    }

    if (!entity.fcmTokenMobile) entity.fcmTokenMobile = [];
    if (!entity.fcmTokenMobile.includes(token)) {
      entity.fcmTokenMobile.push(token);
      if (entity.fcmTokenMobile.length > 10) {
        entity.fcmTokenMobile = entity.fcmTokenMobile.slice(-10);
      }
    }

    await entity.save();
    console.log(`✅ [FCM] Saved mobile token for ${userRole} ${userId}`);

    res.json({ success: true, message: 'Mobile FCM token saved successfully' });
  } catch (error) {
    console.error('❌ [FCM Mobile Save Error]:', error);
    res.status(500).json({ success: false, error: 'Failed to save mobile token' });
  }
});

// ──────────────────────────────────────────────
// DELETE /api/fcm-tokens/remove
// Remove FCM Token (e.g. on logout)
// ──────────────────────────────────────────────
router.delete('/remove', protect(), async (req, res) => {
  try {
    const { token, platform = 'web' } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role || 'user';

    const Model = getEntityModel(userRole);
    const entity = await Model.findById(userId);

    if (entity) {
      if (platform === 'web' && entity.fcmTokens) {
        entity.fcmTokens = entity.fcmTokens.filter(t => t !== token);
      } else if (platform === 'mobile' && entity.fcmTokenMobile) {
        entity.fcmTokenMobile = entity.fcmTokenMobile.filter(t => t !== token);
      }
      await entity.save();
      console.log(`🗑️ [FCM] Removed ${platform} token for ${userRole} ${userId}`);
    }

    res.json({ success: true, message: 'FCM token removed successfully' });
  } catch (error) {
    console.error('❌ [FCM Remove Error]:', error);
    res.status(500).json({ success: false, error: 'Failed to remove token' });
  }
});

// ──────────────────────────────────────────────
// POST /api/fcm-tokens/test
// Test Push Notification Sending
// ──────────────────────────────────────────────
router.post('/test', protect(), async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role || 'user';

    const Model = getEntityModel(userRole);
    const entity = await Model.findById(userId);

    if (!entity) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const tokens = [
      ...(entity.fcmTokens || []),
      ...(entity.fcmTokenMobile || [])
    ];
    const uniqueTokens = [...new Set(tokens)];

    if (uniqueTokens.length === 0) {
      return res.json({
        success: false,
        message: 'No registered FCM tokens found for this account. Please enable browser notifications.',
      });
    }

    const response = await sendPushNotification(uniqueTokens, {
      title: '🔔 Sathi Seller Test Notification',
      body: `Hello ${entity.name || 'Partner'}, FCM push notifications are working perfectly!`,
      data: {
        type: 'test',
        link: '/',
        timestamp: String(Date.now()),
      },
    });

    res.json({
      success: true,
      message: 'Test push notification dispatched successfully',
      response,
    });
  } catch (error) {
    console.error('❌ [FCM Test Error]:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
