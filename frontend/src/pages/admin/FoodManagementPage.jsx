import { useCallback, useEffect, useRef, useState } from 'react'
import axiosInstance from '../../api/axiosInstance'

// ─── Constants ───────────────────────────────────────────────────────────────
const FOOD_GROUPS = [
  'Bún / Mì / Phở',
  'Cơm / Xôi',
  'Bánh / Dimsum',
  'Bánh mì / Sandwich',
  'Nướng / Kho / Xào',
  'Canh / Cháo / Lẩu',
  'Salad / Gỏi',
  'Ăn vặt / Đường phố',
  'Tráng miệng / Chè',
  'Đồ uống',
  'Khác',
]

const SERVING_PRESETS = [
  { label: '1 Chén (150g)', value: '150' },
  { label: '1 Tô vừa (400g)', value: '400' },
  { label: '1 Tô lớn (550g)', value: '550' },
  { label: '1 Đĩa vừa (250g)', value: '250' },
  { label: '1 Suất (100g)', value: '100' },
  { label: '1 Ổ / Cái (200g)', value: '200' },
]

const EMPTY_FORM = {
  name: '', foodGroup: '', servingLabel: '',
  calories: '', protein: '', fat: '', carbs: '',
  servingSize: '100', imageUrl: '', description: '',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getImageUrl(url) {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `${axiosInstance.defaults.baseURL.replace(/\/api\/?$/, '')}${url}`
}

function validate(form) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'Tên món ăn không được để trống'
  for (const f of ['calories', 'protein', 'fat', 'carbs']) {
    const v = Number(form[f])
    if (form[f] === '' || !Number.isFinite(v) || v < 0) errors[f] = 'Phải là số ≥ 0'
  }
  const sv = Number(form.servingSize)
  if (!Number.isFinite(sv) || sv <= 0) errors.servingSize = 'Phải là số dương'
  return errors
}

function calcServingKcal(form) {
  const sv = parseFloat(form.servingSize)
  const cal = parseFloat(form.calories)
  if (!sv || sv <= 0 || !cal || cal < 0) return null
  return Math.round(cal * sv / 100)
}

function nutrientPercent(form) {
  const p = parseFloat(form.protein) || 0
  const c = parseFloat(form.carbs) || 0
  const f = parseFloat(form.fat) || 0
  const total = p * 4 + c * 4 + f * 9
  if (!total) return { p: 0, c: 0, f: 0 }
  return {
    p: Math.round((p * 4 / total) * 100),
    c: Math.round((c * 4 / total) * 100),
    f: Math.round((f * 9 / total) * 100),
  }
}

