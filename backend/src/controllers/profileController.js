const fs = require('fs');
const path = require('path');
const UserProfile = require('../models/UserProfile');
const User = require('../models/User');
const WeightLog = require('../models/WeightLog');
const {
  calculateHealthMetrics,
  getBmiCategory,
  CALORIE_FLOOR,
  getAge,
  getGoalRisk,
  getSystemAdvice,
} = require('../utils/healthMetrics');
const { uploadFileToCloudinary, isCloudinaryConfigured } = require('../services/cloudinaryStorage');
const {
  isNumberInRange,
  getTodayDate,
  toUtcDateOnly,
  computeBaselineLockStatus,
} = require('../utils/weightBaselineUtils');
const { buildUserResponse } = require('../utils/userUtils');
const {
  MACRO_RATIOS,
  buildNutritionGoal,
  calculateNutritionProposal,
} = require('../utils/nutritionGoalUtils');

// Re-export controllers for full backward compatibility
const {
  getWeightLogs,
  saveWeightLog,
  deleteWeightLog,
  applyMilestoneWeight,
} = require('./weightController');

const {
  getDashboardStats,
  getUserAnalytics,
} = require('./dashboardAnalyticsController');

const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const HEALTH_GOALS = ['lose_weight', 'maintain_weight', 'gain_weight', 'eat_healthier'];
const NUTRITION_GOALS = ['lose_weight', 'gain_weight', 'maintain_weight'];

function validateProfile(payload) {
  if (!isNumberInRange(Number(payload.heightCm), 100, 250)) {
    return 'Chiều cao phải nằm trong khoảng 100 đến 250 cm';
  }
  if (!isNumberInRange(Number(payload.currentWeightKg), 20, 300)) {
    return 'Cân nặng hiện tại phải nằm trong khoảng 20 đến 300 kg';
  }
  if (
    payload.targetWeightKg !== '' &&
    payload.targetWeightKg != null &&
    !isNumberInRange(Number(payload.targetWeightKg), 20, 300)
  ) {
    return 'Cân nặng mục tiêu phải nằm trong khoảng 20 đến 300 kg';
  }
  if (!ACTIVITY_LEVELS.includes(payload.activityLevel)) {
    return 'Mức độ vận động không hợp lệ';
  }
  if (payload.healthGoal && !HEALTH_GOALS.includes(payload.healthGoal)) {
    return 'Mục tiêu sức khỏe không hợp lệ';
  }
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
  if (!dateOfBirth || Number.isNaN(dateOfBirth.getTime()) || dateOfBirth > new Date()) return 'Ngày sinh không hợp lệ';

  const age = getAge(dateOfBirth);
  if (age === null || age < 10 || age > 120) return 'Tuổi phải nằm trong khoảng 10 đến 120';
  return null;
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

/**
 * GET /api/profile
 * Lấy thông tin hồ sơ người dùng và trạng thái bảo lưu cân nặng mốc 14 ngày
 */
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

/**
 * PUT /api/profile
 * Cập nhật thông tin cá nhân và chỉ số sức khỏe
 */
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
          phone: req.body.phone ? req.body.phone.trim() : '',
          dateOfBirth: new Date(req.body.dateOfBirth),
          gender: req.body.gender || undefined,
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

    // ── Safety gate: kiểm tra tổ hợp rủi ro (BMI × goal × specialConditions) ──
    const isAcknowledged = Boolean(
      req.body.acknowledgeUnsafeGoal ||
      req.body.nutritionGoal?.acknowledgeUnsafeGoal ||
      req.body.confirmRisk
    );
    let safetyWarning = null;
    if (healthMetrics.bmiCategory) {
      const ageVal = getAge(user.dateOfBirth);
      const safetyError = checkGoalSafety(healthMetrics.bmiCategory, validGoal, ageVal, req.body.specialConditions);
      if (safetyError) {
        if (!isAcknowledged) {
          return res.status(400).json({ code: 'UNSAFE_GOAL', message: safetyError, warning: safetyError });
        }
        safetyWarning = safetyError;
      }
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

/**
 * GET /api/profile/nutrition-goal/proposal
 * Lấy đề xuất mục tiêu dinh dưỡng dựa trên BMR/TDEE hiện tại
 */
async function getNutritionProposal(req, res) {
  try {
    const goal = req.query.goal;
    if (!NUTRITION_GOALS.includes(goal)) return res.status(400).json({ message: 'Mục tiêu dinh dưỡng không hợp lệ' });
    const [user, profile] = await Promise.all([
      User.findById(req.user.id).select('gender').lean(),
      UserProfile.findOne({ user: req.user.id }).lean(),
    ]);
    const metrics = profile?.healthMetrics;
    if (!metrics?.bmr || !metrics?.tdee) {
      return res.status(422).json({ code: 'MISSING_TDEE', message: 'Vui lòng hoàn tất hồ sơ sức khỏe để xem chỉ số BMI/BMR/TDEE' });
    }
    const calorieFloor = CALORIE_FLOOR[user?.gender] || 1200;
    const bmiCategory = metrics.bmiCategory || getBmiCategory(metrics.bmi);
    const riskLevel = getGoalRisk(metrics.bmi, profile?.targetWeightKg, profile?.currentWeightKg, profile?.heightCm, profile?.specialConditions);
    const advice = getSystemAdvice(metrics.bmi, profile?.specialConditions);

    return res.status(200).json({
      nutritionGoal: calculateNutritionProposal(metrics, goal, user?.gender),
      bmr: metrics.bmr,
      tdee: metrics.tdee,
      calorieFloor,
      bmiCategory,
      riskLevel,
      advice,
    });
  } catch (err) {
    console.error('[getNutritionProposal] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể tạo đề xuất mục tiêu dinh dưỡng' });
  }
}

/**
 * PUT /api/profile/nutrition-goal
 * Cập nhật hoặc tùy chỉnh mục tiêu calo & tỉ lệ macro (Protein, Carbs, Fat)
 */
async function saveNutritionGoal(req, res) {
  try {
    const { goal, customized = false } = req.body;
    if (!NUTRITION_GOALS.includes(goal)) return res.status(400).json({ message: 'Mục tiêu dinh dưỡng không hợp lệ' });
    const profile = await UserProfile.findOne({ user: req.user.id });
    const metrics = profile?.healthMetrics;
    if (!metrics?.bmr || !metrics?.tdee) {
      return res.status(422).json({ code: 'MISSING_TDEE', message: 'Vui lòng hoàn tất hồ sơ sức khỏe để xem chỉ số BMI/BMR/TDEE' });
    }

    const isAcknowledged = Boolean(
      req.body.acknowledgeUnsafeGoal ||
      req.body.nutritionGoal?.acknowledgeUnsafeGoal ||
      req.body.confirmRisk
    );
    let safetyWarning = null;
    if (metrics.bmiCategory) {
      const user = await User.findById(req.user.id).select('dateOfBirth').lean();
      const ageVal = user ? getAge(user.dateOfBirth) : null;
      const safetyError = checkGoalSafety(metrics.bmiCategory, goal, ageVal, profile.specialConditions);
      if (safetyError) {
        if (!isAcknowledged) {
          return res.status(400).json({ code: 'UNSAFE_GOAL', message: safetyError, warning: safetyError });
        }
        safetyWarning = safetyError;
      }
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
      {
        $set: {
          nutritionGoal,
          healthGoal: goal,
        },
      },
      { new: true, runValidators: true }
    ).lean();

    return res.status(200).json({
      message: customized ? 'Đã lưu mục tiêu dinh dưỡng tùy chỉnh' : 'Đã cập nhật mục tiêu dinh dưỡng',
      warning: safetyWarning,
      nutritionGoal,
      profile: updatedProfile,
    });
  } catch (err) {
    console.error('[saveNutritionGoal] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể lưu mục tiêu dinh dưỡng, vui lòng thử lại' });
  }
}

