const mongoose = require('mongoose');
const BlogPost = require('../models/BlogPost');

const BLOG_STATUSES = ['Nháp', 'Đã xuất bản', 'Đã ẩn', 'Đã xóa'];
const AUTHOR_FIELDS = 'fullName role';

function serializeBlogPost(post) {
  const raw = typeof post.toObject === 'function' ? post.toObject() : post;
  const author = raw.authorId && raw.authorId.fullName !== undefined ? raw.authorId : null;

  return {
    ...raw,
    _id: String(raw._id),
    authorId: String(author?._id || raw.authorId || ''),
    authorName: author?.fullName || 'Admin NutriLens',
    authorRole: 'Quản trị viên',
    categoryTags: Array.isArray(raw.categoryTags) ? raw.categoryTags : [],
    viewCount: Number(raw.viewCount || 0),
  };
}

function validatePostInput(body = {}, current = null) {
  const title = String(body.title ?? current?.title ?? '').trim();
  const content = String(body.content ?? current?.content ?? '').trim();
  const imageUrl = body.imageUrl === undefined ? current?.imageUrl ?? null : String(body.imageUrl || '').trim() || null;
  const categoryTags = body.categoryTags === undefined
    ? current?.categoryTags || []
    : body.categoryTags;
  const status = body.status ?? current?.status ?? 'Nháp';

  if (!title) return { error: 'Tiêu đề bài viết không được để trống' };
  if (!content) return { error: 'Nội dung bài viết không được để trống' };
  if (!Array.isArray(categoryTags) || categoryTags.some((tag) => typeof tag !== 'string')) {
    return { error: 'Danh sách chuyên mục không hợp lệ' };
  }
  if (!BLOG_STATUSES.includes(status)) return { error: 'Trạng thái bài viết không hợp lệ' };

  const normalizedTags = [];
  const seenTags = new Set();
  for (const rawTag of categoryTags) {
    const tag = rawTag.trim();
    const key = tag.toLocaleLowerCase('vi');
    if (tag && !seenTags.has(key)) {
      seenTags.add(key);
      normalizedTags.push(tag);
    }
  }

  return { value: { title, content, imageUrl, categoryTags: normalizedTags, status } };
}

function invalidId(res) {
  return res.status(400).json({ message: 'Mã bài viết không hợp lệ' });
}

function validationFailure(res, error) {
  if (error?.name === 'ValidationError') {
    const message = Object.values(error.errors).map((item) => item.message).join('. ');
    return res.status(400).json({ message: message || 'Dữ liệu bài viết không hợp lệ' });
  }
  return null;
}

async function listBlogPosts(_req, res) {
  try {
    const posts = await BlogPost.find({})
      .populate('authorId', AUTHOR_FIELDS)
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean();
    return res.status(200).json({ data: posts.map(serializeBlogPost) });
  } catch (err) {
    console.error('[listBlogPosts] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể tải danh sách bài viết' });
  }
}

async function getBlogPost(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return invalidId(res);

    const post = await BlogPost.findById(id).populate('authorId', AUTHOR_FIELDS).lean();
    if (!post) return res.status(404).json({ message: 'Bài viết không tồn tại' });
    return res.status(200).json({ data: serializeBlogPost(post) });
  } catch (err) {
    console.error('[getBlogPost] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể tải chi tiết bài viết' });
  }
}

async function createBlogPost(req, res) {
  try {
    const parsed = validatePostInput(req.body);
    if (parsed.error) return res.status(400).json({ message: parsed.error });

    const publishedAt = parsed.value.status === 'Đã xuất bản' ? new Date() : null;
    const post = await BlogPost.create({
      ...parsed.value,
      authorId: req.user.id,
      viewCount: 0,
      publishedAt,
    });
    await post.populate('authorId', AUTHOR_FIELDS);
    return res.status(201).json({ message: 'Đã lưu bài viết', data: serializeBlogPost(post) });
  } catch (err) {
    const validationResponse = validationFailure(res, err);
    if (validationResponse) return validationResponse;
    console.error('[createBlogPost] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể lưu bài viết' });
  }
}

