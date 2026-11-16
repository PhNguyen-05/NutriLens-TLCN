const UserProfile = require('../models/UserProfile');
const User = require('../models/User');
const WeightLog = require('../models/WeightLog');
const { calculateHealthMetrics, calcSafeCalorieTarget } = require('../utils/healthMetrics');
const {
  isNumberInRange,
  parseRecordedDate,
  getTodayDate,
  toUtcDateOnly,
  serializeWeightLog,
  computeBaselineLockStatus,
  checkUnrealisticWeightJump,
  MAX_DAILY_UPDATES,
} = require('../utils/weightBaselineUtils');
const { buildNutritionGoal, calculateNutritionProposal } = require('../utils/nutritionGoalUtils');

/**
 * GET /api/profile/weight-logs
 * Lấy toàn bộ lịch sử cân nặng của người dùng và trạng thái bảo lưu mốc 14 ngày
 */
async function getWeightLogs(req, res) {
  try {
    const [logs, profile] = await Promise.all([
      WeightLog.find({ user: req.user.id }).sort({ recordedDate: 1 }).lean(),
      UserProfile.findOne({ user: req.user.id }).lean(),
    ]);
    const latestLog = logs.length ? logs[logs.length - 1] : null;
    const baselineStatus = computeBaselineLockStatus(profile, latestLog);
    return res.status(200).json({
      weightLogs: logs.map(serializeWeightLog),
      baselineStatus,
    });
  } catch (err) {
    console.error('[getWeightLogs] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể tải lịch sử cân nặng' });
  }
}

/**
 * POST /api/profile/weight-logs
 * Ghi nhận số cân nặng hàng ngày. Tối đa 5 lần/ngày, hỗ trợ ghi đè (overwrite).
 */
