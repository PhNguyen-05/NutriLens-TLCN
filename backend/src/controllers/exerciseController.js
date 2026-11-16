const mongoose = require('mongoose');
const Exercise = require('../models/Exercise');
const ExerciseLog = require('../models/ExerciseLog');
const UserProfile = require('../models/UserProfile');
const WeightLog = require('../models/WeightLog');
const DEFAULT_EXERCISES = require('../constants/defaultExercises');

let defaultExercisesEnsured = false;

/**
 * Tự động đồng bộ các bài tập mặc định khi khởi động
 * - Chỉ nạp bổ sung bài tập còn thiếu theo slug (không ghi đè các chỉnh sửa của Admin)
 * - Dùng cờ bộ nhớ đệm (cache flag) để tránh query lặp lại 32 lần trên mỗi request của user
 */
async function ensureDefaultExercises() {
  if (defaultExercisesEnsured) return;

  try {
    const existingExercises = await Exercise.find({ isCustom: { $ne: true } })
      .select('slug')
      .lean();
    const existingSlugs = new Set(existingExercises.map((e) => e.slug));

    const missing = DEFAULT_EXERCISES.filter((ex) => !existingSlugs.has(ex.slug));
    if (missing.length > 0) {
      const docsToInsert = missing.map((ex) => ({
        ...ex,
        isCustom: false,
        userId: null,
        isActive: true,
      }));
      await Exercise.insertMany(docsToInsert);
    }

    defaultExercisesEnsured = true;
  } catch (err) {
    console.error('[ensureDefaultExercises] Lỗi đồng bộ danh mục mặc định:', err.message);
  }
}

/**
 * Lấy cân nặng hợp lệ của người dùng từ hồ sơ sức khỏe
 */
async function getUserCurrentWeight(userId) {
  const [profile, latestWeightLog] = await Promise.all([
    UserProfile.findOne({ user: userId }).lean(),
    WeightLog.findOne({ user: userId }).sort({ recordedDate: -1, loggedAt: -1 }).lean(),
  ]);

  if (latestWeightLog?.weightKg && latestWeightLog.weightKg > 0) {
    return Number(latestWeightLog.weightKg);
  }
  if (profile?.currentWeightKg && profile.currentWeightKg > 0) {
    return Number(profile.currentWeightKg);
  }
  return null;
}

/**
 * Công thức ước tính Calories:
 * Calories = (MET * 3.5 * Cân nặng (kg) * Thời gian (phút)) / 200
 */
function calculateEstimatedCalories(met, weightKg, durationMinutes) {
  if (!met || !weightKg || !durationMinutes) return 0;
  const result = (met * 3.5 * weightKg * durationMinutes) / 200;
  return Math.round(result);
}

/**
 * Lấy ngày và giờ hiện tại theo múi giờ Việt Nam (Asia/Ho_Chi_Minh)
 * Tránh lỗi chênh lệch múi giờ trên Server (UTC vs GMT+7)
 */
function getVietnamNow() {
  const now = new Date();
  const todayStr = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
  const nowTimeStr = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(now);
  return { todayStr, nowTimeStr };
}

/**
 * Lấy chuỗi ngày tối thiểu cho phép ghi nhận nhật ký (mặc định 90 ngày trước)
 */
function getVietnamMinDateStr(daysAgo = 90) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
}

/**
 * Tính tổng calories tiêu hao trong ngày bằng MongoDB Aggregation
 */
async function getDailyTotalCalories(userId, dateStr) {
  const result = await ExerciseLog.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(String(userId)),
        date: dateStr,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$caloriesBurned' },
      },
    },
  ]);
  return result[0]?.total || 0;
}

// =============================================================================
// CONTROLLERS
// =============================================================================

/**
 * GET /api/exercises
 * Lấy danh mục bài tập đang hoạt động (kèm tìm kiếm & lọc nhóm)
 */
