/**
 * Script tạo tài khoản admin mặc định.
 *
 * Cách dùng:
 *   npm run seed:admin
 *
 * Script sẽ:
 *  - Kết nối MongoDB theo MONGO_URI trong .env
 *  - Nếu email chưa tồn tại → tạo mới admin
 *  - Nếu đã tồn tại → bỏ qua (không ghi đè)
 *  - Tự động đóng kết nối sau khi xong
 */

'use strict';

require('dotenv').config();
const dns = require('dns');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// ──────────────────────────────────────────────
// Cấu hình từ .env (bắt buộc)
// ──────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_FULLNAME = process.env.ADMIN_FULLNAME || 'Super Admin';
const SALT_ROUNDS = 10;

if (!MONGO_URI || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    '[seedAdmin] Thiếu biến môi trường. Cần có: MONGO_URI, ADMIN_EMAIL, ADMIN_PASSWORD trong file .env'
  );
  process.exit(1);
}

// ──────────────────────────────────────────────
// Schema inline (không import từ models để script
// chạy độc lập, không kéo theo toàn bộ app)
// ──────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String },
    authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
    fullName: { type: String, required: true, trim: true },
    dateOfBirth: { type: Date, default: null },
    gender: { type: String, enum: ['male', 'female', 'other', null], default: null },
    phone: { type: String, default: null },
    avatarUrl: { type: String, default: null },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    status: { type: String, enum: ['pending', 'active', 'locked'], default: 'pending' },
    lockReason: { type: String, default: null },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    refreshTokens: [
      {
        tokenHash: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, required: true },
      },
    ],
  },
  { timestamps: true }
);

async function seed() {
  // Fix DNS SRV lookup cho mongodb+srv:// (giống db.js)
  if (MONGO_URI.startsWith('mongodb+srv://')) {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  }

  await mongoose.connect(MONGO_URI);
  console.log('[seedAdmin] Đã kết nối MongoDB');

  // Dùng model tạm — tránh xung đột nếu model "User" đã được đăng ký ở nơi khác
  const User =
    mongoose.models.User || mongoose.model('User', userSchema);

  const normalizedEmail = ADMIN_EMAIL.toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });

  if (existing) {
    console.log(`[seedAdmin] Tài khoản admin "${normalizedEmail}" đã tồn tại — bỏ qua.`);
  } else {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);

    await User.create({
      email: normalizedEmail,
      password: passwordHash,
      fullName: ADMIN_FULLNAME,
      authProvider: 'local',
      role: 'admin',
      status: 'active', // active ngay, không cần OTP
    });

    console.log(`[seedAdmin] ✅ Đã tạo tài khoản admin: ${normalizedEmail}`);
  }

  await mongoose.disconnect();
  console.log('[seedAdmin] Đã ngắt kết nối MongoDB');
  process.exit(0);
}

seed().catch((err) => {
  console.error('[seedAdmin] ❌ Lỗi:', err.message);
  process.exit(1);
});
