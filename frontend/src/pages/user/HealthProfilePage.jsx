import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import axiosInstance from '../../api/axiosInstance'
import { userUpdated } from '../../store/slices/authSlice'

const BASE_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'

const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: 'Ít vận động', detail: 'Hầu như chỉ ngồi hoặc nằm', icon: 'bi-person-seated' },
  { value: 'light', label: 'Vận động nhẹ', detail: 'Đi bộ hoặc tập nhẹ 1–3 ngày/tuần', icon: 'bi-person-walking' },
  { value: 'moderate', label: 'Vận động vừa', detail: 'Tập luyện 3–5 ngày/tuần', icon: 'bi-bicycle' },
  { value: 'active', label: 'Năng động', detail: 'Tập luyện 6–7 ngày/tuần', icon: 'bi-lightning-charge' },
  { value: 'very_active', label: 'Rất năng động', detail: 'Lao động nặng hoặc tập cường độ cao', icon: 'bi-trophy' },
]

const GOAL_OPTIONS = [
  { value: 'lose_weight', label: 'Giảm cân', icon: 'bi-arrow-down-circle', color: '#3b82f6', bg: '#eff6ff' },
  { value: 'maintain_weight', label: 'Duy trì cân nặng', icon: 'bi-shield-check', color: '#10b981', bg: '#ecfdf5' },
  { value: 'gain_weight', label: 'Tăng cân', icon: 'bi-arrow-up-circle', color: '#f59e0b', bg: '#fffbeb' },
  { value: 'eat_healthier', label: 'Ăn uống lành mạnh', icon: 'bi-heart-pulse', color: '#ef4444', bg: '#fef2f2' },
]

const DIETARY_OPTIONS = [
  { label: 'Ăn chay', icon: '🥗' },
  { label: 'Thuần chay', icon: '🌱' },
  { label: 'Ít tinh bột', icon: '🍞' },
  { label: 'Ít đường', icon: '🍬' },
  { label: 'Không gluten', icon: '🌾' },
  { label: 'Không lactose', icon: '🥛' },
]

const EMPTY_FORM = {
  fullName: '', phone: '', dateOfBirth: '', gender: '', avatarUrl: '',
  heightCm: '', currentWeightKg: '', targetWeightKg: '', activityLevel: '', healthGoal: '',
  dietaryPreferences: [], allergies: '', medicalConditions: '',
}

function getBmiCategory(bmi) {
  const b = Number(bmi)
  if (b < 18.5) return { label: 'Thiếu cân', color: '#3b82f6', pct: 20 }
  if (b < 25) return { label: 'Bình thường', color: '#10b981', pct: 45 }
  if (b < 30) return { label: 'Thừa cân', color: '#f59e0b', pct: 70 }
  return { label: 'Béo phì', color: '#ef4444', pct: 88 }
}

