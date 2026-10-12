require('dotenv').config();
const mongoose = require('mongoose');
const Food = require('../src/models/Food');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const total = await Food.countDocuments();
  const byStatus = await Food.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
  const byGroup = await Food.aggregate([{ $group: { _id: '$foodGroup', count: { $sum: 1 } } }]);
  const sample = await Food.find({}).limit(3).lean();
  console.log('Total foods:', total);
  console.log('By Status:', byStatus);
  console.log('By Group:', byGroup);
  console.log('Sample:', sample.map(s => ({ name: s.name, slug: s.slug, foodCode: s.foodCode, foodGroup: s.foodGroup, status: s.status })));
  await mongoose.disconnect();
}

check().catch(console.error);
