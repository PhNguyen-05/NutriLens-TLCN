/**
 * adminFoodRequestRoutes.js
 * Quản lý duyệt yêu cầu bổ sung món ăn của người dùng (Dành cho Admin).
 * Base: /api/admin/food-requests
 */

const express = require('express');
const requireAuth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const {
  listFoodRequests,
  getFoodRequestDetail,
  approveFoodRequest,
  rejectFoodRequest,
} = require('../controllers/adminFoodRequestController');

const router = express.Router();

// Tất cả các route đều yêu cầu xác thực và quyền Quản trị viên
router.use(requireAuth, authorize('admin'));

router.get('/', listFoodRequests);
router.get('/:id', getFoodRequestDetail);
router.post('/:id/approve', approveFoodRequest);
router.post('/:id/reject', rejectFoodRequest);

module.exports = router;