/**
 * POST /api/profile/avatar
 * Tải lên và cập nhật ảnh đại diện người dùng
 */
async function updateAvatar(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Ảnh đại diện không hợp lệ, vui lòng chọn ảnh JPG hoặc PNG' });
    }

    let avatarUrl = null;

    // 1. Nếu đã cấu hình Cloudinary đầy đủ, ưu tiên tải lên Cloudinary
    if (isCloudinaryConfigured()) {
      try {
        avatarUrl = await uploadFileToCloudinary(
          req.file,
          process.env.CLOUDINARY_AVATAR_FOLDER || 'nutrilens/avatars'
        );
      } catch (cloudErr) {
        console.warn('[updateAvatar] Tải lên Cloudinary thất bại, tự động chuyển sang lưu máy chủ cục bộ:', cloudErr.message);
      }
    }

    // 2. Nếu chưa cấu hình Cloudinary hoặc upload Cloudinary gặp sự cố, lưu vào thư mục tĩnh /uploads/avatars
    if (!avatarUrl) {
      const avatarDir = path.join(__dirname, '../../uploads/avatars');
      if (!fs.existsSync(avatarDir)) {
        fs.mkdirSync(avatarDir, { recursive: true });
      }

      const rawExt = path.extname(req.file.originalname || '').toLowerCase();
      const ext = ['.jpg', '.jpeg', '.png', '.webp'].includes(rawExt)
        ? rawExt
        : (req.file.mimetype === 'image/png' ? '.png' : '.jpg');
      const filename = String(req.user.id) + '-' + Date.now() + ext;
      const filePath = path.join(avatarDir, filename);

      fs.writeFileSync(filePath, req.file.buffer);
      avatarUrl = '/uploads/avatars/' + filename;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { avatarUrl } },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      message: 'Đã cập nhật ảnh đại diện thành công',
      user: buildUserResponse(user),
    });
  } catch (err) {
    console.error('[updateAvatar] Lỗi:', err);
    return res.status(500).json({ message: 'Không thể cập nhật ảnh đại diện, vui lòng thử lại' });
  }
}

module.exports = {
  getProfile,
  saveProfile,
  updateAvatar,
  getNutritionProposal,
  saveNutritionGoal,
  // Re-exported for backward compatibility
  getWeightLogs,
  saveWeightLog,
  deleteWeightLog,
  applyMilestoneWeight,
  getDashboardStats,
  getUserAnalytics,
};
