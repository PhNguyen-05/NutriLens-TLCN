const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');

const User = require('../models/User');
const OtpToken = require('../models/OtpToken');
const { hashValue, compareValue } = require('../utils/hash');
const { generateOtp, getOtpExpiry } = require('../utils/otp');
const { sendOtpEmail, sendSecurityAlertEmail } = require('../utils/mailer');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  signResetPasswordToken,
  verifyResetPasswordToken,
} = require('../utils/jwt');

const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MINUTES = 15;
const REFRESH_TOKEN_DAYS = 7;
const MAX_REFRESH_SESSIONS = 5; // giữ tối đa 5 phiên/thiết bị gần nhất

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// ===================== ĐĂNG KÝ (UC01) =====================

async function issueOtp(email, purpose) {
  await OtpToken.deleteMany({ email, purpose });

  const otp = generateOtp();
  const otpHash = await hashValue(otp);

  await OtpToken.create({
    email,
    otpHash,
    purpose,
    expiresAt: getOtpExpiry(),
  });

  await sendOtpEmail(email, otp, purpose);
}

// POST /api/auth/register
async function register(req, res) {
  try {
    const { fullName, email, password, confirmPassword, dateOfBirth, gender } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin bắt buộc' });
    }
    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ message: 'Mat khau xac nhan khong khop' });
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
    });

    await issueOtp(normalizedEmail, 'register');

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
    const record = await OtpToken.findOne({ email: normalizedEmail, purpose }).sort({
      createdAt: -1,
    });

    if (!record) {
      return res
        .status(400)
        .json({ message: 'Mã OTP không tồn tại hoặc đã hết hạn, vui lòng gửi lại mã' });
    }

    if (record.expiresAt < new Date() || record.attempts >= 5) {
      await OtpToken.deleteOne({ _id: record._id });
      return res.status(400).json({
        message: 'Mã OTP đã hết hạn hoặc nhập sai quá số lần cho phép, vui lòng gửi lại mã mới',
      });
    }

    const isMatch = await compareValue(otp, record.otpHash);

    if (!isMatch) {
      record.attempts += 1;
      await record.save();
      return res.status(400).json({ message: 'Mã OTP không chính xác' });
    }

    if (purpose === 'register') {
      await User.updateOne({ email: normalizedEmail }, { status: 'active' });
    }

    await OtpToken.deleteOne({ _id: record._id });

    // UC03: cấp resetToken tạm (10 phút) để FE dùng ở bước đặt mật khẩu mới,
    // tránh phải gửi lại OTP khi submit form mật khẩu mới
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
    const existing = await OtpToken.findOne({ email: normalizedEmail, purpose }).sort({
      createdAt: -1,
    });

    if (existing && existing.resendCount >= 3) {
      return res.status(429).json({
        message: 'Bạn đã yêu cầu gửi lại mã quá số lần cho phép, vui lòng thử lại sau 15 phút',
      });
    }

    const nextResendCount = existing ? existing.resendCount + 1 : 0;

    await issueOtp(normalizedEmail, purpose);
    await OtpToken.updateOne({ email: normalizedEmail, purpose }, { resendCount: nextResendCount });

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
    const { idToken } = req.body;
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
      user = await User.create({
        email: normalizedEmail,
        fullName: payload.name || normalizedEmail,
        avatarUrl: payload.picture || null,
        authProvider: 'google',
        status: 'active',
      });
    } else {
      if (user.status === 'pending') {
        user.status = 'active';
      }
      if (!user.avatarUrl && payload.picture) {
        user.avatarUrl = payload.picture;
      }
    }

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

// POST /api/auth/logout  (cần requireAuth ở route)
// Body: { refreshToken } - refresh token của phiên hiện tại cần vô hiệu hóa
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
    // UC04 - 6b/7b: lỗi kết nối khi gọi API đăng xuất phía server ->
    // vẫn trả 200 để FE luôn xóa token phía client, đảm bảo an toàn cho phiên làm việc
    console.error('[logout] Lỗi:', err.message);
    return res.status(200).json({ message: 'Đăng xuất thành công' });
  }
}

// ===================== ĐỔI MẬT KHẨU (UC05) =====================

