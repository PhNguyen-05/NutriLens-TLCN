const mongoose = require('mongoose');
const BlogPost = require('../models/BlogPost');
const AdminActionLog = require('../models/AdminActionLog');

const BLOG_STATUSES = ['Nháp', 'Đã xuất bản', 'Đã ẩn', 'Đã xóa'];
const AUTHOR_FIELDS = 'fullName role';
const VIEWER_ID_PATTERN = /^guest:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getLikeViewerId(req, guestViewerId) {
  if (req.user?.id) return `user:${req.user.id}`;
  const viewerId = String(guestViewerId || '').trim();
  return VIEWER_ID_PATTERN.test(viewerId) ? viewerId : '';
}

function serializeBlogPost(post) {
  const raw = typeof post.toObject === 'function' ? post.toObject() : post;
  const publicPost = { ...raw };
  delete publicPost.likedBy;
  const author = raw.authorId && raw.authorId.fullName !== undefined ? raw.authorId : null;
  const legacyCategoryTags = Array.isArray(raw.categoryTags) ? raw.categoryTags : [];
  const category = String(raw.category || legacyCategoryTags[0] || '');
  const tags = Array.isArray(raw.tags) && raw.tags.length
    ? raw.tags
    : legacyCategoryTags.slice(category ? 1 : 0);

  return {
    ...publicPost,
    _id: String(raw._id),
    authorId: String(author?._id || raw.authorId || ''),
    authorName: author?.fullName || 'Admin NutriLens',
    authorRole: 'Quản trị viên',
    category,
    tags,
    categoryTags: [...new Set([category, ...tags].filter(Boolean))],
    viewCount: Number(raw.viewCount || 0),
    likeCount: Number(raw.likeCount || 0),
  };
}

function validatePostInput(body = {}, current = null) {
  const title = String(body.title ?? current?.title ?? '').trim();
  const content = String(body.content ?? current?.content ?? '').trim();
  const imageUrl = body.imageUrl === undefined ? current?.imageUrl ?? null : String(body.imageUrl || '').trim() || null;
  const legacyCategoryTags = body.categoryTags === undefined
    ? current?.categoryTags || []
    : body.categoryTags;
  const categoryValue = body.category === undefined
    ? body.categoryTags !== undefined
      ? (Array.isArray(body.categoryTags) ? body.categoryTags[0] || '' : '')
      : current?.category || (Array.isArray(legacyCategoryTags) ? legacyCategoryTags[0] || '' : '')
    : body.category;
  const category = typeof categoryValue === 'string' ? categoryValue.trim() : null;
  const rawTags = body.tags === undefined
    ? body.categoryTags !== undefined
      ? Array.isArray(body.categoryTags) ? body.categoryTags.slice(category ? 1 : 0) : []
      : (Array.isArray(current?.tags) && current.tags.length
        ? current.tags
        : Array.isArray(legacyCategoryTags) ? legacyCategoryTags.slice(category ? 1 : 0) : [])
    : body.tags;
  const status = body.status ?? current?.status ?? 'Nháp';

  if (!title) return { error: 'Tiêu đề bài viết không được để trống' };
  if (!content) return { error: 'Nội dung bài viết không được để trống' };
  if (category === null) return { error: 'Chuyên mục không hợp lệ' };
  if (body.categoryTags !== undefined && (!Array.isArray(body.categoryTags) || body.categoryTags.some((tag) => typeof tag !== 'string'))) {
    return { error: 'Danh sách chuyên mục không hợp lệ' };
  }
  if (!Array.isArray(rawTags) || rawTags.some((tag) => typeof tag !== 'string')) {
    return { error: 'Danh sách tag không hợp lệ' };
  }
  if (!BLOG_STATUSES.includes(status)) return { error: 'Trạng thái bài viết không hợp lệ' };

  const normalizedTags = [];
  const seenTags = new Set();
  for (const rawTag of rawTags) {
    const tag = rawTag.trim();
    const key = tag.toLocaleLowerCase('vi');
    if (tag && !seenTags.has(key)) {
      seenTags.add(key);
      normalizedTags.push(tag);
    }
  }

  return {
    value: {
      title,
      content,
      imageUrl,
      category,
      tags: normalizedTags,
      categoryTags: [...(category ? [category] : []), ...normalizedTags],
      status,
    },
  };
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

async function listPublishedBlogPosts(req, res) {
  try {
    const viewerId = getLikeViewerId(req, req.query.viewerId);
    const query = BlogPost.find({ status: 'Đã xuất bản' })
      .populate('authorId', AUTHOR_FIELDS)
      .sort({ publishedAt: -1, createdAt: -1 });
    if (viewerId) query.select('+likedBy');
    const posts = await query.lean();
    return res.status(200).json({
      data: posts.map((post) => ({
        ...serializeBlogPost(post),
        isLiked: Boolean(viewerId && post.likedBy?.includes(viewerId)),
      })),
    });
  } catch (err) {
    console.error('[listPublishedBlogPosts] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể tải bài viết' });
  }
}

