/**
 * Script reset mật khẩu admin qua CLI (dùng khi admin không vào được email).
 *
 * Cách dùng:
 *   node ./scripts/resetAdmin.js <email> <mật-khẩu-mới>
 *
 * Ví dụ:
 *   node ./scripts/resetAdmin.js admin@nutrilens.com NewPass@789
 *
 * Yêu cầu: MONGO_URI đúng trong file .env
 */

'use strict';

require('dotenv').config();
const dns = require('dns');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const SALT_ROUNDS = 10;

const MONGO_URI = process.env.MONGO_URI;
const [, , emailArg, newPasswordArg] = process.argv;

// ── Validate đầu vào ──────────────────────────────────────────────
if (!MONGO_URI) {
  console.error('[resetAdmin] ❌ Thiếu MONGO_URI trong file .env');
  process.exit(1);
}

if (!emailArg || !newPasswordArg) {
  console.error('[resetAdmin] ❌ Thiếu tham số.');
  console.error('   Cách dùng: node ./scripts/resetAdmin.js <email> <mật-khẩu-mới>');
  process.exit(1);
}

if (!PASSWORD_REGEX.test(newPasswordArg)) {
  console.error(
    '[resetAdmin] ❌ Mật khẩu mới không đủ mạnh.\n' +
    '   Yêu cầu: tối thiểu 8 ký tự, gồm chữ, số và ký tự đặc biệt.'
  );
  process.exit(1);
}

// ── Schema inline ─────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    status: { type: String, enum: ['pending', 'active', 'locked'], default: 'pending' },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    refreshTokens: [{ tokenHash: String, createdAt: Date, expiresAt: Date }],
  },
  { timestamps: true }
);

async function resetAdmin() {
  // Fix DNS SRV lookup cho mongodb+srv:// (giống db.js)
  if (MONGO_URI.startsWith('mongodb+srv://')) {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  }

  await mongoose.connect(MONGO_URI);
  console.log('[resetAdmin] Đã kết nối MongoDB');

  const User = mongoose.models.User || mongoose.model('User', userSchema);
  const normalizedEmail = emailArg.toLowerCase().trim();

  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    console.error(`[resetAdmin] ❌ Không tìm thấy tài khoản: ${normalizedEmail}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  if (user.role !== 'admin') {
    console.error(
      `[resetAdmin] ❌ Tài khoản "${normalizedEmail}" không phải admin (role: ${user.role}).\n` +
      '   Script này chỉ dùng để reset admin.'
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  // Reset mật khẩu + mở khóa nếu đang bị khóa tạm + xóa toàn bộ phiên cũ
  user.password = await bcrypt.hash(newPasswordArg, SALT_ROUNDS);
  user.loginAttempts = 0;
  user.lockUntil = null;
  user.refreshTokens = [];

  await user.save();

  console.log(`[resetAdmin] ✅ Đã reset mật khẩu cho admin: ${normalizedEmail}`);
  console.log('[resetAdmin] ⚠️  Toàn bộ phiên đăng nhập cũ đã bị vô hiệu hóa.');

  await mongoose.disconnect();
  process.exit(0);
}

resetAdmin().catch((err) => {
  console.error('[resetAdmin] ❌ Lỗi:', err.message);
  process.exit(1);
});
