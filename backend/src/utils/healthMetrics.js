const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

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

module.exports = { calculateHealthMetrics, getBmiCategory };
