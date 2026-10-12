const mongoose = require('mongoose');

/**
 * Food - Thông tin dinh dưỡng của từng món ăn.
 * Khớp với classes.json của AI service (slug là khoá chính nghiệp vụ).
 */
const foodSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },

    // Mã định danh hệ thống (auto-generate, không cho phép admin nhập thủ công)
    foodCode: { type: String, unique: true, sparse: true, trim: true },

    // Nhóm thực phẩm (phân loại)
    foodGroup: { type: String, trim: true, default: null },

    // Dinh dưỡng tính trên 1 khẩu phần (servingSize gram)
    servingSize: { type: Number, required: true, default: 100 }, // gram
    calories: { type: Number, required: true },
    protein:  { type: Number, required: true },
    fat:      { type: Number, required: true },
    carbs:    { type: Number, required: true },
    fiber:    { type: Number, default: 0 },
    sodium:   { type: Number, default: 0 },

    description: { type: String, default: null },
    imageUrl:    { type: String, default: null },

    // Trạng thái: active = Đang sử dụng, hidden = Đã ẩn
    status: { type: String, enum: ['active', 'hidden'], default: 'active', index: true },
  },
  { timestamps: true }
);

foodSchema.index({ name: 'text' });

module.exports = mongoose.model('Food', foodSchema);