async function getExercises(req, res) {
  try {
    await ensureDefaultExercises();

    const { search, category, filterCustom } = req.query;
    const currentUserId = req.user?.id;

    const conditions = [
      { isActive: true },
      {
        $or: [
          { userId: null },
          { userId: { $exists: false } },
          ...(currentUserId ? [{ userId: currentUserId }] : []),
        ],
      },
    ];

    if (filterCustom === 'true' && currentUserId) {
      conditions.push({ userId: currentUserId, isCustom: true });
    }

    if (category && category !== 'all') {
      conditions.push({ category });
    }

    if (search && search.trim()) {
      const term = search.trim();
      conditions.push({
        $or: [
          { name: { $regex: term, $options: 'i' } },
          { description: { $regex: term, $options: 'i' } },
          { categoryName: { $regex: term, $options: 'i' } },
        ],
      });
    }

    const filter = conditions.length > 1 ? { $and: conditions } : conditions[0];
    const exercises = await Exercise.find(filter).sort({ isCustom: -1, category: 1, name: 1, _id: 1 }).lean();
    return res.status(200).json({ exercises });
  } catch (err) {
    console.error('[getExercises] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể tải danh mục bài tập' });
  }
}

/**
 * POST /api/exercises/calculate
 * Ước tính lượng calories tiêu hao trước khi lưu
 */
async function calculateCalories(req, res) {
  try {
    const { exerciseId, durationMinutes, customWeightKg } = req.body;

    const duration = Number(durationMinutes);
    // Luồng ngoại lệ 5a
    if (!duration || duration <= 0) {
      return res.status(400).json({ message: 'Thời lượng tập luyện phải lớn hơn 0' });
    }

    // Lấy cân nặng từ hồ sơ nếu không truyền customWeightKg
    let weight = customWeightKg ? Number(customWeightKg) : await getUserCurrentWeight(req.user.id);

    // Luồng ngoại lệ 5b
    if (!weight || weight <= 0) {
      return res.status(400).json({
        message: 'Vui lòng cập nhật cân nặng trong hồ sơ sức khỏe',
        missingWeight: true,
      });
    }

    // Luồng ngoại lệ 7c
    const exercise = await Exercise.findOne({ _id: exerciseId, isActive: true }).lean();
    if (!exercise || typeof exercise.met !== 'number' || exercise.met <= 0) {
      return res.status(400).json({ message: 'Bài tập chưa có dữ liệu tính calories' });
    }

    const calories = calculateEstimatedCalories(exercise.met, weight, duration);

    return res.status(200).json({
      exercise: {
        id: exercise._id,
        name: exercise.name,
        met: exercise.met,
        category: exercise.category,
      },
      weightKg: weight,
      durationMinutes: duration,
      caloriesBurned: calories,
      formulaExplanation: `(${exercise.met} MET × 3.5 × ${weight} kg × ${duration} phút) / 200 = ${calories} kcal`,
    });
  } catch (err) {
    console.error('[calculateCalories] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể tính toán calories tiêu hao' });
  }
}

/**
 * GET /api/exercises/logs
 * UC22: Xem lịch sử bài tập của người dùng kèm bộ lọc thời gian
 */
async function getExerciseLogs(req, res) {
  try {
    const { date, startDate, endDate, category } = req.query;
    const filter = { userId: req.user.id };

    if (date) {
      filter.date = date;
    } else if (startDate || endDate) {
      filter.date = {};
      let s = startDate;
      let e = endDate;
      if (s && e && s > e) {
        const temp = s;
        s = e;
        e = temp;
      }
      if (s) filter.date.$gte = s;
      if (e) filter.date.$lte = e;
    }

    if (category && category !== 'all') {
      filter.category = category;
    }

    const logs = await ExerciseLog.find(filter).sort({ date: -1, createdAt: -1 }).lean();

    // Tính tổng kết
    const totalCalories = logs.reduce((sum, item) => sum + (item.caloriesBurned || 0), 0);
    const totalMinutes = logs.reduce((sum, item) => sum + (item.durationMinutes || 0), 0);
    const totalWorkouts = logs.length;

    // Lấy thêm thông tin cân nặng hiện tại để frontend tiện hiển thị trạng thái
    const currentWeight = await getUserCurrentWeight(req.user.id);

    return res.status(200).json({
      logs,
      summary: {
        totalCalories,
        totalMinutes,
        totalWorkouts,
      },
      currentWeightKg: currentWeight,
    });
  } catch (err) {
    console.error('[getExerciseLogs] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể tải lịch sử tập luyện' });
  }
}

/**
 * POST /api/exercises/logs
 * UC21: Ghi nhận bài tập vào lịch sử
 */
