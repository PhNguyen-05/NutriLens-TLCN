const express = require('express');
const multer = require('multer');
const path = require('path');
const requireAuth = require('../middleware/auth');
const { optionalAuth } = require('../middleware/auth');
const {
  createPost,
  getPosts,
  getMentionSuggestions,
  toggleLike,
  addComment,
  updateComment,
  deleteComment,
  updatePost,
  deletePost,
} = require('../controllers/communityController');

const router = express.Router();

// Cấu hình Multer cho việc đính kèm hình ảnh minh họa bài viết
const postImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, callback) => {
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/jfif']);
    const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.jfif', '.bmp']);
    const extension = path.extname(file.originalname || '').toLowerCase();

    if (allowedTypes.has(file.mimetype) || file.mimetype?.startsWith('image/') || allowedExtensions.has(extension)) {
      return callback(null, true);
    }
    return callback(new Error('Hình ảnh không hợp lệ. Vui lòng chọn ảnh định dạng JPG, PNG, WEBP hoặc GIF.'));
  },
});

// Middleware xử lý lỗi từ Multer (Ngoại lệ 4b/5b)
function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'Hình ảnh không hợp lệ' });
    }
    return res.status(400).json({ message: 'Hình ảnh không hợp lệ' });
  }
  if (err) {
    return res.status(400).json({ message: err.message || 'Hình ảnh không hợp lệ' });
  }
  return next();
}

// Routes
// 1. Lấy danh sách bài viết cộng đồng (xem bảng tin)
router.get('/posts', optionalAuth, getPosts);

// 1.1 Gợi ý thành viên và thẻ tag khi gõ @
router.get('/mention-suggestions', optionalAuth, getMentionSuggestions);

// 2. UC26: Đăng bài viết cộng đồng
router.post(
  '/posts',
  requireAuth,
  postImageUpload.single('image'),
  handleUploadError,
  createPost
);

// 3. Tương tác Thích / Bỏ thích
router.post('/posts/:id/like', requireAuth, toggleLike);

// 4. UC27: Bình luận bài viết
router.post('/posts/:id/comments', requireAuth, addComment);
router.put('/posts/:postId/comments/:commentId', requireAuth, updateComment);
router.delete('/posts/:postId/comments/:commentId', requireAuth, deleteComment);

// 5. Chỉnh sửa và Xóa bài viết
router.put(
  '/posts/:id',
  requireAuth,
  postImageUpload.single('image'),
  handleUploadError,
  updatePost
);
router.delete('/posts/:id', requireAuth, deletePost);

module.exports = router;
