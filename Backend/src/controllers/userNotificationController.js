import UserNotification from '../models/UserNotification.model.js';

// GET /api/user/notifications
export const getUserNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const limit = Math.min(Number(req.query.limit) || 50, 100);

    const notifications = await UserNotification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const unreadCount = await UserNotification.countDocuments({ userId, isRead: false });

    res.status(200).json({
      success: true,
      notifications,
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/user/notifications/unread-count
export const getUnreadNotificationCount = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const unreadCount = await UserNotification.countDocuments({ userId, isRead: false });
    res.status(200).json({ success: true, unreadCount });
  } catch (error) {
    next(error);
  }
};

// PUT /api/user/notifications/:id/read
export const markNotificationRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const notification = await UserNotification.findOneAndUpdate(
      { _id: id, userId },
      { $set: { isRead: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    const unreadCount = await UserNotification.countDocuments({ userId, isRead: false });

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      notification,
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/user/notifications/read-all
export const markAllNotificationsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;

    await UserNotification.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true } }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      unreadCount: 0,
    });
  } catch (error) {
    next(error);
  }
};
