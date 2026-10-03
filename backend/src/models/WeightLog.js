const mongoose = require('mongoose');

const { Schema } = mongoose;

const editHistoryItemSchema = new Schema(
  {
    weightKg: { type: Number, required: true, min: 20, max: 300 },
    loggedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const weightLogSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    weightKg: { type: Number, required: true, min: 20, max: 300 },
    recordedDate: { type: Date, required: true },
    loggedAt: { type: Date, default: Date.now },
    updateCount: { type: Number, default: 0, min: 0 },
    editHistory: { type: [editHistoryItemSchema], default: [] },
  },
  { timestamps: true }
);

// Mỗi người dùng chỉ có một giá trị cân nặng cho một ngày.
weightLogSchema.index({ user: 1, recordedDate: 1 }, { unique: true });
weightLogSchema.index({ user: 1, recordedDate: -1 });

module.exports = mongoose.model('WeightLog', weightLogSchema);
