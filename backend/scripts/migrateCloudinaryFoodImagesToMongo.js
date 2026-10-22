require('dotenv').config();

const connectDB = require('../src/config/db');
const Food = require('../src/models/Food');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_PATH = (id) => `/api/food/${id.toString()}/image`;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

async function downloadImage(imageUrl) {
  const response = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Tải ảnh thất bại với HTTP ${response.status}`);

  const contentType = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_TYPES.has(contentType)) {
    throw new Error(`Định dạng ảnh không được hỗ trợ: ${contentType || 'không rõ'}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Không đọc được dữ liệu ảnh');

  const chunks = [];
  let totalBytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new Error('Ảnh rỗng hoặc vượt quá 5 MB');
    }
    chunks.push(Buffer.from(value));
  }

  const buffer = Buffer.concat(chunks, totalBytes);
  if (!buffer.length) throw new Error('Ảnh rỗng');
  return { buffer, contentType };
}

async function migrateFood(food) {
  const image = await downloadImage(food.imageUrl);
  const result = await Food.updateOne(
    { _id: food._id, imageUrl: food.imageUrl },
    {
      $set: {
        imageData: image.buffer,
        imageContentType: image.contentType,
        imageUrl: IMAGE_PATH(food._id),
      },
    }
  );
  if (!result.matchedCount) throw new Error('Ảnh món ăn đã đổi trong lúc migration; hãy chạy lại lệnh');
}

async function main() {
  await connectDB();
  const foods = await Food.find({ imageUrl: /^https?:\/\/res\.cloudinary\.com\//i })
    .select('imageUrl')
    .lean();

  let migrated = 0;
  const failures = [];
  for (const food of foods) {
    try {
      await migrateFood(food);
      migrated += 1;
      console.log(`Đã chuyển ảnh món ăn ${food._id}`);
    } catch (error) {
      failures.push({ id: food._id.toString(), message: error.message });
      console.error(`Không chuyển được ảnh món ăn ${food._id}: ${error.message}`);
    }
  }

  console.log(`Hoàn tất: ${migrated}/${foods.length} ảnh food đã được lưu trong document foods.`);
  if (failures.length) process.exitCode = 2;
}

main()
  .catch((error) => {
    console.error('Không thể chuyển ảnh food sang MongoDB:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    const mongoose = require('mongoose');
    await mongoose.disconnect().catch(() => {});
  });
