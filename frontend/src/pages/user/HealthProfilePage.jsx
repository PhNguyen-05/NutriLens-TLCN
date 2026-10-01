import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import axiosInstance from '../../api/axiosInstance'
import { userUpdated } from '../../store/slices/authSlice'

const BASE_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'

/** Regex số điện thoại Việt Nam: bắt đầu 0, đủ 10 chữ số */
const PHONE_RE = /^0\d{9}$/

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
    sub: 'Thâm hụt calo/ngày (tối đa 500 kcal, giới hạn ở BMR)',
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
    label: 'Tăng cân',
    sub: 'Dư thừa 350 kcal/ngày (Hỗ trợ tăng cân lành mạnh)',
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

// ---------------------------------------------------------------------------
// Pure helper functions
// ---------------------------------------------------------------------------

/**
 * Phân loại BMI theo chuẩn WHO Châu Á.
 * Vị trí kim (pct) được tính liên tục từ BMI 14→35 → 0→100%
 * để kim phản ánh đúng giá trị thực, không bị nhảy cóc theo nhóm.
 */
function getBmiCategory(bmi) {
  const b = Number(bmi)
  const pct = Math.max(0, Math.min(100, ((b - 14) / 21) * 100))
  if (b < 18.5) return { label: 'Thiếu cân', color: '#3b82f6', bg: '#eff6ff', pct }
  if (b < 23) return { label: 'Bình thường', color: '#10b981', bg: '#ecfdf5', pct }
  if (b < 25) return { label: 'Thừa cân', color: '#f59e0b', bg: '#fffbeb', pct }
  return { label: 'Béo phì', color: '#ef4444', bg: '#fef2f2', pct }
}

/**
 * Gợi ý mục tiêu từ hệ thống dựa trên BMI.
 * KHÔNG phải lời khuyên y tế, chỉ mang tính tham khảo.
 */
function getSystemAdvice(bmiInfo) {
  if (!bmiInfo) return null
  switch (bmiInfo.label) {
    case 'Thiếu cân':
      return {
        recommended: 'gain_weight',
        advice: 'Chỉ số BMI cho thấy bạn đang thiếu cân. Hệ thống gợi ý mục tiêu tăng cân để đạt mức lành mạnh hơn, hỗ trợ miễn dịch và trao đổi chất.',
        icon: 'bi-arrow-up-circle-fill',
        color: '#f59e0b',
      }
    case 'Bình thường':
      return {
        recommended: 'maintain_weight',
        advice: 'Tuyệt vời! Chỉ số BMI của bạn đang ở mức lý tưởng. Hệ thống gợi ý duy trì cân nặng kết hợp chế độ ăn cân bằng.',
        icon: 'bi-shield-check-fill',
        color: '#10b981',
      }
    case 'Thừa cân':
      return {
        recommended: 'lose_weight',
        advice: 'Chỉ số BMI cho thấy bạn đang thừa cân nhẹ. Hệ thống gợi ý giảm cân dần dần (khoảng 0,25–0,5 kg/tuần) kết hợp tăng cường vận động.',
        icon: 'bi-arrow-down-circle-fill',
        color: '#3b82f6',
      }
    case 'Béo phì':
      return {
        recommended: 'lose_weight',
        advice: 'Chỉ số BMI của bạn ở mức béo phì. Hệ thống gợi ý giảm cân có kiểm soát. Nên trao đổi với bác sĩ để có kế hoạch phù hợp.',
        icon: 'bi-exclamation-triangle-fill',
        color: '#ef4444',
      }
    default:
      return null
  }
}

/**
 * Đánh giá mức độ rủi ro khi mục tiêu được chọn mâu thuẫn với BMI.
 * @returns {{ level: 'danger'|'warning'|'info', msg: string } | null}
 */
function getGoalRisk(goal, bmiLabel) {
  if (!bmiLabel || !goal) return null
  if (bmiLabel === 'Thiếu cân' && goal === 'lose_weight')
    return {
      level: 'danger',
      msg: 'BMI của bạn đang ở mức thiếu cân. Tiếp tục giảm cân có thể gây suy dinh dưỡng và ảnh hưởng nghiêm trọng đến sức khỏe. Hệ thống khuyến nghị bạn chọn mục tiêu tăng cân thay thế.',
    }
  if (bmiLabel === 'Béo phì' && goal === 'gain_weight')
    return {
      level: 'danger',
      msg: 'BMI của bạn đang ở mức béo phì. Tiếp tục tăng cân có thể làm tăng đáng kể nguy cơ mắc bệnh tim mạch, tiểu đường và các bệnh mạn tính khác.',
    }
  if (bmiLabel === 'Thừa cân' && goal === 'gain_weight')
    return {
      level: 'warning',
      msg: 'BMI của bạn đang ở mức thừa cân. Tăng thêm cân có thể đẩy BMI lên mức béo phì. Hãy chắc chắn bạn có lý do phù hợp trước khi tiếp tục.',
    }
  if (bmiLabel === 'Bình thường' && goal !== 'maintain_weight')
    return {
      level: 'info',
      msg: 'BMI của bạn đang ở mức bình thường. Hệ thống gợi ý duy trì cân nặng. Bạn vẫn có thể tiếp tục nếu có mục tiêu cụ thể và phù hợp.',
    }
  return null
}

function getLocalDateValue() {
  const today = new Date()
  const offset = today.getTimezoneOffset() * 60_000
  return new Date(today.getTime() - offset).toISOString().slice(0, 10)
}

function formatLogDate(date) {
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(`${date}T00:00:00`)
  )
}

