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
const fs = require('fs');
const multer  = require('multer');
const path = require('path');
const requireAuth = require('../middleware/auth');
const {
  searchFoods,
  createFoodRequest,
  getFoodRequests,
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

const requestImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(__dirname, '../../uploads/food-requests');
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
      const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, safeName);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error('Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP'), { statusCode: 415 }));
    }
  },
});

// POST /api/food/scan — không cần đăng nhập (cho phép dùng thử)
// Nếu muốn yêu cầu đăng nhập: thêm requireAuth trước upload.single
router.get('/search', searchFoods);
router.post('/scan', upload.single('file'), scanFood);

// Các route nhật ký yêu cầu đăng nhập
router.get('/requests',        requireAuth, getFoodRequests);
router.post('/requests',       requireAuth, requestImageUpload.single('image'), createFoodRequest);
router.post('/meal-logs',      requireAuth, addMealLog);
router.get('/meal-logs',       requireAuth, getMealLogs);
router.delete('/meal-logs/:id', requireAuth, deleteMealLog);

module.exports = router;
