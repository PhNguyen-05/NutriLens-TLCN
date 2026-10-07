const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/**
 * Calo tối thiểu an toàn theo giới tính.
 * Nguồn: hướng dẫn lâm sàng phổ biến (Harvard Health, WHO).
 */
const CALORIE_FLOOR = { male: 1500, female: 1200 };

function getBmiCategory(bmi) {
  if (bmi < 18.5) return 'Thiếu cân';
  if (bmi < 23) return 'Bình thường';
  if (bmi < 25) return 'Thừa cân';
  return 'Béo phì';
}

function getAge(dateOfBirth, now = new Date()) {
  if (!dateOfBirth) return null;
  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return null;

  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
  const hasHadBirthday = now.getUTCMonth() > birthDate.getUTCMonth()
    || (now.getUTCMonth() === birthDate.getUTCMonth() && now.getUTCDate() >= birthDate.getUTCDate());
  if (!hasHadBirthday) age -= 1;
  return age >= 0 ? age : null;
}

function calculateHealthMetrics({ heightCm, weightKg, dateOfBirth, gender, activityLevel }) {
  const height = Number(heightCm);
  const weight = Number(weightKg);
  const age = getAge(dateOfBirth);
  if (!Number.isFinite(height) || !Number.isFinite(weight) || height <= 0 || weight <= 0) {
    return { bmi: null, bmiCategory: null, bmr: null, tdee: null };
  }

  const bmi = Number((weight / ((height / 100) ** 2)).toFixed(1));

  if (age == null || !['male', 'female'].includes(gender)) {
    return { bmi, bmiCategory: getBmiCategory(bmi), bmr: null, tdee: null };
  }

  // Công thức Mifflin-St Jeor: nam +5, nữ -161.
  const bmr = Math.round(10 * weight + 6.25 * height - 5 * age + (gender === 'male' ? 5 : -161));
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel];
  return { bmi, bmiCategory: getBmiCategory(bmi), bmr, tdee: multiplier ? Math.round(bmr * multiplier) : null };
}

/**
 * Tính calo mục tiêu an toàn.
 * - lose_weight: thâm hụt tối đa 20% TDEE (không quá 500 kcal), không thấp hơn BMR và FLOOR.
 * - gain_weight: cộng 350 kcal.
 * - maintain_weight: bằng TDEE.
 *
 * @param {{ bmr: number, tdee: number }} metrics
 * @param {'lose_weight'|'maintain_weight'|'gain_weight'} goal
 * @param {'male'|'female'|string} gender
 * @returns {number}
 */
function calcSafeCalorieTarget(metrics, goal, gender) {
  const { bmr, tdee } = metrics;
  const floor = CALORIE_FLOOR[gender] ?? 1200;

  if (goal === 'lose_weight') {
    const deficit = Math.min(500, Math.round(tdee * 0.2));
    return Math.max(bmr, tdee - deficit, floor);
  }
  if (goal === 'gain_weight') {
    return tdee + 350;
  }
  return tdee; // maintain_weight
}

module.exports = { calculateHealthMetrics, getBmiCategory, calcSafeCalorieTarget, CALORIE_FLOOR, getAge };
