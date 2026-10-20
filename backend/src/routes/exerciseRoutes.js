const express = require('express');
const requireAuth = require('../middleware/auth');
const {
  getExercises,
  calculateCalories,
  getExerciseLogs,
  createExerciseLog,
  updateExerciseLog,
  deleteExerciseLog,
  createCustomExercise,
  deleteCustomExercise,
} = require('../controllers/exerciseController');

const router = express.Router();

// Tất cả các thao tác liên quan đến Exercise đều yêu cầu xác thực người dùng
router.use(requireAuth);

// UC21: Danh mục bài tập & ước tính calories
router.get('/', getExercises);
router.post('/calculate', calculateCalories);
router.post('/custom', createCustomExercise);
router.delete('/custom/:id', deleteCustomExercise);

// UC21 & UC22: Nhật ký bài tập (Thêm, Xem, Sửa, Xóa)
router.get('/logs', getExerciseLogs);
router.post('/logs', createExerciseLog);
router.patch('/logs/:id', updateExerciseLog);
router.delete('/logs/:id', deleteExerciseLog);

module.exports = router;
