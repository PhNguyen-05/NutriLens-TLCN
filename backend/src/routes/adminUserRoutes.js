const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const {
  listUsers,
  getUserDetail,
  updateUserStatus,
  listActionLogs,
} = require('../controllers/adminUserController');
const requireAuth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = express.Router();
const evidenceDirectory = path.join(__dirname, '../../uploads/unlock-evidence');
fs.mkdirSync(evidenceDirectory, { recursive: true });

const evidenceUpload = multer({
  storage: multer.diskStorage({
    destination: evidenceDirectory,
    filename: (req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `${Date.now()}-${require('crypto').randomUUID()}${extension}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, callback) => {
    const allowed = new Set(['image/jpeg', 'image/png', 'application/pdf']);
    callback(allowed.has(file.mimetype) ? null : new Error('Chỉ chấp nhận tệp JPG, PNG hoặc PDF'), allowed.has(file.mimetype));
  },
});

router.use(requireAuth, authorize('admin'));

router.get('/', listUsers);
router.get('/action-logs', listActionLogs);
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
