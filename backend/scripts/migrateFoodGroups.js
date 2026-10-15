/**
 * migrateFoodGroups.js
 * Chuẩn hóa toàn bộ nhóm món ăn trong cơ sở dữ liệu về 10 nhóm chuẩn (+ Khác).
 * Khởi tạo dữ liệu bảng FoodGroup.
 *
 * Chạy: node scripts/migrateFoodGroups.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Food = require('../src/models/Food');
const FoodRequest = require('../src/models/FoodRequest');
const FoodGroup = require('../src/models/FoodGroup');

const STANDARD_GROUPS = [
  { name: 'Cơm & Xôi', description: 'Các món cơm tấm, cơm rang, xôi nếp truyền thống', displayOrder: 1, isStandard: true },
  { name: 'Bún, Mì & Phở', description: 'Các món bún, mì, miến, phở, hủ tiếu, bánh canh', displayOrder: 2, isStandard: true },
  { name: 'Bánh mì & Sandwich', description: 'Bánh mì kẹp, bánh mì chảo, sandwich và đồ ăn nhanh', displayOrder: 3, isStandard: true },
  { name: 'Bánh truyền thống & Dimsum', description: 'Bánh cuốn, bánh xèo, bánh bèo, bánh bột lọc, há cảo, dimsum', displayOrder: 4, isStandard: true },
  { name: 'Món thịt, cá & Hải sản', description: 'Các món mặn giàu đạm: thịt kho, cá kho, gà nướng, bò sốt, tôm chiên, hải sản', displayOrder: 5, isStandard: true },
  { name: 'Canh, Cháo & Súp', description: 'Canh chua, canh rau củ, cháo lòng, cháo sườn, các loại súp', displayOrder: 6, isStandard: true },
  { name: 'Rau, Gỏi & Salad', description: 'Gỏi cuốn, gỏi gà, nộm hoa chuối, salad rau củ thanh đạm', displayOrder: 7, isStandard: true },
  { name: 'Ăn vặt & Đường phố', description: 'Bánh tráng trộn, bắp nướng, bột chiên, nem chua rán, đồ ăn vặt', displayOrder: 8, isStandard: true },
  { name: 'Tráng miệng & Chè', description: 'Chè các loại, sữa chua nếp cẩm, bánh ngọt tráng miệng, hoa quả', displayOrder: 9, isStandard: true },
  { name: 'Đồ uống & Giải khát', description: 'Cà phê, trà, sinh tố, nước ép hoa quả, nước giải khát', displayOrder: 10, isStandard: true },
  { name: 'Khác', description: 'Các món ăn và gia vị phụ khác chưa phân loại', displayOrder: 11, isStandard: true },
];

function mapToStandardGroup(name, slug = '', currentGroup = '') {
  const n = (name || '').toLowerCase();
  const s = (slug || '').toLowerCase();
  const g = (currentGroup || '').trim();

  // Bánh mì
  if (s.includes('banh-mi') || n.includes('bánh mì') || n.includes('sandwich')) {
    return 'Bánh mì & Sandwich';
  }

  // Bánh canh
  if (s.includes('banh-canh') || n.includes('bánh canh')) {
    return 'Bún, Mì & Phở';
  }

  // Bánh chưng
  if (s.includes('banh-chung') || n.includes('bánh chưng')) {
    return 'Cơm & Xôi';
  }

  // Ăn vặt
  if (
    s.includes('banh-trang') ||
    s.includes('bap-nuong') ||
    s.includes('bot-chien') ||
    s.includes('pha-lau') ||
    n.includes('bánh tráng') ||
    n.includes('bắp nướng') ||
    n.includes('bột chiên') ||
    n.includes('phá lấu') ||
    g === 'Ăn vặt / Đường phố'
  ) {
    return 'Ăn vặt & Đường phố';
  }

  // Tráng miệng
  if (
    s.includes('tau-hu') ||
    s.includes('sua-chua') ||
    n.includes('sữa chua') ||
    n.includes('chè') ||
    n.includes('kem') ||
    g === 'Tráng miệng / Chè'
  ) {
    return 'Tráng miệng & Chè';
  }

  // Đồ uống
  if (
    n.includes('cà phê') ||
    n.includes('trà') ||
    n.includes('sinh tố') ||
    n.includes('nước ép') ||
    g === 'Đồ uống'
  ) {
    return 'Đồ uống & Giải khát';
  }

  // Cơm & Xôi
  if (
    s.includes('com-') ||
    s.includes('xoi') ||
    n.includes('cơm') ||
    n.includes('xôi') ||
    g === 'Cơm / Xôi' ||
    g === 'Cơm & Món chính'
  ) {
    return 'Cơm & Xôi';
  }

  // Bún, Mì & Phở
  if (
    s.includes('bun-') ||
    s.includes('pho') ||
    s.includes('mi-') ||
    s.includes('hu-tieu') ||
    s.includes('cao-lau') ||
    n.includes('bún') ||
    n.includes('phở') ||
    n.includes('mì') ||
    n.includes('hủ tiếu') ||
    n.includes('miến') ||
    g === 'Bún / Mì / Phở' ||
    g === 'Món nước & Sợi'
  ) {
    return 'Bún, Mì & Phở';
  }

  // Canh, Cháo & Súp
  if (
    s.includes('canh-') ||
    s.includes('chao-') ||
    s.includes('sup') ||
    n.includes('canh') ||
    n.includes('cháo') ||
    n.includes('súp') ||
    n.includes('lẩu') ||
    g === 'Canh / Cháo / Lẩu'
  ) {
    return 'Canh, Cháo & Súp';
  }

  // Rau, Gỏi & Salad
  if (
    s.includes('goi-') ||
    s.includes('nem-') ||
    s.includes('salad') ||
    n.includes('gỏi') ||
    n.includes('nộm') ||
    n.includes('salad') ||
    n.includes('nem chua') ||
    g === 'Salad / Gỏi'
  ) {
    return 'Rau, Gỏi & Salad';
  }

  // Bánh truyền thống & Dimsum
  if (
    s.includes('banh-') ||
    s.includes('ha-cao') ||
    s.includes('hoanh-thanh') ||
    n.includes('bánh') ||
    n.includes('há cảo') ||
    n.includes('hoành thánh') ||
    g === 'Bánh / Dimsum' ||
    g === 'Món chiên & Bánh'
  ) {
    return 'Bánh truyền thống & Dimsum';
  }

  // Món thịt, cá & Hải sản
  if (
    s.includes('bo-') ||
    s.includes('ca-') ||
    s.includes('ga-') ||
    s.includes('thit-') ||
    s.includes('tom-') ||
    n.includes('bò') ||
    n.includes('cá') ||
    n.includes('gà') ||
    n.includes('thịt') ||
    n.includes('tôm') ||
    g === 'Nướng / Kho / Xào' ||
    g === 'Món mặn & Thịt cá' ||
    g === 'Chiên'
  ) {
    return 'Món thịt, cá & Hải sản';
  }

  return 'Khác';
}

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Kết nối MongoDB thành công');

    // 1. Tạo/cập nhật danh mục FoodGroup
    console.log('📌 1. Khởi tạo danh mục 10 nhóm chuẩn (+ Khác) trong FoodGroup collection...');
    for (const g of STANDARD_GROUPS) {
      await FoodGroup.findOneAndUpdate(
        { name: g.name },
        { $set: g },
        { upsert: true, new: true }
      );
    }
    console.log(`   Đã đảm bảo ${STANDARD_GROUPS.length} nhóm chuẩn có mặt trong DB.`);

    // 2. Cập nhật bảng Food
    console.log('📌 2. Chuẩn hóa nhóm cho các món trong bảng Food...');
    const allFoods = await Food.find({});
    let foodUpdated = 0;
    for (const f of allFoods) {
      const targetGroup = mapToStandardGroup(f.name, f.slug, f.foodGroup);
      if (f.foodGroup !== targetGroup) {
        await Food.updateOne({ _id: f._id }, { $set: { foodGroup: targetGroup } });
        console.log(`   - "${f.name}": [${f.foodGroup || 'null'}] ➔ [${targetGroup}]`);
        foodUpdated++;
      }
    }
    console.log(`   Đã cập nhật ${foodUpdated} món ăn sang nhóm chuẩn.`);

    // 3. Cập nhật bảng FoodRequest
    console.log('📌 3. Chuẩn hóa nhóm cho bảng FoodRequest...');
    const allReqs = await FoodRequest.find({});
    let reqUpdated = 0;
    for (const r of allReqs) {
      if (r.foodName) {
        const targetGroup = mapToStandardGroup(r.foodName, '', r.foodGroup);
        if (r.foodGroup !== targetGroup) {
          await FoodRequest.updateOne({ _id: r._id }, { $set: { foodGroup: targetGroup } });
          console.log(`   - YC "${r.foodName}": [${r.foodGroup || 'null'}] ➔ [${targetGroup}]`);
          reqUpdated++;
        }
      }
    }
    console.log(`   Đã cập nhật ${reqUpdated} yêu cầu món ăn.`);

    // 4. Tổng kết số lượng món theo từng nhóm
    const summary = await Food.aggregate([
      { $group: { _id: '$foodGroup', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    console.log('\n📊 THỐNG KÊ MÓN ĂN THEO NHÓM CHUẨN MỚI:');
    summary.forEach((item) => {
      console.log(`   ${item._id}: ${item.count} món`);
    });

    await mongoose.disconnect();
    console.log('\n✅ Hoàn tất dọn dẹp và chuẩn hóa dữ liệu nhóm!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi migration:', err);
    process.exit(1);
  }
}

run();
