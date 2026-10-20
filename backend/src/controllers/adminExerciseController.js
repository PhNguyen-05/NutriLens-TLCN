const mongoose = require('mongoose');
const Exercise = require('../models/Exercise');
const ExerciseLog = require('../models/ExerciseLog');
const AdminActionLog = require('../models/AdminActionLog');

const CATEGORY_NAMES = {
  cardio: 'Cardio & Vận động',
  strength: 'Sức mạnh & Gym',
  sports: 'Thể thao',
  flexibility: 'Yoga & Thư giãn',
  other: 'Khác',
};

const DEFAULT_CATEGORY_ICONS = {
  cardio: 'bi-person-running',
  strength: 'bi-hammer',
  sports: 'bi-dribbble',
  flexibility: 'bi-yin-yang',
  other: 'bi-activity',
};

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizePagination(page, limit) {
  const normalizedPage = Math.max(Number.parseInt(page, 10) || 1, 1);
  const normalizedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 10, 1), 100);
  return { page: normalizedPage, limit: normalizedLimit, skip: (normalizedPage - 1) * normalizedLimit };
}

/**
 * GET /api/admin/exercises
 * Lấy danh sách bài tập cho Admin quản lý (kèm tìm kiếm, lọc, sắp xếp, phân trang và thống kê)
 */
async function listExercises(req, res) {
  try {
    const {
      search = '',
      category = 'all',
      intensity = 'all',
      status = 'all',
      sort = 'newest',
      type = 'system', // 'system' | 'custom' | 'all'
      page,
      limit,
    } = req.query;

    const query = {};

    // Phân loại nguồn bài tập: hệ thống (mặc định) hoặc do người dùng tạo
    if (type === 'system') {
      query.$or = [{ userId: null }, { userId: { $exists: false } }, { isCustom: false }];
    } else if (type === 'custom') {
      query.isCustom = true;
    }

    // Lọc theo trạng thái ẩn/hiển thị
    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'hidden') {
      query.isActive = false;
    } else if (status !== 'all') {
      return res.status(400).json({ message: 'Trạng thái lọc không hợp lệ' });
    }

    // Lọc theo thể loại
    if (category && category !== 'all') {
      query.category = category;
    }

    // Lọc theo cường độ
    if (intensity && intensity !== 'all') {
      query.intensity = intensity;
    }

    // Tìm kiếm từ khóa theo tên, mô tả hoặc tên nhóm
    const trimmedSearch = search.trim();
    if (trimmedSearch) {
      const reg = new RegExp(escapeRegex(trimmedSearch), 'i');
      query.$and = query.$and || [];
      query.$and.push({
        $or: [{ name: reg }, { description: reg }, { categoryName: reg }],
      });
    }

    // Thiết lập sắp xếp
    let sortOptions = { createdAt: -1 };
    let useCollation = false;
    if (sort === 'oldest') {
      sortOptions = { createdAt: 1 };
    } else if (sort === 'name_asc' || sort === 'a-z') {
      sortOptions = { name: 1 };
      useCollation = true;
    } else if (sort === 'name_desc' || sort === 'z-a') {
      sortOptions = { name: -1 };
      useCollation = true;
    } else if (sort === 'met_desc') {
      sortOptions = { met: -1, name: 1 };
    } else if (sort === 'met_asc') {
      sortOptions = { met: 1, name: 1 };
    }

    const pagination = normalizePagination(page, limit);

    let execQuery = Exercise.find(query).sort(sortOptions);
    if (useCollation) {
      execQuery = execQuery.collation({ locale: 'vi', strength: 1 });
    }

    const [exercises, total, totalAll, totalActive, totalHidden, totalLogs] = await Promise.all([
      execQuery.skip(pagination.skip).limit(pagination.limit).lean(),
      Exercise.countDocuments(query),
      Exercise.countDocuments({ isCustom: { $ne: true } }),
      Exercise.countDocuments({ isCustom: { $ne: true }, isActive: true }),
      Exercise.countDocuments({ isCustom: { $ne: true }, isActive: false }),
      ExerciseLog.countDocuments({}),
    ]);

    // Lấy số lượt ghi nhận cho từng bài tập trong danh sách trang hiện tại
    const exerciseIds = exercises.map((e) => e._id);
    const usageCounts = await ExerciseLog.aggregate([
      { $match: { exerciseId: { $in: exerciseIds } } },
      { $group: { _id: '$exerciseId', count: { $sum: 1 } } },
    ]);
    const usageMap = new Map();
    usageCounts.forEach((u) => usageMap.set(String(u._id), u.count));

    const enrichedExercises = exercises.map((ex) => ({
      ...ex,
      logCount: usageMap.get(String(ex._id)) || 0,
    }));

    // Thống kê theo danh mục (chỉ tính bài tập hệ thống)
    const categoryStats = await Exercise.aggregate([
      { $match: { isCustom: { $ne: true } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);
    const categoryCounts = {};
    categoryStats.forEach((c) => {
      if (c._id) categoryCounts[c._id] = c.count;
    });

    return res.status(200).json({
      data: enrichedExercises,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit) || 1,
      },
      summary: {
        total: totalAll,
        active: totalActive,
        hidden: totalHidden,
        totalLogs,
        categoryCounts,
      },
    });
  } catch (err) {
    console.error('[listExercises] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể tải danh sách bài tập, vui lòng thử lại' });
  }
}

