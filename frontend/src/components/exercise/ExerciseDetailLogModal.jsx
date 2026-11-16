import { formatDateShort } from '../../constants/exerciseConstants'

export default function ExerciseDetailLogModal({ detailLog, onClose, onEdit }) {
  if (!detailLog) return null

  return (
    <div className="ex-overlay" role="dialog" aria-modal="true">
      <div className="ex-dialog">
        <div className="ex-dialog-head">
          <div>
            <small>Chi tiết bài tập</small>
            <h3>{detailLog.exerciseName}</h3>
          </div>
          <button
            type="button"
            className="ex-dialog-close"
            onClick={onClose}
            aria-label="Đóng"
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <div className="ex-dialog-body">
          <dl className="ex-detail-dl">
            <div className="ex-detail-row">
              <dt>Ngày thực hiện</dt>
              <dd>{formatDateShort(detailLog.date)}</dd>
            </div>
            <div className="ex-detail-row">
              <dt>Giờ bắt đầu tập</dt>
              <dd>{detailLog.time || '—'}</dd>
            </div>
            <div className="ex-detail-row">
              <dt>Thời lượng</dt>
              <dd>{detailLog.durationMinutes} phút</dd>
            </div>
            <div className="ex-detail-row">
              <dt>Cân nặng (lúc ghi nhận)</dt>
              <dd>{detailLog.weightKg} kg</dd>
            </div>
            <div className="ex-detail-row">
              <dt>Chỉ số MET</dt>
              <dd>{detailLog.met}</dd>
            </div>
            <div className="ex-detail-row ex-detail-row--highlight">
              <dt>Calories tiêu hao ước tính</dt>
              <dd>
                <strong style={{ color: '#059669', fontSize: '1.2rem' }}>
                  {detailLog.caloriesBurned} kcal
                </strong>
              </dd>
            </div>
            {detailLog.notes && (
              <div className="ex-detail-row">
                <dt>Ghi chú</dt>
                <dd>{detailLog.notes}</dd>
              </div>
            )}
          </dl>
        </div>
        <div className="ex-dialog-foot">
          <button type="button" className="ex-btn ex-btn--ghost" onClick={onClose}>
            Đóng
          </button>
          <button
            type="button"
            className="ex-btn ex-btn--primary"
            onClick={() => {
              const target = detailLog
              onClose()
              onEdit(target)
            }}
          >
            <i className="bi bi-pencil" /> Chỉnh sửa
          </button>
        </div>
      </div>
    </div>
  )
}
