const mongoose = require('mongoose');

const COMMUNITY_TAGS = [
  'Công thức món ăn',
  'Kinh nghiệm dinh dưỡng',
  'Quá trình tập luyện',
  'Mẹo sức khỏe',
  'Hỏi đáp cộng đồng',
  'Chia sẻ chung',
];

const COMMUNITY_STATUSES = ['published', 'hidden', 'deleted'];

const commentSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

const communityPostSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    imageUrl: {
      type: String,
      default: null,
      trim: true,
    },
    tag: {
      type: String,
      trim: true,
      default: 'Chia sẻ chung',
    },
    status: {
      type: String,
      enum: COMMUNITY_STATUSES,
      default: 'published',
      index: true,
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    likeCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    comments: [commentSchema],
    commentCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

// Indexes phục vụ tải bài viết theo thời gian và lọc theo chủ đề
communityPostSchema.index({ status: 1, createdAt: -1 });
communityPostSchema.index({ status: 1, tag: 1, createdAt: -1 });

module.exports = {
  CommunityPost: mongoose.model('CommunityPost', communityPostSchema),
  COMMUNITY_TAGS,
  COMMUNITY_STATUSES,
};
