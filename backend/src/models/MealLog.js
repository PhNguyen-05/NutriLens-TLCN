const mongoose = require('mongoose');

/**
 * MealLog - Nhật ký bữa ăn của người dùng.
 * Mỗi document = 1 lần người dùng thêm 1 món vào nhật ký trong ngày.
 * UC13: Sau khi quét ảnh thành công, người dùng nhấn "Thêm vào nhật ký".
 */
const mealLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Ngày ăn (YYYY-MM-DD theo múi giờ người dùng — frontend gửi lên)
    date: {
      type: String, // ví dụ: '2026-10-10'
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },

    // Phân loại bữa (tuỳ chọn, có thể thêm sau)
    mealType: {
      type: String,
      enum: ['breakfast', 'lunch', 'dinner', 'snack'],
      default: 'lunch',
    },

    // --- Thông tin món ăn tại thời điểm quét (snapshot) ---
    foodSlug: { type: String, required: true },
    foodName: { type: String, required: true },

    // Độ tin cậy của AI (%) - lưu lại để tham khảo
    confidence: { type: Number, default: null },

    // URL ảnh được phục vụ từ GridFS trên MongoDB.
    imageUrl: { type: String, default: null },

    // Số lượng khẩu phần người dùng nhập (mặc định = 1)
    servings: { type: Number, default: 1, min: 0.1, max: 99 },

    // Snapshot dinh dưỡng tại thời điểm lưu (để không bị ảnh hưởng nếu Food thay đổi sau)
    nutrition: {
      servingSize: { type: Number }, // gram / khẩu phần
      calories:    { type: Number }, // kcal / khẩu phần
      protein:     { type: Number }, // g
      fat:         { type: Number }, // g
      carbs:       { type: Number }, // g
      fiber:       { type: Number },
      sodium:      { type: Number },
    },
  },
  { timestamps: true }
);

// Index để truy vấn nhanh lịch sử theo user + ngày
mealLogSchema.index({ userId: 1, date: -1 });

module.exports = mongoose.model('MealLog', mealLogSchema);