async function createExerciseLog(req, res) {
  try {
    const {
      exerciseId,
      durationMinutes,
      date,
      time,
      notes,
      customWeightKg,
    } = req.body;

    const duration = Number(durationMinutes);
    // Luồng ngoại lệ 5a: Thời lượng <= 0 hoặc vượt quá 24h
    if (!duration || duration <= 0) {
      return res.status(400).json({ message: 'Thời lượng tập luyện phải lớn hơn 0' });
    }
    if (duration > 1440) {
      return res.status(400).json({ message: 'Thời lượng tập không thể vượt quá 24 giờ (1440 phút)' });
    }

    const { todayStr, nowTimeStr } = getVietnamNow();

    const logDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : todayStr;

    if (logDate > todayStr) {
      return res.status(400).json({ message: 'Ngày tập không thể ở thời điểm tương lai' });
    }

    const minDateStr = getVietnamMinDateStr(90);
    if (logDate < minDateStr) {
      return res.status(400).json({ message: 'Ngày tập không được vượt quá 90 ngày trong quá khứ' });
    }

    const logTime = time || nowTimeStr;
    if (logDate === todayStr && logTime > nowTimeStr) {
      return res.status(400).json({ message: 'Giờ bắt đầu tập không thể ở thời điểm tương lai' });
    }

    // Luồng ngoại lệ 5b: Người dùng chưa có thông tin cân nặng trong hồ sơ
    const weight = customWeightKg ? Number(customWeightKg) : await getUserCurrentWeight(req.user.id);
    if (!weight || weight <= 0) {
      return res.status(400).json({
        message: 'Vui lòng cập nhật cân nặng trong hồ sơ sức khỏe',
        missingWeight: true,
      });
    }

    // Luồng ngoại lệ 7c: Bài tập không có giá trị MET hợp lệ
    const exercise = await Exercise.findOne({ _id: exerciseId, isActive: true }).lean();
    if (!exercise || typeof exercise.met !== 'number' || exercise.met <= 0) {
      return res.status(400).json({ message: 'Bài tập chưa có dữ liệu tính calories' });
    }

    // Tính lượng calories tiêu hao ước tính theo công thức
    const caloriesBurned = calculateEstimatedCalories(exercise.met, weight, duration);

    const newLog = await ExerciseLog.create({
      userId: req.user.id,
      exerciseId: exercise._id,
      exerciseName: exercise.name,
      category: exercise.category,
      met: exercise.met,
      weightKg: weight,
      durationMinutes: duration,
      caloriesBurned,
      date: logDate,
      time: logTime,
      notes: notes ? String(notes).trim() : '',
    });

    // Lấy lại tổng calories tiêu hao trong ngày bằng MongoDB Aggregation
    const dailyTotalCalories = await getDailyTotalCalories(req.user.id, logDate);

    return res.status(201).json({
      message: 'Ghi nhận bài tập thành công',
      log: newLog,
      dailyTotalCalories,
    });
  } catch (err) {
    // Luồng ngoại lệ 11d: Hệ thống xảy ra lỗi khi lưu dữ liệu
    console.error('[createExerciseLog] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể lưu thông tin bài tập, vui lòng thử lại' });
  }
}

/**
 * PATCH /api/exercises/logs/:id
 * UC22 Luồng 5a: Sửa bản ghi bài tập & tính lại calories
 */
