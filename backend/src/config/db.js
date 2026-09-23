const mongoose = require('mongoose');
const dns = require('dns');

/**
 * Kết nối tới MongoDB.
 * Gọi hàm này trước khi app.listen() trong server.js
 */
async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error('Thiếu biến môi trường MONGO_URI trong file .env');
  }

  if (uri.startsWith('mongodb+srv://')) {
    const dnsServers = (process.env.MONGO_DNS_SERVERS || '8.8.8.8,1.1.1.1')
      .split(',')
      .map((server) => server.trim())
      .filter(Boolean);

    if (dnsServers.length > 0) {
      dns.setServers(dnsServers);
    }
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
