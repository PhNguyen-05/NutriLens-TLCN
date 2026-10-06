const UserProfile = require('../models/UserProfile');
const User = require('../models/User');
const WeightLog = require('../models/WeightLog');
const { calculateHealthMetrics, calcSafeCalorieTarget, CALORIE_FLOOR, getAge } = require('../utils/healthMetrics');

const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const HEALTH_GOALS = ['lose_weight', 'maintain_weight', 'gain_weight', 'eat_healthier'];
const NUTRITION_GOALS = ['lose_weight', 'gain_weight', 'maintain_weight'];
const MACRO_RATIOS = {
  lose_weight: { protein: 30, carbs: 40, fat: 30 },
  gain_weight: { protein: 25, carbs: 50, fat: 25 },
  maintain_weight: { protein: 20, carbs: 50, fat: 30 },
};
const BASELINE_LOCK_DAYS = 14;
const BASELINE_GRACE_PERIOD_HOURS = 24;

function isNumberInRange(value, min, max) {
  return Number.isFinite(value) && value >= min && value <= max;
}

function validateProfile(payload) {
  const heightCm = Number(payload.heightCm);
  const currentWeightKg = Number(payload.currentWeightKg);
  const targetWeightKg = payload.targetWeightKg === '' || payload.targetWeightKg == null
    ? null
    : Number(payload.targetWeightKg);

  if (!isNumberInRange(heightCm, 100, 250)) return 'Chiều cao phải nằm trong khoảng 100 đến 250 cm';
  if (!isNumberInRange(currentWeightKg, 20, 300)) return 'Cân nặng hiện tại phải nằm trong khoảng 20 đến 300 kg';
  if (targetWeightKg !== null && !isNumberInRange(targetWeightKg, 20, 300)) {
    return 'Cân nặng mục tiêu phải nằm trong khoảng 20 đến 300 kg';
  }
  if (!ACTIVITY_LEVELS.includes(payload.activityLevel)) return 'Mức độ vận động không hợp lệ';
  if (payload.healthGoal && !HEALTH_GOALS.includes(payload.healthGoal)) return 'Mục tiêu sức khỏe không hợp lệ';
  if (payload.dietaryPreferences != null && !Array.isArray(payload.dietaryPreferences)) {
    return 'Chế độ ăn cần được gửi dưới dạng danh sách';
  }
  return null;
}

function validatePersonalInfo(payload) {
  const fullName = typeof payload.fullName === 'string' ? payload.fullName.trim() : '';
  const phone = typeof payload.phone === 'string' ? payload.phone.trim() : '';
  const dateOfBirth = payload.dateOfBirth ? new Date(payload.dateOfBirth) : null;

  if (!fullName) return 'Họ và tên không được để trống';
  if (phone && !/^\d{10}$/.test(phone)) return 'Số điện thoại phải gồm đúng 10 chữ số';
  if (payload.gender && !['male', 'female'].includes(payload.gender)) return 'Giới tính không hợp lệ';
  if (!dateOfBirth || Number.isNaN(dateOfBirth.getTime())) return 'Ngày sinh không hợp lệ';

  const age = (Date.now() - dateOfBirth.getTime()) / 31557600000;
  if (age < 10 || age > 120) return 'Tuổi phải nằm trong khoảng 10 đến 120';
  return null;
}

function buildUserResponse(user) {
  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone || '',
    dateOfBirth: user.dateOfBirth,
    gender: user.gender,
    avatarUrl: user.avatarUrl || null,
    role: user.role,
  };
}

function normalizeProfile(payload) {
  const VALID_SPECIAL_CONDITIONS = ['pregnant', 'diabetes', 'kidney', 'eating_disorder'];
  return {
    heightCm: Number(payload.heightCm),
    currentWeightKg: Number(payload.currentWeightKg),
    targetWeightKg: payload.targetWeightKg === '' || payload.targetWeightKg == null
      ? null
      : Number(payload.targetWeightKg),
    activityLevel: payload.activityLevel,
    healthGoal: payload.healthGoal || 'maintain_weight',
    dietaryPreferences: [...new Set((payload.dietaryPreferences || [])
      .filter((item) => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean))],
    specialConditions: [...new Set((payload.specialConditions || [])
      .filter((item) => VALID_SPECIAL_CONDITIONS.includes(item)))],
    allergies: typeof payload.allergies === 'string' ? payload.allergies.trim() : '',
    medicalConditions: typeof payload.medicalConditions === 'string' ? payload.medicalConditions.trim() : '',
  };
}

function parseRecordedDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function getTodayDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

const MAX_DAILY_UPDATES = 5;

function toUtcDateOnly(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date, days) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

