const express = require('express');

const {
  listUsers,
  getUserDetail,
  updateUserStatus,
} = require('../controllers/adminUserController');
const requireAuth = require('../middleware/auth');
const authorize = require('../middleware/authorize');

const router = express.Router();

router.use(requireAuth, authorize('admin'));

router.get('/', listUsers);
router.get('/:id', getUserDetail);
router.patch('/:id/status', updateUserStatus);

module.exports = router;
