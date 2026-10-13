const mongoose = require('mongoose');
const FoodRequest = require('../models/FoodRequest');
const Food = require('../models/Food');
const Notification = require('../models/Notification');
const AdminActionLog = require('../models/AdminActionLog');
const User = require('../models/User');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizePagination(page, limit) {
  const normalizedPage = Math.max(Number.parseInt(page, 10) || 1, 1);
  const normalizedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 10, 1), 100);
  return { page: normalizedPage, limit: normalizedLimit, skip: (normalizedPage - 1) * normalizedLimit };
}

// Tự động sinh mã món ăn theo format FOD-VN-XXXX
async function generateFoodCode() {
  const latest = await Food.findOne({ foodCode: /^FOD-VN-\d+$/ }).sort({ foodCode: -1 }).lean();
  let nextNum = 1;
  if (latest && latest.foodCode) {
    const match = latest.foodCode.match(/FOD-VN-(\d+)/);
    if (match) {
      nextNum = Number.parseInt(match[1], 10) + 1;
    }
  }
  let candidate = `FOD-VN-${String(nextNum).padStart(4, '0')}`;
  while (await Food.exists({ foodCode: candidate })) {
    nextNum++;
    candidate = `FOD-VN-${String(nextNum).padStart(4, '0')}`;
  }
  return candidate;
}

// Tự động tạo slug không dấu từ tên món
function generateSlug(name) {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') +
    '-' +
    Date.now()
  );
}

/**
 * GET /api/admin/food-requests
 * Danh sách yêu cầu bổ sung món kèm bộ lọc, thống kê và phân trang
 */
async function listFoodRequests(req, res) {
  try {
    const { search = '', status = 'all', sort = 'newest', page, limit } = req.query;

    const query = {};
    if (status && status !== 'all') {
      if (!['pending', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: 'Trạng thái lọc không hợp lệ' });
      }
      query.status = status;
    }

    if (search.trim()) {
      const escaped = escapeRegex(search.trim());
      // Tìm theo tên món, mã yêu cầu, hoặc người gửi
      const matchedUsers = await User.find({
        $or: [
          { fullName: { $regex: escaped, $options: 'i' } },
          { email: { $regex: escaped, $options: 'i' } },
        ],
      }).select('_id').lean();
      const userIds = matchedUsers.map((u) => u._id);

      query.$or = [
        { foodName: { $regex: escaped, $options: 'i' } },
        { requestCode: { $regex: escaped, $options: 'i' } },
        { userId: { $in: userIds } },
      ];
    }

    let sortOptions = { createdAt: -1 };
    if (sort === 'oldest') {
      sortOptions = { createdAt: 1 };
    } else if (sort === 'name_asc' || sort === 'a-z') {
      sortOptions = { foodName: 1 };
    } else if (sort === 'name_desc' || sort === 'z-a') {
      sortOptions = { foodName: -1 };
    }

    const { page: currentPage, limit: currentLimit, skip } = normalizePagination(page, limit);

    // Tính toán số liệu thống kê tổng quan (KPI cards)
    const [total, pending, approved, rejected] = await Promise.all([
      FoodRequest.countDocuments({}),
      FoodRequest.countDocuments({ status: 'pending' }),
      FoodRequest.countDocuments({ status: 'approved' }),
      FoodRequest.countDocuments({ status: 'rejected' }),
    ]);

    const totalFiltered = await FoodRequest.countDocuments(query);
    const requests = await FoodRequest.find(query)
      .populate('userId', 'fullName email avatarUrl role')
      .populate('reviewedBy', 'fullName email avatarUrl')
      .populate('approvedFoodId', 'name foodCode slug imageUrl calories protein fat carbs foodGroup status')
      .sort(sortOptions)
      .skip(skip)
      .limit(currentLimit)
      .lean();

    return res.status(200).json({
      data: requests,
      pagination: {
        page: currentPage,
        limit: currentLimit,
        total: totalFiltered,
        totalPages: Math.ceil(totalFiltered / currentLimit) || 1,
      },
      summary: {
        total,
        pending,
        approved,
        rejected,
      },
    });
  } catch (err) {
    console.error('[listFoodRequests] Lỗi:', err);
    return res.status(500).json({ message: 'Không thể tải danh sách yêu cầu bổ sung món' });
  }
}

/**
 * GET /api/admin/food-requests/:id
 * Lấy chi tiết yêu cầu bổ sung món và kiểm tra trùng tên món trong danh mục chính thức
 */
