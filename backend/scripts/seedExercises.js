/**
 * seedExercises.js
 * Seed danh mục bài tập thể chất phong phú với giá trị MET chuẩn hóa.
 * Dựa trên The 2011 & 2024 Compendium of Physical Activities (Ainsworth et al. / ACSM).
 * Chạy: node scripts/seedExercises.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Exercise = require('../src/models/Exercise');

const exercises = require('../src/constants/defaultExercises');

async function seed() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nutrilens';
  try {
    await mongoose.connect(uri);
    console.log('[seedExercises] Kết nối MongoDB thành công');

    // Xóa các slug cũ bị trùng/đổi tên trước đây
    const legacySlugs = ['chay-bo-jogging', 'bong-da', 'bong-ro'];
    await Exercise.deleteMany({ slug: { $in: legacySlugs } });

    for (const ex of exercises) {
      await Exercise.findOneAndUpdate(
        { slug: ex.slug },
        { $set: { ...ex, isCustom: false, userId: null } },
        { upsert: true, returnDocument: 'after' }
      );
    }

    const totalSystem = await Exercise.countDocuments({ isCustom: { $ne: true } });
    console.log(`[seedExercises] Đã nạp thành công danh mục bài tập hệ thống: ${totalSystem} bài tập.`);
  } catch (err) {
    console.error('[seedExercises] Lỗi seed dữ liệu:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('[seedExercises] Đã ngắt kết nối MongoDB.');
  }
}

seed();
