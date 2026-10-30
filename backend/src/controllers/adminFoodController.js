const mongoose = require('mongoose');
const Food = require('../models/Food');
const FoodGroup = require('../models/FoodGroup');
const FoodRequest = require('../models/FoodRequest');
const MealLog = require('../models/MealLog');
const AdminActionLog = require('../models/AdminActionLog');

const MAX_FOOD_IMAGE_BYTES = 5 * 1024 * 1024;

function parseInlineFoodImage(imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('data:')) return { image: null };

  const match = imageUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/i);
  if (!match) return { error: 'Ảnh món ăn phải là JPG, PNG hoặc WEBP hợp lệ' };

  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > MAX_FOOD_IMAGE_BYTES) {
    return { error: 'Ảnh món ăn rỗng hoặc vượt quá 5 MB' };
  }
  if (buffer.toString('base64') !== match[2]) return { error: 'Dữ liệu ảnh món ăn không hợp lệ' };

  return { image: { buffer, contentType: match[1].toLowerCase() } };
}

function validateFoodImageInput(imageUrl, currentImageUrl = null) {
  if (!imageUrl || imageUrl.startsWith('data:') || imageUrl === currentImageUrl) return null;
  return 'Hãy tải ảnh JPG, PNG hoặc WEBP lên để lưu ảnh món ăn trong MongoDB';
}

function getFoodImageUrl(foodId) {
  return `/api/food/${foodId.toString()}/image`;
}

function serializeFood(food) {
  const data = typeof food.toObject === 'function' ? food.toObject() : { ...food };
  delete data.imageData;
  delete data.imageContentType;
  return data;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}

function normalizePagination(page, limit) {
  const normalizedPage = Math.max(Number.parseInt(page, 10) || 1, 1);
  const normalizedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 10, 1), 100);
  return { page: normalizedPage, limit: normalizedLimit, skip: (normalizedPage - 1) * normalizedLimit };
}

function parseFoodAnalyticsDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

