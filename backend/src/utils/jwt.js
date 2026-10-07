const jwt = require('jsonwebtoken');

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const RESET_SECRET = process.env.JWT_RESET_SECRET || ACCESS_SECRET;
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d';
const RESET_EXPIRES = process.env.JWT_RESET_EXPIRES || '10m';

/**
 * payload nên chứa tối thiểu: { id, role }
 * KHÔNG nhét password hay dữ liệu nhạy cảm vào payload vì JWT chỉ mã hóa base64, không mã hóa nội dung.
 */
function signAccessToken(payload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });
}

function signResetPasswordToken(payload) {
  return jwt.sign(payload, RESET_SECRET, { expiresIn: RESET_EXPIRES });
}

function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET); // ném lỗi nếu sai/hết hạn
}

function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

function verifyResetPasswordToken(token) {
  return jwt.verify(token, RESET_SECRET);
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  signResetPasswordToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyResetPasswordToken,
};