async function updateBlogPost(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return invalidId(res);

    const post = await BlogPost.findById(id);
    if (!post) return res.status(404).json({ message: 'Bài viết không tồn tại' });

    const parsed = validatePostInput(req.body, post);
    if (parsed.error) return res.status(400).json({ message: parsed.error });

    const previousStatus = post.status;
    Object.assign(post, parsed.value);
    if (parsed.value.status === 'Đã xuất bản' && previousStatus !== 'Đã xuất bản') {
      post.publishedAt = new Date();
    }

    await post.save();
    await post.populate('authorId', AUTHOR_FIELDS);
    return res.status(200).json({ message: 'Đã cập nhật bài viết', data: serializeBlogPost(post) });
  } catch (err) {
    const validationResponse = validationFailure(res, err);
    if (validationResponse) return validationResponse;
    console.error('[updateBlogPost] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể cập nhật bài viết' });
  }
}

async function updateBlogPostStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!mongoose.Types.ObjectId.isValid(id)) return invalidId(res);
    if (!BLOG_STATUSES.includes(status)) return res.status(400).json({ message: 'Trạng thái bài viết không hợp lệ' });

    const post = await BlogPost.findById(id);
    if (!post) return res.status(404).json({ message: 'Bài viết không tồn tại' });

    if (status === 'Đã xuất bản' && post.status !== 'Đã xuất bản') post.publishedAt = new Date();
    post.status = status;
    await post.save();
    await post.populate('authorId', AUTHOR_FIELDS);
    return res.status(200).json({ message: 'Đã cập nhật trạng thái bài viết', data: serializeBlogPost(post) });
  } catch (err) {
    const validationResponse = validationFailure(res, err);
    if (validationResponse) return validationResponse;
    console.error('[updateBlogPostStatus] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể cập nhật trạng thái bài viết' });
  }
}

async function bulkUpdateBlogPostStatus(req, res) {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100 || ids.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      return res.status(400).json({ message: 'Danh sách bài viết không hợp lệ' });
    }
    if (!BLOG_STATUSES.includes(status)) return res.status(400).json({ message: 'Trạng thái bài viết không hợp lệ' });

    const posts = await BlogPost.find({ _id: { $in: ids } });
    const timestamp = new Date();
    await Promise.all(posts.map(async (post) => {
      if (status === 'Đã xuất bản' && post.status !== 'Đã xuất bản') post.publishedAt = timestamp;
      post.status = status;
      await post.save();
    }));
    await Promise.all(posts.map((post) => post.populate('authorId', AUTHOR_FIELDS)));
    return res.status(200).json({
      message: 'Đã cập nhật trạng thái các bài viết',
      data: posts.map(serializeBlogPost),
    });
  } catch (err) {
    const validationResponse = validationFailure(res, err);
    if (validationResponse) return validationResponse;
    console.error('[bulkUpdateBlogPostStatus] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể cập nhật trạng thái bài viết' });
  }
}

async function deleteBlogPost(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return invalidId(res);

    const post = await BlogPost.findById(id);
    if (!post) return res.status(404).json({ message: 'Bài viết không tồn tại' });

    post.status = 'Đã xóa';
    await post.save();
    await post.populate('authorId', AUTHOR_FIELDS);
    return res.status(200).json({ message: 'Đã xóa bài viết', data: serializeBlogPost(post) });
  } catch (err) {
    const validationResponse = validationFailure(res, err);
    if (validationResponse) return validationResponse;
    console.error('[deleteBlogPost] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể xóa bài viết' });
  }
}

module.exports = {
  listBlogPosts,
  getBlogPost,
  createBlogPost,
  updateBlogPost,
  updateBlogPostStatus,
  bulkUpdateBlogPostStatus,
  deleteBlogPost,
};
