const mongoose = require('mongoose');

const { Schema } = mongoose;

const adminActionLogSchema = new Schema(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    actionType: {
      type: String,
      enum: ['lock_user', 'unlock_user', 'approve_post', 'delete_food', 'hide_post', 'remove_post', 'reject_request'],
      required: true,
    },
    targetType: {
      type: String,
      enum: ['User', 'Post', 'FoodItem', 'Request'],
      required: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    reason: {
      type: String,
      default: null,
      trim: true,
      required: function () {
        return ['lock_user', 'remove_post', 'reject_request'].includes(this.actionType);
      },
    },
    durationDays: {
      type: Number,
      enum: [0, 7, 14, null],
      default: null,
    },
    note: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { timestamps: true }
);

adminActionLogSchema.index({ adminId: 1, createdAt: -1 });
adminActionLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

module.exports = mongoose.model('AdminActionLog', adminActionLogSchema);
