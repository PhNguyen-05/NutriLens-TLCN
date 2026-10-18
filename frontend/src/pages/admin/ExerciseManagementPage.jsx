import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axiosInstance from '../../api/axiosInstance'

// ─── Constants ───────────────────────────────────────────────────────────────
const PAGE_SIZE = 10

const CATEGORIES = [
  { id: 'cardio', label: 'Cardio & Vận động', icon: 'bi-lightning-charge' },
  { id: 'strength', label: 'Sức mạnh & Gym', icon: 'bi-shield-check' },
  { id: 'sports', label: 'Thể thao', icon: 'bi-dribbble' },
  { id: 'flexibility', label: 'Yoga & Thư giãn', icon: 'bi-yin-yang' },
  { id: 'other', label: 'Khác', icon: 'bi-activity' },
]

const INTENSITIES = [
  { label: 'Nhẹ', cls: 'exm-chip--low', desc: 'MET < 3.0 • Vận động thư giãn nhẹ nhàng' },
  { label: 'Trung bình', cls: 'exm-chip--mid', desc: 'MET 3.0 - 6.0 • Nhịp tim tăng vừa phải' },
  { label: 'Cao', cls: 'exm-chip--high', desc: 'MET > 6.0 • Thử thách thể lực, đốt mỡ tối đa' },
]

const POPULAR_ICONS = [
  'bi-person-walking',
  'bi-person-running',
  'bi-bicycle',
  'bi-water',
  'bi-fire',
  'bi-lightning-charge',
  'bi-speedometer2',
  'bi-heart-pulse',
  'bi-dribbble',
  'bi-shield-check',
  'bi-yin-yang',
  'bi-music-note-beamed',
  'bi-activity',
  'bi-trophy',
  'bi-award',
]

