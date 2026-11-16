import React from 'react'
import { getLocalDateValue, formatLogDate, formatLogTime } from '../../constants/healthConstants'

export default function WeightHistoryTable({
  tableLogs,
  openDialog,
  setHistoryModalLog,
  setDeleteConfirmLog,
}) {
  return (
    <section className="wt-card wt-history-section">
      <div className="wt-history-section__header">
        <div>
          <h2>Nhật ký lịch sử cân nặng</h2>
          <p>Danh sách các lần bạn đã ghi nhận số cân thực tế</p>
        </div>
        <span className="wt-badge wt-badge--neutral">
          Tổng cộng {tableLogs.length} bản ghi
        </span>
      </div>

      {tableLogs.length > 0 ? (
        <div className="wt-table-wrap">
          <table className="wt-table">
            <thead>
              <tr>
                <th>Thời gian ghi nhận</th>
                <th>Cân nặng</th>
                <th>Biến động</th>
                <th>Chỉ số BMI</th>
                <th className="text-end">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {tableLogs.map((log) => {
                const isToday = log.recordedDate.slice(0, 10) === getLocalDateValue()
                const logId = log._id || log.id
                return (
                  <tr key={logId || log.recordedDate}>
                    <td className="wt-cell-date">
                      <div className="wt-cell-datetime">
                        <div className="wt-cell-datetime-row">
                          <strong className="wt-date-main">{formatLogDate(log.recordedDate)}</strong>
                          {isToday && <span className="wt-pill-today">Hôm nay</span>}
                          {log.updateCount > 0 && (
                            <button
                              type="button"
                              className="wt-pill-edited wt-pill-edited--btn"
                              title="Bấm để xem lịch sử các lần sửa của ngày này"
                              onClick={() => setHistoryModalLog(log)}
                            >
                              <i className="bi bi-clock-history" /> Sửa {log.updateCount}/5
                            </button>
                          )}
                        </div>
                        <span className="wt-time-badge" title="Giờ ghi nhận">
                          <i className="bi bi-clock" /> {log.formattedTime || formatLogTime(log.loggedAt || log.updatedAt || log.createdAt) || log.timeStr || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="wt-cell-weight">
                      <b>{log.weightKg}</b> <span>kg</span>
                    </td>
                    <td className="wt-cell-diff">
                      {log.diff != null ? (
                        <span className={`wt-diff-tag ${log.diff < 0 ? 'is-down' : log.diff > 0 ? 'is-up' : 'is-flat'}`}>
                          <i className={`bi ${log.diff < 0 ? 'bi-arrow-down-short' : log.diff > 0 ? 'bi-arrow-up-short' : 'bi-dash'}`} />
                          {log.diff > 0 ? `+${log.diff}` : log.diff} kg
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="wt-cell-bmi">
                      {log.bmiInfo ? (
                        <span className="wt-badge-small" style={{ backgroundColor: log.bmiInfo.bg, color: log.bmiInfo.color }}>
                          {log.bmiInfo.bmi} ({log.bmiInfo.label})
                        </span>
                      ) : '—'}
                    </td>
                    <td className="wt-cell-actions text-end">
                      {((log.editHistory && log.editHistory.length > 1) || log.updateCount > 0) && (
                        <button
                          type="button"
                          className="wt-action-btn"
                          title="Xem lịch sử các lần sửa trong ngày"
                          onClick={() => setHistoryModalLog(log)}
                        >
                          <i className="bi bi-clock-history" />
                        </button>
                      )}
                      <button
                        type="button"
                        className="wt-action-btn"
                        title="Sửa bản ghi này"
                        onClick={() => openDialog(log.recordedDate.slice(0, 10), log.weightKg)}
                      >
                        <i className="bi bi-pencil" />
                      </button>
                      <button
                        type="button"
                        className="wt-action-btn wt-action-btn--delete"
                        title="Xóa bản ghi này"
                        onClick={() => setDeleteConfirmLog(log)}
                      >
                        <i className="bi bi-trash3" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="wt-empty-state">
          <i className="bi bi-speedometer2" />
          <h3>Chưa có bản ghi nào</h3>
          <p>Hãy bắt đầu xây dựng thói quen ghi nhận cân nặng đều đặn để NutriLens giúp bạn theo dõi tiến trình!</p>
          <button type="button" className="wt-btn wt-btn--primary" onClick={() => openDialog()}>
            <i className="bi bi-plus-lg" /> Thêm bản ghi mới
          </button>
        </div>
      )}
    </section>
  )
}
