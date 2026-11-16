import React from 'react'
import { formatLogDate } from '../../constants/healthConstants'

export default function MilestoneReviewModal({
  open,
  onClose,
  baselineStatus,
  latestWeightLog,
  weightLogs,
  milestoneForm,
  setMilestoneForm,
  handleApplyMilestone,
  applyingMilestone,
  milestoneError,
}) {
  if (!open) return null

  const recentLog = baselineStatus?.latestWeightLog || latestWeightLog || (weightLogs?.length ? weightLogs[weightLogs.length - 1] : null)

  return (
    <div className="hp-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="hp-milestone-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="milestone-dialog-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="hp-milestone-modal__header">
          <div className="hp-milestone-modal__icon">
            <i className="bi bi-trophy-fill" />
          </div>
          <div className="hp-milestone-modal__title-box">
            <h2 id="milestone-dialog-title">Cập nhật mốc cân nặng sau 14 ngày</h2>
            <p>Đánh giá hiệu quả dinh dưỡng và thiết lập chu kỳ 14 ngày tiếp theo</p>
          </div>
          <button
            type="button"
            className="hp-milestone-modal__close"
            onClick={onClose}
            title="Đóng"
            aria-label="Đóng"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        <form onSubmit={handleApplyMilestone} noValidate>
          <div className="hp-milestone-modal__body">
            <div className="hp-milestone-prompt-box">
              <p>
                <strong>Đã hết chu kỳ 14 ngày!</strong> Bạn có muốn cập nhật lại chỉ số mốc và tính lại mục tiêu Calo không?
              </p>
              {recentLog ? (
                <div className="hp-milestone-prompt-box__recent">
                  <i className="bi bi-clock-history" />
                  <span>
                    Số cân cuối cùng đã nhập trong hệ thống: <strong>{recentLog.weightKg} kg</strong> (ngày {formatLogDate(recentLog.recordedDate)})
                  </span>
                </div>
              ) : null}
            </div>

            <div className="hp-field" style={{ marginTop: '14px' }}>
              <label htmlFor="milestoneWeightInput" style={{ fontWeight: 600 }}>
                Xác nhận số cân mốc cho chu kỳ mới (kg):
              </label>
              <div className="hp-unit-input">
                <input
                  id="milestoneWeightInput"
                  type="number"
                  step="0.1"
                  min="20"
                  max="300"
                  autoFocus
                  value={milestoneForm.weightKg}
                  onChange={(e) => setMilestoneForm({ weightKg: e.target.value })}
                />
                <span>kg</span>
              </div>
              <small style={{ color: '#64748b', fontSize: '12px', marginTop: '5px', display: 'block' }}>
                Hệ thống tự động điền số cân cuối cùng bạn đã ghi nhận. Bạn có thể xác nhận số cân này hoặc điều chỉnh nếu vừa đo lại trước khi lưu vào hồ sơ.
              </small>
            </div>

            {milestoneError && (
              <div className="hp-milestone-modal__error" role="alert">
                <i className="bi bi-exclamation-circle-fill" /> {milestoneError}
              </div>
            )}
          </div>

          <div className="hp-milestone-modal__actions">
            <button
              type="button"
              className="hp-weight-modal__cancel"
              onClick={onClose}
              disabled={applyingMilestone}
            >
              Để sau
            </button>
            <button
              type="submit"
              className="hp-milestone-modal__submit"
              disabled={applyingMilestone}
            >
              {applyingMilestone ? (
                <><div className="hp-spinner" /><span>Đang lưu…</span></>
              ) : (
                <><i className="bi bi-check2" /><span>Xác nhận &amp; Cập nhật hồ sơ</span></>
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
