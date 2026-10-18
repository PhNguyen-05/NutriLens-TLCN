const mongoose = require('mongoose');

/**
 * Exercise - Danh mục bài tập thể chất chuẩn hóa trong hệ thống NutriLens.
 * Phục vụ UC21 (Ghi nhận bài tập) và UC22 (Xem/Sửa/Xóa lịch sử).
 * Giá trị MET (Metabolic Equivalent of Task) dựa trên Compendium of Physical Activities.
 */
const exerciseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    isCustom: {
      type: Boolean,
      default: false,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      lowercase: true,
    },
    category: {
      type: String,
      enum: ['cardio', 'strength', 'sports', 'flexibility', 'other'],
      default: 'cardio',
      index: true,
    },
    categoryName: {
      type: String,
      default: 'Cardio & Vận động',
    },
    met: {
      type: Number,
      required: true,
      min: 0.1,
      max: 30,
    },
    intensity: {
      type: String,
      enum: ['Nhẹ', 'Trung bình', 'Cao'],
      default: 'Trung bình',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    icon: {
      type: String,
      default: 'bi-activity',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    defaultDurationMinutes: {
      type: Number,
      default: 30,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Exercise', exerciseSchema);
