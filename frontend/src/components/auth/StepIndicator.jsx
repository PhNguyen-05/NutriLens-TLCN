/**
 * Thanh chỉ thị tiến trình đa bước (dùng cho RegisterPage & ForgotPasswordPage).
 *
 * @param {string[]} steps   - Nhãn các bước ['Thông tin', 'Xác thực OTP', ...]
 * @param {number}   current - Index bước đang active (0-based)
 *
 * @example
 * <StepIndicator steps={['Thông tin', 'Xác thực OTP']} current={1} />
 */
export default function StepIndicator({ steps, current }) {
  return (
    <div className="step-indicator mb-4" role="list" aria-label="Tiến trình">
      {steps.map((label, index) => {
        const isDone = index < current
        const isActive = index === current

        let dotClass = 'step-dot--inactive'
        if (isDone)   dotClass = 'step-dot--done'
        if (isActive) dotClass = 'step-dot--active'

        return (
          <div
            key={label}
            className="d-flex align-items-center"
            style={{ flex: index < steps.length - 1 ? 1 : 'none' }}
            role="listitem"
            aria-current={isActive ? 'step' : undefined}
          >
            <div
              className={`step-dot ${dotClass}`}
              title={label}
              aria-label={`${label}${isDone ? ' (hoàn thành)' : isActive ? ' (đang thực hiện)' : ''}`}
            >
              {isDone ? (
                <i className="bi bi-check" aria-hidden="true" />
              ) : (
                index + 1
              )}
            </div>

            {index < steps.length - 1 && (
              <div className={`step-line ${isDone ? 'step-line--done' : ''}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
