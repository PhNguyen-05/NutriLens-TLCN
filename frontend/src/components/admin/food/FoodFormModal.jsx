import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axiosInstance from '../../../api/axiosInstance'
import {
  DEFAULT_FOOD_GROUPS,
  SERVING_PRESETS,
  EMPTY_FORM,
  getImageUrl,
  validate,
  calcServingKcal,
  nutrientPercent,
} from './foodConstants'

export default function FoodFormModal({
  mode,
  editTarget,
  totalFoods,
  allExistingGroups = [],
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [isCustomGroup, setIsCustomGroup] = useState(false)
  const [customGroupInput, setCustomGroupInput] = useState('')
  const [dragging, setDragging] = useState(false)
  const [confirmCalorieDiscrepancy, setConfirmCalorieDiscrepancy] = useState(false)
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
    setConfirmCalorieDiscrepancy(false)
  }, [mode, editTarget, groupOptions])

  function change(e) {
    const { name, value } = e.target
    setForm((p) => ({ ...p, [name]: value }))
    setErrors((p) => ({ ...p, [name]: undefined }))
    setApiError('')
    setConfirmCalorieDiscrepancy(false)
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
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileUpload(file)
  }, [])

  const servingKcal = calcServingKcal(form)
  const pct = nutrientPercent(form)

  // Tính toán nhiệt lượng theo Atwater 4P + 4C + 9F
  const calcMacroKcal = useMemo(() => {
    const p = parseFloat(form.protein) || 0
    const c = parseFloat(form.carbs) || 0
    const f = parseFloat(form.fat) || 0
    const total = Math.round(p * 4 + c * 4 + f * 9)
    const totalGrams = +(p + c + f).toFixed(1)
    const userCal = parseFloat(form.calories)
    let discrepancyPercent = 0
    let isDiscrepancySignificant = false

    if (total > 0 && Number.isFinite(userCal) && userCal >= 0) {
      const diff = Math.abs(userCal - total)
      discrepancyPercent = Math.round((diff / Math.max(total, userCal)) * 100)
      // Lệch > 25% và chênh lệch tuyệt đối > 30 kcal
      isDiscrepancySignificant = discrepancyPercent > 25 && diff > 30
    } else if (total === 0 && Number.isFinite(userCal) && userCal > 30) {
      isDiscrepancySignificant = true
      discrepancyPercent = 100
    }

    return {
      kcal: total,
      totalGrams,
      discrepancyPercent,
      isDiscrepancySignificant,
    }
  }, [form.protein, form.carbs, form.fat, form.calories])

  function autoFillCalories() {
    if (calcMacroKcal.kcal > 0) {
      setForm((p) => ({ ...p, calories: String(calcMacroKcal.kcal) }))
      setErrors((p) => ({ ...p, calories: undefined }))
      setApiError('')
      setConfirmCalorieDiscrepancy(false)
    }
  }

  async function submit() {
    const errs = validate(form)
    if (Object.keys(errs).length) {
      setErrors(errs)
      const fieldLabels = {
        name: 'Tên món ăn',
        calories: 'Năng lượng (kcal/100g)',
        protein: 'Chất đạm (Protein)',
        fat: 'Chất béo (Fat)',
        carbs: 'Đường bột (Carbs)',
        servingSize: 'Trọng lượng khẩu phần',
      }
      const missingList = Object.keys(errs).map((k) => fieldLabels[k] || k).join(', ')
      setApiError(`Vui lòng kiểm tra và điền đầy đủ các thông tin bắt buộc (*): ${missingList}`)

      const firstKey = Object.keys(errs)[0]
      const el = document.querySelector(`[name="${firstKey}"]`) || document.getElementById(`fm-${firstKey}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setTimeout(() => el.focus(), 250)
      }
      return
    }

    // Nếu chênh lệch đáng kể và Admin chưa bấm xác nhận
    if (calcMacroKcal.isDiscrepancySignificant && !confirmCalorieDiscrepancy) {
      setApiError(
        `Lượng Calo khai báo (${form.calories} kcal) lệch ${calcMacroKcal.discrepancyPercent}% so với nhiệt lượng tính từ Macro (~${calcMacroKcal.kcal} kcal = 4×P + 4×C + 9×F). Vui lòng bấm "Áp dụng ${calcMacroKcal.kcal} kcal" hoặc tích "Tôi xác nhận số liệu này" ở dưới.`
      )
      return
    }

    setSaving(true)
    setApiError('')
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
        confirmCalorieDiscrepancy,
      }
      if (mode === 'add') await axiosInstance.post('/admin/foods', payload)
      else await axiosInstance.put(`/admin/foods/${editTarget._id}`, payload)
      onSaved(mode === 'add' ? 'Thêm món ăn thành công' : 'Cập nhật món ăn thành công')
    } catch (err) {
      const resData = err.response?.data
      if (resData?.canConfirmDiscrepancy) {
        setApiError(`${resData.message} (Tích xác nhận bên dưới nếu bạn chắc chắn số liệu này đúng)`)
      } else {
        setApiError(resData?.message || 'Thao tác thất bại, vui lòng thử lại')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fm-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
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
          <button className="fm-close" onClick={onClose} aria-label="Đóng">
            <i className="bi bi-x-lg" />
          </button>
        </header>

        {/* Body */}
        <div className="fm-body">
          {/* ── Tên + Mã ── */}
          <div className="fm-section">
            <div className="fm-row fm-row--2">
              <div className="fm-field fm-field--grow">
                <label className="fm-label" htmlFor="fm-name">
                  TÊN MÓN ĂN CHÍNH THỨC <span className="fm-req">*</span>
                </label>
                <input
                  id="fm-name"
                  name="name"
                  className={`fm-input ${errors.name ? 'fm-input--err' : ''}`}
                  value={form.name}
                  onChange={change}
                  placeholder="Ví dụ: Phở bò tái nạm Nam Định"
                />
                {errors.name ? (
                  <span className="fm-err-msg">{errors.name}</span>
                ) : (
                  <span className="fm-hint">
                    <i className="bi bi-info-circle" /> Kiểm tra tự động trùng lặp với {totalFoods} món hiện có
                  </span>
                )}
              </div>
              <div className="fm-field">
                <label className="fm-label">MÃ MÓN (FOOD CODE)</label>
                <div className="fm-code-badge">
                  <i className="bi bi-upc-scan" />
                  <span>{mode === 'edit' && editTarget?.foodCode ? editTarget.foodCode : 'Auto-generate'}</span>
                </div>
                <span className="fm-hint">
                  <i className="bi bi-robot" /> Hệ thống tự tạo khi lưu
                </span>
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
                    <button
                      type="button"
                      className="fm-group-switch-btn"
                      onClick={() => {
                        setIsCustomGroup(false)
                        setForm((p) => ({ ...p, foodGroup: '' }))
                      }}
                    >
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
                  <select
                    id="fm-group"
                    name="foodGroup"
                    className="fm-select"
                    value={form.foodGroup}
                    onChange={handleGroupSelect}
                  >
                    <option value="">-- Chọn nhóm --</option>
                    {groupOptions.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                    <option value="__CUSTOM__">➕ Nhập nhóm mới...</option>
                  </select>
                )}
              </div>
              <div className="fm-field">
                <label className="fm-label" htmlFor="fm-preset">
                  ĐƠN VỊ KHẨU PHẦN
                </label>
                <select
                  id="fm-preset"
                  className="fm-select"
                  value={SERVING_PRESETS.find((p) => p.value === form.servingSize)?.value || ''}
                  onChange={(e) => applyPreset(e.target.value)}
                >
                  <option value="">-- Chọn preset --</option>
                  {SERVING_PRESETS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fm-field">
                <label className="fm-label" htmlFor="fm-sv">
                  TRỌNG LƯỢNG (G/ML) <span className="fm-req">*</span>
                </label>
                <div className="fm-suffix-wrap">
                  <input
                    id="fm-sv"
                    name="servingSize"
                    type="number"
                    min="1"
                    step="1"
                    className={`fm-input fm-input--suffix ${errors.servingSize ? 'fm-input--err' : ''}`}
                    value={form.servingSize}
                    onChange={change}
                  />
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
                {servingKcal !== null && Number(form.servingSize) !== 100 && (
                  <span className="fm-serving-tag" title={`Năng lượng cho ${form.servingSize}g thực tế`}>
                    Khẩu phần {form.servingSize}g: <b>~{servingKcal} kcal</b>
                  </span>
                )}
                {calcMacroKcal.kcal > 0 && Math.abs((Number(form.calories) || 0) - calcMacroKcal.kcal) >= 5 && (
                  <button
                    type="button"
                    className="fm-calc-btn"
                    onClick={autoFillCalories}
                    title="Tự động tính năng lượng = Protein*4 + Carbs*4 + Fat*9"
                  >
                    <i className="bi bi-magic" /> Tự tính năng lượng (~{calcMacroKcal.kcal} kcal)
                  </button>
                )}
              </div>
            </div>

            <div className="fm-nutrients">
              {[
                { key: 'calories', label: 'Năng lượng', unit: 'kcal', color: 'cal', icon: 'bi-fire', ph: 'VD: 250' },
                { key: 'protein', label: 'Chất đạm (Protein)', unit: 'g', color: 'pro', icon: 'bi-droplet-fill', ph: 'VD: 15' },
                { key: 'carbs', label: 'Đường bột (Carbs)', unit: 'g', color: 'carb', icon: 'bi-basket2-fill', ph: 'VD: 30' },
                { key: 'fat', label: 'Chất béo (Fat)', unit: 'g', color: 'fat', icon: 'bi-egg-fried', ph: 'VD: 8' },
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
            {pct.p + pct.c + pct.f > 0 && (
              <div className="fm-macro-bar-wrap">
                <div className="fm-macro-bar">
                  <div className="fm-macro-seg fm-macro-seg--pro" style={{ width: `${pct.p}%` }} title={`Đạm ${pct.p}%`} />
                  <div className="fm-macro-seg fm-macro-seg--carb" style={{ width: `${pct.c}%` }} title={`Carbs ${pct.c}%`} />
                  <div className="fm-macro-seg fm-macro-seg--fat" style={{ width: `${pct.f}%` }} title={`Béo ${pct.f}%`} />
                </div>
                <div className="fm-macro-legend">
                  <span>
                    <i style={{ background: '#2563eb' }} />
                    Đạm <b>{pct.p}%</b>
                  </span>
                  <span>
                    <i style={{ background: '#d97706' }} />
                    Carbs <b>{pct.c}%</b>
                  </span>
                  <span>
                    <i style={{ background: '#dc2626' }} />
                    Béo <b>{pct.f}%</b>
                  </span>
                  <span style={{ marginLeft: 'auto', color: '#64748b' }}>
                    Tổng 3 chất: <b>{calcMacroKcal.totalGrams}g</b> / 100g
                  </span>
                </div>

                {/* Cảnh báo tính hợp lý giữa Calo và Macro (II.1) */}
                {calcMacroKcal.isDiscrepancySignificant && (
                  <div className="fm-macro-hint" style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' }}>
                    <i className="bi bi-exclamation-triangle-fill" style={{ color: '#d97706' }} />
                    <div style={{ flex: 1 }}>
                      <div>
                        <strong>Cảnh báo độ lệch Calo ({calcMacroKcal.discrepancyPercent}%):</strong> Lượng Calo nhập (
                        <b>{form.calories} kcal</b>) lệch đáng kể so với nhiệt lượng từ Macro (~
                        <b>{calcMacroKcal.kcal} kcal</b> = 4×P + 4×C + 9×F).
                      </div>
                      <div style={{ marginTop: 6, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <button type="button" onClick={autoFillCalories} className="fm-hint-apply-btn">
                          <i className="bi bi-magic" /> Tự động chỉnh thành {calcMacroKcal.kcal} kcal
                        </button>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: '#78350f' }}>
                          <input
                            type="checkbox"
                            checked={confirmCalorieDiscrepancy}
                            onChange={(e) => setConfirmCalorieDiscrepancy(e.target.checked)}
                          />
                          <span>Tôi xác nhận số liệu này là đúng thực tế (do chất xơ, cồn...)</span>
                        </label>
                      </div>
                    </div>
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
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFileUpload(f)
                e.target.value = ''
              }}
            />

            {uploadingImage ? (
              <div className="fm-uploading-box">
                <span className="food-spinner" style={{ width: 26, height: 26, borderWidth: 3 }} />
                <span>Đang tải và tối ưu hóa ảnh...</span>
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
                  <p
                    className="fm-ipc-url"
                    title={
                      form.imageUrl.startsWith('data:')
                        ? 'Ảnh Base64 tạm thời'
                        : form.imageUrl
                    }
                  >
                    {form.imageUrl.includes('res.cloudinary.com')
                      ? 'Lưu trữ trên máy chủ Cloudinary'
                      : form.imageUrl.startsWith('data:')
                      ? 'Ảnh Base64 tạm thời'
                      : form.imageUrl}
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
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false)
                }}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
              >
                <div className="fm-drop-placeholder">
                  <span className="fm-drop-icon">
                    <i className="bi bi-cloud-arrow-up-fill" />
                  </span>
                  <p>
                    Kéo thả ảnh vào đây hoặc <span className="fm-link">chọn tệp từ máy tính</span>
                  </p>
                  <small>Hỗ trợ JPG, PNG, WEBP (tối đa 5MB) — lưu tối ưu trên máy chủ đám mây</small>
                </div>
              </div>
            )}
          </div>

          {/* ── Mô tả ── */}
          <div className="fm-field">
            <label className="fm-label" htmlFor="fm-desc">
              MÔ TẢ MÓN ĂN
            </label>
            <textarea
              id="fm-desc"
              name="description"
              className="fm-input fm-textarea"
              rows="3"
              value={form.description}
              onChange={change}
              placeholder="Nguyên liệu chính, đặc trưng vùng miền, cách chế biến..."
            />
          </div>
        </div>

        {/* Pinned Error Banner */}
        {apiError && (
          <div className="fm-api-err" role="alert" style={{ margin: '0 24px 10px', flexShrink: 0 }}>
            <i className="bi bi-exclamation-triangle-fill" />
            {apiError}
          </div>
        )}

        {/* Footer */}
        <footer className="fm-footer">
          <button className="fm-btn-cancel" onClick={onClose}>
            Hủy bỏ
          </button>
          <button className="fm-btn-save" onClick={submit} disabled={saving || uploadingImage}>
            {saving ? (
              <>
                <span className="food-spinner-inline" />
                Đang lưu...
              </>
            ) : (
              <>
                <i className="bi bi-check-lg" />
                {mode === 'add' ? 'Thêm vào danh mục' : 'Lưu thay đổi'}
              </>
            )}
          </button>
        </footer>
      </section>
    </div>
  )
}
