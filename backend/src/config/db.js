const mongoose = require('mongoose');

/**
 * Kết nối tới MongoDB.
 * Gọi hàm này trước khi app.listen() trong server.js
 */
async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error('Thiếu biến môi trường MONGO_URI trong file .env');
  }

  mongoose.connection.on('connected', () => {
    console.log('[MongoDB] Đã kết nối thành công');
  });

  mongoose.connection.on('error', (err) => {
    console.error('[MongoDB] Lỗi kết nối:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Mất kết nối');
  });

  await mongoose.connect(uri);
}

module.exports = connectDB;