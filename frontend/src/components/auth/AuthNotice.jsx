/**
 * Hiển thị thông báo thành công hoặc lỗi với thiết kế hiện đại.
 * Tự ẩn khi `message` rỗng/null.
 *
 * @param {'success'|'error'} type    - Loại thông báo
 * @param {string}            message - Nội dung thông báo
 * @param {Function}          onDismiss - Callback khi user đóng (tuỳ chọn)
 *
 * @example
 * <AuthNotice type="error" message={error} onDismiss={() => dispatch(clearError())} />
 */
export default function AuthNotice({ type, message, onDismiss }) {
  if (!message) return null

  const isSuccess = type === 'success'

  const styles = isSuccess
    ? {
        wrapper: {
          background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
          border: '1px solid #6ee7b7',
          borderLeft: '4px solid #10b981',
          borderRadius: 12,
          color: '#065f46',
        },
        icon: 'bi-check-circle-fill',
        iconColor: '#10b981',
      }
    : {
        wrapper: {
          background: 'linear-gradient(135deg, #fff5f5, #fef2f2)',
          border: '1px solid #fca5a5',
          borderLeft: '4px solid #ef4444',
          borderRadius: 12,
          color: '#7f1d1d',
        },
        icon: 'bi-exclamation-triangle-fill',
        iconColor: '#ef4444',
      }

  return (
    <div
      style={{ ...styles.wrapper, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 10 }}
      role="alert"
    >
      <i
        className={`bi ${styles.icon} flex-shrink-0`}
        style={{ color: styles.iconColor, fontSize: 15, marginTop: 1 }}
        aria-hidden="true"
      />
      <span className="flex-grow-1" style={{ fontSize: 13.5, lineHeight: 1.5 }}>{message}</span>
      {onDismiss && (
        <button
          type="button"
          className="btn-close btn-close-sm flex-shrink-0"
          style={{ marginTop: 1, opacity: 0.6 }}
          aria-label="Đóng thông báo"
          onClick={onDismiss}
        />
      )}
    </div>
  )
}
