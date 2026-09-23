const mongoose = require('mongoose');

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    // --- Thông tin đăng nhập ---
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      // Bắt buộc khi đăng ký bằng email/mật khẩu; user đăng nhập
      // bằng Google (UC02 nhánh Google) có thể không có password
      required: function () {
        return this.authProvider === 'local';
      },
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },

    // --- Thông tin cá nhân (theo UC06, tách phần sức khỏe sang UserProfile) ---
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, default: null },
    avatarUrl: { type: String, default: null },

    // --- Phân quyền & trạng thái tài khoản (UC01, UC02, UC12) ---
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'locked'],
      default: 'pending', // 'pending' cho tới khi xác thực OTP xong (UC01)
    },
    lockReason: { type: String, default: null }, // lý do khóa (UC12)

    // --- Chống brute-force đăng nhập sai (UC02) ---
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null }, // thời điểm hết khóa tạm 15 phút

    // --- Refresh token đang hiệu lực (hỗ trợ đăng xuất/thu hồi phiên) ---
    refreshTokens: [
      {
        tokenHash: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, required: true },
      },
    ],
  },
  { timestamps: true } // tự thêm createdAt, updatedAt = "Ngày đăng ký"
);

// Email đã có index nhờ `unique: true`, không cần khai báo thêm ở đây.

module.exports = mongoose.model('User', userSchema);