function computeBaselineLockStatus(profile, latestWeightLog = null) {
  if (!profile || profile.currentWeightKg == null) {
    return {
      isSet: false,
      isLocked: false,
      inGracePeriod: false,
      hoursRemainingInGrace: 0,
      daysElapsed: 0,
      daysRemaining: 0,
      canReviewMilestone: false,
      unlockDate: null,
      baselineWeightKg: null,
      baselineDate: null,
      latestWeightLog: null,
    };
  }

  const now = new Date();
  const baselineUpdatedTime = profile.baselineWeightUpdatedAt || profile.currentWeightRecordedDate || profile.createdAt || now;
  const msSinceUpdate = Math.max(0, now.getTime() - new Date(baselineUpdatedTime).getTime());
  const hoursSinceUpdate = msSinceUpdate / (1000 * 60 * 60);

  const baselineDate = toUtcDateOnly(profile.currentWeightRecordedDate)
    || toUtcDateOnly(profile.createdAt)
    || getTodayDate();
  const todayDate = getTodayDate();
  const msElapsedDays = Math.max(0, todayDate.getTime() - baselineDate.getTime());
  const daysElapsed = Math.floor(msElapsedDays / (1000 * 60 * 60 * 24));

  const inGracePeriod = hoursSinceUpdate <= BASELINE_GRACE_PERIOD_HOURS;
  const hoursRemainingInGrace = inGracePeriod ? Math.max(0, Math.ceil(BASELINE_GRACE_PERIOD_HOURS - hoursSinceUpdate)) : 0;

  const daysRemaining = Math.max(0, BASELINE_LOCK_DAYS - daysElapsed);
  const canReviewMilestone = daysElapsed >= BASELINE_LOCK_DAYS;
  const isLocked = !inGracePeriod && !canReviewMilestone;

  const unlockDate = addUtcDays(baselineDate, BASELINE_LOCK_DAYS).toISOString().slice(0, 10);

  return {
    isSet: true,
    isLocked,
    inGracePeriod,
    hoursRemainingInGrace,
    daysElapsed,
    daysRemaining,
    canReviewMilestone,
    unlockDate,
    baselineWeightKg: profile.currentWeightKg,
    baselineDate: baselineDate.toISOString().slice(0, 10),
    latestWeightLog: latestWeightLog ? serializeWeightLog(latestWeightLog) : null,
  };
}

/**
 * Kiểm tra xem biến động cân nặng có bất khả thi về mặt sinh học không (Chặn cứng).
 * - Trong vòng <= 1 ngày: biến động > 5 kg => Chặn
 * - Trong vòng <= 3 ngày: biến động > 8 kg => Chặn
 * - Trong vòng <= 7 ngày: biến động > 12 kg => Chặn
 * @param {number} newWeight
 * @param {Date} targetDate
 * @param {Object} neighborLog
 * @returns {string|null} Lỗi chặn cứng hoặc null nếu hợp lệ
 */
function checkUnrealisticWeightJump(newWeight, targetDate, neighborLog) {
  if (!neighborLog || !neighborLog.recordedDate || neighborLog.weightKg == null) return null;
  const targetTime = targetDate.getTime();
  const neighborTime = new Date(neighborLog.recordedDate).getTime();
  const daysDiff = Math.abs((targetTime - neighborTime) / (1000 * 60 * 60 * 24));
  const weightDiff = Math.abs(newWeight - Number(neighborLog.weightKg));

  if (daysDiff <= 1.05 && weightDiff > 5) {
    return `Chênh lệch cân nặng không hợp lý (biến động ${weightDiff.toFixed(1)} kg trong vòng 1 ngày, vượt quá giới hạn an toàn 5 kg). Hệ thống từ chối ghi nhận để bảo vệ tính chính xác của dữ liệu. Vui lòng kiểm tra lại số cân.`;
  }
  if (daysDiff <= 3.05 && weightDiff > 8) {
    return `Chênh lệch cân nặng không hợp lý (biến động ${weightDiff.toFixed(1)} kg trong vòng 3 ngày, vượt quá giới hạn 8 kg). Vui lòng kiểm tra lại số cân.`;
  }
  if (daysDiff <= 7.05 && weightDiff > 12) {
    return `Chênh lệch cân nặng không hợp lý (biến động ${weightDiff.toFixed(1)} kg trong vòng 7 ngày, vượt quá giới hạn 12 kg). Vui lòng kiểm tra lại số cân.`;
  }
  return null;
}

