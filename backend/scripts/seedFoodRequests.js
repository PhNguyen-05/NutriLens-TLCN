/**
 * seedFoodRequests.js
 * Script tạo dữ liệu mẫu cho bảng FoodRequest phục vụ chức năng Duyệt yêu cầu bổ sung món ăn.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const FoodRequest = require('../src/models/FoodRequest');
const Food = require('../src/models/Food');
const User = require('../src/models/User');

async function seedFoodRequests() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/nutrilens';
    console.log('[Seed] Đang kết nối tới MongoDB...');
    await mongoose.connect(mongoUri);

    const admin = await User.findOne({ role: 'admin' });
    const users = await User.find({ role: 'user' });

    if (!users.length) {
      console.error('[Seed] Chưa có người dùng thường (role: user) nào trong DB. Vui lòng tạo user trước.');
      process.exit(1);
    }

    console.log(`[Seed] Tìm thấy admin: ${admin?.fullName || 'N/A'}, và ${users.length} người dùng.`);

    // Xoá dữ liệu yêu cầu cũ để tạo mới đồng bộ
    await FoodRequest.deleteMany({});
    console.log('[Seed] Đã dọn dẹp các yêu cầu cũ.');

    const requestsData = [
      {
        requestCode: 'REQ-0001',
        userId: users[0]._id,
        foodName: 'Bánh mì chảo Đà Lạt',
        foodGroup: 'Món ăn sáng & Đường phố',
        servingSize: 250,
        servingLabel: '1 chảo (250g)',
        calories: 450,
        protein: 18.5,
        fat: 22.0,
        carbs: 45.0,
        imageUrl: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=600&q=80',
        description: 'Bánh mì chảo gồm pate xá xíu, trứng ốp la, xúc xích và sốt cà chua ấm nóng đặc trưng Đà Lạt.',
        status: 'pending',
      },
      {
        requestCode: 'REQ-0002',
        userId: users[1] ? users[1]._id : users[0]._id,
        foodName: 'Phở bò', // Trùng tên để kiểm tra luồng ngoại lệ 5b cảnh báo trùng món
        foodGroup: 'Món nước & Sợi',
        servingSize: 350,
        servingLabel: '1 tô (350g)',
        calories: 480,
        protein: 24.0,
        fat: 12.0,
        carbs: 68.0,
        imageUrl: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=600&q=80',
        description: 'Tô phở bò nước trong hầm từ xương bò 12 tiếng kèm nạm gầu thơm lừng quế hồi.',
        status: 'pending',
      },
      {
        requestCode: 'REQ-0003',
        userId: users[2] ? users[2]._id : users[0]._id,
        foodName: 'Trà đào cam sả', // Để trống calo để kiểm tra luồng ngoại lệ 7c (bắt buộc calo trước khi duyệt)
        foodGroup: 'Đồ uống & Tráng miệng',
        servingSize: 300,
        servingLabel: '1 ly (300ml)',
        calories: null,
        protein: 0.5,
        fat: 0.1,
        carbs: 28.0,
        imageUrl: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=600&q=80',
        description: 'Trà đào thơm nồng mùi sả tươi, điểm xuyết vị chua thanh của cam vàng và đào ngâm giòn ngọt.',
        status: 'pending',
      },
      {
        requestCode: 'REQ-0004',
        userId: users[3] ? users[3]._id : users[0]._id,
        foodName: 'Bún ốc sườn chua',
        foodGroup: 'Món nước & Sợi',
        servingSize: 400,
        servingLabel: '1 bát (400g)',
        calories: 510,
        protein: 22.0,
        fat: 16.5,
        carbs: 65.0,
        imageUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80',
        description: 'Bún ốc bươu giòn sần sật nấu với sườn thăn, cà chua, bỗng rượu chua thanh đặc sản Hà Nội.',
        status: 'pending',
      },
      {
        requestCode: 'REQ-0005',
        userId: users[4] ? users[4]._id : users[0]._id,
        foodName: 'Sữa chua nếp cẩm',
        foodGroup: 'Đồ uống & Tráng miệng',
        servingSize: 180,
        servingLabel: '1 hũ (180g)',
        calories: 195,
        protein: 4.8,
        fat: 3.5,
        carbs: 36.2,
        imageUrl: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=600&q=80',
        description: 'Nếp cẩm lên men ngọt bùi kết hợp cùng sữa chua sánh mịn nhà làm.',
        status: 'pending',
      },
      {
        requestCode: 'REQ-0006',
        userId: users[0]._id,
        foodName: 'Gà nướng muối ớt Tây Bắc',
        foodGroup: 'Món mặn & Thịt cá',
        servingSize: 300,
        servingLabel: '1 đĩa (300g)',
        calories: 520,
        protein: 42.0,
        fat: 28.0,
        carbs: 4.0,
        imageUrl: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=600&q=80',
        description: 'Gà ta nướng than hoa ướp mắc khén, hạt dổi và muối ớt cay nồng.',
        status: 'pending',
      },
      {
        requestCode: 'REQ-0007',
        userId: users[1] ? users[1]._id : users[0]._id,
        foodName: 'Bánh xèo miền Tây',
        foodGroup: 'Món chiên & Bánh',
        servingSize: 200,
        servingLabel: '1 cái (200g)',
        calories: 380,
        protein: 12.0,
        fat: 20.0,
        carbs: 38.0,
        imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
        description: 'Bánh xèo giòn rụm với nhân tôm thịt, giá đỗ và đậu xanh ăn kèm rau rừng.',
        status: 'pending',
      },
      {
        requestCode: 'REQ-0008',
        userId: users[0]._id,
        foodName: 'Cơm tấm sườn bì chả',
        foodGroup: 'Cơm & Món chính',
        servingSize: 350,
        servingLabel: '1 đĩa (350g)',
        calories: 650,
        protein: 32.0,
        fat: 25.0,
        carbs: 75.0,
        imageUrl: 'https://images.unsplash.com/photo-1555126634-323283e090fa?auto=format&fit=crop&w=600&q=80',
        description: 'Cơm tấm Sài Gòn đầy đủ sườn mỡ nướng than, bì heo trộn thính và chả trứng hấp.',
        status: 'approved',
        reviewedBy: admin ? admin._id : null,
        reviewedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        adminNote: 'Đã chuẩn hóa định lượng và thông tin dinh dưỡng theo Viện Dinh Dưỡng Quốc Gia.',
      },
      {
        requestCode: 'REQ-0009',
        userId: users[2] ? users[2]._id : users[0]._id,
        foodName: 'Pizza kem sầu riêng phô mai chảy',
        foodGroup: 'Thức ăn nhanh',
        servingSize: 300,
        servingLabel: '1 bánh nhỏ (300g)',
        calories: 820,
        protein: 16.0,
        fat: 42.0,
        carbs: 95.0,
        imageUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',
        description: 'Món ăn do quán tự sáng tạo kết hợp sầu riêng Ri6 và phô mai mozzarella.',
        status: 'rejected',
        rejectionReason: 'Món ăn mang tính chất địa phương cá nhân, chưa có bảng phân tích thành phần dinh dưỡng tiêu chuẩn được kiểm chứng.',
        reviewedBy: admin ? admin._id : null,
        reviewedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        adminNote: 'Từ chối do thiếu nguồn kiểm chứng dinh dưỡng.',
      },
    ];

    const inserted = await FoodRequest.insertMany(requestsData);
    console.log(`[Seed] Thành công! Đã thêm ${inserted.length} yêu cầu món ăn mẫu vào cơ sở dữ liệu.`);

    // Ghi nhật ký thao tác tương ứng vào AdminActionLog
    const AdminActionLog = require('../src/models/AdminActionLog');
    await AdminActionLog.deleteMany({ targetType: 'Request' });

    const approvedReq = inserted.find((r) => r.requestCode === 'REQ-0008');
    if (approvedReq && admin) {
      await AdminActionLog.create({
        adminId: admin._id,
        actionType: 'approve_request',
        targetType: 'Request',
        targetId: approvedReq._id,
        reason: `Phê duyệt yêu cầu thêm món "${approvedReq.foodName}"`,
        note: `Mã yêu cầu: ${approvedReq.requestCode} | Đã chuẩn hóa định lượng và thông tin dinh dưỡng`,
        createdAt: approvedReq.reviewedAt,
      });
    }

    const rejectedReq = inserted.find((r) => r.requestCode === 'REQ-0009');
    if (rejectedReq && admin) {
      await AdminActionLog.create({
        adminId: admin._id,
        actionType: 'reject_request',
        targetType: 'Request',
        targetId: rejectedReq._id,
        reason: rejectedReq.rejectionReason,
        note: `Mã yêu cầu: ${rejectedReq.requestCode} | ${rejectedReq.adminNote}`,
        createdAt: rejectedReq.reviewedAt,
      });
    }
    console.log('[Seed] Đã tạo lịch sử thao tác mẫu cho Duyệt và Từ chối yêu cầu món.');

    process.exit(0);
  } catch (err) {
    console.error('[Seed] Lỗi khi tạo dữ liệu:', err);
    process.exit(1);
  }
}

seedFoodRequests();
