const UserProfile = require('../models/UserProfile');
const User = require('../models/User');

const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
const HEALTH_GOALS = ['lose_weight', 'maintain_weight', 'gain_weight', 'eat_healthier'];

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
  if (!HEALTH_GOALS.includes(payload.healthGoal)) return 'Mục tiêu sức khỏe không hợp lệ';
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
    healthGoal: payload.healthGoal,
    dietaryPreferences: [...new Set((payload.dietaryPreferences || [])
      .filter((item) => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean))],
    allergies: typeof payload.allergies === 'string' ? payload.allergies.trim() : '',
    medicalConditions: typeof payload.medicalConditions === 'string' ? payload.medicalConditions.trim() : '',
  };
}

async function getProfile(req, res) {
  try {
    const [user, profile] = await Promise.all([
      User.findById(req.user.id).select('fullName email phone dateOfBirth gender avatarUrl role').lean(),
      UserProfile.findOne({ user: req.user.id }).lean(),
    ]);
    return res.status(200).json({ user: user ? buildUserResponse(user) : null, profile });
  } catch (err) {
    console.error('[getProfile] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể tải hồ sơ sức khỏe' });
  }
}

async function saveProfile(req, res) {
  try {
    const validationError = validatePersonalInfo(req.body) || validateProfile(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

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

    const profile = await UserProfile.findOneAndUpdate(
      { user: req.user.id },
      { $set: normalizeProfile(req.body), $setOnInsert: { user: req.user.id } },
      { new: true, upsert: true, runValidators: true }
    ).lean();

    return res.status(200).json({ message: 'Cập nhật hồ sơ thành công', user: buildUserResponse(user), profile });
  } catch (err) {
    console.error('[saveProfile] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể lưu hồ sơ sức khỏe, vui lòng thử lại' });
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

module.exports = { getProfile, saveProfile, updateAvatar };
