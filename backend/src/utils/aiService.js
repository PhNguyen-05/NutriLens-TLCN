/**
 * aiService.js
 * Gọi AI Service (FastAPI tại localhost:8000) để nhận diện món ăn từ ảnh.
 * Backend Node đóng vai trò proxy: nhận file từ frontend, forward sang AI service.
 */

const http = require('http');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';
const AI_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || '15000'); // 15 giây

/**
 * Gửi buffer ảnh tới AI service và trả về kết quả nhận diện.
 * @param {Buffer} imageBuffer - Dữ liệu ảnh dạng Buffer
 * @param {string} mimetype    - MIME type ('image/jpeg' hoặc 'image/png')
 * @param {string} originalname - Tên file gốc (dùng cho Content-Disposition)
 * @returns {Promise<{recognized: boolean, predictions: Array, message: string|null}>}
 */
async function predictFood(imageBuffer, mimetype, originalname) {
  const boundary = `----NutriLensBoundary${Date.now()}`;
  const filename = originalname || 'image.jpg';

  // Xây dựng multipart/form-data body thủ công (không cần thư viện nặng)
  const header = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${mimetype}\r\n\r\n`
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
  const body = Buffer.concat([header, imageBuffer, footer]);

  return new Promise((resolve, reject) => {
    const url = new URL('/predict', AI_SERVICE_URL);

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 8000,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          try {
            const raw = Buffer.concat(chunks).toString('utf8');
            const json = JSON.parse(raw);

            if (res.statusCode >= 400) {
              // FastAPI trả lỗi (ảnh không hợp lệ, quá dung lượng...)
              return reject(Object.assign(new Error(json.detail || 'AI Service error'), { statusCode: res.statusCode }));
            }
            resolve(json);
          } catch {
            reject(new Error('AI Service trả về dữ liệu không hợp lệ'));
          }
        });
      }
    );

    req.setTimeout(AI_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('AI Service không phản hồi (timeout)'));
    });

    req.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        reject(new Error('Không thể kết nối tới AI Service. Hãy chắc chắn FastAPI đang chạy ở cổng 8000.'));
      } else {
        reject(err);
      }
    });

    req.write(body);
    req.end();
  });
}

module.exports = { predictFood };