async function updateExerciseLog(req, res) {
  try {
    const { id } = req.params;
    const {
      exerciseId,
      durationMinutes,
      date,
      time,
      notes,
      weightKg,
      customWeightKg,
    } = req.body;

    const log = await ExerciseLog.findOne({ _id: id, userId: req.user.id });
    // Luồng ngoại lệ 8e: Bản ghi không còn tồn tại
    if (!log) {
      return res.status(404).json({ message: 'Bản ghi không còn tồn tại' });
    }

    // Luồng ngoại lệ 7b: Thông tin chỉnh sửa không hợp lệ
    let nextDuration = log.durationMinutes;
    if (durationMinutes !== undefined) {
      const parsedDuration = Number(durationMinutes);
      if (!parsedDuration || parsedDuration <= 0) {
        return res.status(400).json({ message: 'Thời lượng tập luyện phải lớn hơn 0' });
      }
      if (parsedDuration > 1440) {
        return res.status(400).json({ message: 'Thời lượng tập không thể vượt quá 24 giờ (1440 phút)' });
      }
      nextDuration = parsedDuration;
    }

    // Cập nhật cân nặng nếu người dùng gửi lên
    const inputWeight = customWeightKg !== undefined ? customWeightKg : weightKg;
    let nextWeight = log.weightKg;
    if (inputWeight !== undefined && inputWeight !== null && inputWeight !== '') {
      const parsedWeight = Number(inputWeight);
      if (!parsedWeight || parsedWeight < 20 || parsedWeight > 300) {
        return res.status(400).json({ message: 'Cân nặng phải trong khoảng từ 20 đến 300 kg' });
      }
      nextWeight = parsedWeight;
    }

    const { todayStr, nowTimeStr } = getVietnamNow();

    const nextDate = (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) ? date : log.date;
    const nextTime = time !== undefined ? time : log.time;

    if (nextDate > todayStr) {
      return res.status(400).json({ message: 'Ngày tập không thể ở thời điểm tương lai' });
    }

    const minDateStr = getVietnamMinDateStr(90);
    if (nextDate < minDateStr) {
      return res.status(400).json({ message: 'Ngày tập không được vượt quá 90 ngày trong quá khứ' });
    }

    if (nextDate === todayStr && nextTime && nextTime > nowTimeStr) {
      return res.status(400).json({ message: 'Giờ bắt đầu tập không thể ở thời điểm tương lai' });
    }

    let nextMet = log.met;
    let nextExerciseName = log.exerciseName;
    let nextCategory = log.category;

    if (exerciseId && String(exerciseId) !== String(log.exerciseId)) {
      // Luồng ngoại lệ 9c: Không tìm thấy bài tập hoặc giá trị MET tương ứng khi cập nhật
      const exercise = await Exercise.findOne({ _id: exerciseId, isActive: true }).lean();
      if (!exercise || typeof exercise.met !== 'number' || exercise.met <= 0) {
        return res.status(400).json({ message: 'Không tìm thấy dữ liệu bài tập để tính calories' });
      }
      nextMet = exercise.met;
      nextExerciseName = exercise.name;
      nextCategory = exercise.category;
      log.exerciseId = exercise._id;
      log.exerciseName = nextExerciseName;
      log.category = nextCategory;
      log.met = nextMet;
    }

    // Tự động tính toán lại calories tiêu hao tương ứng
    log.durationMinutes = nextDuration;
    log.weightKg = nextWeight;
    log.caloriesBurned = calculateEstimatedCalories(nextMet, nextWeight, nextDuration);
    log.date = nextDate;
    if (time !== undefined) {
      log.time = time;
    }
    if (notes !== undefined) {
      log.notes = String(notes).trim();
    }

    await log.save();

    // Tính lại tổng calories sau khi sửa bằng Aggregation
    const dailyTotalCalories = await getDailyTotalCalories(req.user.id, nextDate);

    return res.status(200).json({
      message: 'Cập nhật bài tập thành công',
      log,
      dailyTotalCalories,
    });
  } catch (err) {
    // Luồng ngoại lệ 8f: Hệ thống xảy ra lỗi khi cập nhật
    console.error('[updateExerciseLog] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể cập nhật dữ liệu, vui lòng thử lại' });
  }
}

/**
 * DELETE /api/exercises/logs/:id
 * UC22 Luồng 5b: Xóa bản ghi bài tập & cập nhật lại tổng calories
 */
async function deleteExerciseLog(req, res) {
  try {
    const { id } = req.params;

    const log = await ExerciseLog.findOne({ _id: id, userId: req.user.id });
    // Luồng ngoại lệ 8e: Bản ghi không còn tồn tại
    if (!log) {
      return res.status(404).json({ message: 'Bản ghi không còn tồn tại' });
    }

    const logDate = log.date;
    await ExerciseLog.deleteOne({ _id: id });

    // Tính lại tổng calories sau khi xóa bằng MongoDB Aggregation
    const updatedDailyCalories = await getDailyTotalCalories(req.user.id, logDate);

    return res.status(200).json({
      message: 'Xóa bài tập thành công',
      updatedDailyCalories,
    });
  } catch (err) {
    // Luồng ngoại lệ 8f: Hệ thống xảy ra lỗi khi xóa dữ liệu
    console.error('[deleteExerciseLog] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể cập nhật dữ liệu, vui lòng thử lại' });
  }
}

/**
 * POST /api/exercises/custom
 * Tạo bài tập cá nhân tùy chỉnh
 */
