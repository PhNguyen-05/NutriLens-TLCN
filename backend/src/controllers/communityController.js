const path = require('path');
const mongoose = require('mongoose');
const User = require('../models/User');
const { CommunityPost, COMMUNITY_TAGS } = require('../models/CommunityPost');
const { isCloudinaryConfigured, uploadFileToCloudinary } = require('../services/cloudinaryStorage');

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/jfif'];

/**
 * Trích xuất và chuẩn hóa thông số dinh dưỡng (Calo, Protein, Carbs, Fat)
 */
function parseNutritionData(body) {
  if (!body) return null;
  let calories = null;
  let protein = null;
  let carbs = null;
  let fat = null;

  if (body.nutrition) {
    if (typeof body.nutrition === 'string') {
      try {
        const parsed = JSON.parse(body.nutrition);
        calories = parsed.calories;
        protein = parsed.protein;
        carbs = parsed.carbs;
        fat = parsed.fat;
      } catch (e) {
        // bỏ qua lỗi parse json
      }
    } else if (typeof body.nutrition === 'object') {
      calories = body.nutrition.calories;
      protein = body.nutrition.protein;
      carbs = body.nutrition.carbs;
      fat = body.nutrition.fat;
    }
  }

  // Hỗ trợ cả các trường trực tiếp trong form-data
  if (calories === null && body.calories !== undefined) calories = body.calories;
  if (protein === null && body.protein !== undefined) protein = body.protein;
  if (carbs === null && body.carbs !== undefined) carbs = body.carbs;
  if (fat === null && body.fat !== undefined) fat = body.fat;

  const numOrNull = (v) => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return isNaN(n) || n < 0 ? null : Math.round(n * 10) / 10;
  };

  calories = numOrNull(calories);
  protein = numOrNull(protein);
  carbs = numOrNull(carbs);
  fat = numOrNull(fat);

  if (calories !== null || protein !== null || carbs !== null || fat !== null) {
    return { calories, protein, carbs, fat };
  }
  return null;
}

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
    const nutrition = parseNutritionData(req.body);

    const newPost = new CommunityPost({
      authorId: req.user.id,
      content,
      tag,
      imageUrl: finalImageUrl,
      nutrition,
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
    const {
      tag,
      page = 1,
      limit = 20,
      search,
      onlyMine,
      filter: filterParam,
      authorId,
      sortBy = 'latest',
    } = req.query;
    const filter = { status: 'published' };
    let viewedAuthor = null;

    // Lọc theo tác giả cụ thể (xem trang bài viết của người khác hoặc cá nhân)
    if (authorId && mongoose.Types.ObjectId.isValid(authorId)) {
      filter.authorId = authorId;

      const targetUser = await User.findById(authorId)
        .select('fullName email avatarUrl role createdAt')
        .lean();

      if (targetUser) {
        const authorPosts = await CommunityPost.find({
          authorId,
          status: 'published',
        })
          .select('likeCount likes')
          .lean();

        const authorPostsCount = authorPosts.length;
        const authorTotalLikes = authorPosts.reduce(
          (acc, p) => acc + (p.likeCount || (p.likes ? p.likes.length : 0)),
          0
        );

        viewedAuthor = {
          id: targetUser._id,
          fullName: targetUser.fullName,
          email: targetUser.email,
          avatarUrl: targetUser.avatarUrl,
          role: targetUser.role,
          createdAt: targetUser.createdAt,
          postsCount: authorPostsCount,
          totalLikes: authorTotalLikes,
        };
      }
    } else if ((onlyMine === 'true' || filterParam === 'mine') && req.user?.id) {
      // Lọc bài viết cá nhân của người dùng đăng nhập
      filter.authorId = req.user.id;
    }

    if (tag && tag !== 'Tất cả' && COMMUNITY_TAGS.includes(tag)) {
      filter.tag = tag;
    }

    // UC29: Xử lý tìm kiếm theo từ khóa
    if (search && typeof search === 'string') {
      const trimmedSearch = search.trim();
      // Ngoại lệ 3a / 4a: Thông tin tìm kiếm không hợp lệ nếu vượt quá độ dài cho phép
      if (trimmedSearch.length > 100) {
        return res.status(400).json({ message: 'Thông tin tìm kiếm không hợp lệ' });
      }
      if (trimmedSearch) {
        // Thoát ký tự đặc biệt của regex để truy vấn an toàn
        const safeRegex = trimmedSearch.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        filter.$or = [
          { content: { $regex: safeRegex, $options: 'i' } },
          { tag: { $regex: safeRegex, $options: 'i' } },
        ];
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Xử lý sắp xếp: "latest" (Mới nhất) | "popular" (Thịnh hành / Nhiều tim nhất)
    let sortOrder = { createdAt: -1 };
    if (sortBy === 'popular') {
      sortOrder = { likeCount: -1, createdAt: -1 };
    }

    const [total, posts] = await Promise.all([
      CommunityPost.countDocuments(filter),
      CommunityPost.find(filter)
        .sort(sortOrder)
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

    // Thống kê bài viết cá nhân của người dùng hiện tại (nếu đã đăng nhập)
    let myStats = { postsCount: 0, totalLikes: 0 };
    if (currentUserId) {
      const userPosts = await CommunityPost.find({
        authorId: currentUserId,
        status: 'published',
      })
        .select('likeCount likes')
        .lean();

      const postsCount = userPosts.length;
      const totalLikes = userPosts.reduce(
        (acc, p) => acc + (p.likeCount || (p.likes ? p.likes.length : 0)),
        0
      );
      myStats = { postsCount, totalLikes };
    }

    // 1. Top 3 thành viên tích cực nhất (Top Contributors)
    let topContributors = [];
    try {
      const topContributorsAgg = await CommunityPost.aggregate([
        { $match: { status: 'published' } },
        {
          $group: {
            _id: '$authorId',
            postsCount: { $sum: 1 },
            totalLikes: { $sum: '$likeCount' },
          },
        },
        { $sort: { postsCount: -1, totalLikes: -1 } },
        { $limit: 3 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        {
          $project: {
            _id: 1,
            postsCount: 1,
            totalLikes: 1,
            fullName: '$user.fullName',
            avatarUrl: '$user.avatarUrl',
            role: '$user.role',
          },
        },
      ]);

      topContributors = topContributorsAgg.map((item) => ({
        _id: item._id,
        id: item._id,
        fullName: item.fullName,
        avatarUrl: item.avatarUrl,
        role: item.role,
        postsCount: item.postsCount,
        totalLikes: item.totalLikes,
      }));
    } catch (aggErr) {
      console.warn('[getPosts] Lỗi tính topContributors:', aggErr.message);
    }

    // 2. Món ăn / Bài viết được yêu thích nhất tuần (Trending Recipe of the Week)
    let trendingRecipe = null;
    try {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      trendingRecipe = await CommunityPost.findOne({
        status: 'published',
        tag: 'Công thức món ăn',
        createdAt: { $gte: oneWeekAgo },
      })
        .sort({ likeCount: -1, createdAt: -1 })
        .populate('authorId', 'fullName avatarUrl role')
        .lean();

      if (!trendingRecipe) {
        trendingRecipe = await CommunityPost.findOne({
          status: 'published',
          tag: 'Công thức món ăn',
        })
          .sort({ likeCount: -1, createdAt: -1 })
          .populate('authorId', 'fullName avatarUrl role')
          .lean();
      }

      if (!trendingRecipe) {
        trendingRecipe = await CommunityPost.findOne({
          status: 'published',
        })
          .sort({ likeCount: -1, createdAt: -1 })
          .populate('authorId', 'fullName avatarUrl role')
          .lean();
      }
    } catch (recipeErr) {
      console.warn('[getPosts] Lỗi lấy trendingRecipe:', recipeErr.message);
    }

    return res.status(200).json({
      posts: enrichedPosts,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      hasMore: skip + posts.length < total,
      availableTags: ['Tất cả', ...COMMUNITY_TAGS],
      myStats,
      viewedAuthor,
      topContributors,
      trendingRecipe,
      sortBy,
    });
  } catch (error) {
    console.error('[getPosts] Lỗi lấy danh sách bài viết:', error);
    // UC29 Ngoại lệ 4c / 5c: Lỗi hệ thống khi truy vấn dữ liệu
    return res.status(500).json({
      message: 'Không thể tải kết quả, vui lòng thử lại',
    });
  }
}

/**
 * UC28: Thích/Bỏ thích bài đăng
 * POST /api/community/posts/:id/like
 */
async function toggleLike(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const post = await CommunityPost.findById(id);
    // UC28 Ngoại lệ 2a / 3a: Bài đăng không còn tồn tại
    if (!post || post.status !== 'published') {
      return res.status(404).json({ message: 'Bài đăng không còn tồn tại' });
    }

    const userLikedIndex = post.likes.findIndex((uid) => String(uid) === String(userId));
    let isLiked = false;

    if (userLikedIndex > -1) {
      // UC28 Luồng thay thế 1a - 4a: Bỏ thích bài đăng
      post.likes.splice(userLikedIndex, 1);
      isLiked = false;
    } else {
      // UC28 Luồng chính 3 - 5: Ghi nhận lượt thích
      post.likes.push(userId);
      isLiked = true;
    }

    post.likeCount = post.likes.length;
    await post.save();

    return res.status(200).json({
      isLiked,
      likeCount: post.likeCount,
      message: isLiked ? 'Đã thích bài đăng' : 'Đã bỏ thích bài đăng',
    });
  } catch (error) {
    console.error('[toggleLike] Lỗi:', error);
    // UC28 Ngoại lệ 3b / 4b: Không thể cập nhật trạng thái thích do lỗi hệ thống
    return res.status(500).json({ message: 'Không thể cập nhật trạng thái thích, vui lòng thử lại' });
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
 * Chỉnh sửa bài viết
 * PUT /api/community/posts/:id
 */
async function updatePost(req, res) {
  try {
    const { id } = req.params;
    let { content, tag, imageUrl, removeImage } = req.body || {};

    const post = await CommunityPost.findById(id);
    if (!post || post.status === 'deleted') {
      return res.status(404).json({ message: 'Bài viết không còn tồn tại' });
    }

    const isAuthor = String(post.authorId) === String(req.user.id);
    const isAdmin = req.user.role === 'admin';

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ message: 'Bạn không có quyền chỉnh sửa bài viết này' });
    }

    // 1. Kiểm tra nội dung bài viết
    content = String(content || '').trim();
    if (!content) {
      return res.status(400).json({ message: 'Nội dung bài viết không được để trống' });
    }

    // 2. Kiểm tra tag / chủ đề
    tag = String(tag || '').trim();
    if (!tag || !COMMUNITY_TAGS.includes(tag)) {
      tag = post.tag || 'Chia sẻ chung';
    }

    post.content = content;
    post.tag = tag;

    // 3. Xử lý ảnh minh họa
    if (removeImage === 'true' || removeImage === true) {
      post.imageUrl = null;
    } else if (req.file) {
      const file = req.file;
      const isAllowedMime = ALLOWED_MIME_TYPES.includes(file.mimetype) || file.mimetype?.startsWith('image/');
      const ext = path.extname(file.originalname || '').toLowerCase();
      const isAllowedExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.jfif', '.bmp'].includes(ext);

      if (!isAllowedMime && !isAllowedExt) {
        return res.status(400).json({ message: 'Hình ảnh không hợp lệ' });
      }

      if (file.size > MAX_IMAGE_SIZE_BYTES) {
        return res.status(400).json({ message: 'Hình ảnh không hợp lệ. Dung lượng ảnh vượt quá 5MB.' });
      }

      if (isCloudinaryConfigured()) {
        const uploadResult = await uploadFileToCloudinary(file, 'community_posts');
        post.imageUrl = uploadResult.secure_url;
      } else {
        post.imageUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
      }
    } else if (imageUrl && typeof imageUrl === 'string') {
      const trimmedUrl = imageUrl.trim();
      if (trimmedUrl.startsWith('data:image/') || /^https?:\/\//i.test(trimmedUrl)) {
        post.imageUrl = trimmedUrl;
      }
    }

    // 4. Xử lý thông số dinh dưỡng (nếu người dùng có chỉnh sửa)
    if (req.body.nutrition !== undefined || req.body.calories !== undefined) {
      post.nutrition = parseNutritionData(req.body);
    }

    post.isEdited = true;
    post.editedAt = new Date();
    await post.save();

    const populatedPost = await CommunityPost.findById(post._id)
      .populate('authorId', 'fullName email avatarUrl role')
      .populate('comments.authorId', 'fullName email avatarUrl role')
      .lean();

    const currentUserId = req.user?.id ? String(req.user.id) : null;
    const isLiked = currentUserId
      ? (populatedPost.likes || []).some((uid) => String(uid) === currentUserId)
      : false;

    return res.status(200).json({
      message: 'Cập nhật bài viết thành công',
      post: {
        ...populatedPost,
        isLiked,
        likeCount: populatedPost.likes ? populatedPost.likes.length : 0,
        commentCount: populatedPost.comments ? populatedPost.comments.length : 0,
      },
    });
  } catch (error) {
    console.error('[updatePost] Lỗi:', error);
    return res.status(500).json({ message: 'Không thể cập nhật bài viết, vui lòng thử lại' });
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

/**
 * Lấy danh sách gợi ý thành viên & thẻ tag khi người dùng gõ @ trong bài viết
 * GET /api/community/mention-suggestions?q=...
 */
async function getMentionSuggestions(req, res) {
  try {
    const { q = '' } = req.query;
    const queryStr = String(q || '').trim();

    // 1. Tìm kiếm User (active)
    let userFilter = { status: { $ne: 'locked' } };
    if (queryStr) {
      const safeRegex = queryStr.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      userFilter.$or = [
        { fullName: { $regex: safeRegex, $options: 'i' } },
        { email: { $regex: safeRegex, $options: 'i' } },
      ];
    }

    const users = await User.find(userFilter)
      .select('fullName email avatarUrl role')
      .sort({ role: -1, createdAt: -1 })
      .limit(15)
      .lean();

    // 2. Tìm kiếm chủ đề / Tag cộng đồng phù hợp
    const matchedTags = COMMUNITY_TAGS.filter((tag) => {
      if (tag === 'Tất cả') return false;
      if (!queryStr) return true;
      return tag.toLowerCase().includes(queryStr.toLowerCase());
    });

    return res.status(200).json({
      users: users.map((u) => ({
        id: u._id,
        fullName: u.fullName,
        email: u.email,
        avatarUrl: u.avatarUrl,
        role: u.role,
      })),
      tags: matchedTags,
    });
  } catch (error) {
    console.error('[getMentionSuggestions] Lỗi:', error);
    return res.status(500).json({ message: 'Không thể lấy danh sách gợi ý' });
  }
}

module.exports = {
  createPost,
  getPosts,
  getMentionSuggestions,
  toggleLike,
  addComment,
  updateComment,
  deleteComment,
  updatePost,
  deletePost,
};
