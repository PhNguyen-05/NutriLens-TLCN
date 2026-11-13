/**
 * seedExercises.js
 * Seed danh mục bài tập thể chất phong phú với giá trị MET chuẩn hóa.
 * Dựa trên The 2011 & 2024 Compendium of Physical Activities (Ainsworth et al. / ACSM).
 * Chạy: node scripts/seedExercises.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Exercise = require('../src/models/Exercise');

const exercises = [
  {
    "name": "Đi bộ (Walking)",
    "slug": "di-bo",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 3.5,
    "intensity": "Nhẹ",
    "icon": "bi-person-walking",
    "description": "Đi bộ ngoài trời hoặc đi trên máy tập, tăng cường tuần hoàn tim mạch và đốt mỡ nhẹ nhàng.",
    "defaultDurationMinutes": 30,
    "imageUrl": "https://images.unsplash.com/photo-1502224562085-639556652f33?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=enYITYwvPAQ"
  },
  {
    "name": "Chạy bộ (Running / Jogging)",
    "slug": "chay-bo",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 8.5,
    "intensity": "Cao",
    "icon": "bi-lightning-charge",
    "description": "Chạy bộ ngoài trời hoặc máy chạy, rèn luyện sức bền tim phổi và đốt cháy calo hiệu quả.",
    "defaultDurationMinutes": 30,
    "imageUrl": "https://images.unsplash.com/photo-1486218119243-13883505764c?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=_kGESn8ArrU"
  },
  {
    "name": "Đạp xe (Cycling)",
    "slug": "dap-xe",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 6.8,
    "intensity": "Trung bình",
    "icon": "bi-bicycle",
    "description": "Đạp xe ngoài trời hoặc máy đạp tĩnh (Spin Bike), săn chắc cơ đùi và tốt cho khớp gối.",
    "defaultDurationMinutes": 30,
    "imageUrl": "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=4sswGkM_Jao"
  },
  {
    "name": "Bơi lội (Swimming)",
    "slug": "boi-loi",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 6.5,
    "intensity": "Trung bình",
    "icon": "bi-water",
    "description": "Vận động toàn thân dưới nước (bơi sải, bơi ếch, bơi tự do), giảm áp lực lên xương khớp.",
    "defaultDurationMinutes": 30,
    "imageUrl": "https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=pFnU_Bqm_3o"
  },
  {
    "name": "Nhảy dây (Jump Rope)",
    "slug": "nhay-day",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 10,
    "intensity": "Cao",
    "icon": "bi-repeat",
    "description": "Nhảy dây đơn hoặc biến tốc, kích hoạt phản xạ nhanh và tiêu hao năng lượng cực lớn.",
    "defaultDurationMinutes": 15,
    "imageUrl": "https://images.unsplash.com/photo-1434596922112-19c563067271?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=1BZM2Vre5oc"
  },
  {
    "name": "Aerobic & Zumba Dance",
    "slug": "aerobic-zumba",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 6.5,
    "intensity": "Trung bình",
    "icon": "bi-music-note-beamed",
    "description": "Vận động theo điệu nhạc sôi động, kích thích nhịp tim, đốt mỡ và giải tỏa căng thẳng.",
    "defaultDurationMinutes": 45,
    "imageUrl": "https://images.unsplash.com/photo-1524594152303-9fd13543fe6e?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=gCzgc_RelBA"
  },
  {
    "name": "HIIT (Cardio ngắt quãng)",
    "slug": "hiit-cardio",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 8.5,
    "intensity": "Cao",
    "icon": "bi-fire",
    "description": "Chuỗi bài tập cardio ngắt quãng cường độ cao (Burpees, Jumping Jacks, High Knees), kích hoạt đốt mỡ Afterburn.",
    "defaultDurationMinutes": 20,
    "imageUrl": "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=ml6cT4AZdqI"
  },
  {
    "name": "Leo cầu thang (Stair Climbing)",
    "slug": "leo-cau-thang",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 8.8,
    "intensity": "Cao",
    "icon": "bi-speedometer2",
    "description": "Leo bậc thang bộ hoặc máy leo dốc liên tục, kích hoạt mạnh mẽ cơ mông, đùi và bắp chân.",
    "defaultDurationMinutes": 20,
    "imageUrl": "https://images.unsplash.com/photo-1598289431512-b97b0917affc?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=E_MvC8t1t-w"
  },
  {
    "name": "Tập tạ & Thể hình (Gym / Weight Training)",
    "slug": "tap-ta-gym",
    "category": "strength",
    "categoryName": "Sức mạnh & Gym",
    "met": 5.5,
    "intensity": "Trung bình",
    "icon": "bi-trophy",
    "description": "Tập kháng lực với tạ đơn, tạ đòn hoặc máy tập thể hình, phát triển khối cơ và định hình vóc dáng.",
    "defaultDurationMinutes": 45,
    "imageUrl": "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=U0bhE67HuDY"
  },
  {
    "name": "Calisthenics & Bodyweight",
    "slug": "calisthenics-bodyweight",
    "category": "strength",
    "categoryName": "Sức mạnh & Gym",
    "met": 5,
    "intensity": "Trung bình",
    "icon": "bi-person-arms-up",
    "description": "Tập luyện sử dụng trọng lượng cơ thể (hít đất, xà đơn, dips), rèn luyện sức mạnh và kiểm soát cơ bắp.",
    "defaultDurationMinutes": 30,
    "imageUrl": "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=IODxDxX7oi4"
  },
  {
    "name": "Plank & Gập bụng (Core & Abs)",
    "slug": "plank-gap-bung-core",
    "category": "strength",
    "categoryName": "Sức mạnh & Gym",
    "met": 4,
    "intensity": "Trung bình",
    "icon": "bi-shield-check",
    "description": "Các bài tập siết chặt cơ lõi (Plank, Crunch, Leg Raise), củng cố lưng dưới và thon gọn vòng eo.",
    "defaultDurationMinutes": 20,
    "imageUrl": "https://images.unsplash.com/photo-1566241142559-40e1dab266c6?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=1919eTCoESo"
  },
  {
    "name": "Tập với dây kháng lực (Resistance Bands)",
    "slug": "tap-day-khang-luc",
    "category": "strength",
    "categoryName": "Sức mạnh & Gym",
    "met": 4.5,
    "intensity": "Trung bình",
    "icon": "bi-bandaid",
    "description": "Bài tập kích hoạt và săn chắc các nhóm cơ với dây thun đàn hồi, an toàn cho các khớp.",
    "defaultDurationMinutes": 30,
    "imageUrl": "https://images.unsplash.com/photo-1598971639058-fab3c3109a00?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=r3Z9x0o8_f0"
  },
  {
    "name": "Yoga (Hatha, Vinyasa, phục hồi)",
    "slug": "yoga",
    "category": "flexibility",
    "categoryName": "Yoga & Thư giãn",
    "met": 3,
    "intensity": "Nhẹ",
    "icon": "bi-flower1",
    "description": "Các bài tập chuỗi tư thế Yoga kết hợp điều hòa hơi thở, giúp cơ thể dẻo dai, thư thái và giảm stress.",
    "defaultDurationMinutes": 45,
    "imageUrl": "https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=v7AYKMP6rOE"
  },
  {
    "name": "Pilates",
    "slug": "pilates",
    "category": "flexibility",
    "categoryName": "Yoga & Thư giãn",
    "met": 3,
    "intensity": "Nhẹ",
    "icon": "bi-peace",
    "description": "Tập trung vào kiểm soát cơ bụng sâu, điều chỉnh tư thế cột sống và tăng độ linh hoạt khớp.",
    "defaultDurationMinutes": 40,
    "imageUrl": "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=K-PpDUtKGCE"
  },
  {
    "name": "Giãn cơ & Thả lỏng (Stretching)",
    "slug": "gian-co-tha-long",
    "category": "flexibility",
    "categoryName": "Yoga & Thư giãn",
    "met": 2.5,
    "intensity": "Nhẹ",
    "icon": "bi-heart-pulse",
    "description": "Kéo giãn toàn thân sau buổi tập hoặc sau giờ làm việc, giải phóng axit lactic và ngừa đau nhức cơ.",
    "defaultDurationMinutes": 15,
    "imageUrl": "https://images.unsplash.com/photo-1518310383802-640c2de311b2?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=g_tea8ZNk5A"
  },
  {
    "name": "Thái Cực Quyền (Tai Chi)",
    "slug": "thai-cuc-quyen-tai-chi",
    "category": "flexibility",
    "categoryName": "Yoga & Thư giãn",
    "met": 3,
    "intensity": "Nhẹ",
    "icon": "bi-yin-yang",
    "description": "Các chuyển động mềm mại, chậm rãi kết hợp hơi thở sâu, rèn luyện thăng bằng và định tâm.",
    "defaultDurationMinutes": 30,
    "imageUrl": "https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=cEOS2zoyEm4"
  },
  {
    "name": "Bóng đá (Football / Soccer)",
    "slug": "bong-da",
    "category": "sports",
    "categoryName": "Thể thao",
    "met": 8,
    "intensity": "Cao",
    "icon": "bi-dribbble",
    "description": "Chạy chỗ, tranh bóng và phối hợp liên tục trên sân cỏ, nâng cao thể lực và sức bền toàn diện.",
    "defaultDurationMinutes": 60,
    "imageUrl": "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=0kF_N74F6i0"
  },
  {
    "name": "Bóng rổ (Basketball)",
    "slug": "bong-ro",
    "category": "sports",
    "categoryName": "Thể thao",
    "met": 6.5,
    "intensity": "Trung bình",
    "icon": "bi-dribbble",
    "description": "Dẫn bóng, bật nhảy ném rổ và di chuyển liên tục, phát triển chiều cao và phản xạ linh hoạt.",
    "defaultDurationMinutes": 45,
    "imageUrl": "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=1F_X4rO1s68"
  },
  {
    "name": "Cầu lông (Badminton)",
    "slug": "cau-long",
    "category": "sports",
    "categoryName": "Thể thao",
    "met": 5.5,
    "intensity": "Trung bình",
    "icon": "bi-dribbble",
    "description": "Đánh cầu lông đơn hoặc đôi, di chuyển bước chân nhanh nhẹn và rèn luyện phản xạ cổ tay.",
    "defaultDurationMinutes": 45,
    "imageUrl": "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=0sI27j3K_9s"
  },
  {
    "name": "Bóng bàn (Table Tennis)",
    "slug": "bong-ban",
    "category": "sports",
    "categoryName": "Thể thao",
    "met": 4,
    "intensity": "Trung bình",
    "icon": "bi-dribbble",
    "description": "Rèn luyện phản xạ tay mắt nhanh nhạy và các bước di chuyển ngắn liên tục quanh bàn bóng.",
    "defaultDurationMinutes": 45,
    "imageUrl": "https://images.unsplash.com/photo-1534158914592-062992fbe900?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=FqS7bSg-0-Q"
  },
  {
    "name": "Quần vợt (Tennis)",
    "slug": "quan-vot-tennis",
    "category": "sports",
    "categoryName": "Thể thao",
    "met": 7.3,
    "intensity": "Cao",
    "icon": "bi-dribbble",
    "description": "Đánh tennis đơn hoặc đôi với những pha di chuyển bao sân rộng và phát bóng mạnh mẽ.",
    "defaultDurationMinutes": 60,
    "imageUrl": "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=p1h2b0V5r-0"
  },
  {
    "name": "Pickleball",
    "slug": "pickleball",
    "category": "sports",
    "categoryName": "Thể thao",
    "met": 6,
    "intensity": "Trung bình",
    "icon": "bi-dribbble",
    "description": "Môn thể thao vợt đối kháng hiện đại kết hợp tennis, bóng bàn và cầu lông, phù hợp mọi lứa tuổi.",
    "defaultDurationMinutes": 45,
    "imageUrl": "https://images.unsplash.com/photo-1599474924187-334a4ae5bd3c?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=kqLRRNOpe8U"
  }
];

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