async function getPublishedBlogPost(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return invalidId(res);

    const viewerId = getLikeViewerId(req, req.query.viewerId);
    const post = await BlogPost.findOne({ _id: id, status: 'Đã xuất bản' })
      .select(viewerId ? '+likedBy' : '')
      .lean();
    if (!post) return res.status(404).json({ message: 'Bài viết không tồn tại' });
    return res.status(200).json({
      data: { ...serializeBlogPost(post), isLiked: Boolean(viewerId && post.likedBy?.includes(viewerId)) },
    });
  } catch (err) {
    console.error('[getPublishedBlogPost] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể tải chi tiết bài viết' });
  }
}

async function incrementPublishedBlogView(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return invalidId(res);

    const post = await BlogPost.findOneAndUpdate(
      { _id: id, status: 'Đã xuất bản' },
      { $inc: { viewCount: 1 } },
      { new: true, timestamps: false }
    ).select('viewCount').lean();
    if (!post) return res.status(404).json({ message: 'Bài viết không tồn tại' });
    return res.status(200).json({ data: { viewCount: Number(post.viewCount || 0) } });
  } catch (err) {
    console.error('[incrementPublishedBlogView] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể cập nhật lượt xem' });
  }
}

async function togglePublishedBlogPostLike(req, res) {
  try {
    const { id } = req.params;
    const viewerId = getLikeViewerId(req, req.body?.viewerId);
    if (!mongoose.Types.ObjectId.isValid(id)) return invalidId(res);
    if (!viewerId) {
      return res.status(400).json({ message: 'Không thể xác định thiết bị yêu thích' });
    }

    const publishedPost = { _id: id, status: 'Đã xuất bản' };
    const alreadyLiked = await BlogPost.exists({ ...publishedPost, likedBy: viewerId });
    if (alreadyLiked) {
      await BlogPost.updateOne(
        { ...publishedPost, likedBy: viewerId },
        { $pull: { likedBy: viewerId }, $inc: { likeCount: -1 } },
        { timestamps: false }
      );
    } else {
      await BlogPost.updateOne(
        { ...publishedPost, likedBy: { $ne: viewerId } },
        { $addToSet: { likedBy: viewerId }, $inc: { likeCount: 1 } },
        { timestamps: false }
      );
    }

    const post = await BlogPost.findOne(publishedPost).select('likeCount +likedBy').lean();
    if (!post) return res.status(404).json({ message: 'Bài viết không tồn tại' });
    return res.status(200).json({
      data: {
        likeCount: Number(post.likeCount || 0),
        isLiked: Boolean(post.likedBy?.includes(viewerId)),
      },
    });
  } catch (err) {
    console.error('[togglePublishedBlogPostLike] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể cập nhật lượt yêu thích' });
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
      likeCount: 0,
      publishedAt,
    });
    await post.populate('authorId', AUTHOR_FIELDS);

    // Ghi nhận lịch sử thao tác của Admin
    await AdminActionLog.create({
      adminId: req.user.id,
      actionType: post.status === 'Đã xuất bản' ? 'publish_post' : 'create_post',
      targetType: 'Post',
      targetId: post._id,
      reason: post.status === 'Đã xuất bản'
        ? `Tạo và xuất bản bài viết "${post.title}"`
        : `Tạo bài viết nháp "${post.title}"`,
      note: `Chuyên mục: ${post.category || 'Chưa phân loại'}${post.tags?.length ? ` | Thẻ: ${post.tags.join(', ')}` : ''}`,
    });

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

    const isStatusChanged = previousStatus !== post.status;
    let actionType = 'update_post';
    let reason = `Cập nhật thông tin bài viết "${post.title}"`;
    if (isStatusChanged) {
      if (post.status === 'Đã xuất bản') {
        actionType = 'publish_post';
        reason = `Xuất bản bài viết "${post.title}"`;
      } else if (post.status === 'Đã ẩn') {
        actionType = 'hide_post';
        reason = `Ẩn bài viết "${post.title}" khỏi người dùng`;
      } else if (post.status === 'Nháp') {
        actionType = 'draft_post';
        reason = `Chuyển bài viết "${post.title}" về bản nháp`;
      } else if (post.status === 'Đã xóa') {
        actionType = 'delete_post';
        reason = `Xóa bài viết "${post.title}" khỏi hệ thống`;
      }
    }

    // Ghi nhận lịch sử thao tác của Admin
    await AdminActionLog.create({
      adminId: req.user.id,
      actionType,
      targetType: 'Post',
      targetId: post._id,
      reason,
      note: `Chuyên mục: ${post.category || 'Chưa phân loại'} | Trạng thái: ${post.status}${isStatusChanged ? ` (Cũ: ${previousStatus})` : ''}`,
    });

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

    const previousStatus = post.status;
    if (status === 'Đã xuất bản' && post.status !== 'Đã xuất bản') post.publishedAt = new Date();
    post.status = status;
    await post.save();
    await post.populate('authorId', AUTHOR_FIELDS);

    let actionType = 'update_post';
    let reason = `Cập nhật trạng thái bài viết "${post.title}" thành ${status}`;
    if (status === 'Đã xuất bản') {
      actionType = 'publish_post';
      reason = `Xuất bản bài viết "${post.title}"`;
    } else if (status === 'Đã ẩn') {
      actionType = 'hide_post';
      reason = `Ẩn bài viết "${post.title}" khỏi người dùng`;
    } else if (status === 'Nháp') {
      actionType = 'draft_post';
      reason = `Chuyển bài viết "${post.title}" về bản nháp`;
    } else if (status === 'Đã xóa') {
      actionType = 'delete_post';
      reason = `Xóa bài viết "${post.title}" khỏi hệ thống`;
    }

    // Ghi nhận lịch sử thao tác của Admin
    await AdminActionLog.create({
      adminId: req.user.id,
      actionType,
      targetType: 'Post',
      targetId: post._id,
      reason,
      note: `Chuyên mục: ${post.category || 'Chưa phân loại'} | Trạng thái: ${previousStatus} → ${status}`,
    });

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

    let actionType = 'update_post';
    let getReason = (title) => `Cập nhật trạng thái bài viết "${title}" thành ${status} (hàng loạt)`;
    if (status === 'Đã xuất bản') {
      actionType = 'publish_post';
      getReason = (title) => `Xuất bản bài viết "${title}" (hàng loạt)`;
    } else if (status === 'Đã ẩn') {
      actionType = 'hide_post';
      getReason = (title) => `Ẩn bài viết "${title}" khỏi người dùng (hàng loạt)`;
    } else if (status === 'Nháp') {
      actionType = 'draft_post';
      getReason = (title) => `Chuyển bài viết "${title}" về bản nháp (hàng loạt)`;
    } else if (status === 'Đã xóa') {
      actionType = 'delete_post';
      getReason = (title) => `Xóa bài viết "${title}" khỏi hệ thống (hàng loạt)`;
    }

    const logsToCreate = posts.map((post) => ({
      adminId: req.user.id,
      actionType,
      targetType: 'Post',
      targetId: post._id,
      reason: getReason(post.title),
      note: `Chuyên mục: ${post.category || 'Chưa phân loại'} | Trạng thái mới: ${status}`,
    }));

    if (logsToCreate.length > 0) {
      await AdminActionLog.insertMany(logsToCreate);
    }

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

    // Ghi nhận lịch sử thao tác của Admin
    await AdminActionLog.create({
      adminId: req.user.id,
      actionType: 'delete_post',
      targetType: 'Post',
      targetId: post._id,
      reason: `Xóa bài viết "${post.title}" khỏi hệ thống`,
      note: `Chuyên mục: ${post.category || 'Chưa phân loại'}`,
    });

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
  listPublishedBlogPosts,
  getPublishedBlogPost,
  incrementPublishedBlogView,
  togglePublishedBlogPostLike,
  getBlogPost,
  createBlogPost,
  updateBlogPost,
  updateBlogPostStatus,
  bulkUpdateBlogPostStatus,
  deleteBlogPost,
};
