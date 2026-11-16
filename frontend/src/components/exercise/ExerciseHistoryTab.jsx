import {
  formatDateShort,
  getMinDateStr,
  getTodayStr,
} from '../../constants/exerciseConstants'

const PERIOD_BUTTONS = [
  { id: 'today',  label: 'Hôm nay' },
  { id: '7d',     label: '7 ngày' },
  { id: '14d',    label: '14 ngày' },
  { id: '30d',    label: '30 ngày' },
  { id: 'all',    label: 'Tất cả' },
  { id: 'custom', label: 'Tùy chọn' },
]

export default function ExerciseHistoryTab({
  logs = [],
  loadingLogs = false,
  period = '7d',
  onPeriodChange,
  customStart = '',
  customEnd = '',
  onCustomStartChange,
  onCustomEndChange,
  histCat = 'all',
  onHistCatChange,
  histSummary = { sessions: 0, minutes: 0, calories: 0 },
  onDetail,
  onEdit,
  onDelete,
  onGoToCatalog,
}) {
  const todayStr = getTodayStr()

  return (
    <section>
      {/* Toolbar lịch sử */}
      <div className="ex-history-bar">
        <div className="ex-period-btns">
          {PERIOD_BUTTONS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`ex-period-btn ${period === p.id ? 'active' : ''}`}
              onClick={() => onPeriodChange(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === 'custom' && (
          <div className="ex-date-range">
            <label>
              Từ&nbsp;
              <input
                type="date"
                min={getMinDateStr(365)}
                value={customStart}
                max={customEnd || todayStr}
                onChange={(e) => onCustomStartChange(e.target.value)}
              />
            </label>
            <span>—</span>
            <label>
              Đến&nbsp;
              <input
                type="date"
                value={customEnd}
                min={customStart}
                max={todayStr}
                onChange={(e) => onCustomEndChange(e.target.value)}
              />
            </label>
          </div>
        )}

        <select
          className="ex-cat-select"
          value={histCat}
          onChange={(e) => onHistCatChange(e.target.value)}
        >
          <option value="all">Tất cả nhóm</option>
          <option value="cardio">Cardio &amp; Vận động</option>
          <option value="strength">Sức mạnh &amp; Gym</option>
          <option value="flexibility">Yoga &amp; Thư giãn</option>
          <option value="sports">Thể thao</option>
        </select>
      </div>

      {/* Tổng kết kỳ lọc */}
      <div className="ex-summary-strip">
        <div className="ex-sum-item">
          <span>{histSummary.sessions}</span>
          <small>Buổi tập</small>
        </div>
        <div className="ex-sum-sep" />
        <div className="ex-sum-item">
          <span>{histSummary.minutes}</span>
          <small>Phút</small>
        </div>
        <div className="ex-sum-sep" />
        <div className="ex-sum-item ex-sum-item--hi">
          <span>{histSummary.calories.toLocaleString('vi-VN')}</span>
          <small>kcal tiêu hao</small>
        </div>
      </div>

      {/* Danh sách */}
      {loadingLogs ? (
        <div className="ex-state-empty">
          <span className="fs-mini-spinner" />
          <p>Đang tải lịch sử tập luyện...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="ex-state-empty">
          <i className="bi bi-calendar-x" />
          <strong>Không tìm thấy dữ liệu phù hợp</strong>
          <p>Không có bản ghi nào trong khoảng thời gian hoặc điều kiện lọc này.</p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="ex-btn ex-btn--outline"
              onClick={() => {
                onPeriodChange('all')
                onHistCatChange('all')
              }}
            >
              Xem tất cả
            </button>
            <button className="ex-btn ex-btn--primary" onClick={onGoToCatalog}>
              Thêm bài tập
            </button>
          </div>
        </div>
      ) : (
        <div className="ex-log-list">
          {logs.map((log) => (
            <article key={log._id} className="fd-panel ex-log-row">
              <div className="ex-log-left">
                <div className="ex-log-icon">
                  <i className="bi bi-lightning-fill" />
                </div>
                <div className="ex-log-info">
                  <div className="ex-log-top">
                    <strong>{log.exerciseName}</strong>
                    <span className="ex-log-date">
                      <i className="bi bi-calendar3" /> {formatDateShort(log.date)}
                      {log.time && <>&nbsp;·&nbsp;{log.time}</>}
                    </span>
                  </div>
                  <div className="ex-log-chips">
                    <span className="ex-meta-chip">
                      <i className="bi bi-stopwatch" /> {log.durationMinutes} phút
                    </span>
                    <span className="ex-meta-chip">MET {log.met}</span>
                    <span className="ex-meta-chip">
                      <i className="bi bi-person" /> {log.weightKg} kg
                    </span>
                    {log.notes && (
                      <span className="ex-meta-note" title={log.notes}>
                        <i className="bi bi-chat-left-text" /> {log.notes}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="ex-log-right">
                <div className="ex-log-burn">
                  <strong>−{log.caloriesBurned}</strong>
                  <small>kcal</small>
                </div>
                <div className="ex-log-actions">
                  <button
                    type="button"
                    className="ex-icon-btn"
                    title="Xem chi tiết"
                    onClick={() => onDetail(log)}
                  >
                    <i className="bi bi-eye" />
                  </button>
                  <button
                    type="button"
                    className="ex-icon-btn"
                    title="Chỉnh sửa"
                    onClick={() => onEdit(log)}
                  >
                    <i className="bi bi-pencil" />
                  </button>
                  <button
                    type="button"
                    className="ex-icon-btn ex-icon-btn--del"
                    title="Xóa"
                    onClick={() => onDelete(log)}
                  >
                    <i className="bi bi-trash3" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