/**
 * GET /api/admin/exercises/:id
 * Xem chi tiết bài tập kèm thông tin sử dụng
 */
async function getExerciseDetail(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Mã bài tập không hợp lệ' });
    }

    const exercise = await Exercise.findById(id).lean();
    if (!exercise) {
      return res.status(404).json({ message: 'Bài tập không tồn tại' });
    }

    const [logCount, recentLogs] = await Promise.all([
      ExerciseLog.countDocuments({ exerciseId: exercise._id }),
      ExerciseLog.find({ exerciseId: exercise._id })
        .sort({ recordedDate: -1, loggedAt: -1 })
        .limit(5)
        .populate('user', 'fullName email')
        .lean(),
    ]);

    return res.status(200).json({
      data: {
        ...exercise,
        logCount,
        recentLogs,
      },
    });
  } catch (err) {
    console.error('[getExerciseDetail] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể tải chi tiết bài tập' });
  }
}

/**
 * POST /api/admin/exercises
 * Thêm mới bài tập vào danh mục hệ thống (UC25)
 */
async function createExercise(req, res) {
  try {
    const adminId = req.user.id;
    const {
      name,
      category = 'cardio',
      intensity = 'Trung bình',
      met,
      description = '',
      icon = 'bi-activity',
      defaultDurationMinutes = 0,
      isActive = true,
    } = req.body;

    // 4a. Kiểm tra tên bài tập
    const trimmedName = String(name || '').trim();
    if (!trimmedName) {
      return res.status(400).json({ message: 'Tên bài tập không được để trống' });
    }

    // 4b. Kiểm tra giá trị MET
    const metNum = Number(met);
    if (met === undefined || met === null || met === '' || !Number.isFinite(metNum) || metNum <= 0) {
      return res.status(400).json({ message: 'Giá trị MET không hợp lệ' });
    }
    if (metNum > 30) {
      return res.status(400).json({ message: 'Giá trị MET không được vượt quá 30.0' });
    }

    // 4c. Kiểm tra trùng lặp tên bài tập hệ thống
    const existing = await Exercise.findOne({
      name: { $regex: `^${escapeRegex(trimmedName)}$`, $options: 'i' },
      isCustom: { $ne: true },
    });
    if (existing) {
      return res.status(409).json({ message: 'Bài tập đã tồn tại' });
    }

    const validCategory = ['cardio', 'strength', 'sports', 'flexibility', 'other'].includes(category)
      ? category
      : 'cardio';
    const categoryName = CATEGORY_NAMES[validCategory] || 'Cardio & Vận động';

    const validIntensity = ['Nhẹ', 'Trung bình', 'Cao'].includes(intensity) ? intensity : 'Trung bình';

    // Ràng buộc thời lượng gợi ý (defaultDurationMinutes): Bắt buộc > 0 và <= 720
    const durationNum = Number(defaultDurationMinutes !== undefined ? defaultDurationMinutes : 30);
    if (!Number.isFinite(durationNum) || durationNum <= 0) {
      return res.status(400).json({ message: 'Thời lượng gợi ý phải lớn hơn 0 phút' });
    }
    if (durationNum > 720) {
      return res.status(400).json({ message: 'Thời lượng gợi ý tối đa không quá 720 phút (12 giờ)' });
    }
    const validDuration = Math.round(durationNum);

    // Xử lý icon: nếu để trống hoặc "default" -> tự động lấy icon mặc định của thể loại
    const validIcon = icon && String(icon).trim() && String(icon).trim() !== 'default'
      ? String(icon).trim()
      : (DEFAULT_CATEGORY_ICONS[validCategory] || 'bi-activity');

    // Sinh slug duy nhất
    let baseSlug = slugify(trimmedName) || 'bai-tap';
    let candidateSlug = baseSlug;
    let counter = 1;
    while (await Exercise.exists({ slug: candidateSlug })) {
      candidateSlug = `${baseSlug}-${counter++}`;
    }

    const exercise = await Exercise.create({
      userId: null,
      isCustom: false,
      name: trimmedName,
      slug: candidateSlug,
      category: validCategory,
      categoryName,
      met: Math.round(metNum * 10) / 10,
      intensity: validIntensity,
      description: String(description || '').trim(),
      icon: validIcon,
      defaultDurationMinutes: validDuration,
      isActive: Boolean(isActive),
    });

    // Ghi nhận lịch sử thao tác của Admin
    await AdminActionLog.create({
      adminId,
      actionType: 'create_exercise',
      targetType: 'Exercise',
      targetId: exercise._id,
      reason: `Thêm mới bài tập "${exercise.name}"`,
      note: `Nhóm: ${exercise.categoryName} | MET: ${exercise.met} | Cường độ: ${exercise.intensity}`,
    });

    return res.status(201).json({
      message: 'Lưu thông tin bài tập thành công',
      data: exercise,
    });
  } catch (err) {
    console.error('[createExercise] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể cập nhật thông tin bài tập, vui lòng thử lại' });
  }
}