async function getFoodRequestDetail(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Mã yêu cầu không hợp lệ' });
    }

    const request = await FoodRequest.findById(id)
      .populate('userId', 'fullName email avatarUrl role')
      .populate('reviewedBy', 'fullName email avatarUrl')
      .populate('approvedFoodId', 'name foodCode slug imageUrl calories protein fat carbs foodGroup status')
      .lean();

    if (!request) {
      return res.status(404).json({ message: 'Yêu cầu không tồn tại' });
    }

    // Kiểm tra trùng tên món trong danh mục FoodItem chính thức (Luồng chính 5, Ngoại lệ 5b, 6b)
    const cleanName = request.foodName.trim();
    const words = cleanName.split(/\s+/).filter((w) => w.length >= 2);
    const matchConditions = [
      { name: { $regex: escapeRegex(cleanName), $options: 'i' } },
    ];
    words.forEach((w) => {
      matchConditions.push({ name: { $regex: `^${escapeRegex(w)}$`, $options: 'i' } });
      matchConditions.push({ name: { $regex: `^${escapeRegex(w)}\\b`, $options: 'i' } });
    });

    const matchedFoods = await Food.find({ $or: matchConditions })
      .select('name foodCode slug imageUrl calories protein fat carbs foodGroup status servingSize')
      .limit(5)
      .lean();

    const isDuplicate = matchedFoods.length > 0;

    return res.status(200).json({
      data: request,
      duplicateWarning: {
        isDuplicate,
        matchedFoods,
        message: isDuplicate ? 'Món ăn có thể đã tồn tại trong danh mục chính thức' : null,
      },
    });
  } catch (err) {
    console.error('[getFoodRequestDetail] Lỗi:', err);
    return res.status(500).json({ message: 'Thao tác thất bại, vui lòng thử lại' });
  }
}

/**
 * POST /api/admin/food-requests/:id/approve
 * Phê duyệt yêu cầu, tạo món ăn mới trong FoodItem chính thức và gửi thông báo
 */
async function approveFoodRequest(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Mã yêu cầu không hợp lệ' });
    }

    const request = await FoodRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: 'Yêu cầu không tồn tại' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        message: `Yêu cầu này đã được xử lý trước đó (${request.status === 'approved' ? 'Đã duyệt' : 'Đã từ chối'})`,
      });
    }

    const {
      foodName,
      foodGroup,
      servingSize,
      servingLabel,
      calories,
      protein,
      fat,
      carbs,
      imageUrl,
      description,
      adminNote,
    } = req.body;

    const finalFoodName = String(foodName || request.foodName || '').trim();
    if (!finalFoodName) {
      return res.status(400).json({ message: 'Tên món ăn không được để trống' });
    }

    // Ràng buộc Ngoại lệ 7c: Thiếu Calo/100g khi Admin nhấn Duyệt
    if (
      calories === undefined ||
      calories === null ||
      calories === '' ||
      !Number.isFinite(Number(calories)) ||
      Number(calories) < 0
    ) {
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ Calo/100g trước khi duyệt' });
    }

    // Kiểm tra các chỉ số đa lượng khác
    const numProtein = protein !== undefined && protein !== '' ? Number(protein) : (request.protein || 0);
    const numFat = fat !== undefined && fat !== '' ? Number(fat) : (request.fat || 0);
    const numCarbs = carbs !== undefined && carbs !== '' ? Number(carbs) : (request.carbs || 0);

    if (
      !Number.isFinite(numProtein) || numProtein < 0 ||
      !Number.isFinite(numFat) || numFat < 0 ||
      !Number.isFinite(numCarbs) || numCarbs < 0
    ) {
      return res.status(400).json({ message: 'Các chỉ số dinh dưỡng (Protein, Fat, Carbs) phải là số không âm' });
    }

    const svSize = servingSize !== undefined && servingSize !== '' ? Number(servingSize) : (request.servingSize || 100);
    if (!Number.isFinite(svSize) || svSize <= 0) {
      return res.status(400).json({ message: 'Đơn vị định lượng (khẩu phần) phải là số dương' });
    }

    // 1. Tạo món ăn chính thức trong Food
    const foodCode = await generateFoodCode();
    const slug = generateSlug(finalFoodName);

    const newFood = await Food.create({
      slug,
      name: finalFoodName,
      foodCode,
      foodGroup: String(foodGroup || request.foodGroup || '').trim() || null,
      servingSize: svSize,
      calories: Number(calories),
      protein: numProtein,
      fat: numFat,
      carbs: numCarbs,
      imageUrl: String(imageUrl || request.imageUrl || '').trim() || null,
      description: String(description || request.description || '').trim() || null,
      status: 'active', // Đang sử dụng (Luồng chính 7)
    });

    // 2. Cập nhật trạng thái yêu cầu thành "Đã duyệt"
    request.status = 'approved';
    request.approvedFoodId = newFood._id;
    request.reviewedBy = req.user.id || req.user._id;
    request.reviewedAt = new Date();
    request.adminNote = String(adminNote || '').trim() || null;
    request.foodName = finalFoodName;
    request.calories = Number(calories);
    request.protein = numProtein;
    request.fat = numFat;
    request.carbs = numCarbs;
    if (foodGroup) request.foodGroup = foodGroup;
    if (servingLabel) request.servingLabel = servingLabel;
    if (imageUrl) request.imageUrl = imageUrl;
    await request.save();

    // 3. Gửi thông báo cho người dùng đã gửi yêu cầu (Luồng chính 8)
    await Notification.create({
      userId: request.userId,
      title: 'Yêu cầu thêm món ăn đã được duyệt',
      message: `Món ăn "${newFood.name}" mà bạn đề xuất đã được Ban Quản Trị phê duyệt và thêm vào danh mục món ăn chính thức.`,
      type: 'food_request_approved',
      data: {
        requestId: request._id,
        requestCode: request.requestCode,
        foodId: newFood._id,
        foodName: newFood.name,
        foodCode: newFood.foodCode,
      },
    });

    // 4. Ghi nhật ký thao tác Admin
    await AdminActionLog.create({
      adminId: req.user.id || req.user._id,
      actionType: 'approve_request',
      targetType: 'Request',
      targetId: request._id,
      reason: `Phê duyệt yêu cầu thêm món "${newFood.name}"`,
      note: `Mã món mới: ${newFood.foodCode} | Mã yêu cầu: ${request.requestCode || request._id}${adminNote ? ' | ' + adminNote : ''}`,
    });

    return res.status(200).json({
      message: 'Phê duyệt yêu cầu thành công. Món ăn đã được thêm vào danh mục chính thức.',
      data: {
        request,
        food: newFood,
      },
    });
  } catch (err) {
    console.error('[approveFoodRequest] Lỗi:', err);
    // Luồng ngoại lệ 7d, 8d
    return res.status(500).json({ message: 'Thao tác thất bại, vui lòng thử lại' });
  }
}

