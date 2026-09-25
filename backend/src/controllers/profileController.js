const UserProfile = require('../models/UserProfile');
const User = require('../models/User');
const WeightLog = require('../models/WeightLog');
const { calculateHealthMetrics } = require('../utils/healthMetrics');

const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const HEALTH_GOALS = ['lose_weight', 'maintain_weight', 'gain_weight', 'eat_healthier'];
const NUTRITION_GOALS = ['lose_weight', 'gain_weight', 'maintain_weight'];
const MACRO_RATIOS = {
  lose_weight: { protein: 30, carbs: 40, fat: 30 },
  gain_weight: { protein: 25, carbs: 50, fat: 25 },
  maintain_weight: { protein: 20, carbs: 50, fat: 30 },
};

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

function serializeWeightLog(log) {
  return {
    id: log._id,
    weightKg: log.weightKg,
    recordedDate: log.recordedDate.toISOString().slice(0, 10),
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

function calculateNutritionProposal(metrics, goal) {
  const calorieTarget = goal === 'lose_weight'
    ? Math.max(metrics.bmr, metrics.tdee - 500)
    : goal === 'gain_weight' ? metrics.tdee + 350 : metrics.tdee;
  return buildNutritionGoal(goal, calorieTarget, MACRO_RATIOS[goal]);
}

async function getProfile(req, res) {
  try {
    const [user, profile] = await Promise.all([
      User.findById(req.user.id).select('fullName email phone dateOfBirth gender avatarUrl role').lean(),
      UserProfile.findOne({ user: req.user.id }).lean(),
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
    return res.status(200).json({ user: user ? buildUserResponse(user) : null, profile: resolvedProfile });
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
    const isFirstSetup = !existingProfile || !existingProfile.nutritionGoal?.goal;

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

    let resolvedNutritionGoal = existingProfile?.nutritionGoal || null;
    if (healthMetrics.bmr && healthMetrics.tdee) {
      if (req.body.nutritionGoal && req.body.nutritionGoal.customized) {
        const cal = Number(req.body.nutritionGoal.calorieTarget);
        const macros = req.body.nutritionGoal.macroPercentages;
        if (Number.isFinite(cal) && macros) {
          resolvedNutritionGoal = buildNutritionGoal(validGoal, cal, macros, true);
        } else {
          resolvedNutritionGoal = calculateNutritionProposal(healthMetrics, validGoal);
        }
      } else {
        resolvedNutritionGoal = calculateNutritionProposal(healthMetrics, validGoal);
      }
    }

    const profile = await UserProfile.findOneAndUpdate(
      { user: req.user.id },
      {
        $set: {
          ...normalizeProfile(req.body),
          healthGoal: validGoal,
          healthMetrics: {
            ...healthMetrics,
            calculatedAt: new Date(),
          },
          ...(resolvedNutritionGoal ? { nutritionGoal: resolvedNutritionGoal } : {}),
        },
        $setOnInsert: { user: req.user.id },
      },
      { new: true, upsert: true, runValidators: true }
    ).lean();

    // Khởi tạo bản ghi cân nặng hôm nay nếu chưa từng có bản ghi nào
    const existingLog = await WeightLog.findOne({ user: req.user.id });
    if (!existingLog) {
      await WeightLog.create({
        user: req.user.id,
        weightKg: Number(req.body.currentWeightKg),
        recordedDate: getTodayDate(),
      }).catch((logErr) => console.warn('[saveProfile] Khởi tạo bản ghi cân nặng ban đầu:', logErr.message));
    }

    return res.status(200).json({
      message: 'Cập nhật hồ sơ và mục tiêu dinh dưỡng thành công',
      user: buildUserResponse(user),
      profile,
    });
  } catch (err) {
    console.error('[saveProfile] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể lưu hồ sơ sức khỏe, vui lòng thử lại' });
  }
}

async function getWeightLogs(req, res) {
  try {
    const logs = await WeightLog.find({ user: req.user.id }).sort({ recordedDate: 1 }).lean();
    return res.status(200).json({ weightLogs: logs.map(serializeWeightLog) });
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

    let nutritionGoal = calculateNutritionProposal(metrics, goal);
    if (customized) {
      const calorieTarget = Number(req.body.calorieTarget);
      const macroPercentages = Object.fromEntries(['protein', 'carbs', 'fat'].map((key) => [key, Number(req.body.macroPercentages?.[key])]));
      const macroTotal = macroPercentages.protein + macroPercentages.carbs + macroPercentages.fat;
      if (!Number.isFinite(calorieTarget) || calorieTarget < metrics.bmr || calorieTarget > metrics.tdee + 1000) {
        return res.status(400).json({ code: 'INVALID_CALORIES', message: 'Giá trị calo mục tiêu không phù hợp với sức khỏe' });
      }
      if (Object.values(macroPercentages).some((value) => !Number.isFinite(value) || value < 0) || Math.abs(macroTotal - 100) > 0.001) {
        return res.status(400).json({ code: 'INVALID_MACROS', message: 'Tổng tỉ lệ Protein, Carb và Fat phải bằng 100%' });
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
    if (existingLog && !req.body.overwrite) {
      return res.status(409).json({ code: 'WEIGHT_LOG_EXISTS', message: 'Bạn đã ghi nhận cân nặng hôm nay, bạn có muốn cập nhật lại giá trị này?' });
    }

    const log = existingLog
      ? await WeightLog.findByIdAndUpdate(existingLog._id, { $set: { weightKg } }, { new: true, runValidators: true })
      : await WeightLog.create({ user: req.user.id, weightKg, recordedDate });

    const latestLog = await WeightLog.findOne({ user: req.user.id }).sort({ recordedDate: -1 }).lean();
    let updatedProfile = profile.toObject();
    if (latestLog && latestLog.recordedDate.getTime() === recordedDate.getTime()) {
      const user = await User.findById(req.user.id).select('dateOfBirth gender').lean();
      const healthMetrics = {
        ...calculateHealthMetrics({
          heightCm: profile.heightCm,
          weightKg,
          dateOfBirth: user?.dateOfBirth,
          gender: user?.gender,
          activityLevel: profile.activityLevel,
        }),
        calculatedAt: new Date(),
      };
      updatedProfile = await UserProfile.findByIdAndUpdate(
        profile._id,
        { $set: { currentWeightKg: weightKg, healthMetrics } },
        { new: true, runValidators: true }
      ).lean();
    }

    return res.status(existingLog ? 200 : 201).json({
      message: 'Đã ghi nhận cân nặng thành công',
      weightLog: serializeWeightLog(log),
      profile: updatedProfile,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ code: 'WEIGHT_LOG_EXISTS', message: 'Bạn đã ghi nhận cân nặng hôm nay, bạn có muốn cập nhật lại giá trị này?' });
    }
    console.error('[saveWeightLog] Lỗi:', err.message);
    return res.status(500).json({ message: 'Ghi nhận cân nặng thất bại, vui lòng thử lại' });
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

module.exports = { getProfile, saveProfile, updateAvatar, getWeightLogs, saveWeightLog, getNutritionProposal, saveNutritionGoal };