/**
 * PUT /api/admin/exercises/:id
 * Chỉnh sửa thông tin bài tập trong danh mục (UC25)
 */
async function updateExercise(req, res) {
  try {
    const adminId = req.user.id;
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Mã bài tập không hợp lệ' });
    }

    const exercise = await Exercise.findById(id);
    if (!exercise) {
      return res.status(404).json({ message: 'Bài tập không tồn tại' });
    }

    const {
      name,
      category,
      intensity,
      met,
      description,
      icon,
      defaultDurationMinutes,
      isActive,
    } = req.body;

    // 4a. Kiểm tra tên bài tập
    const trimmedName = String(name || '').trim();
    if (!trimmedName) {
      return res.status(400).json({ message: 'Tên bài tập không được để trống' });
    }

    // 4b. Kiểm tra giá trị MET
    const metNum = Number(met);
    if (met === undefined || met === null || met === '' || !Number.isFinite(metNum) || metNum <= 0 || metNum > 30) {
      return res.status(400).json({ message: 'Giá trị MET không hợp lệ' });
    }

    // 4c. Kiểm tra trùng lặp tên bài tập nếu tên bị thay đổi
    const isNameChanged = exercise.name.trim().toLowerCase() !== trimmedName.toLowerCase();
    if (isNameChanged) {
      const existing = await Exercise.findOne({
        _id: { $ne: exercise._id },
        name: { $regex: `^${escapeRegex(trimmedName)}$`, $options: 'i' },
        isCustom: { $ne: true },
      });
      if (existing) {
        return res.status(409).json({ message: 'Bài tập đã tồn tại' });
      }
    }

    const validCategory = ['cardio', 'strength', 'sports', 'flexibility', 'other'].includes(category)
      ? category
      : exercise.category;
    const categoryName = CATEGORY_NAMES[validCategory] || exercise.categoryName;

    const validIntensity = ['Nhẹ', 'Trung bình', 'Cao'].includes(intensity) ? intensity : exercise.intensity;

    // Ràng buộc thời lượng gợi ý (defaultDurationMinutes): Bắt buộc > 0 và <= 720
    let validDuration = exercise.defaultDurationMinutes;
    if (defaultDurationMinutes !== undefined) {
      const durationNum = Number(defaultDurationMinutes);
      if (!Number.isFinite(durationNum) || durationNum <= 0) {
        return res.status(400).json({ message: 'Thời lượng gợi ý phải lớn hơn 0 phút' });
      }
      if (durationNum > 720) {
        return res.status(400).json({ message: 'Thời lượng gợi ý tối đa không quá 720 phút (12 giờ)' });
      }
      validDuration = Math.round(durationNum);
    }

    // Xử lý icon: nếu để trống hoặc "default" -> tự động lấy icon mặc định của thể loại
    let validIcon = exercise.icon;
    if (icon !== undefined) {
      const cleanIcon = String(icon || '').trim();
      validIcon = (!cleanIcon || cleanIcon === 'default')
        ? (DEFAULT_CATEGORY_ICONS[validCategory] || 'bi-activity')
        : cleanIcon;
    }

    if (isNameChanged) {
      let baseSlug = slugify(trimmedName) || 'bai-tap';
      let candidateSlug = baseSlug;
      let counter = 1;
      while (await Exercise.exists({ _id: { $ne: exercise._id }, slug: candidateSlug })) {
        candidateSlug = `${baseSlug}-${counter++}`;
      }
      exercise.slug = candidateSlug;
    }

    exercise.name = trimmedName;
    exercise.category = validCategory;
    exercise.categoryName = categoryName;
    exercise.met = Math.round(metNum * 10) / 10;
    exercise.intensity = validIntensity;
    if (description !== undefined) exercise.description = String(description || '').trim();
    exercise.icon = validIcon;
    exercise.defaultDurationMinutes = validDuration;
    if (isActive !== undefined) exercise.isActive = Boolean(isActive);

    await exercise.save();

    // Ghi nhận lịch sử thao tác của Admin
    await AdminActionLog.create({
      adminId,
      actionType: 'update_exercise',
      targetType: 'Exercise',
      targetId: exercise._id,
      reason: `Cập nhật thông tin bài tập "${exercise.name}"`,
      note: `Nhóm: ${exercise.categoryName} | MET: ${exercise.met} | Cường độ: ${exercise.intensity}`,
    });

    return res.status(200).json({
      message: 'Lưu thông tin bài tập thành công',
      data: exercise,
    });
  } catch (err) {
    console.error('[updateExercise] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể cập nhật thông tin bài tập, vui lòng thử lại' });
  }
}

