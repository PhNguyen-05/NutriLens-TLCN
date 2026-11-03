/**
 * adminExerciseRoutes.js
 * Quản lý danh mục bài tập — chỉ dành cho Quản trị viên (UC25).
 *
 * Base: /api/admin/exercises
 *   GET    /             - Danh sách bài tập (tìm kiếm, lọc nhóm/cường độ/trạng thái, phân trang)
 *   POST   /             - Thêm mới bài tập vào danh mục
 *   GET    /:id          - Xem chi tiết bài tập (kèm thống kê lượt ghi nhận)
 *   PUT    /:id          - Cập nhật thông tin bài tập
 *   PATCH  /:id/status   - Ẩn / Hiển thị lại bài tập
 *   DELETE /:id          - Xóa vĩnh viễn (từ chối nếu đã có nhật ký người dùng)
 */

const express = require('express');
const requireAuth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const {
  getExerciseAnalytics,
  listExercises,
  getExerciseDetail,
  createExercise,
  updateExercise,
  updateExerciseStatus,
  deleteExercise,
} = require('../controllers/adminExerciseController');

const router = express.Router();

// Tất cả các routes trong admin exercises đều yêu cầu xác thực và quyền Quản trị viên (Admin)
router.use(requireAuth, authorize('admin'));

router.get('/analytics', getExerciseAnalytics);
router.get('/', listExercises);
router.post('/', createExercise);
router.get('/:id', getExerciseDetail);
router.put('/:id', updateExercise);
router.patch('/:id/status', updateExerciseStatus);
router.delete('/:id', deleteExercise);

module.exports = router;
