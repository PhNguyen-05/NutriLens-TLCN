const Exercise = require('../models/Exercise');
const ExerciseLog = require('../models/ExerciseLog');
const UserProfile = require('../models/UserProfile');
const WeightLog = require('../models/WeightLog');

const DEFAULT_EXERCISES = [
  {
    "name": "Đi bộ (Walking)",
    "slug": "di-bo",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 3.5,
    "intensity": "Nhẹ",
    "icon": "bi-person-walking",
    "description": "Đi bộ ngoài trời hoặc đi trên máy tập, tăng cường tuần hoàn tim mạch và đốt mỡ nhẹ nhàng.",
    "defaultDurationMinutes": 30,
    "imageUrl": "https://images.unsplash.com/photo-1502224562085-639556652f33?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=enYITYwvPAQ"
  },
  {
    "name": "Chạy bộ (Running / Jogging)",
    "slug": "chay-bo",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 8.5,
    "intensity": "Cao",
    "icon": "bi-lightning-charge",
    "description": "Chạy bộ ngoài trời hoặc máy chạy, rèn luyện sức bền tim phổi và đốt cháy calo hiệu quả.",
    "defaultDurationMinutes": 30,
    "imageUrl": "https://images.unsplash.com/photo-1486218119243-13883505764c?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=_kGESn8ArrU"
  },
  {
    "name": "Đạp xe (Cycling)",
    "slug": "dap-xe",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 6.8,
    "intensity": "Trung bình",
    "icon": "bi-bicycle",
    "description": "Đạp xe ngoài trời hoặc máy đạp tĩnh (Spin Bike), săn chắc cơ đùi và tốt cho khớp gối.",
    "defaultDurationMinutes": 30,
    "imageUrl": "https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=4sswGkM_Jao"
  },
  {
    "name": "Bơi lội (Swimming)",
    "slug": "boi-loi",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 6.5,
    "intensity": "Trung bình",
    "icon": "bi-water",
    "description": "Vận động toàn thân dưới nước (bơi sải, bơi ếch, bơi tự do), giảm áp lực lên xương khớp.",
    "defaultDurationMinutes": 30,
    "imageUrl": "https://images.unsplash.com/photo-1530549387789-4c1017266635?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=pFnU_Bqm_3o"
  },
  {
    "name": "Nhảy dây (Jump Rope)",
    "slug": "nhay-day",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 10,
    "intensity": "Cao",
    "icon": "bi-repeat",
    "description": "Nhảy dây đơn hoặc biến tốc, kích hoạt phản xạ nhanh và tiêu hao năng lượng cực lớn.",
    "defaultDurationMinutes": 15,
    "imageUrl": "https://images.unsplash.com/photo-1434596922112-19c563067271?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=1BZM2Vre5oc"
  },
  {
    "name": "Aerobic & Zumba Dance",
    "slug": "aerobic-zumba",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 6.5,
    "intensity": "Trung bình",
    "icon": "bi-music-note-beamed",
    "description": "Vận động theo điệu nhạc sôi động, kích thích nhịp tim, đốt mỡ và giải tỏa căng thẳng.",
    "defaultDurationMinutes": 45,
    "imageUrl": "https://images.unsplash.com/photo-1524594152303-9fd13543fe6e?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=gCzgc_RelBA"
  },
  {
    "name": "HIIT (Cardio ngắt quãng)",
    "slug": "hiit-cardio",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 8.5,
    "intensity": "Cao",
    "icon": "bi-fire",
    "description": "Chuỗi bài tập cardio ngắt quãng cường độ cao (Burpees, Jumping Jacks, High Knees), kích hoạt đốt mỡ Afterburn.",
    "defaultDurationMinutes": 20,
    "imageUrl": "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=ml6cT4AZdqI"
  },
  {
    "name": "Leo cầu thang (Stair Climbing)",
    "slug": "leo-cau-thang",
    "category": "cardio",
    "categoryName": "Cardio & Vận động",
    "met": 8.8,
    "intensity": "Cao",
    "icon": "bi-speedometer2",
    "description": "Leo bậc thang bộ hoặc máy leo dốc liên tục, kích hoạt mạnh mẽ cơ mông, đùi và bắp chân.",
    "defaultDurationMinutes": 20,
    "imageUrl": "https://images.unsplash.com/photo-1598289431512-b97b0917affc?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=E_MvC8t1t-w"
  },
  {
    "name": "Tập tạ & Thể hình (Gym / Weight Training)",
    "slug": "tap-ta-gym",
    "category": "strength",
    "categoryName": "Sức mạnh & Gym",
    "met": 5.5,
    "intensity": "Trung bình",
    "icon": "bi-trophy",
    "description": "Tập kháng lực với tạ đơn, tạ đòn hoặc máy tập thể hình, phát triển khối cơ và định hình vóc dáng.",
    "defaultDurationMinutes": 45,
    "imageUrl": "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=U0bhE67HuDY"
  },
  {
    "name": "Calisthenics & Bodyweight",
    "slug": "calisthenics-bodyweight",
    "category": "strength",
    "categoryName": "Sức mạnh & Gym",
    "met": 5,
    "intensity": "Trung bình",
    "icon": "bi-person-arms-up",
    "description": "Tập luyện sử dụng trọng lượng cơ thể (hít đất, xà đơn, dips), rèn luyện sức mạnh và kiểm soát cơ bắp.",
    "defaultDurationMinutes": 30,
    "imageUrl": "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=IODxDxX7oi4"
  },
  {
    "name": "Plank & Gập bụng (Core & Abs)",
    "slug": "plank-gap-bung-core",
    "category": "strength",
    "categoryName": "Sức mạnh & Gym",
    "met": 4,
    "intensity": "Trung bình",
    "icon": "bi-shield-check",
    "description": "Các bài tập siết chặt cơ lõi (Plank, Crunch, Leg Raise), củng cố lưng dưới và thon gọn vòng eo.",
    "defaultDurationMinutes": 20,
    "imageUrl": "https://images.unsplash.com/photo-1566241142559-40e1dab266c6?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=1919eTCoESo"
  },
  {
    "name": "Tập với dây kháng lực (Resistance Bands)",
    "slug": "tap-day-khang-luc",
    "category": "strength",
    "categoryName": "Sức mạnh & Gym",
    "met": 4.5,
    "intensity": "Trung bình",
    "icon": "bi-bandaid",
    "description": "Bài tập kích hoạt và săn chắc các nhóm cơ với dây thun đàn hồi, an toàn cho các khớp.",
    "defaultDurationMinutes": 30,
    "imageUrl": "https://images.unsplash.com/photo-1598971639058-fab3c3109a00?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=r3Z9x0o8_f0"
  },
  {
    "name": "Yoga (Hatha, Vinyasa, phục hồi)",
    "slug": "yoga",
    "category": "flexibility",
    "categoryName": "Yoga & Thư giãn",
    "met": 3,
    "intensity": "Nhẹ",
    "icon": "bi-flower1",
    "description": "Các bài tập chuỗi tư thế Yoga kết hợp điều hòa hơi thở, giúp cơ thể dẻo dai, thư thái và giảm stress.",
    "defaultDurationMinutes": 45,
    "imageUrl": "https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=v7AYKMP6rOE"
  },
  {
    "name": "Pilates",
    "slug": "pilates",
    "category": "flexibility",
    "categoryName": "Yoga & Thư giãn",
    "met": 3,
    "intensity": "Nhẹ",
    "icon": "bi-peace",
    "description": "Tập trung vào kiểm soát cơ bụng sâu, điều chỉnh tư thế cột sống và tăng độ linh hoạt khớp.",
    "defaultDurationMinutes": 40,
    "imageUrl": "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=K-PpDUtKGCE"
  },
  {
    "name": "Giãn cơ & Thả lỏng (Stretching)",
    "slug": "gian-co-tha-long",
    "category": "flexibility",
    "categoryName": "Yoga & Thư giãn",
    "met": 2.5,
    "intensity": "Nhẹ",
    "icon": "bi-heart-pulse",
    "description": "Kéo giãn toàn thân sau buổi tập hoặc sau giờ làm việc, giải phóng axit lactic và ngừa đau nhức cơ.",
    "defaultDurationMinutes": 15,
    "imageUrl": "https://images.unsplash.com/photo-1518310383802-640c2de311b2?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=g_tea8ZNk5A"
  },
  {
    "name": "Thái Cực Quyền (Tai Chi)",
    "slug": "thai-cuc-quyen-tai-chi",
    "category": "flexibility",
    "categoryName": "Yoga & Thư giãn",
    "met": 3,
    "intensity": "Nhẹ",
    "icon": "bi-yin-yang",
    "description": "Các chuyển động mềm mại, chậm rãi kết hợp hơi thở sâu, rèn luyện thăng bằng và định tâm.",
    "defaultDurationMinutes": 30,
    "imageUrl": "https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=cEOS2zoyEm4"
  },
  {
    "name": "Bóng đá (Football / Soccer)",
    "slug": "bong-da",
    "category": "sports",
    "categoryName": "Thể thao",
    "met": 8,
    "intensity": "Cao",
    "icon": "bi-dribbble",
    "description": "Chạy chỗ, tranh bóng và phối hợp liên tục trên sân cỏ, nâng cao thể lực và sức bền toàn diện.",
    "defaultDurationMinutes": 60,
    "imageUrl": "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=0kF_N74F6i0"
  },
  {
    "name": "Bóng rổ (Basketball)",
    "slug": "bong-ro",
    "category": "sports",
    "categoryName": "Thể thao",
    "met": 6.5,
    "intensity": "Trung bình",
    "icon": "bi-dribbble",
    "description": "Dẫn bóng, bật nhảy ném rổ và di chuyển liên tục, phát triển chiều cao và phản xạ linh hoạt.",
    "defaultDurationMinutes": 45,
    "imageUrl": "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=1F_X4rO1s68"
  },
  {
    "name": "Cầu lông (Badminton)",
    "slug": "cau-long",
    "category": "sports",
    "categoryName": "Thể thao",
    "met": 5.5,
    "intensity": "Trung bình",
    "icon": "bi-dribbble",
    "description": "Đánh cầu lông đơn hoặc đôi, di chuyển bước chân nhanh nhẹn và rèn luyện phản xạ cổ tay.",
    "defaultDurationMinutes": 45,
    "imageUrl": "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=0sI27j3K_9s"
  },
  {
    "name": "Bóng bàn (Table Tennis)",
    "slug": "bong-ban",
    "category": "sports",
    "categoryName": "Thể thao",
    "met": 4,
    "intensity": "Trung bình",
    "icon": "bi-dribbble",
    "description": "Rèn luyện phản xạ tay mắt nhanh nhạy và các bước di chuyển ngắn liên tục quanh bàn bóng.",
    "defaultDurationMinutes": 45,
    "imageUrl": "https://images.unsplash.com/photo-1534158914592-062992fbe900?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=FqS7bSg-0-Q"
  },
  {
    "name": "Quần vợt (Tennis)",
    "slug": "quan-vot-tennis",
    "category": "sports",
    "categoryName": "Thể thao",
    "met": 7.3,
    "intensity": "Cao",
    "icon": "bi-dribbble",
    "description": "Đánh tennis đơn hoặc đôi với những pha di chuyển bao sân rộng và phát bóng mạnh mẽ.",
    "defaultDurationMinutes": 60,
    "imageUrl": "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=p1h2b0V5r-0"
  },
  {
    "name": "Pickleball",
    "slug": "pickleball",
    "category": "sports",
    "categoryName": "Thể thao",
    "met": 6,
    "intensity": "Trung bình",
    "icon": "bi-dribbble",
    "description": "Môn thể thao vợt đối kháng hiện đại kết hợp tennis, bóng bàn và cầu lông, phù hợp mọi lứa tuổi.",
    "defaultDurationMinutes": 45,
    "imageUrl": "https://images.unsplash.com/photo-1599474924187-334a4ae5bd3c?auto=format&fit=crop&w=700&q=80",
    "youtubeUrl": "https://www.youtube.com/watch?v=kqLRRNOpe8U"
  }
];

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
        return res.status(400).json({ message: 'Thời lượng tập luyện phải lớn hơn 0' });
      }
      if (parsedDuration > 1440) {
        return res.status(400).json({ message: 'Thời lượng tập không thể vượt quá 24 giờ (1440 phút)' });
      }
      nextDuration = parsedDuration;
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
    log.caloriesBurned = calculateEstimatedCalories(nextMet, log.weightKg, nextDuration);
    log.date = nextDate;
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
