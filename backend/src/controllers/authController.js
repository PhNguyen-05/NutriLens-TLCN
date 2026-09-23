const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');

const User = require('../models/User');
const OtpToken = require('../models/OtpToken');
const { hashValue, compareValue } = require('../utils/hash');
const { generateOtp, getOtpExpiry } = require('../utils/otp');
const { sendOtpEmail } = require('../utils/mailer');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');

const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_MINUTES = 15;
const REFRESH_TOKEN_DAYS = 7;
const MAX_REFRESH_SESSIONS = 5; // giữ tối đa 5 phiên/thiết bị gần nhất

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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
    const { fullName, email, password, confirmPassword } = req.body;

    if (!fullName || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin' });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ message: 'Email không đúng định dạng' });
    }
    if (!PASSWORD_REGEX.test(password)) {
      return res.status(400).json({
        message: 'Mật khẩu phải có tối thiểu 8 ký tự gồm chữ, số và ký tự đặc biệt',
      });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Mật khẩu xác nhận không khớp' });
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

/**
 * Phát access token + refresh token cho user, lưu hash refresh token vào DB.
 * LƯU Ý: hàm này chỉ push vào user.refreshTokens, chưa gọi user.save() —
 * caller phải tự save() sau khi gọi hàm này.
 */
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
  return { id: user._id, fullName: user.fullName, email: user.email, role: user.role };
}

// POST /api/auth/login  (UC02 - luồng chính, nhánh email/password)
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    // Không tiết lộ email có tồn tại hay không -> cùng 1 thông báo (UC02 - 5c/6c)
    if (!user || user.authProvider !== 'local') {
      return res.status(401).json({ message: 'Sai email hoặc mật khẩu' });
    }

    // UC02 - 8c: đang trong thời gian khóa tạm do sai quá 5 lần
    if (user.lockUntil && user.lockUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockUntil - new Date()) / 60000);
      return res.status(423).json({
        message: `Tài khoản tạm khóa do nhập sai quá nhiều lần, vui lòng thử lại sau ${minutesLeft} phút`,
      });
    }

    const isMatch = await compareValue(password, user.password);

    if (!isMatch) {
      user.loginAttempts += 1;

      // UC02 - 7c/8c: đủ 5 lần sai liên tiếp -> khóa tạm 15 phút
      if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000);
        user.loginAttempts = 0; // đếm lại từ đầu cho lần khóa tiếp theo
      }

      await user.save();
      return res.status(401).json({ message: 'Sai email hoặc mật khẩu' });
    }

    // UC02 - 6d: tài khoản đã bị Admin khóa
    if (user.status === 'locked') {
      return res
        .status(403)
        .json({ message: 'Tài khoản của bạn đã bị khóa, vui lòng liên hệ quản trị viên' });
    }

    // Chưa xác thực OTP xong (UC01) thì chưa cho đăng nhập
    if (user.status === 'pending') {
      return res
        .status(403)
        .json({ message: 'Tài khoản chưa xác thực, vui lòng kiểm tra email để nhập mã OTP' });
    }

    // Đăng nhập đúng -> reset bộ đếm chống brute-force
    user.loginAttempts = 0;
    user.lockUntil = null;

    const { accessToken, refreshToken } = await issueTokens(user);
    await user.save();

    // UC02 - bước 9: FE dựa vào user.role để chuyển hướng User/Admin
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

// POST /api/auth/google  (UC02 - nhánh đăng nhập bằng Google)
// Body: { idToken } - idToken lấy từ Google Identity Services phía FE
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
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (err) {
      // UC02 - 5f: lỗi xác thực/timeout với Google
      return res.status(401).json({ message: 'Đăng nhập bằng Google thất bại, vui lòng thử lại' });
    }

    const normalizedEmail = payload.email.toLowerCase().trim();
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      // UC02 - 6a nhánh chưa tồn tại: tự tạo tài khoản mới, không cần mật khẩu
      user = await User.create({
        email: normalizedEmail,
        fullName: payload.name || normalizedEmail,
        avatarUrl: payload.picture || null,
        authProvider: 'google',
        status: 'active', // Google đã xác thực email, không cần OTP
      });
    }
    // UC02 - 6a nhánh đã tồn tại (kể cả đăng ký trước bằng Email/Mật khẩu):
    // liên kết đăng nhập vào tài khoản hiện có, không đổi authProvider

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
// Body: { refreshToken } -> trả về accessToken mới + refreshToken mới (xoay token)
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

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const stored = user.refreshTokens.find((t) => t.tokenHash === tokenHash);

    // Refresh token không nằm trong danh sách hợp lệ (đã đăng xuất/thu hồi) hoặc hết hạn
    if (!stored || stored.expiresAt < new Date()) {
      return res.status(401).json({ message: 'Refresh token không hợp lệ hoặc đã hết hạn' });
    }

    // Xoay refresh token: gỡ token cũ, phát token mới -> chống replay nếu token cũ bị lộ
    user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash !== tokenHash);
    const { accessToken, refreshToken: newRefreshToken } = await issueTokens(user);
    await user.save();

    return res.status(200).json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    console.error('[refreshAccessToken] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể làm mới token, vui lòng đăng nhập lại' });
  }
}

module.exports = {
  register,
  verifyOtp,
  resendOtp,
  login,
  googleLogin,
  refreshAccessToken,
  issueOtp,
};