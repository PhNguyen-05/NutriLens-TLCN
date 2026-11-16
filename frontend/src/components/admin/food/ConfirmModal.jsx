export default function ConfirmModal({
  title,
  icon,
  iconClass,
  body,
  cancelLabel = 'Hủy',
  confirmLabel,
  confirmClass,
  onCancel,
  onConfirm,
  loading,
  extra,
}) {
  return (
    <div
      className="fm-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel()
      }}
    >
      <section className="fm-confirm" role="dialog" aria-modal="true">
        <header className="fm-confirm-header">
          <span className={`fm-confirm-icon ${iconClass}`}>
            <i className={icon} />
          </span>
          <h2>{title}</h2>
          <button className="fm-close" onClick={onCancel} disabled={loading} aria-label="Đóng">
            <i className="bi bi-x-lg" />
          </button>
        </header>
        <div className="fm-confirm-body">{body}</div>
        {extra && <div className="fm-confirm-extra">{extra}</div>}
        <footer className="fm-confirm-footer">
          <button className="fm-btn-cancel" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            className={`fm-confirm-action ${confirmClass}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="food-spinner-inline" />
                Đang xử lý...
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </footer>
      </section>
    </div>
  )
}
