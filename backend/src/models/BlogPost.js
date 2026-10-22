const mongoose = require('mongoose');

const BLOG_STATUSES = ['Nháp', 'Đã xuất bản', 'Đã ẩn', 'Đã xóa'];

function isValidImageUrl(value) {
  if (value == null || value === '') return true;
  const imageUrl = String(value).trim();
  const localPath = imageUrl.split(/[?#]/, 1)[0];
  if (/^\/api\/media\/[a-f\d]{24}$/i.test(localPath)) return true;
  if (imageUrl.startsWith('/uploads/blog/')) return /\.(jpe?g|png)$/i.test(localPath);

  try {
    const parsed = new URL(imageUrl);
    return ['http:', 'https:'].includes(parsed.protocol) && /\.(jpe?g|png)$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

const blogPostSchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    imageUrl: {
      type: String,
      default: null,
      trim: true,
      validate: { validator: isValidImageUrl, message: 'Ảnh minh họa phải là JPG hoặc PNG hợp lệ' },
    },
    category: { type: String, trim: true, default: '' },
    tags: { type: [{ type: String, trim: true }], default: [] },
    categoryTags: { type: [{ type: String, trim: true }], default: [] },
    status: { type: String, enum: BLOG_STATUSES, default: 'Nháp' },
    viewCount: { type: Number, min: 0, default: 0 },
    likeCount: { type: Number, min: 0, default: 0 },
    likedBy: { type: [{ type: String }], default: [], select: false },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

blogPostSchema.index({ status: 1, updatedAt: -1 });
blogPostSchema.index({ status: 1, publishedAt: -1 });
blogPostSchema.index({ category: 1 });
blogPostSchema.index({ categoryTags: 1 });

module.exports = mongoose.model('BlogPost', blogPostSchema);
