const mongoose = require('mongoose');

const blogEngagementEventSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BlogPost',
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: ['view', 'like'],
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

blogEngagementEventSchema.index({ createdAt: 1, eventType: 1 });

module.exports = mongoose.model('BlogEngagementEvent', blogEngagementEventSchema);
