const mongoose = require('mongoose');
const Food = require('../models/Food');
const MealLog = require('../models/MealLog');
const AdminActionLog = require('../models/AdminActionLog');

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}

function normalizePagination(page, limit) {
  const normalizedPage = Math.max(Number.parseInt(page, 10) || 1, 1);
  const normalizedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);
  return { page: normalizedPage, limit: normalizedLimit, skip: (normalizedPage - 1) * normalizedLimit };
}

// Tạo food code theo format FOD-VN-XXXX (hệ thống tự động sinh, đảm bảo duy nhất)
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

async function listFoods(req, res) {
  try {
    const { search = '', status = 'all', foodGroup = 'all', page, limit } = req.query;
    if (status !== 'all' && !['active', 'hidden'].includes(status)) {
      return res.status(400).json({ message: 'Trạng thái lọc không hợp lệ' });
    }
    const query = {};
    // Foods seeded before status field existed have no status — treat them as active
    if (status === 'active') {
      query.$or = [{ status: 'active' }, { status: { $exists: false } }, { status: null }];
    } else if (status === 'hidden') {
      query.status = 'hidden';
    }
    if (search.trim()) query.name = { $regex: escapeRegex(search.trim()), $options: 'i' };
    if (foodGroup !== 'all' && foodGroup) query.foodGroup = foodGroup;

    const pagination = normalizePagination(page, limit);

    const [foods, total, totalAll, totalHidden] = await Promise.all([
      Food.find(query).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
      Food.countDocuments(query),
      Food.countDocuments({}),
      Food.countDocuments({ status: 'hidden' }),
    ]);

    const totalActive = totalAll - totalHidden;

    // Normalize status for old seeded foods
    const normalizedFoods = foods.map((f) => ({
      ...f,
      status: f.status || 'active',
    }));

    return res.status(200).json({
      data: normalizedFoods,
      pagination: { page: pagination.page, limit: pagination.limit, total, totalPages: Math.ceil(total / pagination.limit) },
      summary: { total: totalAll, active: totalActive, hidden: totalHidden },
    });
  } catch (err) {
    console.error('[listFoods] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể tải danh sách món ăn, vui lòng thử lại' });
  }
}

async function createFood(req, res) {
  try {
    const adminId = req.user.id;
    const { name, calories, protein, fat, carbs, servingSize, imageUrl, description, foodGroup } = req.body;

    const trimmedName = String(name || '').trim();
    if (!trimmedName) return res.status(400).json({ message: 'Tên món ăn không được để trống' });

    for (const [field, value] of Object.entries({ calories, protein, fat, carbs })) {
      const num = Number(value);
      if (value === undefined || value === null || value === '' || !Number.isFinite(num) || num < 0) {
        return res.status(400).json({ message: `Giá trị "${field}" không hợp lệ — phải là số không âm` });
      }
    }
    const svNum = servingSize !== undefined && servingSize !== '' ? Number(servingSize) : 100;
    if (!Number.isFinite(svNum) || svNum <= 0) return res.status(400).json({ message: 'Đơn vị định lượng phải là số dương' });

    const existing = await Food.findOne({ name: { $regex: `^${escapeRegex(trimmedName)}$`, $options: 'i' } });
    if (existing) return res.status(409).json({ message: 'Tên món ăn đã tồn tại' });

    // Auto-generate slug
    const slug = trimmedName
      .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      + '-' + Date.now();

    // Auto-generate food code (system)
    const foodCode = await generateFoodCode();

    const food = await Food.create({
      slug, name: trimmedName, foodCode,
      foodGroup: String(foodGroup || '').trim() || null,
      calories: Number(calories), protein: Number(protein),
      fat: Number(fat), carbs: Number(carbs),
      servingSize: svNum,
      imageUrl: String(imageUrl || '').trim() || null,
      description: String(description || '').trim() || null,
      status: 'active',
    });

    await AdminActionLog.create({ adminId, actionType: 'create_food', targetType: 'FoodItem', targetId: food._id, reason: null });
    return res.status(201).json({ message: 'Thêm món ăn thành công', data: food });
  } catch (err) {
    console.error('[createFood] Lỗi:', err.message);
    return res.status(500).json({ message: 'Thao tác thất bại, vui lòng thử lại' });
  }
}

