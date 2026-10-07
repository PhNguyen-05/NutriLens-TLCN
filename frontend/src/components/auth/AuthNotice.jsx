/**
 * Hiển thị thông báo thành công hoặc lỗi (Bootstrap alert).
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
  const alertClass = isSuccess ? 'alert-success' : 'alert-danger'
  const icon = isSuccess ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'

  return (
    <div
      className={`alert ${alertClass} d-flex align-items-start gap-2 py-2 px-3 mb-3`}
      role="alert"
    >
      <i className={`bi ${icon} flex-shrink-0 mt-1`} aria-hidden="true" />
      <span className="flex-grow-1 small">{message}</span>
      {onDismiss && (
        <button
          type="button"
          className="btn-close btn-close-sm flex-shrink-0 mt-1"
          aria-label="Đóng thông báo"
          onClick={onDismiss}
        />
      )}
    </div>
  )
}
