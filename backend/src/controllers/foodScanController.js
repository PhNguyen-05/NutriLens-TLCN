/**
 * foodScanController.js
 * UC13 - Nhận diện món ăn qua ảnh (EfficientNet-B3 via FastAPI).
 *
 * Endpoints:
 *   POST /api/food/scan          - Quét ảnh → trả kết quả AI + dinh dưỡng
 *   POST /api/food/meal-logs     - Lưu món vào nhật ký bữa ăn
 *   GET  /api/food/meal-logs     - Lấy nhật ký theo ngày
 *   DELETE /api/food/meal-logs/:id - Xoá 1 dòng trong nhật ký
 */

const { predictFood } = require('../utils/aiService');
const Food    = require('../models/Food');
const MealLog = require('../models/MealLog');
const FoodRequest = require('../models/FoodRequest');

const PENDING_FOOD_REQUEST_STATUSES = ['pending', 'Chờ duyệt'];

function readOptionalNumber(body, field, label) {
  const rawValue = body[field];
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return { value: null };
  }

  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < 0) {
    return { error: `${label} phải là số không âm` };
  }

  return { value };
}

function trimToNull(value) {
  const trimmed = String(value || '').trim();
  return trimmed || null;
}

function serializeFoodRequestForUser(request) {
  const plainRequest = typeof request.toObject === 'function' ? request.toObject() : request;
  const statusLabels = {
    pending: 'Chờ duyệt',
    approved: 'Đã duyệt',
    rejected: 'Từ chối',
    'Chờ duyệt': 'Chờ duyệt',
    'Đã duyệt': 'Đã duyệt',
    'Từ chối': 'Từ chối',
  };

  return {
    ...plainRequest,
    requestType: plainRequest.requestType || 'addition',
    name: plainRequest.name || plainRequest.foodName,
    caloriesPer100g: plainRequest.caloriesPer100g ?? plainRequest.calories,
    proteinPer100g: plainRequest.proteinPer100g ?? plainRequest.protein,
    carbPer100g: plainRequest.carbPer100g ?? plainRequest.carbs,
    fatPer100g: plainRequest.fatPer100g ?? plainRequest.fat,
    rejectReason: plainRequest.rejectReason || plainRequest.rejectionReason || null,
    status: statusLabels[plainRequest.status] || 'Chờ duyệt',
  };
}

async function searchFoods(req, res, next) {
  try {
    const query = String(req.query.query || '').trim();
    const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = {
      $and: [
        { $or: [{ status: 'active' }, { status: { $exists: false } }, { status: null }] },
      ],
    };
    if (safeQuery) {
      filter.$and.push({
        $or: [{ name: { $regex: safeQuery, $options: 'i' } }, { slug: { $regex: safeQuery, $options: 'i' } }],
      });
    }
    const foods = await Food.find(filter)
      .select('slug name description imageUrl servingSize calories protein fat carbs fiber sodium')
      .sort({ name: 1 })
      .limit(8)
      .lean();
    let hiddenFood = null;
    if (safeQuery) {
      hiddenFood = await Food.findOne({ status: 'hidden', name: { $regex: `^${safeQuery}$`, $options: 'i' } })
        .select('slug name imageUrl status')
        .lean();

      if (!hiddenFood) {
        hiddenFood = await Food.findOne({
          status: 'hidden',
          $or: [
            { name: { $regex: safeQuery, $options: 'i' } },
            { slug: { $regex: safeQuery, $options: 'i' } },
          ],
        })
          .select('slug name imageUrl status')
          .sort({ name: 1 })
          .lean();
      }
    }

    return res.status(200).json({ foods, hiddenFood });
  } catch (err) {
    next(err);
  }
}

