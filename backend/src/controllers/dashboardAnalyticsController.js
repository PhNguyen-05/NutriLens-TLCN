const mongoose = require('mongoose');
const UserProfile = require('../models/UserProfile');
const User = require('../models/User');
const WeightLog = require('../models/WeightLog');
const MealLog = require('../models/MealLog');
const ExerciseLog = require('../models/ExerciseLog');
const { computeBaselineLockStatus, getTodayDateString } = require('../utils/weightBaselineUtils');
const { buildUserResponse } = require('../utils/userUtils');

/**
 * GET /api/profile/dashboard-stats
 * Lấy toàn bộ số liệu thống kê dinh dưỡng & tập luyện của người dùng tại trang Dashboard
 * Query: ?date=YYYY-MM-DD
 * Tối ưu bằng MongoDB Aggregation Pipeline ($match, $group) cho chu kỳ 7 ngày và distinct query cho Streak
 */
async function getDashboardStats(req, res) {
  try {
    const userId = req.user.id;
    const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
    const todayVietnam = getTodayDateString();
    const selectedDate = (req.query.date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date))
      ? req.query.date
      : todayVietnam;

    // 1. Lấy thông tin User, Hồ sơ UserProfile và WeightLog gần nhất
    const [user, profile, latestWeightLog] = await Promise.all([
      User.findById(userId).select('fullName email avatarUrl gender dateOfBirth').lean(),
      UserProfile.findOne({ user: userObjectId }).lean(),
      WeightLog.findOne({ user: userObjectId })
        .select('weightKg recordedDate loggedAt updateCount')
        .sort({ recordedDate: -1, loggedAt: -1 })
        .lean(),
    ]);

    const baselineStatus = computeBaselineLockStatus(profile, latestWeightLog);

    // 2. Mục tiêu calo & macro
    const calorieTarget = profile?.nutritionGoal?.calorieTarget || profile?.healthMetrics?.tdee || 2000;
    const proteinTarget = profile?.nutritionGoal?.proteinG || Math.round((calorieTarget * 0.25) / 4) || 125;
    const carbsTarget = profile?.nutritionGoal?.carbsG || Math.round((calorieTarget * 0.50) / 4) || 250;
    const fatTarget = profile?.nutritionGoal?.fatG || Math.round((calorieTarget * 0.25) / 9) || 55;
    const currentWeight = latestWeightLog?.weightKg || profile?.currentWeightKg || 60;
    const waterTargetMl = Math.max(2000, Math.round(currentWeight * 35));

    // 3. Lấy MealLogs và ExerciseLogs của ngày đã chọn
    const [mealLogs, latestMealDocs, exerciseLogs] = await Promise.all([
      MealLog.find({ userId: userObjectId, date: selectedDate }).sort({ createdAt: -1 }).lean(),
      MealLog.find({ userId: userObjectId }).sort({ createdAt: -1, date: -1 }).limit(5).lean(),
      ExerciseLog.find({ userId: userObjectId, date: selectedDate }).sort({ createdAt: 1 }).lean(),
    ]);

    let eatenCalories = 0;
    let eatenProtein = 0;
    let eatenCarbs = 0;
    let eatenFat = 0;
    let eatenFiber = 0;
    let eatenSodium = 0;

    function formatMealItem(log) {
      const s = log.servings || 1;
      const cal = Math.round((log.nutrition?.calories || 0) * s);
      const pro = Math.round((log.nutrition?.protein || 0) * s * 10) / 10;
      const carb = Math.round((log.nutrition?.carbs || 0) * s * 10) / 10;
      const fat = Math.round((log.nutrition?.fat || 0) * s * 10) / 10;
      const fiber = Math.round((log.nutrition?.fiber || 0) * s * 10) / 10;
      const sodium = Math.round((log.nutrition?.sodium || 0) * s * 10) / 10;

      return {
        _id: log._id,
        foodSlug: log.foodSlug,
        foodName: log.foodName,
        date: log.date,
        mealType: log.mealType || 'lunch',
        servings: s,
        imageUrl: log.imageUrl,
        confidence: log.confidence,
        calories: cal,
        protein: pro,
        carbs: carb,
        fat,
        fiber,
        sodium,
        createdAt: log.createdAt,
      };
    }

    const meals = mealLogs.map((log) => {
      const item = formatMealItem(log);
      eatenCalories += item.calories;
      eatenProtein += item.protein;
      eatenCarbs += item.carbs;
      eatenFat += item.fat;
      eatenFiber += item.fiber;
      eatenSodium += item.sodium;
      return item;
    });

    const latestMeals = latestMealDocs.map(formatMealItem);

    let burnedCalories = 0;
    let exerciseMinutes = 0;

    const exercises = exerciseLogs.map((ex) => {
      burnedCalories += (ex.caloriesBurned || 0);
      exerciseMinutes += (ex.durationMinutes || 0);
      return {
        _id: ex._id,
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        category: ex.category,
        met: ex.met,
        durationMinutes: ex.durationMinutes,
        caloriesBurned: ex.caloriesBurned,
        time: ex.time,
        notes: ex.notes,
      };
    });

    // 4. Thống kê 7 ngày tính đến selectedDate bằng MongoDB Aggregation Pipeline (sử dụng UTC calendar arithmetic để tránh lệch múi giờ)
    const [selY, selM, selD] = selectedDate.split('-').map(Number);
    const dateList = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.UTC(selY, selM - 1, selD - i));
      const yStr = d.getUTCFullYear();
      const mStr = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dStr = String(d.getUTCDate()).padStart(2, '0');
      dateList.push(`${yStr}-${mStr}-${dStr}`);
    }

    const [weeklyMealAgg, weeklyExerciseAgg] = await Promise.all([
      MealLog.aggregate([
        { $match: { userId: userObjectId, date: { $in: dateList } } },
        {
          $group: {
            _id: '$date',
            caloriesIn: {
              $sum: {
                $round: [
                  { $multiply: [{ $ifNull: ['$nutrition.calories', 0] }, { $ifNull: ['$servings', 1] }] },
                  0,
                ],
              },
            },
          },
        },
      ]),
      ExerciseLog.aggregate([
        { $match: { userId: userObjectId, date: { $in: dateList } } },
        {
          $group: {
            _id: '$date',
            caloriesOut: { $sum: { $ifNull: ['$caloriesBurned', 0] } },
          },
        },
      ]),
    ]);

    const mealCalMap = new Map(weeklyMealAgg.map((item) => [item._id, item.caloriesIn]));
    const exCalMap = new Map(weeklyExerciseAgg.map((item) => [item._id, item.caloriesOut]));
    const dayLabelsMap = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    const weeklyDays = dateList.map((dStr) => {
      const [y, m, d] = dStr.split('-').map(Number);
      const dObj = new Date(Date.UTC(y, m - 1, d));
      const dayLabel = dayLabelsMap[dObj.getUTCDay()];

      const caloriesIn = mealCalMap.get(dStr) || 0;
      const caloriesOut = exCalMap.get(dStr) || 0;

      return {
        date: dStr,
        dayLabel,
        caloriesIn,
        caloriesOut,
        net: caloriesIn - caloriesOut,
        isToday: dStr === todayVietnam,
        isSelected: dStr === selectedDate,
      };
    });

    // 5. Tính chuỗi ngày liên tiếp ghi nhận (Streak) trong 30 ngày gần đây bằng distinct query
    const thirtyDaysAgoDate = new Date(Date.UTC(selY, selM - 1, selD - 30));
    const y30 = thirtyDaysAgoDate.getUTCFullYear();
    const m30 = String(thirtyDaysAgoDate.getUTCMonth() + 1).padStart(2, '0');
    const d30 = String(thirtyDaysAgoDate.getUTCDate()).padStart(2, '0');
    const thirtyDaysAgoStr = `${y30}-${m30}-${d30}`;

    const [streakMeals, streakExercises] = await Promise.all([
      MealLog.distinct('date', { userId: userObjectId, date: { $gte: thirtyDaysAgoStr } }),
      ExerciseLog.distinct('date', { userId: userObjectId, date: { $gte: thirtyDaysAgoStr } }),
    ]);

    const loggedDates = new Set([
      ...streakMeals,
      ...streakExercises,
    ]);

    let streak = 0;
    const offset = loggedDates.has(todayVietnam) ? 0 : 1;
    const [ty, tm, td] = todayVietnam.split('-').map(Number);
    for (let i = offset; i < 30; i++) {
      const d = new Date(Date.UTC(ty, tm - 1, td - i));
      const yStr = d.getUTCFullYear();
      const mStr = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dStr = String(d.getUTCDate()).padStart(2, '0');
      const targetStr = `${yStr}-${mStr}-${dStr}`;
      if (loggedDates.has(targetStr)) {
        streak++;
      } else {
        break;
      }
    }

    const netCalories = eatenCalories - burnedCalories;
    const remainingCalories = calorieTarget - eatenCalories + burnedCalories;

    // Tính thâm hụt trung bình 7 ngày
    const daysWithData = weeklyDays.filter((d) => d.caloriesIn > 0 || d.caloriesOut > 0);
    const avgDeficit = daysWithData.length
      ? Math.round(daysWithData.reduce((sum, d) => sum + (d.net - calorieTarget), 0) / daysWithData.length)
      : -(calorieTarget - netCalories);

    return res.status(200).json({
      selectedDate,
      todayDate: todayVietnam,
      isToday: selectedDate === todayVietnam,
      user: user ? buildUserResponse(user) : null,
      profile,
      baselineStatus,
      targets: {
        calorieTarget,
        proteinTarget,
        carbsTarget,
        fatTarget,
        waterTargetMl,
      },
      todayNutrition: {
        calories: eatenCalories,
        protein: Math.round(eatenProtein * 10) / 10,
        carbs: Math.round(eatenCarbs * 10) / 10,
        fat: Math.round(eatenFat * 10) / 10,
        fiber: Math.round(eatenFiber * 10) / 10,
        sodium: Math.round(eatenSodium * 10) / 10,
        mealCount: meals.length,
      },
      todayExercise: {
        caloriesBurned: burnedCalories,
        durationMinutes: exerciseMinutes,
        workoutCount: exercises.length,
      },
      netCalories,
      remainingCalories,
      meals,
      latestMeals,
      exercises,
      weeklyDays,
      streak: Math.max(streak, 0),
      avgDeficit,
    });
  } catch (err) {
    console.error('[getDashboardStats] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể tải thống kê bảng điều khiển' });
  }
}

