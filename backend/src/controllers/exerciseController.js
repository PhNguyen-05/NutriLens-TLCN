const Exercise = require('../models/Exercise');
const ExerciseLog = require('../models/ExerciseLog');
const UserProfile = require('../models/UserProfile');
const WeightLog = require('../models/WeightLog');

const DEFAULT_EXERCISES = [
  {
    name: 'Đi bộ nhanh ngoài trời',
    slug: 'di-bo-nhanh-ngoai-troi',
    category: 'cardio',
    categoryName: 'Cardio & Vận động',
    met: 3.8,
    intensity: 'Trung bình',
    icon: 'bi-person-walking',
    description: 'Đi bộ với tốc độ khoảng 5 km/h, cải thiện tim mạch và đốt mỡ nhẹ nhàng.',
    defaultDurationMinutes: 30,
  },
  {
    name: 'Đi bộ thong thả',
    slug: 'di-bo-thong-tha',
    category: 'cardio',
    categoryName: 'Cardio & Vận động',
    met: 2.8,
    intensity: 'Nhẹ',
    icon: 'bi-person-walking',
    description: 'Đi dạo nhẹ nhàng, thư giãn gân cốt và phục hồi năng lượng.',
    defaultDurationMinutes: 30,
  },
  {
    name: 'Chạy bộ nhẹ (Jogging)',
    slug: 'chay-bo-nhe-jogging',
    category: 'cardio',
    categoryName: 'Cardio & Vận động',
    met: 8.0,
    intensity: 'Cao',
    icon: 'bi-lightning-charge',
    description: 'Chạy bộ với vận tốc khoảng 8 km/h, tăng cường sức bền và đốt cháy nhiều calo.',
    defaultDurationMinutes: 30,
  },
  {
    name: 'Chạy cự ly trung bình (10 km/h)',
    slug: 'chay-cu-ly-trung-binh',
    category: 'cardio',
    categoryName: 'Cardio & Vận động',
    met: 10.0,
    intensity: 'Cao',
    icon: 'bi-speedometer2',
    description: 'Chạy nhịp điệu nhanh, tăng sức mạnh cơ tim và tối ưu hóa chuyển hóa mỡ.',
    defaultDurationMinutes: 20,
  },
  {
    name: 'Chạy nước rút HIIT',
    slug: 'chay-nuoc-rut-hiit',
    category: 'cardio',
    categoryName: 'Cardio & Vận động',
    met: 12.0,
    intensity: 'Cao',
    icon: 'bi-fire',
    description: 'Chạy biến tốc cường độ cực đại ngắt quãng, kích hoạt hiệu ứng đốt mỡ Afterburn (EPOC).',
    defaultDurationMinutes: 15,
  },
  {
    name: 'Đạp xe ngoài trời vừa sức',
    slug: 'dap-xe-ngoai-troi',
    category: 'cardio',
    categoryName: 'Cardio & Vận động',
    met: 6.0,
    intensity: 'Trung bình',
    icon: 'bi-bicycle',
    description: 'Đạp xe địa hình hoặc đường bằng tốc độ 15-18 km/h, tốt cho khớp gối và cơ đùi.',
    defaultDurationMinutes: 45,
  },
  {
    name: 'Đạp xe tốc độ cao (>20 km/h)',
    slug: 'dap-xe-toc-do-cao',
    category: 'cardio',
    categoryName: 'Cardio & Vận động',
    met: 8.5,
    intensity: 'Cao',
    icon: 'bi-bicycle',
    description: 'Đạp xe đua hoặc đạp xe kháng lực trong phòng gym cường độ cao.',
    defaultDurationMinutes: 30,
  },
  {
    name: 'Bơi lội tự do vừa sức',
    slug: 'boi-loi-tu-do',
    category: 'cardio',
    categoryName: 'Cardio & Vận động',
    met: 6.0,
    intensity: 'Trung bình',
    icon: 'bi-water',
    description: 'Bơi thư giãn toàn thân, giảm áp lực lên các khớp xương.',
    defaultDurationMinutes: 30,
  },
  {
    name: 'Bơi sải tốc độ cao',
    slug: 'boi-sai-toc-do-cao',
    category: 'cardio',
    categoryName: 'Cardio & Vận động',
    met: 9.8,
    intensity: 'Cao',
    icon: 'bi-water',
    description: 'Bơi sải bơi bướm liên tục, kích hoạt nhóm cơ lưng xô, ngực và tay vai.',
    defaultDurationMinutes: 30,
  },
  {
    name: 'Nhảy dây tốc độ trung bình',
    slug: 'nhay-day-trung-binh',
    category: 'cardio',
    categoryName: 'Cardio & Vận động',
    met: 10.0,
    intensity: 'Cao',
    icon: 'bi-repeat',
    description: 'Nhảy dây khoảng 100-120 nhịp/phút, tiêu hao năng lượng cực kỳ hiệu quả.',
    defaultDurationMinutes: 15,
  },
  {
    name: 'Tập tạ cơ bản (Weight Lifting)',
    slug: 'tap-ta-co-ban',
    category: 'strength',
    categoryName: 'Sức mạnh & Gym',
    met: 5.0,
    intensity: 'Trung bình',
    icon: 'bi-trophy',
    description: 'Tập kháng lực với tạ đơn hoặc máy tập, phát triển cơ bắp và định hình vóc dáng.',
    defaultDurationMinutes: 45,
  },
  {
    name: 'Tập thể hình chuyên sâu (Heavy Lifting)',
    slug: 'tap-the-hinh-chuyen-sau',
    category: 'strength',
    categoryName: 'Sức mạnh & Gym',
    met: 6.5,
    intensity: 'Cao',
    icon: 'bi-trophy',
    description: 'Tập mức tạ nặng với bài compound (Squat, Deadlift, Bench Press).',
    defaultDurationMinutes: 60,
  },
  {
    name: 'Calisthenics (Hít đất & Xà đơn)',
    slug: 'calisthenics-hit-dat-xa-don',
    category: 'strength',
    categoryName: 'Sức mạnh & Gym',
    met: 5.0,
    intensity: 'Trung bình',
    icon: 'bi-person-arms-up',
    description: 'Sử dụng trọng lượng cơ thể để rèn luyện độ dẻo dai và sức mạnh cốt lõi (core).',
    defaultDurationMinutes: 30,
  },
  {
    name: 'HIIT đốt mỡ toàn thân',
    slug: 'hiit-dot-mo-toan-than',
    category: 'cardio',
    categoryName: 'Cardio & Vận động',
    met: 8.5,
    intensity: 'Cao',
    icon: 'bi-fire',
    description: 'Chuỗi bài tập cardio ngắt quãng cường độ cao: Burpees, Jumping Jacks, Mountain Climbers.',
    defaultDurationMinutes: 20,
  },
  {
    name: 'Yoga Hatha phục hồi',
    slug: 'yoga-hatha-phuc-hoi',
    category: 'flexibility',
    categoryName: 'Yoga & Thư giãn',
    met: 2.5,
    intensity: 'Nhẹ',
    icon: 'bi-flower1',
    description: 'Các tư thế kéo giãn nhẹ nhàng kết hợp hít thở sâu, giảm căng thẳng cortisol.',
    defaultDurationMinutes: 45,
  },
  {
    name: 'Power Yoga / Vinyasa Yoga',
    slug: 'power-yoga-vinyasa',
    category: 'flexibility',
    categoryName: 'Yoga & Thư giãn',
    met: 4.0,
    intensity: 'Trung bình',
    icon: 'bi-flower1',
    description: 'Chuỗi chuyển động nhịp nhàng liên tục, rèn luyện sự thăng bằng và độ dẻo dai.',
    defaultDurationMinutes: 45,
  },
  {
    name: 'Giãn cơ & Thả lỏng toàn thân (Stretching)',
    slug: 'gian-co-tha-long',
    category: 'flexibility',
    categoryName: 'Yoga & Thư giãn',
    met: 2.3,
    intensity: 'Nhẹ',
    icon: 'bi-heart-pulse',
    description: 'Giãn cơ sau buổi tập, giải phóng axit lactic và ngăn ngừa đau mỏi cơ.',
    defaultDurationMinutes: 15,
  },
  {
    name: 'Pilates cơ bản',
    slug: 'pilates-co-ban',
    category: 'flexibility',
    categoryName: 'Yoga & Thư giãn',
    met: 3.0,
    intensity: 'Nhẹ',
    icon: 'bi-gem',
    description: 'Kiểm soát cơ bụng sâu và điều chỉnh tư thế cột sống.',
    defaultDurationMinutes: 40,
  },
  {
    name: 'Cầu lông phong trào',
    slug: 'cau-long-phong-trao',
    category: 'sports',
    categoryName: 'Thể thao đối kháng',
    met: 5.5,
    intensity: 'Trung bình',
    icon: 'bi-dribbble',
    description: 'Đánh đơn hoặc đánh đôi với cường độ phản xạ linh hoạt.',
    defaultDurationMinutes: 45,
  },
  {
    name: 'Bóng đá phong trào',
    slug: 'bong-da-phong-trao',
    category: 'sports',
    categoryName: 'Thể thao đối kháng',
    met: 8.0,
    intensity: 'Cao',
    icon: 'bi-dribbble',
    description: 'Chạy chỗ, tranh bóng và phối hợp liên tục trên sân cỏ.',
    defaultDurationMinutes: 60,
  },
  {
    name: 'Bóng rổ giao hữu',
    slug: 'bong-ro-giao-huu',
    category: 'sports',
    categoryName: 'Thể thao đối kháng',
    met: 6.5,
    intensity: 'Trung bình',
    icon: 'bi-dribbble',
    description: 'Bật nhảy, dẫn bóng và di chuyển nhịp độ liên tục.',
    defaultDurationMinutes: 45,
  },
  {
    name: 'Leo cầu thang (Stair Climbing)',
    slug: 'leo-cau-thang',
    category: 'cardio',
    categoryName: 'Cardio & Vận động',
    met: 8.8,
    intensity: 'Cao',
    icon: 'bi-reception-4',
    description: 'Leo bậc thang liên tục, kích hoạt mạnh mẽ cơ mông và đùi sau.',
    defaultDurationMinutes: 20,
  },
  {
    name: 'Aerobic / Nhảy Zumba',
    slug: 'aerobic-nhay-zumba',
    category: 'cardio',
    categoryName: 'Cardio & Vận động',
    met: 6.5,
    intensity: 'Trung bình',
    icon: 'bi-music-note-beamed',
    description: 'Vận động theo điệu nhạc sôi động, đốt mỡ và giải tỏa tinh thần hứng khởi.',
    defaultDurationMinutes: 45,
  },
];

