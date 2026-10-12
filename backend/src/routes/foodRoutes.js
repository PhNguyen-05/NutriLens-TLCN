/**
 * foodRoutes.js
 * Tất cả route liên quan đến nhận diện món ăn và nhật ký bữa ăn (UC13).
 *
 * Base: /api/food
 *   POST   /scan          - Quét ảnh nhận diện món ăn
 *   POST   /meal-logs     - Thêm món vào nhật ký
 *   GET    /meal-logs     - Xem nhật ký theo ngày (?date=YYYY-MM-DD)
 *   DELETE /meal-logs/:id - Xoá 1 dòng nhật ký
 */

const express = require('express');
const multer  = require('multer');
const requireAuth = require('../middleware/auth');
const {
  searchFoods,
  scanFood,
  addMealLog,
  getMealLogs,
  deleteMealLog,
} = require('../controllers/foodScanController');

const router = express.Router();

// Lưu ảnh trong RAM (buffer) — không ghi đĩa ở bước scan
// Giới hạn 5MB khớp với AI service
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error('Chỉ chấp nhận ảnh JPG hoặc PNG'), { statusCode: 415 }));
    }
  },
});

// POST /api/food/scan — không cần đăng nhập (cho phép dùng thử)
// Nếu muốn yêu cầu đăng nhập: thêm requireAuth trước upload.single
router.get('/search', searchFoods);
router.post('/scan', upload.single('file'), scanFood);

// Các route nhật ký yêu cầu đăng nhập
router.post('/meal-logs',      requireAuth, addMealLog);
router.get('/meal-logs',       requireAuth, getMealLogs);
router.delete('/meal-logs/:id', requireAuth, deleteMealLog);

module.exports = router;
