const path = require('path');
const { CommunityPost, COMMUNITY_TAGS } = require('../models/CommunityPost');
const { isCloudinaryConfigured, uploadFileToCloudinary } = require('../services/cloudinaryStorage');

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/jfif'];

/**
 * UC26: Đăng bài viết cộng đồng
 * POST /api/community/posts
 */
async function createPost(req, res) {
  try {
    let { content, tag, imageUrl } = req.body || {};

    // 1. Kiểm tra tính hợp lệ của nội dung bài viết (Ngoại lệ 3a/4a)
    content = String(content || '').trim();
    if (!content) {
      return res.status(400).json({
        message: 'Nội dung bài viết không được để trống',
      });
    }

    // 2. Xử lý Tag/Chủ đề (Luồng thay thế 5c/6c)
    tag = String(tag || '').trim();
    if (!tag || !COMMUNITY_TAGS.includes(tag)) {
      tag = 'Chia sẻ chung';
    }

    // 3. Xử lý tệp hình ảnh đính kèm (nếu có - Luồng 4b/5b & Ngoại lệ 4b/5b)
    let finalImageUrl = null;

    if (req.file) {
      const file = req.file;

      const isAllowedMime = ALLOWED_MIME_TYPES.includes(file.mimetype) || file.mimetype?.startsWith('image/');
      const ext = path.extname(file.originalname || '').toLowerCase();
      const isAllowedExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.jfif', '.bmp'].includes(ext);

      // Kiểm tra định dạng ảnh
      if (!isAllowedMime && !isAllowedExt) {
        return res.status(400).json({
          message: 'Hình ảnh không hợp lệ. Vui lòng chọn ảnh định dạng JPG, PNG, WEBP hoặc GIF.',
        });
      }

      // Kiểm tra dung lượng ảnh
      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        return res.status(400).json({
          message: 'Hình ảnh không hợp lệ. Dung lượng tối đa cho phép là 5MB.',
        });
      }

      // Lưu trữ ảnh: Ưu tiên Cloudinary nếu đã cấu hình, nếu không fallback sang base64 data URI
      if (isCloudinaryConfigured()) {
        try {
          finalImageUrl = await uploadFileToCloudinary(file, 'nutrilens/community');
        } catch (uploadErr) {
          console.warn('[communityController] Lỗi tải lên Cloudinary, dùng base64 dự phòng:', uploadErr.message);
          finalImageUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
        }
      } else {
        finalImageUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
      }
    } else if (imageUrl && typeof imageUrl === 'string') {
      const trimmedUrl = imageUrl.trim();
      // Nếu là base64 data url
      if (trimmedUrl.startsWith('data:image/')) {
        const matches = trimmedUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
        if (!matches || !ALLOWED_MIME_TYPES.includes(matches[1])) {
          return res.status(400).json({
            message: 'Hình ảnh không hợp lệ',
          });
        }
        // Kiểm tra xấp xỉ dung lượng base64
        const approxSize = (matches[2].length * 3) / 4;
        if (approxSize > MAX_IMAGE_SIZE_BYTES) {
          return res.status(400).json({
            message: 'Hình ảnh không hợp lệ. Dung lượng ảnh vượt quá 5MB.',
          });
        }
        finalImageUrl = trimmedUrl;
      } else if (/^https?:\/\//i.test(trimmedUrl)) {
        finalImageUrl = trimmedUrl;
      }
    }

    // 4. Lưu bài viết cùng thông tin người đăng và thời gian đăng (Bước 8 & 9)
    const newPost = new CommunityPost({
      authorId: req.user.id,
      content,
      tag,
      imageUrl: finalImageUrl,
      status: 'published',
      likes: [],
      likeCount: 0,
      comments: [],
      commentCount: 0,
    });

    await newPost.save();

    // Populate thông tin tác giả để trả về giao diện ngay lập tức
    const populatedPost = await CommunityPost.findById(newPost._id)
      .populate('authorId', 'fullName email avatarUrl role')
      .lean();

    // 5. Hệ thống thông báo “Đăng bài thành công” (Bước 10)
    return res.status(201).json({
      message: 'Đăng bài thành công',
      post: populatedPost,
    });
  } catch (error) {
    console.error('[createPost] Lỗi lưu bài viết:', error);
    // Ngoại lệ 8c / 9c
    return res.status(500).json({
      message: 'Không thể đăng bài, vui lòng thử lại',
      error: error.message,
    });
  }
}