/**
 * Lấy toàn bộ số liệu chỉ số & xu hướng thống kê cá nhân hóa của người dùng (UC Analytics & Trends)
 * Hỗ trợ các chu kỳ: 7d, 14d, 30d, 90d
 * Tối ưu hóa toàn diện bằng MongoDB Aggregation Pipeline ($match, $facet, $group, $sort, $limit)
 */
async function getUserAnalytics(req, res) {
  try {
    const userId = req.user.id;
    const userObjectId = mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : userId;
    const todayVietnam = getTodayDateString();

    const period = (req.query.period || '7d').toLowerCase();
    let numDays = 7;
    if (period === '14d') numDays = 14;
    else if (period === '30d') numDays = 30;
    else if (period === '90d') numDays = 90;

    let endStr = (req.query.endDate && /^\d{4}-\d{2}-\d{2}$/.test(req.query.endDate))
      ? req.query.endDate
      : todayVietnam;

    // Tính danh sách ngày từ (endStr - numDays + 1) đến endStr (dùng UTC calendar arithmetic tránh lệch múi giờ)
    const [ey, em, ed] = endStr.split('-').map(Number);
    const dateList = [];
    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(ey, em - 1, ed - i));
      const yStr = d.getUTCFullYear();
      const mStr = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dStr = String(d.getUTCDate()).padStart(2, '0');
      dateList.push(`${yStr}-${mStr}-${dStr}`);
    }
    const startStr = dateList[0];

    // Chạy song song: User, UserProfile, WeightLog và các Aggregation Pipeline của MealLog & ExerciseLog
    const [user, profile, allWeightLogs, [mealFacetResult], [exerciseFacetResult]] = await Promise.all([
      User.findById(userId).select('fullName email avatarUrl gender dateOfBirth').lean(),
      UserProfile.findOne({ user: userObjectId }).lean(),
      WeightLog.find({ user: userObjectId }).select('weightKg recordedDate').sort({ recordedDate: 1 }).lean(),
      MealLog.aggregate([
        { $match: { userId: userObjectId, date: { $in: dateList } } },
        {
          $facet: {
            dailyAndType: [
              {
                $group: {
                  _id: {
                    date: '$date',
                    mealType: { $ifNull: ['$mealType', 'lunch'] },
                  },
                  calories: {
                    $sum: {
                      $round: [
                        { $multiply: [{ $ifNull: ['$nutrition.calories', 0] }, { $ifNull: ['$servings', 1] }] },
                        0,
                      ],
                    },
                  },
                  protein: { $sum: { $multiply: [{ $ifNull: ['$nutrition.protein', 0] }, { $ifNull: ['$servings', 1] }] } },
                  carbs: { $sum: { $multiply: [{ $ifNull: ['$nutrition.carbs', 0] }, { $ifNull: ['$servings', 1] }] } },
                  fat: { $sum: { $multiply: [{ $ifNull: ['$nutrition.fat', 0] }, { $ifNull: ['$servings', 1] }] } },
                  fiber: { $sum: { $multiply: [{ $ifNull: ['$nutrition.fiber', 0] }, { $ifNull: ['$servings', 1] }] } },
                  sodium: { $sum: { $multiply: [{ $ifNull: ['$nutrition.sodium', 0] }, { $ifNull: ['$servings', 1] }] } },
                  count: { $sum: 1 },
                },
              },
            ],
            topFoods: [
              {
                $group: {
                  _id: { $ifNull: ['$foodName', 'Món ăn'] },
                  count: { $sum: 1 },
                  calories: {
                    $sum: {
                      $round: [
                        { $multiply: [{ $ifNull: ['$nutrition.calories', 0] }, { $ifNull: ['$servings', 1] }] },
                        0,
                      ],
                    },
                  },
                  imageUrl: { $first: '$imageUrl' },
                },
              },
              { $sort: { calories: -1 } },
              { $limit: 5 },
            ],
          },
        },
      ]),
      ExerciseLog.aggregate([
        { $match: { userId: userObjectId, date: { $in: dateList } } },
        {
          $facet: {
            daily: [
              {
                $group: {
                  _id: '$date',
                  caloriesBurned: { $sum: { $ifNull: ['$caloriesBurned', 0] } },
                  durationMinutes: { $sum: { $ifNull: ['$durationMinutes', 0] } },
                  workoutCount: { $sum: 1 },
                },
              },
            ],
            categories: [
              {
                $group: {
                  _id: { $ifNull: ['$category', 'other'] },
                  minutes: { $sum: { $ifNull: ['$durationMinutes', 0] } },
                  calories: { $sum: { $ifNull: ['$caloriesBurned', 0] } },
                  count: { $sum: 1 },
                },
              },
            ],
            topExercises: [
              {
                $group: {
                  _id: { $ifNull: ['$exerciseName', 'Bài tập'] },
                  category: { $first: { $ifNull: ['$category', 'other'] } },
                  count: { $sum: 1 },
                  minutes: { $sum: { $ifNull: ['$durationMinutes', 0] } },
                  calories: { $sum: { $ifNull: ['$caloriesBurned', 0] } },
                },
              },
              { $sort: { calories: -1 } },
              { $limit: 5 },
            ],
          },
        },
      ]),
    ]);

    // Mục tiêu calo & macro
    const calorieTarget = profile?.nutritionGoal?.calorieTarget || profile?.healthMetrics?.tdee || 2000;
    const bmr = profile?.healthMetrics?.bmr || 1500;
    const tdee = profile?.healthMetrics?.tdee || 2000;
    const proteinTarget = profile?.nutritionGoal?.proteinG || Math.round((calorieTarget * 0.25) / 4) || 125;
    const carbsTarget = profile?.nutritionGoal?.carbsG || Math.round((calorieTarget * 0.50) / 4) || 250;
    const fatTarget = profile?.nutritionGoal?.fatG || Math.round((calorieTarget * 0.25) / 9) || 55;
    const targetWeightKg = profile?.targetWeightKg || null;
    const initialWeightKg = profile?.currentWeightKg || (allWeightLogs[0]?.weightKg ?? 60);

    // Map weight logs theo 'YYYY-MM-DD'
    const weightMap = new Map();
    allWeightLogs.forEach((log) => {
      if (log.recordedDate) {
        const dStr = new Date(log.recordedDate).toISOString().slice(0, 10);
        weightMap.set(dStr, log.weightKg);
      }
    });

    // Xử lý dữ liệu meal từ Aggregation Pipeline
    const dailyMealMap = new Map();
    const mealCategoryCount = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
    const mealCategoryCalories = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };

    const dailyAndType = mealFacetResult?.dailyAndType || [];
    dailyAndType.forEach((item) => {
      const date = item._id.date;
      const rawType = item._id.mealType;
      const mType = (rawType && mealCategoryCalories[rawType] !== undefined) ? rawType : 'lunch';
      const cal = item.calories || 0;
      const pro = item.protein || 0;
      const carb = item.carbs || 0;
      const fat = item.fat || 0;
      const fib = item.fiber || 0;
      const sod = item.sodium || 0;
      const cnt = item.count || 0;

      mealCategoryCalories[mType] += cal;
      mealCategoryCount[mType] += cnt;

      if (!dailyMealMap.has(date)) {
        dailyMealMap.set(date, {
          caloriesIn: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
          sodium: 0,
          mealCount: 0,
          mealTypes: { breakfast: 0, lunch: 0, dinner: 0, snack: 0 },
        });
      }
      const dayEntry = dailyMealMap.get(date);
      dayEntry.caloriesIn += cal;
      dayEntry.protein += pro;
      dayEntry.carbs += carb;
      dayEntry.fat += fat;
      dayEntry.fiber += fib;
      dayEntry.sodium += sod;
      dayEntry.mealCount += cnt;
      dayEntry.mealTypes[mType] += cal;
    });

    const topFoods = (mealFacetResult?.topFoods || []).map((f) => ({
      name: f._id || 'Món ăn',
      count: f.count || 0,
      calories: f.calories || 0,
      imageUrl: f.imageUrl || null,
    }));

    // Xử lý dữ liệu exercise từ Aggregation Pipeline
    const dailyExerciseMap = new Map();
    (exerciseFacetResult?.daily || []).forEach((item) => {
      dailyExerciseMap.set(item._id, {
        caloriesBurned: item.caloriesBurned || 0,
        durationMinutes: item.durationMinutes || 0,
        workoutCount: item.workoutCount || 0,
      });
    });

    const topExercises = (exerciseFacetResult?.topExercises || []).map((ex) => ({
      name: ex._id || 'Bài tập',
      category: ex.category || 'other',
      count: ex.count || 0,
      minutes: ex.minutes || 0,
      calories: ex.calories || 0,
    }));

    const dayLabelsMap = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    let totalCaloriesIn = 0;
    let totalCaloriesBurned = 0;
    let totalExerciseMinutes = 0;
    let totalWorkouts = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalFiber = 0;
    let totalSodium = 0;

    let daysWithMeals = 0;
    let daysWithExercises = 0;
    let daysLogged = 0;
    let daysMeetingCalorieGoal = 0;

    const dailyData = dateList.map((dStr) => {
      const [y, m, d] = dStr.split('-').map(Number);
      const dObj = new Date(Date.UTC(y, m - 1, d));
      const dayOfWeekIdx = dObj.getUTCDay();
      const dayLabel = dayLabelsMap[dayOfWeekIdx];

      const mealEntry = dailyMealMap.get(dStr);
      const exEntry = dailyExerciseMap.get(dStr);

      const dayCalIn = mealEntry?.caloriesIn || 0;
      const dayProtein = mealEntry?.protein || 0;
      const dayCarbs = mealEntry?.carbs || 0;
      const dayFat = mealEntry?.fat || 0;
      const dayFiber = mealEntry?.fiber || 0;
      const daySodium = mealEntry?.sodium || 0;
      const dayMealCount = mealEntry?.mealCount || 0;
      const dayMealTypes = mealEntry?.mealTypes || { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };

      const dayCalBurned = exEntry?.caloriesBurned || 0;
      const dayMinutes = exEntry?.durationMinutes || 0;
      const dayWorkoutCount = exEntry?.workoutCount || 0;

      const hasDayMeal = dayMealCount > 0;
      const hasDayEx = dayWorkoutCount > 0;
      const dayWeight = weightMap.has(dStr) ? weightMap.get(dStr) : null;
      const hasAnyData = hasDayMeal || hasDayEx || dayWeight !== null;

      if (hasDayMeal) daysWithMeals++;
      if (hasDayEx) daysWithExercises++;
      if (hasAnyData) daysLogged++;

      totalCaloriesIn += dayCalIn;
      totalCaloriesBurned += dayCalBurned;
      totalExerciseMinutes += dayMinutes;
      totalWorkouts += dayWorkoutCount;
      totalProtein += dayProtein;
      totalCarbs += dayCarbs;
      totalFat += dayFat;
      totalFiber += dayFiber;
      totalSodium += daySodium;

      const netCalories = dayCalIn - dayCalBurned;
      const deficit = netCalories - calorieTarget;

      if (hasDayMeal && Math.abs(deficit) <= 250) {
        daysMeetingCalorieGoal++;
      }

      return {
        date: dStr,
        dayLabel,
        dayOfWeek: dayOfWeekIdx,
        formattedDate: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`,
        caloriesIn: dayCalIn,
        caloriesBurned: dayCalBurned,
        netCalories,
        calorieTarget,
        deficit,
        exerciseMinutes: dayMinutes,
        mealCount: dayMealCount,
        workoutCount: dayWorkoutCount,
        protein: Math.round(dayProtein * 10) / 10,
        carbs: Math.round(dayCarbs * 10) / 10,
        fat: Math.round(dayFat * 10) / 10,
        fiber: Math.round(dayFiber * 10) / 10,
        sodium: Math.round(daySodium * 10) / 10,
        mealBreakdown: dayMealTypes,
        weightKg: dayWeight,
        hasData: hasAnyData,
        isToday: dStr === todayVietnam,
      };
    });

    // Tính streak hiện tại bằng distinct query (tận dụng index, chỉ lấy trong 365 ngày gần nhất)
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);
    const oneYearAgoStr = oneYearAgo.toISOString().slice(0, 10);

    const [streakMealDates, streakExDates] = await Promise.all([
      MealLog.distinct('date', { userId: userObjectId, date: { $gte: oneYearAgoStr } }),
      ExerciseLog.distinct('date', { userId: userObjectId, date: { $gte: oneYearAgoStr } }),
    ]);

    const allLoggedDates = new Set([
      ...streakMealDates,
      ...streakExDates,
      ...Array.from(weightMap.keys()),
    ]);

    let streak = 0;
    const offset = allLoggedDates.has(todayVietnam) ? 0 : 1;
    for (let i = offset; i < 365; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
      if (allLoggedDates.has(dStr)) {
        streak++;
      } else {
        break;
      }
    }

    const activeLoggingDays = Math.max(1, daysLogged);
    const avgCaloriesIn = Math.round(totalCaloriesIn / activeLoggingDays);
    const avgCaloriesBurned = Math.round(totalCaloriesBurned / activeLoggingDays);
    const avgNetCalories = avgCaloriesIn - avgCaloriesBurned;
    const avgDeficit = avgNetCalories - calorieTarget;

    const avgProtein = Math.round((totalProtein / activeLoggingDays) * 10) / 10;
    const avgCarbs = Math.round((totalCarbs / activeLoggingDays) * 10) / 10;
    const avgFat = Math.round((totalFat / activeLoggingDays) * 10) / 10;
    const avgFiber = Math.round((totalFiber / activeLoggingDays) * 10) / 10;
    const avgSodium = Math.round(totalSodium / activeLoggingDays);

    const macroProCal = avgProtein * 4;
    const macroCarbCal = avgCarbs * 4;
    const macroFatCal = avgFat * 9;
    const totalMacroCal = (macroProCal + macroCarbCal + macroFatCal) || 1;
    const actualProteinPct = Math.round((macroProCal / totalMacroCal) * 100);
    const actualCarbsPct = Math.round((macroCarbCal / totalMacroCal) * 100);
    const actualFatPct = Math.max(0, 100 - actualProteinPct - actualCarbsPct);

    const targetProteinPct = profile?.nutritionGoal?.macroPercentages?.protein || 25;
    const targetCarbsPct = profile?.nutritionGoal?.macroPercentages?.carbs || 50;
    const targetFatPct = profile?.nutritionGoal?.macroPercentages?.fat || 25;

    const totalDeficitKcal = (calorieTarget * activeLoggingDays) - (totalCaloriesIn - totalCaloriesBurned);
    const projectedWeightChangeKg = Number((-totalDeficitKcal / 7700).toFixed(2));

    const validWeightsInPeriod = dailyData.filter((d) => d.weightKg !== null).map((d) => d.weightKg);
    const latestWeight = allWeightLogs.length ? allWeightLogs[allWeightLogs.length - 1].weightKg : (profile?.currentWeightKg || 60);
    const firstWeightOfPeriod = validWeightsInPeriod.length > 0 ? validWeightsInPeriod[0] : (allWeightLogs[0]?.weightKg || latestWeight);
    const actualWeightChangeInPeriod = Number((latestWeight - firstWeightOfPeriod).toFixed(1));

    const heightM = (profile?.heightCm || 170) / 100;
    const currentBmi = Number((latestWeight / (heightM * heightM)).toFixed(1));
    let bmiCategory = 'Bình thường';
    if (currentBmi < 18.5) bmiCategory = 'Thiếu cân';
    else if (currentBmi >= 25) bmiCategory = 'Béo phì';
    else if (currentBmi >= 23) bmiCategory = 'Thừa cân';

    const minHealthyWeight = Number((18.5 * heightM * heightM).toFixed(1));
    const maxHealthyWeight = Number((22.9 * heightM * heightM).toFixed(1));

    // Thống kê theo thứ trong tuần
    const dowStats = dayLabelsMap.map((label, idx) => {
      const daysOfThisDow = dailyData.filter((d) => d.dayOfWeek === idx);
      const withMeals = daysOfThisDow.filter((d) => d.caloriesIn > 0);
      const withEx = daysOfThisDow.filter((d) => d.caloriesBurned > 0);
      const avgIn = withMeals.length ? Math.round(withMeals.reduce((s, d) => s + d.caloriesIn, 0) / withMeals.length) : 0;
      const avgOut = withEx.length ? Math.round(withEx.reduce((s, d) => s + d.caloriesBurned, 0) / withEx.length) : 0;
      return {
        dayLabel: label,
        dayOfWeek: idx,
        avgCaloriesIn: avgIn,
        avgCaloriesBurned: avgOut,
        count: daysOfThisDow.length,
      };
    });

    const sortedDowStats = [
      dowStats[1], dowStats[2], dowStats[3], dowStats[4], dowStats[5], dowStats[6], dowStats[0],
    ];

    const rawCategories = exerciseFacetResult?.categories || [];
    const workoutCategories = rawCategories.map((cat) => ({
      category: cat._id || 'other',
      minutes: cat.minutes || 0,
      calories: cat.calories || 0,
      count: cat.count || 0,
      percent: totalCaloriesBurned > 0 ? Math.round((cat.calories / totalCaloriesBurned) * 100) : 0,
    }));

    const totalMealCal = (mealCategoryCalories.breakfast + mealCategoryCalories.lunch + mealCategoryCalories.dinner + mealCategoryCalories.snack) || 1;
    const mealBreakdownSummary = {
      breakfast: { calories: mealCategoryCalories.breakfast, count: mealCategoryCount.breakfast, percent: Math.round((mealCategoryCalories.breakfast / totalMealCal) * 100) },
      lunch: { calories: mealCategoryCalories.lunch, count: mealCategoryCount.lunch, percent: Math.round((mealCategoryCalories.lunch / totalMealCal) * 100) },
      dinner: { calories: mealCategoryCalories.dinner, count: mealCategoryCount.dinner, percent: Math.round((mealCategoryCalories.dinner / totalMealCal) * 100) },
      snack: { calories: mealCategoryCalories.snack, count: mealCategoryCount.snack, percent: Math.round((mealCategoryCalories.snack / totalMealCal) * 100) },
    };

    const smartInsights = [];

    if (daysLogged === 0) {
      smartInsights.push({
        type: 'info',
        icon: 'bi-info-circle',
        title: 'Chưa có dữ liệu ghi nhận trong kỳ',
        message: 'Hãy bắt đầu quét món ăn bằng AI và ghi lại các bài tập mỗi ngày để NutriLens tự động phân tích biểu đồ xu hướng cho bạn!',
      });
    } else {
      if (avgDeficit < -600) {
        smartInsights.push({
          type: 'warning',
          icon: 'bi-exclamation-triangle-fill',
          title: 'Thâm hụt calo khá sâu',
          message: `Mức thâm hụt trung bình của bạn là ${Math.abs(avgDeficit)} kcal/ngày. Thâm hụt quá sâu có thể làm giảm cơ và chậm trao đổi chất. Hãy bổ sung thêm các bữa phụ lành mạnh.`,
        });
      } else if (avgDeficit >= -600 && avgDeficit <= -200) {
        smartInsights.push({
          type: 'success',
          icon: 'bi-check-circle-fill',
          title: 'Tỷ lệ thâm hụt calo lý tưởng',
          message: `Bạn đang duy trì mức thâm hụt ${Math.abs(avgDeficit)} kcal/ngày. Đây là khoảng tối ưu vàng để giảm mỡ an toàn (dự kiến thâm hụt tương đương ~${Math.abs(projectedWeightChangeKg)} kg mỡ trong kỳ).`,
        });
      } else if (avgDeficit > -200 && avgDeficit <= 150) {
        smartInsights.push({
          type: 'info',
          icon: 'bi-shield-check',
          title: 'Cân bằng năng lượng ổn định',
          message: `Lượng calo nạp vào xấp xỉ mức tiêu hao (chênh lệch ${avgDeficit > 0 ? '+' : ''}${avgDeficit} kcal). Rất tuyệt vời để duy trì vóc dáng và sức khỏe hiện tại!`,
        });
      } else {
        smartInsights.push({
          type: 'tip',
          icon: 'bi-lightning-charge-fill',
          title: 'Thặng dư calo nhẹ',
          message: `Calo nạp vào trung bình cao hơn tiêu hao +${avgDeficit} kcal/ngày. Nếu mục tiêu là tăng cân/tăng cơ nạc thì đây là xu hướng tốt, nếu muốn giảm cân hãy giảm bớt khẩu phần tinh bột hoặc ăn vặt.`,
        });
      }

      if (avgProtein >= proteinTarget * 0.9) {
        smartInsights.push({
          type: 'success',
          icon: 'bi-trophy-fill',
          title: 'Nạp đạm (Protein) xuất sắc',
          message: `Lượng đạm trung bình đạt ${avgProtein}g/ngày (~${Math.round((avgProtein / proteinTarget) * 100)}% mục tiêu). Điều này giúp bảo vệ cơ bắp tối đa và tăng cảm giác no lâu.`,
        });
      } else {
        smartInsights.push({
          type: 'tip',
          icon: 'bi-egg-fried',
          title: 'Cần tăng thêm Protein',
          message: `Lượng đạm hiện tại (${avgProtein}g/ngày) mới đạt ${Math.round((avgProtein / proteinTarget) * 100)}% mục tiêu (${proteinTarget}g). Hãy thêm ức gà, cá, trứng, sữa hạt hoặc đậu phụ vào khẩu phần nhé.`,
        });
      }

      if (totalWorkouts >= Math.max(1, Math.round(numDays * 0.35))) {
        smartInsights.push({
          type: 'success',
          icon: 'bi-fire',
          title: 'Tinh thần thể thao tuyệt vời',
          message: `Bạn đã hoàn thành ${totalWorkouts} buổi tập, đốt cháy tổng cộng ${totalCaloriesBurned.toLocaleString()} kcal (${totalExerciseMinutes} phút). Tiếp tục duy trì phong độ!`,
        });
      } else if (totalWorkouts > 0) {
        smartInsights.push({
          type: 'info',
          icon: 'bi-activity',
          title: 'Duy trì tần suất vận động',
          message: `Bạn có ${totalWorkouts} buổi tập trong ${numDays} ngày qua. Cố gắng đạt 3-4 buổi/tuần để tối ưu sức bền tim mạch và chỉ số trao đổi chất BMR.`,
        });
      }

      const weekendDays = dailyData.filter((d) => d.dayOfWeek === 0 || d.dayOfWeek === 6);
      const weekdayDays = dailyData.filter((d) => d.dayOfWeek >= 1 && d.dayOfWeek <= 5);
      const avgWeekendIn = weekendDays.filter((d) => d.caloriesIn > 0).length
        ? Math.round(weekendDays.reduce((s, d) => s + d.caloriesIn, 0) / weekendDays.filter((d) => d.caloriesIn > 0).length)
        : 0;
      const avgWeekdayIn = weekdayDays.filter((d) => d.caloriesIn > 0).length
        ? Math.round(weekdayDays.reduce((s, d) => s + d.caloriesIn, 0) / weekdayDays.filter((d) => d.caloriesIn > 0).length)
        : 0;
      if (avgWeekendIn > avgWeekdayIn * 1.15 && avgWeekdayIn > 0) {
        const diffPercent = Math.round(((avgWeekendIn - avgWeekdayIn) / avgWeekdayIn) * 100);
        smartInsights.push({
          type: 'warning',
          icon: 'bi-calendar-event',
          title: 'Calo cuối tuần có xu hướng tăng cao',
          message: `Vào Thứ 7 & Chủ Nhật, bạn nạp calo trung bình cao hơn ngày thường ${diffPercent}%. Hãy chú ý kiểm soát các bữa tiệc ngoài hoặc đồ uống ngọt!`,
        });
      }
    }

    return res.status(200).json({
      period,
      numDays,
      startDate: startStr,
      endDate: endStr,
      todayDate: todayVietnam,
      user: {
        id: user?._id,
        fullName: user?.fullName || 'Người dùng',
        avatarUrl: user?.avatarUrl,
        gender: user?.gender,
      },
      profile: {
        heightCm: profile?.heightCm || 170,
        currentWeightKg: latestWeight,
        targetWeightKg,
        initialWeightKg,
        activityLevel: profile?.activityLevel || 'moderate',
        healthGoal: profile?.healthGoal || 'maintain_weight',
        bmr,
        tdee,
        calorieTarget,
        proteinTarget,
        carbsTarget,
        fatTarget,
      },
      kpiSummary: {
        calorieTarget,
        totalCaloriesIn,
        avgCaloriesIn,
        totalCaloriesBurned,
        avgCaloriesBurned,
        totalExerciseMinutes,
        totalWorkouts,
        avgNetCalories,
        avgDeficit,
        projectedWeightChangeKg,
        daysLogged,
        totalDays: numDays,
        consistencyPercent: Math.round((daysLogged / numDays) * 100),
        daysMeetingCalorieGoal,
        streak: Math.max(0, streak),
      },
      macroAnalysis: {
        avgProtein,
        avgCarbs,
        avgFat,
        avgFiber,
        avgSodium,
        actualPercentages: {
          protein: actualProteinPct,
          carbs: actualCarbsPct,
          fat: actualFatPct,
        },
        targetPercentages: {
          protein: targetProteinPct,
          carbs: targetCarbsPct,
          fat: targetFatPct,
        },
        targets: {
          proteinG: proteinTarget,
          carbsG: carbsTarget,
          fatG: fatTarget,
          fiberG: 28,
          sodiumMg: 2000,
        },
      },
      weightAnalysis: {
        currentWeight: latestWeight,
        initialWeight: firstWeightOfPeriod,
        targetWeight: targetWeightKg,
        weightChange: actualWeightChangeInPeriod,
        bmi: currentBmi,
        bmiCategory,
        minHealthyWeight,
        maxHealthyWeight,
      },
      exerciseAnalysis: {
        categories: workoutCategories,
        topExercises,
      },
      mealAnalysis: {
        mealBreakdown: mealBreakdownSummary,
        topFoods,
      },
      dayOfWeekAnalysis: sortedDowStats,
      dailyData,
      smartInsights,
    });
  } catch (err) {
    console.error('[getUserAnalytics] Lỗi:', err);
    return res.status(500).json({ message: 'Không thể tải dữ liệu chỉ số & xu hướng thống kê' });
  }
}

module.exports = {
  getDashboardStats,
  getUserAnalytics,
};
