const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * FoodRequest - Yêu cầu bổ sung món ăn do người dùng đề xuất
 * Trạng thái:
 * - pending: Chờ duyệt
 * - approved: Đã duyệt (đã thêm vào FoodItem chính thức)
 * - rejected: Từ chối (kèm lý do)
 */
const foodRequestSchema = new Schema(
  {
    requestCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    foodName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    foodGroup: {
      type: String,
      trim: true,
      default: null,
    },
    servingSize: {
      type: Number,
      default: 100,
    },
    servingLabel: {
      type: String,
      default: '1 Suất (100g)',
    },
    calories: {
      type: Number,
      default: null,
    },
    protein: {
      type: Number,
      default: null,
    },
    fat: {
      type: Number,
      default: null,
    },
    carbs: {
      type: Number,
      default: null,
    },
    imageUrl: {
      type: String,
      trim: true,
      default: null,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    rejectionReason: {
      type: String,
      default: null,
      trim: true,
    },
    approvedFoodId: {
      type: Schema.Types.ObjectId,
      ref: 'Food',
      default: null,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    adminNote: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { timestamps: true }
);

foodRequestSchema.index({ status: 1, createdAt: -1 });
foodRequestSchema.index({ foodName: 'text' });

module.exports = mongoose.model('FoodRequest', foodRequestSchema);
