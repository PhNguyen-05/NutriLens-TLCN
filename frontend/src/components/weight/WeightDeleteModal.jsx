import React from 'react'
import { formatLogDate } from '../../constants/healthConstants'

export default function WeightDeleteModal({
  log,
  onClose,
  onDelete,
  deleting,
}) {
  if (!log) return null

  return (
    <div className="hp-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="hp-weight-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="wt-del-title"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: '420px' }}
      >
        <div className="hp-weight-modal__header">
          <div>
            <span style={{ color: '#ef4444' }}>Cảnh báo</span>
            <h2 id="wt-del-title">Xóa bản ghi cân nặng</h2>
          </div>
          <button
            type="button"
            className="hp-weight-modal__close"
            onClick={onClose}
            title="Đóng"
            aria-label="Đóng"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <p style={{ fontSize: '14px', color: '#475569', margin: '14px 0 20px' }}>
          Bạn có chắc chắn muốn xóa bản ghi ngày <strong>{formatLogDate(log.recordedDate)}</strong> ({log.weightKg} kg) không? Thao tác này không thể hoàn tác.
        </p>
        <div className="hp-weight-modal__actions">
          <button
            type="button"
            className="hp-weight-modal__cancel"
            onClick={onClose}
            disabled={deleting}
          >
            Hủy
          </button>
          <button
            type="button"
            className="hp-weight-modal__save"
            style={{ backgroundColor: '#ef4444', borderColor: '#dc2626' }}
            onClick={() => onDelete(log._id || log.id)}
            disabled={deleting}
          >
            {deleting ? 'Đang xóa…' : 'Xóa bản ghi'}
          </button>
        </div>
      </section>
    </div>
  )
}
