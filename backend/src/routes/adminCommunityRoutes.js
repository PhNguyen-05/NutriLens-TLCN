const express = require('express');
const requireAuth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const {
  getCommunityDashboardStats,
  getCommunityAnalytics,
  listCommunityPosts,
  updateCommunityPostModeration,
} = require('../controllers/adminCommunityController');

const router = express.Router();

router.use(requireAuth, authorize('admin'));
router.get('/analytics', getCommunityAnalytics);
router.get('/stats', getCommunityDashboardStats);
router.get('/posts', listCommunityPosts);
router.patch('/posts/:id/moderation', updateCommunityPostModeration);

module.exports = router;
