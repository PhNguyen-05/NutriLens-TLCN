const express = require('express');
const multer = require('multer');

const {
  listUsers,
  getUserDetail,
  updateUserStatus,
  listActionLogs,
  createCommunityModerationActionLog,
} = require('../controllers/adminUserController');
const requireAuth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = express.Router();

const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, callback) => {
    const allowed = new Set(['image/jpeg', 'image/png', 'application/pdf']);
    callback(allowed.has(file.mimetype) ? null : new Error('Chỉ chấp nhận tệp JPG, PNG hoặc PDF'), allowed.has(file.mimetype));
  },
});

router.use(requireAuth, authorize('admin'));

router.get('/', listUsers);
router.get('/action-logs', listActionLogs);
router.post('/action-logs/community', createCommunityModerationActionLog);
router.get('/:id', getUserDetail);
router.patch('/:id/status', (req, res, next) => {
  evidenceUpload.array('evidence', 5)(req, res, (error) => {
    if (error) {
      return res.status(400).json({
        message: error.code === 'LIMIT_FILE_SIZE' ? 'Mỗi tệp minh chứng không được vượt quá 5 MB' : error.message,
      });
    }
    return next();
  });
}, updateUserStatus);

module.exports = router;