/* ──────────────────────────────────────────────────────────────
   POST /api/food/requests
   Body: JSON { name, imageUrl?, caloriesPer100g?, proteinPer100g?,
                carbPer100g?, fatPer100g?, note? }
   Tạo yêu cầu bổ sung món ăn, trạng thái mặc định: Chờ duyệt.
────────────────────────────────────────────────────────────── */
async function createFoodRequest(req, res, next) {
  try {
    const requestType = trimToNull(req.body.requestType) || 'addition';
    if (requestType === 'reopen') {
      const targetFood = await Food.findOne({ slug: trimToNull(req.body.targetFoodSlug), status: 'hidden' });
      if (!targetFood) {
        return res.status(409).json({ message: 'Món ăn không còn ở trạng thái ẩn hoặc không tồn tại.' });
      }

      const feedbackReason = trimToNull(req.body.feedbackReason);
      if (!['reopen', 'nutrition', 'name_image', 'other'].includes(feedbackReason)) {
        return res.status(400).json({ message: 'Vui lòng chọn lý do gửi đề nghị.' });
      }

      const note = trimToNull(req.body.note);
      if (note && note.length > 500) {
        return res.status(400).json({ message: 'Nội dung phản hồi không được vượt quá 500 ký tự.' });
      }

      const existingRequest = await FoodRequest.findOne({
        requestedBy: req.user.id,
        targetFoodId: targetFood._id,
        requestType: 'reopen',
        status: { $in: PENDING_FOOD_REQUEST_STATUSES },
      }).lean();
      if (existingRequest) {
        return res.status(409).json({ message: 'Bạn đã gửi đề nghị mở lại món này và đang chờ Admin xem xét.' });
      }

      const reopenRequest = await FoodRequest.create({
        requestedBy: req.user.id,
        requestType: 'reopen',
        targetFoodId: targetFood._id,
        feedbackReason,
        name: targetFood.name,
        foodName: targetFood.name,
        imageUrl: targetFood.imageUrl,
        note,
      });
      return res.status(201).json({
        message: 'Đã gửi đề nghị mở lại món ăn',
        request: serializeFoodRequestForUser(reopenRequest),
      });
    }
    if (requestType !== 'addition') {
      return res.status(400).json({ message: 'Loại yêu cầu không hợp lệ.' });
    }

    const name = trimToNull(req.body.name);
    if (!name) {
      return res.status(400).json({ message: 'Tên món ăn là bắt buộc' });
    }

    const numericFields = [
      ['caloriesPer100g', 'Năng lượng'],
      ['proteinPer100g', 'Protein'],
      ['carbPer100g', 'Carbohydrate'],
      ['fatPer100g', 'Chất béo'],
    ];

    const nutrition = {};
    for (const [field, label] of numericFields) {
      const parsed = readOptionalNumber(req.body, field, label);
      if (parsed.error) {
        return res.status(400).json({ message: parsed.error });
      }
      nutrition[field] = parsed.value;
    }

    const uploadedImageUrl = req.file
      ? `${req.protocol}://${req.get('host')}/uploads/food-requests/${req.file.filename}`
      : null;

    const foodRequest = await FoodRequest.create({
      requestedBy: req.user.id,
      name,
      imageUrl: uploadedImageUrl || trimToNull(req.body.imageUrl),
      note: trimToNull(req.body.note),
      ...nutrition,
    });

    return res.status(201).json({
      message: 'Đã gửi yêu cầu bổ sung món ăn',
      request: serializeFoodRequestForUser(foodRequest),
    });
  } catch (err) {
    next(err);
  }
}