/**
 * PATCH /api/admin/exercises/:id/status
 * Ẩn hoặc hiển thị bài tập trong danh mục người dùng (UC25 - Luồng thay thế 3a & 3b)
 */
async function updateExerciseStatus(req, res) {
  try {
    const adminId = req.user.id;
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Mã bài tập không hợp lệ' });
    }

    const exercise = await Exercise.findById(id);
    if (!exercise) {
      return res.status(404).json({ message: 'Bài tập không tồn tại' });
    }

    // Nhận diện trạng thái mới qua boolean isActive hoặc string status ('active' / 'hidden')
    let nextActiveState;
    if (typeof req.body.isActive === 'boolean') {
      nextActiveState = req.body.isActive;
    } else if (req.body.status === 'active') {
      nextActiveState = true;
    } else if (req.body.status === 'hidden') {
      nextActiveState = false;
    } else {
      return res.status(400).json({ message: 'Trạng thái truyền lên không hợp lệ' });
    }

    if (exercise.isActive === nextActiveState) {
      return res.status(409).json({
        message: nextActiveState ? 'Bài tập đã ở trạng thái Đang hoạt động' : 'Bài tập đã ở trạng thái Không hoạt động (Đã ẩn)',
      });
    }

    exercise.isActive = nextActiveState;
    await exercise.save();

    const actionType = nextActiveState ? 'show_exercise' : 'hide_exercise';
    const reason = nextActiveState
      ? `Hiển thị lại bài tập "${exercise.name}" trong danh mục người dùng`
      : `Ẩn bài tập "${exercise.name}" khỏi danh mục người dùng`;

    await AdminActionLog.create({
      adminId,
      actionType,
      targetType: 'Exercise',
      targetId: exercise._id,
      reason,
      note: `Nhóm: ${exercise.categoryName} | MET: ${exercise.met}`,
    });

    const successMessage = nextActiveState ? 'Hiển thị bài tập thành công' : 'Ẩn bài tập thành công';

    return res.status(200).json({
      message: successMessage,
      data: exercise,
    });
  } catch (err) {
    console.error('[updateExerciseStatus] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể cập nhật thông tin bài tập, vui lòng thử lại' });
  }
}

/**
 * DELETE /api/admin/exercises/:id
 * Xóa vĩnh viễn bài tập (chỉ cho phép khi chưa có người dùng nào ghi nhận nhật ký)
 */
async function deleteExercise(req, res) {
  try {
    const adminId = req.user.id;
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Mã bài tập không hợp lệ' });
    }

    const exercise = await Exercise.findById(id);
    if (!exercise) {
      return res.status(404).json({ message: 'Bài tập không tồn tại' });
    }

    // Kiểm tra xem bài tập đã có nhật ký của người dùng chưa
    const logCount = await ExerciseLog.countDocuments({ exerciseId: exercise._id });
    if (logCount > 0) {
      return res.status(400).json({
        message: `Bài tập này đã có ${logCount} lượt ghi nhận từ người dùng. Vui lòng sử dụng tính năng Ẩn bài tập thay vì xóa để bảo toàn dữ liệu lịch sử.`,
        logCount,
        refCount: logCount,
        canHide: true,
      });
    }

    await Exercise.findByIdAndDelete(exercise._id);

    await AdminActionLog.create({
      adminId,
      actionType: 'delete_exercise',
      targetType: 'Exercise',
      targetId: exercise._id,
      reason: `Xóa bài tập "${exercise.name}" khỏi hệ thống`,
      note: `Nhóm: ${exercise.categoryName} | MET: ${exercise.met}`,
    });

    return res.status(200).json({
      message: 'Xóa bài tập thành công',
    });
  } catch (err) {
    console.error('[deleteExercise] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể xóa bài tập, vui lòng thử lại' });
  }
}

module.exports = {
  listExercises,
  getExerciseDetail,
  createExercise,
  updateExercise,
  updateExerciseStatus,
  deleteExercise,
};
