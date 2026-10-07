const mongoose = require('mongoose');
const fs = require('fs/promises');

const User = require('../models/User');
const AdminActionLog = require('../models/AdminActionLog');

const USER_LIST_FIELDS = 'fullName email avatarUrl gender dateOfBirth role status lockReason adminLockUntil adminLockDurationDays authProvider createdAt updatedAt';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildUserQuery({ search, status, authProvider }) {
  const query = {};

  if (status && status !== 'all') {
    query.status = status;
  }

  if (authProvider && authProvider !== 'all') {
    query.authProvider = authProvider;
  }

  if (search) {
    const keyword = search.trim();
    if (keyword) {
      query.$or = [
        { fullName: { $regex: escapeRegex(keyword), $options: 'i' } },
        { email: { $regex: escapeRegex(keyword), $options: 'i' } },
      ];
    }
  }

  return query;
}

function normalizePagination(page, limit) {
  const normalizedPage = Math.max(Number.parseInt(page, 10) || 1, 1);
  const normalizedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 100);

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    skip: (normalizedPage - 1) * normalizedLimit,
  };
}

async function listUsers(req, res) {
  try {
    const { search = '', status = 'all', authProvider = 'all', page, limit } = req.query;

    await User.updateMany(
      { role: 'user', status: 'locked', adminLockUntil: { $ne: null, $lte: new Date() } },
      {
        $set: {
          status: 'active',
          lockReason: null,
          adminLockUntil: null,
          adminLockDurationDays: null,
          adminLockNote: null,
        },
      }
    );

    if (status !== 'all' && !['pending', 'active', 'locked'].includes(status)) {
      return res.status(400).json({ message: 'Trạng thái lọc không hợp lệ' });
    }

    if (authProvider !== 'all' && !['local', 'google'].includes(authProvider)) {
      return res.status(400).json({ message: 'Phương thức xác thực không hợp lệ' });
    }

    const pagination = normalizePagination(page, limit);
    const query = { role: 'user', ...buildUserQuery({ search, status, authProvider }) };

    const [users, total, totalUsers, active, locked] = await Promise.all([
      User.find(query)
        .select(USER_LIST_FIELDS)
        .sort({ createdAt: -1 })
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      User.countDocuments(query),
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ role: 'user', status: 'active' }),
      User.countDocuments({ role: 'user', status: 'locked' }),
    ]);

    return res.status(200).json({
      data: users,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit),
      },
      summary: { total: totalUsers, active, locked },
    });
  } catch (err) {
    console.error('[listUsers] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể tải danh sách người dùng, vui lòng thử lại' });
  }
}

async function getUserDetail(req, res) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Mã người dùng không hợp lệ' });
    }

    const [user, profile] = await Promise.all([
      User.findById(id).select(USER_LIST_FIELDS).lean(),
      require('../models/UserProfile').findOne({ user: id }).lean(),
    ]);

    if (!user) {
      return res.status(404).json({ message: 'Người dùng không còn tồn tại' });
    }

    const detail = {
      ...user,
      ...(profile || {}),
      hasHealthProfile: Boolean(profile),
      targetWeightKg: profile?.targetWeightKg ?? null,
      bmi: profile?.healthMetrics?.bmi ?? null,
      bmr: profile?.healthMetrics?.bmr ?? null,
      tdee: profile?.healthMetrics?.tdee ?? null,
    };

    return res.status(200).json({ data: detail });
  } catch (err) {
    console.error('[getUserDetail] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể tải thông tin chi tiết, vui lòng thử lại' });
  }
}