async function saveWeightLog(req, res) {
  try {
    const weightKg = Number(req.body.weightKg);
    if (!isNumberInRange(weightKg, 20, 300)) {
      return res.status(400).json({ code: 'INVALID_WEIGHT', message: 'Vui lòng nhập cân nặng hợp lệ (20–300 kg)' });
    }

    const recordedDate = parseRecordedDate(req.body.recordedDate);
    if (!recordedDate) return res.status(400).json({ message: 'Ngày ghi nhận không hợp lệ' });
    if (recordedDate > getTodayDate()) {
      return res.status(400).json({ code: 'FUTURE_DATE', message: 'Không thể ghi nhận cân nặng cho ngày trong tương lai' });
    }

    const profile = await UserProfile.findOne({ user: req.user.id });
    if (!profile) return res.status(404).json({ message: 'Vui lòng hoàn tất hồ sơ sức khỏe trước khi ghi nhận cân nặng' });

    const existingLog = await WeightLog.findOne({ user: req.user.id, recordedDate });
    if (existingLog) {
      const curCount = existingLog.updateCount || 0;
      if (curCount >= MAX_DAILY_UPDATES) {
        return res.status(429).json({
          code: 'DAILY_UPDATE_LIMIT_EXCEEDED',
          message: `Bạn đã đạt giới hạn tối đa ${MAX_DAILY_UPDATES} lần cập nhật cân nặng trong ngày này. Vui lòng quay lại vào ngày mai để ghi nhận tiếp.`,
          maxUpdates: MAX_DAILY_UPDATES,
          currentUpdateCount: curCount,
        });
      }
      if (!req.body.overwrite) {
        return res.status(409).json({
          code: 'WEIGHT_LOG_EXISTS',
          message: `Bạn đã ghi nhận cân nặng cho ngày này (đã cập nhật ${curCount}/${MAX_DAILY_UPDATES} lần). Bạn có muốn cập nhật lại giá trị này?`,
          currentUpdateCount: curCount,
          remainingUpdates: Math.max(0, MAX_DAILY_UPDATES - curCount),
          maxUpdates: MAX_DAILY_UPDATES,
        });
      }
    }

    // Chặn cứng: Kiểm tra biến động cân nặng so với các bản ghi lân cận
    const prevLog = await WeightLog.findOne({
      user: req.user.id,
      recordedDate: { $lt: recordedDate },
    }).sort({ recordedDate: -1 }).lean();

    const nextLog = await WeightLog.findOne({
      user: req.user.id,
      recordedDate: { $gt: recordedDate },
    }).sort({ recordedDate: 1 }).lean();

    const jumpErrorPrev = checkUnrealisticWeightJump(weightKg, recordedDate, prevLog);
    if (jumpErrorPrev) {
      return res.status(400).json({ code: 'UNREALISTIC_WEIGHT_CHANGE', message: jumpErrorPrev });
    }

    const jumpErrorNext = checkUnrealisticWeightJump(weightKg, recordedDate, nextLog);
    if (jumpErrorNext) {
      return res.status(400).json({ code: 'UNREALISTIC_WEIGHT_CHANGE', message: jumpErrorNext });
    }

    // Nếu chưa có nhật ký nào trước/sau, kiểm tra so với mốc ban đầu trong hồ sơ
    if (!prevLog && !nextLog && profile.currentWeightKg != null) {
      const baselineDate = toUtcDateOnly(profile.currentWeightRecordedDate)
        || toUtcDateOnly(profile.createdAt)
        || getTodayDate();
      const jumpErrorBaseline = checkUnrealisticWeightJump(weightKg, recordedDate, {
        recordedDate: baselineDate,
        weightKg: profile.currentWeightKg,
      });
      if (jumpErrorBaseline) {
        return res.status(400).json({ code: 'UNREALISTIC_WEIGHT_CHANGE', message: jumpErrorBaseline });
      }
    }

    const now = new Date();
    let log;
    if (existingLog) {
      const history = Array.isArray(existingLog.editHistory) && existingLog.editHistory.length > 0
        ? [...existingLog.editHistory]
        : [{ weightKg: existingLog.weightKg, loggedAt: existingLog.loggedAt || existingLog.createdAt || now }];
      history.push({ weightKg, loggedAt: now });

      log = await WeightLog.findByIdAndUpdate(
        existingLog._id,
        {
          $set: {
            weightKg,
            loggedAt: now,
            updateCount: (existingLog.updateCount || 0) + 1,
            editHistory: history,
          },
        },
        { new: true, runValidators: true }
      );
    } else {
      log = await WeightLog.create({
        user: req.user.id,
        weightKg,
        recordedDate,
        loggedAt: now,
        updateCount: 0,
        editHistory: [{ weightKg, loggedAt: now }],
      });
    }

    const baselineStatus = computeBaselineLockStatus(profile, log);

    return res.status(existingLog ? 200 : 201).json({
      message: existingLog ? 'Cập nhật bản ghi cân nặng thành công' : 'Đã ghi nhận cân nặng thành công',
      weightLog: serializeWeightLog(log),
      profile: profile.toObject ? profile.toObject() : profile,
      weightProfileUpdated: false,
      canReviewMilestone: baselineStatus.canReviewMilestone,
      baselineStatus,
      remainingUpdates: Math.max(0, MAX_DAILY_UPDATES - (log.updateCount || 0)),
      maxUpdates: MAX_DAILY_UPDATES,
    });
  } catch (err) {
    if (err?.code === 11000) {
      if (req.body.overwrite) {
        try {
          const recordedDate = parseRecordedDate(req.body.recordedDate);
          const weightKg = Number(req.body.weightKg);
          const existing = await WeightLog.findOne({ user: req.user.id, recordedDate });
          if (existing) {
            const now = new Date();
            const history = Array.isArray(existing.editHistory) && existing.editHistory.length > 0
              ? [...existing.editHistory]
              : [{ weightKg: existing.weightKg, loggedAt: existing.loggedAt || existing.createdAt || now }];
            history.push({ weightKg, loggedAt: now });
            const updated = await WeightLog.findByIdAndUpdate(
              existing._id,
              { $set: { weightKg, loggedAt: now, updateCount: (existing.updateCount || 0) + 1, editHistory: history } },
              { new: true, runValidators: true }
            );
            const baselineStatus = computeBaselineLockStatus(profile, updated);
            return res.status(200).json({
              message: 'Cập nhật bản ghi cân nặng thành công',
              weightLog: serializeWeightLog(updated),
              profile: profile.toObject ? profile.toObject() : profile,
              weightProfileUpdated: false,
              canReviewMilestone: baselineStatus.canReviewMilestone,
              baselineStatus,
              remainingUpdates: Math.max(0, MAX_DAILY_UPDATES - (updated.updateCount || 0)),
              maxUpdates: MAX_DAILY_UPDATES,
            });
          }
        } catch (retryErr) {
          console.error('[saveWeightLog retry] Lỗi:', retryErr.message);
        }
      }
      return res.status(409).json({ code: 'WEIGHT_LOG_EXISTS', message: 'Bạn đã ghi nhận cân nặng cho ngày này, bạn có muốn cập nhật lại giá trị này?' });
    }
    console.error('[saveWeightLog] Lỗi:', err.message);
    return res.status(500).json({ message: 'Ghi nhận cân nặng thất bại, vui lòng thử lại' });
  }
}

/**
 * DELETE /api/profile/weight-logs/:id
 * Xóa một bản ghi cân nặng theo ID
 */
async function deleteWeightLog(req, res) {
  try {
    const log = await WeightLog.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!log) {
      return res.status(404).json({ message: 'Không tìm thấy bản ghi cân nặng cần xóa' });
    }

    const profile = await UserProfile.findOne({ user: req.user.id });
    const latestLog = await WeightLog.findOne({ user: req.user.id }).sort({ recordedDate: -1, loggedAt: -1 }).lean();
    const baselineStatus = computeBaselineLockStatus(profile, latestLog);
    let updatedProfile = profile ? (profile.toObject ? profile.toObject() : profile) : null;

    return res.status(200).json({
      message: 'Đã xóa bản ghi cân nặng thành công',
      deletedId: req.params.id,
      profile: updatedProfile,
      baselineStatus,
    });
  } catch (err) {
    console.error('[deleteWeightLog] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể xóa bản ghi cân nặng' });
  }
}

