const crypto = require('crypto');
const User = require('../models/User');
const { hashValue, compareValue } = require('../utils/hash');
const { sendSecurityAlertEmail } = require('../utils/mailer');
const { createNotification } = require('../services/notificationService');
const { verifyResetPasswordToken } = require('../utils/jwt');
const { issueOrUpdateOtp } = require('../services/otpService');

const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MINUTES = 15;

// ===================== ĐỔI MẬT KHẨU (UC05) =====================

/**
 * POST /api/auth/change-password
 * Yêu cầu: đã đăng nhập (requireAuth)
 * Body: { currentPassword, newPassword, confirmNewPassword, refreshToken? }
 */
async function changePassword(req, res) {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword, confirmNewPassword, refreshToken } = req.body;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
    }

    if (user.authProvider !== 'local') {
      return res
        .status(400)
        .json({ message: 'Tài khoản đăng nhập bằng Google không thể đổi mật khẩu tại đây' });
    }

    // Đồng bộ chính sách khóa tạm: 5 lần sai -> khóa 15 phút
    if (user.lockUntil && user.lockUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockUntil - new Date()) / 60000);
      return res.status(423).json({
        message: `Chức năng đổi mật khẩu tạm khóa do nhập sai quá nhiều lần, vui lòng thử lại sau ${minutesLeft} phút`,
      });
    }

    const isMatch = await compareValue(currentPassword, user.password);

    if (!isMatch) {
      user.loginAttempts += 1;
      if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000);
        user.loginAttempts = 0;
      }
      await user.save();
      return res.status(401).json({ message: 'Mật khẩu hiện tại không đúng' });
    }

    if (!PASSWORD_REGEX.test(newPassword)) {
      return res.status(400).json({
        message: 'Mật khẩu mới phải có tối thiểu 8 ký tự gồm chữ, số và ký tự đặc biệt',
      });
    }
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: 'Mật khẩu xác nhận không khớp' });
    }

    const isSameAsOld = await compareValue(newPassword, user.password);
    if (isSameAsOld) {
      return res.status(400).json({ message: 'Mật khẩu mới phải khác mật khẩu hiện tại' });
    }

    user.password = await hashValue(newPassword);
    user.loginAttempts = 0;
    user.lockUntil = null;

    // Vô hiệu hóa các phiên khác, chỉ giữ lại phiên hiện tại nếu có refreshToken gửi kèm
    if (refreshToken) {
      const currentHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash === currentHash);
    } else {
      user.refreshTokens = [];
    }

    await user.save();

    // Gửi email cảnh báo bảo mật và thông báo trong ứng dụng
    sendSecurityAlertEmail(
      user.email,
      'Mật khẩu tài khoản của bạn vừa được thay đổi. Nếu không phải bạn, hãy liên hệ quản trị viên ngay.'
    ).catch((err) => console.error('[changePassword] Gửi email cảnh báo thất bại:', err.message));

    createNotification({
      userId: user._id,
      title: 'Bảo mật: Mật khẩu đã được thay đổi',
      message: 'Mật khẩu tài khoản NutriLens của bạn vừa được cập nhật thành công. Nếu không phải bạn thực hiện, vui lòng liên hệ ngay với quản trị viên.',
      type: 'security',
      data: { link: '/profile' },
    }).catch(() => {});

    return res.status(200).json({ message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    console.error('[changePassword] Lỗi:', err.message);
    return res.status(500).json({ message: 'Đổi mật khẩu thất bại, vui lòng thử lại' });
  }
}

// ===================== QUÊN MẬT KHẨU (UC03) =====================

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * Tuân thủ OWASP Authentication Cheat Sheet: Trả về thông điệp trung tính chống Account Enumeration.
 */
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Vui lòng nhập email' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    const NEUTRAL_MESSAGE = 'Nếu email tồn tại trong hệ thống, mã xác thực OTP đã được gửi đến hộp thư của bạn.';

    // Nếu email không tồn tại hoặc tài khoản đăng nhập qua Google, không để lộ thông tin mà vẫn trả 200 trung tính
    if (!user || user.authProvider !== 'local') {
      return res.status(200).json({
        message: NEUTRAL_MESSAGE,
        email: normalizedEmail,
      });
    }

    const otpResult = await issueOrUpdateOtp({
      email: normalizedEmail,
      purpose: 'reset',
      isResend: false,
    });

    if (!otpResult.success) {
      return res.status(otpResult.status || 429).json({ message: otpResult.message });
    }

    return res.status(200).json({
      message: NEUTRAL_MESSAGE,
      email: normalizedEmail,
    });
  } catch (err) {
    console.error('[forgotPassword] Lỗi:', err.message);
    return res.status(500).json({ message: 'Gửi mã xác nhận thất bại, vui lòng thử lại sau' });
  }
}

// ===================== ĐẶT LẠI MẬT KHẨU (UC03) =====================

/**
 * POST /api/auth/reset-password
 * Body: { email, resetToken, newPassword, confirmNewPassword }
 */
async function resetPassword(req, res) {
  try {
    const { email, resetToken, newPassword, confirmNewPassword } = req.body;

    if (!email || !resetToken || !newPassword || !confirmNewPassword) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    let payload;
    try {
      payload = verifyResetPasswordToken(resetToken);
    } catch (err) {
      return res
        .status(401)
        .json({ message: 'Yêu cầu đặt lại mật khẩu đã hết hạn, vui lòng thực hiện lại từ đầu' });
    }

    if (payload.email !== normalizedEmail) {
      return res.status(401).json({ message: 'Yêu cầu đặt lại mật khẩu không hợp lệ' });
    }

    if (!PASSWORD_REGEX.test(newPassword)) {
      return res.status(400).json({
        message: 'Mật khẩu mới phải có tối thiểu 8 ký tự gồm chữ, số và ký tự đặc biệt',
      });
    }
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: 'Mật khẩu xác nhận không khớp' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
    }

    // Kiểm tra trùng mật khẩu cũ
    if (user.password) {
      const isSameAsOld = await compareValue(newPassword, user.password);
      if (isSameAsOld) {
        return res.status(400).json({ message: 'Mật khẩu mới không được trùng với mật khẩu cũ' });
      }
    }

    user.password = await hashValue(newPassword);
    user.loginAttempts = 0;
    user.lockUntil = null;
    // Đặt lại mật khẩu -> vô hiệu hóa toàn bộ phiên đang đăng nhập trên các thiết bị
    user.refreshTokens = [];

    await user.save();

    return res.status(200).json({ message: 'Đặt lại mật khẩu thành công' });
  } catch (err) {
    console.error('[resetPassword] Lỗi:', err.message);
    return res.status(500).json({ message: 'Đặt lại mật khẩu thất bại, vui lòng thử lại' });
  }
}

module.exports = {
  changePassword,
  forgotPassword,
  resetPassword,
};