async function updateUserStatus(req, res) {
  const uploadedEvidence = req.files || [];
  const removeUploadedEvidence = async () => Promise.all(uploadedEvidence.map((file) => fs.unlink(file.path).catch(() => {})));

  try {
    const { id } = req.params;
    const { status, lockReason, lockDurationDays = 0, lockNote, unlockReason } = req.body;
    const adminId = req.user.id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await removeUploadedEvidence();
      return res.status(400).json({ message: 'Mã người dùng không hợp lệ' });
    }

    if (!['active', 'locked'].includes(status)) {
      await removeUploadedEvidence();
      return res.status(400).json({ message: 'Trạng thái cập nhật không hợp lệ' });
    }

    const targetUser = await User.findById(id);

    if (!targetUser) {
      await removeUploadedEvidence();
      return res.status(404).json({ message: 'Người dùng không còn tồn tại' });
    }

    if (targetUser._id.toString() === adminId || targetUser.role === 'admin') {
      await removeUploadedEvidence();
      return res.status(403).json({
        message: 'Không thể khóa/mở khóa tài khoản Quản trị viên',
      });
    }

    if (targetUser.status === status) {
      await removeUploadedEvidence();
      return res.status(409).json({ message: 'Tài khoản đã ở trạng thái này' });
    }

    if (status === 'locked' && !String(lockReason || '').trim()) {
      await removeUploadedEvidence();
      return res.status(400).json({ message: 'Vui lòng nhập lý do khóa tài khoản' });
    }

    if (status === 'locked' && ![0, 7, 14].includes(Number(lockDurationDays))) {
      await removeUploadedEvidence();
      return res.status(400).json({ message: 'Thời hạn khóa tài khoản không hợp lệ' });
    }

    if (status === 'active' && !String(unlockReason || '').trim()) {
      await removeUploadedEvidence();
      return res.status(400).json({ message: 'Vui lòng nhập lý do yêu cầu mở khóa' });
    }

    if (status === 'active' && uploadedEvidence.length === 0) {
      return res.status(400).json({ message: 'Vui lòng đính kèm ít nhất một minh chứng' });
    }

    if (String(unlockReason || '').trim().length > 500) {
      await removeUploadedEvidence();
      return res.status(400).json({ message: 'Lý do mở khóa không được vượt quá 500 ký tự' });
    }

    const action = status === 'locked' ? 'lock_user' : 'unlock_user';

    targetUser.status = status;
    targetUser.lockReason = status === 'locked' ? String(lockReason).trim() : null;
    targetUser.adminLockDurationDays = status === 'locked' ? Number(lockDurationDays) : null;
    targetUser.adminLockUntil = status === 'locked' && Number(lockDurationDays) > 0
      ? new Date(Date.now() + Number(lockDurationDays) * 24 * 60 * 60 * 1000)
      : null;
    targetUser.adminLockNote = status === 'locked' ? String(lockNote || '').trim() || null : null;

    if (status === 'locked') {
      targetUser.refreshTokens = [];
    } else {
      targetUser.loginAttempts = 0;
      targetUser.lockUntil = null;
    }

    await targetUser.save();

    await AdminActionLog.create({
      adminId,
      actionType: action,
      targetType: 'User',
      targetId: targetUser._id,
      reason: status === 'locked' ? targetUser.lockReason : String(unlockReason || '').trim(),
      durationDays: status === 'locked' ? Number(lockDurationDays) : null,
      note: status === 'locked' ? targetUser.adminLockNote : null,
      evidence: status === 'active' ? uploadedEvidence.map((file) => ({
        url: `/uploads/unlock-evidence/${file.filename}`,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      })) : [],
    });

    const safeUser = await User.findById(targetUser._id).select(USER_LIST_FIELDS).lean();

    return res.status(200).json({
      message: 'Thao tác thành công',
      data: safeUser,
    });
  } catch (err) {
    await removeUploadedEvidence();
    console.error('[updateUserStatus] Lỗi:', err.message);
    return res.status(500).json({ message: 'Thao tác thất bại, vui lòng thử lại' });
  }
}

async function listActionLogs(req, res) {
  try {
    const { from = '', to = '', action = 'all', adminId = 'all', search = '', page, limit } = req.query;
    const pagination = normalizePagination(page, limit || 7);
    const query = {};
    const validActions = ['lock_user', 'unlock_user', 'approve_post', 'delete_food', 'hide_post', 'remove_post', 'reject_request'];

    if (action !== 'all') {
      if (!validActions.includes(action)) return res.status(400).json({ message: 'Loại hành động không hợp lệ' });
      query.actionType = action;
    }
    if (adminId !== 'all') {
      if (!mongoose.Types.ObjectId.isValid(adminId)) return res.status(400).json({ message: 'Người thực hiện không hợp lệ' });
      query.adminId = adminId;
    }
    if (from || to) {
      query.createdAt = {};
      if (from) {
        const start = new Date(`${from}T00:00:00.000Z`);
        if (Number.isNaN(start.getTime())) return res.status(400).json({ message: 'Ngày bắt đầu không hợp lệ' });
        query.createdAt.$gte = start;
      }
      if (to) {
        const end = new Date(`${to}T23:59:59.999Z`);
        if (Number.isNaN(end.getTime())) return res.status(400).json({ message: 'Ngày kết thúc không hợp lệ' });
        query.createdAt.$lte = end;
      }
    }

    const keyword = String(search).trim();
    if (keyword) {
      const pattern = { $regex: escapeRegex(keyword), $options: 'i' };
      const matchingUsers = await User.find({ $or: [{ fullName: pattern }, { email: pattern }] }).select('_id').lean();
      const matchingIds = matchingUsers.map((user) => user._id);
      query.$or = [
        { reason: pattern },
        { note: pattern },
        { adminId: { $in: matchingIds } },
        { targetId: { $in: matchingIds } },
      ];
    }

    const [logs, total, admins] = await Promise.all([
      AdminActionLog.find(query).sort({ createdAt: -1 }).skip(pagination.skip).limit(pagination.limit).lean(),
      AdminActionLog.countDocuments(query),
      User.find({ role: 'admin' }).select('fullName email avatarUrl').sort({ fullName: 1 }).lean(),
    ]);

    const relatedIds = [...new Set(logs.flatMap((log) => [String(log.adminId), String(log.targetId)]))];
    const relatedUsers = await User.find({ _id: { $in: relatedIds } }).select('fullName email avatarUrl role').lean();
    const usersById = new Map(relatedUsers.map((user) => [String(user._id), user]));

    return res.status(200).json({
      data: logs.map((log) => ({
        ...log,
        admin: usersById.get(String(log.adminId)) || null,
        target: log.targetType === 'User' ? usersById.get(String(log.targetId)) || null : null,
      })),
      admins,
      pagination: { page: pagination.page, limit: pagination.limit, total, totalPages: Math.ceil(total / pagination.limit) },
    });
  } catch (err) {
    console.error('[listActionLogs] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể tải lịch sử thao tác, vui lòng thử lại' });
  }
}

module.exports = {
  listUsers,
  getUserDetail,
  updateUserStatus,
  listActionLogs,
};
