const express = require('express');
const router = express.Router();

const {
  register,
  verifyOtp,
  resendOtp,
  login,
  googleLogin,
  refreshAccessToken,
  logout,
  changePassword,
} = require('../controllers/authController');

const { authActionLimiter, otpResendLimiter, loginLimiter } = require('../middleware/rateLimiters');
const requireAuth = require('../middleware/auth');

// UC01: Đăng ký tài khoản
router.post('/register', authActionLimiter, register);

// UC01/UC03: Xác thực OTP (dùng chung, phân biệt bằng field "purpose")
router.post('/verify-otp', authActionLimiter, verifyOtp);

// UC01/UC03: Gửi lại mã OTP (giới hạn 3 lần/15 phút)
router.post('/resend-otp', otpResendLimiter, resendOtp);

// UC02: Đăng nhập Email/Mật khẩu
router.post('/login', loginLimiter, login);

// UC02: Đăng nhập bằng Google
router.post('/google', loginLimiter, googleLogin);

// Làm mới access token bằng refresh token
router.post('/refresh-token', refreshAccessToken);

// UC04: Đăng xuất - cần đã đăng nhập (có access token hợp lệ)
router.post('/logout', requireAuth, logout);

// UC05: Đổi mật khẩu - cần đã đăng nhập
router.post('/change-password', requireAuth, changePassword);

module.exports = router;