async function getFoodAnalytics(req, res) {
  try {
    const from = parseFoodAnalyticsDate(req.query.from);
    const to = parseFoodAnalyticsDate(req.query.to);
    if (!from || !to || from > to) {
      return res.status(400).json({ message: 'Khoảng ngày thống kê món ăn không hợp lệ' });
    }

    const start = new Date(`${from}T00:00:00.000+07:00`);
    const endExclusive = new Date(new Date(`${to}T00:00:00.000+07:00`).getTime() + 24 * 60 * 60 * 1000);
    if ((endExclusive.getTime() - start.getTime()) / (24 * 60 * 60 * 1000) > 366) {
      return res.status(400).json({ message: 'Khoảng ngày thống kê tối đa là 366 ngày' });
    }
    const dateMatch = { $gte: start, $lt: endExclusive };

    const [total, hidden, pendingRequests, categories, foodsAdded, foodStatusActions, reviewedRequests] = await Promise.all([
      Food.countDocuments({}),
      Food.countDocuments({ status: 'hidden' }),
      FoodRequest.countDocuments({ requestType: 'addition', status: 'pending' }),
      Food.aggregate([
        { $group: { _id: { $ifNull: ['$foodGroup', 'Món khác'] }, count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]),
      Food.aggregate([
        { $match: { createdAt: dateMatch } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Ho_Chi_Minh' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      AdminActionLog.aggregate([
        { $match: { targetType: 'FoodItem', actionType: { $in: ['show_food', 'hide_food'] }, createdAt: dateMatch } },
        { $group: { _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Ho_Chi_Minh' } }, action: '$actionType' }, count: { $sum: 1 } } },
        { $sort: { '_id.date': 1 } },
      ]),
      FoodRequest.aggregate([
        { $match: { requestType: 'addition', status: { $in: ['approved', 'rejected'] }, reviewedAt: dateMatch } },
        { $group: { _id: { date: { $dateToString: { format: '%Y-%m-%d', date: '$reviewedAt', timezone: 'Asia/Ho_Chi_Minh' } }, status: '$status' }, count: { $sum: 1 } } },
        { $sort: { '_id.date': 1 } },
      ]),
    ]);

    const daily = new Map();
    const ensureDay = (date) => {
      if (!daily.has(date)) daily.set(date, { date, added: 0, activated: 0, hidden: 0, approved: 0, rejected: 0 });
      return daily.get(date);
    };
    foodsAdded.forEach(({ _id, count }) => { ensureDay(_id).added = count; });
    foodStatusActions.forEach(({ _id, count }) => {
      ensureDay(_id.date)[_id.action === 'show_food' ? 'activated' : 'hidden'] = count;
    });
    reviewedRequests.forEach(({ _id, count }) => {
      ensureDay(_id.date)[_id.status] = count;
    });

    return res.status(200).json({
      summary: { total, active: Math.max(total - hidden, 0), hidden, pendingRequests },
      categories: categories.map(({ _id, count }) => ({ name: _id || 'Món khác', count })),
      daily: Array.from(daily.values()).sort((left, right) => left.date.localeCompare(right.date)),
    });
  } catch (err) {
    console.error('[getFoodAnalytics] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể tải thống kê món ăn, vui lòng thử lại' });
  }
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
    const { search = '', status = 'all', foodGroup = 'all', sort = 'newest', page, limit } = req.query;
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

    let sortOptions = { createdAt: -1 };
    let useCollation = false;
    if (sort === 'name_asc' || sort === 'a-z') {
      sortOptions = { name: 1 };
      useCollation = true;
    } else if (sort === 'name_desc' || sort === 'z-a') {
      sortOptions = { name: -1 };
      useCollation = true;
    } else if (sort === 'oldest') {
      sortOptions = { createdAt: 1 };
    }

    const pagination = normalizePagination(page, limit);

    let foodsQuery = Food.find(query).sort(sortOptions);
    if (useCollation) {
      foodsQuery = foodsQuery.collation({ locale: 'vi', strength: 1 });
    }

    const [foods, total, totalAll, totalHidden] = await Promise.all([
      foodsQuery.skip(pagination.skip).limit(pagination.limit).lean(),
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
    const normalizedImageUrl = String(imageUrl || '').trim() || null;
    const parsedImage = parseInlineFoodImage(normalizedImageUrl);
    if (parsedImage.error) return res.status(400).json({ message: parsedImage.error });
    const imageInputError = validateFoodImageInput(normalizedImageUrl);
    if (imageInputError) return res.status(400).json({ message: imageInputError });

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

    const food = new Food({
      slug, name: trimmedName, foodCode,
      foodGroup: String(foodGroup || '').trim() || null,
      calories: Number(calories), protein: Number(protein),
      fat: Number(fat), carbs: Number(carbs),
      servingSize: svNum,
      imageUrl: parsedImage.image ? null : normalizedImageUrl,
      imageData: parsedImage.image?.buffer || null,
      imageContentType: parsedImage.image?.contentType || null,
      description: String(description || '').trim() || null,
      status: 'active',
    });
    if (parsedImage.image) food.imageUrl = getFoodImageUrl(food._id);
    await food.save();

    await AdminActionLog.create({
      adminId,
      actionType: 'create_food',
      targetType: 'FoodItem',
      targetId: food._id,
      reason: `Thêm mới món "${food.name}"`,
      note: `Mã: ${food.foodCode || 'Chưa gán'} | Nhóm: ${food.foodGroup || 'Chưa phân nhóm'}`,
    });
    return res.status(201).json({ message: 'Thêm món ăn thành công', data: serializeFood(food) });
  } catch (err) {
    console.error('[createFood] Lỗi:', err.message);
    return res.status(500).json({ message: 'Thao tác thất bại, vui lòng thử lại' });
  }
}

/**
 * GET /api/admin/foods/:id
 * Lấy chi tiết món ăn kèm số lượng MealLog đang sử dụng.
 */
async function getFoodDetail(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Mã món ăn không hợp lệ' });

    const food = await Food.findById(id).lean();
    if (!food) return res.status(404).json({ message: 'Món ăn không tồn tại' });

    const mealLogCount = await MealLog.countDocuments({ foodSlug: food.slug });

    return res.status(200).json({
      data: {
        ...food,
        status: food.status || 'active',
        mealLogCount,
      },
    });
  } catch (err) {
    console.error('[getFoodDetail] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể tải chi tiết món ăn' });
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
    const normalizedImageUrl = String(imageUrl || '').trim() || null;
    const parsedImage = parseInlineFoodImage(normalizedImageUrl);
    if (parsedImage.error) return res.status(400).json({ message: parsedImage.error });
    const imageInputError = validateFoodImageInput(normalizedImageUrl, food.imageUrl);
    if (imageInputError) return res.status(400).json({ message: imageInputError });
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

    const isNameChanged = food.name.trim().toLowerCase() !== trimmedName.toLowerCase();
    if (isNameChanged) {
      const existing = await Food.findOne({ _id: { $ne: food._id }, name: { $regex: `^${escapeRegex(trimmedName)}$`, $options: 'i' } });
      if (existing) return res.status(409).json({ message: 'Tên món ăn đã tồn tại' });
    }

    food.name = trimmedName;
    food.calories = Number(calories); food.protein = Number(protein);
    food.fat = Number(fat); food.carbs = Number(carbs);
    food.servingSize = svNum;
    if (parsedImage.image) {
      food.imageData = parsedImage.image.buffer;
      food.imageContentType = parsedImage.image.contentType;
      food.imageUrl = getFoodImageUrl(food._id);
    } else {
      if (normalizedImageUrl !== food.imageUrl) {
        food.imageData = null;
        food.imageContentType = null;
      }
      food.imageUrl = normalizedImageUrl;
    }
    food.description = String(description || '').trim() || null;
    food.foodGroup = String(foodGroup || '').trim() || null;
    if (!food.foodCode) food.foodCode = await generateFoodCode();

    await food.save();
    await AdminActionLog.create({
      adminId,
      actionType: 'update_food',
      targetType: 'FoodItem',
      targetId: food._id,
      reason: `Cập nhật thông tin món "${food.name}"`,
      note: `Mã: ${food.foodCode} | Khẩu phần: ${food.servingSize}g`,
    });
    return res.status(200).json({ message: 'Cập nhật món ăn thành công', data: serializeFood(food) });
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
      targetType: 'FoodItem',
      targetId: food._id,
      reason: status === 'hidden' ? `Ẩn món "${food.name}" khỏi tìm kiếm & AI` : `Hiển thị lại món "${food.name}"`,
      note: `Mã: ${food.foodCode || 'Chưa gán'}`,
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
    await AdminActionLog.create({
      adminId,
      actionType: 'delete_food',
      targetType: 'FoodItem',
      targetId: food._id,
      reason: `Xóa vĩnh viễn món "${food.name}"`,
      note: `Mã: ${food.foodCode || food.slug}`,
    });
    return res.status(200).json({ message: 'Xóa món ăn thành công' });
  } catch (err) {
    console.error('[deleteFood] Lỗi:', err.message);
    return res.status(500).json({ message: 'Thao tác thất bại, vui lòng thử lại' });
  }
}

// ─── Food Groups Management ──────────────────────────────────────────────────
async function listFoodGroups(_req, res) {
  try {
    const groups = await FoodGroup.find({}).sort({ displayOrder: 1, name: 1 }).lean();

    // Aggregate dish counts from Food collection
    const counts = await Food.aggregate([
      { $group: { _id: '$foodGroup', count: { $sum: 1 }, sampleFoods: { $push: '$name' } } },
    ]);
    const countMap = new Map();
    counts.forEach((c) => {
      const uniqueNames = Array.from(new Set(c.sampleFoods || []));
      countMap.set(c._id || 'Khác', {
        count: c.count,
        sampleFoods: uniqueNames.slice(0, 5),
        allFoods: uniqueNames,
      });
    });

    const data = groups.map((g) => {
      const stats = countMap.get(g.name) || { count: 0, sampleFoods: [], allFoods: [] };
      return {
        _id: g._id,
        name: g.name,
        description: g.description,
        displayOrder: g.displayOrder,
        isStandard: g.isStandard,
        foodCount: stats.count,
        sampleFoods: stats.sampleFoods,
        allFoods: stats.allFoods || [],
      };
    });

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('[listFoodGroups] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể tải danh sách nhóm món ăn' });
  }
}

async function createFoodGroup(req, res) {
  try {
    const adminId = req.user.id;
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Tên nhóm món ăn không được để trống' });
    }
    const cleanName = name.trim();
    const existing = await FoodGroup.findOne({ name: { $regex: new RegExp(`^${escapeRegex(cleanName)}$`, 'i') } });
    if (existing) {
      return res.status(409).json({ message: `Nhóm món ăn "${existing.name}" đã tồn tại` });
    }

    const maxOrder = await FoodGroup.findOne({}).sort({ displayOrder: -1 }).lean();
    const nextOrder = (maxOrder?.displayOrder || 0) + 1;

    const newGroup = await FoodGroup.create({
      name: cleanName,
      description: description?.trim() || null,
      displayOrder: nextOrder,
      isStandard: false,
    });

    await AdminActionLog.create({
      adminId,
      actionType: 'create_food',
      targetType: 'FoodItem',
      targetId: newGroup._id,
      reason: `Tạo nhóm món ăn mới "${cleanName}"`,
      note: `ID nhóm: ${newGroup._id}`,
    });

    return res.status(201).json({
      success: true,
      message: `Tạo nhóm món ăn "${cleanName}" thành công`,
      data: newGroup,
    });
  } catch (err) {
    console.error('[createFoodGroup] Lỗi:', err.message);
    return res.status(500).json({ message: err.message || 'Tạo nhóm món ăn thất bại' });
  }
}

async function renameFoodGroup(req, res) {
  try {
    const adminId = req.user.id;
    const { id } = req.params;
    const { newName, description } = req.body;
    if (!newName || !newName.trim()) {
      return res.status(400).json({ message: 'Tên nhóm mới không được để trống' });
    }
    const cleanNew = newName.trim();

    const group = await FoodGroup.findById(id);
    if (!group) return res.status(404).json({ message: 'Nhóm món ăn không tồn tại' });

    const oldName = group.name;

    // Check duplicate name
    if (cleanNew.toLowerCase() !== oldName.toLowerCase()) {
      const dup = await FoodGroup.findOne({ name: { $regex: new RegExp(`^${escapeRegex(cleanNew)}$`, 'i') } });
      if (dup) return res.status(409).json({ message: `Tên nhóm "${cleanNew}" đã tồn tại` });
    }

    group.name = cleanNew;
    if (description !== undefined) group.description = description?.trim() || null;
    await group.save();

    // Cascade update to Food and FoodRequest collections
    const foodRes = await Food.updateMany({ foodGroup: oldName }, { $set: { foodGroup: cleanNew } });
    const reqRes = await FoodRequest.updateMany({ foodGroup: oldName }, { $set: { foodGroup: cleanNew } });

    await AdminActionLog.create({
      adminId,
      actionType: 'update_food',
      targetType: 'FoodItem',
      targetId: group._id,
      reason: `Đổi tên nhóm món ăn từ "${oldName}" thành "${cleanNew}"`,
      note: `Cập nhật ${foodRes.modifiedCount} món ăn và ${reqRes.modifiedCount} yêu cầu`,
    });

    return res.status(200).json({
      success: true,
      message: `Đổi tên nhóm thành "${cleanNew}" thành công (${foodRes.modifiedCount} món ăn được đồng bộ)`,
      data: group,
      modifiedFoods: foodRes.modifiedCount,
    });
  } catch (err) {
    console.error('[renameFoodGroup] Lỗi:', err.message);
    return res.status(500).json({ message: err.message || 'Đổi tên nhóm thất bại' });
  }
}

async function deleteFoodGroup(req, res) {
  try {
    const adminId = req.user.id;
    const { id } = req.params;
    const { targetGroup = 'Khác' } = req.body;

    const group = await FoodGroup.findById(id);
    if (!group) return res.status(404).json({ message: 'Nhóm món ăn không tồn tại' });

    const groupName = group.name;
    const cleanTarget = (targetGroup && targetGroup.trim()) || 'Khác';

    if (groupName.toLowerCase() === cleanTarget.toLowerCase()) {
      return res.status(400).json({ message: 'Nhóm chuyển đổi phải khác nhóm cần xóa' });
    }

    // Move all foods belonging to this group to targetGroup
    const foodRes = await Food.updateMany({ foodGroup: groupName }, { $set: { foodGroup: cleanTarget } });
    const reqRes = await FoodRequest.updateMany({ foodGroup: groupName }, { $set: { foodGroup: cleanTarget } });

    await group.deleteOne();

    await AdminActionLog.create({
      adminId,
      actionType: 'delete_food',
      targetType: 'FoodItem',
      targetId: group._id,
      reason: `Xóa nhóm món ăn "${groupName}" và chuyển ${foodRes.modifiedCount} món sang nhóm "${cleanTarget}"`,
      note: `Đồng bộ ${foodRes.modifiedCount} món ăn`,
    });

    return res.status(200).json({
      success: true,
      message: `Đã xóa nhóm "${groupName}" thành công, chuyển ${foodRes.modifiedCount} món sang "${cleanTarget}"`,
      modifiedFoods: foodRes.modifiedCount,
    });
  } catch (err) {
    console.error('[deleteFoodGroup] Lỗi:', err.message);
    return res.status(500).json({ message: err.message || 'Xóa nhóm món ăn thất bại' });
  }
}

module.exports = {
  getFoodAnalytics,
  listFoods,
  getFoodDetail,
  createFood,
  updateFood,
  updateFoodStatus,
  deleteFood,
  listFoodGroups,
  createFoodGroup,
  renameFoodGroup,
  deleteFoodGroup,
};
