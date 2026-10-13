/**
 * adminFoodRoutes.js
 * Quản lý danh mục món ăn — chỉ dành cho Admin (2.3.19).
 *
 * Base: /api/admin/foods
 *   GET    /             - Danh sách món ăn (tìm kiếm, lọc, phân trang)
 *   POST   /upload-image - Tải ảnh đại diện món ăn lên server
 *   POST   /             - Thêm mới món ăn
 *   GET    /:id          - Xem chi tiết món ăn (kèm số lượt dùng trong MealLog)
 *   PUT    /:id          - Cập nhật thông tin món ăn
 *   PATCH  /:id/status   - Ẩn / Hiển thị lại món ăn
 *   DELETE /:id          - Xóa vĩnh viễn (từ chối nếu đang được tham chiếu)
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const requireAuth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const {
  listFoods,
  getFoodDetail,
  createFood,
  updateFood,
  updateFoodStatus,
  deleteFood,
} = require('../controllers/adminFoodController');

const router = express.Router();

// Tạo thư mục lưu trữ ảnh món ăn nếu chưa có
const foodUploadDir = path.join(__dirname, '../../uploads/foods');
fs.mkdirSync(foodUploadDir, { recursive: true });

const foodImageUpload = multer({
  storage: multer.diskStorage({
    destination: foodUploadDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const uniqueName = `food-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
      cb(null, uniqueName);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (allowed.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận tệp ảnh JPG, PNG hoặc WEBP'));
    }
  },
});

// Tất cả route đều yêu cầu xác thực và quyền admin
router.use(requireAuth, authorize('admin'));

// Upload ảnh món ăn
router.post('/upload-image', (req, res) => {
  foodImageUpload.single('image')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        message: err.code === 'LIMIT_FILE_SIZE' ? 'Ảnh món ăn không được vượt quá 5 MB' : err.message,
      });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng chọn tệp ảnh để tải lên' });
    }
    const relativeUrl = `/uploads/foods/${req.file.filename}`;
    return res.status(200).json({
      message: 'Tải ảnh lên thành công',
      imageUrl: relativeUrl,
    });
  });
});

router.get('/',             listFoods);
router.post('/',            createFood);
router.get('/:id',          getFoodDetail);
router.put('/:id',          updateFood);
router.patch('/:id/status', updateFoodStatus);
router.delete('/:id',       deleteFood);

module.exports = router;
