const { verifyAccessToken } = require('../utils/jwt');

/**
 * Kiểm tra header: Authorization: Bearer <accessToken>
 * Nếu hợp lệ, gắn req.user = { id, role } rồi cho đi tiếp.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: 'Thiếu hoặc sai định dạng token xác thực' });
  }

  try {
    const payload = verifyAccessToken(token); // { id, role, iat, exp }
    req.user = { id: payload.id, role: payload.role };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

module.exports = requireAuth;