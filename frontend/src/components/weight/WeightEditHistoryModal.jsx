import React from 'react'
import { formatLogDate, formatLogTime } from '../../constants/healthConstants'

export default function WeightEditHistoryModal({
  log,
  onClose,
}) {
  if (!log) return null

  const historyList = (log.editHistory && log.editHistory.length > 0)
    ? log.editHistory
    : [{
        version: 1,
        weightKg: log.weightKg,
        loggedAt: log.loggedAt || log.createdAt,
        timeStr: log.timeStr || '',
      }]

  return (
    <div className="hp-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="hp-weight-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wt-hist-title"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: '500px' }}
      >
        <div className="hp-weight-modal__header">
          <div>
            <span>Nhật ký chi tiết trong ngày</span>
            <h2 id="wt-hist-title">Lịch sử cân ngày {formatLogDate(log.recordedDate)}</h2>
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

        <div className="wt-hist-modal-body">
          <div className="wt-hist-modal-intro">
            <i className="bi bi-info-circle-fill" />
            <span>
              Đã cập nhật <b>{log.updateCount || (log.editHistory?.length ? log.editHistory.length - 1 : 0)}/5</b> lần. Số cân ở lần ghi nhận mới nhất được dùng để vẽ biểu đồ theo dõi; hồ sơ sức khỏe chỉ nhận cân nặng khi đến mốc chu kỳ 2 tuần.
            </span>
          </div>

          <div className="wt-timeline">
            {historyList.map((item, idx) => {
              const isLatest = idx === historyList.length - 1
              const prevItem = historyList[idx - 1]
              const diff = prevItem ? Number((item.weightKg - prevItem.weightKg).toFixed(1)) : null
              const formattedTime = formatLogTime(item.loggedAt) || item.timeStr || '—'

              return (
                <div key={idx} className={`wt-timeline-item ${isLatest ? 'is-latest' : ''}`}>
                  <div className="wt-timeline-track">
                    <span className={`wt-timeline-dot ${isLatest ? 'is-latest' : ''}`} />
                    {idx < historyList.length - 1 && <span className="wt-timeline-line" />}
                  </div>
                  <div className="wt-timeline-content">
                    <div className="wt-timeline-top">
                      <span className="wt-timeline-version">
                        {idx === 0 ? 'Lần 1 (Ban đầu)' : `Lần ${idx + 1}`}
                      </span>
                      <span className="wt-timeline-time">
                        <i className="bi bi-clock" /> {formattedTime}
                      </span>
                    </div>
                    <div className="wt-timeline-val-row">
                      <strong className="wt-timeline-val">{item.weightKg} kg</strong>
                      {diff != null && (
                        <span className={`wt-diff-tag ${diff < 0 ? 'is-down' : diff > 0 ? 'is-up' : 'is-flat'}`} style={{ fontSize: '11px', padding: '1px 5px' }}>
                          <i className={`bi ${diff < 0 ? 'bi-arrow-down-short' : diff > 0 ? 'bi-arrow-up-short' : 'bi-dash'}`} />
                          {diff > 0 ? `+${diff}` : diff} kg
                        </span>
                      )}
                      {isLatest && (
                        <span className="wt-pill-official">
                          <i className="bi bi-check-circle-fill" /> Chính thức
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="hp-weight-modal__actions" style={{ marginTop: '20px' }}>
          <button
            type="button"
            className="wt-btn wt-btn--secondary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={onClose}
          >
            Đóng
          </button>
        </div>
      </section>
    </div>
  )
}