const EMPTY_FORM = {
  name: '',
  category: 'cardio',
  intensity: 'Trung bình',
  met: '4.0',
  defaultDurationMinutes: '30',
  description: '',
  icon: 'bi-activity',
  isActive: true,
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function calculateKcal(met, weightKg = 60, durationMinutes = 30) {
  const m = Number(met)
  const w = Number(weightKg)
  const d = Number(durationMinutes)
  if (!m || !w || !d || m <= 0 || w <= 0 || d <= 0) return 0
  return Math.round((m * 3.5 * w * d) / 200)
}

function getCategoryMeta(catId) {
  return CATEGORIES.find((c) => c.id === catId) || { label: 'Khác', icon: 'bi-activity' }
}

function getIntensityCls(intensity) {
  if (intensity === 'Cao') return 'exm-chip--high'
  if (intensity === 'Nhẹ') return 'exm-chip--low'
  return 'exm-chip--mid'
}

// ─── Modal: Chi tiết bài tập (ExerciseDetailModal) ───────────────────────────
function ExerciseDetailModal({ exercise, onClose, onEdit, onToggleStatus }) {
  const [detailData, setDetailData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!exercise?._id) return
    let isMounted = true
    axiosInstance
      .get(`/admin/exercises/${exercise._id}`)
      .then(({ data }) => {
        if (isMounted) setDetailData(data.data)
      })
      .catch(() => {
        if (isMounted) setDetailData(exercise)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [exercise])

  const item = detailData || exercise
  if (!item) return null

  const isHidden = !item.isActive
  const cat = getCategoryMeta(item.category)
  const metVal = Number(item.met) || 0
  const duration = Number(item.defaultDurationMinutes) || 30

  return (
    <div className="fm-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <section className="fm-detail-modal exm-detail-modal" role="dialog" aria-modal="true">
        <header className="fm-detail-header">
          <div className="fm-detail-heading">
            <span className="exm-icon-avatar">
              <i className={`bi ${item.icon || 'bi-activity'}`} />
            </span>
            <div>
              <h2>{item.name}</h2>
              <div className="fm-detail-badges">
                <code className="fdm-code">{item.slug || 'Chưa gán slug'}</code>
                <span className="fdm-group-chip"><i className={`bi ${cat.icon}`} /> {item.categoryName || cat.label}</span>
                <span className={`fdm-status ${isHidden ? 'fdm-status--hidden' : 'fdm-status--active'}`}>
                  <i />{isHidden ? 'Không hoạt động (Đã ẩn)' : 'Đang hoạt động'}
                </span>
              </div>
            </div>
          </div>
          <button className="fm-close" onClick={onClose} aria-label="Đóng"><i className="bi bi-x-lg" /></button>
        </header>

        <div className="fm-detail-body">
          {/* Thẻ chỉ số tổng quan */}
          <div className="exm-stats-cards">
            <div className="exm-stat-card">
              <span className="exm-stat-label">CHỈ SỐ MET</span>
              <strong className="exm-stat-value text-emerald">
                <i className="bi bi-speedometer2" /> {metVal.toFixed(1)}
              </strong>
              <small>Metabolic Equivalent of Task</small>
            </div>
            <div className="exm-stat-card">
              <span className="exm-stat-label">MỨC ĐỘ / CƯỜNG ĐỘ</span>
              <span className={`ex-chip ${getIntensityCls(item.intensity)}`} style={{ fontSize: '0.85rem', padding: '4px 10px' }}>
                {item.intensity}
              </span>
              <small>{item.intensity === 'Cao' ? 'Tiêu hao năng lượng nhanh' : item.intensity === 'Nhẹ' ? 'Thư giãn phục hồi' : 'Tập luyện vừa sức'}</small>
            </div>
            <div className="exm-stat-card">
              <span className="exm-stat-label">THỜI LƯỢNG GỢI Ý</span>
              <strong className="exm-stat-value">
                {duration} <small style={{ fontSize: '0.8rem', fontWeight: 600 }}>phút</small>
              </strong>
              <small>Mặc định cho mỗi buổi</small>
            </div>
            <div className="exm-stat-card highlight">
              <span className="exm-stat-label">LƯỢT GHI NHẬN</span>
              <strong className="exm-stat-value text-blue">
                <i className="bi bi-people-fill" /> {item.logCount || 0}
              </strong>
              <small>Lượt tập từ người dùng</small>
            </div>
          </div>

          {/* Bảng ước tính Calo theo cân nặng chuẩn */}
          <div className="fm-detail-section">
            <h3 className="fm-detail-section-title">
              <i className="bi bi-fire" /> Ước tính năng lượng tiêu hao theo trọng lượng cơ thể ({duration} phút)
            </h3>
            <div className="exm-calorie-grid">
              {[50, 60, 70, 80].map((kg) => {
                const burn = calculateKcal(metVal, kg, duration)
                return (
                  <div key={kg} className={`exm-cal-box ${kg === 60 ? 'exm-cal-box--standard' : ''}`}>
                    <span className="exm-cal-weight">{kg} kg {kg === 60 && <b className="exm-cal-tag">Chuẩn</b>}</span>
                    <strong className="exm-cal-burn">~{burn} <span>kcal</span></strong>
                  </div>
                )
              })}
            </div>
            <small className="exm-formula-note">
              <i className="bi bi-info-circle" /> Công thức chuẩn hóa: <code>Calories = (MET × 3.5 × Cân nặng(kg) × Thời gian(phút)) / 200</code>
            </small>
          </div>

          {/* Mô tả bài tập */}
          <div className="fm-detail-section">
            <h3 className="fm-detail-section-title">
              <i className="bi bi-card-text" /> Mô tả bài tập &amp; Hướng dẫn kỹ thuật
            </h3>
            <div className="exm-description-box">
              {item.description ? (
                <p>{item.description}</p>
              ) : (
                <p className="text-muted italic">Chưa có mô tả chi tiết cho bài tập này.</p>
              )}
            </div>
          </div>

          {/* Thông tin hệ thống */}
          <div className="fm-detail-meta">
            <div><i className="bi bi-calendar-plus" /> Ngày tạo: <b>{item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : '—'}</b></div>
            <div><i className="bi bi-clock-history" /> Cập nhật lần cuối: <b>{item.updatedAt ? new Date(item.updatedAt).toLocaleString('vi-VN') : '—'}</b></div>
          </div>
        </div>

        <footer className="fm-detail-footer">
          <div className="exm-footer-left">
            <button
              type="button"
              className={`frm-btn ${isHidden ? 'frm-btn--approve' : 'frm-btn--reject'}`}
              onClick={() => {
                onClose()
                onToggleStatus(item)
              }}
            >
              <i className={`bi ${isHidden ? 'bi-eye-fill' : 'bi-eye-slash-fill'}`} />
              <span>{isHidden ? 'Hiển thị bài tập' : 'Ẩn bài tập'}</span>
            </button>
          </div>
          <div className="exm-footer-right">
            <button type="button" className="fm-btn-cancel" onClick={onClose}>Đóng</button>
            <button
              type="button"
              className="fm-btn-save"
              onClick={() => {
                onClose()
                onEdit(item)
              }}
            >
              <i className="bi bi-pencil-fill" /> Chỉnh sửa thông tin
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}

// ─── Modal: Thêm / Sửa bài tập (ExerciseFormModal) ───────────────────────────
function ExerciseFormModal({ mode = 'add', editTarget, onClose, onSaved }) {
  const [form, setForm] = useState(() => {
    if (mode === 'edit' && editTarget) {
      return {
        name: editTarget.name || '',
        category: editTarget.category || 'cardio',
        intensity: editTarget.intensity || 'Trung bình',
        met: String(editTarget.met != null ? editTarget.met : '4.0'),
        defaultDurationMinutes: String(editTarget.defaultDurationMinutes || '30'),
        description: editTarget.description || '',
        icon: editTarget.icon || 'bi-activity',
        isActive: editTarget.isActive !== undefined ? editTarget.isActive : true,
      }
    }
    return { ...EMPTY_FORM }
  })

  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [saving, setSaving] = useState(false)

  function change(e) {
    const { name, value, type, checked } = e.target
    const val = type === 'checkbox' ? checked : value
    setForm((prev) => ({ ...prev, [name]: val }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }))
    if (apiError) setApiError('')
  }

  function validateForm() {
    const errs = {}
    // Luồng ngoại lệ 4a: Bỏ trống tên bài tập
    if (!form.name.trim()) {
      errs.name = 'Tên bài tập không được để trống'
    }
    // Luồng ngoại lệ 4b: MET <= 0 hoặc không đúng định dạng
    const metNum = Number(form.met)
    if (form.met === '' || !Number.isFinite(metNum) || metNum <= 0 || metNum > 30) {
      errs.met = 'Giá trị MET không hợp lệ'
    }
    const durNum = Number(form.defaultDurationMinutes)
    if (form.defaultDurationMinutes === '' || !Number.isFinite(durNum) || durNum <= 0) {
      errs.defaultDurationMinutes = 'Thời lượng phải là số dương'
    }
    return errs
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault()
    const errs = validateForm()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      if (errs.name) setApiError(errs.name)
      else if (errs.met) setApiError(errs.met)
      return
    }

    setSaving(true)
    setApiError('')

    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        intensity: form.intensity,
        met: Number(form.met),
        defaultDurationMinutes: Number(form.defaultDurationMinutes) || 30,
        description: form.description.trim(),
        icon: form.icon,
        isActive: Boolean(form.isActive),
      }

      if (mode === 'add') {
        await axiosInstance.post('/admin/exercises', payload)
        onSaved('Lưu thông tin bài tập thành công')
      } else {
        await axiosInstance.put(`/admin/exercises/${editTarget._id}`, payload)
        onSaved('Lưu thông tin bài tập thành công')
      }
    } catch (err) {
      // Luồng ngoại lệ 4c (Bài tập đã tồn tại) & 7d (Lỗi cập nhật)
      const msg = err.response?.data?.message || 'Không thể cập nhật thông tin bài tập, vui lòng thử lại'
      setApiError(msg)
      if (err.response?.status === 409) {
        setErrors((prev) => ({ ...prev, name: msg }))
      }
    } finally {
      setSaving(false)
    }
  }

  const previewKcal = calculateKcal(form.met, 60, form.defaultDurationMinutes)

  return (
    <div className="fm-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose() }}>
      <section className="fm-modal exm-form-modal" role="dialog" aria-modal="true">
        {/* Header */}
        <header className="fm-header">
          <div className="fm-header-icon" style={{ background: 'linear-gradient(135deg, #ecfdf5, #a7f3d0)', color: '#059669' }}>
            <i className="bi bi-person-walking" />
          </div>
          <div className="fm-header-text">
            <h2>{mode === 'add' ? 'Thêm bài tập mới vào Danh mục' : `Chỉnh sửa bài tập: ${editTarget?.name}`}</h2>
            <p>Chuẩn hóa thông tin và chỉ số MET theo quy chuẩn quốc tế Compendium of Physical Activities</p>
          </div>
          <button className="fm-close" onClick={onClose} disabled={saving} aria-label="Đóng"><i className="bi bi-x-lg" /></button>
        </header>

        {/* Body */}
        <form onSubmit={handleSubmit} className="fm-body">
          {/* Tên bài tập */}
          <div className="fm-section">
            <div className="fm-field">
              <label className="fm-label" htmlFor="ex-name">
                TÊN BÀI TẬP <span className="fm-req">*</span>
              </label>
              <input
                id="ex-name"
                name="name"
                className={`fm-input ${errors.name ? 'fm-input--err' : ''}`}
                value={form.name}
                onChange={change}
                placeholder="Ví dụ: Chạy bộ địa hình dốc, Đạp xe trong nhà..."
                autoFocus
              />
              {errors.name ? (
                <span className="fm-err-msg">{errors.name}</span>
              ) : (
                <span className="fm-hint"><i className="bi bi-info-circle" /> Tên bài tập đại diện cho hành vi vận động của người dùng</span>
              )}
            </div>
          </div>

          {/* Nhóm bài tập + Cường độ */}
          <div className="fm-section">
            <div className="fm-row fm-row--2">
              <div className="fm-field">
                <label className="fm-label" htmlFor="ex-category">NHÓM / THỂ LOẠI BÀI TẬP <span className="fm-req">*</span></label>
                <select id="ex-category" name="category" className="fm-input" value={form.category} onChange={change}>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
                <span className="fm-hint"><i className="bi bi-tag" /> Dùng để phân loại trên bộ lọc của người dùng</span>
              </div>

              <div className="fm-field">
                <label className="fm-label">MỨC ĐỘ / CƯỜNG ĐỘ <span className="fm-req">*</span></label>
                <div className="exm-intensity-selector">
                  {INTENSITIES.map((lvl) => (
                    <button
                      key={lvl.label}
                      type="button"
                      className={`exm-intensity-btn ${form.intensity === lvl.label ? 'active' : ''} ${lvl.cls}`}
                      onClick={() => setForm((p) => ({ ...p, intensity: lvl.label }))}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>
                <span className="fm-hint"><i className="bi bi-speedometer2" /> {INTENSITIES.find((i) => i.label === form.intensity)?.desc}</span>
              </div>
            </div>
          </div>

          {/* Giá trị MET + Thời lượng + Live Preview */}
          <div className="fm-section">
            <div className="fm-row fm-row--3">
              <div className="fm-field">
                <label className="fm-label" htmlFor="ex-met">
                  GIÁ TRỊ MET <span className="fm-req">*</span>
                </label>
                <input
                  id="ex-met"
                  name="met"
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="30"
                  className={`fm-input ${errors.met ? 'fm-input--err' : ''}`}
                  value={form.met}
                  onChange={change}
                  placeholder="3.8"
                />
                {errors.met ? (
                  <span className="fm-err-msg">{errors.met}</span>
                ) : (
                  <span className="fm-hint"><i className="bi bi-lightning-fill" /> 1 MET = 1 kcal/kg/h</span>
                )}
              </div>

              <div className="fm-field">
                <label className="fm-label" htmlFor="ex-dur">THỜI LƯỢNG GỢI Ý (PHÚT)</label>
                <input
                  id="ex-dur"
                  name="defaultDurationMinutes"
                  type="number"
                  min="1"
                  max="720"
                  className={`fm-input ${errors.defaultDurationMinutes ? 'fm-input--err' : ''}`}
                  value={form.defaultDurationMinutes}
                  onChange={change}
                  placeholder="30"
                />
                <span className="fm-hint"><i className="bi bi-clock" /> Mặc định gợi ý khi ghi nhận</span>
              </div>

              <div className="fm-field">
                <label className="fm-label">ƯỚC TÍNH NĂNG LƯỢNG</label>
                <div className="exm-live-kcal-box">
                  <span className="exm-live-kcal-icon"><i className="bi bi-fire" /></span>
                  <div>
                    <strong>~{previewKcal} kcal</strong>
                    <small>Người 60kg / {form.defaultDurationMinutes || 30}p</small>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Icon Picker */}
          <div className="fm-section">
            <div className="fm-field">
              <label className="fm-label">BIỂU TƯỢNG (ICON)</label>
              <div className="exm-icon-picker">
                {POPULAR_ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    className={`exm-icon-choice ${form.icon === ic ? 'active' : ''}`}
                    onClick={() => setForm((p) => ({ ...p, icon: ic }))}
                    title={ic}
                  >
                    <i className={`bi ${ic}`} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mô tả */}
          <div className="fm-section">
            <div className="fm-field">
              <label className="fm-label" htmlFor="ex-desc">MÔ TẢ CHI TIẾT &amp; HƯỚNG DẪN KỸ THUẬT</label>
              <textarea
                id="ex-desc"
                name="description"
                className="fm-input fm-textarea"
                rows="3"
                value={form.description}
                onChange={change}
                placeholder="Mô tả kỹ thuật thực hiện, nhóm cơ tác động chính và các lưu ý an toàn khi tập..."
              />
            </div>
          </div>

          {/* Trạng thái hiển thị */}
          <div className="fm-section">
            <label className="exm-switch-row">
              <input
                type="checkbox"
                name="isActive"
                checked={form.isActive}
                onChange={change}
              />
              <span className="exm-switch-label">
                <strong>Hiển thị ngay cho người dùng</strong>
                <small>Nếu tắt, bài tập sẽ ở trạng thái "Không hoạt động" (ẩn) và chỉ hiển thị trong trang quản trị.</small>
              </span>
            </label>
          </div>

          {/* Pinned Error Banner */}
          {apiError && (
            <div className="fm-api-err" role="alert">
              <i className="bi bi-exclamation-triangle-fill" /> {apiError}
            </div>
          )}

          {/* Footer */}
          <footer className="fm-footer">
            <button type="button" className="fm-btn-cancel" onClick={onClose} disabled={saving}>Hủy bỏ</button>
            <button type="submit" className="fm-btn-save" disabled={saving}>
              {saving ? (
                <><span className="food-spinner-inline" /> Đang lưu...</>
              ) : (
                <><i className="bi bi-check-lg" /> {mode === 'add' ? 'Lưu bài tập' : 'Cập nhật bài tập'}</>
              )}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ title, icon, iconClass, body, cancelLabel = 'Hủy', confirmLabel, confirmClass, onCancel, onConfirm, loading, extra }) {
  return (
    <div className="fm-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !loading) onCancel() }}>
      <section className="fm-confirm" role="dialog" aria-modal="true">
        <header className="fm-confirm-header">
          <span className={`fm-confirm-icon ${iconClass}`}><i className={icon} /></span>
          <h2>{title}</h2>
          <button className="fm-close" onClick={onCancel} disabled={loading}><i className="bi bi-x-lg" /></button>
        </header>
        <div className="fm-confirm-body">{body}</div>
        {extra && <div className="fm-confirm-extra">{extra}</div>}
        <footer className="fm-confirm-footer">
          <button className="fm-btn-cancel" onClick={onCancel} disabled={loading}>{cancelLabel}</button>
          <button className={`fm-confirm-action ${confirmClass}`} onClick={onConfirm} disabled={loading}>
            {loading ? <><span className="food-spinner-inline" />Đang xử lý...</> : confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  )
}

// ─── Main Component: ExerciseManagementPage (UC25) ───────────────────────────
export default function ExerciseManagementPage() {
  const [exercises, setExercises] = useState([])
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    hidden: 0,
    totalLogs: 0,
    categoryCounts: {},
  })
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  // Filters & Search
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [intensityFilter, setIntensityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)

  // Modals state
  const [modalMode, setModalMode] = useState(null) // 'add' | 'edit' | null
  const [editTarget, setEditTarget] = useState(null)
  const [detailTarget, setDetailTarget] = useState(null)
  const [hideTarget, setHideTarget] = useState(null)
  const [hideSaving, setHideSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteSaving, setDeleteSaving] = useState(false)
  const [deleteResult, setDeleteResult] = useState(null)

  // Toast
  const [toast, setToast] = useState(null)
  const toastTimeoutRef = useRef(null)

  function showToast(message, type = 'success') {
    clearTimeout(toastTimeoutRef.current)
    setToast({ message, type })
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3500)
  }

  function triggerRefresh() {
    setRefreshKey((k) => k + 1)
  }

  // ── Hide ──
  async function executeHide(exercise) {
    if (!exercise) return
    setHideSaving(true)
    try {
      await axiosInstance.patch(`/admin/exercises/${exercise._id}/status`, { isActive: false })
      showToast('Ẩn bài tập thành công')
      setHideTarget(null)
      setDeleteTarget(null)
      setDeleteResult(null)
      triggerRefresh()
    } catch (err) {
      showToast(err.response?.data?.message || 'Không thể cập nhật thông tin bài tập, vui lòng thử lại', 'error')
      setHideTarget(null)
    } finally {
      setHideSaving(false)
    }
  }

  // ── Show ──
  async function executeShow(exercise) {
    if (!exercise) return
    try {
      await axiosInstance.patch(`/admin/exercises/${exercise._id}/status`, { isActive: true })
      showToast('Hiển thị bài tập thành công')
      triggerRefresh()
    } catch (err) {
      showToast(err.response?.data?.message || 'Không thể cập nhật thông tin bài tập, vui lòng thử lại', 'error')
    }
  }

  // ── Delete ──
  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleteSaving(true)
    try {
      await axiosInstance.delete(`/admin/exercises/${deleteTarget._id}`)
      showToast('Xóa bài tập thành công')
      setDeleteTarget(null)
      setDeleteResult(null)
      triggerRefresh()
    } catch (err) {
      const { logCount, refCount, canHide } = err.response?.data || {}
      if ((err.response?.status === 400 || err.response?.status === 409) && (logCount !== undefined || refCount !== undefined)) {
        setDeleteResult({
          refCount: logCount ?? refCount,
          canHide: canHide !== false,
          message: err.response.data.message || 'Bài tập này đã có lượt ghi nhận từ người dùng. Hệ thống khuyến cáo bạn nên Ẩn bài tập thay vì xóa để bảo toàn dữ liệu lịch sử.',
        })
      } else {
        showToast(err.response?.data?.message || 'Không thể xóa bài tập, vui lòng thử lại', 'error')
        setDeleteTarget(null)
      }
    } finally {
      setDeleteSaving(false)
    }
  }

  // Fetch exercises list from server
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      setListError('')
      try {
        const { data } = await axiosInstance.get('/admin/exercises', {
          params: {
            search,
            category: categoryFilter,
            intensity: intensityFilter,
            status: statusFilter,
            sort: sortBy,
            page,
            limit: PAGE_SIZE,
          },
          signal: controller.signal,
        })
        setExercises(data.data || [])
        setPagination(data.pagination || { page, limit: PAGE_SIZE, total: 0, totalPages: 1 })
        setSummary(data.summary || { total: 0, active: 0, hidden: 0, totalLogs: 0, categoryCounts: {} })
      } catch (err) {
        if (err.code !== 'ERR_CANCELED') {
          setListError(err.response?.data?.message || 'Không thể tải danh sách bài tập, vui lòng thử lại')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, search ? 280 : 0)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [search, categoryFilter, intensityFilter, statusFilter, sortBy, page, refreshKey])

  const si = pagination.total ? (page - 1) * PAGE_SIZE + 1 : 0
  const ei = Math.min(page * PAGE_SIZE, pagination.total)

  return (
    <div className="fdm-shell exm-shell">
      {/* Toast */}
      {toast && (
        <div className={`fdm-toast ${toast.type === 'error' ? 'fdm-toast--err' : ''}`} role="alert">
          <i className={`bi ${toast.type === 'error' ? 'bi-exclamation-circle-fill' : 'bi-check-circle-fill'}`} />
          {toast.message}
        </div>
      )}

      {/* ── KPI Row ── */}
      <div className="fdm-kpi-row">
        <div className="fdm-kpi">
          <span className="fdm-kpi-icon fdm-kpi-icon--all">
            <i className="bi bi-collection-play-fill" />
          </span>
          <div>
            <p>Tổng danh mục bài tập</p>
            <strong>{summary.total.toLocaleString('vi-VN')}</strong>
          </div>
        </div>

        <div className="fdm-kpi">
          <span className="fdm-kpi-icon fdm-kpi-icon--active">
            <i className="bi bi-check-circle-fill" />
          </span>
          <div>
            <p>Đang hoạt động</p>
            <strong>{summary.active.toLocaleString('vi-VN')}</strong>
          </div>
        </div>

        <div className="fdm-kpi">
          <span className="fdm-kpi-icon fdm-kpi-icon--hidden">
            <i className="bi bi-eye-slash-fill" />
          </span>
          <div>
            <p>Không hoạt động (Đã ẩn)</p>
            <strong>{summary.hidden.toLocaleString('vi-VN')}</strong>
          </div>
        </div>

        <div className="fdm-kpi">
          <span className="fdm-kpi-icon" style={{ background: '#fdf4ff', color: '#a855f7' }}>
            <i className="bi bi-fire" />
          </span>
          <div>
            <p>Lượt ghi nhận tập luyện</p>
            <strong>{summary.totalLogs.toLocaleString('vi-VN')}</strong>
          </div>
        </div>

        <div className="fdm-kpi-actions">
          <button
            type="button"
            className="fdm-add-btn"
            onClick={() => {
              setModalMode('add')
              setEditTarget(null)
            }}
          >
            <i className="bi bi-plus-circle-fill" /> Thêm bài tập mới
          </button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="fdm-filters exm-filters">
        <label className="fdm-search-wrap">
          <i className="bi bi-search" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Tìm theo tên bài tập, mô tả..."
          />
          {search && (
            <button
              className="fdm-search-clear"
              onClick={() => {
                setSearch('')
                setPage(1)
              }}
            >
              <i className="bi bi-x-lg" />
            </button>
          )}
        </label>

        {/* Lọc theo Nhóm */}
        <label className="fdm-filter-select">
          <i className="bi bi-tags-fill" />
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="all">Tất cả thể loại</option>
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.label}</option>
            ))}
          </select>
        </label>

        {/* Lọc theo Cường độ */}
        <label className="fdm-filter-select">
          <i className="bi bi-speedometer2" />
          <select
            value={intensityFilter}
            onChange={(e) => {
              setIntensityFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="all">Tất cả cường độ</option>
            <option value="Nhẹ">Nhẹ (MET &lt; 3.0)</option>
            <option value="Trung bình">Trung bình (MET 3.0 - 6.0)</option>
            <option value="Cao">Cao (MET &gt; 6.0)</option>
          </select>
        </label>

        {/* Lọc theo Trạng thái */}
        <label className="fdm-filter-select">
          <i className="bi bi-funnel-fill" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="hidden">Không hoạt động (Đã ẩn)</option>
          </select>
        </label>

        {/* Sắp xếp */}
        <label className="fdm-filter-select">
          <i className="bi bi-sort-down" />
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value)
              setPage(1)
            }}
          >
            <option value="newest">Mới nhất (Mặc định)</option>
            <option value="a-z">Tên bài tập: A → Z</option>
            <option value="z-a">Tên bài tập: Z → A</option>
            <option value="met_desc">MET: Cao → Thấp</option>
            <option value="met_asc">MET: Thấp → Cao</option>
            <option value="oldest">Cũ nhất</option>
          </select>
        </label>

        <span className="fdm-result-count">
          {!loading && `${pagination.total.toLocaleString('vi-VN')} bài tập`}
        </span>
      </div>

      {/* ── Table Panel ── */}
      <div className="fdm-panel">
        {listError ? (
          <div className="fdm-state-msg fdm-state-msg--err">
            <i className="bi bi-exclamation-octagon-fill" />
            <span>{listError}</span>
            <button onClick={() => { setListError(''); triggerRefresh() }}>Thử lại</button>
          </div>
        ) : (
          <div className="fdm-table-scroll">
            <table className="fdm-table">
              <thead>
                <tr>
                  <th className="fdm-th-center" style={{ width: 48 }}>#</th>
                  <th style={{ width: '27%', minWidth: 200 }}>Bài tập thể chất</th>
                  <th style={{ width: '18%', minWidth: 140 }}>Nhóm thể loại</th>
                  <th className="fdm-th-center" style={{ width: '13%', minWidth: 105 }}>Cường độ</th>
                  <th className="fdm-th-center" style={{ width: '12%', minWidth: 95 }}>Chỉ số MET</th>
                  <th className="fdm-th-center" style={{ width: '16%', minWidth: 130 }}>Trạng thái</th>
                  <th className="fdm-th-center" style={{ width: 135 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="fdm-td-msg">
                      <span className="food-spinner" /> Đang tải danh mục bài tập...
                    </td>
                  </tr>
                ) : exercises.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="fdm-td-msg fdm-td-empty">
                      <i className="bi bi-inbox" />
                      <span>Không tìm thấy bài tập phù hợp với bộ lọc hiện tại</span>
                    </td>
                  </tr>
                ) : (
                  exercises.map((ex, idx) => {
                    const isHidden = !ex.isActive
                    const cat = getCategoryMeta(ex.category)

                    return (
                      <tr key={ex._id} className={isHidden ? 'fdm-row--dim' : ''}>
                        <td className="fdm-td-center fdm-td-idx">{si + idx}</td>
                        <td>
                          <div className="fdm-food-cell">
                            <span className="exm-icon-badge">
                              <i className={`bi ${ex.icon || 'bi-activity'}`} />
                            </span>
                            <div className="fdm-food-info">
                              <strong>{ex.name}</strong>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="fdm-group-chip">
                            <i className={`bi ${cat.icon}`} /> {ex.categoryName || cat.label}
                          </span>
                        </td>
                        <td className="fdm-td-center">
                          <span className={`ex-chip ${getIntensityCls(ex.intensity)}`}>
                            {ex.intensity}
                          </span>
                        </td>
                        <td className="fdm-td-center">
                          <span className="exm-met-badge">
                            MET <strong>{Number(ex.met).toFixed(1)}</strong>
                          </span>
                        </td>
                        <td className="fdm-td-center">
                          <span className={`fdm-status ${isHidden ? 'fdm-status--hidden' : 'fdm-status--active'}`}>
                            <i />{isHidden ? 'Không hoạt động' : 'Đang hoạt động'}
                          </span>
                        </td>
                        <td className="fdm-td-center">
                          <div className="fdm-actions fdm-actions--center">
                            {/* Nút Xem chi tiết */}
                            <button
                              type="button"
                              className="fdm-btn fdm-btn--view"
                              onClick={() => setDetailTarget(ex)}
                              title="Xem chi tiết bài tập"
                            >
                              <i className="bi bi-eye" />
                            </button>

                            {/* Nút Chỉnh sửa */}
                            <button
                              type="button"
                              className="fdm-btn fdm-btn--edit"
                              onClick={() => {
                                setEditTarget(ex)
                                setModalMode('edit')
                              }}
                              title="Chỉnh sửa thông tin"
                            >
                              <i className="bi bi-pencil-fill" />
                            </button>

                            {/* Nút Ẩn / Hiển thị */}
                            {isHidden ? (
                              <button
                                type="button"
                                className="fdm-btn fdm-btn--show"
                                onClick={() => executeShow(ex)}
                                title="Hiển thị lại bài tập"
                              >
                                <i className="bi bi-eye-fill" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="fdm-btn fdm-btn--hide"
                                onClick={() => setHideTarget(ex)}
                                title="Ẩn bài tập"
                              >
                                <i className="bi bi-eye-slash-fill" />
                              </button>
                            )}

                            {/* Nút Xóa */}
                            <button
                              type="button"
                              className="fdm-btn fdm-btn--del"
                              onClick={() => {
                                setDeleteTarget(ex)
                                setDeleteResult(null)
                              }}
                              title="Xóa bài tập"
                            >
                              <i className="bi bi-trash3-fill" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ── */}
        {!loading && !listError && pagination.totalPages > 1 && (
          <footer className="fdm-pagination">
            <span className="fdm-page-info">Hiển thị {si}-{ei} / {pagination.total.toLocaleString('vi-VN')} bài tập</span>
            <div className="fdm-page-btns">
              <button disabled={page <= 1} onClick={() => setPage(1)} title="Trang đầu"><i className="bi bi-chevron-double-left" /></button>
              <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} title="Trang trước"><i className="bi bi-chevron-left" /></button>
              {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
                const f = Math.max(1, Math.min(page - 3, pagination.totalPages - 6))
                const pn = f + i
                return <button key={pn} type="button" className={pn === page ? 'active' : ''} onClick={() => setPage(pn)}>{pn}</button>
              })}
              <button disabled={page >= pagination.totalPages} onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} title="Trang sau"><i className="bi bi-chevron-right" /></button>
              <button disabled={page >= pagination.totalPages} onClick={() => setPage(pagination.totalPages)} title="Trang cuối"><i className="bi bi-chevron-double-right" /></button>
            </div>
          </footer>
        )}
      </div>

      {/* ── Modals ── */}
      {modalMode && (
        <ExerciseFormModal
          mode={modalMode}
          editTarget={editTarget}
          onClose={() => {
            setModalMode(null)
            setEditTarget(null)
          }}
          onSaved={(msg) => {
            setModalMode(null)
            setEditTarget(null)
            showToast(msg)
            triggerRefresh()
          }}
        />
      )}

      {detailTarget && (
        <ExerciseDetailModal
          exercise={detailTarget}
          onClose={() => setDetailTarget(null)}
          onEdit={(ex) => {
            setDetailTarget(null)
            setEditTarget(ex)
            setModalMode('edit')
          }}
          onToggleStatus={(ex) => {
            setDetailTarget(null)
            if (ex.isActive) {
              setHideTarget(ex)
            } else {
              executeShow(ex)
            }
          }}
        />
      )}

      {/* ─── Hide Confirm ─── */}
      {hideTarget && (
        <ConfirmModal
          title="Ẩn bài tập"
          icon="bi bi-eye-slash-fill"
          iconClass="fci--warn"
          body={<>Ẩn <strong>"{hideTarget.name}"</strong> sẽ ngừng hiển thị trong danh mục ghi nhận bài tập của người dùng. Dữ liệu lịch sử đã ghi nhận vẫn được giữ nguyên. Tiếp tục?</>}
          confirmLabel={<><i className="bi bi-eye-slash" />Xác nhận ẩn</>}
          confirmClass="fca--warn"
          loading={hideSaving}
          onCancel={() => setHideTarget(null)}
          onConfirm={() => executeHide(hideTarget)}
        />
      )}

      {/* ─── Delete Confirm ─── */}
      {deleteTarget && !deleteResult && (
        <ConfirmModal
          title="Xóa vĩnh viễn bài tập"
          icon="bi bi-trash3-fill"
          iconClass="fci--danger"
          body={<>Bạn có chắc muốn xóa vĩnh viễn <strong>"{deleteTarget.name}"</strong>? Hệ thống sẽ kiểm tra xem bài tập này có trong nhật ký của người dùng không trước khi xóa.</>}
          confirmLabel={<><i className="bi bi-trash3" />Xóa vĩnh viễn</>}
          confirmClass="fca--danger"
          loading={deleteSaving}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}

      {/* ─── Cannot Delete (đang có dữ liệu tham chiếu) ─── */}
      {deleteTarget && deleteResult && (
        <ConfirmModal
          title="Không thể xóa"
          icon="bi bi-shield-exclamation"
          iconClass="fci--warn"
          body={<p className="fdm-blocked-msg">{deleteResult.message}</p>}
          cancelLabel="Giữ nguyên"
          confirmLabel={deleteResult.canHide ? <><i className="bi bi-eye-slash" />Ẩn thay vì xóa</> : null}
          confirmClass="fca--warn"
          loading={hideSaving}
          onCancel={() => { setDeleteTarget(null); setDeleteResult(null) }}
          onConfirm={deleteResult.canHide ? () => executeHide(deleteTarget) : null}
        />
      )}
    </div>
  )
}
