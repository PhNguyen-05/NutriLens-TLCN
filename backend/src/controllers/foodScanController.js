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

async function searchFoods(req, res, next) {
  try {
    const query = String(req.query.query || '').trim();
    const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = safeQuery
      ? { $or: [{ name: { $regex: safeQuery, $options: 'i' } }, { slug: { $regex: safeQuery, $options: 'i' } }] }
      : {};
    const foods = await Food.find(filter)
      .select('slug name description imageUrl servingSize calories protein fat carbs fiber sodium')
      .sort({ name: 1 })
      .limit(8)
      .lean();

    return res.status(200).json({ foods });
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

    const foodRequest = await FoodRequest.create({
      requestedBy: req.user.id,
      name,
      imageUrl: trimToNull(req.body.imageUrl),
      note: trimToNull(req.body.note),
      ...nutrition,
    });

    return res.status(201).json({
      message: 'Đã gửi yêu cầu bổ sung món ăn',
      request: foodRequest,
    });
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
      FoodRequest.find({ requestedBy: req.user.id })
        .select('name imageUrl caloriesPer100g proteinPer100g carbPer100g fatPer100g note status rejectReason reviewedAt createdAt updatedAt')
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean(),
      FoodRequest.countDocuments({ requestedBy: req.user.id }),
    ]);

    return res.status(200).json({ requests, total });
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
    const topSlug = aiResult.predictions[0]?.slug;
    const food = topSlug ? await Food.findOne({ slug: topSlug }).lean() : null;

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
   Body: JSON { foodSlug, foodName, confidence?, imageUrl?,
                servings?, date, mealType? }
   Lưu 1 bữa ăn vào nhật ký.
────────────────────────────────────────────────────────────── */
async function addMealLog(req, res, next) {
  try {
    const userId = req.user.id;
    const {
      foodSlug, foodName, confidence,
      imageUrl, servings = 1,
      date, mealType = 'lunch',
    } = req.body;

    if (!foodSlug || !foodName || !date) {
      return res.status(400).json({ message: 'Thiếu thông tin bắt buộc: foodSlug, foodName, date' });
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
      confidence: confidence ?? null,
      imageUrl: imageUrl ?? null,
      servings,
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

module.exports = { searchFoods, createFoodRequest, getFoodRequests, scanFood, addMealLog, getMealLogs, deleteMealLog };
