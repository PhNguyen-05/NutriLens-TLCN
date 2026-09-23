const User = require('../models/User');
const OtpToken = require('../models/OtpToken');
const { hashValue, compareValue } = require('../utils/hash');
const { generateOtp, getOtpExpiry } = require('../utils/otp');
const { sendOtpEmail } = require('../utils/mailer');

const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Hàm dùng chung: xoá OTP cũ (vô hiệu hoá), sinh OTP mới và gửi email.
 * Dùng lại cho cả register (UC01) và forgot-password (UC03) sau này.
 */
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

// POST /api/auth/register  (UC01 - bước 1 -> 7)
async function register(req, res) {
  try {
    const { fullName, email, password, confirmPassword } = req.body;

    if (!fullName || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin' });
    }
    if (!EMAIL_REGEX.test(email)) {
      // UC01 - 3b/4b
      return res.status(400).json({ message: 'Email không đúng định dạng' });
    }
    if (!PASSWORD_REGEX.test(password)) {
      // UC01 - 3c/4c
      return res.status(400).json({
        message: 'Mật khẩu phải có tối thiểu 8 ký tự gồm chữ, số và ký tự đặc biệt',
      });
    }
    if (password !== confirmPassword) {
      // UC01 - 3d/4d
      return res.status(400).json({ message: 'Mật khẩu xác nhận không khớp' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      // UC01 - 5e: email đã tồn tại (kể cả đăng ký trước đó bằng Google)
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
      status: 'pending', // chờ xác thực OTP (UC01)
    });

    await issueOtp(normalizedEmail, 'register');

    // UC01 - bước 8: yêu cầu nhập OTP
    return res.status(201).json({
      message: 'Đăng ký thành công, vui lòng kiểm tra email để nhập mã OTP',
      email: normalizedEmail,
    });
  } catch (err) {
    // UC01 - 6h: lỗi kết nối DB khi lưu tài khoản
    console.error('[register] Lỗi:', err.message);
    return res.status(500).json({ message: 'Đăng ký thất bại, vui lòng thử lại sau' });
  }
}

// POST /api/auth/verify-otp  (UC01 - bước 9 -> 12, dùng chung cho UC03)
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

    // UC01 - 10g: hết hạn hoặc sai quá 5 lần liên tiếp
    if (record.expiresAt < new Date() || record.attempts >= 5) {
      await OtpToken.deleteOne({ _id: record._id });
      return res.status(400).json({
        message: 'Mã OTP đã hết hạn hoặc nhập sai quá số lần cho phép, vui lòng gửi lại mã mới',
      });
    }

    const isMatch = await compareValue(otp, record.otpHash);

    if (!isMatch) {
      // UC01 - 10f
      record.attempts += 1;
      await record.save();
      return res.status(400).json({ message: 'Mã OTP không chính xác' });
    }

    if (purpose === 'register') {
      // UC01 - bước 11: kích hoạt tài khoản
      await User.updateOne({ email: normalizedEmail }, { status: 'active' });
    }

    await OtpToken.deleteOne({ _id: record._id }); // vô hiệu hoá OTP đã dùng

    return res.status(200).json({ message: 'Xác thực OTP thành công' });
  } catch (err) {
    console.error('[verifyOtp] Lỗi:', err.message);
    return res.status(500).json({ message: 'Xác thực thất bại, vui lòng thử lại sau' });
  }
}

// POST /api/auth/resend-otp  (UC01 - nhánh 9a, tối đa 3 lần / 15 phút)
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

module.exports = { register, verifyOtp, resendOtp, issueOtp };