async function updateFoodRequest(req, res, next) {
  try {
    const ownerFilter = { $or: [{ requestedBy: req.user.id }, { userId: req.user.id }] };
    const existingRequest = await FoodRequest.findOne({ _id: req.params.id, ...ownerFilter });
    if (!existingRequest) {
      return res.status(404).json({ message: 'Không tìm thấy yêu cầu hoặc bạn không có quyền chỉnh sửa' });
    }
    if (!PENDING_FOOD_REQUEST_STATUSES.includes(existingRequest.status)) {
      return res.status(409).json({ message: 'Chỉ có thể chỉnh sửa yêu cầu đang chờ duyệt' });
    }
    if (existingRequest.requestType === 'reopen') {
      return res.status(409).json({ message: 'Đề nghị mở lại món ăn không thể chỉnh sửa; vui lòng gửi lại nếu cần thay đổi.' });
    }

    const name = trimToNull(req.body.name);
    if (!name) return res.status(400).json({ message: 'Tên món ăn là bắt buộc' });

    const numericFields = [
      ['caloriesPer100g', 'Năng lượng'],
      ['proteinPer100g', 'Protein'],
      ['carbPer100g', 'Carbohydrate'],
      ['fatPer100g', 'Chất béo'],
    ];
    const nutrition = {};
    for (const [field, label] of numericFields) {
      const parsed = readOptionalNumber(req.body, field, label);
      if (parsed.error) return res.status(400).json({ message: parsed.error });
      nutrition[field] = parsed.value;
    }

    const uploadedImageUrl = req.file
      ? `${req.protocol}://${req.get('host')}/uploads/food-requests/${req.file.filename}`
      : null;
    const imageUrl = uploadedImageUrl
      || (req.body.imageUrl !== undefined ? trimToNull(req.body.imageUrl) : existingRequest.imageUrl);
    const updatedRequest = await FoodRequest.findOneAndUpdate(
      { _id: req.params.id, status: { $in: PENDING_FOOD_REQUEST_STATUSES }, ...ownerFilter },
      {
        $set: {
          status: 'pending',
          name,
          foodName: name,
          imageUrl,
          note: trimToNull(req.body.note),
          ...nutrition,
          calories: nutrition.caloriesPer100g,
          protein: nutrition.proteinPer100g,
          carbs: nutrition.carbPer100g,
          fat: nutrition.fatPer100g,
        },
      },
      { new: true, runValidators: true }
    );

    if (!updatedRequest) {
      return res.status(409).json({ message: 'Chỉ có thể chỉnh sửa yêu cầu đang chờ duyệt' });
    }
    return res.status(200).json({ message: 'Đã cập nhật yêu cầu món ăn', request: serializeFoodRequestForUser(updatedRequest) });
  } catch (err) {
    next(err);
  }
}

async function deleteFoodRequest(req, res, next) {
  try {
    const ownerFilter = { $or: [{ requestedBy: req.user.id }, { userId: req.user.id }] };
    const deletedRequest = await FoodRequest.findOneAndDelete({
      _id: req.params.id,
      status: { $in: PENDING_FOOD_REQUEST_STATUSES },
      ...ownerFilter,
    });
    if (deletedRequest) return res.status(200).json({ message: 'Đã xóa yêu cầu món ăn' });

    const existingRequest = await FoodRequest.findOne({ _id: req.params.id, ...ownerFilter }).select('status');
    if (!existingRequest) {
      return res.status(404).json({ message: 'Không tìm thấy yêu cầu hoặc bạn không có quyền xóa' });
    }
    return res.status(409).json({ message: 'Chỉ có thể xóa yêu cầu đang chờ duyệt' });
  } catch (err) {
    next(err);
  }
}

/* ──────────────────────────────────────────────────────────────
   GET /api/food/requests?limit=3
   Lấy các yêu cầu bổ sung món ăn gần đây của user đang đăng nhập.
────────────────────────────────────────────────────────────── */
async function getFoodRequests(req, res, next) {
  try {
    const rawLimit = Number(req.query.limit || 3);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(50, Math.max(1, Math.floor(rawLimit)))
      : 3;

    const [requests, total] = await Promise.all([
      FoodRequest.find({ $or: [{ requestedBy: req.user.id }, { userId: req.user.id }] })
        .select('requestCode requestedBy userId requestType targetFoodId feedbackReason name foodName imageUrl caloriesPer100g proteinPer100g carbPer100g fatPer100g calories protein carbs fat note status rejectReason rejectionReason reviewedAt createdAt updatedAt')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      FoodRequest.countDocuments({ $or: [{ requestedBy: req.user.id }, { userId: req.user.id }] }),
    ]);

    return res.status(200).json({ requests: requests.map(serializeFoodRequestForUser), total });
  } catch (err) {
    next(err);
  }
}

