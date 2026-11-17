import React from 'react'

export default function DeleteConfirmModal({
  isOpen,
  title = 'Xác nhận xóa',
  message = 'Bạn có chắc chắn muốn xóa mục này không? Hành động này không thể hoàn tác.',
  confirmText = 'Xóa',
  cancelText = 'Hủy',
  isLoading = false,
  onConfirm,
  onClose,
}) {
  if (!isOpen) return null

  return (
    <div className="community-modal-backdrop" onClick={() => !isLoading && onClose?.()}>
      <div
        className="community-modal"
        style={{ maxWidth: '420px', padding: 0, overflow: 'hidden' }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="community-modal-header"
          style={{ background: '#fff1f2', borderBottom: '1px solid #ffe4e6' }}
        >
          <h3 style={{ color: '#e11d48', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="bi bi-exclamation-triangle-fill" />
            {title}
          </h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={isLoading}
            title="Đóng"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <div className="community-modal-body" style={{ padding: '20px' }}>
          <p style={{ color: '#475569', fontSize: '14px', lineHeight: 1.5, margin: 0 }}>
            {message}
          </p>
        </div>
        <div
          className="community-modal-footer"
          style={{ background: '#f8fafc', padding: '12px 20px' }}
        >
          <button
            type="button"
            className="community-btn-secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="community-btn-danger"
            style={{
              background: '#e11d48',
              color: '#fff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <i className="bi bi-arrow-repeat spin" /> Đang xóa...
              </>
            ) : (
              <>
                <i className="bi bi-trash-fill" /> {confirmText}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
