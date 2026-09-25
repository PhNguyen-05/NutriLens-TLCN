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

const NUTRITION_GOAL_OPTIONS = [
  {
    value: 'lose_weight',
    label: 'Giảm cân',
    sub: 'Thâm hụt 500 kcal/ngày (Khuyến nghị giảm mỡ bền vững)',
    icon: 'bi-arrow-down-circle',
    color: '#3b82f6',
    bg: '#eff6ff',
    calcCalo: (bmr, tdee) => Math.max(bmr, tdee - 500),
    macros: { protein: 30, carbs: 40, fat: 30 },
  },
  {
    value: 'maintain_weight',
    label: 'Duy trì cân nặng',
    sub: 'Cân bằng năng lượng theo mức tiêu thụ TDEE',
    icon: 'bi-shield-check',
    color: '#10b981',
    bg: '#ecfdf5',
    calcCalo: (bmr, tdee) => tdee,
    macros: { protein: 20, carbs: 50, fat: 30 },
  },
  {
    value: 'gain_weight',
    label: 'Tăng cân & Phát triển cơ',
    sub: 'Dư thừa 350 kcal/ngày (Hỗ trợ tăng cơ nạc tối ưu)',
    icon: 'bi-arrow-up-circle',
    color: '#f59e0b',
    bg: '#fffbeb',
    calcCalo: (bmr, tdee) => tdee + 350,
    macros: { protein: 25, carbs: 50, fat: 25 },
  },
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
  heightCm: '', currentWeightKg: '', targetWeightKg: '', activityLevel: '', healthGoal: 'maintain_weight',
  dietaryPreferences: [], allergies: '', medicalConditions: '',
}

function getBmiCategory(bmi) {
  const b = Number(bmi)
  if (b < 18.5) return { label: 'Thiếu cân', color: '#3b82f6', pct: 20 }
  if (b < 23) return { label: 'Bình thường', color: '#10b981', pct: 45 }
  if (b < 25) return { label: 'Thừa cân', color: '#f59e0b', pct: 70 }
  return { label: 'Béo phì', color: '#ef4444', pct: 88 }
}

function getLocalDateValue() {
  const today = new Date()
  const offset = today.getTimezoneOffset() * 60_000
  return new Date(today.getTime() - offset).toISOString().slice(0, 10)
}

