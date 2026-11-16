const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');

const User = require('../models/User');
const restoreExpiredAdminLock = require('../utils/adminLock');
const { hashValue, compareValue } = require('../utils/hash');
const { createWelcomeNotifications } = require('../services/notificationService');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  signResetPasswordToken,
} = require('../utils/jwt');
const { issueOrUpdateOtp, verifyOtpCode, issueOtp } = require('../services/otpService');
const {
  changePassword,
  forgotPassword,
  resetPassword,
} = require('./passwordController');

const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MINUTES = 15;
const REFRESH_TOKEN_DAYS = 7;
const MAX_REFRESH_SESSIONS = 5; // giữ tối đa 5 phiên/thiết bị gần nhất

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// ===================== ĐĂNG KÝ (UC01) =====================

// POST /api/auth/register
async function register(req, res) {
  try {
    const { fullName, email, password, confirmPassword, dateOfBirth, gender, healthDisclaimerAccepted } = req.body;

    if (!fullName || typeof fullName !== 'string' || !fullName.trim() || !email || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin bắt buộc' });
    }

    // Giới hạn độ dài fullName chống tràn database và vỡ giao diện
    if (fullName.trim().length > 70) {
      return res.status(400).json({ message: 'Họ và tên không được vượt quá 70 ký tự' });
    }

    if (healthDisclaimerAccepted === false) {
      return res.status(400).json({
        message: 'Bạn phải xác nhận đủ điều kiện sức khỏe (không mang thai, không cho con bú, không có bệnh nền) để đăng ký dịch vụ.',
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ message: 'Mật khẩu xác nhận không khớp' });
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: 'Email không đúng định dạng' });
    }

    if (!PASSWORD_REGEX.test(password)) {
      return res.status(400).json({
        message: 'Mật khẩu phải có tối thiểu 8 ký tự gồm chữ, số và ký tự đặc biệt',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({
        message: 'Email đã được sử dụng, vui lòng đăng nhập hoặc dùng email khác',
      });
    }

    const passwordHash = await hashValue(password);

    await User.create({
      email: normalizedEmail,
      password: passwordHash,
      fullName: fullName.trim(),
      dateOfBirth: dateOfBirth || null,
      gender: gender || null,
      authProvider: 'local',
      status: 'pending',
      healthDisclaimerAccepted: Boolean(healthDisclaimerAccepted),
    });

    const otpResult = await issueOrUpdateOtp({
      email: normalizedEmail,
      purpose: 'register',
      isResend: false,
    });

    if (!otpResult.success) {
      return res.status(otpResult.status || 429).json({ message: otpResult.message });
    }

    return res.status(201).json({
      message: 'Đăng ký thành công, vui lòng kiểm tra email để nhập mã OTP',
      email: normalizedEmail,
    });
  } catch (err) {
    console.error('[register] Lỗi:', err.message);
    return res.status(500).json({ message: 'Đăng ký thất bại, vui lòng thử lại sau' });
  }
}

