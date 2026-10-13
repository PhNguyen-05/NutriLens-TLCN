const mongoose = require('mongoose');

const { Schema } = mongoose;

const foodRequestSchema = new Schema(
  {
    requestedBy: {

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

    name: {
      type: String,
      required: true,
      trim: true,
    },
    imageUrl: {
      type: String,
      default: null,
      trim: true,
    },
    caloriesPer100g: { type: Number, default: null, min: 0 },
    proteinPer100g: { type: Number, default: null, min: 0 },
    carbPer100g:    { type: Number, default: null, min: 0 },
    fatPer100g:     { type: Number, default: null, min: 0 },
    note: {
      type: String,
      default: null,
      trim: true,
    },
    status: {
      type: String,
      enum: ['Chờ duyệt', 'Đã duyệt', 'Từ chối'],
      default: 'Chờ duyệt',
      index: true,
    },
    rejectReason: {
      type: String,
      default: null,
      trim: true,
      validate: {
        validator(value) {
          return this.status !== 'Từ chối' || Boolean(String(value || '').trim());
        },
        message: 'Cần nhập lý do khi từ chối yêu cầu',
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

    approvedFoodItemId: {
      type: Schema.Types.ObjectId,
      ref: 'Food',
      default: null,

    adminNote: {
      type: String,
      default: null,
      trim: true,

    },
  },
  { timestamps: true }
);

foodRequestSchema.index({ status: 1, createdAt: -1 });

foodRequestSchema.index({ requestedBy: 1, createdAt: -1 });

foodRequestSchema.index({ foodName: 'text' });


module.exports = mongoose.model('FoodRequest', foodRequestSchema);
