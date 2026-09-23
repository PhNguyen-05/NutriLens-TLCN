const rateLimit = require('express-rate-limit');

/**
 * UC02: khóa đăng nhập tạm 15 phút sau 5 lần sai liên tiếp.
 * Limiter này chặn ở tầng IP để hỗ trợ thêm (logic đếm loginAttempts theo
 * từng user vẫn nằm trong controller/login, xem bước Controller).
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  limit: 20, // giới hạn rộng hơn ở tầng IP, tránh chặn nhầm nhiều user chung mạng
  message: { message: 'Quá nhiều yêu cầu đăng nhập, vui lòng thử lại sau' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * UC01: giới hạn số lần gửi lại OTP - tối đa 3 lần / 15 phút.
 * Áp cho cả route resend-otp của đăng ký lẫn quên mật khẩu.
 */
const otpResendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  message: { message: 'Bạn đã yêu cầu gửi lại mã quá số lần cho phép, vui lòng thử lại sau 15 phút' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Giới hạn chung cho route đăng ký / quên mật khẩu để chống spam email.
 */
const authActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { message: 'Quá nhiều yêu cầu, vui lòng thử lại sau' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { loginLimiter, otpResendLimiter, authActionLimiter };