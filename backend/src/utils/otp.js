const crypto = require('crypto');

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5; // đúng đặc tả UC01/UC03: hiệu lực 5 phút

/**
 * Sinh mã OTP ngẫu nhiên gồm 6 chữ số (000000 - 999999).
 * Dùng crypto.randomInt thay vì Math.random() để đảm bảo tính ngẫu nhiên an toàn.
 */
function generateOtp() {
  const max = 10 ** OTP_LENGTH;
  const num = crypto.randomInt(0, max);
  return String(num).padStart(OTP_LENGTH, '0');
}

/**
 * Trả về Date là thời điểm OTP hết hạn (now + 5 phút).
 */
function getOtpExpiry() {
  return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
}

module.exports = { generateOtp, getOtpExpiry, OTP_EXPIRY_MINUTES };