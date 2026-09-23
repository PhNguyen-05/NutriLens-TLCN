const mongoose = require('mongoose');

const { Schema } = mongoose;

const adminActionLogSchema = new Schema(
  {
    admin: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: ['lock_user', 'unlock_user'],
      required: true,
    },
    reason: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { timestamps: true }
);

adminActionLogSchema.index({ admin: 1, createdAt: -1 });
adminActionLogSchema.index({ targetUser: 1, createdAt: -1 });

module.exports = mongoose.model('AdminActionLog', adminActionLogSchema);
