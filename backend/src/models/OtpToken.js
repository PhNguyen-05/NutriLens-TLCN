const mongoose = require('mongoose');

const { Schema } = mongoose;

const otpTokenSchema = new Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  otpHash: {
    type: String,
    required: true, // KHÔNG lưu OTP dạng plain text, luôn hash giống password
  },
  purpose: {
    type: String,
    enum: ['register', 'reset'], // 'register' = UC01, 'reset' = UC03
    required: true,
  },
  attempts: {
    type: Number,
    default: 0, // đếm số lần nhập sai, dùng để khóa sau 5 lần (UC01/UC03)
  },
  resendCount: {
    type: Number,
    default: 0, // đếm số lần "Gửi lại mã", giới hạn 3 lần/15 phút
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true, // = createdAt + 5 phút, thời điểm mã OTP hết hạn
  },
  windowExpiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 15 * 60 * 1000), // cửa sổ rate limit 15 phút
  },
  cleanUpAt: {
    type: Date,
    default: () => new Date(Date.now() + 15 * 60 * 1000), // thời điểm MongoDB tự động dọn dẹp document (sau 15 phút)
  },
});

// TTL index: MongoDB tự động xóa document khi vượt qua cleanUpAt (duy trì biến đếm đủ 15 phút)
otpTokenSchema.index({ cleanUpAt: 1 }, { expireAfterSeconds: 0 });

// Tăng tốc truy vấn theo email + purpose
otpTokenSchema.index({ email: 1, purpose: 1 });

module.exports = mongoose.model('OtpToken', otpTokenSchema);
