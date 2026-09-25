const express = require('express');
const path = require('path');
const multer = require('multer');

const requireAuth = require('../middleware/auth');
const { getProfile, saveProfile, updateAvatar, getWeightLogs, saveWeightLog, getNutritionProposal, saveNutritionGoal } = require('../controllers/profileController');

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(__dirname, '../../uploads/avatars'),
    filename: (req, file, callback) => {
      callback(null, `${req.user.id}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, callback) => callback(null, ['image/jpeg', 'image/png'].includes(file.mimetype)),
});

router.use(requireAuth);
router.get('/', getProfile);
router.put('/', saveProfile);
router.get('/weight-logs', getWeightLogs);
router.post('/weight-logs', saveWeightLog);
router.get('/nutrition-goal/proposal', getNutritionProposal);
router.put('/nutrition-goal', saveNutritionGoal);
router.post('/avatar', upload.single('avatar'), updateAvatar);

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'Ảnh đại diện không được vượt quá 3MB' });
  }
  if (err) return res.status(400).json({ message: 'Ảnh đại diện không hợp lệ, vui lòng chọn ảnh JPG hoặc PNG' });
  return next();
});

module.exports = router;
