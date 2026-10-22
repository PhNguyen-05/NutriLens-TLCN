import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axiosInstance from '../../api/axiosInstance'

// ─── Constants ───────────────────────────────────────────────────────────────
const DEFAULT_FOOD_GROUPS = [
  'Cơm & Xôi',
  'Bún, Mì & Phở',
  'Bánh mì & Sandwich',
  'Bánh truyền thống & Dimsum',
  'Món thịt, cá & Hải sản',
  'Canh, Cháo & Súp',
  'Rau, Gỏi & Salad',
  'Ăn vặt & Đường phố',
  'Tráng miệng & Chè',
  'Đồ uống & Giải khát',
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

const PAGE_SIZE = 10

const EMPTY_FORM = {
  name: '', foodGroup: '', servingLabel: '',
  calories: '', protein: '', fat: '', carbs: '',
  servingSize: '100', imageUrl: '', description: '',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getImageUrl(url) {
  if (!url) return ''
  if (/^(https?:|data:|blob:)/i.test(url)) return url
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

// ─── FoodDetailModal (Xem chi tiết món ăn) ──────────────────────────────────
function FoodDetailModal({ food, onClose, onEdit }) {
  const [detailData, setDetailData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!food?._id) return
    let active = true
    axiosInstance.get(`/admin/foods/${food._id}`)
      .then(({ data }) => { if (active) setDetailData(data.data) })
      .catch(() => { if (active) setDetailData(food) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [food])

  const item = detailData || food
  if (!item) return null

  const isHidden = (item.status || 'active') === 'hidden'
  const servingSize = item.servingSize || 100
  const ratio = servingSize / 100
  const calPerServing = Math.round((item.calories || 0) * ratio)
  const proPerServing = ((item.protein || 0) * ratio).toFixed(1)
  const carbPerServing = ((item.carbs || 0) * ratio).toFixed(1)
  const fatPerServing = ((item.fat || 0) * ratio).toFixed(1)
  const pct = nutrientPercent(item)

  return (
    <div className="fm-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <section className="fm-detail-modal" role="dialog" aria-modal="true">
        <header className="fm-detail-header">
          <div className="fm-detail-heading">
            <span className="fm-detail-icon"><i className="bi bi-card-heading" /></span>
            <div>
              <h2>{item.name}</h2>
              <div className="fm-detail-badges">
                <code className="fdm-code">{item.foodCode || 'Chưa gán mã'}</code>
                <span className="fdm-group-chip">{item.foodGroup || 'Chưa phân nhóm'}</span>
                <span className={`fdm-status ${isHidden ? 'fdm-status--hidden' : 'fdm-status--active'}`}>
                  <i />{isHidden ? 'Đã ẩn' : 'Đang sử dụng'}
                </span>
              </div>
            </div>
          </div>
          <button className="fm-close" onClick={onClose} aria-label="Đóng"><i className="bi bi-x-lg" /></button>
        </header>

        <div className="fm-detail-body">
          {/* Top visual section */}
          <div className="fm-detail-top">
            <div className="fm-detail-image-box">
              {item.imageUrl ? (
                <img src={getImageUrl(item.imageUrl)} alt={item.name} />
              ) : (
                <div className="fm-detail-no-img">🍽<span>Chưa có ảnh đại diện</span></div>
              )}
            </div>

            <div className="fm-detail-overview">
              <div className="fm-detail-stat-card">
                <small>Khẩu phần tiêu chuẩn</small>
                <strong>{servingSize} gram</strong>
                <span>~{calPerServing} kcal mỗi suất</span>
              </div>
              <div className="fm-detail-stat-card highlight">
                <small>Năng lượng trên 100g</small>
                <strong>{item.calories} kcal</strong>
                <span>Chuẩn Viện Dinh Dưỡng</span>
              </div>
              {item.mealLogCount !== undefined && (
                <div className="fm-detail-stat-card log-count">
                  <small>Lịch sử sử dụng</small>
                  <strong>{item.mealLogCount}</strong>
                  <span>Lượt trong MealLog người dùng</span>
                </div>
              )}
            </div>
          </div>

          {/* Dinh dưỡng chi tiết */}
          <div className="fm-detail-section">
            <h3 className="fm-detail-section-title"><i className="bi bi-pie-chart-fill" /> Giá trị dinh dưỡng chi tiết</h3>
            <div className="fm-detail-nutrient-grid">
              <div className="fm-detail-nutrient fm-detail-nutrient--cal">
                <span className="fm-detail-nut-icon">🔥</span>
                <div>
                  <small>Calo / Năng lượng</small>
                  <strong>{item.calories} <span className="fm-unit">kcal / 100g</span></strong>
                  <p>Suất {servingSize}g: <b>{calPerServing} kcal</b></p>
                </div>
              </div>

              <div className="fm-detail-nutrient fm-detail-nutrient--pro">
                <span className="fm-detail-nut-icon">💪</span>
                <div>
                  <small>Chất đạm (Protein)</small>
                  <strong>{item.protein} <span className="fm-unit">g / 100g</span></strong>
                  <p>Suất {servingSize}g: <b>{proPerServing} g</b></p>
                </div>
              </div>

              <div className="fm-detail-nutrient fm-detail-nutrient--carb">
                <span className="fm-detail-nut-icon">🌾</span>
                <div>
                  <small>Đường bột (Carbs)</small>
                  <strong>{item.carbs} <span className="fm-unit">g / 100g</span></strong>
                  <p>Suất {servingSize}g: <b>{carbPerServing} g</b></p>
                </div>
              </div>

              <div className="fm-detail-nutrient fm-detail-nutrient--fat">
                <span className="fm-detail-nut-icon">🫒</span>
                <div>
                  <small>Chất béo (Fat)</small>
                  <strong>{item.fat} <span className="fm-unit">g / 100g</span></strong>
                  <p>Suất {servingSize}g: <b>{fatPerServing} g</b></p>
                </div>
              </div>
            </div>

            {/* Macro bar */}
            {(pct.p + pct.c + pct.f) > 0 && (
              <div className="fm-macro-bar-wrap" style={{ marginTop: 12, borderRadius: 10, background: '#f8fafc', padding: '12px 16px' }}>
                <div className="fm-macro-bar" style={{ height: 8 }}>
                  <div className="fm-macro-seg fm-macro-seg--pro" style={{ width: `${pct.p}%` }} title={`Protein ${pct.p}%`} />
                  <div className="fm-macro-seg fm-macro-seg--carb" style={{ width: `${pct.c}%` }} title={`Carbs ${pct.c}%`} />
                  <div className="fm-macro-seg fm-macro-seg--fat" style={{ width: `${pct.f}%` }} title={`Fat ${pct.f}%`} />
                </div>
                <div className="fm-macro-legend" style={{ marginTop: 8 }}>
                  <span><i style={{ background: '#1a5fa0' }} />Protein {pct.p}%</span>
                  <span><i style={{ background: '#a06010' }} />Carbs {pct.c}%</span>
                  <span><i style={{ background: '#a01f1f' }} />Fat {pct.f}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Mô tả & Thông tin hệ thống */}
          <div className="fm-detail-section">
            <h3 className="fm-detail-section-title"><i className="bi bi-file-text-fill" /> Mô tả & Thông tin hệ thống</h3>
            <p className="fm-detail-desc">{item.description || 'Chưa có ghi chú mô tả cho món ăn này.'}</p>
            <div className="fm-detail-meta">
              <span><b>Slug nghiệp vụ:</b> <code>{item.slug}</code></span>
              {item.createdAt && <span><b>Ngày tạo:</b> {new Date(item.createdAt).toLocaleDateString('vi-VN')}</span>}
              {item.updatedAt && <span><b>Cập nhật:</b> {new Date(item.updatedAt).toLocaleDateString('vi-VN')}</span>}
            </div>
          </div>
        </div>

        <footer className="fm-detail-footer">
          <button className="fm-btn-cancel" onClick={onClose}>Đóng</button>
          <button className="fm-btn-save" onClick={() => { onClose(); onEdit(item) }}>
            <i className="bi bi-pencil-fill" /> Chỉnh sửa món ăn
          </button>
        </footer>
      </section>
    </div>
  )
}

// ─── FoodFormModal (Thêm / Chỉnh sửa món ăn) ────────────────────────────────
function FoodFormModal({ mode, editTarget, totalFoods, allExistingGroups = [], onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [isCustomGroup, setIsCustomGroup] = useState(false)
  const [customGroupInput, setCustomGroupInput] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef(null)

  // Danh sách nhóm tổng hợp: mặc định + các nhóm đã có trong database
  const groupOptions = useMemo(() => {
    const set = new Set([...DEFAULT_FOOD_GROUPS, ...allExistingGroups.filter(Boolean)])
    return Array.from(set)
  }, [allExistingGroups])

  useEffect(() => {
    if (mode === 'edit' && editTarget) {
      const g = editTarget.foodGroup || ''
      setForm({
        name: editTarget.name || '',
        foodGroup: g,
        servingLabel: SERVING_PRESETS.find((p) => String(p.value) === String(editTarget.servingSize))?.label || '',
        calories: String(editTarget.calories ?? ''),
        protein: String(editTarget.protein ?? ''),
        fat: String(editTarget.fat ?? ''),
        carbs: String(editTarget.carbs ?? ''),
        servingSize: String(editTarget.servingSize ?? '100'),
        imageUrl: editTarget.imageUrl || '',
        description: editTarget.description || '',
      })
      if (g && !groupOptions.includes(g)) {
        setIsCustomGroup(true)
        setCustomGroupInput(g)
      } else {
        setIsCustomGroup(false)
        setCustomGroupInput('')
      }
    } else {
      setForm(EMPTY_FORM)
      setIsCustomGroup(false)
      setCustomGroupInput('')
    }
    setErrors({})
    setApiError('')
  }, [mode, editTarget, groupOptions])

  function change(e) {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
    setErrors((p) => ({ ...p, [name]: undefined }))
    setApiError('')
  }

  function handleGroupSelect(e) {
    const val = e.target.value
    if (val === '__CUSTOM__') {
      setIsCustomGroup(true)
      setForm((p) => ({ ...p, foodGroup: customGroupInput }))
    } else {
      setIsCustomGroup(false)
      setForm((p) => ({ ...p, foodGroup: val }))
    }
  }

  function handleCustomGroupChange(e) {
    const val = e.target.value
    setCustomGroupInput(val)
    setForm((p) => ({ ...p, foodGroup: val }))
  }

  function applyPreset(value) {
    const preset = SERVING_PRESETS.find((p) => p.value === value)
    setForm((p) => ({ ...p, servingSize: value, servingLabel: preset?.label || '' }))
    setErrors((p) => ({ ...p, servingSize: undefined }))
  }

  // Upload file thật lên server backend
  async function handleFileUpload(file) {
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setApiError('Chỉ chấp nhận tệp ảnh JPG, PNG hoặc WEBP')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setApiError('Kích thước ảnh không được vượt quá 5MB')
      return
    }

    setUploadingImage(true)
    setApiError('')
    try {
      const formData = new FormData()
      formData.append('image', file)
      const { data } = await axiosInstance.post('/admin/foods/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setForm((p) => ({ ...p, imageUrl: data.imageUrl }))
    } catch (err) {
      setApiError(err.response?.data?.message || 'Không thể tải ảnh lên, vui lòng thử lại')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileUpload(file)
  }, [])

  async function submit() {
    const errs = validate(form)
    if (Object.keys(errs).length) {
      setErrors(errs)
      const fieldLabels = {
        name: 'Tên món ăn',
        calories: 'Năng lượng (Calo)',
        protein: 'Chất đạm (Protein)',
        fat: 'Chất béo (Fat)',
        carbs: 'Đường bột (Carbs)',
        servingSize: 'Trọng lượng khẩu phần',
      }
      const missingList = Object.keys(errs).map((k) => fieldLabels[k] || k).join(', ')
      setApiError(`Vui lòng kiểm tra và điền đầy đủ các thông tin bắt buộc (*): ${missingList}`)

      // Cuộn tới trường lỗi đầu tiên và focus
      const firstKey = Object.keys(errs)[0]
      const el = document.querySelector(`[name="${firstKey}"]`) || document.getElementById(`fm-${firstKey}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setTimeout(() => el.focus(), 250)
      }
      return
    }
    setSaving(true); setApiError('')
    try {
      const payload = {
        name: form.name,
        foodGroup: form.foodGroup,
        calories: form.calories,
        protein: form.protein,
        fat: form.fat,
        carbs: form.carbs,
        servingSize: form.servingSize,
        imageUrl: form.imageUrl,
        description: form.description,
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

  const calcMacroKcal = useMemo(() => {
    const p = parseFloat(form.protein) || 0
    const c = parseFloat(form.carbs) || 0
    const f = parseFloat(form.fat) || 0
    const total = Math.round(p * 4 + c * 4 + f * 9)
    const totalGrams = +(p + c + f).toFixed(1)
    return { kcal: total, totalGrams }
  }, [form.protein, form.carbs, form.fat])

  function autoFillCalories() {
    if (calcMacroKcal.kcal > 0) {
      setForm((p) => ({ ...p, calories: String(calcMacroKcal.kcal) }))
      setErrors((p) => ({ ...p, calories: undefined }))
      setApiError('')
    }
  }

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
                <label className="fm-label" htmlFor="fm-group">
                  NHÓM THỰC PHẨM
                  {isCustomGroup && (
                    <button type="button" className="fm-group-switch-btn" onClick={() => { setIsCustomGroup(false); setForm(p => ({ ...p, foodGroup: '' })) }}>
                      (Chọn danh sách)
                    </button>
                  )}
                </label>
                {isCustomGroup ? (
                  <input
                    id="fm-group-custom"
                    className="fm-input"
                    value={customGroupInput}
                    onChange={handleCustomGroupChange}
                    placeholder="Gõ tên danh mục mới..."
                    autoFocus
                  />
                ) : (
                  <select id="fm-group" name="foodGroup" className="fm-select" value={form.foodGroup} onChange={handleGroupSelect}>
                    <option value="">-- Chọn nhóm --</option>
                    {groupOptions.map((g) => <option key={g} value={g}>{g}</option>)}
                    <option value="__CUSTOM__">➕ Nhập nhóm mới...</option>
                  </select>
                )}
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
              <div className="fm-nutrition-title-wrap">
                <i className="bi bi-pie-chart-fill" />
                <span className="fm-nutrition-title">Thành phần dinh dưỡng</span>
                <span className="fm-nutrition-tag">Chuẩn 100g</span>
              </div>

              <div className="fm-nutrition-actions">
                {/* Chỉ hiển thị Quy đổi khi khẩu phần thực tế KHÁC 100g */}
                {servingKcal !== null && Number(form.servingSize) !== 100 && (
                  <span className="fm-serving-tag" title={`Năng lượng cho ${form.servingSize}g thực tế`}>
                    Khẩu phần {form.servingSize}g: <b>~{servingKcal} kcal</b>
                  </span>
                )}
                {/* Nút tính lại calo: chỉ hiện khi có chênh lệch đáng kể */}
                {calcMacroKcal.kcal > 0 && Math.abs((Number(form.calories) || 0) - calcMacroKcal.kcal) >= 5 && (
                  <button
                    type="button"
                    className="fm-calc-btn"
                    onClick={autoFillCalories}
                    title="Tự động tính năng lượng = Protein*4 + Carbs*4 + Fat*9"
                  >
                    <i className="bi bi-magic" /> Tự tính Calo (~{calcMacroKcal.kcal})
                  </button>
                )}
              </div>
            </div>

            <div className="fm-nutrients">
              {[
                { key: 'calories', label: 'Năng lượng (Calo)', unit: 'kcal', color: 'cal', icon: 'bi-fire', ph: 'VD: 250' },
                { key: 'protein',  label: 'Chất đạm (Protein)', unit: 'g',    color: 'pro', icon: 'bi-droplet-fill', ph: 'VD: 15' },
                { key: 'carbs',    label: 'Đường bột (Carbs)',  unit: 'g',    color: 'carb', icon: 'bi-basket2-fill', ph: 'VD: 30' },
                { key: 'fat',      label: 'Chất béo (Fat)',     unit: 'g',    color: 'fat', icon: 'bi-egg-fried', ph: 'VD: 8' },
              ].map(({ key, label, unit, color, icon, ph }) => (
                <div key={key} className={`fm-nutrient fm-nutrient--${color}`}>
                  <div className="fm-nutrient-label">
                    <i className={`bi ${icon}`} />
                    <span>{label}</span>
                  </div>
                  <div className="fm-nutrient-input-wrap">
                    <input
                      id={`fm-${key}`}
                      name={key}
                      type="number"
                      min="0"
                      step="0.1"
                      className={`fm-nutrient-input ${errors[key] ? 'fm-input--err' : ''}`}
                      value={form[key]}
                      onChange={change}
                      placeholder={ph}
                    />
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
                  <div className="fm-macro-seg fm-macro-seg--pro" style={{ width: `${pct.p}%` }} title={`Đạm ${pct.p}%`} />
                  <div className="fm-macro-seg fm-macro-seg--carb" style={{ width: `${pct.c}%` }} title={`Carbs ${pct.c}%`} />
                  <div className="fm-macro-seg fm-macro-seg--fat" style={{ width: `${pct.f}%` }} title={`Béo ${pct.f}%`} />
                </div>
                <div className="fm-macro-legend">
                  <span><i style={{ background: '#2563eb' }} />Đạm <b>{pct.p}%</b></span>
                  <span><i style={{ background: '#d97706' }} />Carbs <b>{pct.c}%</b></span>
                  <span><i style={{ background: '#dc2626' }} />Béo <b>{pct.f}%</b></span>
                  <span style={{ marginLeft: 'auto', color: '#64748b' }}>
                    Tổng 3 chất: <b>{calcMacroKcal.totalGrams}g</b> / 100g
                  </span>
                </div>

                {/* Cảnh báo nếu calo nhập lệch đáng kể so với P/C/F (> 40 kcal) */}
                {form.calories !== '' && calcMacroKcal.kcal > 0 && Math.abs(Number(form.calories) - calcMacroKcal.kcal) > 40 && (
                  <div className="fm-macro-hint">
                    <i className="bi bi-info-circle-fill" />
                    <span>
                      Calo theo 3 chất ước tính là <strong>~{calcMacroKcal.kcal} kcal</strong> (bạn đang nhập <strong>{form.calories} kcal</strong>).
                    </span>
                    <button type="button" onClick={autoFillCalories} className="fm-hint-apply-btn">
                      Áp dụng {calcMacroKcal.kcal} kcal
                    </button>
                  </div>
                )}

                {/* Cảnh báo tổng khối lượng vượt quá 100g */}
                {calcMacroKcal.totalGrams > 100 && (
                  <div className="fm-macro-hint fm-macro-hint--warn">
                    <i className="bi bi-exclamation-triangle-fill" />
                    <span>
                      Tổng khối lượng 3 chất là <strong>{calcMacroKcal.totalGrams}g</strong>, vượt quá 100g thực phẩm chuẩn! Vui lòng kiểm tra lại.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Ảnh đại diện ── */}
          <div className="fm-field">
            <div className="fm-section-label">HÌNH ẢNH ĐẠI DIỆN MÓN ĂN</div>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = '' }} />

            {uploadingImage ? (
              <div className="fm-uploading-box">
                <span className="food-spinner" style={{ width: 26, height: 26, borderWidth: 3 }} />
                <span>Đang xử lý ảnh...</span>
              </div>
            ) : form.imageUrl ? (
              <div className="fm-image-preview-card">
                <div className="fm-ipc-thumb-wrap">
                  <img src={getImageUrl(form.imageUrl)} alt="Preview" className="fm-ipc-thumb" />
                </div>
                <div className="fm-ipc-info">
                  <div className="fm-ipc-status">
                    <i className="bi bi-check-circle-fill" />
                    <span>Đã có ảnh đại diện</span>
                  </div>
                  <p className="fm-ipc-url" title={form.imageUrl.startsWith('data:') ? 'Ảnh sẽ được lưu trong MongoDB khi lưu món ăn' : form.imageUrl}>
                    {form.imageUrl.startsWith('data:') ? 'Ảnh sẽ được lưu trong MongoDB khi lưu món ăn' : form.imageUrl}
                  </p>
                  <div className="fm-ipc-actions">
                    <button type="button" className="fm-ipc-btn fm-ipc-btn--change" onClick={() => fileRef.current?.click()}>
                      <i className="bi bi-arrow-repeat" /> Thay đổi ảnh
                    </button>
                    <button type="button" className="fm-ipc-btn fm-ipc-btn--remove" onClick={() => setForm((p) => ({ ...p, imageUrl: '' }))}>
                      <i className="bi bi-trash3" /> Xóa ảnh
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className={`fm-dropzone ${dragging ? 'fm-dropzone--over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false) }}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                role="button" tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
              >
                <div className="fm-drop-placeholder">
                  <span className="fm-drop-icon"><i className="bi bi-cloud-arrow-up-fill" /></span>
                  <p>Kéo thả ảnh vào đây hoặc <span className="fm-link">chọn tệp từ máy tính</span></p>
                  <small>Hỗ trợ JPG, PNG, WEBP (tối đa 5MB) — lưu vào MongoDB khi lưu món ăn</small>
                </div>
              </div>
            )}

          </div>

          {/* ── Mô tả ── */}
          <div className="fm-field">
            <label className="fm-label" htmlFor="fm-desc">MÔ TẢ MÓN ĂN</label>
            <textarea id="fm-desc" name="description" className="fm-input fm-textarea" rows="3"
              value={form.description} onChange={change}
              placeholder="Nguyên liệu chính, đặc trưng vùng miền, cách chế biến..." />
          </div>
        </div>

        {/* Pinned Error Banner */}
        {apiError && (
          <div className="fm-api-err" role="alert" style={{ margin: '0 24px 10px', flexShrink: 0 }}>
            <i className="bi bi-exclamation-triangle-fill" />{apiError}
          </div>
        )}

        {/* Footer */}
        <footer className="fm-footer">
          <button className="fm-btn-cancel" onClick={onClose}>Hủy bỏ</button>
          <button className="fm-btn-save" onClick={submit} disabled={saving || uploadingImage}>
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

// ─── Food Group Management Modal ─────────────────────────────────────────────
function FoodGroupManagementModal({
  isOpen,
  onClose,
  onGroupsChanged,
}) {
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [actionSuccessMsg, setActionSuccessMsg] = useState('')

  // Create new group
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupDesc, setNewGroupDesc] = useState('')
  const [creating, setCreating] = useState(false)

  // Rename group
  const [editingGroupId, setEditingGroupId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [renaming, setRenaming] = useState(false)

  // Delete / Merge group
  const [deletingGroup, setDeletingGroup] = useState(null)
  const [targetGroup, setTargetGroup] = useState('Khác')
  const [deleting, setDeleting] = useState(false)

  const fetchGroups = useCallback(async () => {
    setLoading(true)
    setErrorMsg('')
    try {
      const { data } = await axiosInstance.get('/admin/foods/groups')
      if (data.success && Array.isArray(data.data)) {
        setGroups(data.data)
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Không thể tải danh sách nhóm món ăn')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchGroups()
      setEditingGroupId(null)
      setDeletingGroup(null)
      setActionSuccessMsg('')
    }
  }, [isOpen, fetchGroups])

  const handleCreateGroup = async (e) => {
    e.preventDefault()
    if (!newGroupName.trim()) return
    setCreating(true)
    setErrorMsg('')
    setActionSuccessMsg('')
    try {
      const { data } = await axiosInstance.post('/admin/foods/groups', {
        name: newGroupName.trim(),
        description: newGroupDesc.trim() || null,
      })
      setActionSuccessMsg(data.message)
      setNewGroupName('')
      setNewGroupDesc('')
      await fetchGroups()
      onGroupsChanged()
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Tạo nhóm món ăn thất bại')
    } finally {
      setCreating(false)
    }
  }

  const handleStartRename = (group) => {
    setEditingGroupId(group._id)
    setEditName(group.name)
    setEditDesc(group.description || '')
    setErrorMsg('')
    setActionSuccessMsg('')
    setDeletingGroup(null)
  }

  const handleSaveRename = async (id) => {
    if (!editName.trim()) return
    setRenaming(true)
    setErrorMsg('')
    setActionSuccessMsg('')
    try {
      const { data } = await axiosInstance.put(`/admin/foods/groups/${id}`, {
        newName: editName.trim(),
        description: editDesc.trim() || null,
      })
      setActionSuccessMsg(data.message)
      setEditingGroupId(null)
      await fetchGroups()
      onGroupsChanged()
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Đổi tên nhóm thất bại')
    } finally {
      setRenaming(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingGroup) return
    setDeleting(true)
    setErrorMsg('')
    setActionSuccessMsg('')
    try {
      const { data } = await axiosInstance.delete(`/admin/foods/groups/${deletingGroup._id}`, {
        data: { targetGroup },
      })
      setActionSuccessMsg(data.message)
      setDeletingGroup(null)
      await fetchGroups()
      onGroupsChanged()
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Xóa nhóm thất bại')
    } finally {
      setDeleting(false)
    }
  }

  if (!isOpen) return null

  const mergeTargetOptions = groups.filter((g) => g._id !== deletingGroup?._id)

  return (
    <div className="user-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <section className="user-modal fgm-modal" role="dialog" aria-modal="true">
        <header className="fgm-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="fgm-header-icon"><i className="bi bi-tags-fill" /></span>
            <div>
              <h2>Quản lý nhóm danh mục món ăn</h2>
              <small style={{ color: '#7a92a8' }}>
                Chuẩn hóa, đổi tên và gộp các nhóm món ăn trong toàn hệ thống
              </small>
            </div>
          </div>
          <button className="fm-close" aria-label="Đóng" onClick={onClose}><i className="bi bi-x-lg" /></button>
        </header>

        <div className="fgm-body">
          {errorMsg && (
            <div className="fgm-alert fgm-alert--err">
              <i className="bi bi-exclamation-triangle-fill" /> {errorMsg}
            </div>
          )}
          {actionSuccessMsg && (
            <div className="fgm-alert fgm-alert--success">
              <i className="bi bi-check-circle-fill" /> {actionSuccessMsg}
            </div>
          )}

          {/* Form thêm nhóm mới */}
          <form className="fgm-add-box" onSubmit={handleCreateGroup}>
            <div className="fgm-add-inputs">
              <div style={{ flex: '1.2' }}>
                <input
                  className="fm-input"
                  placeholder="Tên nhóm mới (VD: Món chay, Đồ ăn dặm...)"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  disabled={creating}
                  required
                />
              </div>
              <div style={{ flex: '1.8' }}>
                <input
                  className="fm-input"
                  placeholder="Mô tả nhóm (tùy chọn)..."
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  disabled={creating}
                />
              </div>
            </div>
            <button type="submit" className="frm-btn frm-btn--review" disabled={creating || !newGroupName.trim()}>
              {creating ? <span className="food-spinner-inline" /> : <i className="bi bi-plus-lg" />}
              <span>Thêm nhóm</span>
            </button>
          </form>

          {/* Khung xác nhận xóa / gộp nhóm */}
          {deletingGroup && (
            <div className="fgm-delete-confirm-box">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <i className="bi bi-exclamation-octagon-fill" style={{ fontSize: 20, color: '#dc2626', marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <strong style={{ color: '#991b1b', fontSize: 13.5 }}>
                    Xác nhận xóa / gộp nhóm: "{deletingGroup.name}"
                  </strong>
                  <p style={{ margin: '4px 0 10px', fontSize: 12.5, color: '#475569' }}>
                    Nhóm này đang có <b>{deletingGroup.foodCount}</b> món ăn. Chọn nhóm mới để hệ thống tự động chuyển toàn bộ các món này sang:
                  </p>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                      className="fm-select"
                      style={{ maxWidth: 280 }}
                      value={targetGroup}
                      onChange={(e) => setTargetGroup(e.target.value)}
                    >
                      {mergeTargetOptions.map((g) => (
                        <option key={g._id} value={g.name}>{g.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="frm-btn frm-btn--reject"
                      style={{ background: '#dc2626', color: '#fff', borderColor: '#b91c1c' }}
                      onClick={handleConfirmDelete}
                      disabled={deleting}
                    >
                      {deleting ? 'Đang xử lý...' : `Xóa nhóm & Chuyển ${deletingGroup.foodCount} món`}
                    </button>
                    <button
                      type="button"
                      className="frm-btn frm-btn--detail"
                      onClick={() => setDeletingGroup(null)}
                      disabled={deleting}
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bảng danh sách các nhóm */}
          <div className="fgm-table-wrap">
            <table className="fgm-table">
              <thead>
                <tr>
                  <th style={{ width: '28%' }}>Tên nhóm</th>
                  <th style={{ width: '16%' }}>Số lượng món</th>
                  <th style={{ width: '38%' }}>Mô tả</th>
                  <th style={{ width: '18%', textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: 30, color: '#7a92a8' }}>
                      <span className="food-spinner" style={{ marginRight: 8 }} /> Đang tải danh sách nhóm...
                    </td>
                  </tr>
                ) : groups.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: 20, color: '#7a92a8' }}>
                      Chưa có nhóm món ăn nào.
                    </td>
                  </tr>
                ) : (
                  groups.map((group) => {
                    const isEditing = editingGroupId === group._id
                    return (
                      <tr key={group._id} className={isEditing ? 'fgm-tr--editing' : ''}>
                        {/* Tên nhóm */}
                        <td>
                          {isEditing ? (
                            <input
                              className="fm-input"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              autoFocus
                              style={{ height: 32, fontSize: 13 }}
                            />
                          ) : (
                            <strong style={{ color: '#102a43', fontSize: 13.5 }}>{group.name}</strong>
                          )}
                        </td>

                        {/* Số lượng món */}
                        <td>
                          <span className="fgm-count-pill" title={`${group.foodCount} món ăn thuộc nhóm này`}>
                            <b>{group.foodCount}</b> món
                          </span>
                        </td>

                        {/* Mô tả nhóm */}
                        <td>
                          {isEditing ? (
                            <input
                              className="fm-input"
                              placeholder="Mô tả nhóm..."
                              value={editDesc}
                              onChange={(e) => setEditDesc(e.target.value)}
                              style={{ height: 32, fontSize: 12.5 }}
                            />
                          ) : (
                            <div style={{ fontSize: 12.5, color: '#475569', lineHeight: 1.45 }}>
                              {group.description || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Chưa có mô tả</span>}
                            </div>
                          )}
                        </td>

                        {/* Thao tác */}
                        <td style={{ textAlign: 'right' }}>
                          {isEditing ? (
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button
                                type="button"
                                className="frm-btn frm-btn--review"
                                style={{ height: 30, padding: '0 10px', fontSize: 12 }}
                                onClick={() => handleSaveRename(group._id)}
                                disabled={renaming || !editName.trim()}
                              >
                                Lưu
                              </button>
                              <button
                                type="button"
                                className="frm-btn frm-btn--detail"
                                style={{ height: 30, padding: '0 8px', fontSize: 12 }}
                                onClick={() => setEditingGroupId(null)}
                                disabled={renaming}
                              >
                                Hủy
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button
                                type="button"
                                className="fgm-action-btn"
                                onClick={() => handleStartRename(group)}
                                title="Đổi tên nhóm (tự động cập nhật toàn bộ món ăn thuộc nhóm)"
                              >
                                <i className="bi bi-pencil" /> Đổi tên
                              </button>
                              <button
                                type="button"
                                className="fgm-action-btn fgm-action-btn--delete"
                                onClick={() => {
                                  setDeletingGroup(group)
                                  setTargetGroup(group.name === 'Khác' ? 'Cơm & Xôi' : 'Khác')
                                }}
                                title="Xóa nhóm và gộp món ăn sang nhóm khác"
                              >
                                <i className="bi bi-trash3" /> Xóa
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="fgm-footer">
          <small style={{ color: '#7a92a8' }}>
            Tổng cộng <b>{groups.length}</b> nhóm danh mục trong hệ thống
          </small>
          <button type="button" className="frm-btn frm-btn--detail" onClick={onClose}>
            Đóng
          </button>
        </footer>
      </section>
    </div>
  )
}

// ─── Main FoodManagementPage Component ────────────────────────────────────────
export default function FoodManagementPage() {
  const [foods, setFoods] = useState([])
  const [summary, setSummary] = useState({ total: 0, active: 0, hidden: 0 })
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 })
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [groupFilter, setGroupFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  // Modals
  const [formMode, setFormMode] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [detailTarget, setDetailTarget] = useState(null)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [groupsList, setGroupsList] = useState([])

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

  // Tải danh sách nhóm món ăn từ server
  const loadGroups = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get('/admin/foods/groups')
      if (data.success && Array.isArray(data.data)) {
        setGroupsList(data.data)
      }
    } catch (err) {
      console.error('Không thể tải nhóm món ăn:', err)
    }
  }, [])

  useEffect(() => {
    loadGroups()
  }, [loadGroups, refreshKey])

  useEffect(() => {
    const ctrl = new AbortController()
    const t = window.setTimeout(async () => {
      setLoading(true); setListError('')
      try {
        const { data } = await axiosInstance.get('/admin/foods', {
          params: { search, status: statusFilter, foodGroup: groupFilter, sort: sortBy, page, limit: PAGE_SIZE },
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
  }, [search, statusFilter, groupFilter, sortBy, page, refreshKey])

  function refresh() { setRefreshKey((k) => k + 1) }

  function handleSaved(msg) {
    setFormMode(null); setEditTarget(null)
    showToast(msg); refresh()
  }

  // Thu thập danh sách các nhóm hiện có (ưu tiên từ API, fallback DB foods)
  const existingGroups = useMemo(() => {
    if (groupsList.length > 0) {
      return groupsList.map((g) => g.name)
    }
    const set = new Set([...DEFAULT_FOOD_GROUPS])
    for (const f of foods) {
      if (f.foodGroup) set.add(f.foodGroup)
    }
    return Array.from(set)
  }, [groupsList, foods])

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

  const si = pagination.total ? (page - 1) * PAGE_SIZE + 1 : 0
  const ei = Math.min(page * PAGE_SIZE, pagination.total)

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
        <div className="fdm-kpi-actions">
          <button
            type="button"
            className="fdm-group-btn"
            onClick={() => setShowGroupModal(true)}
            title="Quản lý danh mục nhóm món ăn (Thêm, đổi tên, gộp/xóa nhóm)"
          >
            <i className="bi bi-tags-fill" /> Quản lý nhóm
          </button>
          <button className="fdm-add-btn" onClick={() => setFormMode('add')}>
            <i className="bi bi-plus-circle-fill" /> Thêm món ăn mới
          </button>
        </div>
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
            {existingGroups.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>

        <label className="fdm-filter-select">
          <i className="bi bi-sort-alpha-down" />
          <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1) }}>
            <option value="newest">Mới nhất (Mặc định)</option>
            <option value="a-z">Tên món: A → Z</option>
            <option value="z-a">Tên món: Z → A</option>
            <option value="oldest">Cũ nhất</option>
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
                  <th className="fdm-th-center" style={{ width: 44 }}>#</th>
                  <th>Món ăn</th>
                  <th>Nhóm</th>
                  <th className="fdm-th-center">Mã món</th>
                  <th className="fdm-th-center">Calo</th>
                  <th className="fdm-th-center">Protein</th>
                  <th className="fdm-th-center">Carbs</th>
                  <th className="fdm-th-center">Fat</th>
                  <th className="fdm-th-center">KP (g)</th>
                  <th className="fdm-th-center">Trạng thái</th>
                  <th className="fdm-th-center" style={{ width: 140 }}>Thao tác</th>
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
                      <td className="fdm-td-center fdm-td-idx">{si + idx}</td>
                      <td>
                        <div className="fdm-food-cell">
                          <span className="fdm-thumb">
                            {food.imageUrl
                              ? <img src={getImageUrl(food.imageUrl)} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                              : <span>🍽</span>}
                          </span>
                          <div className="fdm-food-info">
                            <strong>{food.name}</strong>
                          </div>
                        </div>
                      </td>
                      <td><span className="fdm-group-chip">{food.foodGroup || '—'}</span></td>
                      <td className="fdm-td-center"><code className="fdm-code">{food.foodCode || '—'}</code></td>
                      <td className="fdm-td-center fdm-td-num fdm-num--cal">{food.calories}</td>
                      <td className="fdm-td-center fdm-td-num fdm-num--pro">{food.protein}g</td>
                      <td className="fdm-td-center fdm-td-num fdm-num--carb">{food.carbs}g</td>
                      <td className="fdm-td-center fdm-td-num fdm-num--fat">{food.fat}g</td>
                      <td className="fdm-td-center fdm-td-num">{food.servingSize}g</td>
                      <td className="fdm-td-center">
                        <span className={`fdm-status ${isHidden ? 'fdm-status--hidden' : 'fdm-status--active'}`}>
                          <i />{isHidden ? 'Đã ẩn' : 'Đang hiển thị'}
                        </span>
                      </td>
                      <td className="fdm-td-center">
                        <div className="fdm-actions fdm-actions--center">
                          <button className="fdm-btn fdm-btn--view" onClick={() => setDetailTarget(food)} title="Xem chi tiết">
                            <i className="bi bi-eye" />
                          </button>
                          <button className="fdm-btn fdm-btn--edit" onClick={() => { setEditTarget(food); setFormMode('edit') }} title="Chỉnh sửa">
                            <i className="bi bi-pencil-fill" />
                          </button>
                          {isHidden ? (
                            <button className="fdm-btn fdm-btn--show" onClick={() => executeShow(food)} title="Hiển thị lại cho người dùng" aria-label={`Hiển thị lại ${food.name} cho người dùng`}>
                              <i className="bi bi-eye-fill" />
                            </button>
                          ) : (
                            <button className="fdm-btn fdm-btn--hide" onClick={() => setHideTarget(food)} title="Ẩn món đang hiển thị khỏi người dùng" aria-label={`Ẩn ${food.name} khỏi người dùng`}>
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

      {/* ─── Detail Modal (Xem chi tiết) ─── */}
      {detailTarget && (
        <FoodDetailModal
          food={detailTarget}
          onClose={() => setDetailTarget(null)}
          onEdit={(food) => { setDetailTarget(null); setEditTarget(food); setFormMode('edit') }}
        />
      )}

      {/* ─── Form Modal (Thêm / Sửa) ─── */}
      {formMode && (
        <FoodFormModal
          mode={formMode}
          editTarget={editTarget}
          totalFoods={summary.total}
          allExistingGroups={existingGroups}
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

      {/* ─── Food Group Management Modal ─── */}
      {showGroupModal && (
        <FoodGroupManagementModal
          isOpen={showGroupModal}
          onClose={() => setShowGroupModal(false)}
          onGroupsChanged={() => {
            loadGroups()
            refresh()
          }}
        />
      )}
    </div>
  )
}