// POST /api/auth/change-password  (cần requireAuth ở route)
// Body: { currentPassword, newPassword, confirmNewPassword, refreshToken? }
// refreshToken (tùy chọn): refresh token của phiên hiện tại, để giữ lại phiên này
// khi vô hiệu hóa các phiên khác theo UC05 - bước 9.
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

    // UC05 - đồng bộ chính sách khóa tạm với UC02: 5 lần sai -> khóa 15 phút
    if (user.lockUntil && user.lockUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockUntil - new Date()) / 60000);
      return res.status(423).json({
        message: `Chức năng đổi mật khẩu tạm khóa do nhập sai quá nhiều lần, vui lòng thử lại sau ${minutesLeft} phút`,
      });
    }

    const isMatch = await compareValue(currentPassword, user.password);

    if (!isMatch) {
      // UC05 - 6b/7b: sai mật khẩu hiện tại
      user.loginAttempts += 1;
      if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000);
        user.loginAttempts = 0;
      }
      await user.save();
      return res.status(401).json({ message: 'Mật khẩu hiện tại không đúng' });
    }

    if (!PASSWORD_REGEX.test(newPassword)) {
      // UC05 - 7c/8c
      return res.status(400).json({
        message: 'Mật khẩu mới phải có tối thiểu 8 ký tự gồm chữ, số và ký tự đặc biệt',
      });
    }
    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: 'Mật khẩu xác nhận không khớp' });
    }

    const isSameAsOld = await compareValue(newPassword, user.password);
    if (isSameAsOld) {
      // UC05 - 7d/8d
      return res.status(400).json({ message: 'Mật khẩu mới phải khác mật khẩu hiện tại' });
    }

    user.password = await hashValue(newPassword);
    user.loginAttempts = 0;
    user.lockUntil = null;

    // UC05 - bước 9: vô hiệu hóa các phiên khác, chỉ giữ phiên hiện tại (nếu FE gửi refreshToken)
    if (refreshToken) {
      const currentHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash === currentHash);
    } else {
      user.refreshTokens = [];
    }

    await user.save();

    // UC05 - bước 10: gửi email cảnh báo bảo mật (không chặn response nếu gửi email lỗi)
    sendSecurityAlertEmail(
      user.email,
      'Mật khẩu tài khoản của bạn vừa được thay đổi. Nếu không phải bạn, hãy liên hệ quản trị viên ngay.'
    ).catch((err) => console.error('[changePassword] Gửi email cảnh báo thất bại:', err.message));

    return res.status(200).json({ message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    console.error('[changePassword] Lỗi:', err.message);
    return res.status(500).json({ message: 'Đổi mật khẩu thất bại, vui lòng thử lại' });
  }
}

// ===================== QUÊN MẬT KHẨU (UC03) =====================

// POST /api/auth/forgot-password
// Body: { email } -> gửi OTP (purpose 'reset') nếu email tồn tại
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Vui lòng nhập email' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    // UC03 - 4b/5b: đặc tả yêu cầu báo rõ email không tồn tại (khác UC02
    // vốn không tiết lộ, vì đây là bước khôi phục tài khoản của chính mình)
    if (!user) {
      return res.status(404).json({ message: 'Email không tồn tại trong hệ thống' });
    }

    if (user.authProvider !== 'local') {
      return res.status(400).json({
        message: 'Tài khoản này đăng nhập bằng Google, không thể đặt lại mật khẩu qua email',
      });
    }

    await issueOtp(normalizedEmail, 'reset');

    return res.status(200).json({
      message: 'Đã gửi mã OTP đến email của bạn',
      email: normalizedEmail,
    });
  } catch (err) {
    console.error('[forgotPassword] Lỗi:', err.message);
    return res.status(500).json({ message: 'Gửi mã xác nhận thất bại, vui lòng thử lại sau' });
  }
}

// POST /api/auth/reset-password
// Body: { email, resetToken, newPassword, confirmNewPassword }
// resetToken lấy từ response của /verify-otp (purpose 'reset')
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
      // Hết hạn 10 phút hoặc token sai -> UC03 tương tự nhánh OTP hết hạn
      return res
        .status(401)
        .json({ message: 'Yêu cầu đặt lại mật khẩu đã hết hạn, vui lòng thực hiện lại từ đầu' });
    }

    if (payload.email !== normalizedEmail) {
      return res.status(401).json({ message: 'Yêu cầu đặt lại mật khẩu không hợp lệ' });
    }

    if (!PASSWORD_REGEX.test(newPassword)) {
      // UC03 - 10e/11e
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

    user.password = await hashValue(newPassword);
    user.loginAttempts = 0;
    user.lockUntil = null;
    // Đặt lại mật khẩu -> vô hiệu hóa toàn bộ phiên đang đăng nhập (bảo mật)
    user.refreshTokens = [];

    await user.save();

    // UC03 - bước 12: đặt lại mật khẩu thành công
    return res.status(200).json({ message: 'Đặt lại mật khẩu thành công' });
  } catch (err) {
    console.error('[resetPassword] Lỗi:', err.message);
    return res.status(500).json({ message: 'Đặt lại mật khẩu thất bại, vui lòng thử lại' });
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
  changePassword,
  forgotPassword,
  resetPassword,
  issueOtp,
};
