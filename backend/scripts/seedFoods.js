/**
 * seedFoods.js
 * Seed dữ liệu dinh dưỡng cho 49 món ăn Việt Nam vào MongoDB.
 *
 * Chạy: node scripts/seedFoods.js
 *
 * Nguồn tham khảo: USDA FoodData Central, Viện Dinh Dưỡng Quốc Gia VN
 * Tất cả giá trị là trung bình ước tính theo khẩu phần thực tế (1 suất ăn).
 * servingSize: gram / suất
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Food = require('../src/models/Food');

// ──────────────────────────────────────────────────────────────────────────────
// Dữ liệu dinh dưỡng (kcal, protein, fat, carbs đơn vị gram; sodium mg)
// Mỗi item = 1 khẩu phần thực tế (servingSize gram)
// ──────────────────────────────────────────────────────────────────────────────
const foods = [
  { slug: 'banh-beo',          name: 'Bánh bèo',           servingSize: 200, calories: 210, protein:  5, fat:  4, carbs: 38, fiber: 1, sodium: 280 },
  { slug: 'banh-bot-loc',      name: 'Bánh bột lọc',       servingSize: 150, calories: 190, protein:  6, fat:  4, carbs: 33, fiber: 0, sodium: 350 },
  { slug: 'banh-can',          name: 'Bánh căn',            servingSize: 200, calories: 280, protein:  9, fat:  8, carbs: 40, fiber: 1, sodium: 420 },
  { slug: 'banh-canh',         name: 'Bánh canh',           servingSize: 400, calories: 350, protein: 18, fat:  6, carbs: 55, fiber: 2, sodium: 900 },
  { slug: 'banh-chung',        name: 'Bánh chưng',          servingSize: 250, calories: 390, protein: 12, fat: 10, carbs: 62, fiber: 3, sodium: 500 },
  { slug: 'banh-cuon',         name: 'Bánh cuốn',           servingSize: 250, calories: 280, protein: 14, fat:  6, carbs: 42, fiber: 1, sodium: 600 },
  { slug: 'banh-duc',          name: 'Bánh đúc',            servingSize: 200, calories: 180, protein:  3, fat:  3, carbs: 35, fiber: 0, sodium: 200 },
  { slug: 'banh-gio',          name: 'Bánh giò',            servingSize: 200, calories: 300, protein: 12, fat:  8, carbs: 44, fiber: 2, sodium: 480 },
  { slug: 'banh-hoi',          name: 'Bánh hỏi',            servingSize: 200, calories: 250, protein:  8, fat:  5, carbs: 44, fiber: 1, sodium: 350 },
  { slug: 'banh-khot',         name: 'Bánh khọt',           servingSize: 200, calories: 320, protein: 10, fat: 12, carbs: 42, fiber: 1, sodium: 550 },
  { slug: 'banh-mi',           name: 'Bánh mì',             servingSize: 200, calories: 380, protein: 18, fat: 12, carbs: 48, fiber: 2, sodium: 750 },
  { slug: 'banh-mi-chao',      name: 'Bánh mì chảo',        servingSize: 350, calories: 520, protein: 22, fat: 24, carbs: 52, fiber: 2, sodium: 950 },
  { slug: 'banh-pia',          name: 'Bánh pía',            servingSize: 100, calories: 350, protein:  5, fat: 14, carbs: 52, fiber: 1, sodium: 200 },
  { slug: 'banh-tet',          name: 'Bánh tét',            servingSize: 250, calories: 380, protein: 10, fat:  9, carbs: 64, fiber: 3, sodium: 480 },
  { slug: 'banh-trang-nuong',  name: 'Bánh tráng nướng',   servingSize: 150, calories: 300, protein:  7, fat: 10, carbs: 44, fiber: 2, sodium: 600 },
  { slug: 'banh-trang-tron',   name: 'Bánh tráng trộn',    servingSize: 200, calories: 340, protein:  8, fat: 12, carbs: 50, fiber: 3, sodium: 700 },
  { slug: 'banh-u',            name: 'Bánh ú',              servingSize: 150, calories: 290, protein:  7, fat:  6, carbs: 52, fiber: 2, sodium: 320 },
  { slug: 'banh-uot',          name: 'Bánh ướt',            servingSize: 200, calories: 220, protein:  8, fat:  4, carbs: 38, fiber: 1, sodium: 450 },
  { slug: 'banh-xeo',          name: 'Bánh xèo',            servingSize: 300, calories: 420, protein: 18, fat: 16, carbs: 50, fiber: 3, sodium: 820 },
  { slug: 'bap-nuong',         name: 'Bắp nướng',           servingSize: 200, calories: 240, protein:  7, fat:  8, carbs: 36, fiber: 4, sodium: 350 },
  { slug: 'bo-kho',            name: 'Bò kho',              servingSize: 350, calories: 380, protein: 30, fat: 18, carbs: 20, fiber: 2, sodium: 900 },
  { slug: 'bo-la-lot',         name: 'Bò lá lốt',           servingSize: 200, calories: 320, protein: 24, fat: 18, carbs: 12, fiber: 2, sodium: 650 },
  { slug: 'bot-chien',         name: 'Bột chiên',           servingSize: 250, calories: 400, protein: 10, fat: 16, carbs: 54, fiber: 1, sodium: 800 },
  { slug: 'bun-bo-hue',        name: 'Bún bò Huế',          servingSize: 450, calories: 420, protein: 28, fat: 12, carbs: 52, fiber: 2, sodium: 1100 },
  { slug: 'bun-dau-mam-tom',   name: 'Bún đậu mắm tôm',    servingSize: 350, calories: 500, protein: 22, fat: 20, carbs: 58, fiber: 4, sodium: 950 },
  { slug: 'bun-mam',           name: 'Bún mắm',             servingSize: 400, calories: 380, protein: 24, fat: 10, carbs: 50, fiber: 3, sodium: 1000 },
  { slug: 'bun-rieu',          name: 'Bún riêu',            servingSize: 450, calories: 370, protein: 22, fat:  9, carbs: 52, fiber: 2, sodium: 980 },
  { slug: 'bun-thit-nuong',    name: 'Bún thịt nướng',     servingSize: 400, calories: 450, protein: 28, fat: 14, carbs: 54, fiber: 3, sodium: 900 },
  { slug: 'ca-kho-to',         name: 'Cá kho tộ',           servingSize: 200, calories: 280, protein: 30, fat: 12, carbs:  8, fiber: 0, sodium: 950 },
  { slug: 'ca-ri',             name: 'Cà ri',               servingSize: 350, calories: 420, protein: 28, fat: 22, carbs: 28, fiber: 4, sodium: 780 },
  { slug: 'canh-chua',         name: 'Canh chua',           servingSize: 350, calories: 180, protein: 14, fat:  5, carbs: 20, fiber: 3, sodium: 700 },
  { slug: 'canh-kho-qua',      name: 'Canh khổ qua',       servingSize: 300, calories: 160, protein: 12, fat:  6, carbs: 14, fiber: 2, sodium: 580 },
  { slug: 'canh-khoai-mo',     name: 'Canh khoai mỡ',      servingSize: 300, calories: 150, protein:  5, fat:  3, carbs: 26, fiber: 3, sodium: 450 },
  { slug: 'cao-lau',           name: 'Cao lầu',             servingSize: 350, calories: 380, protein: 20, fat: 10, carbs: 52, fiber: 2, sodium: 850 },
  { slug: 'chao-long',         name: 'Cháo lòng',           servingSize: 400, calories: 310, protein: 18, fat: 10, carbs: 38, fiber: 1, sodium: 780 },
  { slug: 'com-tam',           name: 'Cơm tấm',             servingSize: 400, calories: 560, protein: 30, fat: 16, carbs: 72, fiber: 2, sodium: 950 },
  { slug: 'ga-nuong',          name: 'Gà nướng',            servingSize: 250, calories: 380, protein: 40, fat: 20, carbs:  6, fiber: 0, sodium: 700 },
  { slug: 'goi-cuon',          name: 'Gỏi cuốn',            servingSize: 200, calories: 220, protein: 14, fat:  5, carbs: 30, fiber: 3, sodium: 480 },
  { slug: 'goi-ga',            name: 'Gỏi gà',              servingSize: 250, calories: 280, protein: 26, fat: 12, carbs: 18, fiber: 4, sodium: 600 },
  { slug: 'ha-cao',            name: 'Há cảo',              servingSize: 200, calories: 300, protein: 14, fat: 10, carbs: 38, fiber: 1, sodium: 650 },
  { slug: 'hoanh-thanh-nuoc',  name: 'Hoành thánh nước',   servingSize: 350, calories: 320, protein: 16, fat:  9, carbs: 44, fiber: 1, sodium: 800 },
  { slug: 'hu-tieu',           name: 'Hủ tiếu',             servingSize: 450, calories: 380, protein: 22, fat: 10, carbs: 52, fiber: 2, sodium: 950 },
  { slug: 'mi-quang',          name: 'Mì Quảng',            servingSize: 400, calories: 420, protein: 24, fat: 12, carbs: 56, fiber: 3, sodium: 850 },
  { slug: 'nem-chua',          name: 'Nem chua',             servingSize: 100, calories: 180, protein: 12, fat:  8, carbs: 14, fiber: 1, sodium: 700 },
  { slug: 'pha-lau',           name: 'Phá lấu',             servingSize: 200, calories: 260, protein: 18, fat: 14, carbs: 14, fiber: 0, sodium: 800 },
  { slug: 'pho',               name: 'Phở',                 servingSize: 500, calories: 450, protein: 28, fat: 10, carbs: 62, fiber: 2, sodium: 1100 },
  { slug: 'tau-hu',            name: 'Tàu hũ',              servingSize: 250, calories: 160, protein: 14, fat:  8, carbs: 10, fiber: 0, sodium: 250 },
  { slug: 'thit-kho-trung',    name: 'Thịt kho trứng',     servingSize: 200, calories: 350, protein: 24, fat: 22, carbs:  8, fiber: 0, sodium: 900 },
  { slug: 'xoi-xeo',           name: 'Xôi xéo',             servingSize: 250, calories: 420, protein: 10, fat: 14, carbs: 64, fiber: 2, sodium: 450 },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Kết nối MongoDB thành công');

  let inserted = 0;
  let updated  = 0;

  for (const item of foods) {
    const result = await Food.updateOne(
      { slug: item.slug },
      { $setOnInsert: item },
      { upsert: true }
    );
    if (result.upsertedCount) inserted++;
    else updated++;
  }

  console.log(`✅ Seed hoàn tất: ${inserted} món mới | ${updated} món đã tồn tại (giữ nguyên)`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌ Seed thất bại:', err.message);
  process.exit(1);
});
