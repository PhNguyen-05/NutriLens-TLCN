import { useRef, useState } from 'react'
import axiosInstance from '../../api/axiosInstance'
import {
  ADMIN_CATEGORIES,
  ADMIN_INTENSITIES,
  DEFAULT_CATEGORY_ICONS,
  DURATION_PRESETS,
  calcCalories,
  extractYouTubeId,
  getRecommendedIntensity,
} from '../../constants/exerciseConstants'
import IconPickerModal from './IconPickerModal'

const EMPTY_FORM = {
  name: '',
  category: 'cardio',
  intensity: 'Trung bình',
  met: '4.0',
  defaultDurationMinutes: '30',
  description: '',
  icon: '',
  imageUrl: '',
  youtubeUrl: '',
  isActive: true,
}

export default function ExerciseFormModal({
  mode = 'add',
  editTarget,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(() => {
    if (mode === 'edit' && editTarget) {
      return {
        name: editTarget.name || '',
        category: editTarget.category || 'cardio',
        intensity: editTarget.intensity || 'Trung bình',
        met: String(editTarget.met != null ? editTarget.met : '4.0'),
        defaultDurationMinutes: String(editTarget.defaultDurationMinutes || '30'),
        description: editTarget.description || '',
        icon: editTarget.icon || '',
        imageUrl: editTarget.imageUrl || '',
        youtubeUrl: editTarget.youtubeUrl || '',
        isActive: editTarget.isActive !== undefined ? editTarget.isActive : true,
      }
    }
    return { ...EMPTY_FORM }
  })

  const [isCustomDuration, setIsCustomDuration] = useState(() => {
    if (mode === 'edit' && editTarget) {
      const dur = String(editTarget.defaultDurationMinutes || '30')
      return !DURATION_PRESETS.some((opt) => opt.value === dur)
    }
    return false
  })

  const [showIconPicker, setShowIconPicker] = useState(false)
  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [saving, setSaving] = useState(false)
  const adminFileInputRef = useRef(null)

  function handleAdminImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const img = new Image()
      img.onload = () => {
        const MAX_SIZE = 800
        let width = img.width
        let height = img.height
        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width)
            width = MAX_SIZE
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height)
            height = MAX_SIZE
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        const compressed = canvas.toDataURL('image/jpeg', 0.82)
        setForm((p) => ({ ...p, imageUrl: compressed }))
      }
      img.src = evt.target.result
    }
    reader.readAsDataURL(file)
  }

  function change(e) {
    const { name, value, type, checked } = e.target
    const val = type === 'checkbox' ? checked : value
    setForm((prev) => ({ ...prev, [name]: val }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }))
    if (apiError) setApiError('')
  }

  function handleDurationSelect(e) {
    const val = e.target.value
    if (val === '__CUSTOM__') {
      setIsCustomDuration(true)
    } else {
      setIsCustomDuration(false)
      setForm((prev) => ({ ...prev, defaultDurationMinutes: val }))
      if (errors.defaultDurationMinutes)
        setErrors((prev) => ({ ...prev, defaultDurationMinutes: undefined }))
    }
  }

  function handleSwitchToPreset() {
    setIsCustomDuration(false)
    setForm((prev) => ({ ...prev, defaultDurationMinutes: '30' }))
    if (errors.defaultDurationMinutes)
      setErrors((prev) => ({ ...prev, defaultDurationMinutes: undefined }))
  }

  function validateForm() {
    const errs = {}
    if (!form.name.trim()) {
      errs.name = 'Tên bài tập không được để trống'
    }
    const metNum = Number(form.met)
    if (form.met === '' || !Number.isFinite(metNum) || metNum <= 0) {
      errs.met = 'Giá trị MET không hợp lệ, phải lớn hơn 0'
    } else if (metNum > 30) {
      errs.met = 'Giá trị MET tối đa là 30.0 (giới hạn sinh lý người)'
    }

    const durNum = Number(form.defaultDurationMinutes)
    if (form.defaultDurationMinutes === '' || !Number.isFinite(durNum) || durNum <= 0) {
      errs.defaultDurationMinutes = 'Thời lượng gợi ý phải lớn hơn 0 phút'
    } else if (durNum > 720) {
      errs.defaultDurationMinutes = 'Thời lượng gợi ý tối đa không quá 720 phút (12 giờ)'
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
      else if (errs.defaultDurationMinutes) setApiError(errs.defaultDurationMinutes)
      return
    }

    setSaving(true)
    setApiError('')

    try {
      const parsedDuration = Number(form.defaultDurationMinutes)
      const payload = {
        name: form.name.trim(),
        category: form.category,
        intensity: form.intensity,
        met: Number(form.met),
        defaultDurationMinutes:
          Number.isFinite(parsedDuration) && parsedDuration > 0
            ? Math.round(parsedDuration)
            : 30,
        description: form.description.trim(),
        icon: form.icon,
        imageUrl: String(form.imageUrl || '').trim(),
        youtubeUrl: String(form.youtubeUrl || '').trim(),
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
      const msg =
        err.response?.data?.message || 'Không thể cập nhật thông tin bài tập, vui lòng thử lại'
      setApiError(msg)
      if (err.response?.status === 409) {
        setErrors((prev) => ({ ...prev, name: msg }))
      }
    } finally {
      setSaving(false)
    }
  }

  const previewKcal = calcCalories(form.met, 60, form.defaultDurationMinutes)
  const recommendedIntensity = getRecommendedIntensity(form.met)
  const isIntensityMismatched =
    recommendedIntensity && recommendedIntensity !== form.intensity
  const currentIconId = form.icon || DEFAULT_CATEGORY_ICONS[form.category] || 'bi-activity'
  const ytVideoId = extractYouTubeId(form.youtubeUrl)

  return (
    <>
      <div
        className="fm-backdrop"
        role="presentation"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !saving) onClose()
        }}
      >
        <section className="fm-modal exm-form-modal" role="dialog" aria-modal="true">
          <header className="fm-header">
            <div
              className="fm-header-icon"
              style={{
                background: 'linear-gradient(135deg, #ecfdf5, #a7f3d0)',
                color: '#059669',
              }}
            >
              <i className="bi bi-person-walking" />
            </div>
            <div className="fm-header-text">
              <h2>
                {mode === 'add'
                  ? 'Thêm bài tập mới vào Danh mục'
                  : `Chỉnh sửa bài tập: ${editTarget?.name}`}
              </h2>
            </div>
            <button className="fm-close" onClick={onClose} disabled={saving} aria-label="Đóng">
              <i className="bi bi-x-lg" />
            </button>
          </header>

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
                  <span className="fm-hint">
                    <i className="bi bi-info-circle" /> Tên bài tập đại diện cho hành vi vận động của người dùng
                  </span>
                )}
              </div>
            </div>

            {/* Biểu tượng + Nhóm + Cường độ */}
            <div className="fm-section">
              <div className="fm-row exm-row--cats">
                <div className="fm-field">
                  <label className="fm-label" htmlFor="ex-category">
                    NHÓM / THỂ LOẠI BÀI TẬP <span className="fm-req">*</span>
                  </label>
                  <select
                    id="ex-category"
                    name="category"
                    className="fm-input"
                    value={form.category}
                    onChange={change}
                  >
                    {ADMIN_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <span className="fm-hint">
                    <i className="bi bi-tag" /> Dùng để phân loại trên bộ lọc của người dùng
                  </span>
                </div>

                <div className="fm-field">
                  <label className="fm-label">
                    MỨC ĐỘ / CƯỜNG ĐỘ <span className="fm-req">*</span>
                  </label>
                  <div className="exm-intensity-selector">
                    {ADMIN_INTENSITIES.map((lvl) => (
                      <button
                        key={lvl.label}
                        type="button"
                        className={`exm-intensity-btn ${
                          form.intensity === lvl.label ? 'active' : ''
                        } ${lvl.cls}`}
                        onClick={() => setForm((p) => ({ ...p, intensity: lvl.label }))}
                      >
                        {lvl.label}
                      </button>
                    ))}
                  </div>
                  <span className="fm-hint">
                    <i className="bi bi-speedometer2" />{' '}
                    {ADMIN_INTENSITIES.find((i) => i.label === form.intensity)?.desc}
                  </span>
                </div>
              </div>
            </div>

            {/* Biểu tượng icon picker trigger */}
            <div className="fm-section">
              <div className="fm-field">
                <label className="fm-label">BIỂU TƯỢNG (ICON)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: '#f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.4rem',
                      color: '#059669',
                      border: '1px solid #cbd5e1',
                    }}
                  >
                    <i className={`bi ${currentIconId}`} />
                  </div>
                  <button
                    type="button"
                    className="fm-btn-outline"
                    onClick={() => setShowIconPicker(true)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: '#0f172a',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <i className="bi bi-grid-3x3-gap-fill" /> Chọn biểu tượng từ kho
                  </button>
                  {form.icon && (
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, icon: '' }))}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      Đặt lại mặc định
                    </button>
                  )}
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
                    <span className="fm-hint">
                      <i className="bi bi-lightning-fill" /> 1 MET = 1 kcal/kg/h
                    </span>
                  )}
                </div>

                <div className="fm-field">
                  <label className="fm-label" htmlFor="ex-dur">
                    THỜI LƯỢNG GỢI Ý (PHÚT)
                    {isCustomDuration ? (
                      <button
                        type="button"
                        className="fm-group-switch-btn"
                        onClick={handleSwitchToPreset}
                      >
                        (Chọn khung giờ)
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="fm-group-switch-btn"
                        onClick={() => setIsCustomDuration(true)}
                      >
                        (Tự điền)
                      </button>
                    )}
                  </label>

                  {isCustomDuration ? (
                    <input
                      id="ex-dur"
                      name="defaultDurationMinutes"
                      type="number"
                      min="1"
                      max="720"
                      className={`fm-input ${
                        errors.defaultDurationMinutes ? 'fm-input--err' : ''
                      }`}
                      value={form.defaultDurationMinutes}
                      onChange={change}
                      placeholder="30"
                      autoFocus
                    />
                  ) : (
                    <select
                      id="ex-dur"
                      className="fm-select"
                      value={form.defaultDurationMinutes}
                      onChange={handleDurationSelect}
                    >
                      {DURATION_PRESETS.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                      <option value="__CUSTOM__">➕ Tự điền số phút khác...</option>
                    </select>
                  )}

                  {errors.defaultDurationMinutes && (
                    <span className="fm-err-msg">{errors.defaultDurationMinutes}</span>
                  )}
                </div>

                <div className="fm-field">
                  <label className="fm-label">ƯỚC TÍNH NĂNG LƯỢNG</label>
                  <div className="exm-live-kcal-box">
                    <span className="exm-live-kcal-icon">
                      <i className="bi bi-fire" />
                    </span>
                    <div>
                      <strong>~{previewKcal} kcal</strong>
                      <small>Người 60kg / {form.defaultDurationMinutes || 0}p</small>
                    </div>
                  </div>
                </div>
              </div>

              {isIntensityMismatched && (
                <div className="exm-logic-hint">
                  <div className="exm-logic-hint-content">
                    <i className="bi bi-lightbulb-fill" />
                    <span>
                      Gợi ý chuẩn hóa: Với chỉ số MET = <strong>{form.met}</strong>, mức độ khuyến nghị là <strong>"{recommendedIntensity}"</strong> (hiện tại: "{form.intensity}").
                    </span>
                  </div>
                  <button
                    type="button"
                    className="exm-logic-hint-btn"
                    onClick={() => setForm((p) => ({ ...p, intensity: recommendedIntensity }))}
                  >
                    <i className="bi bi-magic" /> Đồng bộ: {recommendedIntensity}
                  </button>
                </div>
              )}
            </div>

            {/* Link hình ảnh & Link Video YouTube */}
            <div className="fm-section">
              <div className="fm-row">
                <div className="fm-field">
                  <label className="fm-label" htmlFor="ex-image">
                    HÌNH ẢNH MINH HỌA (URL HOẶC TẢI LÊN)
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      id="ex-image"
                      name="imageUrl"
                      type="url"
                      className="fm-input"
                      value={form.imageUrl}
                      onChange={change}
                      placeholder="https://images.unsplash.com/... hoặc bấm Tải ảnh"
                    />
                    <input
                      type="file"
                      ref={adminFileInputRef}
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleAdminImageUpload}
                    />
                    <button
                      type="button"
                      onClick={() => adminFileInputRef.current?.click()}
                      style={{
                        padding: '0 14px',
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        background: '#f8fafc',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: '#0f172a',
                        cursor: 'pointer',
                      }}
                    >
                      <i className="bi bi-upload" /> Tải ảnh
                    </button>
                  </div>
                  <span className="fm-hint">
                    <i className="bi bi-image" /> Nhập đường dẫn ảnh hoặc bấm "Tải ảnh" để chọn từ thiết bị
                  </span>
                </div>
                <div className="fm-field">
                  <label className="fm-label" htmlFor="ex-yt">
                    LINK VIDEO YOUTUBE HƯỚNG DẪN (URL)
                  </label>
                  <input
                    id="ex-yt"
                    name="youtubeUrl"
                    type="url"
                    className="fm-input"
                    value={form.youtubeUrl}
                    onChange={change}
                    placeholder="https://www.youtube.com/watch?v=... hoặc /shorts/..."
                  />
                  <span className="fm-hint">
                    <i className="bi bi-youtube" style={{ color: '#ef4444' }} /> Hỗ trợ video thường, Shorts và livestream
                  </span>
                </div>
              </div>
              {form.imageUrl && (
                <div
                  style={{
                    marginTop: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '8px 12px',
                    background: '#f8fafc',
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img
                      src={form.imageUrl}
                      alt="Preview"
                      style={{
                        width: 80,
                        height: 50,
                        objectFit: 'cover',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                      }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                      }}
                    />
                    <div>
                      <strong style={{ fontSize: '0.84rem', color: '#059669', display: 'block' }}>
                        Ảnh minh họa đã sẵn sàng
                      </strong>
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {form.imageUrl.startsWith('data:')
                          ? 'Ảnh tải từ thiết bị'
                          : form.imageUrl.slice(0, 50) + '...'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ex-btn-clear-img"
                    onClick={() => {
                      setForm((p) => ({ ...p, imageUrl: '' }))
                      if (adminFileInputRef.current) adminFileInputRef.current.value = ''
                    }}
                    title="Xóa ảnh này"
                  >
                    <i className="bi bi-trash3" /> Xóa ảnh
                  </button>
                </div>
              )}
              {ytVideoId && (
                <div style={{ marginTop: 10, padding: '8px 12px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="bi bi-check-circle-fill" style={{ color: '#ef4444' }} />
                  <span style={{ fontSize: '0.82rem', color: '#991b1b' }}>
                    Đã nhận diện YouTube Video ID: <code>{ytVideoId}</code>
                  </span>
                </div>
              )}
            </div>

            {/* Mô tả */}
            <div className="fm-section">
              <div className="fm-field">
                <label className="fm-label" htmlFor="ex-desc">
                  MÔ TẢ CHI TIẾT &amp; HƯỚNG DẪN KỸ THUẬT
                </label>
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
                  <small>
                    Nếu tắt, bài tập sẽ ở trạng thái "Không hoạt động" (ẩn) và chỉ hiển thị trong trang quản trị.
                  </small>
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
              <button
                type="button"
                className="fm-btn-cancel"
                onClick={onClose}
                disabled={saving}
              >
                Hủy bỏ
              </button>
              <button type="submit" className="fm-btn-save" disabled={saving}>
                {saving ? (
                  <>
                    <span className="food-spinner-inline" /> Đang lưu...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-lg" />{' '}
                    {mode === 'add' ? 'Lưu bài tập' : 'Cập nhật bài tập'}
                  </>
                )}
              </button>
            </footer>
          </form>
        </section>
      </div>

      {showIconPicker && (
        <IconPickerModal
          currentIcon={form.icon}
          currentCategory={form.category}
          onSelect={(icon) => setForm((p) => ({ ...p, icon }))}
          onClose={() => setShowIconPicker(false)}
        />
      )}
    </>
  )
}
