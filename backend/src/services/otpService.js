const OtpToken = require('../models/OtpToken');
const { generateOtp, getOtpExpiry } = require('../utils/otp');
const { hashValue, compareValue } = require('../utils/hash');
const { sendOtpEmail } = require('../utils/mailer');

const RATE_LIMIT_WINDOW_MINUTES = 15;
const MAX_RESEND_COUNT = 3;
const MAX_ATTEMPTS = 5;

/**
 * Cấp phát hoặc làm mới mã OTP với cơ chế chống Race Condition
 * và bảo toàn biến đếm resendCount trong cửa sổ 15 phút.
 *
 * @param {Object} params
 * @param {string} params.email - Địa chỉ email nhận OTP
 * @param {'register'|'reset'} params.purpose - Mục đích OTP
 * @param {boolean} [params.isResend=false] - Cờ gửi lại mã
 */
async function issueOrUpdateOtp({ email, purpose, isResend = false }) {
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date();

  const existing = await OtpToken.findOne({ email: normalizedEmail, purpose });

  let nextResendCount = 0;
  let windowExpiresAt = new Date(now.getTime() + RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);

  if (isResend) {
    if (existing && existing.windowExpiresAt && existing.windowExpiresAt > now) {
      if (existing.resendCount >= MAX_RESEND_COUNT) {
        return {
          success: false,
          status: 429,
          message: 'Bạn đã yêu cầu gửi lại mã quá số lần cho phép, vui lòng thử lại sau 15 phút',
        };
      }
      nextResendCount = (existing.resendCount || 0) + 1;
      windowExpiresAt = existing.windowExpiresAt;
    } else {
      nextResendCount = 1;
    }
  } else {
    // Trường hợp tạo mã ban đầu (register hoặc forgot-password)
    if (existing && existing.windowExpiresAt && existing.windowExpiresAt > now) {
      if (existing.resendCount >= MAX_RESEND_COUNT) {
        return {
          success: false,
          status: 429,
          message: 'Bạn đã yêu cầu gửi mã quá số lần cho phép, vui lòng thử lại sau 15 phút',
        };
      }
      nextResendCount = existing.resendCount || 0;
      windowExpiresAt = existing.windowExpiresAt;
    }
  }

  const otp = generateOtp();
  const otpHash = await hashValue(otp);
  const cleanUpAt = new Date(now.getTime() + RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);

  // Cập nhật nguyên tử (Atomic upsert) loại bỏ hoàn toàn race condition và không bị xóa sạch đếm
  await OtpToken.findOneAndUpdate(
    { email: normalizedEmail, purpose },
    {
      $set: {
        otpHash,
        attempts: 0,
        resendCount: nextResendCount,
        expiresAt: getOtpExpiry(),
        windowExpiresAt,
        cleanUpAt,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await sendOtpEmail(normalizedEmail, otp, purpose);

  return {
    success: true,
    message: isResend ? 'Đã gửi lại mã OTP' : 'Đã gửi mã OTP đến email của bạn',
  };
}

/**
 * Xác thực mã OTP nhập vào từ người dùng.
 *
 * @param {Object} params
 * @param {string} params.email
 * @param {'register'|'reset'} params.purpose
 * @param {string} params.otp
 */
async function verifyOtpCode({ email, purpose, otp }) {
  const normalizedEmail = email.toLowerCase().trim();
  const record = await OtpToken.findOne({ email: normalizedEmail, purpose }).sort({ createdAt: -1 });

  if (!record) {
    return {
      success: false,
      status: 400,
      message: 'Mã OTP không tồn tại hoặc đã hết hạn, vui lòng gửi lại mã',
    };
  }

  if (record.expiresAt < new Date() || record.attempts >= MAX_ATTEMPTS) {
    await OtpToken.deleteOne({ _id: record._id });
    return {
      success: false,
      status: 400,
      message: 'Mã OTP đã hết hạn hoặc nhập sai quá số lần cho phép, vui lòng gửi lại mã mới',
    };
  }

  const isMatch = await compareValue(otp, record.otpHash);

  if (!isMatch) {
    record.attempts += 1;
    await record.save();
    return {
      success: false,
      status: 400,
      message: 'Mã OTP không chính xác',
    };
  }

  // Khớp OTP thành công -> xóa mã
  await OtpToken.deleteOne({ _id: record._id });

  return {
    success: true,
    message: 'Xác thực OTP thành công',
  };
}

/**
 * Hàm backward compatibility cho issueOtp
 */
async function issueOtp(email, purpose) {
  const result = await issueOrUpdateOtp({ email, purpose, isResend: false });
  if (!result.success) {
    const error = new Error(result.message);
    error.status = result.status;
    throw error;
  }
}

module.exports = {
  issueOrUpdateOtp,
  verifyOtpCode,
  issueOtp,
};
