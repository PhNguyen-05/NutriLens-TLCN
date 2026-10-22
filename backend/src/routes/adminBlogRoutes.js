const express = require('express');
const path = require('path');
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

const blogImageUpload = multer({
  storage: multer.memoryStorage(),
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

router.post('/upload-image', (req, res, next) => {
  blogImageUpload.single('image')(req, res, async (error) => {
    if (error) {
      return res.status(400).json({
        message: error.code === 'LIMIT_FILE_SIZE' ? 'Ảnh minh họa không được vượt quá 5 MB' : error.message,
      });
    }
    if (!req.file) return res.status(400).json({ message: 'Vui lòng chọn ảnh minh họa' });
    const imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    return res.status(200).json({ imageUrl });
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
