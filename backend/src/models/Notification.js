const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * Notification - Thông báo gửi tới người dùng
 * Dùng cho kết quả duyệt yêu cầu món ăn, cập nhật tài khoản, lời nhắc hệ thống.
 */
const notificationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['food_request_approved', 'food_request_rejected', 'system', 'reminder'],
      default: 'system',
      index: true,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