// POST /api/auth/verify-otp
async function verifyOtp(req, res) {
  try {
    const { email, otp, purpose } = req.body;

    if (!email || !otp || !purpose) {
      return res.status(400).json({ message: 'Thiếu thông tin xác thực OTP' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const verifyResult = await verifyOtpCode({ email: normalizedEmail, purpose, otp });

    if (!verifyResult.success) {
      return res.status(verifyResult.status || 400).json({ message: verifyResult.message });
    }

    if (purpose === 'register') {
      const activeUser = await User.findOneAndUpdate({ email: normalizedEmail }, { status: 'active' }, { new: true });
      if (activeUser) {
        createWelcomeNotifications(activeUser._id).catch(() => {});
      }
    }

    // UC03: Cấp resetToken tạm (10 phút) để FE dùng ở bước đặt mật khẩu mới
    if (purpose === 'reset') {
      const resetToken = signResetPasswordToken({ email: normalizedEmail });
      return res.status(200).json({ message: 'Xác thực OTP thành công', resetToken });
    }

    return res.status(200).json({ message: 'Xác thực OTP thành công' });
  } catch (err) {
    console.error('[verifyOtp] Lỗi:', err.message);
    return res.status(500).json({ message: 'Xác thực thất bại, vui lòng thử lại sau' });
  }
}

// POST /api/auth/resend-otp
async function resendOtp(req, res) {
  try {
    const { email, purpose } = req.body;
    if (!email || !purpose) {
      return res.status(400).json({ message: 'Thiếu thông tin' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const otpResult = await issueOrUpdateOtp({
      email: normalizedEmail,
      purpose,
      isResend: true,
    });

    if (!otpResult.success) {
      return res.status(otpResult.status || 429).json({ message: otpResult.message });
    }

    return res.status(200).json({ message: 'Đã gửi lại mã OTP' });
  } catch (err) {
    console.error('[resendOtp] Lỗi:', err.message);
    return res.status(500).json({ message: 'Gửi lại mã thất bại, vui lòng thử lại' });
  }
}

// ===================== ĐĂNG NHẬP (UC02) =====================

async function issueTokens(user) {
  const accessToken = signAccessToken({ id: user._id.toString(), role: user.role });
  const refreshToken = signRefreshToken({ id: user._id.toString() });

  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  user.refreshTokens.push({
    tokenHash,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000),
  });

  if (user.refreshTokens.length > MAX_REFRESH_SESSIONS) {
    user.refreshTokens = user.refreshTokens.slice(-MAX_REFRESH_SESSIONS);
  }

  return { accessToken, refreshToken };
}

function buildUserResponse(user) {
  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone || '',
    dateOfBirth: user.dateOfBirth,
    gender: user.gender,
    avatarUrl: user.avatarUrl || null,
    role: user.role,
  };
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user || user.authProvider !== 'local') {
      return res.status(401).json({ message: 'Sai email hoặc mật khẩu' });
    }

    if (user.lockUntil && user.lockUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockUntil - new Date()) / 60000);
      return res.status(423).json({
        message: `Tài khoản tạm khóa do nhập sai quá nhiều lần, vui lòng thử lại sau ${minutesLeft} phút`,
      });
    }

    const isMatch = await compareValue(password, user.password);

    if (!isMatch) {
      user.loginAttempts += 1;

      if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000);
        user.loginAttempts = 0;
      }

      await user.save();
      return res.status(401).json({ message: 'Sai email hoặc mật khẩu' });
    }

    await restoreExpiredAdminLock(user);

    if (user.status === 'locked') {
      return res
        .status(403)
        .json({ message: 'Tài khoản của bạn đã bị khóa, vui lòng liên hệ quản trị viên' });
    }

    if (user.status === 'pending') {
      return res
        .status(403)
        .json({ message: 'Tài khoản chưa xác thực, vui lòng kiểm tra email để nhập mã OTP' });
    }

    user.loginAttempts = 0;
    user.lockUntil = null;

    const { accessToken, refreshToken } = await issueTokens(user);
    await user.save();

    return res.status(200).json({
      message: 'Đăng nhập thành công',
      accessToken,
      refreshToken,
      user: buildUserResponse(user),
    });
  } catch (err) {
    console.error('[login] Lỗi:', err.message);
    return res.status(500).json({ message: 'Đăng nhập thất bại, vui lòng thử lại sau' });
  }
}