/**
 * Lấy danh sách bài viết cộng đồng
 * GET /api/community/posts
 */
async function getPosts(req, res) {
  try {
    const { tag, page = 1, limit = 20, search } = req.query;
    const filter = { status: 'published' };

    if (tag && tag !== 'Tất cả' && COMMUNITY_TAGS.includes(tag)) {
      filter.tag = tag;
    }

    if (search && typeof search === 'string' && search.trim()) {
      filter.content = { $regex: search.trim(), $options: 'i' };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [total, posts] = await Promise.all([
      CommunityPost.countDocuments(filter),
      CommunityPost.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('authorId', 'fullName email avatarUrl role')
        .populate('comments.authorId', 'fullName email avatarUrl role')
        .lean(),
    ]);

    // Thêm trường isLikedByUser nếu người dùng đã đăng nhập
    const currentUserId = req.user?.id ? String(req.user.id) : null;
    const enrichedPosts = posts.map((post) => {
      const isLiked = currentUserId
        ? (post.likes || []).some((uid) => String(uid) === currentUserId)
        : false;
      return {
        ...post,
        isLiked,
        likeCount: post.likes ? post.likes.length : 0,
        commentCount: post.comments ? post.comments.length : 0,
      };
    });

    return res.status(200).json({
      posts: enrichedPosts,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      hasMore: skip + posts.length < total,
      availableTags: ['Tất cả', ...COMMUNITY_TAGS],
    });
  } catch (error) {
    console.error('[getPosts] Lỗi lấy danh sách bài viết:', error);
    return res.status(500).json({
      message: 'Không thể tải danh sách bài viết cộng đồng',
    });
  }
}

/**
 * Thả tim / Bỏ thả tim bài viết
 * POST /api/community/posts/:id/like
 */
async function toggleLike(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const post = await CommunityPost.findById(id);
    if (!post || post.status !== 'published') {
      return res.status(404).json({ message: 'Bài viết không tồn tại hoặc đã bị ẩn' });
    }

    const userLikedIndex = post.likes.findIndex((uid) => String(uid) === String(userId));
    let isLiked = false;

    if (userLikedIndex > -1) {
      post.likes.splice(userLikedIndex, 1);
      isLiked = false;
    } else {
      post.likes.push(userId);
      isLiked = true;
    }

    post.likeCount = post.likes.length;
    await post.save();

    return res.status(200).json({
      isLiked,
      likeCount: post.likeCount,
    });
  } catch (error) {
    console.error('[toggleLike] Lỗi:', error);
    return res.status(500).json({ message: 'Không thể xử lý thao tác thích bài viết' });
  }
}

/**
 * UC27: Thêm bình luận vào bài viết (Luồng chính 1 - 8)
 * POST /api/community/posts/:id/comments
 */
async function addComment(req, res) {
  try {
    const { id } = req.params;
    const { content } = req.body || {};

    // Ngoại lệ 3a / 4a: Nội dung bình luận để trống
    const trimmedContent = String(content || '').trim();
    if (!trimmedContent) {
      return res.status(400).json({ message: 'Nội dung bình luận không được để trống' });
    }

    const post = await CommunityPost.findById(id);
    // Ngoại lệ 3b / 4b: Bài đăng đã bị xóa hoặc không cho phép bình luận
    if (!post || post.status !== 'published') {
      return res.status(404).json({ message: 'Bài đăng không còn tồn tại hoặc không cho phép bình luận' });
    }

    post.comments.push({
      authorId: req.user.id,
      content: trimmedContent,
      createdAt: new Date(),
    });

    post.commentCount = post.comments.length;
    await post.save();

    const updatedPost = await CommunityPost.findById(id)
      .populate('comments.authorId', 'fullName email avatarUrl role')
      .lean();

    // Bước 7 & 8: Trả về danh sách bình luận đã cập nhật
    return res.status(201).json({
      message: 'Bình luận thành công',
      comments: updatedPost.comments,
      commentCount: updatedPost.commentCount,
    });
  } catch (error) {
    console.error('[addComment] Lỗi:', error);
    // Ngoại lệ 6c / 7c: Lỗi hệ thống
    return res.status(500).json({ message: 'Không thể gửi bình luận, vui lòng thử lại' });
  }
}