// ─── FoodFormModal ────────────────────────────────────────────────────────────
function FoodFormModal({ mode, editTarget, totalFoods, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [saving, setSaving] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)

  useEffect(() => {
    if (mode === 'edit' && editTarget) {
      setForm({
        name: editTarget.name || '',
        foodGroup: editTarget.foodGroup || '',
        servingLabel: SERVING_PRESETS.find((p) => String(p.value) === String(editTarget.servingSize))?.label || '',
        calories: String(editTarget.calories ?? ''),
        protein: String(editTarget.protein ?? ''),
        fat: String(editTarget.fat ?? ''),
        carbs: String(editTarget.carbs ?? ''),
        servingSize: String(editTarget.servingSize ?? '100'),
        imageUrl: editTarget.imageUrl || '',
        description: editTarget.description || '',
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setErrors({})
    setApiError('')
  }, [mode, editTarget])

  function change(e) {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
    setErrors((p) => ({ ...p, [name]: undefined }))
    setApiError('')
  }

  function applyPreset(value) {
    const preset = SERVING_PRESETS.find((p) => p.value === value)
    setForm((p) => ({ ...p, servingSize: value, servingLabel: preset?.label || '' }))
    setErrors((p) => ({ ...p, servingSize: undefined }))
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && /^image\/(jpeg|png|webp)$/.test(file.type))
      setForm((p) => ({ ...p, imageUrl: URL.createObjectURL(file) }))
  }, [])

  async function submit() {
    const errs = validate(form)
    if (Object.keys(errs).length) { setErrors(errs); return }
    setSaving(true); setApiError('')
    try {
      const payload = {
        name: form.name, foodGroup: form.foodGroup,
        calories: form.calories, protein: form.protein,
        fat: form.fat, carbs: form.carbs,
        servingSize: form.servingSize,
        imageUrl: form.imageUrl, description: form.description,
      }
      if (mode === 'add') await axiosInstance.post('/admin/foods', payload)
      else await axiosInstance.put(`/admin/foods/${editTarget._id}`, payload)
      onSaved(mode === 'add' ? 'Thêm món ăn thành công' : 'Cập nhật món ăn thành công')
    } catch (err) {
      setApiError(err.response?.data?.message || 'Thao tác thất bại, vui lòng thử lại')
    } finally { setSaving(false) }
  }

  const servingKcal = calcServingKcal(form)
  const pct = nutrientPercent(form)

  return (
    <div className="fm-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <section className="fm-modal" role="dialog" aria-modal="true">

        {/* Header */}
        <header className="fm-header">
          <div className="fm-header-icon">
            <i className="bi bi-basket2-fill" />
          </div>
          <div className="fm-header-text">
            <h2>{mode === 'add' ? 'Thêm món ăn mới vào Danh mục' : `Chỉnh sửa: ${editTarget?.name}`}</h2>
            <p>Chuẩn hóa dữ liệu dinh dưỡng theo bảng thành phần thực phẩm Viện Dinh Dưỡng</p>
          </div>
          <button className="fm-close" onClick={onClose} aria-label="Đóng"><i className="bi bi-x-lg" /></button>
        </header>

        {/* Body */}
        <div className="fm-body">

          {/* ── Tên + Mã ── */}
          <div className="fm-section">
            <div className="fm-row fm-row--2">
              <div className="fm-field fm-field--grow">
                <label className="fm-label" htmlFor="fm-name">TÊN MÓN ĂN CHÍNH THỨC <span className="fm-req">*</span></label>
                <input id="fm-name" name="name" className={`fm-input ${errors.name ? 'fm-input--err' : ''}`}
                  value={form.name} onChange={change}
                  placeholder="Ví dụ: Phở bò tái nạm Nam Định" />
                {errors.name
                  ? <span className="fm-err-msg">{errors.name}</span>
                  : <span className="fm-hint"><i className="bi bi-info-circle" /> Kiểm tra tự động trùng lặp với {totalFoods} món hiện có</span>}
              </div>
              <div className="fm-field">
                <label className="fm-label">MÃ MÓN (FOOD CODE)</label>
                <div className="fm-code-badge">
                  <i className="bi bi-upc-scan" />
                  <span>{mode === 'edit' && editTarget?.foodCode ? editTarget.foodCode : 'Auto-generate'}</span>
                </div>
                <span className="fm-hint"><i className="bi bi-robot" /> Hệ thống tự tạo khi lưu</span>
              </div>
            </div>
          </div>

          {/* ── Nhóm + Khẩu phần ── */}
          <div className="fm-section">
            <div className="fm-row fm-row--3">
              <div className="fm-field">
                <label className="fm-label" htmlFor="fm-group">NHÓM THỰC PHẨM</label>
                <select id="fm-group" name="foodGroup" className="fm-select" value={form.foodGroup} onChange={change}>
                  <option value="">-- Chọn nhóm --</option>
                  {FOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div className="fm-field">
                <label className="fm-label" htmlFor="fm-preset">ĐƠN VỊ KHẨU PHẦN</label>
                <select id="fm-preset" className="fm-select"
                  value={SERVING_PRESETS.find((p) => p.value === form.servingSize)?.value || ''}
                  onChange={(e) => applyPreset(e.target.value)}>
                  <option value="">-- Chọn preset --</option>
                  {SERVING_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div className="fm-field">
                <label className="fm-label" htmlFor="fm-sv">TRỌNG LƯỢNG (G/ML) <span className="fm-req">*</span></label>
                <div className="fm-suffix-wrap">
                  <input id="fm-sv" name="servingSize" type="number" min="1" step="1"
                    className={`fm-input fm-input--suffix ${errors.servingSize ? 'fm-input--err' : ''}`}
                    value={form.servingSize} onChange={change} />
                  <span className="fm-suffix">gram</span>
                </div>
                {errors.servingSize && <span className="fm-err-msg">{errors.servingSize}</span>}
              </div>
            </div>
          </div>

          {/* ── Dinh dưỡng ── */}
          <div className="fm-nutrition-card">
            <div className="fm-nutrition-head">
              <span className="fm-nutrition-emoji">🥗</span>
              <div>
                <strong>THÀNH PHẦN DINH DƯỠNG CHUẨN</strong>
                <span>trên 100g thực phẩm</span>
              </div>
              {servingKcal !== null && (
                <div className="fm-kcal-badge">
                  Quy đổi cho {form.servingSize}g<b> ~{servingKcal} kcal</b>
                </div>
              )}
            </div>

            <div className="fm-nutrients">
              {[
                { key: 'calories', label: 'Năng lượng (Calo)', unit: 'kcal', color: 'cal', icon: '🔥' },
                { key: 'protein',  label: 'Chất đạm (Protein)', unit: 'g',    color: 'pro', icon: '💪' },
                { key: 'carbs',    label: 'Đường bột (Carbs)',  unit: 'g',    color: 'carb', icon: '🌾' },
                { key: 'fat',      label: 'Chất béo (Fat)',     unit: 'g',    color: 'fat', icon: '🫒' },
              ].map(({ key, label, unit, color, icon }) => (
                <div key={key} className={`fm-nutrient fm-nutrient--${color}`}>
                  <div className="fm-nutrient-label"><span>{icon}</span>{label}</div>
                  <div className="fm-nutrient-input-wrap">
                    <input id={`fm-${key}`} name={key} type="number" min="0" step="0.1"
                      className={`fm-nutrient-input ${errors[key] ? 'fm-input--err' : ''}`}
                      value={form[key]} onChange={change} placeholder="0" />
                    <span className="fm-nutrient-unit">{unit}</span>
                  </div>
                  {errors[key] && <span className="fm-err-msg">{errors[key]}</span>}
                </div>
              ))}
            </div>

            {/* Macro ratio bar */}
            {(pct.p + pct.c + pct.f) > 0 && (
              <div className="fm-macro-bar-wrap">
                <div className="fm-macro-bar">
                  <div className="fm-macro-seg fm-macro-seg--pro" style={{ width: `${pct.p}%` }} title={`Protein ${pct.p}%`} />
                  <div className="fm-macro-seg fm-macro-seg--carb" style={{ width: `${pct.c}%` }} title={`Carbs ${pct.c}%`} />
                  <div className="fm-macro-seg fm-macro-seg--fat" style={{ width: `${pct.f}%` }} title={`Fat ${pct.f}%`} />
                </div>
                <div className="fm-macro-legend">
                  <span><i style={{ background: '#1a5fa0' }} />Protein {pct.p}%</span>
                  <span><i style={{ background: '#a06010' }} />Carbs {pct.c}%</span>
                  <span><i style={{ background: '#a01f1f' }} />Fat {pct.f}%</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Ảnh ── */}
          <div className="fm-section-label">HÌNH ẢNH ĐẠI DIỆN & NHÃN AI LENS</div>
          <div
            className={`fm-dropzone ${dragging ? 'fm-dropzone--over' : ''} ${form.imageUrl ? 'fm-dropzone--filled' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false) }}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            role="button" tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) setForm((p) => ({ ...p, imageUrl: URL.createObjectURL(f) })); e.target.value = '' }} />
            {form.imageUrl ? (
              <div className="fm-preview">
                <img src={getImageUrl(form.imageUrl)} alt="" />
                <button className="fm-preview-remove" type="button"
                  onClick={(e) => { e.stopPropagation(); setForm((p) => ({ ...p, imageUrl: '' })) }}>
                  <i className="bi bi-x-circle-fill" />
                </button>
              </div>
            ) : (
              <div className="fm-drop-placeholder">
                <span className="fm-drop-icon"><i className="bi bi-cloud-arrow-up-fill" /></span>
                <p>Kéo thả ảnh món ăn hoặc <span className="fm-link">chọn từ máy tính</span></p>
                <small>JPG, PNG, WEBP — tối đa 5MB</small>
              </div>
            )}
          </div>
          <div className="fm-field">
            <label className="fm-label" htmlFor="fm-url">Hoặc nhập URL ảnh trực tiếp</label>
            <input id="fm-url" name="imageUrl" className="fm-input" value={form.imageUrl} onChange={change} placeholder="https://..." />
          </div>

          {/* ── Mô tả ── */}
          <div className="fm-field">
            <label className="fm-label" htmlFor="fm-desc">MÔ TẢ MÓN ĂN</label>
            <textarea id="fm-desc" name="description" className="fm-input fm-textarea" rows="3"
              value={form.description} onChange={change}
              placeholder="Nguyên liệu chính, đặc trưng vùng miền, cách chế biến..." />
          </div>

          {apiError && (
            <div className="fm-api-err" role="alert">
              <i className="bi bi-exclamation-triangle-fill" />{apiError}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="fm-footer">
          <button className="fm-btn-cancel" onClick={onClose}>Hủy bỏ</button>
          <button className="fm-btn-save" onClick={submit} disabled={saving}>
            {saving
              ? <><span className="food-spinner-inline" />Đang lưu...</>
              : <><i className="bi bi-check-lg" />{mode === 'add' ? 'Thêm vào danh mục' : 'Lưu thay đổi'}</>}
          </button>
        </footer>
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function FoodManagementPage() {
  const [foods, setFoods] = useState([])
  const [summary, setSummary] = useState({ total: 0, active: 0, hidden: 0 })
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 })
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  const [formMode, setFormMode] = useState(null)
  const [editTarget, setEditTarget] = useState(null)

  const [hideTarget, setHideTarget] = useState(null)
  const [hideSaving, setHideSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteResult, setDeleteResult] = useState(null)
  const [deleteSaving, setDeleteSaving] = useState(false)

  const [toast, setToast] = useState(null)
  const toastRef = useRef(null)

  function showToast(message, type = 'success') {
    clearTimeout(toastRef.current)
    setToast({ message, type })
    toastRef.current = setTimeout(() => setToast(null), 3500)
  }

  useEffect(() => {
    const ctrl = new AbortController()
    const t = window.setTimeout(async () => {
      setLoading(true); setListError('')
      try {
        const { data } = await axiosInstance.get('/admin/foods', {
          params: { search, status: statusFilter, foodGroup: groupFilter, page, limit: 20 },
          signal: ctrl.signal,
        })
        setFoods(data.data || [])
        setPagination(data.pagination || { page, total: 0, totalPages: 0 })
        setSummary(data.summary || { total: 0, active: 0, hidden: 0 })
      } catch (err) {
        if (err.code !== 'ERR_CANCELED') setListError(err.response?.data?.message || 'Không thể tải danh sách, vui lòng thử lại')
      } finally { if (!ctrl.signal.aborted) setLoading(false) }
    }, search ? 280 : 0)
    return () => { window.clearTimeout(t); ctrl.abort() }
  }, [search, statusFilter, groupFilter, page, refreshKey])

  function refresh() { setRefreshKey((k) => k + 1) }

  function handleSaved(msg) {
    setFormMode(null); setEditTarget(null)
    showToast(msg); refresh()
  }

  // ── Hide ──
  async function executeHide(food) {
    setHideSaving(true)
    try {
      await axiosInstance.patch(`/admin/foods/${food._id}/status`, { status: 'hidden' })
      showToast('Ẩn món ăn thành công')
      setHideTarget(null); setDeleteTarget(null); setDeleteResult(null)
      refresh()
    } catch (err) {
      showToast(err.response?.data?.message || 'Thao tác thất bại, vui lòng thử lại', 'error')
      setHideTarget(null)
    } finally { setHideSaving(false) }
  }

  async function executeShow(food) {
    try {
      await axiosInstance.patch(`/admin/foods/${food._id}/status`, { status: 'active' })
      showToast('Hiển thị lại món ăn thành công'); refresh()
    } catch (err) {
      showToast(err.response?.data?.message || 'Thao tác thất bại, vui lòng thử lại', 'error')
    }
  }

  // ── Delete ──
  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleteSaving(true)
    try {
      await axiosInstance.delete(`/admin/foods/${deleteTarget._id}`)
      showToast('Xóa món ăn thành công')
      setDeleteTarget(null); setDeleteResult(null); refresh()
    } catch (err) {
      const { refCount, canHide } = err.response?.data || {}
      if (err.response?.status === 409 && refCount !== undefined) {
        setDeleteResult({ refCount, canHide, message: err.response.data.message })
      } else {
        showToast(err.response?.data?.message || 'Thao tác thất bại', 'error')
        setDeleteTarget(null)
      }
    } finally { setDeleteSaving(false) }
  }

  const si = pagination.total ? (page - 1) * 20 + 1 : 0
  const ei = Math.min(page * 20, pagination.total)

  return (
    <div className="fdm-shell">

      {/* Toast */}
      {toast && (
        <div className={`fdm-toast ${toast.type === 'error' ? 'fdm-toast--err' : ''}`} role="alert">
          <i className={`bi ${toast.type === 'error' ? 'bi-exclamation-circle-fill' : 'bi-check-circle-fill'}`} />
          {toast.message}
        </div>
      )}

      {/* ── KPI row ── */}
      <div className="fdm-kpi-row">
        <div className="fdm-kpi">
          <span className="fdm-kpi-icon fdm-kpi-icon--all"><i className="bi bi-grid-1x2-fill" /></span>
          <div><p>Tổng danh mục</p><strong>{summary.total.toLocaleString('vi-VN')}</strong></div>
        </div>
        <div className="fdm-kpi">
          <span className="fdm-kpi-icon fdm-kpi-icon--active"><i className="bi bi-check-circle-fill" /></span>
          <div><p>Đang hiển thị</p><strong>{summary.active.toLocaleString('vi-VN')}</strong></div>
        </div>
        <div className="fdm-kpi">
          <span className="fdm-kpi-icon fdm-kpi-icon--hidden"><i className="bi bi-eye-slash-fill" /></span>
          <div><p>Đã ẩn</p><strong>{summary.hidden.toLocaleString('vi-VN')}</strong></div>
        </div>
        <button className="fdm-add-btn" onClick={() => setFormMode('add')}>
          <i className="bi bi-plus-circle-fill" />Thêm món ăn mới
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div className="fdm-filters">
        <label className="fdm-search-wrap">
          <i className="bi bi-search" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Tìm theo tên món ăn..." />
          {search && <button className="fdm-search-clear" onClick={() => { setSearch(''); setPage(1) }}><i className="bi bi-x-lg" /></button>}
        </label>

        <label className="fdm-filter-select">
          <i className="bi bi-funnel-fill" />
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}>
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang sử dụng</option>
            <option value="hidden">Đã ẩn</option>
          </select>
        </label>

        <label className="fdm-filter-select">
          <i className="bi bi-tags-fill" />
          <select value={groupFilter} onChange={(e) => { setGroupFilter(e.target.value); setPage(1) }}>
            <option value="all">Tất cả nhóm</option>
            {FOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>

        <span className="fdm-result-count">
          {!loading && `${pagination.total.toLocaleString('vi-VN')} kết quả`}
        </span>
      </div>

      {/* ── Table panel ── */}
      <div className="fdm-panel">
        {listError ? (
          <div className="fdm-state-msg fdm-state-msg--err">
            <i className="bi bi-exclamation-octagon-fill" />
            <span>{listError}</span>
            <button onClick={() => { setListError(''); refresh() }}>Thử lại</button>
          </div>
        ) : (
          <div className="fdm-table-scroll">
            <table className="fdm-table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>#</th>
                  <th>Món ăn</th>
                  <th>Nhóm</th>
                  <th>Mã món</th>
                  <th className="fdm-th-num">Calo</th>
                  <th className="fdm-th-num">Protein</th>
                  <th className="fdm-th-num">Carbs</th>
                  <th className="fdm-th-num">Fat</th>
                  <th className="fdm-th-num">KP (g)</th>
                  <th>Trạng thái</th>
                  <th style={{ width: 110 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="11" className="fdm-td-msg">
                    <span className="food-spinner" />Đang tải danh sách...
                  </td></tr>
                ) : foods.length === 0 ? (
                  <tr><td colSpan="11" className="fdm-td-msg fdm-td-empty">
                    <i className="bi bi-inbox" /><span>Không tìm thấy món ăn phù hợp</span>
                  </td></tr>
                ) : foods.map((food, idx) => {
                  const isHidden = (food.status || 'active') === 'hidden'
                  return (
                    <tr key={food._id} className={isHidden ? 'fdm-row--dim' : ''}>
                      <td className="fdm-td-idx">{si + idx}</td>
                      <td>
                        <div className="fdm-food-cell">
                          <span className="fdm-thumb">
                            {food.imageUrl
                              ? <img src={getImageUrl(food.imageUrl)} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                              : <span>🍽</span>}
                          </span>
                          <div className="fdm-food-info">
                            <strong>{food.name}</strong>
                            <small>{food.slug}</small>
                          </div>
                        </div>
                      </td>
                      <td><span className="fdm-group-chip">{food.foodGroup || '—'}</span></td>
                      <td><code className="fdm-code">{food.foodCode || '—'}</code></td>
                      <td className="fdm-td-num fdm-num--cal">{food.calories}</td>
                      <td className="fdm-td-num fdm-num--pro">{food.protein}</td>
                      <td className="fdm-td-num fdm-num--carb">{food.carbs}</td>
                      <td className="fdm-td-num fdm-num--fat">{food.fat}</td>
                      <td className="fdm-td-num">{food.servingSize}g</td>
                      <td>
                        <span className={`fdm-status ${isHidden ? 'fdm-status--hidden' : 'fdm-status--active'}`}>
                          <i />{isHidden ? 'Đã ẩn' : 'Hiển thị'}
                        </span>
                      </td>
                      <td>
                        <div className="fdm-actions">
                          <button className="fdm-btn fdm-btn--edit" onClick={() => { setEditTarget(food); setFormMode('edit') }} title="Sửa">
                            <i className="bi bi-pencil-fill" />
                          </button>
                          {isHidden ? (
                            <button className="fdm-btn fdm-btn--show" onClick={() => executeShow(food)} title="Hiển thị lại">
                              <i className="bi bi-eye-fill" />
                            </button>
                          ) : (
                            <button className="fdm-btn fdm-btn--hide" onClick={() => setHideTarget(food)} title="Ẩn">
                              <i className="bi bi-eye-slash-fill" />
                            </button>
                          )}
                          <button className="fdm-btn fdm-btn--del" onClick={() => { setDeleteTarget(food); setDeleteResult(null) }} title="Xóa">
                            <i className="bi bi-trash3-fill" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && !listError && pagination.totalPages > 0 && (
          <footer className="fdm-pagination">
            <span className="fdm-page-info">Hiển thị {si}–{ei} / {pagination.total.toLocaleString('vi-VN')} món ăn</span>
            <div className="fdm-page-btns">
              <button disabled={page <= 1} onClick={() => setPage(1)} title="Trang đầu"><i className="bi bi-chevron-double-left" /></button>
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><i className="bi bi-chevron-left" /></button>
              {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
                const f = Math.max(1, Math.min(page - 3, pagination.totalPages - 6))
                const pn = f + i
                return <button key={pn} className={pn === page ? 'active' : ''} onClick={() => setPage(pn)}>{pn}</button>
              })}
              <button disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}><i className="bi bi-chevron-right" /></button>
              <button disabled={page >= pagination.totalPages} onClick={() => setPage(pagination.totalPages)} title="Trang cuối"><i className="bi bi-chevron-double-right" /></button>
            </div>
          </footer>
        )}
      </div>

      {/* ─── Form Modal ─── */}
      {formMode && (
        <FoodFormModal
          mode={formMode}
          editTarget={editTarget}
          totalFoods={summary.total}
          onClose={() => { setFormMode(null); setEditTarget(null) }}
          onSaved={handleSaved}
        />
      )}

      {/* ─── Hide Confirm ─── */}
      {hideTarget && (
        <ConfirmModal
          title="Ẩn món ăn"
          icon="bi bi-eye-slash-fill"
          iconClass="fci--warn"
          body={<>Ẩn <strong>"{hideTarget.name}"</strong> sẽ ngừng hiển thị trong tìm kiếm và kết quả AI Lens. Dữ liệu lịch sử MealLog của người dùng vẫn được giữ nguyên. Tiếp tục?</>}
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
          title="Xóa vĩnh viễn món ăn"
          icon="bi bi-trash3-fill"
          iconClass="fci--danger"
          body={<>Bạn có chắc muốn xóa vĩnh viễn <strong>"{deleteTarget.name}"</strong>? Hệ thống sẽ kiểm tra xem món này có trong nhật ký bữa ăn không trước khi xóa.</>}
          confirmLabel={<><i className="bi bi-trash3" />Xóa vĩnh viễn</>}
          confirmClass="fca--danger"
          loading={deleteSaving}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}

      {/* ─── Cannot Delete (đang được tham chiếu) ─── */}
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
