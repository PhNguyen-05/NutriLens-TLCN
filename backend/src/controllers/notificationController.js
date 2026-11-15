const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const { createWelcomeNotifications } = require('../services/notificationService');

/**
 * Lấy danh sách thông báo của người dùng hiện tại theo phân trang chuẩn thương mại
 * GET /api/notifications?page=1&limit=20
 */
async function getNotifications(req, res) {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

    // Khởi tạo thông báo chào mừng 1 lần duy nhất cho tài khoản chưa từng nhận
    await createWelcomeNotifications(userId);

    const query = { userId };
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ userId, isRead: false }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;
    const hasMore = skip + notifications.length < total;

    return res.status(200).json({
      success: true,
      data: notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore,
      },
    });
  } catch (error) {
    console.error('[getNotifications] Lỗi:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Không thể tải danh sách thông báo, vui lòng thử lại sau',
    });
  }
}

/**
 * Lấy số lượng thông báo chưa đọc (endpoint siêu nhẹ cho header polling)
 * GET /api/notifications/unread-count
 */
async function getUnreadCount(req, res) {
  try {
    const userId = req.user.id;
    const unreadCount = await Notification.countDocuments({ userId, isRead: false });

    return res.status(200).json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    console.error('[getUnreadCount] Lỗi:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Không thể lấy số lượng thông báo chưa đọc',
    });
  }
}

/**
 * Đánh dấu 1 thông báo là đã đọc
 * PATCH /api/notifications/:id/read
 */
async function markAsRead(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Mã thông báo không hợp lệ',
      });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { $set: { isRead: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông báo',
      });
    }

    const unreadCount = await Notification.countDocuments({ userId, isRead: false });

    return res.status(200).json({
      success: true,
      data: notification,
      unreadCount,
      message: 'Đã đánh dấu thông báo là đã đọc',
    });
  } catch (error) {
    console.error('[markAsRead] Lỗi:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Không thể cập nhật trạng thái thông báo',
    });
  }
}

/**
 * Đánh dấu tất cả thông báo của người dùng là đã đọc
 * PATCH /api/notifications/read-all
 */
async function markAllAsRead(req, res) {
  try {
    const userId = req.user.id;

    await Notification.updateMany({ userId, isRead: false }, { $set: { isRead: true } });

    return res.status(200).json({
      success: true,
      unreadCount: 0,
      message: 'Đã đánh dấu tất cả thông báo là đã đọc',
    });
  } catch (error) {
    console.error('[markAllAsRead] Lỗi:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Không thể cập nhật tất cả thông báo',
    });
  }
}

/**
 * Xóa một thông báo của người dùng
 * DELETE /api/notifications/:id
 */
async function deleteNotification(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Mã thông báo không hợp lệ',
      });
    }

    const notification = await Notification.findOneAndDelete({ _id: id, userId });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông báo cần xóa',
      });
    }

    const unreadCount = await Notification.countDocuments({ userId, isRead: false });

    return res.status(200).json({
      success: true,
      unreadCount,
      message: 'Đã xóa thông báo thành công',
    });
  } catch (error) {
    console.error('[deleteNotification] Lỗi:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Không thể xóa thông báo',
    });
  }
}

/**
 * Xóa toàn bộ thông báo của người dùng
 * DELETE /api/notifications/clear-all
 */
async function deleteAllNotifications(req, res) {
  try {
    const userId = req.user.id;

    await Notification.deleteMany({ userId });

    return res.status(200).json({
      success: true,
      unreadCount: 0,
      message: 'Đã xóa tất cả thông báo thành công',
    });
  } catch (error) {
    console.error('[deleteAllNotifications] Lỗi:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Không thể xóa toàn bộ thông báo',
    });
  }
}

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
};
