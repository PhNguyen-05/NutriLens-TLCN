const express = require('express');
const router = express.Router();

const {
  register,
  verifyOtp,
  resendOtp,
  login,
  googleLogin,
  refreshAccessToken,
} = require('../controllers/authController');

const { authActionLimiter, otpResendLimiter, loginLimiter } = require('../middleware/rateLimiters');

// UC01: Đăng ký tài khoản
router.post('/register', authActionLimiter, register);

// UC01/UC03: Xác thực OTP (dùng chung, phân biệt bằng field "purpose")
router.post('/verify-otp', authActionLimiter, verifyOtp);

// UC01/UC03: Gửi lại mã OTP (giới hạn 3 lần/15 phút)
router.post('/resend-otp', otpResendLimiter, resendOtp);

// UC02: Đăng nhập Email/Mật khẩu
router.post('/login', loginLimiter, login);

// UC02: Đăng nhập bằng Google (idToken lấy từ Google Identity Services phía FE)
router.post('/google', loginLimiter, googleLogin);

// Làm mới access token bằng refresh token
router.post('/refresh-token', refreshAccessToken);

module.exports = router;