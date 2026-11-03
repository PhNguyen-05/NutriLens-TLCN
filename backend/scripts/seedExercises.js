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
    "name": "Đi bộ nhanh ngoài trời",
    "slug": "di-bo-nhanh-ngoai-troi",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 3.8,
    "intensity": "Trung bình",
    "icon": "bi-person-walking",
    "description": "Đi bộ với tốc độ khoảng 5 km/h, cải thiện tim mạch và đốt mỡ nhẹ nhàng.",
    "defaultDurationMinutes": 30,
    "imageUrl": "https://images.unsplash.com/photo-1502224562085-639556652f33?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=enYITYwvPAQ"
  },
  {
    "name": "Đi bộ thong thả",
    "slug": "di-bo-thong-tha",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 2.8,
    "intensity": "Nhẹ",
    "icon": "bi-person-walking",
    "description": "Đi dạo nhẹ nhàng, thư giãn gân cốt và phục hồi năng lượng.",
    "defaultDurationMinutes": 30,
    "imageUrl": "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=3Ka7B3hCg08"
  },
  {
    "name": "Chạy bộ nhẹ (Jogging)",
    "slug": "chay-bo-nhe-jogging",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 8,
    "intensity": "Cao",
    "icon": "bi-lightning-charge",
    "description": "Chạy bộ với vận tốc khoảng 8 km/h, tăng cường sức bền và đốt cháy nhiều calo.",
    "defaultDurationMinutes": 30,
    "imageUrl": "https://images.unsplash.com/photo-1486218119243-13883505764c?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=_kGESn8ArrU"
  },
  {
    "name": "Chạy cự ly trung bình (10 km/h)",
    "slug": "chay-cu-ly-trung-binh",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 10,
    "intensity": "Cao",
    "icon": "bi-speedometer2",
    "description": "Chạy nhịp điệu nhanh, tăng sức mạnh cơ tim và tối ưu hóa chuyển hóa mỡ.",
    "defaultDurationMinutes": 20,
    "imageUrl": "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=brFHyOTtwGU"
  },
  {
    "name": "Chạy nước rút HIIT",
    "slug": "chay-nuoc-rut-hiit",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 12,
    "intensity": "Cao",
    "icon": "bi-fire",
    "description": "Chạy biến tốc cường độ cực đại ngắt quãng, kích hoạt hiệu ứng đốt mỡ Afterburn (EPOC).",
    "defaultDurationMinutes": 15,
    "imageUrl": "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=M0uO8X3_tEA"
  },
  {
    "name": "Đạp xe ngoài trời vừa sức",
    "slug": "dap-xe-ngoai-troi",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 6,
    "intensity": "Trung bình",
    "icon": "bi-bicycle",
    "description": "Đạp xe địa hình hoặc đường bằng tốc độ 15-18 km/h, tốt cho khớp gối và cơ đùi.",
    "defaultDurationMinutes": 45,
    "imageUrl": "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=4sswGkM_Jao"
  },
  {
    "name": "Đạp xe tốc độ cao (>20 km/h)",
    "slug": "dap-xe-toc-do-cao",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 8.5,
    "intensity": "Cao",
    "icon": "bi-bicycle",
    "description": "Đạp xe đua hoặc đạp xe kháng lực trong phòng gym cường độ cao.",
    "defaultDurationMinutes": 30,
    "imageUrl": "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=rVomO5Nvd0o"
  },
  {
    "name": "Bơi lội tự do vừa sức",
    "slug": "boi-loi-tu-do",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 6,
    "intensity": "Trung bình",
    "icon": "bi-water",
    "description": "Bơi thư giãn toàn thân, giảm áp lực lên các khớp xương.",
    "defaultDurationMinutes": 30,
    "imageUrl": "https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=pFnU_Bqm_3o"
  },
  {
    "name": "Bơi sải tốc độ cao",
    "slug": "boi-sai-toc-do-cao",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 9.8,
    "intensity": "Cao",
    "icon": "bi-water",
    "description": "Bơi sải bơi bướm liên tục, kích hoạt nhóm cơ lưng xô, ngực và tay vai.",
    "defaultDurationMinutes": 30,
    "imageUrl": "https://images.unsplash.com/photo-1519315901367-f34ff9154487?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=8qW1nfx3s-g"
  },
  {
    "name": "Nhảy dây tốc độ trung bình",
    "slug": "nhay-day-trung-binh",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 10,
    "intensity": "Cao",
    "icon": "bi-repeat",
    "description": "Nhảy dây khoảng 100-120 nhịp/phút, tiêu hao năng lượng cực kỳ hiệu quả.",
    "defaultDurationMinutes": 15,
    "imageUrl": "https://images.unsplash.com/photo-1434596922112-19c563067271?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=1BZM2Vre5oc"
  },
  {
    "name": "Tập tạ cơ bản (Weight Lifting)",
    "slug": "tap-ta-co-ban",
    "category": "strength",
    "categoryName": "Sức mạnh & Gym",
    "met": 5,
    "intensity": "Trung bình",
    "icon": "bi-trophy",
    "description": "Tập kháng lực với tạ đơn hoặc máy tập, phát triển cơ bắp và định hình vóc dáng.",
    "defaultDurationMinutes": 45,
    "imageUrl": "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=U0bhE67HuDY"
  },
  {
    "name": "Tập thể hình chuyên sâu (Heavy Lifting)",
    "slug": "tap-the-hinh-chuyen-sau",
    "category": "strength",
    "categoryName": "Sức mạnh & Gym",
    "met": 6.5,
    "intensity": "Cao",
    "icon": "bi-trophy",
    "description": "Tập mức tạ nặng với bài compound (Squat, Deadlift, Bench Press).",
    "defaultDurationMinutes": 60,
    "imageUrl": "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=IODxDxX7oi4"
  },
  {
    "name": "Calisthenics (Hít đất & Xà đơn)",
    "slug": "calisthenics-hit-dat-xa-don",
    "category": "strength",
    "categoryName": "Sức mạnh & Gym",
    "met": 5,
    "intensity": "Trung bình",
    "icon": "bi-person-arms-up",
    "description": "Sử dụng trọng lượng cơ thể để rèn luyện độ dẻo dai và sức mạnh cốt lõi (core).",
    "defaultDurationMinutes": 30,
    "imageUrl": "https://images.unsplash.com/photo-1598971639058-fab3c3109a00?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=y_c36JpT7sY"
  },
  {
    "name": "HIIT đốt mỡ toàn thân",
    "slug": "hiit-dot-mo-toan-than",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 8.5,
    "intensity": "Cao",
    "icon": "bi-fire",
    "description": "Chuỗi bài tập cardio ngắt quãng cường độ cao: Burpees, Jumping Jacks, Mountain Climbers.",
    "defaultDurationMinutes": 20,
    "imageUrl": "https://images.unsplash.com/photo-1601422407692-ec4eeec1d9b3?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=ml6cT4AZdqI"
  },
  {
    "name": "Yoga Hatha phục hồi",
    "slug": "yoga-hatha-phuc-hoi",
    "category": "flexibility",
    "categoryName": "Yoga & Thư giãn",
    "met": 2.5,
    "intensity": "Nhẹ",
    "icon": "bi-flower1",
    "description": "Các tư thế kéo giãn nhẹ nhàng kết hợp hít thở sâu, giảm căng thẳng cortisol.",
    "defaultDurationMinutes": 45,
    "imageUrl": "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=v7AYKMP6rOE"
  },
  {
    "name": "Power Yoga / Vinyasa Yoga",
    "slug": "power-yoga-vinyasa",
    "category": "flexibility",
    "categoryName": "Yoga & Thư giãn",
    "met": 4,
    "intensity": "Trung bình",
    "icon": "bi-flower1",
    "description": "Chuỗi chuyển động nhịp nhàng liên tục, rèn luyện sự thăng bằng và độ dẻo dai.",
    "defaultDurationMinutes": 45,
    "imageUrl": "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=9kOCY0KNByw"
  },
  {
    "name": "Giãn cơ & Thả lỏng toàn thân (Stretching)",
    "slug": "gian-co-tha-long",
    "category": "flexibility",
    "categoryName": "Yoga & Thư giãn",
    "met": 2.3,
    "intensity": "Nhẹ",
    "icon": "bi-heart-pulse",
    "description": "Giãn cơ sau buổi tập, giải phóng axit lactic và ngăn ngừa đau mỏi cơ.",
    "defaultDurationMinutes": 15,
    "imageUrl": "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=g_tea8ZNk5A"
  },
  {
    "name": "Pilates cơ bản",
    "slug": "pilates-co-ban",
    "category": "flexibility",
    "categoryName": "Yoga & Thư giãn",
    "met": 3,
    "intensity": "Nhẹ",
    "icon": "bi-gem",
    "description": "Kiểm soát cơ bụng sâu và điều chỉnh tư thế cột sống.",
    "defaultDurationMinutes": 40,
    "imageUrl": "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=K-PpDZm816g"
  },
  {
    "name": "Cầu lông phong trào",
    "slug": "cau-long-phong-trao",
    "category": "sports",
    "categoryName": "Thể thao đối kháng",
    "met": 5.5,
    "intensity": "Trung bình",
    "icon": "bi-dribbble",
    "description": "Đánh đơn hoặc đánh đôi với cường độ phản xạ linh hoạt.",
    "defaultDurationMinutes": 45,
    "imageUrl": "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=S2-G_cgKgXc"
  },
  {
    "name": "Bóng đá phong trào",
    "slug": "bong-da-phong-trao",
    "category": "sports",
    "categoryName": "Thể thao đối kháng",
    "met": 8,
    "intensity": "Cao",
    "icon": "bi-dribbble",
    "description": "Chạy chỗ, tranh bóng và phối hợp liên tục trên sân cỏ.",
    "defaultDurationMinutes": 60,
    "imageUrl": "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=rWj8gW-kZc8"
  },
  {
    "name": "Bóng rổ giao hữu",
    "slug": "bong-ro-giao-huu",
    "category": "sports",
    "categoryName": "Thể thao đối kháng",
    "met": 6.5,
    "intensity": "Trung bình",
    "icon": "bi-dribbble",
    "description": "Bật nhảy, dẫn bóng và di chuyển nhịp độ liên tục.",
    "defaultDurationMinutes": 45,
    "imageUrl": "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=1F_X4rO1s68"
  },
  {
    "name": "Leo cầu thang (Stair Climbing)",
    "slug": "leo-cau-thang",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 8.8,
    "intensity": "Cao",
    "icon": "bi-reception-4",
    "description": "Leo bậc thang liên tục, kích hoạt mạnh mẽ cơ mông và đùi sau.",
    "defaultDurationMinutes": 20,
    "imageUrl": "https://images.unsplash.com/photo-1598289431512-b97b0917affc?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=E_MvC8t1t-w"
  },
  {
    "name": "Aerobic / Nhảy Zumba",
    "slug": "aerobic-nhay-zumba",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 6.5,
    "intensity": "Trung bình",
    "icon": "bi-music-note-beamed",
    "description": "Vận động theo điệu nhạc sôi động, đốt mỡ và giải tỏa tinh thần hứng khởi.",
    "defaultDurationMinutes": 45,
    "imageUrl": "https://images.unsplash.com/photo-1524594152303-9fd13543fe6e?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=gCzgc_RelBA"
  },
  {
    "name": "Đi bộ dốc trên máy tập",
    "slug": "di-bo-doc-may-tap",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 5.3,
    "intensity": "Trung bình",
    "icon": "bi-speedometer2",
    "description": "Đi bộ trên máy độ dốc 5-8% tốc độ ~4.5 km/h, kích hoạt cơ đùi và mông.",
    "defaultDurationMinutes": 30,
    "imageUrl": "https://images.unsplash.com/photo-1576678927484-cc907957088c?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=cZnsLVArIt8"
  },
  {
    "name": "Đạp xe tại chỗ phòng gym",
    "slug": "dap-xe-tai-cho-gym",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 7,
    "intensity": "Trung bình",
    "icon": "bi-bicycle",
    "description": "Tập máy đạp xe tĩnh Spin Bike với mức kháng lực trung bình-cao.",
    "defaultDurationMinutes": 30,
    "imageUrl": "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=4JqC1XFwE6U"
  },
  {
    "name": "Bơi ếch nhịp nhàng",
    "slug": "boi-ech-nhip-nhang",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 5.3,
    "intensity": "Trung bình",
    "icon": "bi-water",
    "description": "Bơi ếch cự ly vừa sức, tăng cường tuần hoàn tim mạch và săn chắc cơ đùi trong.",
    "defaultDurationMinutes": 30,
    "imageUrl": "https://images.unsplash.com/photo-1560090995-01632a28895b?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=QGZ8rjyU5x8"
  },
  {
    "name": "Plank & Gập bụng (Core & Abs)",
    "slug": "plank-gap-bung-core",
    "category": "strength",
    "categoryName": "Sức mạnh & Gym",
    "met": 4,
    "intensity": "Trung bình",
    "icon": "bi-shield-check",
    "description": "Tập trung siết cơ bụng, lưng dưới và nhóm cơ ổn định thân trên.",
    "defaultDurationMinutes": 20,
    "imageUrl": "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=pvIjsG5Svck"
  },
  {
    "name": "Tập với dây kháng lực (Resistance Bands)",
    "slug": "tap-day-khang-luc",
    "category": "strength",
    "categoryName": "Sức mạnh & Gym",
    "met": 4.5,
    "intensity": "Trung bình",
    "icon": "bi-activity",
    "description": "Các bài tập kích hoạt cơ bắp với dây đàn hồi, an toàn cho khớp vai và hông.",
    "defaultDurationMinutes": 30,
    "imageUrl": "https://images.unsplash.com/photo-1590487988256-9ed24133863e?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=s8tC9E_D3n8"
  },
  {
    "name": "Thái Cực Quyền (Tai Chi)",
    "slug": "thai-cuc-quyen-tai-chi",
    "category": "flexibility",
    "categoryName": "Yoga & Thư giãn",
    "met": 3,
    "intensity": "Nhẹ",
    "icon": "bi-yin-yang",
    "description": "Chuyển động chậm rãi, cân bằng tâm trí và cải thiện độ linh hoạt của khớp.",
    "defaultDurationMinutes": 40,
    "imageUrl": "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=cEOS2zoyEm4"
  },
  {
    "name": "Pickleball",
    "slug": "pickleball",
    "category": "sports",
    "categoryName": "Thể thao",
    "met": 6,
    "intensity": "Trung bình",
    "icon": "bi-dribbble",
    "description": "Môn thể thao vợt đối kháng kết hợp tennis và bóng bàn, di chuyển phản xạ liên tục.",
    "defaultDurationMinutes": 45,
    "imageUrl": "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=fTvPYdKdTKQ"
  },
  {
    "name": "Quần vợt (Tennis)",
    "slug": "quan-vot-tennis",
    "category": "sports",
    "categoryName": "Thể thao",
    "met": 7.3,
    "intensity": "Cao",
    "icon": "bi-dribbble",
    "description": "Đánh tennis đơn hoặc đôi với những pha di chuyển bao sân và phát bóng mạnh mẽ.",
    "defaultDurationMinutes": 60,
    "imageUrl": "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=p1h2b0V5r-0"
  },
  {
    "name": "Bóng bàn (Table Tennis)",
    "slug": "bong-ban-table-tennis",
    "category": "sports",
    "categoryName": "Thể thao",
    "met": 4,
    "intensity": "Trung bình",
    "icon": "bi-dribbble",
    "description": "Rèn luyện phản xạ tay mắt nhanh và bước di chuyển ngắn liên tục.",
    "defaultDurationMinutes": 45,
    "imageUrl": "https://images.unsplash.com/photo-1534158914592-062992fbe900?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=FqS7bSg-0-Q"
  }
];

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nutrilens';
  try {
    await mongoose.connect(uri);
    console.log('[seedExercises] Kết nối MongoDB thành công');

    for (const ex of exercises) {
      await Exercise.findOneAndUpdate(
        { slug: ex.slug },
        { $set: ex },
        { upsert: true, new: true }
      );
    }

    const total = await Exercise.countDocuments();
    console.log(`[seedExercises] Đã nạp thành công danh mục bài tập. Tổng cộng: ${total} bài tập.`);
  } catch (err) {
    console.error('[seedExercises] Lỗi seed dữ liệu:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('[seedExercises] Đã ngắt kết nối MongoDB.');
  }
}

seed();