export default function HealthProfilePage() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let isActive = true
    async function loadProfile() {
      try {
        const { data } = await axiosInstance.get('/profile')
        if (isActive) {
          const profile = data.profile || {}
          const { heightCm, currentWeightKg, targetWeightKg, activityLevel, healthGoal, dietaryPreferences, allergies, medicalConditions } = profile
          setForm({
            fullName: data.user?.fullName || '', phone: data.user?.phone || '',
            dateOfBirth: data.user?.dateOfBirth ? data.user.dateOfBirth.slice(0, 10) : '',
            gender: data.user?.gender || '', avatarUrl: data.user?.avatarUrl || '',
            heightCm: String(heightCm ?? ''), currentWeightKg: String(currentWeightKg ?? ''),
            targetWeightKg: targetWeightKg == null ? '' : String(targetWeightKg), activityLevel: activityLevel || '',
            healthGoal: healthGoal || '', dietaryPreferences: dietaryPreferences || [], allergies: allergies || '',
            medicalConditions: medicalConditions || '',
          })
        }
      } catch (err) {
        if (isActive) setError(err.response?.data?.message || 'Không thể tải hồ sơ sức khỏe.')
      } finally {
        if (isActive) setLoading(false)
      }
    }
    loadProfile()
    return () => { isActive = false }
  }, [])

  // Đặt lại trạng thái lỗi ảnh nếu url ảnh thay đổi
  useEffect(() => {
    if (form.avatarUrl) setImgError(false)
  }, [form.avatarUrl])

  const age = useMemo(() => {
    if (!form.dateOfBirth) return 0
    const birthDate = new Date(form.dateOfBirth)
    const today = new Date()
    let a = today.getFullYear() - birthDate.getFullYear()
    const m = today.getMonth() - birthDate.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) a--
    return a
  }, [form.dateOfBirth])

  const bmi = useMemo(() => {
    const height = Number(form.heightCm) / 100
    const weight = Number(form.currentWeightKg)
    return height > 0 && weight > 0 ? (weight / (height * height)).toFixed(1) : null
  }, [form.heightCm, form.currentWeightKg])

  const bmiInfo = useMemo(() => bmi ? getBmiCategory(bmi) : null, [bmi])

  const bmr = useMemo(() => {
    const h = Number(form.heightCm)
    const w = Number(form.currentWeightKg)
    if (h > 0 && w > 0 && age > 0 && form.gender) {
      // Công thức Mifflin-St Jeor
      let base = 10 * w + 6.25 * h - 5 * age
      return form.gender === 'male' ? Math.round(base + 5) : Math.round(base - 161)
    }
    return null
  }, [form.heightCm, form.currentWeightKg, age, form.gender])

  const tdee = useMemo(() => {
    if (!bmr || !form.activityLevel) return null
    const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 }
    return Math.round(bmr * (multipliers[form.activityLevel] || 1.2))
  }, [bmr, form.activityLevel])

  function updateField(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setError('')
    setSuccess('')
  }

  function togglePreference(preference) {
    setForm((current) => ({
      ...current,
      dietaryPreferences: current.dietaryPreferences.includes(preference)
        ? current.dietaryPreferences.filter((item) => item !== preference)
        : [...current.dietaryPreferences, preference],
    }))
  }

  async function updateAvatar(event) {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    setSuccess('')
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 3 * 1024 * 1024) {
      setError('Ảnh đại diện chỉ hỗ trợ JPG/PNG và không được vượt quá 3MB.')
      event.target.value = ''
      return
    }

    const avatarData = new FormData()
    avatarData.append('avatar', file)
    setUploadingAvatar(true)
    try {
      const { data } = await axiosInstance.post('/profile/avatar', avatarData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      dispatch(userUpdated(data.user))
      setForm((current) => ({ ...current, avatarUrl: data.user.avatarUrl }))
      setSuccess('Đã cập nhật ảnh đại diện.')
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể cập nhật ảnh đại diện.')
    } finally {
      setUploadingAvatar(false)
      event.target.value = ''
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitted(true)
    setError('')
    setSuccess('')
    
    if (!form.fullName.trim() || !form.phone || !form.dateOfBirth || !form.gender || !form.heightCm || !form.currentWeightKg || !form.activityLevel || !form.healthGoal) {
      setError('Vui lòng hoàn tất các thông tin bắt buộc được đánh dấu đỏ.')
      // Scroll lên đầu để thấy lỗi
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setSaving(true)
    try {
      const { data } = await axiosInstance.put('/profile', form)
      dispatch(userUpdated(data.user))
      setSuccess('Cập nhật hồ sơ thành công. Đang chuyển hướng...')
      setTimeout(() => navigate('/dashboard'), 1500)
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể lưu hồ sơ sức khỏe.')
    } finally {
      setSaving(false)
    }
  }

  const isInvalid = (field) => submitted && !form[field]

  // Xử lý URL ảnh nếu là đường dẫn tương đối (đề phòng API trả về /uploads/...)
  const getAvatarUrl = (url) => {
    if (!url) return null
    if (url.startsWith('http') || url.startsWith('data:')) return url
    return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`
  }
  const displayAvatar = getAvatarUrl(form.avatarUrl)

  if (loading) {
    return (
      <div className="hp-loading">
        <div className="hp-loading__spinner">
          <div className="hp-loading__ring" />
          <i className="bi bi-heart-pulse hp-loading__icon" />
        </div>
        <p className="hp-loading__text">Đang tải hồ sơ của bạn…</p>
      </div>
    )
  }

  return (
    <div className="hp-shell">
      {/* ── Main content ── */}
      <main className="hp-main">
        {/* Top bar */}
        <header className="hp-topbar">
          <Link to="/dashboard" className="hp-back" aria-label="Quay lại">
            <i className="bi bi-arrow-left" />
          </Link>
          <div className="hp-topbar__title">
            <span className="hp-topbar__eyebrow">NutriLens</span>
            <h1>Hồ sơ sức khỏe</h1>
          </div>
          <button type="button" className="hp-skip" onClick={() => navigate('/dashboard')}>
            Để sau
          </button>
        </header>

        {/* Info banner */}
        <div className="hp-banner">
          <i className="bi bi-shield-check" />
          <p>Thông tin này giúp NutriLens cá nhân hóa gợi ý dinh dưỡng phù hợp nhất với bạn.</p>
        </div>

        <form className="hp-form" onSubmit={handleSubmit} noValidate>

          {/* Alerts */}
          {error && (
            <div className="hp-alert hp-alert--error" role="alert">
              <i className="bi bi-exclamation-circle" />
              {error}
            </div>
          )}
          {success && (
            <div className="hp-alert hp-alert--success" role="status">
              <i className="bi bi-check-circle" />
              {success}
            </div>
          )}

          {/* ── Section 1: Personal info ── */}
          <section className="hp-card" aria-labelledby="sec-personal">
            <div className="hp-card__header">
              <div className="hp-card__badge">1</div>
              <div>
                <h2 id="sec-personal">Thông tin cá nhân</h2>
                <p>Thông tin hiển thị trong tài khoản NutriLens của bạn.</p>
              </div>
            </div>

            {/* Avatar */}
            <div className="hp-avatar-row">
              <div className="hp-avatar">
                {displayAvatar && !imgError
                  ? <img src={displayAvatar} alt="Ảnh đại diện" onError={() => setImgError(true)} />
                  : <i className="bi bi-person-fill" />}
                <label className={`hp-avatar__edit ${uploadingAvatar ? 'is-busy' : ''}`} title="Đổi ảnh đại diện">
                  {uploadingAvatar ? <i className="bi bi-hourglass-split" /> : <i className="bi bi-camera-fill" />}
                  <input type="file" accept="image/jpeg,image/png" onChange={updateAvatar} disabled={uploadingAvatar} />
                </label>
              </div>
              <div className="hp-avatar-info">
                <strong>Ảnh đại diện</strong>
                <p>JPG hoặc PNG, tối đa 3 MB. Ảnh đẹp giúp bạn trông chuyên nghiệp hơn!</p>
                <label className={`hp-upload-btn ${uploadingAvatar ? 'is-busy' : ''}`}>
                  <i className="bi bi-cloud-arrow-up" />
                  {uploadingAvatar ? 'Đang tải lên…' : 'Tải ảnh lên'}
                  <input type="file" accept="image/jpeg,image/png" onChange={updateAvatar} disabled={uploadingAvatar} />
                </label>
              </div>
            </div>

            <div className="hp-grid hp-grid--2">
              <div className={`hp-field ${isInvalid('fullName') ? 'is-invalid' : ''}`}>
                <label htmlFor="fullName">Họ và tên <span className="hp-required">*</span></label>
                <input id="fullName" name="fullName" type="text" maxLength="100"
                  placeholder="Nguyễn Văn A" value={form.fullName} onChange={updateField} />
                {isInvalid('fullName') && <span className="hp-field__error">Vui lòng nhập họ và tên</span>}
              </div>
              <div className={`hp-field ${isInvalid('phone') ? 'is-invalid' : ''}`}>
                <label htmlFor="phone">Số điện thoại <span className="hp-required">*</span></label>
                <input id="phone" name="phone" type="tel" inputMode="numeric"
                  pattern="[0-9]{10}" maxLength="10" placeholder="0912 345 678"
                  value={form.phone} onChange={updateField} />
                {isInvalid('phone') && <span className="hp-field__error">Vui lòng nhập số điện thoại hợp lệ</span>}
              </div>
              <div className={`hp-field ${isInvalid('gender') ? 'is-invalid' : ''}`}>
                <label htmlFor="gender">Giới tính <span className="hp-required">*</span></label>
                <select id="gender" name="gender" value={form.gender} onChange={updateField}>
                  <option value="">Chọn giới tính</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                </select>
                {isInvalid('gender') && <span className="hp-field__error">Vui lòng chọn giới tính</span>}
              </div>
              <div className={`hp-field ${isInvalid('dateOfBirth') ? 'is-invalid' : ''}`}>
                <label htmlFor="dateOfBirth">Ngày sinh <span className="hp-required">*</span></label>
                <input id="dateOfBirth" name="dateOfBirth" type="date"
                  value={form.dateOfBirth} onChange={updateField} />
                {isInvalid('dateOfBirth') && <span className="hp-field__error">Vui lòng chọn ngày sinh</span>}
              </div>
            </div>
          </section>

          {/* ── Section 2: Body metrics ── */}
          <section className="hp-card" aria-labelledby="sec-body">
            <div className="hp-card__header">
              <div className="hp-card__badge">2</div>
              <div>
                <h2 id="sec-body">Chỉ số cơ thể</h2>
                <p>NutriLens sử dụng công thức Mifflin-St Jeor để tính chỉ số trao đổi chất (BMR) & TDEE.</p>
              </div>
            </div>

            <div className="hp-grid hp-grid--3">
              <div className={`hp-field ${isInvalid('heightCm') ? 'is-invalid' : ''}`}>
                <label htmlFor="heightCm">Chiều cao <span className="hp-required">*</span></label>
                <div className="hp-unit-input">
                  <input id="heightCm" name="heightCm" type="number"
                    min="100" max="250" step="0.1" placeholder="165"
                    value={form.heightCm} onChange={updateField} />
                  <span>cm</span>
                </div>
                {isInvalid('heightCm') && <span className="hp-field__error">Bắt buộc</span>}
              </div>
              <div className={`hp-field ${isInvalid('currentWeightKg') ? 'is-invalid' : ''}`}>
                <label htmlFor="currentWeightKg">Cân nặng hiện tại <span className="hp-required">*</span></label>
                <div className="hp-unit-input">
                  <input id="currentWeightKg" name="currentWeightKg" type="number"
                    min="20" max="300" step="0.1" placeholder="55"
                    value={form.currentWeightKg} onChange={updateField} />
                  <span>kg</span>
                </div>
                {isInvalid('currentWeightKg') && <span className="hp-field__error">Bắt buộc</span>}
              </div>
              <div className="hp-field">
                <label htmlFor="targetWeightKg">Cân nặng mục tiêu</label>
                <div className="hp-unit-input">
                  <input id="targetWeightKg" name="targetWeightKg" type="number"
                    min="20" max="300" step="0.1" placeholder="52"
                    value={form.targetWeightKg} onChange={updateField} />
                  <span>kg</span>
                </div>
              </div>
            </div>

            {/* BMI & BMR card */}
            {(bmi || bmr) && (
              <div className="hp-metrics">
                {bmi && bmiInfo && (
                  <div className="hp-bmi">
                    <div className="hp-bmi__left">
                      <span className="hp-bmi__label">BMI của bạn</span>
                      <strong className="hp-bmi__value" style={{ color: bmiInfo.color }}>{bmi}</strong>
                      <span className="hp-bmi__cat" style={{ color: bmiInfo.color, backgroundColor: bmiInfo.bg ?? '#f0fdf4' }}>
                        {bmiInfo.label}
                      </span>
                    </div>
                    <div className="hp-bmi__right">
                      <div className="hp-bmi__bar">
                        <div className="hp-bmi__track" />
                        <div className="hp-bmi__needle" style={{ left: `${bmiInfo.pct}%`, backgroundColor: bmiInfo.color }} />
                      </div>
                      <div className="hp-bmi__scale">
                        <span>Thiếu cân</span><span>Bình thường</span><span>Thừa cân</span><span>Béo phì</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {bmr && (
                  <div className="hp-bmr-stats">
                    <div className="hp-bmr-stat">
                      <i className="bi bi-fire" />
                      <div>
                        <strong>{bmr} <span>kcal/ngày</span></strong>
                        <p>BMR (Năng lượng chuyển hóa cơ bản)</p>
                      </div>
                    </div>
                    {tdee && (
                      <div className="hp-bmr-stat">
                        <i className="bi bi-lightning-charge" />
                        <div>
                          <strong>{tdee} <span>kcal/ngày</span></strong>
                          <p>TDEE (Tổng năng lượng tiêu hao)</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* ── Section 3: Activity level ── */}
          <section className="hp-card" aria-labelledby="sec-activity">
            <div className="hp-card__header">
              <div className="hp-card__badge">3</div>
              <div>
                <h2 id="sec-activity">Mức độ vận động <span className="hp-required">*</span></h2>
                <p>Chọn mức phù hợp nhất với thói quen của bạn trong một tuần điển hình.</p>
              </div>
            </div>

            <div className="hp-activity-grid">
              {ACTIVITY_OPTIONS.map((opt) => {
                const isActive = form.activityLevel === opt.value
                const isErr = isInvalid('activityLevel')
                return (
                  <label
                    className={`hp-activity-card ${isActive ? 'is-active' : ''} ${isErr ? 'is-error' : ''}`}
                    key={opt.value}
                  >
                    <input type="radio" name="activityLevel" value={opt.value}
                      checked={isActive} onChange={updateField} />
                    <div className="hp-activity-card__icon">
                      <i className={`bi ${opt.icon}`} />
                    </div>
                    <div className="hp-activity-card__body">
                      <strong>{opt.label}</strong>
                      <small>{opt.detail}</small>
                    </div>
                    <i className="bi bi-check-circle-fill hp-activity-card__check" />
                  </label>
                )
              })}
            </div>
            {isInvalid('activityLevel') && <div className="hp-section-error"><i className="bi bi-exclamation-triangle" /> Vui lòng chọn mức độ vận động</div>}
          </section>

          {/* ── Section 4: Health goal ── */}
          <section className="hp-card" aria-labelledby="sec-goal">
            <div className="hp-card__header">
              <div className="hp-card__badge">4</div>
              <div>
                <h2 id="sec-goal">Mục tiêu sức khỏe <span className="hp-required">*</span></h2>
                <p>Bạn muốn NutriLens hỗ trợ bạn trong lĩnh vực nào?</p>
              </div>
            </div>

            <div className="hp-goal-grid">
              {GOAL_OPTIONS.map((opt) => {
                const isActive = form.healthGoal === opt.value
                const isErr = isInvalid('healthGoal')
                return (
                  <label
                    className={`hp-goal-card ${isActive ? 'is-active' : ''} ${isErr ? 'is-error' : ''}`}
                    key={opt.value}
                    style={isActive ? { borderColor: opt.color, backgroundColor: opt.bg } : {}}
                  >
                    <input type="radio" name="healthGoal" value={opt.value}
                      checked={isActive} onChange={updateField} />
                    <div className="hp-goal-card__icon" style={{ color: opt.color, backgroundColor: opt.bg }}>
                      <i className={`bi ${opt.icon}`} />
                    </div>
                    <span className="hp-goal-card__label">{opt.label}</span>
                    {isActive && (
                      <i className="bi bi-check-circle-fill hp-goal-card__check" style={{ color: opt.color }} />
                    )}
                  </label>
                )
              })}
            </div>
            {isInvalid('healthGoal') && <div className="hp-section-error"><i className="bi bi-exclamation-triangle" /> Vui lòng chọn mục tiêu sức khỏe</div>}
          </section>

          {/* ── Section 5: Nutrition notes ── */}
          <section className="hp-card" aria-labelledby="sec-nutrition">
            <div className="hp-card__header">
              <div className="hp-card__badge">5</div>
              <div>
                <h2 id="sec-nutrition">Lưu ý dinh dưỡng</h2>
                <p>Không bắt buộc — giúp NutriLens gợi ý thực đơn phù hợp hơn với bạn.</p>
              </div>
            </div>

            <div className="hp-tag-group">
              {DIETARY_OPTIONS.map(({ label, icon }) => (
                <button
                  type="button"
                  key={label}
                  className={`hp-tag ${form.dietaryPreferences.includes(label) ? 'is-active' : ''}`}
                  onClick={() => togglePreference(label)}
                >
                  <span className="hp-tag__emoji">{icon}</span>
                  {label}
                  {form.dietaryPreferences.includes(label) && <i className="bi bi-x-circle-fill hp-tag__remove" />}
                </button>
              ))}
            </div>

            <div className="hp-grid hp-grid--2 mt-4">
              <div className="hp-field">
                <label htmlFor="allergies">
                  <i className="bi bi-exclamation-triangle me-1" style={{ color: '#f59e0b' }} />
                  Thực phẩm dị ứng
                </label>
                <textarea id="allergies" name="allergies" rows="3"
                  placeholder="Ví dụ: đậu phộng, hải sản, trứng..."
                  value={form.allergies} onChange={updateField} />
              </div>
              <div className="hp-field">
                <label htmlFor="medicalConditions">
                  <i className="bi bi-heart-pulse me-1" style={{ color: '#ef4444' }} />
                  Tình trạng sức khỏe cần lưu ý
                </label>
                <textarea id="medicalConditions" name="medicalConditions" rows="3"
                  placeholder="Ví dụ: tiểu đường, huyết áp cao..."
                  value={form.medicalConditions} onChange={updateField} />
              </div>
            </div>
          </section>

          {/* ── Footer actions ── */}
          <div className="hp-actions">
            <Link to="/dashboard" className="hp-actions__cancel">
              <i className="bi bi-x" />
              Hủy
            </Link>
            <button type="submit" className="hp-actions__save" disabled={saving}>
              {saving
                ? <><div className="hp-spinner" /><span>Đang lưu…</span></>
                : <><i className="bi bi-check2" /><span>Lưu hồ sơ</span></>}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
