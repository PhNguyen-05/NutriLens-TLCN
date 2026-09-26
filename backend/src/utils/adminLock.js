async function restoreExpiredAdminLock(user) {
  if (
    user.status !== 'locked' ||
    !user.adminLockUntil ||
    user.adminLockUntil > new Date()
  ) {
    return false;
  }

  user.status = 'active';
  user.lockReason = null;
  user.adminLockUntil = null;
  user.adminLockDurationDays = null;
  user.adminLockNote = null;
  user.loginAttempts = 0;
  user.lockUntil = null;
  await user.save();

  return true;
}

module.exports = restoreExpiredAdminLock;