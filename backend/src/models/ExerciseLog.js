const mongoose = require('mongoose');

/**
 * ExerciseLog - Nhật ký bài tập của người dùng.
 * Phục vụ UC21 (Lưu lịch sử bài tập) và UC22 (Xem/Sửa/Xóa lịch sử).
 * Công thức tính:
 *   Calories = (MET * 3.5 * Cân nặng (kg) * Thời gian (phút)) / 200
 */
const exerciseLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    exerciseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exercise',
      required: true,
    },
    exerciseName: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: 'cardio',
    },
    met: {
      type: Number,
      required: true,
      min: 0.1,
    },
    weightKg: {
      type: Number,
      required: true,
      min: 20,
      max: 300,
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 1,
      max: 1440,
    },
    caloriesBurned: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
      index: true,
    },
    time: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
  },
  { timestamps: true }
);

// Index kép cho việc truy vấn lịch sử nhanh theo user và ngày tập
exerciseLogSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('ExerciseLog', exerciseLogSchema);
