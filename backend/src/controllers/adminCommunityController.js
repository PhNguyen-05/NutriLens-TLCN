const mongoose = require('mongoose');
const User = require('../models/User');
const { CommunityPost } = require('../models/CommunityPost');
const { PostReport } = require('../models/PostReport');
const Notification = require('../models/Notification');

const VISIBLE_STATUSES = ['published', 'hidden'];
const PAGE_SIZE = 10;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildPostFilter(filter, pendingPostIds, searchConditions) {
  const conditions = [{ status: { $in: VISIBLE_STATUSES } }];

  if (filter === 'displaying') {
    conditions.push({ status: 'published' }, { _id: { $nin: pendingPostIds } });
  } else if (filter === 'reported') {
    conditions.push({ _id: { $in: pendingPostIds } });
  } else if (filter === 'hidden') {
    conditions.push({ status: 'hidden' }, { _id: { $nin: pendingPostIds } });
  }

  if (searchConditions) conditions.push(searchConditions);
  return conditions.length === 1 ? conditions[0] : { $and: conditions };
}

async function listCommunityPosts(req, res) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || PAGE_SIZE));
    const filter = ['displaying', 'reported', 'hidden'].includes(req.query.filter) ? req.query.filter : 'all';
    const sortBy = ['oldest', 'reports'].includes(req.query.sortBy) ? req.query.sortBy : 'newest';
    const search = String(req.query.search || '').trim();

    if (search.length > 100) {
      return res.status(400).json({ message: 'Từ khóa tìm kiếm không được vượt quá 100 ký tự' });
    }

    const pendingPostIds = await PostReport.distinct('postId', { status: 'pending' });
    const [publishedTotal, hiddenTotal, pendingPosts] = await Promise.all([
      CommunityPost.countDocuments({ status: 'published' }),
      CommunityPost.countDocuments({ status: 'hidden' }),
      pendingPostIds.length
        ? CommunityPost.find({ _id: { $in: pendingPostIds }, status: { $in: VISIBLE_STATUSES } }).select('_id status').lean()
        : [],
    ]);

    const pendingPublished = pendingPosts.filter((post) => post.status === 'published').length;
    const pendingHidden = pendingPosts.filter((post) => post.status === 'hidden').length;
    const counts = {
      all: publishedTotal + hiddenTotal,
      displaying: Math.max(0, publishedTotal - pendingPublished),
      reported: pendingPosts.length,
      hidden: Math.max(0, hiddenTotal - pendingHidden),
    };

    let searchConditions = null;
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      const [matchingAuthors, matchingReports] = await Promise.all([
        User.find({ $or: [{ fullName: regex }, { email: regex }] }).select('_id').lean(),
        PostReport.distinct('postId', { $or: [{ reason: regex }, { note: regex }] }),
      ]);
      searchConditions = {
        $or: [
          { content: regex },
          { tag: regex },
          { authorId: { $in: matchingAuthors.map((author) => author._id) } },
          { _id: { $in: matchingReports } },
        ],
      };
    }

    const postFilter = buildPostFilter(filter, pendingPostIds, searchConditions);
    const skip = (page - 1) * limit;
    let total;
    let posts;
    const fields = 'content imageUrl tag status nutrition likeCount commentCount createdAt authorId';

    if (sortBy === 'reports') {
      const candidates = await CommunityPost.find(postFilter).select('_id createdAt').lean();
      total = candidates.length;

      const candidateIds = candidates.map((post) => post._id);
      const reportCounts = candidateIds.length
        ? await PostReport.aggregate([
            { $match: { postId: { $in: candidateIds } } },
            { $group: { _id: '$postId', count: { $sum: 1 } } },
          ])
        : [];
      const countByPostId = new Map(reportCounts.map((item) => [String(item._id), item.count]));
      candidates.sort((left, right) => (
        (countByPostId.get(String(right._id)) || 0) - (countByPostId.get(String(left._id)) || 0)
        || new Date(right.createdAt) - new Date(left.createdAt)
      ));

      const pageIds = candidates.slice(skip, skip + limit).map((post) => post._id);
      const pagePosts = pageIds.length
        ? await CommunityPost.find({ _id: { $in: pageIds } })
            .select(fields)
            .populate('authorId', 'fullName email avatarUrl role')
            .lean()
        : [];
      const postById = new Map(pagePosts.map((post) => [String(post._id), post]));
      posts = pageIds.map((id) => postById.get(String(id))).filter(Boolean);
    } else {
      const sortOrder = sortBy === 'oldest' ? { createdAt: 1 } : { createdAt: -1 };
      [total, posts] = await Promise.all([
        CommunityPost.countDocuments(postFilter),
        CommunityPost.find(postFilter)
          .select(fields)
          .sort(sortOrder)
          .skip(skip)
          .limit(limit)
          .populate('authorId', 'fullName email avatarUrl role')
          .lean(),
      ]);
    }

    const pagePostIds = posts.map((post) => post._id);
    const reports = pagePostIds.length
      ? await PostReport.find({ postId: { $in: pagePostIds }, status: 'pending' })
          .select('postId reporterId reason note evidenceImageUrl createdAt')
          .populate('reporterId', 'fullName email avatarUrl')
          .sort({ createdAt: -1 })
          .lean()
      : [];
    const reportsByPostId = new Map();
    for (const report of reports) {
      const postId = String(report.postId);
      if (!reportsByPostId.has(postId)) reportsByPostId.set(postId, []);
      reportsByPostId.get(postId).push(report);
    }

    const data = posts.map((post) => {
      const reportDetails = reportsByPostId.get(String(post._id)) || [];
      return {
        ...post,
        _id: String(post._id),
        likeCount: Number(post.likeCount || 0),
        commentCount: Number(post.commentCount || 0),
        pendingReportCount: reportDetails.length,
        reportDetails: reportDetails.map((report) => ({
          reporter: report.reporterId?.fullName || 'Người dùng',
          reporterAvatarUrl: report.reporterId?.avatarUrl || null,
          reason: report.reason,
          note: report.note || '',
          evidenceImageUrl: report.evidenceImageUrl || null,
          reportedAt: report.createdAt,
        })),
      };
    });

    return res.status(200).json({
      data,
      counts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error('[listCommunityPosts] Lỗi:', error.message);
    return res.status(500).json({ message: 'Không thể tải danh sách bài đăng Community' });
  }
}

