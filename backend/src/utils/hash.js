const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

/**
 * Hash một chuỗi bất kỳ (dùng cho cả password và OTP).
 * @param {string} plainText
 * @returns {Promise<string>}
 */
async function hashValue(plainText) {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

/**
 * So sánh chuỗi gốc với chuỗi đã hash.
 * @param {string} plainText
 * @param {string} hashedValue
 * @returns {Promise<boolean>}
 */
async function compareValue(plainText, hashedValue) {
  if (!hashedValue) return false;
  return bcrypt.compare(plainText, hashedValue);
}

module.exports = { hashValue, compareValue };