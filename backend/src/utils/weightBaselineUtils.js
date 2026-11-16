/**
 * Các hàm tiện ích dùng chung cho tính toán mốc cân nặng, múi giờ và giới hạn biến động cân nặng.
 */

const APP_TIMEZONE = 'Asia/Ho_Chi_Minh';
const MAX_DAILY_UPDATES = 5;
const BASELINE_LOCK_DAYS = 14;
const BASELINE_GRACE_PERIOD_HOURS = 24;

function isNumberInRange(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function parseRecordedDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

function getTodayDateString(timeZone = APP_TIMEZONE) {
  return new Date().toLocaleDateString('sv-SE', { timeZone });
}

function getTodayDate(timeZone = APP_TIMEZONE) {
  const [year, month, day] = getTodayDateString(timeZone).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toUtcDateOnly(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date, days) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

function serializeWeightLog(log) {
  if (!log) return null;
  const rawDate = log.loggedAt || log.updatedAt || log.createdAt || log.recordedDate;
  const d = new Date(rawDate);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}:${seconds}`;

  let editHistory = [];
  if (Array.isArray(log.editHistory) && log.editHistory.length > 0) {
    editHistory = log.editHistory.map((item, idx) => {
      const itemDate = new Date(item.loggedAt);
      const itemH = String(itemDate.getHours()).padStart(2, '0');
      const itemM = String(itemDate.getMinutes()).padStart(2, '0');
      const itemS = String(itemDate.getSeconds()).padStart(2, '0');
      return {
        version: idx + 1,
        weightKg: item.weightKg,
        loggedAt: itemDate.toISOString(),
        timeStr: `${itemH}:${itemM}:${itemS}`,
      };
    });
  } else {
    editHistory = [
      {
        version: 1,
        weightKg: log.weightKg,
        loggedAt: d.toISOString(),
        timeStr,
      },
    ];
  }

  const recordedDateIso = log.recordedDate instanceof Date
    ? log.recordedDate.toISOString().slice(0, 10)
    : (typeof log.recordedDate === 'string' ? log.recordedDate.slice(0, 10) : '');

  return {
    id: log._id,
    weightKg: log.weightKg,
    recordedDate: recordedDateIso,
    loggedAt: d.toISOString(),
    timeStr,
    updateCount: log.updateCount || 0,
    editHistory,
    createdAt: log.createdAt,
    updatedAt: log.updatedAt,
  };
}

function computeBaselineLockStatus(profile, latestWeightLog = null) {
  if (!profile || profile.currentWeightKg == null) {
    return {
      isSet: false,
      isLocked: false,
      inGracePeriod: false,
      hoursRemainingInGrace: 0,
      daysElapsed: 0,
      daysRemaining: 0,
      canReviewMilestone: false,
      unlockDate: null,
      baselineWeightKg: null,
      baselineDate: null,
      latestWeightLog: null,
    };
  }

  const now = new Date();
  const baselineUpdatedTime = profile.baselineWeightUpdatedAt || profile.currentWeightRecordedDate || profile.createdAt || now;
  const msSinceUpdate = Math.max(0, now.getTime() - new Date(baselineUpdatedTime).getTime());
  const hoursSinceUpdate = msSinceUpdate / (1000 * 60 * 60);

  const baselineDate = toUtcDateOnly(profile.currentWeightRecordedDate)
    || toUtcDateOnly(profile.createdAt)
    || getTodayDate();
  const todayDate = getTodayDate();
  const msElapsedDays = Math.max(0, todayDate.getTime() - baselineDate.getTime());
  const daysElapsed = Math.floor(msElapsedDays / (1000 * 60 * 60 * 24));

  const inGracePeriod = hoursSinceUpdate <= BASELINE_GRACE_PERIOD_HOURS;
  const hoursRemainingInGrace = inGracePeriod ? Math.max(0, Math.ceil(BASELINE_GRACE_PERIOD_HOURS - hoursSinceUpdate)) : 0;

  const daysRemaining = Math.max(0, BASELINE_LOCK_DAYS - daysElapsed);
  const canReviewMilestone = daysElapsed >= BASELINE_LOCK_DAYS;
  const isLocked = !inGracePeriod && !canReviewMilestone;

  const unlockDate = addUtcDays(baselineDate, BASELINE_LOCK_DAYS).toISOString().slice(0, 10);

  return {
    isSet: true,
    isLocked,
    inGracePeriod,
    hoursRemainingInGrace,
    daysElapsed,
    daysRemaining,
    canReviewMilestone,
    unlockDate,
    baselineWeightKg: profile.currentWeightKg,
    baselineDate: baselineDate.toISOString().slice(0, 10),
    latestWeightLog: latestWeightLog ? serializeWeightLog(latestWeightLog) : null,
  };
}

/**
 * Kiểm tra xem biến động cân nặng có bất khả thi về mặt sinh học không (Chặn cứng).
 * - Trong vòng <= 1 ngày: biến động > 5 kg => Chặn
 * - Trong vòng <= 3 ngày: biến động > 8 kg => Chặn
 * - Trong vòng <= 7 ngày: biến động > 12 kg => Chặn
 */
function checkUnrealisticWeightJump(newWeight, targetDate, neighborLog) {
  if (!neighborLog || !neighborLog.recordedDate || neighborLog.weightKg == null) return null;
  const targetTime = targetDate.getTime();
  const neighborTime = new Date(neighborLog.recordedDate).getTime();
  const daysDiff = Math.abs((targetTime - neighborTime) / (1000 * 60 * 60 * 24));
  const weightDiff = Math.abs(newWeight - Number(neighborLog.weightKg));

  if (daysDiff <= 1.05 && weightDiff > 5) {
    return `Chênh lệch cân nặng không hợp lý (biến động ${weightDiff.toFixed(1)} kg trong vòng 1 ngày, vượt quá giới hạn an toàn 5 kg). Hệ thống từ chối ghi nhận để bảo vệ tính chính xác của dữ liệu. Vui lòng kiểm tra lại số cân.`;
  }
  if (daysDiff <= 3.05 && weightDiff > 8) {
    return `Chênh lệch cân nặng không hợp lý (biến động ${weightDiff.toFixed(1)} kg trong vòng 3 ngày, vượt quá giới hạn 8 kg). Vui lòng kiểm tra lại số cân.`;
  }
  if (daysDiff <= 7.05 && weightDiff > 12) {
    return `Chênh lệch cân nặng không hợp lý (biến động ${weightDiff.toFixed(1)} kg trong vòng 7 ngày, vượt quá giới hạn 12 kg). Vui lòng kiểm tra lại số cân.`;
  }
  return null;
}

module.exports = {
  APP_TIMEZONE,
  MAX_DAILY_UPDATES,
  BASELINE_LOCK_DAYS,
  BASELINE_GRACE_PERIOD_HOURS,
  isNumberInRange,
  parseRecordedDate,
  getTodayDateString,
  getTodayDate,
  toUtcDateOnly,
  addUtcDays,
  serializeWeightLog,
  computeBaselineLockStatus,
  checkUnrealisticWeightJump,
};
