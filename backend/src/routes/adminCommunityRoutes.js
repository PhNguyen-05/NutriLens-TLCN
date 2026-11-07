const express = require('express');
const requireAuth = require('../middleware/auth');
const authorize = require('../middleware/authorize');
const { listCommunityPosts, updateCommunityPostModeration } = require('../controllers/adminCommunityController');

const router = express.Router();

router.use(requireAuth, authorize('admin'));
router.get('/posts', listCommunityPosts);
router.patch('/posts/:id/moderation', updateCommunityPostModeration);

module.exports = router;
