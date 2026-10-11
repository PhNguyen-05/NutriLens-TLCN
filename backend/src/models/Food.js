const mongoose = require('mongoose');

/**
 * Food - Thông tin dinh dưỡng của từng món ăn.
 * Dữ liệu được seed từ scripts/seedFoods.js.
 * Khớp với classes.json của AI service (slug là khoá chính nghiệp vụ).
 */
const foodSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Dinh dưỡng tính trên 1 khẩu phần (servingSize gram)
    servingSize: { type: Number, required: true, default: 100 }, // gram
    calories: { type: Number, required: true },   // kcal
    protein:  { type: Number, required: true },   // gram
    fat:      { type: Number, required: true },   // gram
    carbs:    { type: Number, required: true },   // gram
    fiber:    { type: Number, default: 0 },       // gram (tuỳ chọn)
    sodium:   { type: Number, default: 0 },       // mg   (tuỳ chọn)

    // Ghi chú thêm về món ăn (tuỳ chọn)
    description: { type: String, default: null },
    imageUrl:    { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Food', foodSchema);