function serializeWeightLog(log) {
  const rawDate = log.loggedAt || log.updatedAt || log.createdAt || log.recordedDate;
  const d = new Date(rawDate);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}:${seconds}`;

  let editHistory = [];
  if (Array.isArray(log.editHistory) && log.editHistory.length > 0) {
    editHistory = log.editHistory.map((item, idx) => {
      const itemDate = new Date(item.loggedAt);
      const itemH = String(itemDate.getHours()).padStart(2, '0');
      const itemM = String(itemDate.getMinutes()).padStart(2, '0');
      const itemS = String(itemDate.getSeconds()).padStart(2, '0');
      return {
        version: idx + 1,
        weightKg: item.weightKg,
        loggedAt: itemDate.toISOString(),
        timeStr: `${itemH}:${itemM}:${itemS}`,
      };
    });
  } else {
    editHistory = [
      {
        version: 1,
        weightKg: log.weightKg,
        loggedAt: d.toISOString(),
        timeStr,
      },
    ];
  }

  return {
    id: log._id,
    weightKg: log.weightKg,
    recordedDate: log.recordedDate.toISOString().slice(0, 10),
    loggedAt: d.toISOString(),
    timeStr,
    updateCount: log.updateCount || 0,
    editHistory,
    createdAt: log.createdAt,
    updatedAt: log.updatedAt,
  };
}

function buildNutritionGoal(goal, calorieTarget, macroPercentages, customized = false) {
  return {
    goal,
    calorieTarget: Math.round(calorieTarget),
    macroPercentages,
    proteinG: Math.round((calorieTarget * macroPercentages.protein) / 400),
    carbsG: Math.round((calorieTarget * macroPercentages.carbs) / 400),
    fatG: Math.round((calorieTarget * macroPercentages.fat) / 900),
    customized,
  };
}

function calculateNutritionProposal(metrics, goal, gender) {
  const calorieTarget = calcSafeCalorieTarget(metrics, goal, gender);
  return buildNutritionGoal(goal, calorieTarget, MACRO_RATIOS[goal]);
}

/**
 * Kiểm tra xem mục tiêu dinh dưỡng có bị chặn vì nguy hiểm với BMI hiện tại không.
 * @returns {string|null} thông báo lỗi hoặc null nếu OK
 */
function checkGoalSafety(bmiCategory, goal, age, specialConditions = []) {
  // Chặn tuyệt đối: Thiếu cân + giảm cân, Béo phì + tăng cân
  if (bmiCategory === 'Thiếu cân' && goal === 'lose_weight') {
    return 'Mục tiêu giảm cân không phù hợp khi BMI ở mức thiếu cân. Vui lòng chọn mục tiêu tăng cân hoặc duy trì.';
  }
  if (bmiCategory === 'Béo phì' && goal === 'gain_weight') {
    return 'Mục tiêu tăng cân không phù hợp khi BMI ở mức béo phì. Vui lòng chọn mục tiêu giảm cân hoặc duy trì.';
  }
  // Cảnh báo tuổi dưới 18 + giảm cân
  if (age != null && age < 18 && goal === 'lose_weight') {
    return 'Mục tiêu giảm cân không khuyến nghị cho người dưới 18 tuổi do ảnh hưởng đến tăng trưởng. Vui lòng tham khảo bác sĩ.';
  }
  // Chặn tình trạng đặc biệt + mục tiêu thay đổi cân nặng
  const DEFICIT_BLOCKING_CONDITIONS = ['pregnant', 'kidney', 'eating_disorder'];
  const hasBlockingCondition = (specialConditions || []).some((c) => DEFICIT_BLOCKING_CONDITIONS.includes(c));
  if (hasBlockingCondition && goal !== 'maintain_weight') {
    return 'Với tình trạng sức khỏe đặc biệt đã khai báo, mục tiêu thay đổi cân nặng cần có sự tư vấn của bác sĩ hoặc chuyên gia dinh dưỡng.';
  }
  return null;
}


async function getProfile(req, res) {
  try {
    const [user, profile, latestLog] = await Promise.all([
      User.findById(req.user.id).select('fullName email phone dateOfBirth gender avatarUrl role').lean(),
      UserProfile.findOne({ user: req.user.id }).lean(),
      WeightLog.findOne({ user: req.user.id }).sort({ recordedDate: -1, loggedAt: -1 }).lean(),
    ]);
    let resolvedProfile = profile;
    const metricsNeedBackfill = profile && (
      profile.healthMetrics?.bmi == null
      || profile.healthMetrics?.bmr == null
      || profile.healthMetrics?.tdee == null
      || !profile.healthMetrics?.bmiCategory
    );
    if (user && metricsNeedBackfill) {
      const healthMetrics = calculateHealthMetrics({
        heightCm: profile.heightCm,
        weightKg: profile.currentWeightKg,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        activityLevel: profile.activityLevel,
      });
      if (healthMetrics.bmi == null) {
        console.error(`[getProfile] Dữ liệu chiều cao/cân nặng bất thường cho user ${req.user.id}`);
      } else {
        resolvedProfile = await UserProfile.findByIdAndUpdate(
          profile._id,
          { $set: { healthMetrics: { ...healthMetrics, calculatedAt: new Date() } } },
          { new: true, runValidators: true }
        ).lean();
      }
    }
    const baselineStatus = computeBaselineLockStatus(resolvedProfile, latestLog);
    return res.status(200).json({
      user: user ? buildUserResponse(user) : null,
      profile: resolvedProfile,
      baselineStatus,
    });
  } catch (err) {
    console.error('[getProfile] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể tải hồ sơ sức khỏe' });
  }
}

async function saveProfile(req, res) {
  try {
    const validationError = validatePersonalInfo(req.body) || validateProfile(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

    const existingProfile = await UserProfile.findOne({ user: req.user.id });
    const isFirstSetup = !existingProfile || existingProfile.currentWeightKg == null;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: {
          fullName: req.body.fullName.trim(),
          phone: typeof req.body.phone === 'string' ? req.body.phone.trim() : '',
          dateOfBirth: new Date(req.body.dateOfBirth),
          gender: req.body.gender,
        },
      },
      { new: true, runValidators: true }
    );

    const healthMetrics = calculateHealthMetrics({
      heightCm: req.body.heightCm,
      weightKg: req.body.currentWeightKg,
      dateOfBirth: user.dateOfBirth,
      gender: user.gender,
      activityLevel: req.body.activityLevel,
    });

    const requestedGoal = req.body.nutritionGoal?.goal || req.body.healthGoal || 'maintain_weight';
    const validGoal = ['lose_weight', 'gain_weight', 'maintain_weight'].includes(requestedGoal)
      ? requestedGoal
      : 'maintain_weight';

    // ── Safety gate: chặn tổ hợp nguy hiểm (BMI × goal × specialConditions) ──
    if (healthMetrics.bmiCategory) {
      const ageVal = getAge(user.dateOfBirth);
      const safetyError = checkGoalSafety(healthMetrics.bmiCategory, validGoal, ageVal, req.body.specialConditions);
      if (safetyError) return res.status(400).json({ code: 'UNSAFE_GOAL', message: safetyError });
    }

    let resolvedNutritionGoal = existingProfile?.nutritionGoal || null;
    if (healthMetrics.bmr && healthMetrics.tdee) {
      const floor = CALORIE_FLOOR[user.gender] ?? 1200;
      if (req.body.nutritionGoal && req.body.nutritionGoal.customized) {
        const cal = Number(req.body.nutritionGoal.calorieTarget);
        const macros = req.body.nutritionGoal.macroPercentages;
        // Calo tùy chỉnh phải >= floor, <= TDEE + 1000
        if (!Number.isFinite(cal) || cal < floor || cal > healthMetrics.tdee + 1000) {
          return res.status(400).json({
            code: 'INVALID_CALORIES',
            message: `Calo mục tiêu phải nằm trong khoảng ${floor}–${healthMetrics.tdee + 1000} kcal.`,
          });
        }
        if (macros) {
          const macroTotal = Number(macros.protein || 0) + Number(macros.carbs || 0) + Number(macros.fat || 0);
          if (Math.abs(macroTotal - 100) > 0.5) {
            return res.status(400).json({ code: 'INVALID_MACROS', message: 'Tổng tỉ lệ Protein, Carb và Fat phải bằng 100%.' });
          }
          resolvedNutritionGoal = buildNutritionGoal(validGoal, cal, macros, true);
        } else {
          resolvedNutritionGoal = calculateNutritionProposal(healthMetrics, validGoal, user.gender);
        }
      } else {
        resolvedNutritionGoal = calculateNutritionProposal(healthMetrics, validGoal, user.gender);
      }
    }

    const newWeightKg = Number(req.body.currentWeightKg);
    const prevWeightKg = existingProfile?.currentWeightKg;
    const weightChanged = prevWeightKg == null || Math.abs(prevWeightKg - newWeightKg) > 0.001;

    const lockStatus = computeBaselineLockStatus(existingProfile);

    // ── Ràng buộc bảo lưu mốc cân nặng 14 ngày & ân hạn 24 giờ ──
    if (!isFirstSetup && weightChanged) {
      if (lockStatus.isLocked) {
        return res.status(400).json({
          code: 'WEIGHT_LOCKED_14_DAYS',
          message: `Cân nặng mốc trong hồ sơ sức khỏe đang được bảo lưu (đã qua ${lockStatus.daysElapsed}/14 ngày). Bạn còn ${lockStatus.daysRemaining} ngày nữa mới có thể điều chỉnh mốc này. Vui lòng ghi nhận cân nặng hàng ngày tại trang Theo dõi cân nặng.`,
          daysRemaining: lockStatus.daysRemaining,
          unlockDate: lockStatus.unlockDate,
        });
      }
    }

    const today = getTodayDate();
    const now = new Date();
    const weightDateUpdates = {};

    if (isFirstSetup) {
      weightDateUpdates.currentWeightRecordedDate = today;
      weightDateUpdates.baselineWeightUpdatedAt = now;
    } else if (weightChanged && lockStatus.canReviewMilestone) {
      weightDateUpdates.currentWeightRecordedDate = today;
      weightDateUpdates.baselineWeightUpdatedAt = now;
    } else if (weightChanged && lockStatus.inGracePeriod) {
      // Trong khoảng ân hạn 24 giờ: cập nhật lại bản ghi WeightLog đầu tiên để đồng bộ
      const baselineDate = toUtcDateOnly(existingProfile.currentWeightRecordedDate) || today;
      await WeightLog.findOneAndUpdate(
        { user: req.user.id, recordedDate: baselineDate },
        { $set: { weightKg: newWeightKg } }
      );
    }

    const profile = await UserProfile.findOneAndUpdate(
      { user: req.user.id },
      {
        $set: {
          ...normalizeProfile(req.body),
          ...weightDateUpdates,
          healthGoal: validGoal,
          healthMetrics: {
            ...healthMetrics,
            calculatedAt: now,
          },
          ...(resolvedNutritionGoal ? { nutritionGoal: resolvedNutritionGoal } : {}),
        },
        $setOnInsert: { user: req.user.id },
      },
      { new: true, upsert: true, runValidators: true }
    ).lean();

    // Tự động tạo hoặc đồng bộ WeightLog đầu tiên khi tạo hồ sơ lần đầu hoặc khi thiết lập mốc chu kỳ mới
    if (isFirstSetup || (weightChanged && lockStatus.canReviewMilestone)) {
      const existingTodayLog = await WeightLog.findOne({ user: req.user.id, recordedDate: today });
      if (!existingTodayLog) {
        await WeightLog.create({
          user: req.user.id,
          weightKg: newWeightKg,
          recordedDate: today,
          loggedAt: now,
          updateCount: 0,
          editHistory: [{ weightKg: newWeightKg, loggedAt: now }],
        });
      } else if (existingTodayLog.weightKg !== newWeightKg) {
        const history = Array.isArray(existingTodayLog.editHistory) && existingTodayLog.editHistory.length > 0
          ? [...existingTodayLog.editHistory]
          : [{ weightKg: existingTodayLog.weightKg, loggedAt: existingTodayLog.loggedAt || existingTodayLog.createdAt || now }];
        history.push({ weightKg: newWeightKg, loggedAt: now });

        await WeightLog.findByIdAndUpdate(
          existingTodayLog._id,
          {
            $set: {
              weightKg: newWeightKg,
              loggedAt: now,
              updateCount: (existingTodayLog.updateCount || 0) + 1,
              editHistory: history,
            },
          },
          { new: true, runValidators: true }
        );
      }
    }

    const latestLog = await WeightLog.findOne({ user: req.user.id }).sort({ recordedDate: -1, loggedAt: -1 }).lean();

    return res.status(200).json({
      message: 'Cập nhật hồ sơ và mục tiêu dinh dưỡng thành công',
      user: buildUserResponse(user),
      profile,
      baselineStatus: computeBaselineLockStatus(profile, latestLog),
    });

  } catch (err) {
    console.error('[saveProfile] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể lưu hồ sơ sức khỏe, vui lòng thử lại' });
  }
}

async function getWeightLogs(req, res) {
  try {
    const [logs, profile] = await Promise.all([
      WeightLog.find({ user: req.user.id }).sort({ recordedDate: 1 }).lean(),
      UserProfile.findOne({ user: req.user.id }).lean(),
    ]);
    const latestLog = logs.length ? logs[logs.length - 1] : null;
    const baselineStatus = computeBaselineLockStatus(profile, latestLog);
    return res.status(200).json({
      weightLogs: logs.map(serializeWeightLog),
      baselineStatus,
    });
  } catch (err) {
    console.error('[getWeightLogs] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể tải lịch sử cân nặng' });
  }
}

async function getNutritionProposal(req, res) {
  try {
    const goal = req.query.goal;
    if (!NUTRITION_GOALS.includes(goal)) return res.status(400).json({ message: 'Mục tiêu dinh dưỡng không hợp lệ' });
    const profile = await UserProfile.findOne({ user: req.user.id }).lean();
    const metrics = profile?.healthMetrics;
    if (!metrics?.bmr || !metrics?.tdee) {
      return res.status(422).json({ code: 'MISSING_TDEE', message: 'Vui lòng hoàn tất hồ sơ sức khỏe để xem chỉ số BMI/BMR/TDEE' });
    }
    return res.status(200).json({ nutritionGoal: calculateNutritionProposal(metrics, goal), bmr: metrics.bmr, tdee: metrics.tdee });
  } catch (err) {
    console.error('[getNutritionProposal] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể tạo đề xuất mục tiêu dinh dưỡng' });
  }
}

async function saveNutritionGoal(req, res) {
  try {
    const { goal, customized = false } = req.body;
    if (!NUTRITION_GOALS.includes(goal)) return res.status(400).json({ message: 'Mục tiêu dinh dưỡng không hợp lệ' });
    const profile = await UserProfile.findOne({ user: req.user.id });
    const metrics = profile?.healthMetrics;
    if (!profile || !metrics?.bmr || !metrics?.tdee) {
      return res.status(422).json({ code: 'MISSING_TDEE', message: 'Vui lòng hoàn tất hồ sơ sức khỏe để xem chỉ số BMI/BMR/TDEE' });
    }

    // Safety gate
    if (metrics.bmiCategory) {
      const user = await User.findById(req.user.id).select('dateOfBirth gender').lean();
      const ageVal = user ? getAge(user.dateOfBirth) : null;
      const safetyError = checkGoalSafety(metrics.bmiCategory, goal, ageVal, profile.specialConditions);
      if (safetyError) return res.status(400).json({ code: 'UNSAFE_GOAL', message: safetyError });
    }

    const user = await User.findById(req.user.id).select('gender').lean();
    const floor = CALORIE_FLOOR[user?.gender] ?? 1200;

    let nutritionGoal = calculateNutritionProposal(metrics, goal, user?.gender);
    if (customized) {
      const calorieTarget = Number(req.body.calorieTarget);
      const macroPercentages = Object.fromEntries(['protein', 'carbs', 'fat'].map((key) => [key, Number(req.body.macroPercentages?.[key])]));
      const macroTotal = macroPercentages.protein + macroPercentages.carbs + macroPercentages.fat;
      if (!Number.isFinite(calorieTarget) || calorieTarget < floor || calorieTarget > metrics.tdee + 1000) {
        return res.status(400).json({ code: 'INVALID_CALORIES', message: `Calo mục tiêu phải nằm trong khoảng ${floor}–${metrics.tdee + 1000} kcal.` });
      }
      if (Object.values(macroPercentages).some((value) => !Number.isFinite(value) || value < 0) || Math.abs(macroTotal - 100) > 0.5) {
        return res.status(400).json({ code: 'INVALID_MACROS', message: 'Tổng tỉ lệ Protein, Carb và Fat phải bằng 100%.' });
      }
      nutritionGoal = buildNutritionGoal(goal, calorieTarget, macroPercentages, true);
    }
    const updatedProfile = await UserProfile.findByIdAndUpdate(
      profile._id,
      { $set: { nutritionGoal, healthGoal: goal } },
      { new: true, runValidators: true }
    ).lean();
    return res.status(200).json({
      message: 'Đã lưu mục tiêu dinh dưỡng',
      nutritionGoal: updatedProfile.nutritionGoal,
      profile: updatedProfile,
    });
  } catch (err) {
    console.error('[saveNutritionGoal] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể lưu mục tiêu dinh dưỡng, vui lòng thử lại' });
  }
}


async function saveWeightLog(req, res) {
  try {
    const weightKg = Number(req.body.weightKg);
    if (!isNumberInRange(weightKg, 20, 300)) {
      return res.status(400).json({ code: 'INVALID_WEIGHT', message: 'Vui lòng nhập cân nặng hợp lệ (20–300 kg)' });
    }

    const recordedDate = parseRecordedDate(req.body.recordedDate);
    if (!recordedDate) return res.status(400).json({ message: 'Ngày ghi nhận không hợp lệ' });
    if (recordedDate > getTodayDate()) {
      return res.status(400).json({ code: 'FUTURE_DATE', message: 'Không thể ghi nhận cân nặng cho ngày trong tương lai' });
    }

    const profile = await UserProfile.findOne({ user: req.user.id });
    if (!profile) return res.status(404).json({ message: 'Vui lòng hoàn tất hồ sơ sức khỏe trước khi ghi nhận cân nặng' });

    const existingLog = await WeightLog.findOne({ user: req.user.id, recordedDate });
    if (existingLog) {
      const curCount = existingLog.updateCount || 0;
      if (curCount >= MAX_DAILY_UPDATES) {
        return res.status(429).json({
          code: 'DAILY_UPDATE_LIMIT_EXCEEDED',
          message: `Bạn đã đạt giới hạn tối đa ${MAX_DAILY_UPDATES} lần cập nhật cân nặng trong ngày này. Vui lòng quay lại vào ngày mai để ghi nhận tiếp.`,
          maxUpdates: MAX_DAILY_UPDATES,
          currentUpdateCount: curCount,
        });
      }
      if (!req.body.overwrite) {
        return res.status(409).json({
          code: 'WEIGHT_LOG_EXISTS',
          message: `Bạn đã ghi nhận cân nặng cho ngày này (đã cập nhật ${curCount}/${MAX_DAILY_UPDATES} lần). Bạn có muốn cập nhật lại giá trị này?`,
          currentUpdateCount: curCount,
          remainingUpdates: Math.max(0, MAX_DAILY_UPDATES - curCount),
          maxUpdates: MAX_DAILY_UPDATES,
        });
      }
    }

    // Chặn cứng: Kiểm tra biến động cân nặng so với các bản ghi lân cận
    const prevLog = await WeightLog.findOne({
      user: req.user.id,
      recordedDate: { $lt: recordedDate },
    }).sort({ recordedDate: -1 }).lean();

    const nextLog = await WeightLog.findOne({
      user: req.user.id,
      recordedDate: { $gt: recordedDate },
    }).sort({ recordedDate: 1 }).lean();

    const jumpErrorPrev = checkUnrealisticWeightJump(weightKg, recordedDate, prevLog);
    if (jumpErrorPrev) {
      return res.status(400).json({ code: 'UNREALISTIC_WEIGHT_CHANGE', message: jumpErrorPrev });
    }

    const jumpErrorNext = checkUnrealisticWeightJump(weightKg, recordedDate, nextLog);
    if (jumpErrorNext) {
      return res.status(400).json({ code: 'UNREALISTIC_WEIGHT_CHANGE', message: jumpErrorNext });
    }

    // Nếu chưa có nhật ký nào trước/sau, kiểm tra so với mốc ban đầu trong hồ sơ
    if (!prevLog && !nextLog && profile.currentWeightKg != null) {
      const baselineDate = toUtcDateOnly(profile.currentWeightRecordedDate)
        || toUtcDateOnly(profile.createdAt)
        || getTodayDate();
      const jumpErrorBaseline = checkUnrealisticWeightJump(weightKg, recordedDate, {
        recordedDate: baselineDate,
        weightKg: profile.currentWeightKg,
      });
      if (jumpErrorBaseline) {
        return res.status(400).json({ code: 'UNREALISTIC_WEIGHT_CHANGE', message: jumpErrorBaseline });
      }
    }

    const now = new Date();
    let log;
    if (existingLog) {
      const history = Array.isArray(existingLog.editHistory) && existingLog.editHistory.length > 0
        ? [...existingLog.editHistory]
        : [{ weightKg: existingLog.weightKg, loggedAt: existingLog.loggedAt || existingLog.createdAt || now }];
      history.push({ weightKg, loggedAt: now });

      log = await WeightLog.findByIdAndUpdate(
        existingLog._id,
        {
          $set: {
            weightKg,
            loggedAt: now,
            updateCount: (existingLog.updateCount || 0) + 1,
            editHistory: history,
          },
        },
        { new: true, runValidators: true }
      );
    } else {
      log = await WeightLog.create({
        user: req.user.id,
        weightKg,
        recordedDate,
        loggedAt: now,
        updateCount: 0,
        editHistory: [{ weightKg, loggedAt: now }],
      });
    }

    const baselineStatus = computeBaselineLockStatus(profile, log);

    return res.status(existingLog ? 200 : 201).json({
      message: existingLog ? 'Cập nhật bản ghi cân nặng thành công' : 'Đã ghi nhận cân nặng thành công',
      weightLog: serializeWeightLog(log),
      profile: profile.toObject ? profile.toObject() : profile,
      weightProfileUpdated: false,
      canReviewMilestone: baselineStatus.canReviewMilestone,
      baselineStatus,
      remainingUpdates: Math.max(0, MAX_DAILY_UPDATES - (log.updateCount || 0)),
      maxUpdates: MAX_DAILY_UPDATES,
    });
  } catch (err) {
    if (err?.code === 11000) {
      if (req.body.overwrite) {
        try {
          const recordedDate = parseRecordedDate(req.body.recordedDate);
          const weightKg = Number(req.body.weightKg);
          const existing = await WeightLog.findOne({ user: req.user.id, recordedDate });
          if (existing) {
            const now = new Date();
            const history = Array.isArray(existing.editHistory) && existing.editHistory.length > 0
              ? [...existing.editHistory]
              : [{ weightKg: existing.weightKg, loggedAt: existing.loggedAt || existing.createdAt || now }];
            history.push({ weightKg, loggedAt: now });
            const updated = await WeightLog.findByIdAndUpdate(
              existing._id,
              { $set: { weightKg, loggedAt: now, updateCount: (existing.updateCount || 0) + 1, editHistory: history } },
              { new: true, runValidators: true }
            );
            const baselineStatus = computeBaselineLockStatus(profile, updated);
            return res.status(200).json({
              message: 'Cập nhật bản ghi cân nặng thành công',
              weightLog: serializeWeightLog(updated),
              profile: profile.toObject ? profile.toObject() : profile,
              weightProfileUpdated: false,
              canReviewMilestone: baselineStatus.canReviewMilestone,
              baselineStatus,
              remainingUpdates: Math.max(0, MAX_DAILY_UPDATES - (updated.updateCount || 0)),
              maxUpdates: MAX_DAILY_UPDATES,
            });
          }
        } catch (retryErr) {
          console.error('[saveWeightLog retry] Lỗi:', retryErr.message);
        }
      }
      return res.status(409).json({ code: 'WEIGHT_LOG_EXISTS', message: 'Bạn đã ghi nhận cân nặng cho ngày này, bạn có muốn cập nhật lại giá trị này?' });
    }
    console.error('[saveWeightLog] Lỗi:', err.message);
    return res.status(500).json({ message: 'Ghi nhận cân nặng thất bại, vui lòng thử lại' });
  }
}

/**
 * Áp dụng mốc cân nặng mới sau chu kỳ 14 ngày (Tùy chọn 2 - Xác nhận thủ công)
 * Cho phép người dùng xác nhận số cân đo gần nhất (hoặc điều chỉnh) để bắt đầu chu kỳ 14 ngày mới.
 */
async function applyMilestoneWeight(req, res) {
  try {
    const profile = await UserProfile.findOne({ user: req.user.id });
    if (!profile) {
      return res.status(404).json({ message: 'Không tìm thấy hồ sơ sức khỏe' });
    }

    const latestLog = await WeightLog.findOne({ user: req.user.id }).sort({ recordedDate: -1, loggedAt: -1 }).lean();
    const lockStatus = computeBaselineLockStatus(profile, latestLog);

    if (!lockStatus.canReviewMilestone) {
      return res.status(400).json({
        code: 'MILESTONE_NOT_REACHED',
        message: `Chu kỳ 14 ngày chưa kết thúc (còn ${lockStatus.daysRemaining} ngày nữa). Chưa thể cập nhật mốc cân nặng mới.`,
        daysRemaining: lockStatus.daysRemaining,
      });
    }

    let targetWeight = req.body.weightKg != null && req.body.weightKg !== ''
      ? Number(req.body.weightKg)
      : (latestLog?.weightKg || profile.currentWeightKg);

    if (!isNumberInRange(targetWeight, 20, 300)) {
      return res.status(400).json({ message: 'Cân nặng phải nằm trong khoảng 20 đến 300 kg' });
    }

    const user = await User.findById(req.user.id).select('dateOfBirth gender').lean();
    const healthMetrics = {
      ...calculateHealthMetrics({
        heightCm: profile.heightCm,
        weightKg: targetWeight,
        dateOfBirth: user?.dateOfBirth,
        gender: user?.gender,
        activityLevel: profile.activityLevel,
      }),
      calculatedAt: new Date(),
    };

    const currentGoal = profile.nutritionGoal?.goal || profile.healthGoal || 'maintain_weight';
    let newNutritionGoal = profile.nutritionGoal;
    if (healthMetrics.bmr && healthMetrics.tdee) {
      if (profile.nutritionGoal?.customized && profile.nutritionGoal.macroPercentages) {
        const cal = calcSafeCalorieTarget(healthMetrics, currentGoal, user?.gender);
        newNutritionGoal = buildNutritionGoal(currentGoal, cal, profile.nutritionGoal.macroPercentages, true);
      } else {
        newNutritionGoal = calculateNutritionProposal(healthMetrics, currentGoal, user?.gender);
      }
    }

    const today = getTodayDate();
    const now = new Date();

    const updatedProfile = await UserProfile.findByIdAndUpdate(
      profile._id,
      {
        $set: {
          currentWeightKg: targetWeight,
          currentWeightRecordedDate: today,
          baselineWeightUpdatedAt: now,
          healthMetrics,
          nutritionGoal: newNutritionGoal,
        },
      },
      { new: true, runValidators: true }
    ).lean();

    // Đồng bộ hoặc tạo bản ghi WeightLog cho ngày hôm nay
    const existingLogToday = await WeightLog.findOne({ user: req.user.id, recordedDate: today });
    if (!existingLogToday) {
      await WeightLog.create({
        user: req.user.id,
        weightKg: targetWeight,
        recordedDate: today,
        loggedAt: now,
        updateCount: 0,
        editHistory: [{ weightKg: targetWeight, loggedAt: now }],
      });
    } else if (existingLogToday.weightKg !== targetWeight) {
      const history = Array.isArray(existingLogToday.editHistory) && existingLogToday.editHistory.length > 0
        ? [...existingLogToday.editHistory]
        : [{ weightKg: existingLogToday.weightKg, loggedAt: existingLogToday.loggedAt || existingLogToday.createdAt || now }];
      history.push({ weightKg: targetWeight, loggedAt: now });

      await WeightLog.findByIdAndUpdate(
        existingLogToday._id,
        {
          $set: {
            weightKg: targetWeight,
            loggedAt: now,
            updateCount: (existingLogToday.updateCount || 0) + 1,
            editHistory: history,
          },
        },
        { new: true, runValidators: true }
      );
    }

    const updatedLatestLog = await WeightLog.findOne({ user: req.user.id }).sort({ recordedDate: -1, loggedAt: -1 }).lean();
    const newLockStatus = computeBaselineLockStatus(updatedProfile, updatedLatestLog);

    return res.status(200).json({
      message: 'Cập nhật mốc cân nặng và thiết lập chu kỳ 14 ngày mới thành công',
      profile: updatedProfile,
      baselineStatus: newLockStatus,
    });
  } catch (err) {
    console.error('[applyMilestoneWeight] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể cập nhật mốc cân nặng chu kỳ mới' });
  }
}

async function updateAvatar(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Ảnh đại diện không hợp lệ, vui lòng chọn ảnh JPG hoặc PNG' });
    }

    const avatarUrl = `${req.protocol}://${req.get('host')}/uploads/avatars/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { avatarUrl } },
      { new: true, runValidators: true }
    );
    return res.status(200).json({ message: 'Đã cập nhật ảnh đại diện', user: buildUserResponse(user) });
  } catch (err) {
    console.error('[updateAvatar] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể cập nhật ảnh đại diện, vui lòng thử lại' });
  }
}

async function deleteWeightLog(req, res) {
  try {
    const log = await WeightLog.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!log) {
      return res.status(404).json({ message: 'Không tìm thấy bản ghi cân nặng cần xóa' });
    }

    const profile = await UserProfile.findOne({ user: req.user.id });
    const latestLog = await WeightLog.findOne({ user: req.user.id }).sort({ recordedDate: -1, loggedAt: -1 }).lean();
    const baselineStatus = computeBaselineLockStatus(profile, latestLog);
    let updatedProfile = profile ? (profile.toObject ? profile.toObject() : profile) : null;

    return res.status(200).json({
      message: 'Đã xóa bản ghi cân nặng thành công',
      deletedId: req.params.id,
      profile: updatedProfile,
      baselineStatus,
    });
  } catch (err) {
    console.error('[deleteWeightLog] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể xóa bản ghi cân nặng' });
  }
}

module.exports = {
  getProfile,
  saveProfile,
  updateAvatar,
  getWeightLogs,
  saveWeightLog,
  deleteWeightLog,
  getNutritionProposal,
  saveNutritionGoal,
  applyMilestoneWeight,
};