async function updateCommunityPostModeration(req, res) {
  try {
    const { id } = req.params;
    const action = String(req.body?.action || '');
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Mã bài đăng Community không hợp lệ' });
    }
    if (!['keep', 'hide', 'restore'].includes(action)) {
      return res.status(400).json({ message: 'Hành động kiểm duyệt không hợp lệ' });
    }

    const post = await CommunityPost.findById(id);
    if (!post || post.status === 'deleted') {
      return res.status(404).json({ message: 'Bài đăng không còn tồn tại' });
    }

    post.status = action === 'hide' ? 'hidden' : 'published';
    await post.save();

    await PostReport.updateMany(
      { postId: post._id, status: 'pending' },
      { $set: { status: action === 'keep' ? 'dismissed' : 'reviewed' } },
    );

    if (action === 'hide' && post.authorId) {
      await Notification.create({
        userId: post.authorId,
        title: 'Bài viết cộng đồng đã bị ẩn',
        message: 'Bài viết của bạn đã bị ẩn do vi phạm tiêu chuẩn cộng đồng hoặc có báo cáo hợp lệ.',
        type: 'community',
        data: { postId: post._id, link: '/community' },
      }).catch((err) => console.error('[Notification error]:', err.message));
    } else if (action === 'restore' && post.authorId) {
      await Notification.create({
        userId: post.authorId,
        title: 'Bài viết đã được khôi phục',
        message: 'Bài viết của bạn đã được kiểm duyệt an toàn và đã hiển thị lại trên Cộng đồng.',
        type: 'community',
        data: { postId: post._id, link: '/community' },
      }).catch((err) => console.error('[Notification error]:', err.message));
    }

    return res.status(200).json({
      data: {
        postId: String(post._id),
        status: post.status,
        action,
      },
    });
  } catch (error) {
    console.error('[updateCommunityPostModeration] Lỗi:', error.message);
    return res.status(500).json({ message: 'Không thể cập nhật trạng thái bài đăng Community' });
  }
}

module.exports = { listCommunityPosts, updateCommunityPostModeration };
