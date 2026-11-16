import React from 'react'

export default function UnsafeGoalModal({
  goalWarning,
  setGoalWarning,
  goalWarningModalRef,
  confirmGoalWarning,
}) {
  if (!goalWarning) return null

  return (
    <div
      className="hp-modal-backdrop"
      role="presentation"
      onMouseDown={() => { if (!goalWarning.fromSubmit) setGoalWarning(null) }}
    >
      <section
        ref={goalWarningModalRef}
        className={`hp-goal-warning-modal hp-goal-warning-modal--${goalWarning.risk.level}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="goal-warning-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="hp-goal-warning-modal__icon">
          <i
            className={`bi ${
              goalWarning.risk.level === 'danger'
                ? 'bi-exclamation-triangle-fill'
                : 'bi-exclamation-circle-fill'
            }`}
          />
        </div>
        <h2 id="goal-warning-title">Lưu ý về lựa chọn mục tiêu</h2>
        <p>
          Chỉ số BMI của bạn hiện đang ở mức{' '}
          <strong>{goalWarning.risk.bmiCategory}</strong>.
          Mục tiêu <strong>{goalWarning.risk.goalLabel}</strong> có thể không phù hợp
          với tình trạng sức khỏe hiện tại của bạn.
        </p>
        {goalWarning.risk.note && (
          <p className="hp-goal-warning-modal__disclaimer">{goalWarning.risk.note}</p>
        )}
        <div className="hp-goal-warning-modal__actions">
          <button type="button" className="hp-weight-modal__cancel" onClick={() => setGoalWarning(null)}>
            <i className="bi bi-arrow-left" /> Chọn lại
          </button>
          <button
            type="button"
            className={`hp-goal-warning-modal__confirm hp-goal-warning-modal__confirm--${goalWarning.risk.level}`}
            onClick={confirmGoalWarning}
          >
            <i className="bi bi-check2" /> Vẫn tiếp tục
          </button>
        </div>
      </section>
    </div>
  )
}
