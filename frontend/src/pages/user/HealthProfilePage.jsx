import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import axiosInstance from '../../api/axiosInstance'
import { userUpdated } from '../../store/slices/authSlice'

const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: 'Ít vận động', detail: 'Hầu như chỉ ngồi hoặc nằm' },
  { value: 'light', label: 'Vận động nhẹ', detail: 'Đi bộ hoặc tập nhẹ 1-3 ngày/tuần' },
  { value: 'moderate', label: 'Vận động vừa', detail: 'Tập luyện 3-5 ngày/tuần' },
  { value: 'active', label: 'Năng động', detail: 'Tập luyện 6-7 ngày/tuần' },
  { value: 'very_active', label: 'Rất năng động', detail: 'Lao động nặng hoặc tập cường độ cao' },
]

const GOAL_OPTIONS = [
  { value: 'lose_weight', label: 'Giảm cân', icon: 'bi-arrow-down-right' },
  { value: 'maintain_weight', label: 'Duy trì cân nặng', icon: 'bi-arrow-left-right' },
  { value: 'gain_weight', label: 'Tăng cân', icon: 'bi-arrow-up-right' },
  { value: 'eat_healthier', label: 'Ăn uống lành mạnh', icon: 'bi-heart-pulse' },
]

const DIETARY_OPTIONS = ['Ăn chay', 'Thuần chay', 'Ít tinh bột', 'Ít đường', 'Không gluten', 'Không lactose']

const EMPTY_FORM = {
  fullName: '', phone: '', dateOfBirth: '', gender: '', avatarUrl: '',
  heightCm: '', currentWeightKg: '', targetWeightKg: '', activityLevel: '', healthGoal: '',
  dietaryPreferences: [], allergies: '', medicalConditions: '',
}