async function updateFood(req, res) {
  try {
    const adminId = req.user.id;
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Mã món ăn không hợp lệ' });

    const food = await Food.findById(id);
    if (!food) return res.status(404).json({ message: 'Món ăn không tồn tại' });

    const { name, calories, protein, fat, carbs, servingSize, imageUrl, description, foodGroup } = req.body;
    const trimmedName = String(name || '').trim();
    if (!trimmedName) return res.status(400).json({ message: 'Tên món ăn không được để trống' });

    for (const [field, value] of Object.entries({ calories, protein, fat, carbs })) {
      const num = Number(value);
      if (value === undefined || value === null || value === '' || !Number.isFinite(num) || num < 0) {
        return res.status(400).json({ message: `Giá trị "${field}" không hợp lệ — phải là số không âm` });
      }
    }
    const svNum = servingSize !== undefined && servingSize !== '' ? Number(servingSize) : food.servingSize;
    if (!Number.isFinite(svNum) || svNum <= 0) return res.status(400).json({ message: 'Đơn vị định lượng phải là số dương' });

    const existing = await Food.findOne({ _id: { $ne: food._id }, name: { $regex: `^${escapeRegex(trimmedName)}$`, $options: 'i' } });
    if (existing) return res.status(409).json({ message: 'Tên món ăn đã tồn tại' });

    food.name = trimmedName;
    food.calories = Number(calories); food.protein = Number(protein);
    food.fat = Number(fat); food.carbs = Number(carbs);
    food.servingSize = svNum;
    food.imageUrl = String(imageUrl || '').trim() || null;
    food.description = String(description || '').trim() || null;
    food.foodGroup = String(foodGroup || '').trim() || null;
    if (!food.foodCode) food.foodCode = await generateFoodCode();

    await food.save();
    await AdminActionLog.create({ adminId, actionType: 'update_food', targetType: 'FoodItem', targetId: food._id, reason: null });
    return res.status(200).json({ message: 'Cập nhật món ăn thành công', data: food });
  } catch (err) {
    console.error('[updateFood] Lỗi:', err.message);
    return res.status(500).json({ message: 'Thao tác thất bại, vui lòng thử lại' });
  }
}

async function updateFoodStatus(req, res) {
  try {
    const adminId = req.user.id;
    const { id } = req.params;
    const { status } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Mã món ăn không hợp lệ' });
    if (!['active', 'hidden'].includes(status)) return res.status(400).json({ message: 'Trạng thái không hợp lệ' });

    const food = await Food.findById(id);
    if (!food) return res.status(404).json({ message: 'Món ăn không tồn tại' });

    // Treat missing/null status as active for comparison
    const currentStatus = food.status || 'active';
    if (currentStatus === status) return res.status(409).json({ message: 'Món ăn đã ở trạng thái này' });

    food.status = status;
    await food.save();

    await AdminActionLog.create({
      adminId,
      actionType: status === 'hidden' ? 'hide_food' : 'show_food',
      targetType: 'FoodItem', targetId: food._id, reason: null,
    });

    const msg = status === 'hidden' ? 'Ẩn món ăn thành công' : 'Hiển thị lại món ăn thành công';
    return res.status(200).json({ message: msg, data: { ...food.toObject(), status: food.status } });
  } catch (err) {
    console.error('[updateFoodStatus] Lỗi:', err.message);
    return res.status(500).json({ message: 'Thao tác thất bại, vui lòng thử lại' });
  }
}

async function deleteFood(req, res) {
  try {
    const adminId = req.user.id;
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Mã món ăn không hợp lệ' });

    const food = await Food.findById(id);
    if (!food) return res.status(404).json({ message: 'Món ăn không tồn tại' });

    const refCount = await MealLog.countDocuments({ foodSlug: food.slug });
    if (refCount > 0) {
      return res.status(409).json({
        message: `Món ăn đang được người dùng sử dụng trong ${refCount} nhật ký bữa ăn, không thể xóa. Bạn có muốn chuyển sang trạng thái Ẩn thay thế không?`,
        refCount,
        canHide: (food.status || 'active') !== 'hidden',
      });
    }

    await food.deleteOne();
    await AdminActionLog.create({ adminId, actionType: 'delete_food', targetType: 'FoodItem', targetId: food._id, reason: 'Xóa vĩnh viễn' });
    return res.status(200).json({ message: 'Xóa món ăn thành công' });
  } catch (err) {
    console.error('[deleteFood] Lỗi:', err.message);
    return res.status(500).json({ message: 'Thao tác thất bại, vui lòng thử lại' });
  }
}

module.exports = { listFoods, createFood, updateFood, updateFoodStatus, deleteFood };
