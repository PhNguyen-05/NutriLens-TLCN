/**
 * Dùng sau middleware requireAuth (cần req.user đã được gắn sẵn).
 * Cách dùng: router.get('/admin/users', requireAuth, authorize('admin'), handler)
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Chưa xác thực' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Bạn không có quyền truy cập chức năng này' });
    }

    next();
  };
}

module.exports = authorize;