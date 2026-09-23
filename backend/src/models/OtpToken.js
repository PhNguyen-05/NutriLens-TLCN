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
    required: true, // = createdAt + 5 phút, set khi tạo OTP
  },
});

// TTL index: MongoDB tự động xóa document khi thời điểm hiện tại
// vượt qua giá trị của trường expiresAt (expireAfterSeconds: 0 nghĩa là
// "hết hạn đúng tại giá trị của field", không cộng thêm giây nào).
otpTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Tăng tốc truy vấn "lấy OTP còn hiệu lực gần nhất của 1 email + mục đích"
otpTokenSchema.index({ email: 1, purpose: 1 });

module.exports = mongoose.model('OtpToken', otpTokenSchema);