/* ──────────────────────────────────────────────────────────────
   POST /api/food/scan
   Body: multipart/form-data  { file: <image> }
   Trả về: { recognized, predictions, nutrition | null, message }
────────────────────────────────────────────────────────────── */
async function scanFood(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng đính kèm ảnh (field: file)' });
    }

    // 1. Gửi ảnh sang AI Service
    let aiResult;
    try {
      aiResult = await predictFood(req.file.buffer, req.file.mimetype, req.file.originalname);
    } catch (err) {
      const status = err.statusCode || 502;
      return res.status(status).json({ message: err.message });
    }

    // 2. Nếu AI không nhận ra món → trả luôn, không cần tra DB
    if (!aiResult.recognized) {
      return res.status(200).json({
        recognized: false,
        predictions: aiResult.predictions,
        nutrition: null,
        message: aiResult.message || 'Không nhận diện được món ăn trong ảnh',
      });
    }

    // 3. Tra cứu dinh dưỡng từ DB cho top-1
    const topPrediction = aiResult.predictions[0];
    const topSlug = topPrediction?.slug;
    let food = topSlug ? await Food.findOne({ slug: topSlug }).lean() : null;
    if (!food && topPrediction?.name) {
      food = await Food.findOne({
        status: 'hidden',
        $expr: { $eq: [{ $toLower: '$name' }, topPrediction.name.trim().toLowerCase()] },
      }).lean();
    }

    if (food?.status === 'hidden') {
      return res.status(200).json({
        recognized: true,
        unavailable: true,
        predictions: aiResult.predictions,
        hiddenFood: { slug: food.slug, name: food.name, imageUrl: food.imageUrl },
        nutrition: null,
        message: 'Món ăn không khả dụng trong danh mục',
      });
    }

    return res.status(200).json({
      recognized: true,
      predictions: aiResult.predictions,
      nutrition: food
        ? {
            foodSlug:    food.slug,
            foodName:    food.name,
            servingSize: food.servingSize,
            calories:    food.calories,
            protein:     food.protein,
            fat:         food.fat,
            carbs:       food.carbs,
            fiber:       food.fiber,
            sodium:      food.sodium,
          }
        : null, // chưa có dữ liệu dinh dưỡng trong DB
      message: food ? null : 'Nhận diện thành công nhưng chưa có dữ liệu dinh dưỡng',
    });
  } catch (err) {
    next(err);
  }
}

/* ──────────────────────────────────────────────────────────────
   POST /api/food/meal-logs
   Body: multipart/form-data { foodSlug, foodName, confidence?, imageUrl?, image?,
                              servings?, date, mealType? }
   Lưu 1 bữa ăn vào nhật ký.
────────────────────────────────────────────────────────────── */
async function addMealLog(req, res, next) {
  try {
    const userId = req.user.id;
    const {
      foodSlug, foodName, confidence,
      imageUrl, servings = 1,
      date, mealType, timezoneOffsetMinutes = 0,
    } = req.body;

    if (!foodSlug || !foodName || !date) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc: foodSlug, foodName, date' });
    }
    const parsedDate = new Date(`${date}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
      return res.status(400).json({ message: 'Ngày ghi nhận không hợp lệ' });
    }
    if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(mealType)) {
      return res.status(400).json({ message: 'Vui lòng chọn loại bữa ăn' });
    }
    const timezoneOffset = Number(timezoneOffsetMinutes);
    if (!Number.isInteger(timezoneOffset) || Math.abs(timezoneOffset) > 840) {
      return res.status(400).json({ message: 'Múi giờ không hợp lệ' });
    }
    const localToday = new Date(Date.now() - timezoneOffset * 60_000).toISOString().slice(0, 10);
    if (date > localToday) {
      return res.status(400).json({ message: 'Không thể thêm món ăn vào ngày trong tương lai' });
    }

    // Lấy snapshot dinh dưỡng từ DB
    const food = await Food.findOne({ slug: foodSlug }).lean();
    const nutrition = food
      ? {
          servingSize: food.servingSize,
          calories:    food.calories,
          protein:     food.protein,
          fat:         food.fat,
          carbs:       food.carbs,
          fiber:       food.fiber,
          sodium:      food.sodium,
        }
      : {};

    const log = await MealLog.create({
      userId,
      date,
      mealType,
      foodSlug,
      foodName,
      confidence: confidence === '' || confidence == null ? null : Number(confidence),
      imageUrl: req.file
        ? `${req.protocol}://${req.get('host')}/uploads/meal-logs/${req.file.filename}`
        : imageUrl || null,
      servings: Number(servings) || 1,
      nutrition,
    });

    return res.status(201).json({ message: 'Đã thêm vào nhật ký', mealLog: log });
  } catch (err) {
    next(err);
  }
}

