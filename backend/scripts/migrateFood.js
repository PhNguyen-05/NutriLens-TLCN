/**
 * migrateFood.js
 * 1. Đặt status = 'active' cho tất cả food chưa có trường status
 * 2. Gán foodCode tự động (FOD-VN-XXXX) cho food chưa có
 * 3. Gán foodGroup dựa trên slug pattern
 *
 * Chạy: node scripts/migrateFood.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Food = require('../src/models/Food');

const GROUP_MAP = [
  { test: /banh-(beo|bot-loc|can|cuon|duc|gio|hoi|khot|mi|pia|tet|trang|u|uot|xeo)/, group: 'Bánh / Dimsum' },
  { test: /ha-cao|hoanh-thanh/, group: 'Bánh / Dimsum' },
  { test: /bun-(bo|dau|mam|rieu|thit)/, group: 'Bún / Mì / Phở' },
  { test: /pho|mi-quang|hu-tieu|cao-lau|banh-canh/, group: 'Bún / Mì / Phở' },
  { test: /com-tam|xoi/, group: 'Cơm / Xôi' },
  { test: /canh-|chao-/, group: 'Canh / Cháo / Lẩu' },
  { test: /goi-|nem-/, group: 'Salad / Gỏi' },
  { test: /banh-trang-tron|bot-chien|bap-nuong|pha-lau|tau-hu/, group: 'Ăn vặt / Đường phố' },
  { test: /bo-kho|bo-la-lot|ca-kho|ca-ri|ga-nuong|thit-kho/, group: 'Nướng / Kho / Xào' },
  { test: /banh-mi/, group: 'Bánh mì / Sandwich' },
];

function inferGroup(slug) {
  for (const { test, group } of GROUP_MAP) {
    if (test.test(slug)) return group;
  }
  return 'Khác';
}

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Kết nối MongoDB thành công');

  const foods = await Food.find({}).lean();
  let updatedStatus = 0, updatedCode = 0, updatedGroup = 0;

  for (let i = 0; i < foods.length; i++) {
    const f = foods[i];
    const update = {};

    if (!f.status) { update.status = 'active'; updatedStatus++; }
    if (!f.foodCode) { update.foodCode = `FOD-VN-${String(i + 1).padStart(4, '0')}`; updatedCode++; }
    if (!f.foodGroup) { update.foodGroup = inferGroup(f.slug); updatedGroup++; }

    if (Object.keys(update).length > 0) {
      await Food.updateOne({ _id: f._id }, { $set: update });
    }
  }

  console.log(`✅ Migration hoàn tất:`);
  console.log(`   status gán: ${updatedStatus} | foodCode gán: ${updatedCode} | foodGroup gán: ${updatedGroup}`);
  await mongoose.disconnect();
}

migrate().catch((err) => { console.error('❌ Migration thất bại:', err.message); process.exit(1); });
