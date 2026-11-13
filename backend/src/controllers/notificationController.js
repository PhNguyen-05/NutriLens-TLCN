const Notification = require('../models/Notification');

/**
 * Lấy danh sách thông báo của người dùng hiện tại
 * Hỗ trợ phân trang và lọc chưa đọc
 */
async function getNotifications(req, res) {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const filter = String(req.query.filter || 'all').toLowerCase();

    // Nếu người dùng chưa từng có thông báo nào, tạo thông báo chào mừng & lời nhắc khởi đầu
    const totalExisting = await Notification.countDocuments({ userId });
    if (totalExisting === 0) {
      await Notification.insertMany([
        {
          userId,
          title: 'Chào mừng bạn đến với NutriLens! 🎉',
          message: 'NutriLens đồng hành cùng bạn trên hành trình chăm sóc sức khỏe, theo dõi dinh dưỡng và cân bằng calo mỗi ngày.',
          type: 'system',
          data: { link: '/' },
          isRead: false,
        },
        {
          userId,
          title: 'Trải nghiệm AI Lens Quét Món Ăn 📸',
          message: 'Chụp hoặc tải ảnh bữa ăn để công nghệ AI tự động nhận diện món ăn và tính toán dinh dưỡng tức thì.',
          type: 'reminder',
          data: { link: '/food-scan' },
          isRead: false,
        },
        {
          userId,
          title: 'Nhắc nhở duy trì lối sống lành mạnh 💧',
          message: 'Đừng quên uống đủ 2 lít nước và ghi nhận nhật ký bữa ăn hôm nay để hoàn thành mục tiêu nhé!',
          type: 'reminder',
          data: { link: '/meal-diary' },
          isRead: false,
        },
      ]);
    }

    const query = { userId };
    if (filter === 'unread') {
      query.isRead = false;
    }

    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ userId, isRead: false }),
    ]);

    return res.status(200).json({
      success: true,
      data: notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
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
 * Lấy số lượng thông báo chưa đọc
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
 */
async function markAsRead(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

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
 * Xóa một thông báo
 */
async function deleteNotification(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

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
