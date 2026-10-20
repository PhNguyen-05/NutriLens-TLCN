const express = require('express');
const requireAuth = require('../middleware/auth');
const {
  listPublishedBlogPosts,
  getPublishedBlogPost,
  incrementPublishedBlogView,
  togglePublishedBlogPostLike,
} = require('../controllers/adminBlogController');

const router = express.Router();
const optionalAuth = requireAuth.optionalAuth;

router.get('/', optionalAuth, listPublishedBlogPosts);
router.post('/:id/view', incrementPublishedBlogView);
router.post('/:id/favorite', optionalAuth, togglePublishedBlogPostLike);
router.get('/:id', optionalAuth, getPublishedBlogPost);

module.exports = router;
