const mongoose = require('mongoose');

const { Schema } = mongoose;

const foodRequestSchema = new Schema(
  {
    requestedBy: {
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
    },
  },
  { timestamps: true }
);

foodRequestSchema.index({ status: 1, createdAt: -1 });
foodRequestSchema.index({ requestedBy: 1, createdAt: -1 });

module.exports = mongoose.model('FoodRequest', foodRequestSchema);