export default function HealthProfilePage() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
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

  const bmi = useMemo(() => {
    const height = Number(form.heightCm) / 100
    const weight = Number(form.currentWeightKg)
    return height > 0 && weight > 0 ? (weight / (height * height)).toFixed(1) : null
  }, [form.heightCm, form.currentWeightKg])

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
    setError('')
    setSuccess('')
    if (!form.fullName.trim() || !form.phone || !form.dateOfBirth || !form.gender || !form.heightCm || !form.currentWeightKg || !form.activityLevel || !form.healthGoal) {
      setError('Vui lòng hoàn tất các thông tin bắt buộc.')
      return
    }

    setSaving(true)
    try {
      const { data } = await axiosInstance.put('/profile', form)
      dispatch(userUpdated(data.user))
      setSuccess('Cập nhật hồ sơ thành công.')
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể lưu hồ sơ sức khỏe.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="profile-loading"><div className="spinner-border text-success" role="status" /><span className="visually-hidden">Đang tải</span></div>
  }

  return (
    <main className="profile-page">
      <header className="profile-header">
        <Link to="/dashboard" className="profile-back" aria-label="Quay về trang chủ"><i className="bi bi-arrow-left" /></Link>
        <div><p className="profile-eyebrow">NutriLens</p><h1>Hồ sơ cá nhân và sức khỏe</h1></div>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => navigate('/dashboard')}>Để sau</button>
      </header>

      <section className="profile-intro"><i className="bi bi-shield-check" aria-hidden="true" /><p>Thông tin này giúp NutriLens cá nhân hóa các gợi ý dinh dưỡng cho bạn.</p></section>

      <form className="profile-form" onSubmit={handleSubmit} noValidate>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
        {success && <div className="alert alert-success" role="status">{success}</div>}

        <section className="profile-section" aria-labelledby="personal-title">
          <div className="section-heading"><span className="section-number">1</span><div><h2 id="personal-title">Thông tin cá nhân</h2><p>Thông tin này được hiển thị tại các khu vực trong NutriLens.</p></div></div>
          <div className="avatar-editor">
            <div className="avatar-preview">{form.avatarUrl ? <img src={form.avatarUrl} alt="Ảnh đại diện của bạn" /> : <i className="bi bi-person-fill" />}</div>
            <div><strong>Ảnh đại diện</strong><p>JPG hoặc PNG, dung lượng tối đa 3MB.</p><label className={`avatar-upload ${uploadingAvatar ? 'is-uploading' : ''}`}><i className="bi bi-camera" />{uploadingAvatar ? 'Đang tải ảnh...' : 'Thay đổi ảnh'}<input type="file" accept="image/jpeg,image/png" onChange={updateAvatar} disabled={uploadingAvatar} /></label></div>
          </div>
          <div className="profile-fields profile-fields--two">
            <label>Họ và tên <span>*</span><input name="fullName" type="text" maxLength="100" placeholder="Nguyễn Văn A" value={form.fullName} onChange={updateField} /></label>
            <label>Số điện thoại <span>*</span><input name="phone" type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength="10" placeholder="0912345678" value={form.phone} onChange={updateField} /></label>
            <label>Giới tính <span>*</span><select name="gender" value={form.gender} onChange={updateField}><option value="">Chọn giới tính</option><option value="male">Nam</option><option value="female">Nữ</option></select></label>
            <label>Ngày sinh <span>*</span><input name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={updateField} /></label>
          </div>
        </section>

        <section className="profile-section" aria-labelledby="body-title">
          <div className="section-heading"><span className="section-number">2</span><div><h2 id="body-title">Chỉ số cơ thể</h2><p>Nhập số đo gần đây nhất của bạn.</p></div></div>
          <div className="profile-fields profile-fields--three">
            <label>Chiều cao <span>*</span><div className="unit-input"><input name="heightCm" type="number" min="100" max="250" step="0.1" placeholder="165" value={form.heightCm} onChange={updateField} /><em>cm</em></div></label>
            <label>Cân nặng hiện tại <span>*</span><div className="unit-input"><input name="currentWeightKg" type="number" min="20" max="300" step="0.1" placeholder="55" value={form.currentWeightKg} onChange={updateField} /><em>kg</em></div></label>
            <label>Cân nặng mục tiêu<div className="unit-input"><input name="targetWeightKg" type="number" min="20" max="300" step="0.1" placeholder="52" value={form.targetWeightKg} onChange={updateField} /><em>kg</em></div></label>
          </div>
          {bmi && <p className="bmi-result"><i className="bi bi-activity" /> BMI hiện tại của bạn là <strong>{bmi}</strong></p>}
        </section>

        <section className="profile-section" aria-labelledby="activity-title">
          <div className="section-heading"><span className="section-number">3</span><div><h2 id="activity-title">Mức độ vận động <span>*</span></h2><p>Chọn mức phù hợp nhất với tuần điển hình của bạn.</p></div></div>
          <div className="activity-options">{ACTIVITY_OPTIONS.map((option) => <label className={`choice-card ${form.activityLevel === option.value ? 'is-selected' : ''}`} key={option.value}><input type="radio" name="activityLevel" value={option.value} checked={form.activityLevel === option.value} onChange={updateField} /><span><strong>{option.label}</strong><small>{option.detail}</small></span><i className="bi bi-check-circle-fill" /></label>)}</div>
        </section>

        <section className="profile-section" aria-labelledby="goal-title">
          <div className="section-heading"><span className="section-number">4</span><div><h2 id="goal-title">Mục tiêu sức khỏe <span>*</span></h2><p>Bạn muốn NutriLens đồng hành cùng điều gì?</p></div></div>
          <div className="goal-options">{GOAL_OPTIONS.map((option) => <label className={`goal-card ${form.healthGoal === option.value ? 'is-selected' : ''}`} key={option.value}><input type="radio" name="healthGoal" value={option.value} checked={form.healthGoal === option.value} onChange={updateField} /><i className={`bi ${option.icon}`} /><span>{option.label}</span></label>)}</div>
        </section>

        <section className="profile-section" aria-labelledby="food-title">
          <div className="section-heading"><span className="section-number">5</span><div><h2 id="food-title">Lưu ý về dinh dưỡng</h2><p>Các mục này không bắt buộc, bạn có thể cập nhật sau.</p></div></div>
          <div className="preference-list">{DIETARY_OPTIONS.map((preference) => <label key={preference}><input type="checkbox" checked={form.dietaryPreferences.includes(preference)} onChange={() => togglePreference(preference)} /><span>{preference}</span></label>)}</div>
          <div className="profile-fields profile-fields--two mt-4"><label>Thực phẩm dị ứng<textarea name="allergies" rows="3" placeholder="Ví dụ: đậu phộng, hải sản..." value={form.allergies} onChange={updateField} /></label><label>Tình trạng sức khỏe cần lưu ý<textarea name="medicalConditions" rows="3" placeholder="Ví dụ: tiểu đường, huyết áp cao..." value={form.medicalConditions} onChange={updateField} /></label></div>
        </section>

        <div className="profile-actions"><Link to="/dashboard" className="btn btn-link text-secondary">Hủy</Link><button type="submit" className="btn btn-brand px-4" disabled={saving}>{saving ? 'Đang lưu...' : <><i className="bi bi-check2 me-2" />Lưu hồ sơ</>}</button></div>
      </form>
    </main>
  )
}
