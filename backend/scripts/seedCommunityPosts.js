'use strict';

require('dotenv').config();
const dns = require('dns');
const mongoose = require('mongoose');
const { CommunityPost } = require('../src/models/CommunityPost');
const User = require('../src/models/User');

const MONGO_URI = process.env.MONGO_URI;

async function seed() {
  if (MONGO_URI.startsWith('mongodb+srv://')) {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  }

  await mongoose.connect(MONGO_URI);
  console.log('[seedCommunity] Đã kết nối MongoDB');

  // Tìm 1 user để làm author
  let author = await User.findOne({ status: 'active' });
  if (!author) {
    author = await User.findOne();
  }

  if (!author) {
    console.log('[seedCommunity] Không tìm thấy user nào để tạo bài viết mẫu.');
    await mongoose.disconnect();
    process.exit(0);
  }

  const existingCount = await CommunityPost.countDocuments();
  if (existingCount > 0) {
    console.log(`[seedCommunity] Đã có ${existingCount} bài viết trong cộng đồng — bỏ qua seed.`);
    await mongoose.disconnect();
    process.exit(0);
  }

  const samplePosts = [
    {
      authorId: author._id,
      content: `Chia sẻ công thức Salad ức gà sốt mè rang siêu ngon cho các bạn đang ăn thâm hụt calo! 🥗✨\n\nNguyên liệu:\n- 150g Ức gà áp chảo (khoảng 165 kcal, 31g Protein)\n- 100g Xà lách thủy canh, dưa leo, cà chua bi (khoảng 25 kcal)\n- 1 muỗng sốt mè rang Kewpie (khoảng 45 kcal)\n\nTổng calo chỉ tầm 235 kcal mà cực kỳ no lâu và đủ đạm. Ai đang siết mỡ thử ngay nhé!`,
      tag: 'Công thức món ăn',
      status: 'published',
      imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
      likeCount: 12,
      likes: [author._id],
      comments: [
        {
          authorId: author._id,
          content: 'Món này ăn trưa đem đi làm cực tiện luôn bạn ơi!',
          createdAt: new Date(Date.now() - 3600000),
        },
      ],
      commentCount: 1,
    },
    {
      authorId: author._id,
      content: `Kinh nghiệm sau 3 tháng giảm 6kg bền vững cùng NutriLens: Đừng cắt tinh bột hoàn toàn! 💡\n\nTrước đây mình cứ nghĩ kiêng carbs là giảm cân nhanh nhất, nhưng chỉ được 1-2 tuần là bị thèm ngọt và kiệt sức. Từ khi chuyển sang tính calo thâm hụt 400-500 kcal/ngày và đổi sang carb chậm (khoai lang, yến mạch, gạo lứt), cơ thể tràn đầy năng lượng mà mỡ bụng vẫn giảm đều. Chúc cả nhà kiên trì!`,
      tag: 'Kinh nghiệm dinh dưỡng',
      status: 'published',
      likeCount: 24,
      likes: [],
      comments: [],
      commentCount: 0,
    },
    {
      authorId: author._id,
      content: `Hoàn thành chuỗi 14 ngày Cardio & Kháng lực liên tiếp! 💪🔥\n\nMỗi ngày duy trì 30 phút chạy bộ hoặc nhảy dây + 20 phút tập tạ tại nhà. Cân nặng mốc vừa được mở khóa đánh giá lại sau 14 ngày theo đúng hướng dẫn của NutriLens. Cảm giác người nhẹ nhõm và săn chắc rõ rệt. Cố lên anh em!`,
      tag: 'Quá trình tập luyện',
      status: 'published',
      imageUrl: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80',
      likeCount: 18,
      likes: [author._id],
      comments: [],
      commentCount: 0,
    },
  ];

  await CommunityPost.insertMany(samplePosts);
  console.log(`[seedCommunity] ✅ Đã tạo ${samplePosts.length} bài viết mẫu phong phú cho cộng đồng.`);

  await mongoose.disconnect();
  console.log('[seedCommunity] Hoàn tất ngắt kết nối.');
}

seed().catch((err) => {
  console.error('[seedCommunity] ❌ Lỗi:', err.message);
  process.exit(1);
});
