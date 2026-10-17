/**
 * seedExercises.js
 * Seed danh mục bài tập thể chất phong phú với giá trị MET chuẩn hóa.
 * Chạy: node scripts/seedExercises.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Exercise = require('../src/models/Exercise');

const exercises = [
  {
    name: 'Đi bộ nhanh ngoài trời',
    slug: 'di-bo-nhanh-ngoai-troi',
    category: 'cardio',
    categoryName: 'Cardio & Vận động',
    met: 3.8,
    intensity: 'Trung bình',
    icon: 'bi-person-walking',
    description: 'Đi bộ với tốc độ khoảng 5 km/h, cải thiện tim mạch và đốt mỡ nhẹ nhàng.',
    defaultDurationMinutes: 30,
  },
  {
    name: 'Đi bộ thong thả',
    slug: 'di-bo-thong-tha',
    category: 'cardio',
    categoryName: 'Cardio & Vận động',
    met: 2.8,
    intensity: 'Nhẹ',
    icon: 'bi-person-walking',
    description: 'Đi dạo nhẹ nhàng, thư giãn gân cốt và phục hồi năng lượng.',
    defaultDurationMinutes: 30,
  },
  {
    name: 'Chạy bộ nhẹ (Jogging)',
    slug: 'chay-bo-nhe-jogging',
    category: 'cardio',
    categoryName: 'Cardio & Vận động',
    met: 8.0,
    intensity: 'Cao',
    icon: 'bi-lightning-charge',
    description: 'Chạy bộ với vận tốc khoảng 8 km/h, tăng cường sức bền và đốt cháy nhiều calo.',
    defaultDurationMinutes: 30,
  },
  {
    name: 'Chạy cự ly trung bình (10 km/h)',
    slug: 'chay-cu-ly-trung-binh',
    category: 'cardio',
    categoryName: 'Cardio & Vận động',
    met: 10.0,
    intensity: 'Cao',
    icon: 'bi-speedometer2',
    description: 'Chạy nhịp điệu nhanh, tăng sức mạnh cơ tim và tối ưu hóa chuyển hóa mỡ.',
    defaultDurationMinutes: 20,
  },
  {
    name: 'Chạy nước rút HIIT',
    slug: 'chay-nuoc-rut-hiit',
    category: 'cardio',
    categoryName: 'Cardio & Vận động',
    met: 12.0,
    intensity: 'Cao',
    icon: 'bi-fire',
    description: 'Chạy biến tốc cường độ cực đại ngắt quãng, kích hoạt hiệu ứng Afterburn (EPOC).',
    defaultDurationMinutes: 15,
  },
  {
    name: 'Đạp xe ngoài trời vừa sức',
    slug: 'dap-xe-ngoai-troi',
    category: 'cardio',
    categoryName: 'Cardio & Vận động',
    met: 6.0,
    intensity: 'Trung bình',
    icon: 'bi-bicycle',
    description: 'Đạp xe địa hình hoặc đường bằng tốc độ 15-18 km/h, tốt cho khớp gối và cơ đùi.',
    defaultDurationMinutes: 45,
  },
  {
    name: 'Đạp xe tốc độ cao (>20 km/h)',
    slug: 'dap-xe-toc-do-cao',
    category: 'cardio',
    categoryName: 'Cardio & Vận động',
    met: 8.5,
    intensity: 'Cao',
    icon: 'bi-bicycle',
    description: 'Đạp xe đua hoặc đạp xe kháng lực trong phòng gym cường độ cao.',
    defaultDurationMinutes: 30,
  },
  {
    name: 'Bơi lội tự do vừa sức',
    slug: 'boi-loi-tu-do',
    category: 'cardio',
    categoryName: 'Cardio & Vận động',
    met: 6.0,
    intensity: 'Trung bình',
    icon: 'bi-water',
    description: 'Bơi thư giãn toàn thân, giảm áp lực lên các khớp xương.',
    defaultDurationMinutes: 30,
  },
  {
    name: 'Bơi sải tốc độ cao',
    slug: 'boi-sai-toc-do-cao',
    category: 'cardio',
    categoryName: 'Cardio & Vận động',
    met: 9.8,
    intensity: 'Cao',
    icon: 'bi-water',
    description: 'Bơi sải bơi bướm liên tục, kích hoạt nhóm cơ lưng xô, ngực và tay vai.',
    defaultDurationMinutes: 30,
  },
  {
    name: 'Nhảy dây tốc độ trung bình',
    slug: 'nhay-day-trung-binh',
    category: 'cardio',
    categoryName: 'Cardio & Vận động',
    met: 10.0,
    intensity: 'Cao',
    icon: 'bi-repeat',
    description: 'Nhảy dây khoảng 100-120 nhịp/phút, tiêu hao năng lượng cực kỳ hiệu quả.',
    defaultDurationMinutes: 15,
  },
  {
    name: 'Tập tạ cơ bản (Weight Lifting)',
    slug: 'tap-ta-co-ban',
    category: 'strength',
    categoryName: 'Sức mạnh & Gym',
    met: 5.0,
    intensity: 'Trung bình',
    icon: 'bi-trophy',
    description: 'Tập kháng lực với tạ đơn hoặc máy tập, phát triển cơ bắp và định hình vóc dáng.',
    defaultDurationMinutes: 45,
  },
  {
    name: 'Tập thể hình chuyên sâu (Heavy Lifting)',
    slug: 'tap-the-hinh-chuyen-sau',
    category: 'strength',
    categoryName: 'Sức mạnh & Gym',
    met: 6.5,
    intensity: 'Cao',
    icon: 'bi-trophy',
    description: 'Tập mức tạ nặng với bài compound (Squat, Deadlift, Bench Press).',
    defaultDurationMinutes: 60,
  },
  {
    name: 'Calisthenics (Hít đất & Xà đơn)',
    slug: 'calisthenics-hit-dat-xa-don',
    category: 'strength',
    categoryName: 'Sức mạnh & Gym',
    met: 5.0,
    intensity: 'Trung bình',
    icon: 'bi-person-arms-up',
    description: 'Sử dụng trọng lượng cơ thể để rèn luyện độ dẻo dai và sức mạnh cốt lõi (core).',
    defaultDurationMinutes: 30,
  },
  {
    name: 'HIIT đốt mỡ toàn thân',
    slug: 'hiit-dot-mo-toan-than',
    category: 'cardio',
    categoryName: 'Cardio & Vận động',
    met: 8.5,
    intensity: 'Cao',
    icon: 'bi-fire',
    description: 'Chuỗi bài tập cardio ngắt quãng cường độ cao: Burpees, Jumping Jacks, Mountain Climbers.',
    defaultDurationMinutes: 20,
  },
  {
    name: 'Yoga Hatha phục hồi',
    slug: 'yoga-hatha-phuc-hoi',
    category: 'flexibility',
    categoryName: 'Yoga & Thư giãn',
    met: 2.5,
    intensity: 'Nhẹ',
    icon: 'bi-flower1',
    description: 'Các tư thế kéo giãn nhẹ nhàng kết hợp hít thở sâu, giảm căng thẳng cortisol.',
    defaultDurationMinutes: 45,
  },
  {
    name: 'Power Yoga / Vinyasa Yoga',
    slug: 'power-yoga-vinyasa',
    category: 'flexibility',
    categoryName: 'Yoga & Thư giãn',
    met: 4.0,
    intensity: 'Trung bình',
    icon: 'bi-flower1',
    description: 'Chuỗi chuyển động nhịp nhàng liên tục, rèn luyện sự thăng bằng và độ dẻo dai.',
    defaultDurationMinutes: 45,
  },
  {
    name: 'Giãn cơ & Thả lỏng toàn thân (Stretching)',
    slug: 'gian-co-tha-long',
    category: 'flexibility',
    categoryName: 'Yoga & Thư giãn',
    met: 2.3,
    intensity: 'Nhẹ',
    icon: 'bi-heart-pulse',
    description: 'Giãn cơ sau buổi tập, giải phóng axit lactic và ngăn ngừa đau mỏi cơ.',
    defaultDurationMinutes: 15,
  },
  {
    name: 'Pilates cơ bản',
    slug: 'pilates-co-ban',
    category: 'flexibility',
    categoryName: 'Yoga & Thư giãn',
    met: 3.0,
    intensity: 'Nhẹ',
    icon: 'bi-gem',
    description: 'Kiểm soát cơ bụng sâu và điều chỉnh tư thế cột sống.',
    defaultDurationMinutes: 40,
  },
  {
    name: 'Cầu lông phong trào',
    slug: 'cau-long-phong-trao',
    category: 'sports',
    categoryName: 'Thể thao đối kháng',
    met: 5.5,
    intensity: 'Trung bình',
    icon: 'bi-dribbble',
    description: 'Đánh đơn hoặc đánh đôi với cường độ phản xạ linh hoạt.',
    defaultDurationMinutes: 45,
  },
  {
    name: 'Bóng đá phong trào',
    slug: 'bong-da-phong-trao',
    category: 'sports',
    categoryName: 'Thể thao đối kháng',
    met: 8.0,
    intensity: 'Cao',
    icon: 'bi-dribbble',
    description: 'Chạy chỗ, tranh bóng và phối hợp liên tục trên sân cỏ.',
    defaultDurationMinutes: 60,
  },
  {
    name: 'Bóng rổ giao hữu',
    slug: 'bong-ro-giao-huu',
    category: 'sports',
    categoryName: 'Thể thao đối kháng',
    met: 6.5,
    intensity: 'Trung bình',
    icon: 'bi-dribbble',
    description: 'Bật nhảy, dẫn bóng và di chuyển nhịp độ liên tục.',
    defaultDurationMinutes: 45,
  },
  {
    name: 'Leo cầu thang (Stair Climbing)',
    slug: 'leo-cau-thang',
    category: 'cardio',
    categoryName: 'Cardio & Vận động',
    met: 8.8,
    intensity: 'Cao',
    icon: 'bi-reception-4',
    description: 'Leo bậc thang liên tục, kích hoạt mạnh mẽ cơ mông và đùi sau.',
    defaultDurationMinutes: 20,
  },
  {
    name: 'Aerobic / Nhảy Zumba',
    slug: 'aerobic-nhay-zumba',
    category: 'cardio',
    categoryName: 'Cardio & Vận động',
    met: 6.5,
    intensity: 'Trung bình',
    icon: 'bi-music-note-beamed',
    description: 'Vận động theo điệu nhạc sôi động, đốt mỡ và giải tỏa tinh thần hứng khởi.',
    defaultDurationMinutes: 45,
  },
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
