require('dotenv').config({ quiet: true });

const mongoose = require('mongoose');

const EXPECTED_DATABASE = 'HealthyAndWeightManagement';
const TARGET_COLLECTIONS = ['media.files', 'media.chunks'];

async function main() {
  if (!process.env.MONGO_URI) throw new Error('Thiếu MONGO_URI trong backend/.env');

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  if (db.databaseName !== EXPECTED_DATABASE) {
    throw new Error(`Sai database (${db.databaseName}); chỉ cho phép dọn ${EXPECTED_DATABASE}`);
  }

  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name)
  );
  console.log(`Database xác nhận: ${db.databaseName}`);

  for (const name of TARGET_COLLECTIONS) {
    if (!existing.has(name)) {
      console.log(`Không tồn tại, bỏ qua: ${name}`);
      continue;
    }

    const count = await db.collection(name).countDocuments();
    await db.dropCollection(name);
    console.log(`Đã xóa ${name} (${count} document)`);
  }

  const remaining = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name)
  );
  const leftovers = TARGET_COLLECTIONS.filter((name) => remaining.has(name));
  if (leftovers.length) throw new Error(`Vẫn còn collection: ${leftovers.join(', ')}`);

  console.log('Hoàn tất: media.files và media.chunks không còn trong database.');
}

main()
  .catch((error) => {
    console.error('Không thể dọn GridFS:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