/**
 * POST /api/admin/food-requests/:id/reject
 * Từ chối yêu cầu, bắt buộc có lý do và gửi thông báo tới người dùng
 */
async function rejectFoodRequest(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Mã yêu cầu không hợp lệ' });
    }

    const request = await FoodRequest.findById(id);
    if (!request) {
      return res.status(404).json({ message: 'Yêu cầu không tồn tại' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        message: `Yêu cầu này đã được xử lý trước đó (${request.status === 'approved' ? 'Đã duyệt' : 'Đã từ chối'})`,
      });
    }

    // Luồng thay thế 7a, 8a: Bắt buộc nhập lý do từ chối
    const reason = String(req.body.reason || '').trim();
    if (!reason) {
      return res.status(400).json({ message: 'Vui lòng nhập lý do từ chối' });
    }

    const adminNote = String(req.body.adminNote || '').trim() || null;

    // 1. Cập nhật trạng thái yêu cầu thành "Từ chối" kèm lý do (Luồng thay thế 9a)
    request.status = 'rejected';
    request.rejectionReason = reason;
    request.reviewedBy = req.user.id || req.user._id;
    request.reviewedAt = new Date();
    request.adminNote = adminNote;
    await request.save();

    // 2. Gửi thông báo kết quả cho người dùng (Luồng thay thế 9a)
    await Notification.create({
      userId: request.userId,
      title: 'Yêu cầu thêm món ăn đã bị từ chối',
      message: `Yêu cầu thêm món "${request.foodName}" đã bị từ chối. Lý do: ${reason}`,
      type: 'food_request_rejected',
      data: {
        requestId: request._id,
        requestCode: request.requestCode,
        foodName: request.foodName,
        reason,
      },
    });

    // 3. Ghi nhật ký thao tác Admin
    await AdminActionLog.create({
      adminId: req.user.id || req.user._id,
      actionType: 'reject_request',
      targetType: 'Request',
      targetId: request._id,
      reason,
      note: `Mã yêu cầu: ${request.requestCode || request._id}${adminNote ? ' | ' + adminNote : ''}`,
    });

    return res.status(200).json({
      message: 'Đã từ chối yêu cầu thành công',
      data: request,
    });
  } catch (err) {
    console.error('[rejectFoodRequest] Lỗi:', err);
    // Luồng ngoại lệ 7d, 8d
    return res.status(500).json({ message: 'Thao tác thất bại, vui lòng thử lại' });
  }
}

module.exports = {
  listFoodRequests,
  getFoodRequestDetail,
  approveFoodRequest,
  rejectFoodRequest,
};
