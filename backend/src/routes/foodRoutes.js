/**
 * foodRoutes.js
 * Tất cả route liên quan đến nhận diện món ăn và nhật ký bữa ăn (UC13).
 *
 * Base: /api/food
 *   POST   /scan          - Quét ảnh nhận diện món ăn
 *   GET    /:id/image     - Tải ảnh món ăn từ document Food trong MongoDB
 *   POST   /meal-logs     - Thêm món vào nhật ký
 *   GET    /meal-logs     - Xem nhật ký theo ngày (?date=YYYY-MM-DD)
 *   DELETE /meal-logs/:id - Xoá 1 dòng nhật ký
 */

const express = require('express');
const multer  = require('multer');
const requireAuth = require('../middleware/auth');
const { getFoodImage } = require('../controllers/foodImageController');
const {
  searchFoods,
  createFoodRequest,
  updateFoodRequest,
  deleteFoodRequest,
  getFoodRequests,
  scanFood,
  addMealLog,
  getMealLogs,
  updateMealLog,
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
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error('Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP'), { statusCode: 415 }));
    }
  },
});

const mealLogImageUpload = multer({
  storage: multer.memoryStorage(),
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
router.get('/:id/image', getFoodImage);
router.post('/scan', upload.single('file'), scanFood);

// Các route nhật ký yêu cầu đăng nhập
router.get('/requests',        requireAuth, getFoodRequests);
router.post('/requests',       requireAuth, requestImageUpload.single('image'), createFoodRequest);
router.patch('/requests/:id',  requireAuth, requestImageUpload.single('image'), updateFoodRequest);
router.delete('/requests/:id', requireAuth, deleteFoodRequest);
router.post('/meal-logs',      requireAuth, mealLogImageUpload.single('image'), addMealLog);
router.get('/meal-logs',       requireAuth, getMealLogs);
router.patch('/meal-logs/:id', requireAuth, updateMealLog);
router.delete('/meal-logs/:id', requireAuth, deleteMealLog);

module.exports = router;
