/**
 * adminFoodRoutes.js
 * Quản lý danh mục món ăn — chỉ dành cho Admin (2.3.19).
 *
 * Base: /api/admin/foods
 *   GET    /             - Danh sách món ăn (tìm kiếm, lọc, phân trang)
 *   POST   /upload-image - Nhận ảnh đại diện món ăn trong bộ nhớ để lưu cùng document Food
 *   POST   /             - Thêm mới món ăn
 *   GET    /:id          - Xem chi tiết món ăn (kèm số lượt dùng trong MealLog)
 *   PUT    /:id          - Cập nhật thông tin món ăn
 *   PATCH  /:id/status   - Ẩn / Hiển thị lại món ăn
 *   DELETE /:id          - Xóa vĩnh viễn (từ chối nếu đang được tham chiếu)
 */

const express = require('express');
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
  listFoodGroups,
  createFoodGroup,
  renameFoodGroup,
  deleteFoodGroup,
} = require('../controllers/adminFoodController');

const router = express.Router();

const foodImageUpload = multer({
  storage: multer.memoryStorage(),
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
  foodImageUpload.single('image')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        message: err.code === 'LIMIT_FILE_SIZE' ? 'Ảnh món ăn không được vượt quá 5 MB' : err.message,
      });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Vui lòng chọn tệp ảnh để tải lên' });
    }
    const imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    return res.status(200).json({ message: 'Đã nhận ảnh', imageUrl });
  });
});

router.get('/',             listFoods);
router.post('/',            createFood);

// Quản lý nhóm món ăn (Food Groups)
router.get('/groups',       listFoodGroups);
router.post('/groups',      createFoodGroup);
router.put('/groups/:id',   renameFoodGroup);
router.delete('/groups/:id', deleteFoodGroup);

router.get('/:id',          getFoodDetail);
router.put('/:id',          updateFood);
router.patch('/:id/status', updateFoodStatus);
router.delete('/:id',       deleteFood);

module.exports = router;
