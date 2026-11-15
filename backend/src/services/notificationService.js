const Notification = require('../models/Notification');

/**
 * Service quản lý thông báo theo chuẩn nghiệp vụ thương mại
 */

/**
 * Tạo một thông báo mới cho người dùng
 * @param {Object} params
 * @param {string|ObjectId} params.userId - Người nhận thông báo
 * @param {string} params.title - Tiêu đề thông báo
 * @param {string} params.message - Nội dung thông báo
 * @param {string} [params.type='system'] - Phân loại thông báo
 * @param {Object} [params.data={}] - Dữ liệu bổ sung (link điều hướng, metadata)
 */
async function createNotification({ userId, title, message, type = 'system', data = {} }) {
  try {
    if (!userId || !title || !message) {
      return null;
    }

    // Nghiệp vụ chống spam: nếu cùng người dùng nhận thông báo like cho cùng 1 bài viết trong 5 phút
    if (type === 'community_like' && data.postId) {
      const recentLike = await Notification.findOne({
        userId,
        type: 'community_like',
        'data.postId': data.postId,
        createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) },
      });
      if (recentLike) {
        return recentLike;
      }
    }

    const notification = await Notification.create({
      userId,
      title: String(title).trim(),
      message: String(message).trim(),
      type,
      data,
      isRead: false,
    });

    return notification;
  } catch (error) {
    console.error('[createNotification] Lỗi:', error.message);
    return null;
  }
}

/**
 * Khởi tạo gói thông báo chào mừng & hướng dẫn trải nghiệm cho tài khoản mới
 * Đảm bảo chỉ gửi 1 lần duy nhất trong vòng đời tài khoản
 * @param {string|ObjectId} userId
 */
async function createWelcomeNotifications(userId) {
  try {
    if (!userId) return;

    // Kiểm tra xem đã từng nhận thông báo chào mừng chưa
    const existing = await Notification.findOne({
      userId,
      'data.isWelcome': true,
    });

    if (existing) return;

    await Notification.insertMany([
      {
        userId,
        title: 'Chào mừng bạn đến với NutriLens! 🎉',
        message: 'NutriLens đồng hành cùng bạn trên hành trình chăm sóc sức khỏe, theo dõi dinh dưỡng và cân bằng calo mỗi ngày.',
        type: 'system',
        data: { link: '/', isWelcome: true },
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
        title: 'Khởi đầu nhật ký dinh dưỡng 🥗',
        message: 'Ghi lại các bữa ăn hàng ngày để NutriLens giúp bạn theo dõi tiến trình và đạt được mục tiêu sức khỏe.',
        type: 'reminder',
        data: { link: '/meal-diary' },
        isRead: false,
      },
    ]);
  } catch (error) {
    console.error('[createWelcomeNotifications] Lỗi:', error.message);
  }
}

module.exports = {
  createNotification,
  createWelcomeNotifications,
};