async function createCustomExercise(req, res) {
  try {
    const {
      name,
      category = 'cardio',
      intensity = 'Trung bình',
      met,
      description = '',
      defaultDurationMinutes = 30,
      imageUrl = '',
      youtubeUrl = '',
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Vui lòng nhập tên bài tập' });
    }

    const cleanName = name.trim();
    if (cleanName.length < 2 || cleanName.length > 100) {
      return res.status(400).json({ message: 'Tên bài tập từ 2 đến 100 ký tự' });
    }

    // Kiểm tra xem người dùng đã tạo bài tập trùng tên này chưa
    const existing = await Exercise.findOne({
      userId: req.user.id,
      isActive: true,
      name: { $regex: `^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    });
    if (existing) {
      return res.status(400).json({ message: 'Bạn đã có bài tập mang tên này trong danh mục cá nhân' });
    }

    const categoryMap = {
      cardio:      { name: 'Cardio & Vận động', icon: 'bi-lightning-charge' },
      strength:    { name: 'Sức mạnh & Gym',   icon: 'bi-trophy' },
      flexibility: { name: 'Yoga & Thư giãn', icon: 'bi-flower1' },
      sports:      { name: 'Thể thao',        icon: 'bi-dribbble' },
    };

    const targetCat = categoryMap[category] ? category : 'cardio';
    const catInfo = categoryMap[targetCat];

    // Xác định MET mặc định theo cường độ
    const defaultMetByIntensity = {
      'Nhẹ': 3.5,
      'Trung bình': 6.0,
      'Cao': 8.5,
    };
    const validIntensity = ['Nhẹ', 'Trung bình', 'Cao'].includes(intensity) ? intensity : 'Trung bình';
    let targetMet = Number(met);
    if (!targetMet || targetMet <= 0 || targetMet > 30) {
      targetMet = defaultMetByIntensity[validIntensity];
    }

    const duration = Number(defaultDurationMinutes) > 0 ? Number(defaultDurationMinutes) : 30;

    // Tạo slug an toàn
    const baseSlug = cleanName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'bai-tap';

    const uniqueSlug = `${baseSlug}-${req.user.id.slice(-6)}-${Date.now().toString(36)}`;

    const newExercise = await Exercise.create({
      userId: req.user.id,
      isCustom: true,
      name: cleanName,
      slug: uniqueSlug,
      category: targetCat,
      categoryName: catInfo.name,
      met: targetMet,
      intensity: validIntensity,
      description: String(description || '').trim(),
      icon: catInfo.icon,
      isActive: true,
      defaultDurationMinutes: duration,
      imageUrl: String(imageUrl || '').trim(),
      youtubeUrl: String(youtubeUrl || '').trim(),
    });

    return res.status(201).json({
      message: 'Tạo bài tập cá nhân thành công',
      exercise: newExercise,
    });
  } catch (err) {
    console.error('[createCustomExercise] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể tạo bài tập, vui lòng thử lại' });
  }
}

/**
 * DELETE /api/exercises/custom/:id
 * Xóa bài tập cá nhân tùy chỉnh
 */
async function deleteCustomExercise(req, res) {
  try {
    const { id } = req.params;
    const exercise = await Exercise.findOne({
      _id: id,
      userId: req.user.id,
      isCustom: true,
    });

    if (!exercise) {
      return res.status(404).json({ message: 'Bài tập cá nhân không tồn tại hoặc bạn không có quyền xóa' });
    }

    const logCount = await ExerciseLog.countDocuments({ exerciseId: exercise._id });
    if (logCount > 0) {
      exercise.isActive = false;
      await exercise.save();
      return res.status(200).json({
        message: 'Bài tập cá nhân đã có lượt ghi nhận nhật ký nên được chuyển sang trạng thái ẩn để bảo toàn dữ liệu lịch sử.',
        hidden: true,
      });
    }

    await Exercise.deleteOne({ _id: id });
    return res.status(200).json({ message: 'Xóa bài tập cá nhân thành công' });
  } catch (err) {
    console.error('[deleteCustomExercise] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể xóa bài tập, vui lòng thử lại' });
  }
}

module.exports = {
  getExercises,
  calculateCalories,
  getExerciseLogs,
  createExerciseLog,
  updateExerciseLog,
  deleteExerciseLog,
  calculateEstimatedCalories,
  createCustomExercise,
  deleteCustomExercise,
};