// POST /api/auth/google
async function googleLogin(req, res) {
  try {
    const { idToken, healthDisclaimerAccepted } = req.body;
    if (!idToken) {
      return res.status(400).json({ message: 'Thiếu idToken Google' });
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (err) {
      console.error('[googleLogin] verifyIdToken error:', err.message);
      return res.status(401).json({ message: 'Đăng nhập bằng Google thất bại, vui lòng thử lại' });
    }

    const normalizedEmail = payload.email.toLowerCase().trim();
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      // Người dùng mới tạo tài khoản lần đầu qua Google:
      // Bắt buộc phải xác nhận tiêu chuẩn đối tượng sử dụng (Y tế) trước khi lưu vào DB.
      if (!healthDisclaimerAccepted) {
        return res.status(200).json({
          requiresHealthDisclaimer: true,
          email: normalizedEmail,
          fullName: payload.name || normalizedEmail,
          avatarUrl: payload.picture || null,
        });
      }

      user = await User.create({
        email: normalizedEmail,
        fullName: payload.name || normalizedEmail,
        avatarUrl: payload.picture || null,
        authProvider: 'google',
        status: 'active',
        healthDisclaimerAccepted: true,
      });
      createWelcomeNotifications(user._id).catch(() => {});
    } else {
      if (user.status === 'pending') {
        user.status = 'active';
      }
      if (!user.avatarUrl && payload.picture) {
        user.avatarUrl = payload.picture;
      }
    }

    await restoreExpiredAdminLock(user);

    if (user.status === 'locked') {
      return res
        .status(403)
        .json({ message: 'Tài khoản của bạn đã bị khóa, vui lòng liên hệ quản trị viên' });
    }

    const { accessToken, refreshToken } = await issueTokens(user);
    await user.save();

    return res.status(200).json({
      message: 'Đăng nhập bằng Google thành công',
      accessToken,
      refreshToken,
      user: buildUserResponse(user),
    });
  } catch (err) {
    console.error('[googleLogin] Lỗi:', err.message);
    return res.status(500).json({ message: 'Đăng nhập thất bại, vui lòng thử lại sau' });
  }
}

// POST /api/auth/refresh-token
async function refreshAccessToken(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'Thiếu refresh token' });
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (err) {
      return res.status(401).json({ message: 'Refresh token không hợp lệ hoặc đã hết hạn' });
    }

    const user = await User.findById(payload.id);
    if (!user) {
      return res.status(401).json({ message: 'Refresh token không hợp lệ' });
    }

    await restoreExpiredAdminLock(user);

    if (user.status === 'locked') {
      user.refreshTokens = [];
      await user.save();
      return res
        .status(403)
        .json({ message: 'Tài khoản của bạn đã bị khóa, vui lòng liên hệ quản trị viên' });
    }

    if (user.status === 'pending') {
      return res
        .status(403)
        .json({ message: 'Tài khoản chưa xác thực, vui lòng kiểm tra email để nhập mã OTP' });
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const stored = user.refreshTokens.find((t) => t.tokenHash === tokenHash);

    if (!stored || stored.expiresAt < new Date()) {
      return res.status(401).json({ message: 'Refresh token không hợp lệ hoặc đã hết hạn' });
    }

    // Refresh Token Rotation: Xóa token cũ và cấp phát cặp token mới
    user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash !== tokenHash);
    const { accessToken, refreshToken: newRefreshToken } = await issueTokens(user);
    await user.save();

    return res.status(200).json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    console.error('[refreshAccessToken] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể làm mới token, vui lòng đăng nhập lại' });
  }
}

// ===================== ĐĂNG XUẤT (UC04) =====================

// POST /api/auth/logout (cần requireAuth ở route)
async function logout(req, res) {
  const userId = req.user && req.user.id;
  const { refreshToken } = req.body;

  try {
    if (userId && refreshToken) {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await User.updateOne({ _id: userId }, { $pull: { refreshTokens: { tokenHash } } });
    }

    return res.status(200).json({ message: 'Đăng xuất thành công' });
  } catch (err) {
    console.error('[logout] Lỗi:', err.message);
    return res.status(200).json({ message: 'Đăng xuất thành công' });
  }
}

module.exports = {
  register,
  verifyOtp,
  resendOtp,
  login,
  googleLogin,
  refreshAccessToken,
  logout,
  // Re-export để tương thích backward
  changePassword,
  forgotPassword,
  resetPassword,
  issueOtp,
};
