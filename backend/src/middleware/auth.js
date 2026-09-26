const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');
const restoreExpiredAdminLock = require('../utils/adminLock');

/**
 * Kiểm tra header: Authorization: Bearer <accessToken>
 * Nếu hợp lệ, gắn req.user = { id, role } rồi cho đi tiếp.
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Thiếu hoặc sai định dạng token xác thực' });
  }

  try {
    const payload = verifyAccessToken(token); // { id, role, iat, exp }

    const user = await User.findById(payload.id).select('role status adminLockUntil lockReason adminLockDurationDays adminLockNote loginAttempts lockUntil');

    if (!user) {
      return res.status(401).json({ message: 'Token không hợp lệ hoặc tài khoản không tồn tại' });
    }

    await restoreExpiredAdminLock(user);

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

    req.user = { id: user._id.toString(), role: user.role };
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

module.exports = requireAuth;
