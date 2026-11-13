/**
 * cleanupLegacyExercises.js
 * Dọn dẹp các bản ghi bài tập cũ/phân mảnh, gom các bài tập giống nhau về hình thức
 * thành 22 bài tập tổng quát, cập nhật lại các bản ghi nhật ký (ExerciseLog) liên kết
 * đúng với bài tập tổng quát mới, và chuẩn hóa thuộc tính isCustom: false cho toàn bộ
 * bài tập hệ thống.
 * 
 * Chạy: node scripts/cleanupLegacyExercises.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Exercise = require('../src/models/Exercise');
const ExerciseLog = require('../src/models/ExerciseLog');

// Bản đồ gom các bài tập cũ về bài tập tổng quát mới
const OLD_SLUG_TO_NEW = {
  // Đi bộ: gom các phân mảnh về 1
  'di-bo-thong-tha': 'di-bo',
  'di-bo-nhanh-ngoai-troi': 'di-bo',
  'di-bo-doc-may-tap': 'di-bo',

  // Chạy bộ: gom các phân mảnh về 1
  'chay-bo-jogging': 'chay-bo',
  'chay-bo-nhe-jogging': 'chay-bo',
  'chay-cu-ly-trung-binh': 'chay-bo',
  'chay-nuoc-rut-hiit': 'chay-bo',

  // Đạp xe: gom các phân mảnh về 1
  'dap-xe-ngoai-troi': 'dap-xe',
  'dap-xe-tai-cho-gym': 'dap-xe',
  'dap-xe-toc-do-cao': 'dap-xe',

  // Bơi lội: gom các phân mảnh về 1
  'boi-loi-tu-do': 'boi-loi',
  'boi-sai-toc-do-cao': 'boi-loi',
  'boi-ech-nhip-nhang': 'boi-loi',

  // Yoga: gom các phân mảnh về 1
  'yoga-hatha-phuc-hoi': 'yoga',
  'power-yoga-vinyasa': 'yoga',

  // Tập tạ / Thể hình: gom các phân mảnh về 1
  'tap-ta-co-ban': 'tap-ta-gym',
  'tap-the-hinh-chuyen-sau': 'tap-ta-gym',

  // Các bài viết lại tên tổng quát
  'bong-da-phong-trao': 'bong-da',
  'bong-ro-giao-huu': 'bong-ro',
  'cau-long-phong-trao': 'cau-long',
  'bong-ban-table-tennis': 'bong-ban',
  'aerobic-nhay-zumba': 'aerobic-zumba',
  'hiit-dot-mo-toan-than': 'hiit-cardio',
  'nhay-day-trung-binh': 'nhay-day',
  'calisthenics-hit-dat-xa-don': 'calisthenics-bodyweight',
  'pilates-co-ban': 'pilates',
};

const TARGET_SLUGS = [
  'di-bo', 'chay-bo', 'dap-xe', 'boi-loi', 'nhay-day', 'aerobic-zumba', 'hiit-cardio', 'leo-cau-thang',
  'tap-ta-gym', 'calisthenics-bodyweight', 'plank-gap-bung-core', 'tap-day-khang-luc',
  'yoga', 'pilates', 'gian-co-tha-long', 'thai-cuc-quyen-tai-chi',
  'bong-da', 'bong-ro', 'cau-long', 'bong-ban', 'quan-vot-tennis', 'pickleball'
];

async function cleanup() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nutrilens';
  try {
    await mongoose.connect(uri);
    console.log('[cleanupLegacyExercises] Đã kết nối MongoDB thành công');

    // 1. Chuyển hướng các ExerciseLog cũ về bài tập tổng quát mới
    for (const [oldSlug, newSlug] of Object.entries(OLD_SLUG_TO_NEW)) {
      const oldEx = await Exercise.findOne({ slug: oldSlug });
      const targetEx = await Exercise.findOne({ slug: newSlug });

      if (oldEx && targetEx && String(oldEx._id) !== String(targetEx._id)) {
        const updateRes = await ExerciseLog.updateMany(
          { exerciseId: oldEx._id },
          {
            $set: {
              exerciseId: targetEx._id,
              exerciseName: targetEx.name,
              category: targetEx.category,
              met: targetEx.met,
            },
          }
        );
        if (updateRes.modifiedCount > 0) {
          console.log(`[cleanupLegacyExercises] Đã chuyển ${updateRes.modifiedCount} log từ "${oldEx.name}" sang "${targetEx.name}"`);
        }
      }
    }

    // 2. Xóa các bài tập hệ thống phân mảnh/cũ (ngoài danh sách 22 bài tổng quát)
    const delRes = await Exercise.deleteMany({
      isCustom: { $ne: true },
      slug: { $nin: TARGET_SLUGS },
    });
    if (delRes.deletedCount > 0) {
      console.log(`[cleanupLegacyExercises] Đã xóa ${delRes.deletedCount} bài tập hệ thống phân mảnh/trùng lặp`);
    }

    // 3. Chuẩn hóa isCustom: false và userId: null cho toàn bộ bài tập hệ thống
    const normRes = await Exercise.updateMany(
      { isCustom: { $ne: true } },
      { $set: { isCustom: false, userId: null } }
    );
    console.log(`[cleanupLegacyExercises] Chuẩn hóa ${normRes.matchedCount} bài tập hệ thống`);

    // 4. Báo cáo tổng kết
    const systemCount = await Exercise.countDocuments({ isCustom: false });
    const customCount = await Exercise.countDocuments({ isCustom: true });
    console.log(`[cleanupLegacyExercises] Hoàn tất! Danh mục hiện có: ${systemCount} bài tập chuẩn tổng quát, ${customCount} bài tập cá nhân.`);
  } catch (err) {
    console.error('[cleanupLegacyExercises] Lỗi:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('[cleanupLegacyExercises] Đã ngắt kết nối MongoDB.');
  }
}

cleanup();
