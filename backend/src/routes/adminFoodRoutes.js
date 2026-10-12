/**
 * adminFoodRoutes.js
 * Quản lý danh mục món ăn — chỉ dành cho Admin (2.3.19).
 *
 * Base: /api/admin/foods
 *   GET    /            - Danh sách món ăn (tìm kiếm, lọc, phân trang)
 *   POST   /            - Thêm mới món ăn
 *   PUT    /:id         - Cập nhật thông tin món ăn
 *   PATCH  /:id/status  - Ẩn / Hiển thị lại món ăn
 *   DELETE /:id         - Xóa vĩnh viễn (từ chối nếu đang được tham chiếu)
 */

const express = require('express');
const requireAuth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const {
  listFoods,
  createFood,
  updateFood,
  updateFoodStatus,
  deleteFood,
} = require('../controllers/adminFoodController');

const router = express.Router();

// Tất cả route đều yêu cầu xác thực và quyền admin
router.use(requireAuth, authorize('admin'));

router.get('/',             listFoods);
router.post('/',            createFood);
router.put('/:id',          updateFood);
router.patch('/:id/status', updateFoodStatus);
router.delete('/:id',       deleteFood);

module.exports = router;