// ---------------------------------------------------------------------------
// WeightChart component
// ---------------------------------------------------------------------------
function WeightChart({ weightLogs }) {
  if (!weightLogs.length) {
    return (
      <p className="hp-weight-chart__empty">
        Chưa có bản ghi cân nặng. Hãy thêm bản ghi đầu tiên để theo dõi tiến triển.
      </p>
    )
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
          // Support both id and _id (MongoDB)
          const key = log._id || log.id || index
          return (
            <g key={key}>
              <title>{`${formatLogDate(log.recordedDate)}: ${log.weightKg} kg`}</title>
              <circle cx={x} cy={y} r="5" className="hp-weight-chart__point" />
              {showLabel && (
                <text x={x} y={y - 12} textAnchor="middle" className="hp-weight-chart__value">
                  {log.weightKg} kg
                </text>
              )}
              {showLabel && (
                <text x={x} y="174" textAnchor="middle" className="hp-weight-chart__date">
                  {formatLogDate(log.recordedDate)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <div className="hp-weight-chart__range">
        <span>{lower.toFixed(1)} kg</span>
        <span>{upper.toFixed(1)} kg</span>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function HealthProfilePage() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const formRef = useRef(null)
  /**
   * Lưu BMI category lần trước để auto-select goal chỉ chạy khi category THỰC SỰ thay đổi,
   * không override goal đã lưu khi tải trang lần đầu.
   */
  const prevBmiLabelRef = useRef(null)

  const [form, setForm] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Weight log state
  const [weightLogs, setWeightLogs] = useState([])
  const [weightDialogOpen, setWeightDialogOpen] = useState(false)
  const [weightForm, setWeightForm] = useState({ weightKg: '', recordedDate: getLocalDateValue() })
  // weightError as { field: 'weight'|'date'|'', message: '' } to avoid keyword-matching hacks
  const [weightError, setWeightError] = useState({ field: '', message: '' })
  const [savingWeight, setSavingWeight] = useState(false)
  const [confirmOverwrite, setConfirmOverwrite] = useState(false)

  // Goal conflict warning
  // { pendingGoal, risk: { level, msg }, fromSubmit: bool }
  const [goalWarning, setGoalWarning] = useState(null)
  // Track which (goal, bmiLabel) pair the user has explicitly acknowledged,
  // so we don't re-ask on every submit attempt.
  const [acknowledgedRisk, setAcknowledgedRisk] = useState(null)

  // Custom calorie/macro mode
  const [customized, setCustomized] = useState(false)
  const [customForm, setCustomForm] = useState({ calorieTarget: '', protein: '', carbs: '', fat: '' })

  // ---------------------------------------------------------------------------
  // Load profile
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isActive = true
    async function loadProfile() {
      try {
        const [{ data }, { data: logsData }] = await Promise.all([
          axiosInstance.get('/profile'),
          axiosInstance.get('/profile/weight-logs'),
        ])
        if (!isActive) return

        const profile = data.profile || {}
        const {
          heightCm, currentWeightKg, targetWeightKg,
          activityLevel, healthGoal, dietaryPreferences,
          allergies, medicalConditions, nutritionGoal,
        } = profile
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

        // Sort logs ascending by date
        const sortedLogs = (logsData.weightLogs || []).slice().sort(
          (a, b) => a.recordedDate.localeCompare(b.recordedDate)
        )
        setWeightLogs(sortedLogs)

        // Seed prevBmiLabelRef với BMI category từ dữ liệu đã lưu.
        // Mục đích: auto-select chỉ chạy khi user THỰC SỰ thay đổi chiều cao/cân nặng,
        // không override healthGoal đã lưu trên server khi tải trang lần đầu.
        const h = Number(heightCm)
        const w = Number(currentWeightKg)
        if (h >= 100 && h <= 250 && w >= 20 && w <= 300) {
          const bmiVal = w / (h / 100) ** 2
          prevBmiLabelRef.current = getBmiCategory(bmiVal.toFixed(1))?.label ?? null
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


  // ---------------------------------------------------------------------------
  // Computed values — only when inputs are in valid range
  // ---------------------------------------------------------------------------
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
    const h = Number(form.heightCm)
    const w = Number(form.currentWeightKg)
    // Only calculate when both values are within valid input range
    if (h >= 100 && h <= 250 && w >= 20 && w <= 300) {
      return (w / (h / 100) ** 2).toFixed(1)
    }
    return null
  }, [form.heightCm, form.currentWeightKg])

  const bmiInfo = useMemo(() => (bmi ? getBmiCategory(bmi) : null), [bmi])

  // System advice: derived from BMI
  const systemAdvice = useMemo(() => getSystemAdvice(bmiInfo), [bmiInfo])

  const bmr = useMemo(() => {
    const h = Number(form.heightCm)
    const w = Number(form.currentWeightKg)
    // Only calculate when all inputs are valid
    if (h >= 100 && h <= 250 && w >= 20 && w <= 300 && age >= 10 && age <= 120 && form.gender) {
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

  const selectedGoalConfig = useMemo(
    () => NUTRITION_GOAL_OPTIONS.find((g) => g.value === form.healthGoal) || NUTRITION_GOAL_OPTIONS[1],
    [form.healthGoal]
  )

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

  // Actual deficit for lose_weight when capped at BMR
  const actualDeficit = useMemo(() => {
    if (form.healthGoal !== 'lose_weight' || !bmr || !tdee) return null
    const capped = tdee - 500 < bmr
    return capped ? { kcal: tdee - bmr, capped: true } : { kcal: 500, capped: false }
  }, [form.healthGoal, bmr, tdee])

  // No silent 2000 fallback — return null when unavailable
  const activeCalorieTarget = useMemo(() => {
    if (customized) {
      const val = Number(customForm.calorieTarget)
      return Number.isFinite(val) && val > 0 ? val : null
    }
    return calculatedProposal?.calorieTarget ?? null
  }, [customized, customForm.calorieTarget, calculatedProposal])

  const activeMacros = useMemo(() => {
    if (customized) {
      // No silent fallback: show 0 when field is empty so user notices
      return {
        protein: Number(customForm.protein) || 0,
        carbs: Number(customForm.carbs) || 0,
        fat: Number(customForm.fat) || 0,
      }
    }
    return calculatedProposal?.macroPercentages || selectedGoalConfig.macros
  }, [customized, customForm, calculatedProposal, selectedGoalConfig])

  const activeGrams = useMemo(() => {
    const cal = activeCalorieTarget
    if (!cal) return { protein: null, carbs: null, fat: null }
    return {
      protein: Math.round((cal * activeMacros.protein) / 400),
      carbs: Math.round((cal * activeMacros.carbs) / 400),
      fat: Math.round((cal * activeMacros.fat) / 900),
    }
  }, [activeCalorieTarget, activeMacros])

  // Consistent 1% tolerance for both UI indicator and submit validation
  const macroSum = (Number(customForm.protein) || 0) + (Number(customForm.carbs) || 0) + (Number(customForm.fat) || 0)
  const macroSumOk = Math.abs(macroSum - 100) <= 1

  // Real-time warnings for custom mode (inline, not just on submit)
  const customWarnings = useMemo(() => {
    if (!customized) return []
    const warnings = []
    const cal = Number(customForm.calorieTarget)
    const fat = Number(customForm.fat)
    const protein = Number(customForm.protein)
    if (cal > 0 && bmr && cal < bmr)
      warnings.push({ level: 'danger', msg: `Calo mục tiêu (${cal} kcal) thấp hơn BMR (${bmr} kcal). Điều này có thể gây hại cho sức khỏe.` })
    if (fat > 0 && fat < 20)
      warnings.push({ level: 'warning', msg: 'Chất béo dưới 20% có thể ảnh hưởng đến hấp thu vitamin tan trong dầu (A, D, E, K).' })
    if (protein > 0 && protein > 35)
      warnings.push({ level: 'warning', msg: 'Protein trên 35% có thể gây áp lực cho thận trong dài hạn.' })
    return warnings
  }, [customized, customForm, bmr])

  // Target weight constraints based on healthGoal + BMI safety
  const targetWeightConstraint = useMemo(() => {
    const current = Number(form.currentWeightKg)
    const h = Number(form.heightCm)
    if (!current || current < 20) return { min: 20, max: 300, disabled: false }

    switch (form.healthGoal) {
      case 'lose_weight': {
        // Minimum safe weight = BMI 18.5
        const minBmiSafe = h >= 100 ? Math.ceil(18.5 * (h / 100) ** 2 * 10) / 10 : 20
        const minSafe = Math.max(20, minBmiSafe)
        return {
          min: minSafe,
          max: Number((current - 0.1).toFixed(1)),
          disabled: false,
          hint: `Phải nhỏ hơn ${current} kg (tối thiểu ${minSafe} kg để duy trì BMI ≥ 18,5)`,
        }
      }
      case 'gain_weight': {
        // Show safe upper hint = BMI 25
        const maxBmiSafe = h >= 100 ? Math.floor(25 * (h / 100) ** 2 * 10) / 10 : null
        return {
          min: Number((current + 0.1).toFixed(1)),
          max: 300,
          disabled: false,
          hint: `Phải lớn hơn ${current} kg`,
          safeguardMax: maxBmiSafe,
        }
      }
      case 'maintain_weight':
        return { min: current, max: current, disabled: true }
      default:
        return { min: 20, max: 300, disabled: false }
    }
  }, [form.healthGoal, form.currentWeightKg, form.heightCm])

  // Warn if gain_weight target pushes BMI >= 25
  const targetWeightBmiWarning = useMemo(() => {
    if (form.healthGoal !== 'gain_weight') return null
    const h = Number(form.heightCm)
    const targetW = Number(form.targetWeightKg)
    if (!h || !targetW || h < 100) return null
    const targetBmi = targetW / (h / 100) ** 2
    if (targetBmi >= 25) {
      return `Cân nặng mục tiêu này tương ứng BMI ${targetBmi.toFixed(1)} — mức thừa cân. Cân nhắc đặt mục tiêu thấp hơn.`
    }
    return null
  }, [form.healthGoal, form.heightCm, form.targetWeightKg])

  /**
   * Auto-select mục tiêu dinh dưỡng theo gợi ý hệ thống khi BMI category thay đổi.
   *
   * Quy tắc:
   * - Chỉ trigger khi bmiInfo.label THỰC SỰ đổi nhóm (Thiếu cân / Bình thường / Thừa cân / Béo phì)
   * - KHÔNG override nếu user đã chủ động xác nhận giữ mục tiêu khác cho nhóm BMI này
   * - Khi override: reset acknowledgedRisk cũ (hết hiệu lực với nhóm BMI mới)
   */
  useEffect(() => {
    const newLabel = bmiInfo?.label
    const recommended = systemAdvice?.recommended
    if (!newLabel || !recommended) return
    // Không làm gì nếu category không thay đổi
    if (newLabel === prevBmiLabelRef.current) return
    prevBmiLabelRef.current = newLabel

    // Nếu user đã xác nhận giữ mục tiêu khác cho ĐÚNG nhóm BMI này → tôn trọng lựa chọn
    const userExplicitlyChoseOther =
      acknowledgedRisk?.bmiLabel === newLabel && acknowledgedRisk?.goal !== recommended
    if (userExplicitlyChoseOther) return

    // Auto-apply recommended goal
    setAcknowledgedRisk(null)
    setForm((current) => ({
      ...current,
      healthGoal: recommended,
      targetWeightKg:
        recommended === 'maintain_weight' ? current.currentWeightKg : current.targetWeightKg,
    }))
    // Sync customForm theo goal mới nếu đang ở chế độ tùy chỉnh
    if (customized) {
      const opt = NUTRITION_GOAL_OPTIONS.find((g) => g.value === recommended)
      if (opt && bmr && tdee) {
        setCustomForm({
          calorieTarget: String(opt.calcCalo(bmr, tdee)),
          protein: String(opt.macros.protein),
          carbs: String(opt.macros.carbs),
          fat: String(opt.macros.fat),
        })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bmiInfo?.label])

  // ---------------------------------------------------------------------------
  // Event handlers

  // ---------------------------------------------------------------------------
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

  function applyGoal(newGoal) {
    const opt = NUTRITION_GOAL_OPTIONS.find((g) => g.value === newGoal)
    setForm((current) => {
      const newTarget = newGoal === 'maintain_weight' ? current.currentWeightKg : current.targetWeightKg
      return { ...current, healthGoal: newGoal, targetWeightKg: newTarget }
    })
    // Only update custom form if we have real BMR/TDEE values; otherwise keep existing
    if (customized && opt && bmr && tdee) {
      setCustomForm({
        calorieTarget: String(opt.calcCalo(bmr, tdee)),
        protein: String(opt.macros.protein),
        carbs: String(opt.macros.carbs),
        fat: String(opt.macros.fat),
      })
    }
    setGoalWarning(null)
    setError('')
    setSuccess('')
  }

  /**
   * Called when user clicks a nutrition goal card.
   * Opens risk warning dialog if the goal conflicts with system advice.
   * Also marks prevBmiLabelRef so auto-select won't override the user's manual choice.
   */
  function handleGoalChange(newGoal) {
    const risk = bmiInfo ? getGoalRisk(newGoal, bmiInfo.label) : null
    // Record current BMI label — auto-select won't fire again for same category after manual pick
    prevBmiLabelRef.current = bmiInfo?.label ?? prevBmiLabelRef.current
    if (risk) {
      setGoalWarning({ pendingGoal: newGoal, risk, fromSubmit: false })
    } else {
      if (newGoal === systemAdvice?.recommended) setAcknowledgedRisk(null)
      applyGoal(newGoal)
    }
  }


  /** Called when user clicks "Continue anyway" in the goal warning dialog. */
  function confirmGoalWarning() {
    const { pendingGoal, risk, fromSubmit } = goalWarning
    // Record acknowledgment so submit doesn't re-ask for same (goal, BMI) combo
    setAcknowledgedRisk({ goal: pendingGoal, bmiLabel: bmiInfo?.label })

    if (!fromSubmit) {
      applyGoal(pendingGoal)
    } else {
      // Triggered during submit — re-trigger form submission after acknowledgment
      setGoalWarning(null)
      setTimeout(() => formRef.current?.requestSubmit(), 0)
    }
  }

  function openWeightDialog() {
    setWeightForm({ weightKg: form.currentWeightKg, recordedDate: getLocalDateValue() })
    setWeightError({ field: '', message: '' })
    setConfirmOverwrite(false)
    setWeightDialogOpen(true)
  }

  function closeWeightDialog() {
    if (savingWeight) return
    setWeightDialogOpen(false)
    setWeightError({ field: '', message: '' })
    setConfirmOverwrite(false)
  }

  async function saveWeightLog(overwrite = false) {
    const weightKg = Number(weightForm.weightKg)

    if (!weightForm.weightKg || !Number.isFinite(weightKg) || weightKg < 20 || weightKg > 300) {
      setWeightError({ field: 'weight', message: 'Vui lòng nhập cân nặng hợp lệ (20–300 kg)' })
      return
    }
    if (!weightForm.recordedDate) {
      setWeightError({ field: 'date', message: 'Vui lòng chọn ngày ghi nhận' })
      return
    }
    if (weightForm.recordedDate > getLocalDateValue()) {
      setWeightError({ field: 'date', message: 'Không thể ghi nhận cân nặng cho ngày trong tương lai' })
      return
    }

    setSavingWeight(true)
    setWeightError({ field: '', message: '' })
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
        setWeightError({ field: 'weight', message: err.response?.data?.message || 'Ghi nhận cân nặng thất bại, vui lòng thử lại' })
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

  // ---------------------------------------------------------------------------
  // Form submission — full validation pipeline
  // ---------------------------------------------------------------------------
  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitted(true)
    setError('')
    setSuccess('')

    // ── Step 1: Required fields ──
    if (
      !form.fullName.trim() || !form.phone || !form.dateOfBirth ||
      !form.gender || !form.heightCm || !form.currentWeightKg || !form.activityLevel
    ) {
      setError('Vui lòng hoàn tất các thông tin bắt buộc được đánh dấu.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    // ── Step 2: Format & range validation (not covered by noValidate HTML) ──
    if (!PHONE_RE.test(form.phone)) {
      setError('Số điện thoại phải gồm 10 chữ số và bắt đầu bằng số 0.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const h = Number(form.heightCm)
    const w = Number(form.currentWeightKg)

    if (h < 100 || h > 250) {
      setError('Chiều cao phải từ 100–250 cm.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (w < 20 || w > 300) {
      setError('Cân nặng hiện tại phải từ 20–300 kg.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (age < 10 || age > 120) {
      setError('Ngày sinh không hợp lệ. Tuổi phải từ 10–120.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    // ── Step 3: Target weight validation based on healthGoal ──
    const currentW = w
    // For maintain, we'll force targetWeightKg = currentWeightKg at payload time
    if (form.healthGoal === 'lose_weight' && form.targetWeightKg) {
      const targetW = Number(form.targetWeightKg)
      const minSafe = Math.ceil(18.5 * (h / 100) ** 2 * 10) / 10
      if (targetW >= currentW) {
        setError('Cân nặng mục tiêu phải nhỏ hơn cân nặng hiện tại khi chọn mục tiêu giảm cân.')
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      if (targetW < minSafe) {
        setError(`Cân nặng mục tiêu không nên thấp hơn ${minSafe} kg (tương ứng BMI 18,5 — giới hạn an toàn).`)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
    }
    if (form.healthGoal === 'gain_weight' && form.targetWeightKg) {
      const targetW = Number(form.targetWeightKg)
      if (targetW <= currentW) {
        setError('Cân nặng mục tiêu phải lớn hơn cân nặng hiện tại khi chọn mục tiêu tăng cân.')
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
    }

    // ── Step 4: Goal risk check — run even if user didn't touch the goal selector ──
    const risk = bmiInfo ? getGoalRisk(form.healthGoal, bmiInfo.label) : null
    const alreadyAcknowledged =
      acknowledgedRisk?.goal === form.healthGoal && acknowledgedRisk?.bmiLabel === bmiInfo?.label
    if (risk && !alreadyAcknowledged) {
      setGoalWarning({ pendingGoal: form.healthGoal, risk, fromSubmit: true })
      return
    }

    // ── Step 5: Custom macro/calorie validation ──
    if (customized) {
      const cal = Number(customForm.calorieTarget)
      const prot = Number(customForm.protein)
      const carbs = Number(customForm.carbs)
      const fat = Number(customForm.fat)

      if (!customForm.calorieTarget || !cal || cal <= 0) {
        setError('Vui lòng nhập mục tiêu calo hợp lệ.')
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      if (bmr && cal < bmr) {
        setError(`Calo mục tiêu (${cal} kcal) không được thấp hơn BMR (${bmr} kcal) để đảm bảo sức khỏe.`)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      if (tdee && cal > tdee + 1000) {
        setError(`Calo mục tiêu không nên vượt quá TDEE + 1000 kcal (${(tdee + 1000).toLocaleString('vi-VN')} kcal).`)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      if (!customForm.protein || prot < 5 || prot > 70) {
        setError('Tỷ lệ Protein phải từ 5–70%.')
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      if (!customForm.carbs || carbs < 5 || carbs > 80) {
        setError('Tỷ lệ Tinh bột (Carbs) phải từ 5–80%.')
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      if (!customForm.fat || fat < 5 || fat > 60) {
        setError('Tỷ lệ Chất béo phải từ 5–60%.')
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      if (Math.abs(prot + carbs + fat - 100) > 1) {
        setError('Tổng tỷ lệ Protein + Tinh bột + Chất béo phải bằng 100% (sai số cho phép ±1%).')
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
    } else if (!calculatedProposal) {
      // Non-customized but no BMR/TDEE → block save to avoid storing 2000 kcal as phantom value
      setError('Vui lòng hoàn tất giới tính, ngày sinh, chiều cao, cân nặng và mức độ vận động để hệ thống tính toán chỉ số dinh dưỡng.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    // ── Step 6: Save ──
    setSaving(true)
    try {
      const goal = form.healthGoal || 'maintain_weight'
      // Normalize targetWeightKg: maintain → equal to current; others → user value or null
      const finalTargetWeight =
        goal === 'maintain_weight' ? currentW : (form.targetWeightKg ? Number(form.targetWeightKg) : null)

      const payload = {
        ...form,
        targetWeightKg: finalTargetWeight,
        healthGoal: goal,
        nutritionGoal: {
          goal,
          calorieTarget: activeCalorieTarget,
          macroPercentages: activeMacros,
          proteinG: typeof activeGrams.protein === 'number' ? activeGrams.protein : null,
          carbsG: typeof activeGrams.carbs === 'number' ? activeGrams.carbs : null,
          fatG: typeof activeGrams.fat === 'number' ? activeGrams.fat : null,
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

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
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
            <h1>Hồ sơ cá nhân &amp; Sức khỏe</h1>
          </div>
          <button type="button" className="hp-skip" onClick={() => navigate('/dashboard')}>
            Để sau
          </button>
        </header>

        {/* Info banner */}
        <div className="hp-banner">
          <i className="bi bi-shield-check" />
          <p>
            Dữ liệu này giúp NutriLens tự động tính toán nhu cầu năng lượng và cá nhân hóa thực đơn phù hợp nhất cho bạn.{' '}
            <strong>Thông tin mang tính tham khảo, không thay thế tư vấn của bác sĩ hoặc chuyên gia dinh dưỡng.</strong>
          </p>
        </div>

        <form className="hp-form" ref={formRef} onSubmit={handleSubmit} noValidate>
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
                <input id="fullName" name="fullName" type="text" maxLength="100" placeholder="Nguyễn Văn A" value={form.fullName} onChange={updateField} />
                {isInvalid('fullName') && <span className="hp-field__error">Vui lòng nhập họ và tên</span>}
              </div>

              <div className={`hp-field ${submitted && !PHONE_RE.test(form.phone) ? 'is-invalid' : ''}`}>
                <label htmlFor="phone">Số điện thoại <span className="hp-required">*</span></label>
                <input id="phone" name="phone" type="tel" inputMode="numeric" maxLength="10" placeholder="0912 345 678" value={form.phone} onChange={updateField} />
                {submitted && !PHONE_RE.test(form.phone) && (
                  <span className="hp-field__error">Số điện thoại phải gồm 10 chữ số, bắt đầu bằng 0</span>
                )}
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
                  {age > 0 && (
                    <span style={{ marginLeft: '8px', color: '#10b981', fontWeight: 600, fontSize: '0.85rem' }}>
                      ({age} tuổi)
                    </span>
                  )}
                </label>
                <input
                  id="dateOfBirth"
                  name="dateOfBirth"
                  type="date"
                  max={getLocalDateValue()}
                  value={form.dateOfBirth}
                  onChange={updateField}
                />
                {isInvalid('dateOfBirth') && <span className="hp-field__error">Vui lòng chọn ngày sinh</span>}
                {/* Cảnh báo dưới 18 tuổi */}
                {age > 0 && age < 18 && (
                  <div className="hp-field__warning">
                    <i className="bi bi-exclamation-triangle" />
                    Công thức Mifflin-St Jeor được thiết kế cho người trưởng thành. Kết quả BMR/TDEE ở độ tuổi dưới 18 chỉ mang tính tham khảo.
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── Section 2: Chỉ số thể chất ── */}
          <section className="hp-card" aria-labelledby="sec-body">
            <div className="hp-card__header">
              <div className="hp-card__badge">2</div>
              <div>
                <h2 id="sec-body">Chỉ số thể chất &amp; Chuyển hóa</h2>
                <p>NutriLens ứng dụng công thức khoa học Mifflin-St Jeor để xác định BMR và TDEE.</p>
              </div>
            </div>

            <div className="hp-grid hp-grid--2">
              <div className={`hp-field ${submitted && (Number(form.heightCm) < 100 || Number(form.heightCm) > 250) ? 'is-invalid' : isInvalid('heightCm') ? 'is-invalid' : ''}`}>
                <label htmlFor="heightCm">Chiều cao <span className="hp-required">*</span></label>
                <div className="hp-unit-input">
                  <input
                    id="heightCm" name="heightCm" type="number"
                    min="100" max="250" step="0.1" placeholder="165"
                    value={form.heightCm} onChange={updateField}
                  />
                  <span>cm</span>
                </div>
                {isInvalid('heightCm') && <span className="hp-field__error">Bắt buộc</span>}
                {submitted && form.heightCm && (Number(form.heightCm) < 100 || Number(form.heightCm) > 250) && (
                  <span className="hp-field__error">Chiều cao phải từ 100–250 cm</span>
                )}
              </div>

              <div className={`hp-field ${submitted && (Number(form.currentWeightKg) < 20 || Number(form.currentWeightKg) > 300) ? 'is-invalid' : isInvalid('currentWeightKg') ? 'is-invalid' : ''}`}>
                <label htmlFor="currentWeightKg">Cân nặng hiện tại <span className="hp-required">*</span></label>
                <div className="hp-unit-input">
                  <input
                    id="currentWeightKg" name="currentWeightKg" type="number"
                    min="20" max="300" step="0.1" placeholder="55"
                    value={form.currentWeightKg} onChange={updateField}
                  />
                  <span>kg</span>
                </div>
                {isInvalid('currentWeightKg') && <span className="hp-field__error">Bắt buộc</span>}
                {submitted && form.currentWeightKg && (Number(form.currentWeightKg) < 20 || Number(form.currentWeightKg) > 300) && (
                  <span className="hp-field__error">Cân nặng phải từ 20–300 kg</span>
                )}
              </div>
            </div>

            {/* BMI + BMR/TDEE display */}
            {(bmi || bmr) && (
              <div className="hp-metrics">
                {bmi && bmiInfo && (
                  <div className="hp-bmi">
                    <div className="hp-bmi__left">
                      <span className="hp-bmi__label">Chỉ số khối cơ thể (BMI)</span>
                      <strong className="hp-bmi__value" style={{ color: bmiInfo.color }}>{bmi}</strong>
                      <span className="hp-bmi__cat" style={{ color: bmiInfo.color, backgroundColor: bmiInfo.bg }}>
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

            {/* Gợi ý từ hệ thống — xuất hiện ngay khi có BMI hợp lệ */}
            {systemAdvice && bmiInfo && (
              <div className="hp-expert-advice" style={{ borderColor: systemAdvice.color }}>
                <div className="hp-expert-advice__header" style={{ color: systemAdvice.color }}>
                  <i className={`bi ${systemAdvice.icon}`} />
                  <strong>Gợi ý từ hệ thống (dựa trên chỉ số BMI)</strong>
                </div>
                <p className="hp-expert-advice__text">{systemAdvice.advice}</p>
                <div className="hp-expert-advice__tag" style={{ backgroundColor: bmiInfo.bg, color: systemAdvice.color }}>
                  <i className="bi bi-lightbulb-fill" />
                  Mục tiêu được gợi ý:{' '}
                  <strong>{NUTRITION_GOAL_OPTIONS.find((g) => g.value === systemAdvice.recommended)?.label}</strong>
                </div>
                <p className="hp-expert-advice__disclaimer">
                  <i className="bi bi-info-circle" /> Thông tin chỉ mang tính tham khảo, không thay thế tư vấn của bác sĩ hoặc chuyên gia dinh dưỡng.
                </p>
              </div>
            )}

            {/* Biểu đồ cân nặng */}
            <div className="hp-weight-history">
              <div className="hp-weight-history__header">
                <div>
                  <h3>Tiến triển cân nặng theo thời gian</h3>
                  <p>Theo dõi biểu đồ thay đổi cân nặng qua các lần ghi nhận thực tế.</p>
                </div>
                <button
                  type="button" className="hp-weight-history__add"
                  onClick={openWeightDialog} title="Ghi nhận cân nặng mới" aria-label="Ghi nhận cân nặng"
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
                <p>Chọn mức phù hợp nhất với thói quen sinh hoạt và tập luyện trong tuần.</p>
              </div>
            </div>
            <div className="hp-activity-grid">
              {ACTIVITY_OPTIONS.map((opt) => {
                const isActive = form.activityLevel === opt.value
                const isErr = isInvalid('activityLevel')
                return (
                  <label className={`hp-activity-card ${isActive ? 'is-active' : ''} ${isErr ? 'is-error' : ''}`} key={opt.value}>
                    <input type="radio" name="activityLevel" value={opt.value} checked={isActive} onChange={updateField} />
                    <div className="hp-activity-card__icon"><i className={`bi ${opt.icon}`} /></div>
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

          {/* ── Section 4: Mục tiêu dinh dưỡng ── */}
          <section className="hp-card" aria-labelledby="sec-goal">
            <div className="hp-card__header">
              <div className="hp-card__badge">4</div>
              <div>
                <h2 id="sec-goal">Mục tiêu dinh dưỡng &amp; Phân bổ năng lượng</h2>
                <p>Hệ thống tự động đề xuất mục tiêu calo và tỉ lệ macro chuẩn khoa học dựa trên chỉ số trao đổi chất của bạn.</p>
              </div>
            </div>

            {/* Thông báo khi goal đang được auto-chọn theo gợi ý hệ thống */}
            {systemAdvice && form.healthGoal === systemAdvice.recommended && (
              <div className="hp-advice-note hp-advice-note--info" style={{ marginBottom: '12px' }}>
                <i className="bi bi-stars" />
                <span>
                  Mục tiêu <strong>{selectedGoalConfig.label}</strong> đã được hệ thống tự động chọn dựa trên chỉ số BMI của bạn.
                  Bạn có thể thay đổi tùy ý bên dưới.
                </span>
              </div>
            )}

            {/* 3 lựa chọn mục tiêu */}
            <div className="hp-goal-grid">
              {NUTRITION_GOAL_OPTIONS.map((opt) => {
                const isActive = (form.healthGoal || 'maintain_weight') === opt.value
                const isRecommended = systemAdvice?.recommended === opt.value
                return (
                  <label
                    className={`hp-goal-card ${isActive ? 'is-active' : ''}`}
                    key={opt.value}
                    style={isActive ? { borderColor: opt.color, backgroundColor: opt.bg } : {}}
                  >
                    <input
                      type="radio" name="healthGoal" value={opt.value}
                      checked={isActive}
                      onChange={() => handleGoalChange(opt.value)}
                    />
                    <div className="hp-goal-card__icon" style={{ color: opt.color, backgroundColor: opt.bg }}>
                      <i className={`bi ${opt.icon}`} />
                    </div>
                    <strong className="hp-goal-card__label">{opt.label}</strong>
                    <small className="hp-goal-card__sub">{opt.sub}</small>
                    {isRecommended && (
                      <span className="hp-goal-card__recommended" style={{ color: opt.color }}>
                        <i className="bi bi-patch-check-fill" /> Được gợi ý
                      </span>
                    )}
                    {isActive && <i className="bi bi-check-circle-fill hp-goal-card__check" style={{ color: opt.color }} />}
                  </label>
                )
              })}
            </div>

            {/* Cân nặng mục tiêu */}
            <div className="hp-target-weight-section">
              <h3 className="hp-target-weight-section__title">
                <i className="bi bi-bullseye" /> Cân nặng mục tiêu
              </h3>
              {targetWeightConstraint.disabled ? (
                <div className="hp-target-weight-disabled">
                  <i className="bi bi-info-circle" />
                  <span>
                    Bạn đang chọn <strong>Duy trì cân nặng</strong> — cân nặng mục tiêu bằng cân nặng hiện tại
                    {form.currentWeightKg && <strong> ({form.currentWeightKg} kg)</strong>}.
                  </span>
                </div>
              ) : (
                <div className="hp-field">
                  <label htmlFor="targetWeightKg">
                    Cân nặng mục tiêu
                    {targetWeightConstraint.hint && (
                      <small className="hp-target-weight-hint"> — {targetWeightConstraint.hint}</small>
                    )}
                  </label>
                  <div className="hp-unit-input">
                    <input
                      id="targetWeightKg" name="targetWeightKg" type="number"
                      min={targetWeightConstraint.min} max={targetWeightConstraint.max}
                      step="0.1"
                      placeholder={form.healthGoal === 'lose_weight' ? `< ${form.currentWeightKg || '?'} kg` : `> ${form.currentWeightKg || '?'} kg`}
                      value={form.targetWeightKg} onChange={updateField}
                    />
                    <span>kg</span>
                  </div>
                  {targetWeightBmiWarning && (
                    <div className="hp-field__warning">
                      <i className="bi bi-exclamation-triangle" /> {targetWeightBmiWarning}
                    </div>
                  )}
                  {/* Safe upper hint for gain_weight */}
                  {form.healthGoal === 'gain_weight' && targetWeightConstraint.safeguardMax && (
                    <small className="hp-target-weight-hint" style={{ display: 'block', marginTop: '4px' }}>
                      <i className="bi bi-shield" /> Cân nặng dưới {targetWeightConstraint.safeguardMax} kg tương ứng BMI &lt; 25 (ngưỡng an toàn).
                    </small>
                  )}
                </div>
              )}
            </div>

            {/* Bảng Calo & Macro */}
            <div className="hp-macro-panel">
              <div className="hp-macro-panel__header">
                <div className="hp-macro-panel__title">
                  <span className="hp-macro-panel__tag">Đề xuất khoa học mỗi ngày</span>
                  <h3>{selectedGoalConfig.label}</h3>
                </div>
                <button
                  type="button" className="hp-macro-panel__btn-toggle"
                  onClick={() => {
                    if (!customized) {
                      setCustomForm({
                        calorieTarget: activeCalorieTarget ? String(Math.round(activeCalorieTarget)) : '',
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
                    {activeCalorieTarget
                      ? <>{Math.round(activeCalorieTarget).toLocaleString('vi-VN')} <small>kcal/ngày</small></>
                      : <span style={{ color: '#94a3b8' }}>— (cần hoàn tất thông tin)</span>
                    }
                  </strong>
                </div>
                {bmr && tdee && (
                  <div className="hp-macro-calories__sub">
                    <span><i className="bi bi-fire" /> BMR: <b>{bmr.toLocaleString('vi-VN')} kcal</b></span>
                    <span><i className="bi bi-lightning-charge" /> TDEE: <b>{tdee.toLocaleString('vi-VN')} kcal</b></span>
                  </div>
                )}
              </div>

              {/* Ghi chú khi calo giảm cân bị giới hạn ở BMR */}
              {actualDeficit?.capped && (
                <div className="hp-advice-note hp-advice-note--info">
                  <i className="bi bi-info-circle-fill" />
                  Mức thâm hụt thực tế được điều chỉnh xuống <strong>{actualDeficit.kcal} kcal/ngày</strong>{' '}
                  (thay vì 500 kcal) để không thấp hơn BMR — đảm bảo an toàn cho sức khỏe.
                </div>
              )}

              {customized && (
                <div className="hp-custom-row mb-3">
                  <div className="hp-field">
                    <label>
                      Calo mục tiêu (kcal/ngày)
                      {bmr && tdee && (
                        <small className="text-muted ms-2">
                          (Khoảng an toàn: {bmr.toLocaleString('vi-VN')} – {(tdee + 1000).toLocaleString('vi-VN')} kcal)
                        </small>
                      )}
                    </label>
                    <div className="hp-unit-input">
                      <input
                        type="number" min={bmr || 1000} max={(tdee || 2000) + 1000}
                        placeholder="Nhập calo mục tiêu"
                        value={customForm.calorieTarget}
                        onChange={(e) => setCustomForm((c) => ({ ...c, calorieTarget: e.target.value }))}
                      />
                      <span>kcal</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Real-time warnings in custom mode */}
              {customWarnings.map((w, i) => (
                <div key={i} className={`hp-advice-note hp-advice-note--${w.level}`}>
                  <i className={`bi ${w.level === 'danger' ? 'bi-exclamation-triangle-fill' : 'bi-exclamation-circle-fill'}`} />
                  {w.msg}
                </div>
              ))}

              {/* Macro cards */}
              <div className="hp-macro-grid">
                <div className="hp-macro-card hp-macro-card--protein">
                  <div className="hp-macro-card__top"><span>Đạm (Protein)</span><small>4 kcal/g</small></div>
                  {customized ? (
                    <div className="hp-macro-input-wrap">
                      <input type="number" min="5" max="70" placeholder="5–70" value={customForm.protein}
                        onChange={(e) => setCustomForm((c) => ({ ...c, protein: e.target.value }))} />
                      <span>%</span>
                    </div>
                  ) : (
                    <strong className="hp-macro-pct">{activeMacros.protein}%</strong>
                  )}
                  <b className="hp-macro-grams">{activeGrams.protein ?? '—'} g</b>
                </div>

                <div className="hp-macro-card hp-macro-card--carbs">
                  <div className="hp-macro-card__top"><span>Tinh bột (Carbs)</span><small>4 kcal/g</small></div>
                  {customized ? (
                    <div className="hp-macro-input-wrap">
                      <input type="number" min="5" max="80" placeholder="5–80" value={customForm.carbs}
                        onChange={(e) => setCustomForm((c) => ({ ...c, carbs: e.target.value }))} />
                      <span>%</span>
                    </div>
                  ) : (
                    <strong className="hp-macro-pct">{activeMacros.carbs}%</strong>
                  )}
                  <b className="hp-macro-grams">{activeGrams.carbs ?? '—'} g</b>
                </div>

                <div className="hp-macro-card hp-macro-card--fat">
                  <div className="hp-macro-card__top"><span>Chất béo (Lipid)</span><small>9 kcal/g</small></div>
                  {customized ? (
                    <div className="hp-macro-input-wrap">
                      <input type="number" min="5" max="60" placeholder="5–60" value={customForm.fat}
                        onChange={(e) => setCustomForm((c) => ({ ...c, fat: e.target.value }))} />
                      <span>%</span>
                    </div>
                  ) : (
                    <strong className="hp-macro-pct">{activeMacros.fat}%</strong>
                  )}
                  <b className="hp-macro-grams">{activeGrams.fat ?? '—'} g</b>
                </div>
              </div>

              {/* Tổng macro — ngưỡng nhất quán ±1% */}
              {customized && (
                <div className={`hp-macro-sum ${macroSumOk ? 'is-valid' : 'is-invalid'}`}>
                  <i className={`bi ${macroSumOk ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'}`} />
                  <span>
                    Tổng tỉ lệ: <b>{macroSum}%</b>{' '}
                    {macroSumOk ? '(Đạt chuẩn 100%)' : '(Cần điều chỉnh sao cho tổng trong khoảng 99–101%)'}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* ── Section 5: Lưu ý dinh dưỡng ── */}
          <section className="hp-card" aria-labelledby="sec-nutrition">
            <div className="hp-card__header">
              <div className="hp-card__badge">5</div>
              <div>
                <h2 id="sec-nutrition">Lưu ý dinh dưỡng &amp; Sức khỏe</h2>
                <p>Không bắt buộc — giúp NutriLens gợi ý thực đơn phù hợp và an toàn hơn cho bạn.</p>
              </div>
            </div>

            <div className="hp-tag-group">
              {DIETARY_OPTIONS.map(({ label, icon }) => (
                <button
                  type="button" key={label}
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
                <textarea id="allergies" name="allergies" rows="3" maxLength="500"
                  placeholder="Ví dụ: đậu phộng, hải sản, sữa bò..."
                  value={form.allergies} onChange={updateField}
                />
                <small className="hp-field__hint">Tối đa 500 ký tự. Thông tin được lưu riêng tư.</small>
              </div>
              <div className="hp-field">
                <label htmlFor="medicalConditions">
                  <i className="bi bi-heart-pulse me-1" style={{ color: '#ef4444' }} />
                  Tình trạng sức khỏe cần lưu ý
                </label>
                <textarea id="medicalConditions" name="medicalConditions" rows="3" maxLength="500"
                  placeholder="Ví dụ: tiểu đường, huyết áp cao, gút..."
                  value={form.medicalConditions} onChange={updateField}
                />
                <small className="hp-field__hint">Tối đa 500 ký tự. Thông tin được lưu riêng tư.</small>
              </div>
            </div>

            {/* Nhắc nhở tham khảo bác sĩ khi có bệnh lý + mục tiêu thay đổi cân */}
            {form.medicalConditions.trim() && form.healthGoal !== 'maintain_weight' && (
              <div className="hp-advice-note hp-advice-note--warning" style={{ marginTop: '12px' }}>
                <i className="bi bi-heart-pulse-fill" />
                Bạn có tình trạng sức khỏe đặc biệt. Nên trao đổi với bác sĩ hoặc chuyên gia dinh dưỡng trước khi thực hiện mục tiêu thay đổi cân nặng.
              </div>
            )}
          </section>

          {/* ── Footer actions ── */}
          <div className="hp-actions">
            <Link to="/dashboard" className="hp-actions__cancel">
              <i className="bi bi-x" /> Hủy
            </Link>
            <button type="submit" className="hp-actions__save" disabled={saving}>
              {saving ? (
                <><div className="hp-spinner" /><span>Đang lưu…</span></>
              ) : (
                <><i className="bi bi-check2" /><span>Lưu hồ sơ &amp; Mục tiêu</span></>
              )}
            </button>
          </div>
        </form>
      </main>

      {/* ── Modal ghi nhận cân nặng ── */}
      {weightDialogOpen && (
        <div className="hp-modal-backdrop" role="presentation" onMouseDown={closeWeightDialog}>
          <section
            className="hp-weight-modal" role="dialog" aria-modal="true" aria-labelledby="weight-dialog-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="hp-weight-modal__header">
              <div>
                <span>Theo dõi tiến trình</span>
                <h2 id="weight-dialog-title">Ghi nhận cân nặng</h2>
              </div>
              <button type="button" className="hp-weight-modal__close" onClick={closeWeightDialog} title="Đóng" aria-label="Đóng">
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); saveWeightLog(false) }} noValidate>
              <div className={`hp-field ${weightError.field === 'weight' ? 'is-invalid' : ''}`}>
                <label htmlFor="weightLogKg">Cân nặng</label>
                <div className="hp-unit-input">
                  <input
                    id="weightLogKg" type="number" min="20" max="300" step="0.1"
                    inputMode="decimal" autoFocus
                    value={weightForm.weightKg}
                    onChange={(e) => {
                      setWeightForm((c) => ({ ...c, weightKg: e.target.value }))
                      setWeightError({ field: '', message: '' })
                      setConfirmOverwrite(false)
                    }}
                  />
                  <span>kg</span>
                </div>
                {weightError.field === 'weight' && <span className="hp-field__error">{weightError.message}</span>}
              </div>

              <div className={`hp-field ${weightError.field === 'date' ? 'is-invalid' : ''}`}>
                <label htmlFor="weightLogDate">Ngày ghi nhận</label>
                <input
                  id="weightLogDate" type="date" max={getLocalDateValue()}
                  value={weightForm.recordedDate}
                  onChange={(e) => {
                    setWeightForm((c) => ({ ...c, recordedDate: e.target.value }))
                    setWeightError({ field: '', message: '' })
                    setConfirmOverwrite(false)
                  }}
                />
                {weightError.field === 'date' && <span className="hp-field__error">{weightError.message}</span>}
              </div>

              {confirmOverwrite && (
                <div className="hp-weight-modal__confirm" role="alert">
                  <i className="bi bi-exclamation-circle" />
                  <p>
                    Bạn đã ghi nhận cân nặng ngày{' '}
                    <strong>{formatLogDate(weightForm.recordedDate)}</strong>. Bạn có muốn cập nhật lại không?
                  </p>
                  <div>
                    <button type="button" className="hp-weight-modal__cancel" onClick={() => setConfirmOverwrite(false)} disabled={savingWeight}>Hủy</button>
                    <button type="button" className="hp-weight-modal__save" onClick={() => saveWeightLog(true)} disabled={savingWeight}>Cập nhật</button>
                  </div>
                </div>
              )}

              {!confirmOverwrite && (
                <div className="hp-weight-modal__actions">
                  <button type="button" className="hp-weight-modal__cancel" onClick={closeWeightDialog} disabled={savingWeight}>Hủy</button>
                  <button type="submit" className="hp-weight-modal__save" disabled={savingWeight}>
                    {savingWeight ? 'Đang lưu...' : 'Lưu'}
                  </button>
                </div>
              )}
            </form>
          </section>
        </div>
      )}

      {/* ── Dialog cảnh báo xung đột mục tiêu ── */}
      {goalWarning && (
        <div
          className="hp-modal-backdrop" role="presentation"
          onMouseDown={() => { if (!goalWarning.fromSubmit) setGoalWarning(null) }}
        >
          <section
            className={`hp-goal-warning-modal hp-goal-warning-modal--${goalWarning.risk.level}`}
            role="alertdialog" aria-modal="true" aria-labelledby="goal-warning-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="hp-goal-warning-modal__icon">
              <i className={`bi ${
                goalWarning.risk.level === 'danger' ? 'bi-exclamation-triangle-fill' :
                goalWarning.risk.level === 'warning' ? 'bi-exclamation-circle-fill' :
                'bi-info-circle-fill'
              }`} />
            </div>
            <h2 id="goal-warning-title">
              {goalWarning.risk.level === 'danger' ? 'Cảnh báo sức khỏe' :
               goalWarning.risk.level === 'warning' ? 'Lưu ý quan trọng' :
               'Gợi ý từ hệ thống'}
            </h2>
            <p>{goalWarning.risk.msg}</p>
            <p className="hp-goal-warning-modal__disclaimer">
              Thông tin chỉ mang tính tham khảo, không thay thế tư vấn của bác sĩ hoặc chuyên gia dinh dưỡng.
            </p>
            <div className="hp-goal-warning-modal__actions">
              <button type="button" className="hp-weight-modal__cancel" onClick={() => setGoalWarning(null)}>
                <i className="bi bi-arrow-left" /> Hủy, chọn lại
              </button>
              <button
                type="button"
                className={`hp-goal-warning-modal__confirm hp-goal-warning-modal__confirm--${goalWarning.risk.level}`}
                onClick={confirmGoalWarning}
              >
                <i className="bi bi-check2" />
                {goalWarning.risk.level === 'danger' ? 'Tôi hiểu rủi ro, vẫn tiếp tục' : 'Tiếp tục với lựa chọn này'}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