/**
 * Tự động đồng bộ các bài tập mặc định nếu database trống
 */
async function ensureDefaultExercises() {
  const count = await Exercise.countDocuments();
  if (count === 0) {
    await Exercise.insertMany(DEFAULT_EXERCISES);
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

    const { search, category } = req.query;
    const filter = { isActive: true };

    if (category && category !== 'all') {
      filter.category = category;
    }

    if (search && search.trim()) {
      const term = search.trim();
      filter.$or = [
        { name: { $regex: term, $options: 'i' } },
        { description: { $regex: term, $options: 'i' } },
        { categoryName: { $regex: term, $options: 'i' } },
      ];
    }

    const exercises = await Exercise.find(filter).sort({ category: 1, name: 1 }).lean();
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
      if (startDate) filter.date.$gte = startDate;
      if (endDate) filter.date.$lte = endDate;
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
    // Luồng ngoại lệ 5a: Thời lượng <= 0
    if (!duration || duration <= 0) {
      return res.status(400).json({ message: 'Thời lượng tập luyện phải lớn hơn 0' });
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

    const logDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? date
      : new Date().toLocaleDateString('sv-SE');

    const logTime = time || new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());

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

    // Lấy lại tổng calories tiêu hao trong ngày để cập nhật
    const dailyLogs = await ExerciseLog.find({ userId: req.user.id, date: logDate }).lean();
    const dailyTotalCalories = dailyLogs.reduce((sum, item) => sum + (item.caloriesBurned || 0), 0);

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
    const { exerciseId, durationMinutes, date, time, notes } = req.body;

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
        return res.status(400).json({ message: 'Thông tin bài tập không hợp lệ' });
      }
      nextDuration = parsedDuration;
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
    log.caloriesBurned = calculateEstimatedCalories(nextMet, log.weightKg, nextDuration);

    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      log.date = date;
    }
    if (time !== undefined) {
      log.time = time;
    }
    if (notes !== undefined) {
      log.notes = String(notes).trim();
    }

    await log.save();

    return res.status(200).json({
      message: 'Cập nhật bài tập thành công',
      log,
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

    // Tính lại tổng calories sau khi xóa
    const remainingLogs = await ExerciseLog.find({ userId: req.user.id, date: logDate }).lean();
    const updatedDailyCalories = remainingLogs.reduce((sum, item) => sum + (item.caloriesBurned || 0), 0);

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

module.exports = {
  getExercises,
  calculateCalories,
  getExerciseLogs,
  createExerciseLog,
  updateExerciseLog,
  deleteExerciseLog,
  calculateEstimatedCalories,
};
