/**
 * Thanh chỉ thị tiến trình đa bước (dùng cho RegisterPage & ForgotPasswordPage).
 * Thiết kế hiện đại với label text hiển thị bên dưới.
 *
 * @param {string[]} steps   - Nhãn các bước ['Thông tin', 'Xác thực OTP', ...]
 * @param {number}   current - Index bước đang active (0-based)
 *
 * @example
 * <StepIndicator steps={['Thông tin', 'Xác thực OTP']} current={1} />
 */
export default function StepIndicator({ steps, current }) {
  return (
    <div className="mb-4" role="list" aria-label="Tiến trình">
      {/* Thanh ngang dot + line */}
      <div className="step-indicator">
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
                  <i className="bi bi-check2" aria-hidden="true" style={{ fontSize: 14 }} />
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

      {/* Labels bên dưới */}
      <div className="d-flex mt-2">
        {steps.map((label, index) => {
          const isDone = index < current
          const isActive = index === current
          return (
            <div
              key={label}
              style={{
                flex: index < steps.length - 1 ? 1 : 'none',
                fontSize: 11,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? 'var(--nl-brand-mid)' : isDone ? '#059669' : '#94a3b8',
                whiteSpace: 'nowrap',
                letterSpacing: '0.01em',
              }}
            >
              {label}
            </div>
          )
        })}
      </div>
    </div>
  )
}
