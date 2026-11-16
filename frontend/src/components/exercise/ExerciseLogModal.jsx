import { useState } from 'react'
import { Link } from 'react-router-dom'
import axiosInstance from '../../api/axiosInstance'
import {
  EXERCISE_FALLBACK_IMAGES,
  calcCalories,
  getExerciseThumbnail,
  getMinDateStr,
  getTimeStr,
  getTodayStr,
  validateDateTime,
} from '../../constants/exerciseConstants'

export default function ExerciseLogModal({
  logging,
  userWeight,
  onClose,
  onSaved,
  onError,
}) {
  const initialDuration = logging?.defaultDurationMinutes || 30
  const todayStr = getTodayStr()
  const nowTimeStr = getTimeStr()

  const [form, setForm] = useState({
    duration: initialDuration,
    date: todayStr,
    time: nowTimeStr,
    notes: '',
  })
  const [logCalories, setLogCalories] = useState(() =>
    userWeight ? calcCalories(logging?.met, userWeight, initialDuration) : 0
  )
  const [logErr, setLogErr] = useState('')
  const [saving, setSaving] = useState(false)

  if (!logging) return null

  function onDurationChange(val) {
    const d = Number(val)
    setForm((p) => ({ ...p, duration: val }))
    setLogErr('')
    if (!val || d <= 0) {
      setLogErr('Thời lượng tập luyện phải lớn hơn 0')
      setLogCalories(0)
      return
    }
    if (d > 1440) {
      setLogErr('Thời lượng tập không thể vượt quá 24 giờ (1440 phút)')
      setLogCalories(0)
      return
    }
    if (!userWeight) {
      setLogErr('Vui lòng cập nhật cân nặng trong hồ sơ sức khỏe')
      setLogCalories(0)
      return
    }
    setLogCalories(calcCalories(logging?.met, userWeight, d))
  }

  function onLogDateChange(val) {
    const currentToday = getTodayStr()
    const currentNowTime = getTimeStr()
    setForm((p) => {
      let nextTime = p.time
      if (val === currentToday && p.time > currentNowTime) {
        nextTime = currentNowTime
      }
      return { ...p, date: val, time: nextTime }
    })
    if (val > currentToday) {
      setLogErr('Ngày tập không thể ở thời điểm tương lai')
    } else {
      setLogErr('')
    }
  }

  function onLogTimeChange(val) {
    const currentToday = getTodayStr()
    const currentNowTime = getTimeStr()
    if (form.date === currentToday && val > currentNowTime) {
      setLogErr('Giờ bắt đầu tập không thể ở thời điểm tương lai')
    } else {
      setLogErr('')
    }
    setForm((p) => ({ ...p, time: val }))
  }

  async function handleSave() {
    const dtErr = validateDateTime(form.date, form.time)
    if (dtErr) {
      setLogErr(dtErr)
      return
    }
    const d = Number(form.duration)
    if (!d || d <= 0) {
      setLogErr('Thời lượng tập luyện phải lớn hơn 0')
      return
    }
    if (d > 1440) {
      setLogErr('Thời lượng tập không thể vượt quá 24 giờ (1440 phút)')
      return
    }
    if (!userWeight) {
      setLogErr('Vui lòng cập nhật cân nặng trong hồ sơ sức khỏe')
      return
    }
    if (!logging?.met) {
      setLogErr('Bài tập chưa có dữ liệu tính calories')
      return
    }

    setSaving(true)
    setLogErr('')
    try {
      const { data } = await axiosInstance.post('/exercises/logs', {
        exerciseId: logging._id,
        durationMinutes: d,
        date: form.date,
        time: form.time,
        notes: form.notes,
        customWeightKg: userWeight,
      })
      onSaved(data.message || 'Ghi nhận bài tập thành công', data.dailyTotalCalories)
      onClose()
    } catch (e) {
      const msg = e.response?.data?.message || 'Không thể lưu thông tin bài tập, vui lòng thử lại'
      setLogErr(msg)
      if (onError) onError(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ex-overlay" role="dialog" aria-modal="true">
      <div className="ex-dialog">
        <div className="ex-dialog-head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src={getExerciseThumbnail(logging)}
              alt=""
              className="ex-modal-thumb"
              onError={(e) => {
                e.currentTarget.onerror = null
                e.currentTarget.src =
                  EXERCISE_FALLBACK_IMAGES[logging.category] || EXERCISE_FALLBACK_IMAGES.cardio
              }}
            />
            <div>
              <small>Ghi nhận bài tập</small>
              <h3>{logging.name}</h3>
            </div>
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
          {/* Info chips */}
          <div className="ex-info-chips">
            <span>
              MET: <b>{logging.met}</b>
            </span>
            <span>
              Cường độ: <b>{logging.intensity}</b>
            </span>
            <span>
              Cân nặng: <b>{userWeight ? `${userWeight} kg` : '—'}</b>
            </span>
          </div>

          {/* Cảnh báo thiếu cân nặng */}
          {(!userWeight || userWeight <= 0) && (
            <div className="ex-dialog-warn">
              <i className="bi bi-exclamation-triangle-fill" />
              <div>
                <strong>Vui lòng cập nhật cân nặng trong hồ sơ sức khỏe</strong>
                <Link
                  to="/profile"
                  style={{ display: 'block', marginTop: 4, fontSize: '0.82rem', color: '#2563eb' }}
                >
                  Đi đến Hồ sơ sức khỏe →
                </Link>
              </div>
            </div>
          )}

          {/* Ngày & Giờ */}
          <div className="ex-form-row">
            <div className="ex-field">
              <label>Ngày tập</label>
              <input
                type="date"
                min={getMinDateStr(90)}
                max={getTodayStr()}
                value={form.date}
                onChange={(e) => onLogDateChange(e.target.value)}
              />
            </div>
            <div className="ex-field">
              <label>Giờ bắt đầu tập</label>
              <input
                type="time"
                max={form.date === getTodayStr() ? getTimeStr() : undefined}
                value={form.time}
                onChange={(e) => onLogTimeChange(e.target.value)}
              />
            </div>
          </div>

          {/* Thời lượng */}
          <div className="ex-field">
            <label>Thời lượng tập (phút)</label>
            <input
              type="number"
              min="1"
              max="1440"
              step="1"
              placeholder="Ví dụ: 30"
              value={form.duration}
              onChange={(e) => onDurationChange(e.target.value)}
            />
            <div className="ex-quick-chips">
              {[15, 30, 45, 60, 90].map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`ex-qchip ${Number(form.duration) === m ? 'active' : ''}`}
                  onClick={() => onDurationChange(m)}
                >
                  {m} phút
                </button>
              ))}
            </div>
          </div>

          {/* Ghi chú */}
          <div className="ex-field">
            <label>
              Ghi chú <span style={{ fontWeight: 400, color: '#94a3b8' }}>(tùy chọn)</span>
            </label>
            <input
              type="text"
              maxLength={500}
              placeholder="Cảm nhận buổi tập, nhịp tim..."
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>

          {/* Kết quả tính */}
          <div className="ex-result-simple">
            <i className="bi bi-fire" />
            <span>
              Ước tính tiêu hao: <strong>{logCalories} kcal</strong>
            </span>
          </div>

          {logErr && (
            <div className="ex-inline-err">
              <i className="bi bi-exclamation-circle" /> {logErr}
            </div>
          )}
        </div>

        <div className="ex-dialog-foot">
          <button
            type="button"
            className="ex-btn ex-btn--ghost"
            onClick={onClose}
            disabled={saving}
          >
            Hủy
          </button>
          <button
            type="button"
            className="ex-btn ex-btn--primary"
            onClick={handleSave}
            disabled={saving || !userWeight || Number(form.duration) <= 0}
          >
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" /> Đang lưu...
              </>
            ) : (
              <>
                <i className="bi bi-check2-circle" /> Lưu bài tập
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
