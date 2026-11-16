import { useState } from 'react'
import axiosInstance from '../../api/axiosInstance'
import {
  calcCalories,
  getMinDateStr,
  getTimeStr,
  getTodayStr,
  validateDateTime,
} from '../../constants/exerciseConstants'

export default function ExerciseEditModal({
  editing,
  exercises = [],
  userWeight = null,
  onClose,
  onSaved,
  onError,
  onNotFound,
}) {
  const initialWeight = editing?.weightKg || userWeight || 60
  const initialDuration = editing?.durationMinutes || 30
  const [form, setForm] = useState({
    exerciseId: editing?.exerciseId || '',
    duration: initialDuration,
    weightKg: initialWeight,
    date: editing?.date || getTodayStr(),
    time: editing?.time || '',
    notes: editing?.notes || '',
  })

  const [editCalories, setEditCalories] = useState(() =>
    calcCalories(editing?.met, initialWeight, initialDuration)
  )
  const [editErr, setEditErr] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  if (!editing) return null

  function getMetForExercise(exId) {
    const ex = exercises.find((e) => String(e._id) === String(exId))
    return ex ? ex.met : editing.met
  }

  function onExerciseSelect(eId) {
    const nextMet = getMetForExercise(eId)
    setForm((p) => ({ ...p, exerciseId: eId }))
    setEditCalories(calcCalories(nextMet, form.weightKg, form.duration))
  }

  function onDurationChange(val) {
    const d = Number(val)
    setForm((p) => ({ ...p, duration: val }))
    setEditErr('')
    if (!val || d <= 0) {
      setEditErr('Thời lượng phải lớn hơn 0')
      setEditCalories(0)
      return
    }
    if (d > 1440) {
      setEditErr('Thời lượng tập không thể vượt quá 24 giờ (1440 phút)')
      setEditCalories(0)
      return
    }
    const met = getMetForExercise(form.exerciseId)
    setEditCalories(calcCalories(met, form.weightKg, d))
  }

  function onWeightChange(val) {
    const w = Number(val)
    setForm((p) => ({ ...p, weightKg: val }))
    setEditErr('')
    if (!val || w < 20 || w > 300) {
      setEditErr('Cân nặng phải trong khoảng từ 20 đến 300 kg')
      return
    }
    const met = getMetForExercise(form.exerciseId)
    setEditCalories(calcCalories(met, w, form.duration))
  }

  function onEditDateChange(val) {
    const today = getTodayStr()
    const nowTime = getTimeStr()
    setForm((p) => {
      let nextTime = p.time
      if (val === today && p.time > nowTime) {
        nextTime = nowTime
      }
      return { ...p, date: val, time: nextTime }
    })
    if (val > today) {
      setEditErr('Ngày tập không thể ở thời điểm tương lai')
    } else {
      setEditErr('')
    }
  }

  function onEditTimeChange(val) {
    const today = getTodayStr()
    const nowTime = getTimeStr()
    if (form.date === today && val > nowTime) {
      setEditErr('Giờ bắt đầu tập không thể ở thời điểm tương lai')
    } else {
      setEditErr('')
    }
    setForm((p) => ({ ...p, time: val }))
  }

  async function handleSave() {
    const dtErr = validateDateTime(form.date, form.time)
    if (dtErr) {
      setEditErr(dtErr)
      return
    }
    const d = Number(form.duration)
    if (!d || d <= 0) {
      setEditErr('Thời lượng phải lớn hơn 0')
      return
    }
    if (d > 1440) {
      setEditErr('Thời lượng tập không thể vượt quá 24 giờ (1440 phút)')
      return
    }
    const w = Number(form.weightKg)
    if (!w || w < 20 || w > 300) {
      setEditErr('Cân nặng phải trong khoảng từ 20 đến 300 kg')
      return
    }

    setSavingEdit(true)
    setEditErr('')
    try {
      const { data } = await axiosInstance.patch(`/exercises/logs/${editing._id}`, {
        exerciseId: form.exerciseId,
        durationMinutes: d,
        weightKg: w,
        customWeightKg: w,
        date: form.date,
        time: form.time,
        notes: form.notes,
      })
      onSaved(data.message || 'Cập nhật bài tập thành công', data.dailyTotalCalories)
      onClose()
    } catch (e) {
      const msg = e.response?.data?.message || 'Không thể cập nhật dữ liệu, vui lòng thử lại'
      setEditErr(msg)
      if (onError) onError(msg)
      if (e.response?.status === 404 && onNotFound) {
        onNotFound()
        onClose()
      }
    } finally {
      setSavingEdit(false)
    }
  }

  return (
    <div className="ex-overlay" role="dialog" aria-modal="true">
      <div className="ex-dialog">
        <div className="ex-dialog-head">
          <div>
            <small>Chỉnh sửa bài tập</small>
            <h3>{editing.exerciseName}</h3>
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
          {/* Đổi bài tập */}
          <div className="ex-field">
            <label>Bài tập</label>
            <select
              className="ex-select"
              value={form.exerciseId}
              onChange={(e) => onExerciseSelect(e.target.value)}
            >
              {editing &&
                !exercises.some((ex) => String(ex._id) === String(form.exerciseId)) && (
                  <option value={form.exerciseId}>
                    {editing.exerciseName} (Đã ngưng áp dụng)
                  </option>
                )}
              {exercises.map((ex) => (
                <option key={ex._id} value={ex._id}>
                  {ex.name} (MET {ex.met})
                </option>
              ))}
            </select>
          </div>

          <div className="ex-form-row">
            <div className="ex-field">
              <label>Ngày tập</label>
              <input
                type="date"
                min={getMinDateStr(90)}
                max={getTodayStr()}
                value={form.date}
                onChange={(e) => onEditDateChange(e.target.value)}
              />
            </div>
            <div className="ex-field">
              <label>Giờ bắt đầu tập</label>
              <input
                type="time"
                max={form.date === getTodayStr() ? getTimeStr() : undefined}
                value={form.time}
                onChange={(e) => onEditTimeChange(e.target.value)}
              />
            </div>
          </div>

          <div className="ex-form-row">
            <div className="ex-field">
              <label>Thời lượng (phút)</label>
              <input
                type="number"
                min="1"
                max="1440"
                step="1"
                value={form.duration}
                onChange={(e) => onDurationChange(e.target.value)}
              />
            </div>

            {/* Sửa cân nặng khi tập */}
            <div className="ex-field">
              <label>
                Cân nặng khi tập (kg) <span style={{ color: '#059669', fontSize: '0.8rem' }}>(để tính calo)</span>
              </label>
              <input
                type="number"
                min="20"
                max="300"
                step="0.5"
                value={form.weightKg}
                onChange={(e) => onWeightChange(e.target.value)}
              />
            </div>
          </div>

          <div className="ex-quick-chips" style={{ marginTop: -8, marginBottom: 12 }}>
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

          <div className="ex-field">
            <label>Ghi chú</label>
            <input
              type="text"
              maxLength={500}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </div>

          {/* Calo sau chỉnh sửa */}
          <div className="ex-result-simple">
            <i className="bi bi-fire" />
            <span>
              Calories sau cập nhật: <strong>{editCalories} kcal</strong>
            </span>
            <span style={{ fontSize: '0.8rem', marginLeft: 6, color: '#64748b' }}>
              (ban đầu: {editing.caloriesBurned} kcal)
            </span>
          </div>

          {editErr && (
            <div className="ex-inline-err">
              <i className="bi bi-exclamation-circle" /> {editErr}
            </div>
          )}
        </div>

        <div className="ex-dialog-foot">
          <button
            type="button"
            className="ex-btn ex-btn--ghost"
            onClick={onClose}
            disabled={savingEdit}
          >
            Hủy
          </button>
          <button
            type="button"
            className="ex-btn ex-btn--primary"
            onClick={handleSave}
            disabled={savingEdit || Number(form.duration) <= 0 || Number(form.weightKg) <= 0}
          >
            {savingEdit ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" /> Đang lưu...
              </>
            ) : (
              <>
                <i className="bi bi-check-lg" /> Lưu thay đổi
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