/**
 * UC27: Chỉnh sửa bình luận (Luồng thay thế 3a - 8a)
 * PUT /api/community/posts/:postId/comments/:commentId
 */
async function updateComment(req, res) {
  try {
    const { postId, commentId } = req.params;
    const { content } = req.body || {};

    // Ngoại lệ 3a / 4a: Nội dung để trống khi cập nhật
    const trimmedContent = String(content || '').trim();
    if (!trimmedContent) {
      return res.status(400).json({ message: 'Nội dung bình luận không được để trống' });
    }

    const post = await CommunityPost.findById(postId);
    // Ngoại lệ 3b / 4b: Bài đăng không tồn tại hoặc đã ẩn
    if (!post || post.status !== 'published') {
      return res.status(404).json({ message: 'Bài đăng không còn tồn tại hoặc không cho phép bình luận' });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Bình luận không tồn tại hoặc đã bị xóa' });
    }

    // Chỉ chính chủ tác giả bình luận mới được chỉnh sửa
    if (String(comment.authorId) !== String(req.user.id)) {
      return res.status(403).json({ message: 'Bạn chỉ có quyền chỉnh sửa bình luận của chính mình' });
    }

    comment.content = trimmedContent;
    comment.isEdited = true;
    comment.editedAt = new Date();

    await post.save();

    const updatedPost = await CommunityPost.findById(postId)
      .populate('comments.authorId', 'fullName email avatarUrl role')
      .lean();

    // Luồng thay thế 7a: "Cập nhật bình luận thành công"
    return res.status(200).json({
      message: 'Cập nhật bình luận thành công',
      comments: updatedPost.comments,
      commentCount: updatedPost.commentCount,
    });
  } catch (error) {
    console.error('[updateComment] Lỗi:', error);
    return res.status(500).json({ message: 'Không thể cập nhật bình luận, vui lòng thử lại' });
  }
}

/**
 * UC27: Xóa bình luận (Luồng thay thế 3b - 8b)
 * DELETE /api/community/posts/:postId/comments/:commentId
 */
async function deleteComment(req, res) {
  try {
    const { postId, commentId } = req.params;
    const post = await CommunityPost.findById(postId);

    if (!post) {
      return res.status(404).json({ message: 'Bài đăng không còn tồn tại hoặc không cho phép bình luận' });
    }

    const comment = post.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Bình luận không tồn tại hoặc đã bị xóa' });
    }

    const isCommentAuthor = String(comment.authorId) === String(req.user.id);
    const isPostAuthor = String(post.authorId) === String(req.user.id);
    const isAdmin = req.user.role === 'admin';

    if (!isCommentAuthor && !isPostAuthor && !isAdmin) {
      return res.status(403).json({ message: 'Bạn không có quyền xóa bình luận này' });
    }

    comment.deleteOne();
    post.commentCount = Math.max(0, post.comments.length);
    await post.save();

    const updatedPost = await CommunityPost.findById(postId)
      .populate('comments.authorId', 'fullName email avatarUrl role')
      .lean();

    // Luồng thay thế 7b: "Xóa bình luận thành công"
    return res.status(200).json({
      message: 'Xóa bình luận thành công',
      comments: updatedPost.comments,
      commentCount: updatedPost.commentCount,
    });
  } catch (error) {
    console.error('[deleteComment] Lỗi:', error);
    return res.status(500).json({ message: 'Không thể xóa bình luận, vui lòng thử lại' });
  }
}

/**
 * Xóa bài viết
 * DELETE /api/community/posts/:id
 */
async function deletePost(req, res) {
  try {
    const { id } = req.params;
    const post = await CommunityPost.findById(id);

    if (!post) {
      return res.status(404).json({ message: 'Bài viết không tồn tại' });
    }

    const isAuthor = String(post.authorId) === String(req.user.id);
    const isAdmin = req.user.role === 'admin';

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ message: 'Bạn không có quyền xóa bài viết này' });
    }

    // Xóa mềm bài viết
    post.status = 'deleted';
    await post.save();

    return res.status(200).json({ message: 'Đã xóa bài viết thành công' });
  } catch (error) {
    console.error('[deletePost] Lỗi:', error);
    return res.status(500).json({ message: 'Không thể xóa bài viết' });
  }
}

module.exports = {
  createPost,
  getPosts,
  toggleLike,
  addComment,
  updateComment,
  deleteComment,
  deletePost,
};