/**
 * POST /api/profile/apply-milestone-weight
 * Áp dụng mốc cân nặng mới sau chu kỳ 14 ngày
 */
async function applyMilestoneWeight(req, res) {
  try {
    const profile = await UserProfile.findOne({ user: req.user.id });
    if (!profile) {
      return res.status(404).json({ message: 'Không tìm thấy hồ sơ sức khỏe' });
    }

    const latestLog = await WeightLog.findOne({ user: req.user.id }).sort({ recordedDate: -1, loggedAt: -1 }).lean();
    const lockStatus = computeBaselineLockStatus(profile, latestLog);

    if (!lockStatus.canReviewMilestone) {
      return res.status(400).json({
        code: 'MILESTONE_NOT_REACHED',
        message: `Chu kỳ 14 ngày chưa kết thúc (còn ${lockStatus.daysRemaining} ngày nữa). Chưa thể cập nhật mốc cân nặng mới.`,
        daysRemaining: lockStatus.daysRemaining,
      });
    }

    let targetWeight = req.body.weightKg != null && req.body.weightKg !== ''
      ? Number(req.body.weightKg)
      : (latestLog?.weightKg || profile.currentWeightKg);

    if (!isNumberInRange(targetWeight, 20, 300)) {
      return res.status(400).json({ message: 'Cân nặng phải nằm trong khoảng 20 đến 300 kg' });
    }

    const user = await User.findById(req.user.id).select('dateOfBirth gender').lean();
    const healthMetrics = {
      ...calculateHealthMetrics({
        heightCm: profile.heightCm,
        weightKg: targetWeight,
        dateOfBirth: user?.dateOfBirth,
        gender: user?.gender,
        activityLevel: profile.activityLevel,
      }),
      calculatedAt: new Date(),
    };

    const currentGoal = profile.nutritionGoal?.goal || profile.healthGoal || 'maintain_weight';
    let newNutritionGoal = profile.nutritionGoal;
    if (healthMetrics.bmr && healthMetrics.tdee) {
      if (profile.nutritionGoal?.customized && profile.nutritionGoal.macroPercentages) {
        const cal = calcSafeCalorieTarget(healthMetrics, currentGoal, user?.gender);
        newNutritionGoal = buildNutritionGoal(currentGoal, cal, profile.nutritionGoal.macroPercentages, true);
      } else {
        newNutritionGoal = calculateNutritionProposal(healthMetrics, currentGoal, user?.gender);
      }
    }

    const today = getTodayDate();
    const now = new Date();

    const updatedProfile = await UserProfile.findByIdAndUpdate(
      profile._id,
      {
        $set: {
          currentWeightKg: targetWeight,
          currentWeightRecordedDate: today,
          baselineWeightUpdatedAt: now,
          healthMetrics,
          nutritionGoal: newNutritionGoal,
        },
      },
      { new: true, runValidators: true }
    ).lean();

    // Đồng bộ hoặc tạo bản ghi WeightLog cho ngày hôm nay
    const existingLogToday = await WeightLog.findOne({ user: req.user.id, recordedDate: today });
    if (!existingLogToday) {
      await WeightLog.create({
        user: req.user.id,
        weightKg: targetWeight,
        recordedDate: today,
        loggedAt: now,
        updateCount: 0,
        editHistory: [{ weightKg: targetWeight, loggedAt: now }],
      });
    } else if (existingLogToday.weightKg !== targetWeight) {
      const history = Array.isArray(existingLogToday.editHistory) && existingLogToday.editHistory.length > 0
        ? [...existingLogToday.editHistory]
        : [{ weightKg: existingLogToday.weightKg, loggedAt: existingLogToday.loggedAt || existingLogToday.createdAt || now }];
      history.push({ weightKg: targetWeight, loggedAt: now });

      await WeightLog.findByIdAndUpdate(
        existingLogToday._id,
        {
          $set: {
            weightKg: targetWeight,
            loggedAt: now,
            updateCount: (existingLogToday.updateCount || 0) + 1,
            editHistory: history,
          },
        },
        { new: true, runValidators: true }
      );
    }

    const updatedLatestLog = await WeightLog.findOne({ user: req.user.id }).sort({ recordedDate: -1, loggedAt: -1 }).lean();
    const newLockStatus = computeBaselineLockStatus(updatedProfile, updatedLatestLog);

    return res.status(200).json({
      message: 'Cập nhật mốc cân nặng và thiết lập chu kỳ 14 ngày mới thành công',
      profile: updatedProfile,
      baselineStatus: newLockStatus,
    });
  } catch (err) {
    console.error('[applyMilestoneWeight] Lỗi:', err.message);
    return res.status(500).json({ message: 'Không thể cập nhật mốc cân nặng chu kỳ mới' });
  }
}

module.exports = {
  getWeightLogs,
  saveWeightLog,
  deleteWeightLog,
  applyMilestoneWeight,
};
