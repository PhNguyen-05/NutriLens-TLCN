const mongoose = require('mongoose');

const { Schema } = mongoose;

const userProfileSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    heightCm: { type: Number, required: true, min: 100, max: 250 },
    currentWeightKg: { type: Number, required: true, min: 20, max: 300 },
    targetWeightKg: { type: Number, min: 20, max: 300, default: null },
    activityLevel: {
      type: String,
      required: true,
      enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'],
    },
    healthGoal: {
      type: String,
      enum: ['lose_weight', 'maintain_weight', 'gain_weight', 'eat_healthier'],
      default: 'maintain_weight',
    },
    dietaryPreferences: [{ type: String, trim: true, maxlength: 50 }],
    allergies: { type: String, trim: true, maxlength: 1000, default: '' },
    medicalConditions: { type: String, trim: true, maxlength: 1000, default: '' },
    healthMetrics: {
      bmi: { type: Number, default: null },
      bmiCategory: { type: String, enum: ['Thiếu cân', 'Bình thường', 'Thừa cân', 'Béo phì', null], default: null },
      bmr: { type: Number, default: null },
      tdee: { type: Number, default: null },
      calculatedAt: { type: Date, default: null },
    },
    nutritionGoal: {
      goal: { type: String, enum: ['lose_weight', 'gain_weight', 'maintain_weight'], default: null },
      calorieTarget: { type: Number, default: null },
      macroPercentages: {
        protein: { type: Number, default: null },
        carbs: { type: Number, default: null },
        fat: { type: Number, default: null },
      },
      proteinG: { type: Number, default: null },
      carbsG: { type: Number, default: null },
      fatG: { type: Number, default: null },
      customized: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserProfile', userProfileSchema);