function formatLogDate(date) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${date}T00:00:00`))
}

function WeightChart({ weightLogs }) {
  if (!weightLogs.length) {
    return <p className="hp-weight-chart__empty">Chưa có bản ghi cân nặng. Hãy thêm bản ghi đầu tiên để theo dõi tiến triển.</p>
  }

  const weights = weightLogs.map((log) => Number(log.weightKg))
  const min = Math.min(...weights)
  const max = Math.max(...weights)
  const padding = Math.max((max - min) * 0.2, 1)
  const lower = min - padding
  const upper = max + padding
  const points = weightLogs.map((log, index) => {
    const x = weightLogs.length === 1 ? 300 : 24 + (552 * index) / (weightLogs.length - 1)
    const y = 154 - ((Number(log.weightKg) - lower) / (upper - lower)) * 118
    return { x, y, log }
  })

  return (
    <>
      <svg className="hp-weight-chart" viewBox="0 0 600 180" role="img" aria-label="Biểu đồ tiến triển cân nặng">
        <line x1="24" y1="154" x2="576" y2="154" className="hp-weight-chart__axis" />
        <line x1="24" y1="95" x2="576" y2="95" className="hp-weight-chart__grid" />
        <line x1="24" y1="36" x2="576" y2="36" className="hp-weight-chart__grid" />
        <polyline points={points.map(({ x, y }) => `${x},${y}`).join(' ')} className="hp-weight-chart__line" />
        {points.map(({ x, y, log }, index) => {
          const showLabel = weightLogs.length <= 6 || index === 0 || index === weightLogs.length - 1
          return (
            <g key={log.id}>
              <title>{`${formatLogDate(log.recordedDate)}: ${log.weightKg} kg`}</title>
              <circle cx={x} cy={y} r="5" className="hp-weight-chart__point" />
              {showLabel && <text x={x} y={y - 12} textAnchor="middle" className="hp-weight-chart__value">{log.weightKg} kg</text>}
              {showLabel && <text x={x} y="174" textAnchor="middle" className="hp-weight-chart__date">{formatLogDate(log.recordedDate)}</text>}
            </g>
          )
        })}
      </svg>
      <div className="hp-weight-chart__range"><span>{lower.toFixed(1)} kg</span><span>{upper.toFixed(1)} kg</span></div>
    </>
  )
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
  const [weightLogs, setWeightLogs] = useState([])
  const [weightDialogOpen, setWeightDialogOpen] = useState(false)
  const [weightForm, setWeightForm] = useState({ weightKg: '', recordedDate: getLocalDateValue() })
  const [weightError, setWeightError] = useState('')
  const [savingWeight, setSavingWeight] = useState(false)
  const [confirmOverwrite, setConfirmOverwrite] = useState(false)

  // State tùy chỉnh mục tiêu dinh dưỡng & macro (gộp từ chức năng tính toán)
  const [customized, setCustomized] = useState(false)
  const [customForm, setCustomForm] = useState({ calorieTarget: '', protein: '', carbs: '', fat: '' })

  useEffect(() => {
    let isActive = true
    async function loadProfile() {
      try {
        const [{ data }, { data: logsData }] = await Promise.all([
          axiosInstance.get('/profile'),
          axiosInstance.get('/profile/weight-logs'),
        ])
        if (isActive) {
          const profile = data.profile || {}
          const { heightCm, currentWeightKg, targetWeightKg, activityLevel, healthGoal, dietaryPreferences, allergies, medicalConditions, nutritionGoal } = profile
          const initialGoal = nutritionGoal?.goal || healthGoal || 'maintain_weight'

          setForm({
            fullName: data.user?.fullName || '',
            phone: data.user?.phone || '',
            dateOfBirth: data.user?.dateOfBirth ? data.user.dateOfBirth.slice(0, 10) : '',
            gender: data.user?.gender || '',
            avatarUrl: data.user?.avatarUrl || '',
            heightCm: String(heightCm ?? ''),
            currentWeightKg: String(currentWeightKg ?? ''),
            targetWeightKg: targetWeightKg == null ? '' : String(targetWeightKg),
            activityLevel: activityLevel || '',
            healthGoal: initialGoal,
            dietaryPreferences: dietaryPreferences || [],
            allergies: allergies || '',
            medicalConditions: medicalConditions || '',
          })

          if (nutritionGoal?.customized) {
            setCustomized(true)
            setCustomForm({
              calorieTarget: String(nutritionGoal.calorieTarget || ''),
              protein: String(nutritionGoal.macroPercentages?.protein || ''),
              carbs: String(nutritionGoal.macroPercentages?.carbs || ''),
              fat: String(nutritionGoal.macroPercentages?.fat || ''),
            })
          }

          setWeightLogs(logsData.weightLogs || [])
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

  const bmiInfo = useMemo(() => (bmi ? getBmiCategory(bmi) : null), [bmi])

  const bmr = useMemo(() => {
    const h = Number(form.heightCm)
    const w = Number(form.currentWeightKg)
    if (h > 0 && w > 0 && age > 0 && form.gender) {
      const base = 10 * w + 6.25 * h - 5 * age
      return form.gender === 'male' ? Math.round(base + 5) : Math.round(base - 161)
    }
    return null
  }, [form.heightCm, form.currentWeightKg, age, form.gender])

  const tdee = useMemo(() => {
    if (!bmr || !form.activityLevel) return null
    const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 }
    return Math.round(bmr * (multipliers[form.activityLevel] || 1.2))
  }, [bmr, form.activityLevel])

  // Cấu hình mục tiêu dinh dưỡng hiện tại
  const selectedGoalConfig = useMemo(() => {
    return NUTRITION_GOAL_OPTIONS.find((g) => g.value === form.healthGoal) || NUTRITION_GOAL_OPTIONS[1]
  }, [form.healthGoal])

  // Đề xuất calo & macro chuẩn khoa học
  const calculatedProposal = useMemo(() => {
    if (!bmr || !tdee) return null
    const cal = selectedGoalConfig.calcCalo(bmr, tdee)
    const mac = selectedGoalConfig.macros
    return {
      calorieTarget: cal,
      macroPercentages: mac,
      proteinG: Math.round((cal * mac.protein) / 400),
      carbsG: Math.round((cal * mac.carbs) / 400),
      fatG: Math.round((cal * mac.fat) / 900),
    }
  }, [bmr, tdee, selectedGoalConfig])

  const activeCalorieTarget = useMemo(() => {
    if (customized) {
      const val = Number(customForm.calorieTarget)
      return Number.isFinite(val) && val > 0 ? val : (calculatedProposal?.calorieTarget || (tdee || 2000))
    }
    return calculatedProposal?.calorieTarget || (tdee || 2000)
  }, [customized, customForm.calorieTarget, calculatedProposal, tdee])

  const activeMacros = useMemo(() => {
    if (customized) {
      return {
        protein: Number(customForm.protein) || 20,
        carbs: Number(customForm.carbs) || 50,
        fat: Number(customForm.fat) || 30,
      }
    }
    return calculatedProposal?.macroPercentages || selectedGoalConfig.macros
  }, [customized, customForm, calculatedProposal, selectedGoalConfig])

  const activeGrams = useMemo(() => {
    const cal = activeCalorieTarget
    return {
      protein: Math.round((cal * activeMacros.protein) / 400),
      carbs: Math.round((cal * activeMacros.carbs) / 400),
      fat: Math.round((cal * activeMacros.fat) / 900),
    }
  }, [activeCalorieTarget, activeMacros])

  const macroSum = Number(customForm.protein || 0) + Number(customForm.carbs || 0) + Number(customForm.fat || 0)

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

  function openWeightDialog() {
    setWeightForm({ weightKg: form.currentWeightKg, recordedDate: getLocalDateValue() })
    setWeightError('')
    setConfirmOverwrite(false)
    setWeightDialogOpen(true)
  }

  function closeWeightDialog() {
    if (savingWeight) return
    setWeightDialogOpen(false)
    setWeightError('')
    setConfirmOverwrite(false)
  }

  async function saveWeightLog(overwrite = false) {
    const weightKg = Number(weightForm.weightKg)
    if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 300) {
      setWeightError('Vui lòng nhập cân nặng hợp lệ (20–300 kg)')
      return
    }
    if (weightForm.recordedDate > getLocalDateValue()) {
      setWeightError('Không thể ghi nhận cân nặng cho ngày trong tương lai')
      return
    }

    setSavingWeight(true)
    setWeightError('')
    try {
      const { data } = await axiosInstance.post('/profile/weight-logs', { ...weightForm, overwrite })
      setWeightLogs((current) =>
        [...current.filter((log) => log.recordedDate !== data.weightLog.recordedDate), data.weightLog].sort(
          (a, b) => a.recordedDate.localeCompare(b.recordedDate)
        )
      )
      if (data.profile?.currentWeightKg != null) {
        setForm((current) => ({ ...current, currentWeightKg: String(data.profile.currentWeightKg) }))
      }
      setSuccess('Đã ghi nhận cân nặng thành công')
      setWeightDialogOpen(false)
      setConfirmOverwrite(false)
    } catch (err) {
      if (err.response?.data?.code === 'WEIGHT_LOG_EXISTS') {
        setConfirmOverwrite(true)
      } else {
        setWeightError(err.response?.data?.message || 'Ghi nhận cân nặng thất bại, vui lòng thử lại')
      }
    } finally {
      setSavingWeight(false)
    }
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

    if (
      !form.fullName.trim() ||
      !form.phone ||
      !form.dateOfBirth ||
      !form.gender ||
      !form.heightCm ||
      !form.currentWeightKg ||
      !form.activityLevel
    ) {
      setError('Vui lòng hoàn tất các thông tin bắt buộc được đánh dấu.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    if (customized) {
      const cal = Number(customForm.calorieTarget)
      if (bmr && cal < bmr) {
        setError(`Calo mục tiêu không được thấp hơn năng lượng chuyển hóa cơ bản BMR (${bmr} kcal) để đảm bảo sức khỏe.`)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      if (tdee && cal > tdee + 1000) {
        setError(`Calo mục tiêu không nên vượt quá TDEE + 1000 kcal (${tdee + 1000} kcal).`)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      if (Math.abs(macroSum - 100) > 0.5) {
        setError('Tổng tỉ lệ phần trăm của 3 nhóm dưỡng chất (Đạm + Tinh bột + Chất béo) phải bằng 100%.')
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
    }

    setSaving(true)
    try {
      const goal = form.healthGoal || 'maintain_weight'
      const payload = {
        ...form,
        healthGoal: goal,
        nutritionGoal: {
          goal,
          calorieTarget: activeCalorieTarget,
          macroPercentages: activeMacros,
          proteinG: activeGrams.protein,
          carbsG: activeGrams.carbs,
          fatG: activeGrams.fat,
          customized,
        },
      }
      const { data } = await axiosInstance.put('/profile', payload)
      dispatch(userUpdated(data.user))
      setSuccess('Lưu hồ sơ và mục tiêu dinh dưỡng thành công! Đang chuyển về Trang chủ...')
      setTimeout(() => navigate('/dashboard'), 1200)
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể lưu hồ sơ sức khỏe.')
    } finally {
      setSaving(false)
    }
  }

  const isInvalid = (field) => submitted && !form[field]

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
      <main className="hp-main">
        {/* Top bar */}
        <header className="hp-topbar">
          <Link to="/dashboard" className="hp-back" aria-label="Quay lại">
            <i className="bi bi-arrow-left" />
          </Link>
          <div className="hp-topbar__title">
            <span className="hp-topbar__eyebrow">NutriLens</span>
            <h1>Hồ sơ cá nhân & Sức khỏe</h1>
          </div>
          <button type="button" className="hp-skip" onClick={() => navigate('/dashboard')}>
            Để sau
          </button>
        </header>

        {/* Info banner */}
        <div className="hp-banner">
          <i className="bi bi-shield-check" />
          <p>Dữ liệu này giúp NutriLens tự động tính toán nhu cầu năng lượng và cá nhân hóa thực đơn phù hợp nhất cho bạn.</p>
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

          {/* ── Section 1: Thông tin cá nhân ── */}
          <section className="hp-card" aria-labelledby="sec-personal">
            <div className="hp-card__header">
              <div className="hp-card__badge">1</div>
              <div>
                <h2 id="sec-personal">Thông tin cá nhân</h2>
                <p>Thông tin định danh hiển thị trong tài khoản NutriLens của bạn.</p>
              </div>
            </div>

            <div className="hp-avatar-row">
              <div className="hp-avatar">
                {displayAvatar && !imgError ? (
                  <img src={displayAvatar} alt="Ảnh đại diện" onError={() => setImgError(true)} />
                ) : (
                  <i className="bi bi-person-fill" />
                )}
                <label className={`hp-avatar__edit ${uploadingAvatar ? 'is-busy' : ''}`} title="Đổi ảnh đại diện">
                  {uploadingAvatar ? <i className="bi bi-hourglass-split" /> : <i className="bi bi-camera-fill" />}
                  <input type="file" accept="image/jpeg,image/png" onChange={updateAvatar} disabled={uploadingAvatar} />
                </label>
              </div>
              <div className="hp-avatar-info">
                <strong>Ảnh đại diện</strong>
                <p>Hỗ trợ JPG hoặc PNG, dung lượng tối đa 3 MB.</p>
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
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  maxLength="100"
                  placeholder="Nguyễn Văn A"
                  value={form.fullName}
                  onChange={updateField}
                />
                {isInvalid('fullName') && <span className="hp-field__error">Vui lòng nhập họ và tên</span>}
              </div>

              <div className={`hp-field ${isInvalid('phone') ? 'is-invalid' : ''}`}>
                <label htmlFor="phone">Số điện thoại <span className="hp-required">*</span></label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength="10"
                  placeholder="0912 345 678"
                  value={form.phone}
                  onChange={updateField}
                />
                {isInvalid('phone') && <span className="hp-field__error">Vui lòng nhập số điện thoại hợp lệ (10 chữ số)</span>}
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
                <label htmlFor="dateOfBirth">
                  Ngày sinh <span className="hp-required">*</span>
                  {age > 0 && <span style={{ marginLeft: '8px', color: '#10b981', fontWeight: 600, fontSize: '0.85rem' }}>({age} tuổi)</span>}
                </label>
                <input
                  id="dateOfBirth"
                  name="dateOfBirth"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={updateField}
                />
                {isInvalid('dateOfBirth') && <span className="hp-field__error">Vui lòng chọn ngày sinh</span>}
              </div>
            </div>
          </section>

          {/* ── Section 2: Chỉ số cơ thể & Biểu đồ cân nặng ── */}
          <section className="hp-card" aria-labelledby="sec-body">
            <div className="hp-card__header">
              <div className="hp-card__badge">2</div>
              <div>
                <h2 id="sec-body">Chỉ số thể chất & Chuyển hóa</h2>
                <p>NutriLens ứng dụng công thức khoa học Mifflin-St Jeor để xác định mức trao đổi chất cơ bản (BMR) và tổng năng lượng tiêu hao (TDEE).</p>
              </div>
            </div>

            <div className="hp-grid hp-grid--3">
              <div className={`hp-field ${isInvalid('heightCm') ? 'is-invalid' : ''}`}>
                <label htmlFor="heightCm">Chiều cao <span className="hp-required">*</span></label>
                <div className="hp-unit-input">
                  <input
                    id="heightCm"
                    name="heightCm"
                    type="number"
                    min="100"
                    max="250"
                    step="0.1"
                    placeholder="165"
                    value={form.heightCm}
                    onChange={updateField}
                  />
                  <span>cm</span>
                </div>
                {isInvalid('heightCm') && <span className="hp-field__error">Bắt buộc (100–250 cm)</span>}
              </div>

              <div className={`hp-field ${isInvalid('currentWeightKg') ? 'is-invalid' : ''}`}>
                <label htmlFor="currentWeightKg">Cân nặng hiện tại <span className="hp-required">*</span></label>
                <div className="hp-unit-input">
                  <input
                    id="currentWeightKg"
                    name="currentWeightKg"
                    type="number"
                    min="20"
                    max="300"
                    step="0.1"
                    placeholder="55"
                    value={form.currentWeightKg}
                    onChange={updateField}
                  />
                  <span>kg</span>
                </div>
                {isInvalid('currentWeightKg') && <span className="hp-field__error">Bắt buộc (20–300 kg)</span>}
              </div>

              <div className="hp-field">
                <label htmlFor="targetWeightKg">Cân nặng mục tiêu</label>
                <div className="hp-unit-input">
                  <input
                    id="targetWeightKg"
                    name="targetWeightKg"
                    type="number"
                    min="20"
                    max="300"
                    step="0.1"
                    placeholder="52"
                    value={form.targetWeightKg}
                    onChange={updateField}
                  />
                  <span>kg</span>
                </div>
              </div>
            </div>

            {/* Thước đo BMI, BMR, TDEE */}
            {(bmi || bmr) && (
              <div className="hp-metrics">
                {bmi && bmiInfo && (
                  <div className="hp-bmi">
                    <div className="hp-bmi__left">
                      <span className="hp-bmi__label">Chỉ số khối cơ thể (BMI)</span>
                      <strong className="hp-bmi__value" style={{ color: bmiInfo.color }}>{bmi}</strong>
                      <span className="hp-bmi__cat" style={{ color: bmiInfo.color, backgroundColor: bmiInfo.bg ?? '#f0fdf4' }}>
                        {bmiInfo.label} (WHO Châu Á)
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
                        <strong>{bmr.toLocaleString('vi-VN')} <span>kcal/ngày</span></strong>
                        <p>BMR (Năng lượng chuyển hóa cơ bản)</p>
                      </div>
                    </div>
                    {tdee && (
                      <div className="hp-bmr-stat">
                        <i className="bi bi-lightning-charge" />
                        <div>
                          <strong>{tdee.toLocaleString('vi-VN')} <span>kcal/ngày</span></strong>
                          <p>TDEE (Tổng năng lượng tiêu hao cả ngày)</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Lịch sử và biểu đồ cân nặng */}
            <div className="hp-weight-history">
              <div className="hp-weight-history__header">
                <div>
                  <h3>Tiến triển cân nặng theo thời gian</h3>
                  <p>Theo dõi biểu đồ thay đổi cân nặng qua các lần ghi nhận thực tế.</p>
                </div>
                <button
                  type="button"
                  className="hp-weight-history__add"
                  onClick={openWeightDialog}
                  title="Ghi nhận cân nặng mới"
                  aria-label="Ghi nhận cân nặng"
                >
                  <i className="bi bi-plus-lg" />
                </button>
              </div>
              <WeightChart weightLogs={weightLogs} />
            </div>
          </section>

          {/* ── Section 3: Mức độ vận động ── */}
          <section className="hp-card" aria-labelledby="sec-activity">
            <div className="hp-card__header">
              <div className="hp-card__badge">3</div>
              <div>
                <h2 id="sec-activity">Mức độ vận động thể chất <span className="hp-required">*</span></h2>
                <p>Chọn mức phù hợp nhất với thói quen sinh hoạt và tập luyện của bạn trong tuần.</p>
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
                    <input
                      type="radio"
                      name="activityLevel"
                      value={opt.value}
                      checked={isActive}
                      onChange={updateField}
                    />
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
            {isInvalid('activityLevel') && (
              <div className="hp-section-error"><i className="bi bi-exclamation-triangle" /> Vui lòng chọn mức độ vận động</div>
            )}
          </section>

          {/* ── Section 4: Mục tiêu dinh dưỡng & Phân bổ năng lượng (Đã tích hợp toàn diện) ── */}
          <section className="hp-card" aria-labelledby="sec-goal">
            <div className="hp-card__header">
              <div className="hp-card__badge">4</div>
              <div>
                <h2 id="sec-goal">Mục tiêu dinh dưỡng & Phân bổ năng lượng</h2>
                <p>Hệ thống tự động đề xuất mục tiêu calo và tỉ lệ dưỡng chất đa lượng (Macro) chuẩn khoa học dựa trên chỉ số trao đổi chất của bạn.</p>
              </div>
            </div>

            {/* Các tùy chọn mục tiêu */}
            <div className="hp-goal-grid">
              {NUTRITION_GOAL_OPTIONS.map((opt) => {
                const isActive = (form.healthGoal || 'maintain_weight') === opt.value
                return (
                  <label
                    className={`hp-goal-card ${isActive ? 'is-active' : ''}`}
                    key={opt.value}
                    style={isActive ? { borderColor: opt.color, backgroundColor: opt.bg } : {}}
                  >
                    <input
                      type="radio"
                      name="healthGoal"
                      value={opt.value}
                      checked={isActive}
                      onChange={(e) => {
                        updateField(e)
                        if (customized) {
                          setCustomForm({
                            calorieTarget: String(opt.calcCalo(bmr || 1500, tdee || 2000)),
                            protein: String(opt.macros.protein),
                            carbs: String(opt.macros.carbs),
                            fat: String(opt.macros.fat),
                          })
                        }
                      }}
                    />
                    <div className="hp-goal-card__icon" style={{ color: opt.color, backgroundColor: opt.bg }}>
                      <i className={`bi ${opt.icon}`} />
                    </div>
                    <strong className="hp-goal-card__label">{opt.label}</strong>
                    <small className="hp-goal-card__sub">{opt.sub}</small>
                    {isActive && (
                      <i className="bi bi-check-circle-fill hp-goal-card__check" style={{ color: opt.color }} />
                    )}
                  </label>
                )
              })}
            </div>

            {/* Bảng tính toán trực quan Calo & Macro theo thời gian thực */}
            <div className="hp-macro-panel">
              <div className="hp-macro-panel__header">
                <div className="hp-macro-panel__title">
                  <span className="hp-macro-panel__tag">Đề xuất khoa học mỗi ngày</span>
                  <h3>{selectedGoalConfig.label}</h3>
                </div>
                <button
                  type="button"
                  className="hp-macro-panel__btn-toggle"
                  onClick={() => {
                    if (!customized) {
                      setCustomForm({
                        calorieTarget: String(activeCalorieTarget),
                        protein: String(activeMacros.protein),
                        carbs: String(activeMacros.carbs),
                        fat: String(activeMacros.fat),
                      })
                    }
                    setCustomized(!customized)
                  }}
                >
                  <i className={`bi ${customized ? 'bi-stars' : 'bi-sliders2'}`} />
                  {customized ? 'Dùng đề xuất khoa học' : 'Tùy chỉnh mục tiêu'}
                </button>
              </div>

              <div className="hp-macro-calories">
                <div>
                  <span>Mục tiêu năng lượng mỗi ngày</span>
                  <strong>
                    {Math.round(activeCalorieTarget).toLocaleString('vi-VN')} <small>kcal/ngày</small>
                  </strong>
                </div>
                {bmr && tdee && (
                  <div className="hp-macro-calories__sub">
                    <span><i className="bi bi-fire" /> BMR: <b>{bmr.toLocaleString('vi-VN')} kcal</b></span>
                    <span><i className="bi bi-lightning-charge" /> TDEE: <b>{tdee.toLocaleString('vi-VN')} kcal</b></span>
                  </div>
                )}
              </div>

              {customized && (
                <div className="hp-custom-row mb-3">
                  <div className="hp-field">
                    <label>
                      Calo mục tiêu (kcal/ngày)
                      {bmr && tdee && (
                        <small className="text-muted ms-2">(Khoảng an toàn: {bmr.toLocaleString('vi-VN')} – {(tdee + 1000).toLocaleString('vi-VN')} kcal)</small>
                      )}
                    </label>
                    <div className="hp-unit-input">
                      <input
                        type="number"
                        min={bmr || 1000}
                        max={(tdee || 2000) + 1000}
                        value={customForm.calorieTarget}
                        onChange={(e) => setCustomForm((c) => ({ ...c, calorieTarget: e.target.value }))}
                      />
                      <span>kcal</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 3 Cột Macro: Protein, Carbs, Fat */}
              <div className="hp-macro-grid">
                <div className="hp-macro-card hp-macro-card--protein">
                  <div className="hp-macro-card__top">
                    <span>Đạm (Protein)</span>
                    <small>4 kcal/g</small>
                  </div>
                  {customized ? (
                    <div className="hp-macro-input-wrap">
                      <input
                        type="number"
                        min="5"
                        max="70"
                        value={customForm.protein}
                        onChange={(e) => setCustomForm((c) => ({ ...c, protein: e.target.value }))}
                      />
                      <span>%</span>
                    </div>
                  ) : (
                    <strong className="hp-macro-pct">{activeMacros.protein}%</strong>
                  )}
                  <b className="hp-macro-grams">{activeGrams.protein} g</b>
                </div>

                <div className="hp-macro-card hp-macro-card--carbs">
                  <div className="hp-macro-card__top">
                    <span>Tinh bột (Carbs)</span>
                    <small>4 kcal/g</small>
                  </div>
                  {customized ? (
                    <div className="hp-macro-input-wrap">
                      <input
                        type="number"
                        min="5"
                        max="80"
                        value={customForm.carbs}
                        onChange={(e) => setCustomForm((c) => ({ ...c, carbs: e.target.value }))}
                      />
                      <span>%</span>
                    </div>
                  ) : (
                    <strong className="hp-macro-pct">{activeMacros.carbs}%</strong>
                  )}
                  <b className="hp-macro-grams">{activeGrams.carbs} g</b>
                </div>

                <div className="hp-macro-card hp-macro-card--fat">
                  <div className="hp-macro-card__top">
                    <span>Chất béo (Lipid)</span>
                    <small>9 kcal/g</small>
                  </div>
                  {customized ? (
                    <div className="hp-macro-input-wrap">
                      <input
                        type="number"
                        min="5"
                        max="60"
                        value={customForm.fat}
                        onChange={(e) => setCustomForm((c) => ({ ...c, fat: e.target.value }))}
                      />
                      <span>%</span>
                    </div>
                  ) : (
                    <strong className="hp-macro-pct">{activeMacros.fat}%</strong>
                  )}
                  <b className="hp-macro-grams">{activeGrams.fat} g</b>
                </div>
              </div>

              {customized && (
                <div className={`hp-macro-sum ${Math.abs(macroSum - 100) < 0.01 ? 'is-valid' : 'is-invalid'}`}>
                  <i className={`bi ${Math.abs(macroSum - 100) < 0.01 ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'}`} />
                  <span>Tổng tỉ lệ: <b>{macroSum}%</b> {Math.abs(macroSum - 100) < 0.01 ? '(Đạt chuẩn 100%)' : '(Cần điều chỉnh sao cho tổng đúng bằng 100%)'}</span>
                </div>
              )}
            </div>
          </section>

          {/* ── Section 5: Lưu ý dinh dưỡng ── */}
          <section className="hp-card" aria-labelledby="sec-nutrition">
            <div className="hp-card__header">
              <div className="hp-card__badge">5</div>
              <div>
                <h2 id="sec-nutrition">Lưu ý dinh dưỡng & Sức khỏe</h2>
                <p>Không bắt buộc — giúp NutriLens gợi ý thực đơn phù hợp và an toàn hơn cho bạn.</p>
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
                <textarea
                  id="allergies"
                  name="allergies"
                  rows="3"
                  placeholder="Ví dụ: đậu phộng, hải sản, sữa bò..."
                  value={form.allergies}
                  onChange={updateField}
                />
              </div>
              <div className="hp-field">
                <label htmlFor="medicalConditions">
                  <i className="bi bi-heart-pulse me-1" style={{ color: '#ef4444' }} />
                  Tình trạng sức khỏe cần lưu ý
                </label>
                <textarea
                  id="medicalConditions"
                  name="medicalConditions"
                  rows="3"
                  placeholder="Ví dụ: tiểu đường, huyết áp cao, gút..."
                  value={form.medicalConditions}
                  onChange={updateField}
                />
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
              {saving ? (
                <>
                  <div className="hp-spinner" />
                  <span>Đang lưu…</span>
                </>
              ) : (
                <>
                  <i className="bi bi-check2" />
                  <span>Lưu hồ sơ & Mục tiêu</span>
                </>
              )}
            </button>
          </div>
        </form>
      </main>

      {/* Modal ghi nhận cân nặng */}
      {weightDialogOpen && (
        <div className="hp-modal-backdrop" role="presentation" onMouseDown={closeWeightDialog}>
          <section
            className="hp-weight-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="weight-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="hp-weight-modal__header">
              <div>
                <span>Theo dõi tiến trình</span>
                <h2 id="weight-dialog-title">Ghi nhận cân nặng</h2>
              </div>
              <button
                type="button"
                className="hp-weight-modal__close"
                onClick={closeWeightDialog}
                title="Đóng"
                aria-label="Đóng"
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                saveWeightLog(false)
              }}
              noValidate
            >
              <div className={`hp-field ${weightError.includes('cân nặng') ? 'is-invalid' : ''}`}>
                <label htmlFor="weightLogKg">Cân nặng</label>
                <div className="hp-unit-input">
                  <input
                    id="weightLogKg"
                    type="number"
                    min="20"
                    max="300"
                    step="0.1"
                    inputMode="decimal"
                    autoFocus
                    value={weightForm.weightKg}
                    onChange={(event) => {
                      setWeightForm((current) => ({ ...current, weightKg: event.target.value }))
                      setWeightError('')
                      setConfirmOverwrite(false)
                    }}
                  />
                  <span>kg</span>
                </div>
                {weightError.includes('cân nặng') && <span className="hp-field__error">{weightError}</span>}
              </div>

              <div className={`hp-field ${weightError.includes('ngày') ? 'is-invalid' : ''}`}>
                <label htmlFor="weightLogDate">Ngày ghi nhận</label>
                <input
                  id="weightLogDate"
                  type="date"
                  max={getLocalDateValue()}
                  value={weightForm.recordedDate}
                  onChange={(event) => {
                    setWeightForm((current) => ({ ...current, recordedDate: event.target.value }))
                    setWeightError('')
                    setConfirmOverwrite(false)
                  }}
                />
                {weightError.includes('ngày') && <span className="hp-field__error">{weightError}</span>}
              </div>

              {confirmOverwrite && (
                <div className="hp-weight-modal__confirm" role="alert">
                  <i className="bi bi-exclamation-circle" />
                  <p>Bạn đã ghi nhận cân nặng hôm nay, bạn có muốn cập nhật lại giá trị này?</p>
                  <div>
                    <button
                      type="button"
                      className="hp-weight-modal__cancel"
                      onClick={() => setConfirmOverwrite(false)}
                      disabled={savingWeight}
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      className="hp-weight-modal__save"
                      onClick={() => saveWeightLog(true)}
                      disabled={savingWeight}
                    >
                      Cập nhật
                    </button>
                  </div>
                </div>
              )}

              {!confirmOverwrite && (
                <div className="hp-weight-modal__actions">
                  <button
                    type="button"
                    className="hp-weight-modal__cancel"
                    onClick={closeWeightDialog}
                    disabled={savingWeight}
                  >
                    Hủy
                  </button>
                  <button type="submit" className="hp-weight-modal__save" disabled={savingWeight}>
                    {savingWeight ? 'Đang lưu...' : 'Lưu'}
                  </button>
                </div>
              )}
            </form>
          </section>
        </div>
      )}
    </div>
  )
}
