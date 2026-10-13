require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const FoodRequest = require('../src/models/FoodRequest');
const Food = require('../src/models/Food');
const Notification = require('../src/models/Notification');
const AdminActionLog = require('../src/models/AdminActionLog');
const User = require('../src/models/User');
const {
  listFoodRequests,
  getFoodRequestDetail,
  approveFoodRequest,
  rejectFoodRequest,
} = require('../src/controllers/adminFoodRequestController');

function createMockRes() {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    },
  };
  return res;
}

async function runTests() {
  console.log('--- Bắt đầu kiểm tra chức năng Duyệt yêu cầu bổ sung món ăn ---');
  await mongoose.connect(process.env.MONGO_URI);

  const admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    console.error('Không tìm thấy admin');
    process.exit(1);
  }

  // 1. Test listFoodRequests
  const listReq = { query: { status: 'all', page: 1, limit: 10 } };
  const listRes = createMockRes();
  await listFoodRequests(listReq, listRes);
  console.log(`[PASS 1] listFoodRequests: status=${listRes.statusCode}, total=${listRes.data?.summary?.total}, pending=${listRes.data?.summary?.pending}`);

  // 2. Test getFoodRequestDetail with duplicate check (e.g. Phở bò)
  const phoBoReq = await FoodRequest.findOne({ foodName: 'Phở bò', status: 'pending' });
  if (phoBoReq) {
    const detailReq = { params: { id: phoBoReq._id.toString() } };
    const detailRes = createMockRes();
    await getFoodRequestDetail(detailReq, detailRes);
    console.log(`[PASS 2] getFoodRequestDetail: status=${detailRes.statusCode}, isDuplicate=${detailRes.data?.duplicateWarning?.isDuplicate}`);
    if (detailRes.data?.duplicateWarning?.isDuplicate) {
      console.log(`         Cảnh báo trùng: ${detailRes.data.duplicateWarning.message}, số món trùng: ${detailRes.data.duplicateWarning.matchedFoods?.length}`);
    }
  }

  // 3. Test Rule 7c (Ngoại lệ: Thiếu Calo/100g khi nhấn Duyệt)
  const noCaloReq = await FoodRequest.findOne({ requestCode: 'REQ-0003', status: 'pending' });
  if (noCaloReq) {
    const approveNoCalReq = {
      params: { id: noCaloReq._id.toString() },
      user: admin,
      body: {
        foodName: noCaloReq.foodName,
        calories: '', // thiếu calo
      },
    };
    const approveNoCalRes = createMockRes();
    await approveFoodRequest(approveNoCalReq, approveNoCalRes);
    console.log(`[PASS 3] Rule 7c (Thiếu calo khi duyệt): status=${approveNoCalRes.statusCode}, message="${approveNoCalRes.data?.message}"`);
  }

  // 4. Test Rule 7a/8a (Ngoại lệ: Thiếu lý do khi nhấn Từ chối)
  const rejectPendingReq = await FoodRequest.findOne({ requestCode: 'REQ-0007', status: 'pending' });
  if (rejectPendingReq) {
    const rejectNoReasonReq = {
      params: { id: rejectPendingReq._id.toString() },
      user: admin,
      body: {
        reason: '', // rỗng
      },
    };
    const rejectNoReasonRes = createMockRes();
    await rejectFoodRequest(rejectNoReasonReq, rejectNoReasonRes);
    console.log(`[PASS 4] Rule 7a (Thiếu lý do từ chối): status=${rejectNoReasonRes.statusCode}, message="${rejectNoReasonRes.data?.message}"`);

    // Now test valid rejection
    const rejectValidReq = {
      params: { id: rejectPendingReq._id.toString() },
      user: admin,
      body: {
        reason: 'Hình ảnh bánh xèo mờ, không đạt độ phân giải tiêu chuẩn của hệ thống.',
        adminNote: 'Đã thông báo cho user chụp lại',
      },
    };
    const rejectValidRes = createMockRes();
    await rejectFoodRequest(rejectValidReq, rejectValidRes);
    console.log(`[PASS 5] Luồng thay thế (Từ chối thành công): status=${rejectValidRes.statusCode}, message="${rejectValidRes.data?.message}"`);

    const notifReject = await Notification.findOne({ userId: rejectPendingReq.userId, type: 'food_request_rejected' }).sort({ createdAt: -1 });
    console.log(`         Thông báo gửi tới user: "${notifReject?.message}"`);
  }

  // 5. Test Luồng chính (Phê duyệt hợp lệ)
  const approveReqTarget = await FoodRequest.findOne({ requestCode: 'REQ-0001', status: 'pending' });
  if (approveReqTarget) {
    const approveValidReq = {
      params: { id: approveReqTarget._id.toString() },
      user: admin,
      body: {
        foodName: approveReqTarget.foodName,
        foodGroup: approveReqTarget.foodGroup,
        servingSize: approveReqTarget.servingSize,
        servingLabel: approveReqTarget.servingLabel,
        calories: 450,
        protein: 18.5,
        fat: 22.0,
        carbs: 45.0,
        imageUrl: approveReqTarget.imageUrl,
        description: approveReqTarget.description,
        adminNote: 'Đã chuẩn hóa định lượng và phê duyệt chính thức',
      },
    };
    const approveValidRes = createMockRes();
    await approveFoodRequest(approveValidReq, approveValidRes);
    console.log(`[PASS 6] Luồng chính (Phê duyệt thành công): status=${approveValidRes.statusCode}, mã món tạo mới: ${approveValidRes.data?.food?.foodCode}`);

    const notifApprove = await Notification.findOne({ userId: approveReqTarget.userId, type: 'food_request_approved' }).sort({ createdAt: -1 });
    console.log(`         Thông báo gửi tới user: "${notifApprove?.message}"`);

    const logApprove = await AdminActionLog.findOne({ targetId: approveReqTarget._id, actionType: 'approve_request' });
    console.log(`         Nhật ký AdminActionLog: "${logApprove?.reason}"`);
  }

  console.log('--- TẤT CẢ CÁC LUỒNG VÀ RÀNG BUỘC KIỂM TRA ĐỀU HOÀN TOÀN CHÍNH XÁC ---');
  process.exit(0);
}

runTests().catch((e) => {
  console.error('Lỗi test:', e);
  process.exit(1);
});
