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
      required: true,
      enum: ['lose_weight', 'maintain_weight', 'gain_weight', 'eat_healthier'],
    },
    dietaryPreferences: [{ type: String, trim: true, maxlength: 50 }],
    allergies: { type: String, trim: true, maxlength: 1000, default: '' },
    medicalConditions: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('UserProfile', userProfileSchema);
