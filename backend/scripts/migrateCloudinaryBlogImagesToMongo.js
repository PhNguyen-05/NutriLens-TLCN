require('dotenv').config();

const connectDB = require('../src/config/db');
const BlogPost = require('../src/models/BlogPost');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const INLINE_IMAGE_PATH = (id) => `/api/blog/${id.toString()}/image`;

async function migratePost(post) {
  const response = await fetch(post.imageUrl, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Tải ảnh thất bại với HTTP ${response.status}`);

  const contentType = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!['image/jpeg', 'image/png'].includes(contentType)) {
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
  if (!buffer.length) {
    throw new Error('Ảnh rỗng hoặc vượt quá 5 MB');
  }

  const result = await BlogPost.updateOne(
    { _id: post._id, imageUrl: post.imageUrl },
    {
      $set: {
        imageData: buffer,
        imageContentType: contentType,
        imageUrl: INLINE_IMAGE_PATH(post._id),
      },
    }
  );
  if (!result.matchedCount) throw new Error('Bài viết đã đổi ảnh trong lúc migration; hãy chạy lại lệnh');
}

async function main() {
  await connectDB();
  const posts = await BlogPost.find({ imageUrl: /^https?:\/\/res\.cloudinary\.com\//i })
    .select('imageUrl')
    .lean();

  let migrated = 0;
  const failures = [];
  for (const post of posts) {
    try {
      await migratePost(post);
      migrated += 1;
      console.log(`Đã chuyển ảnh bài viết ${post._id}`);
    } catch (error) {
      failures.push({ id: post._id.toString(), message: error.message });
      console.error(`Không chuyển được ảnh bài viết ${post._id}: ${error.message}`);
    }
  }

  console.log(`Hoàn tất: ${migrated}/${posts.length} ảnh blog đã được lưu trong document blogposts.`);
  if (failures.length) process.exitCode = 2;
}

main()
  .catch((error) => {
    console.error('Không thể chuyển ảnh blog sang MongoDB:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    const mongoose = require('mongoose');
    await mongoose.disconnect().catch(() => {});
  });