/* ──────────────────────────────────────────────────────────────
   GET /api/food/meal-logs?date=YYYY-MM-DD
   Lấy tất cả bữa ăn trong ngày của user đang đăng nhập.
────────────────────────────────────────────────────────────── */
async function getMealLogs(req, res, next) {
  try {
    const userId = req.user.id;
    const { date } = req.query;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: 'Tham số date không hợp lệ (YYYY-MM-DD)' });
    }

    const logs = await MealLog.find({ userId, date }).sort({ createdAt: 1 }).lean();

    // Tính tổng dinh dưỡng trong ngày
    const totals = logs.reduce(
      (acc, log) => {
        const s = log.servings || 1;
        acc.calories += (log.nutrition?.calories || 0) * s;
        acc.protein  += (log.nutrition?.protein  || 0) * s;
        acc.fat      += (log.nutrition?.fat      || 0) * s;
        acc.carbs    += (log.nutrition?.carbs    || 0) * s;
        return acc;
      },
      { calories: 0, protein: 0, fat: 0, carbs: 0 }
    );

    // Làm tròn 1 chữ số thập phân
    Object.keys(totals).forEach((k) => { totals[k] = Math.round(totals[k] * 10) / 10; });

    return res.status(200).json({ date, logs, totals });
  } catch (err) {
    next(err);
  }
}

async function updateMealLog(req, res, next) {
  try {
    const updates = {};
    const { date, mealType, servings } = req.body;

    if (date !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: 'Ngày không hợp lệ (YYYY-MM-DD)' });
      }
      updates.date = date;
    }

    if (mealType !== undefined) {
      if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(mealType)) {
        return res.status(400).json({ message: 'Loại bữa ăn không hợp lệ' });
      }
      updates.mealType = mealType;
    }

    if (servings !== undefined) {
      const parsedServings = Number(servings);
      if (!Number.isFinite(parsedServings) || parsedServings < 0.1 || parsedServings > 99) {
        return res.status(400).json({ message: 'Khẩu phần phải từ 0,1 đến 99' });
      }
      updates.servings = parsedServings;
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: 'Không có thông tin cần cập nhật' });
    }

    const log = await MealLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    if (!log) {
      return res.status(404).json({ message: 'Không tìm thấy nhật ký hoặc bạn không có quyền cập nhật' });
    }

    return res.status(200).json({ message: 'Đã cập nhật nhật ký bữa ăn', mealLog: log });
  } catch (err) {
    next(err);
  }
}

/* ──────────────────────────────────────────────────────────────
   DELETE /api/food/meal-logs/:id
   Xoá 1 dòng nhật ký (chỉ được xoá của chính mình).
────────────────────────────────────────────────────────────── */
async function deleteMealLog(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const log = await MealLog.findOneAndDelete({ _id: id, userId });

    if (!log) {
      return res.status(404).json({ message: 'Không tìm thấy nhật ký hoặc bạn không có quyền xoá' });
    }

    return res.status(200).json({ message: 'Đã xoá khỏi nhật ký' });
  } catch (err) {
    next(err);
  }
}

module.exports = { searchFoods, createFoodRequest, updateFoodRequest, deleteFoodRequest, getFoodRequests, scanFood, addMealLog, getMealLogs, updateMealLog, deleteMealLog };
