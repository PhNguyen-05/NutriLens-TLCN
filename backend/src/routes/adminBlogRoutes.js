const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const requireAuth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const {
  listBlogPosts,
  getBlogPost,
  createBlogPost,
  updateBlogPost,
  updateBlogPostStatus,
  bulkUpdateBlogPostStatus,
  deleteBlogPost,
} = require('../controllers/adminBlogController');

const router = express.Router();
const blogUploadDirectory = path.join(__dirname, '../../uploads/blog');
fs.mkdirSync(blogUploadDirectory, { recursive: true });

const blogImageUpload = multer({
  storage: multer.diskStorage({
    destination: blogUploadDirectory,
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `blog-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${extension}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = new Set(['image/jpeg', 'image/png']);
    const allowedExtensions = new Set(['.jpg', '.jpeg', '.png']);
    const extension = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.has(file.mimetype) && allowedExtensions.has(extension)) return callback(null, true);
    return callback(new Error('Ảnh minh họa chỉ chấp nhận định dạng JPG hoặc PNG'));
  },
});

router.use(requireAuth, authorize('admin'));

router.post('/upload-image', (req, res) => {
  blogImageUpload.single('image')(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        message: error.code === 'LIMIT_FILE_SIZE' ? 'Ảnh minh họa không được vượt quá 5 MB' : error.message,
      });
    }
    if (!req.file) return res.status(400).json({ message: 'Vui lòng chọn ảnh minh họa' });
    return res.status(200).json({ imageUrl: `/uploads/blog/${req.file.filename}` });
  });
});

router.get('/', listBlogPosts);
router.post('/', createBlogPost);
router.patch('/bulk-status', bulkUpdateBlogPostStatus);
router.get('/:id', getBlogPost);
router.put('/:id', updateBlogPost);
router.patch('/:id/status', updateBlogPostStatus);
router.delete('/:id', deleteBlogPost);

module.exports = router;
