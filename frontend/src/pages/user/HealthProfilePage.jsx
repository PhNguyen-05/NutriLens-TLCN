import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import axiosInstance from '../../api/axiosInstance'
import { userUpdated } from '../../store/slices/authSlice'

const BASE_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'

/** Regex số điện thoại Việt Nam: bắt đầu 0, đủ 10 chữ số */
const PHONE_RE = /^0\d{9}$/

/** Calo tối thiểu an toàn theo giới tính */
const CALORIE_FLOOR = { male: 1500, female: 1200 }

const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: 'Ít vận động', detail: 'Hầu như chỉ ngồi hoặc nằm', multiplier: 1.2, icon: 'bi-person-seated' },
  { value: 'light', label: 'Vận động nhẹ', detail: 'Đi bộ hoặc tập nhẹ 1–3 ngày/tuần', multiplier: 1.375, icon: 'bi-person-walking' },
  { value: 'moderate', label: 'Vận động vừa', detail: 'Tập luyện 3–5 ngày/tuần', multiplier: 1.55, icon: 'bi-bicycle' },
  { value: 'active', label: 'Năng động', detail: 'Tập luyện 6–7 ngày/tuần', multiplier: 1.725, icon: 'bi-lightning-charge' },
  { value: 'very_active', label: 'Rất năng động', detail: 'Lao động nặng hoặc tập cường độ cao', multiplier: 1.9, icon: 'bi-trophy' },
]

const NUTRITION_GOAL_OPTIONS = [
  {
    value: 'lose_weight',
    label: 'Giảm cân',
    sub: 'Thâm hụt tối đa 20% TDEE (không quá 500 kcal/ngày), không dưới ngưỡng an toàn',
    icon: 'bi-arrow-down-circle',
    color: '#3b82f6',
    bg: '#eff6ff',
    /**
     * @param {number} bmr
     * @param {number} tdee
     * @param {'male'|'female'|string} gender
     */
    calcCalo: (bmr, tdee, gender) => {
      const deficit = Math.min(500, Math.round(tdee * 0.2))
      const floor = CALORIE_FLOOR[gender] ?? 1200
      return Math.max(bmr, tdee - deficit, floor)
    },
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


const EMPTY_FORM = {
  fullName: '', phone: '', dateOfBirth: '', gender: '', avatarUrl: '',
  heightCm: '', currentWeightKg: '', targetWeightKg: '', activityLevel: '', healthGoal: 'maintain_weight',
  dietaryPreferences: [], allergies: '', medicalConditions: '', specialConditions: []
}

const BMI_REFERENCE_ROWS = [
  {
    key: 'underweight',
    label: 'Thiếu cân (gầy)',
    who: '< 18,5',
    idiWpro: '< 18,5',
    color: '#3b82f6',
    bg: '#eff6ff',
    matches: (b) => b < 18.5,
  },
  {
    key: 'normal',
    label: 'Bình thường',
    who: '18,5 – 24,9',
    idiWpro: '18,5 – 22,9',
    color: '#10b981',
    bg: '#ecfdf5',
    matches: (b) => b >= 18.5 && b < 23.0,
  },
  {
    key: 'overweight',
    label: 'Thừa cân',
    who: '25 – 29,9',
    idiWpro: '23 – 24,9',
    color: '#f59e0b',
    bg: '#fffbeb',
    matches: (b) => b >= 23.0 && b < 25.0,
  },
  {
    key: 'obese1',
    label: 'Béo phì độ I',
    who: '30 – 34,9',
    idiWpro: '25 – 29,9',
    color: '#ef4444',
    bg: '#fef2f2',
    matches: (b) => b >= 25.0 && b < 30.0,
  },
  {
    key: 'obese2',
    label: 'Béo phì độ II',
    who: '35 – 39,9',
    idiWpro: '≥ 30',
    color: '#dc2626',
    bg: '#fef2f2',
    matches: (b) => b >= 30.0,
  },
  {
    key: 'obese3',
    label: 'Béo phì độ III',
    who: '≥ 40',
    idiWpro: '—',
    color: '#991b1b',
    bg: '#fee2e2',
    matches: () => false,
  },
]

// ---------------------------------------------------------------------------
// Pure helper functions
// ---------------------------------------------------------------------------

/**
 * Phân loại BMI theo chuẩn WHO Châu Á (IDI & WPRO).
 * 4 phân đoạn trực quan bằng nhau (25% mỗi đoạn) để chữ và vạch chia khớp 100%:
 * 1. Thiếu cân: < 18.5 (vùng 0% -> 25%, tâm 12.5%)
 * 2. Bình thường: 18.5 -> 22.9 (vùng 25% -> 50%, tâm 37.5%)
 * 3. Thừa cân: 23.0 -> 24.9 (vùng 50% -> 75%, tâm 62.5%)
 * 4. Béo phì: >= 25.0 (vùng 75% -> 100%, tâm 87.5%)
 */
function getBmiCategory(bmi) {
  const b = Number(bmi)
  if (!b || b <= 0) return null

  if (b < 18.5) {
    const pct = ((Math.max(14, b) - 14) / (18.5 - 14)) * 25
    return {
      label: 'Thiếu cân',
      color: '#3b82f6',
      bg: '#eff6ff',
      pct: Math.min(24, Math.max(3, pct)),
      rowKey: 'underweight',
    }
  }
  if (b < 23) {
    const pct = 25 + ((b - 18.5) / (23 - 18.5)) * 25
    return {
      label: 'Bình thường',
      color: '#10b981',
      bg: '#ecfdf5',
      pct: Math.min(49, Math.max(26, pct)),
      rowKey: 'normal',
    }
  }
  if (b < 25) {
    const pct = 50 + ((b - 23) / (25 - 23)) * 25
    return {
      label: 'Thừa cân',
      color: '#f59e0b',
      bg: '#fffbeb',
      pct: Math.min(74, Math.max(51, pct)),
      rowKey: 'overweight',
    }
  }
  // Béo phì (>= 25)
  const pct = 75 + ((Math.min(35, b) - 25) / (35 - 25)) * 25
  return {
    label: 'Béo phì',
    color: '#ef4444',
    bg: '#fef2f2',
    pct: Math.min(97, Math.max(76, pct)),
    rowKey: b >= 30 ? 'obese2' : 'obese1',
  }
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
  const dateStr = typeof date === 'string' ? date.slice(0, 10) : date
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(`${dateStr}T00:00:00`)
  )
}

/** Chuyển ISO YYYY-MM-DD sang định dạng hiển thị dd/mm/yyyy */
function isoToDisplayDate(iso) {
  if (!iso || typeof iso !== 'string') return ''
  const parts = iso.slice(0, 10).split('-')
  if (parts.length !== 3) return ''
  const [y, m, d] = parts
  if (!y || !m || !d) return ''
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`
}

/** Chuyển định dạng người dùng nhập dd/mm/yy hoặc dd/mm/yyyy sang ISO YYYY-MM-DD */
function parseDobToIso(input) {
  if (!input || typeof input !== 'string') return ''
  const parts = input.trim().split('/')
  if (parts.length !== 3) return ''
  let [d, m, y] = parts.map((p) => p.trim())
  if (!d || !m || !y) return ''

  const day = parseInt(d, 10)
  const month = parseInt(m, 10)
  let year = parseInt(y, 10)

  if (isNaN(day) || isNaN(month) || isNaN(year)) return ''

  // Hỗ trợ cả 2 chữ số (yy) và 4 chữ số (yyyy)
  if (y.length === 2) {
    const curYear = new Date().getFullYear()
    const curCentury = Math.floor(curYear / 100) * 100
    const cutoff = curYear % 100
    year = year <= cutoff ? curCentury + year : curCentury - 100 + year
  } else if (y.length !== 4) {
    return ''
  }

  if (month < 1 || month > 12) return ''
  if (day < 1 || day > 31) return ''
  if (year < 1900 || year > new Date().getFullYear()) return ''

  // Kiểm tra số ngày thực tế trong tháng
  const maxDays = new Date(year, month, 0).getDate()
  if (day > maxDays) return ''

  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  if (iso > getLocalDateValue()) return ''

  return iso
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function HealthProfilePage() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const formRef = useRef(null)
  const weightModalRef = useRef(null)
  const goalWarningModalRef = useRef(null)
  const timeoutRef = useRef(null)

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

  // Weight log & Baseline lock state
  const [weightLogs, setWeightLogs] = useState([])
  const [baselineStatus, setBaselineStatus] = useState(null)
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false)
  const [milestoneForm, setMilestoneForm] = useState({ weightKg: '' })
  const [applyingMilestone, setApplyingMilestone] = useState(false)
  const [milestoneError, setMilestoneError] = useState('')

  // Goal conflict warning
  // { pendingGoal, risk: { level, msg }, fromSubmit: bool }
  const [goalWarning, setGoalWarning] = useState(null)
  // Track which (goal, bmiLabel) pair the user has explicitly acknowledged,
  // so we don't re-ask on every submit attempt.
  const [acknowledgedRisk, setAcknowledgedRisk] = useState(null)

  // Custom calorie/macro mode
  const [customized, setCustomized] = useState(false)
  const [customForm, setCustomForm] = useState({ calorieTarget: '', protein: '', carbs: '', fat: '' })

  // Chế độ xem bảng phân loại BMI: 'table' (bảng phân tích) hoặc 'image' (ảnh bảng gốc)
  const [bmiTableView, setBmiTableView] = useState('table')

  // Ngày sinh hiển thị theo chuẩn dd/mm/yy hoặc dd/mm/yyyy
  const [dobDisplay, setDobDisplay] = useState('')

  // Cleanup navigate timeout on unmount
  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [])

  // Esc + focus trap — milestone modal
  useEffect(() => {
    if (!milestoneModalOpen) return
    function onKeyDown(e) {
      if (e.key === 'Escape' && !applyingMilestone) {
        setMilestoneModalOpen(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [milestoneModalOpen, applyingMilestone])

  // Esc + focus trap — goal warning modal
  useEffect(() => {
    if (!goalWarning) return
    function onKeyDown(e) {
      if (e.key === 'Escape') { if (!goalWarning.fromSubmit) setGoalWarning(null); return }
      if (e.key === 'Tab') {
        const modal = goalWarningModalRef.current
        if (!modal) return
        const focusable = modal.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        const first = focusable[0]; const last = focusable[focusable.length - 1]
        if (e.shiftKey) { if (document.activeElement === first) { e.preventDefault(); last?.focus() } }
        else { if (document.activeElement === last) { e.preventDefault(); first?.focus() } }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [goalWarning])

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

        if (data.baselineStatus) {
          setBaselineStatus(data.baselineStatus)
        }

        const profile = data.profile || {}
        const {
          heightCm, currentWeightKg, targetWeightKg,
          activityLevel, healthGoal, dietaryPreferences,
          allergies, medicalConditions, nutritionGoal, specialConditions
        } = profile
        const initialGoal = nutritionGoal?.goal || healthGoal || 'maintain_weight'

        const rawDob = data.user?.dateOfBirth ? data.user.dateOfBirth.slice(0, 10) : ''
        setDobDisplay(isoToDisplayDate(rawDob))

        setForm({
          fullName: data.user?.fullName || '',
          phone: data.user?.phone || '',
          dateOfBirth: rawDob,
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
          specialConditions: specialConditions || [],
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
    // Parse as local date to avoid UTC shift in UTC-N timezones
    const [y, m, d] = form.dateOfBirth.split('-').map(Number)
    if (!y || !m || !d) return 0
    const birthDate = new Date(y, m - 1, d)
    const today = new Date()
    let a = today.getFullYear() - birthDate.getFullYear()
    const mo = today.getMonth() - birthDate.getMonth()
    if (mo < 0 || (mo === 0 && today.getDate() < birthDate.getDate())) a--
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

  /** Dưới 18 tuổi: ngưỡng BMI người lớn không áp dụng, không nên tự giảm cân */
  const isMinor = age > 0 && age < 18

  // Không hiển thị phân loại BMI và gợi ý cho người dưới 18
  const bmiInfo = useMemo(() => (bmi && !isMinor ? getBmiCategory(bmi) : null), [bmi, isMinor])


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
    const cal = selectedGoalConfig.calcCalo(bmr, tdee, form.gender)
    const mac = selectedGoalConfig.macros
    return {
      calorieTarget: cal,
      macroPercentages: mac,
      proteinG: Math.round((cal * mac.protein) / 400),
      carbsG: Math.round((cal * mac.carbs) / 400),
      fatG: Math.round((cal * mac.fat) / 900),
    }
  }, [bmr, tdee, selectedGoalConfig, form.gender])

  // Actual deficit for lose_weight — reflects the 20%-TDEE capped formula
  const actualDeficit = useMemo(() => {
    if (form.healthGoal !== 'lose_weight' || !bmr || !tdee) return null
    const deficit = Math.min(500, Math.round(tdee * 0.2))
    const floor = CALORIE_FLOOR[form.gender] ?? 1200
    const target = Math.max(bmr, tdee - deficit, floor)
    const realDeficit = tdee - target
    const defaultDeficit = deficit
    const capped = realDeficit < defaultDeficit
    return { kcal: realDeficit, capped }
  }, [form.healthGoal, bmr, tdee, form.gender])


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

  const estimatedWeeks = useMemo(() => {
    if (form.healthGoal === 'maintain_weight') return null
    const current = Number(form.currentWeightKg)
    const target = Number(form.targetWeightKg)
    if (!current || !target || !activeCalorieTarget || !tdee) return null
    const diffKg = Math.abs(current - target)
    const dailyDiff = Math.abs(tdee - activeCalorieTarget) // kcal/ngày chênh lệch
    if (!diffKg || !dailyDiff) return null
    const days = Math.round((diffKg * 7700) / dailyDiff)
    const weeks = Math.round(days / 7)
    return weeks > 0 ? weeks : null
  }, [form.healthGoal, form.currentWeightKg, form.targetWeightKg, activeCalorieTarget, tdee])

  // Strict 100% requirement (no tolerance in UI either; backend enforces 0.5% for rounding)
  const macroSum = (Number(customForm.protein) || 0) + (Number(customForm.carbs) || 0) + (Number(customForm.fat) || 0)
  const macroSumOk = macroSum === 100

  // Real-time warnings for custom mode (inline, not just on submit)
  const customWarnings = useMemo(() => {
    if (!customized) return []
    const warnings = []
    const cal = Number(customForm.calorieTarget)
    const fat = Number(customForm.fat)
    const protein = Number(customForm.protein)
    const floor = CALORIE_FLOOR[form.gender] ?? 1200

    if (cal > 0 && cal < floor)
      warnings.push({ level: 'danger', msg: `Calo mục tiêu (${cal} kcal) thấp hơn ngưỡng an toàn (${floor} kcal). Điều này có thể gây hại cho sức khỏe.` })
    else if (cal > 0 && bmr && cal < bmr)
      warnings.push({ level: 'danger', msg: `Calo mục tiêu (${cal} kcal) thấp hơn BMR (${bmr} kcal). Điều này có thể gây hại cho sức khỏe.` })
    if (tdee && cal > 0 && cal > tdee + 1000)
      warnings.push({ level: 'warning', msg: `Calo mục tiêu (${cal} kcal) vượt quá TDEE + 1000 kcal (${tdee + 1000} kcal). Mức dư thừa này quá lớn.` })
    // Goal-calorie consistency
    if (cal > 0 && tdee) {
      if (form.healthGoal === 'lose_weight' && cal >= tdee)
        warnings.push({ level: 'warning', msg: `Bạn đang chọn mục tiêu Giảm cân nhưng calo mục tiêu (${cal} kcal) ≥ TDEE (${tdee} kcal).` })
      if (form.healthGoal === 'gain_weight' && cal <= tdee)
        warnings.push({ level: 'warning', msg: `Bạn đang chọn mục tiêu Tăng cân nhưng calo mục tiêu (${cal} kcal) ≤ TDEE (${tdee} kcal).` })
    }
    if (fat > 0 && fat < 20)
      warnings.push({ level: 'warning', msg: 'Chất béo dưới 20% có thể ảnh hưởng đến hấp thu vitamin tan trong dầu (A, D, E, K).' })
    if (protein > 0 && protein < 10)
      warnings.push({ level: 'warning', msg: 'Protein dưới 10% có thể không đủ nhu cầu cơ bản.' })
    if (protein > 0 && protein > 35)
      warnings.push({ level: 'warning', msg: 'Protein trên 35% có thể gây áp lực cho thận nếu bạn có bệnh thận. Tham khảo bác sĩ nếu cần.' })
    return warnings
  }, [customized, customForm, bmr, tdee, form.gender, form.healthGoal])


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
        // Show safe upper hint = BMI 23 (WHO Châu Á)
        const maxBmiSafe = h >= 100 ? Math.floor(23 * (h / 100) ** 2 * 10) / 10 : null
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

  // Warn if gain_weight target pushes BMI >= 23 (Asian WHO threshold for overweight)
  const targetWeightBmiWarning = useMemo(() => {
    if (form.healthGoal !== 'gain_weight') return null
    const h = Number(form.heightCm)
    const targetW = Number(form.targetWeightKg)
    if (!h || !targetW || h < 100) return null
    const targetBmi = targetW / (h / 100) ** 2
    if (targetBmi >= 23) {
      return `Cân nặng mục tiêu này tương ứng BMI ${targetBmi.toFixed(1)} — mức thừa cân (ngưỡng WHO Châu Á ≥ 23). Cân nhắc đặt mục tiêu thấp hơn.`
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

  function handleDobChange(e) {
    let val = e.target.value
    // Chỉ cho phép gõ số và dấu /
    val = val.replace(/[^0-9/]/g, '')

    // Tự động thêm dấu / khi người dùng gõ chuỗi số liên tục
    const digits = val.replace(/\D/g, '')
    let formatted = val
    if (!val.includes('/')) {
      if (digits.length > 4) {
        formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`
      } else if (digits.length > 2) {
        formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`
      } else {
        formatted = digits
      }
    }

    setDobDisplay(formatted)
    setError('')
    setSuccess('')

    const iso = parseDobToIso(formatted)
    if (iso) {
      setForm((c) => ({ ...c, dateOfBirth: iso }))
    } else {
      setForm((c) => ({ ...c, dateOfBirth: '' }))
    }
  }

  function handleDobBlur() {
    if (!dobDisplay.trim()) return
    const iso = parseDobToIso(dobDisplay)
    if (iso) {
      setDobDisplay(isoToDisplayDate(iso))
      setForm((c) => ({ ...c, dateOfBirth: iso }))
    }
  }


  function applyGoal(newGoal) {
    const opt = NUTRITION_GOAL_OPTIONS.find((g) => g.value === newGoal)
    setForm((current) => {
      const currentW = Number(current.currentWeightKg)
      const targetW = Number(current.targetWeightKg)
      let newTarget = current.targetWeightKg

      if (newGoal === 'maintain_weight') {
        newTarget = current.currentWeightKg
      } else if (
        // Se stale target: target == current (left over from maintain), or direction is flipped
        !current.targetWeightKg ||
        targetW === currentW ||
        (newGoal === 'lose_weight' && targetW >= currentW) ||
        (newGoal === 'gain_weight' && targetW <= currentW)
      ) {
        newTarget = ''
      }

      return { ...current, healthGoal: newGoal, targetWeightKg: newTarget }
    })
    // Only update custom form if we have real BMR/TDEE values; otherwise keep existing
    if (customized && opt && bmr && tdee) {
      setCustomForm({
        calorieTarget: String(opt.calcCalo(bmr, tdee, form.gender)),
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
    // Chặn giảm cân cho người dưới 18 tuổi
    if (isMinor && newGoal === 'lose_weight') {
      setError('Mục tiêu giảm cân không được khuyến nghị cho người dưới 18 tuổi. Vui lòng tham khảo bác sĩ hoặc chuyên gia dinh dưỡng.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
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

  function openMilestoneModal() {
    const latestWeight = baselineStatus?.latestWeightLog?.weightKg
      || (weightLogs.length ? weightLogs[weightLogs.length - 1].weightKg : form.currentWeightKg)
    setMilestoneForm({ weightKg: String(latestWeight || '') })
    setMilestoneError('')
    setMilestoneModalOpen(true)
  }

  async function handleApplyMilestone(e) {
    e.preventDefault()
    const w = Number(milestoneForm.weightKg)
    if (!milestoneForm.weightKg || !Number.isFinite(w) || w < 20 || w > 300) {
      setMilestoneError('Vui lòng nhập cân nặng hợp lệ từ 20 đến 300 kg')
      return
    }
    setApplyingMilestone(true)
    setMilestoneError('')
    try {
      const { data } = await axiosInstance.post('/profile/apply-milestone-weight', { weightKg: w })
      setBaselineStatus(data.baselineStatus)
      setForm((prev) => ({
        ...prev,
        currentWeightKg: String(w),
      }))
      setMilestoneModalOpen(false)
      setSuccess('Cập nhật mốc cân nặng và thiết lập chu kỳ 14 ngày mới thành công!')
      setTimeout(() => setSuccess(''), 4000)
      const { data: logsData } = await axiosInstance.get('/profile/weight-logs')
      setWeightLogs(logsData.weightLogs || [])
    } catch (err) {
      setMilestoneError(err.response?.data?.message || 'Không thể cập nhật mốc cân nặng, vui lòng thử lại')
    } finally {
      setApplyingMilestone(false)
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
      if (!form.dateOfBirth && dobDisplay.trim()) {
        setError('Ngày sinh không hợp lệ. Vui lòng nhập đúng định dạng ngày/tháng/năm (dd/mm/yy hoặc dd/mm/yyyy).')
      } else {
        setError('Vui lòng hoàn tất các thông tin bắt buộc được đánh dấu.')
      }
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
    if (form.healthGoal !== 'maintain_weight' && !form.targetWeightKg) {
      setError('Vui lòng nhập cân nặng mục tiêu khi chọn mục tiêu giảm cân hoặc tăng cân.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

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
    // Hard block for danger-level risks — no override allowed
    if (risk?.level === 'danger') {
      setError('Mục tiêu này không phù hợp với BMI hiện tại và không thể lưu. Vui lòng chọn lại mục tiêu phù hợp.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
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
      const floor = CALORIE_FLOOR[form.gender] ?? 1200

      if (!customForm.calorieTarget || !cal || cal <= 0) {
        setError('Vui lòng nhập mục tiêu calo hợp lệ.')
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      if (cal < floor) {
        setError(`Calo mục tiêu (${cal} kcal) không được thấp hơn ngưỡng an toàn ${floor} kcal.`)
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
      if (prot + carbs + fat !== 100) {
        setError(`Tổng tỷ lệ Protein + Tinh bột + Chất béo phải bằng chính xác 100% (hiện tại: ${prot + carbs + fat}%).`)
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
      if (data.baselineStatus) {
        setBaselineStatus(data.baselineStatus)
      }
      setSuccess('Lưu hồ sơ và mục tiêu dinh dưỡng thành công! Đang chuyển về Trang chủ...')
      timeoutRef.current = setTimeout(() => navigate('/dashboard'), 1200)

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
                <input
                  id="phone" name="phone" type="tel" inputMode="numeric" maxLength="10"
                  placeholder="0912345678"
                  value={form.phone}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                    setForm((c) => ({ ...c, phone: digits }))
                    setError('')
                    setSuccess('')
                  }}
                />
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

              <div className={`hp-field ${submitted && !form.dateOfBirth ? 'is-invalid' : isInvalid('dateOfBirth') ? 'is-invalid' : ''}`}>
                <label htmlFor="dobDisplay">
                  Ngày sinh <span className="hp-required">*</span>
                  <span className="hp-field__hint-inline">(dd/mm/yy)</span>
                  {age > 0 && (
                    <span style={{ marginLeft: '8px', color: '#10b981', fontWeight: 600, fontSize: '0.85rem' }}>
                      ({age} tuổi)
                    </span>
                  )}
                </label>
                <div className="hp-dob-input">
                  <input
                    id="dobDisplay"
                    name="dobDisplay"
                    type="text"
                    inputMode="numeric"
                    placeholder="dd/mm/yy (vd: 15/05/98 hoặc 15/05/1998)"
                    maxLength="10"
                    value={dobDisplay}
                    onChange={handleDobChange}
                    onBlur={handleDobBlur}
                    autoComplete="bday"
                  />
                  <label className="hp-dob-input__picker-btn" title="Chọn ngày từ lịch">
                    <i className="bi bi-calendar3" />
                    <input
                      type="date"
                      tabIndex="-1"
                      max={getLocalDateValue()}
                      value={form.dateOfBirth}
                      onChange={(e) => {
                        const val = e.target.value
                        setForm((c) => ({ ...c, dateOfBirth: val }))
                        setDobDisplay(isoToDisplayDate(val))
                        setError('')
                        setSuccess('')
                      }}
                    />
                  </label>
                </div>
                {(isInvalid('dateOfBirth') || (submitted && !form.dateOfBirth)) && (
                  <span className="hp-field__error">
                    {dobDisplay.trim()
                      ? 'Ngày sinh không hợp lệ (vui lòng nhập dạng dd/mm/yy hoặc dd/mm/yyyy)'
                      : 'Vui lòng nhập ngày sinh'}
                  </span>
                )}
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

          {/* ── Section 2: Chỉ số thể chất & BMI ── */}
          <section className="hp-card" aria-labelledby="sec-body">
            <div className="hp-card__header">
              <div className="hp-card__badge">2</div>
              <div>
                <h2 id="sec-body">Chỉ số thể chất &amp; Phân loại BMI</h2>
                <p>NutriLens đánh giá thể trạng dựa trên chuẩn BMI dành riêng cho người Châu Á (WHO &amp; IDI/WPRO).</p>
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
                <label htmlFor="currentWeightKg">
                  Cân nặng mốc (Hồ sơ) <span className="hp-required">*</span>
                  {baselineStatus?.isLocked && (
                    <span className="hp-baseline-chip hp-baseline-chip--locked">
                      <i className="bi bi-lock-fill" /> Đang khóa 14 ngày
                    </span>
                  )}
                  {baselineStatus?.inGracePeriod && (
                    <span className="hp-baseline-chip hp-baseline-chip--grace">
                      <i className="bi bi-clock-history" /> Ân hạn sửa nhầm (Còn {baselineStatus.hoursRemainingInGrace}h)
                    </span>
                  )}
                </label>
                <div className="hp-unit-input">
                  <input
                    id="currentWeightKg" name="currentWeightKg" type="number"
                    min="20" max="300" step="0.1" placeholder="55"
                    value={form.currentWeightKg} onChange={updateField}
                    disabled={Boolean(baselineStatus?.isLocked)}
                  />
                  <span>kg</span>
                </div>
                {isInvalid('currentWeightKg') && <span className="hp-field__error">Bắt buộc</span>}
                {submitted && form.currentWeightKg && (Number(form.currentWeightKg) < 20 || Number(form.currentWeightKg) > 300) && (
                  <span className="hp-field__error">Cân nặng phải từ 20–300 kg</span>
                )}
              </div>
            </div>

            {/* Thông báo chu kỳ dinh dưỡng 14 ngày & Ân hạn 24 giờ */}
            {baselineStatus?.inGracePeriod && (
              <div className="hp-baseline-notice hp-baseline-notice--grace">
                <i className="bi bi-clock-history" />
                <div>
                  <strong>Khoảng ân hạn sửa nhầm (Còn {baselineStatus.hoursRemainingInGrace} giờ)</strong>
                  <p>
                    Bạn có thể chỉnh sửa lại cân nặng mốc nếu vừa nhập nhầm. Sau 24 giờ đầu, chỉ số mốc này sẽ được khóa trong 14 ngày để đánh giá kết quả dinh dưỡng.
                  </p>
                </div>
              </div>
            )}

            {baselineStatus?.isLocked && (
              <div className="hp-baseline-notice hp-baseline-notice--locked">
                <div className="hp-baseline-notice__top">
                  <div className="hp-baseline-notice__info">
                    <span className="hp-baseline-notice__tag">
                      <i className="bi bi-lock-fill" /> Bảo lưu chu kỳ 14 ngày 
                    </span>
                    <p>
                      Cân nặng mốc được cố định trong 14 ngày để cơ thể thích nghi với mức Calo &amp; TDEE mục tiêu. Chỉ số này sẽ mở khóa vào ngày <strong>{formatLogDate(baselineStatus.unlockDate)}</strong> (còn <strong>{baselineStatus.daysRemaining} ngày</strong>).
                    </p>
                  </div>
                  <Link to="/weight-tracker" className="hp-baseline-notice__btn">
                    <i className="bi bi-speedometer2" /> Ghi cân nặng hàng ngày →
                  </Link>
                </div>
              </div>
            )}

            {baselineStatus?.canReviewMilestone && (
              <div className="hp-baseline-notice hp-baseline-notice--milestone">
                <div className="hp-baseline-notice__top">
                  <div className="hp-baseline-notice__info">
                    <span className="hp-baseline-notice__tag hp-baseline-notice__tag--milestone">
                      <i className="bi bi-trophy-fill" /> Đã hoàn thành chu kỳ 14 ngày!
                    </span>
                    <p>
                      Đã hết chu kỳ 14 ngày! Bạn có muốn cập nhật lại chỉ số mốc và tính lại mục tiêu Calo cho chu kỳ tiếp theo không?
                    </p>
                  </div>
                  <button
                    type="button"
                    className="hp-baseline-notice__btn hp-baseline-notice__btn--milestone"
                    onClick={openMilestoneModal}
                  >
                    <i className="bi bi-arrow-repeat" /> Đánh giá &amp; Cập nhật mốc mới
                  </button>
                </div>
              </div>
            )}

            {/* BMI display & Bảng phân loại chi tiết */}
            {bmi && bmiInfo && (
              <div className="hp-metrics">
                <div className="hp-bmi">
                  <div className="hp-bmi__left">
                    <span className="hp-bmi__label">Chỉ số khối cơ thể (BMI)</span>
                    <strong className="hp-bmi__value" style={{ color: bmiInfo.color }}>{bmi}</strong>
                    <span className="hp-bmi__cat" style={{ color: bmiInfo.color, backgroundColor: bmiInfo.bg }}>
                      {bmiInfo.label} (WHO Châu Á)
                    </span>
                  </div>
                  <div className="hp-bmi__right">
                    <div className="hp-bmi__bar-wrap">
                      {/* Thanh 4 phân đoạn chuẩn hóa bằng nhau (25% mỗi đoạn) */}
                      <div className="hp-bmi__bar">
                        <div className="hp-bmi__seg hp-bmi__seg--underweight" title="Thiếu cân (< 18.5)" />
                        <div className="hp-bmi__seg hp-bmi__seg--normal" title="Bình thường (18.5 – 22.9)" />
                        <div className="hp-bmi__seg hp-bmi__seg--overweight" title="Thừa cân (23.0 – 24.9)" />
                        <div className="hp-bmi__seg hp-bmi__seg--obese" title="Béo phì (≥ 25.0)" />

                        {/* Kim chỉ thị nội suy mượt mà trong từng phân đoạn */}
                        <div
                          className="hp-bmi__needle"
                          style={{ left: `${bmiInfo.pct}%`, backgroundColor: bmiInfo.color }}
                          title={`BMI của bạn: ${bmi} (${bmiInfo.label})`}
                        >
                          <span className="hp-bmi__needle-val">{bmi}</span>
                        </div>
                      </div>

                      {/* 4 cột nhãn phân loại khớp chính xác 100% với 4 đoạn màu */}
                      <div className="hp-bmi__scale-grid">
                        <div className={`hp-bmi__scale-col ${bmiInfo.label === 'Thiếu cân' ? 'is-active' : ''}`}>
                          <strong>Thiếu cân</strong>
                          <small>&lt; 18,5</small>
                        </div>
                        <div className={`hp-bmi__scale-col ${bmiInfo.label === 'Bình thường' ? 'is-active' : ''}`}>
                          <strong>Bình thường</strong>
                          <small>18,5 – 22,9</small>
                        </div>
                        <div className={`hp-bmi__scale-col ${bmiInfo.label === 'Thừa cân' ? 'is-active' : ''}`}>
                          <strong>Thừa cân</strong>
                          <small>23 – 24,9</small>
                        </div>
                        <div className={`hp-bmi__scale-col ${bmiInfo.label === 'Béo phì' ? 'is-active' : ''}`}>
                          <strong>Béo phì</strong>
                          <small>≥ 25</small>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bảng & hình ảnh phân loại BMI chi tiết */}
                <div className="hp-bmi-detail-card">
                  <div className="hp-bmi-detail-card__header">
                    <div className="hp-bmi-detail-card__title">
                      <i className="bi bi-table" />
                      <div>
                        <h3>Bảng phân loại chỉ số BMI chi tiết</h3>
                        <p>So sánh tiêu chuẩn WHO (Toàn cầu) và IDI &amp; WPRO (Khuyến nghị cho người Châu Á)</p>
                      </div>
                    </div>
                    <div className="hp-bmi-detail-card__tabs">
                      <button
                        type="button"
                        className={`hp-bmi-tab-btn ${bmiTableView === 'table' ? 'is-active' : ''}`}
                        onClick={() => setBmiTableView('table')}
                      >
                        <i className="bi bi-grid-3x3" /> Bảng phân tích
                      </button>
                      <button
                        type="button"
                        className={`hp-bmi-tab-btn ${bmiTableView === 'image' ? 'is-active' : ''}`}
                        onClick={() => setBmiTableView('image')}
                      >
                        <i className="bi bi-image" /> Xem hình ảnh gốc
                      </button>
                    </div>
                  </div>

                  {bmiTableView === 'table' ? (
                    <div className="hp-bmi-table-responsive">
                      <table className="hp-bmi-table">
                        <colgroup>
                          <col className="hp-bmi-col--label" />
                          <col className="hp-bmi-col--who" />
                          <col className="hp-bmi-col--asian" />
                          <col className="hp-bmi-col--status" />
                        </colgroup>
                        <thead>
                          <tr>
                            <th className="hp-bmi-th hp-bmi-th--label">Phân loại thể trạng</th>
                            <th className="hp-bmi-th hp-bmi-th--who">
                              <span className="hp-bmi-th__title">BMI (kg/m²) - WHO</span>
                              <span className="hp-bmi-th__sub">Toàn cầu</span>
                            </th>
                            <th className="hp-bmi-th hp-bmi-th--asian">
                              <span className="hp-bmi-th-asian__tag">
                                <i className="bi bi-star-fill" /> Chuẩn áp dụng
                              </span>
                              <span className="hp-bmi-th-asian__title">
                                BMI (kg/m²) - IDI &amp; WPRO <em>(Châu Á)</em>
                              </span>
                            </th>
                            <th className="hp-bmi-th hp-bmi-th--status">Trạng thái của bạn</th>
                          </tr>
                        </thead>
                        <tbody>
                          {BMI_REFERENCE_ROWS.map((row) => {
                            const isUserMatch = row.matches && row.matches(Number(bmi))
                            return (
                              <tr
                                key={row.key}
                                className={`hp-bmi-table__row hp-bmi-table__row--${row.key} ${isUserMatch ? 'is-user-current' : ''}`}
                                style={isUserMatch ? { '--cat-color': row.color, '--cat-bg': row.bg } : undefined}
                              >
                                <td className="hp-bmi-table__cell-label">
                                  <div className="hp-bmi-table__label-flex">
                                    <span
                                      className={`hp-bmi-table__color-dot ${isUserMatch ? 'is-pulse' : ''}`}
                                      style={{ backgroundColor: row.color }}
                                    />
                                    <span className="hp-bmi-table__label-main">{row.label}</span>
                                    {row.subLabel && (
                                      <span className="hp-bmi-table__label-sub">{row.subLabel}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="hp-bmi-table__cell-val hp-bmi-table__cell-val--who">
                                  {row.who}
                                </td>
                                <td
                                  className={`hp-bmi-table__cell-val hp-bmi-table__cell-val--asian ${isUserMatch ? 'is-user-target' : ''}`}
                                >
                                  {isUserMatch ? (
                                    <span className="hp-bmi-asian-pill">{row.idiWpro}</span>
                                  ) : (
                                    <span className="hp-bmi-asian-val">{row.idiWpro}</span>
                                  )}
                                </td>
                                <td className="hp-bmi-table__cell-status">
                                  {isUserMatch ? (
                                    <span
                                      className="hp-bmi-table__user-badge"
                                      style={{ color: row.color, borderColor: row.color, backgroundColor: row.bg }}
                                    >
                                      <i className="bi bi-geo-alt-fill" /> Vị trí của bạn: <strong>{bmi}</strong>
                                    </span>
                                  ) : (
                                    <span className="hp-bmi-table__empty-dash">—</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      <div className="hp-bmi-table__source">
                        <i className="bi bi-info-circle-fill" />
                        <div>
                          <strong>✦ NutriLens áp dụng chuẩn IDI &amp; WPRO (Khuyến nghị cho người Châu Á):</strong>
                          <span>
                            {' '}Người Châu Á có nguy cơ bệnh lý tim mạch và đái tháo đường ở mức BMI thấp hơn (ngưỡng thừa cân từ <strong>23,0 kg/m²</strong> - y khoa gọi là Tiền béo phì; béo phì từ <strong>25,0 kg/m²</strong>). Nguồn: WHO (1999); IDI &amp; WPRO (2000); Bộ Y Tế.
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="hp-bmi-image-view">
                      <div className="hp-bmi-image-frame">
                        <img
                          src="/bmi-reference-table.jpg"
                          alt="Bảng chi tiết phân loại BMI - WHO và IDI & WPRO"
                          className="hp-bmi-reference-img"
                        />
                      </div>
                      <p className="hp-bmi-table__source">
                        <i className="bi bi-info-circle-fill" />
                        <span>Hình ảnh bảng phân loại chuẩn y khoa đối chiếu giữa WHO và IDI &amp; WPRO.</span>
                      </p>
                    </div>
                  )}
                </div>
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

            {/* Callout hướng dẫn chuyển tiếp sang trang Theo dõi cân nặng */}
            <div className="hp-weight-tracker-callout">
              <div className="hp-weight-tracker-callout__icon">
                <i className="bi bi-speedometer2" />
              </div>
              <div className="hp-weight-tracker-callout__content">
                <strong>Theo dõi biến động cân nặng &amp; Biểu đồ xu hướng hàng ngày</strong>
                <p>
                  Cân nặng mốc trong hồ sơ này được cố định 14 ngày để làm căn cứ tính BMR và TDEE. Để ghi nhật ký cân nặng mỗi ngày, xem biểu đồ xu hướng sinh học và phân tích chi tiết, vui lòng mở trang Tiến trình.
                </p>
              </div>
              <Link to="/weight-tracker" className="hp-weight-tracker-callout__btn">
                Mở trang Tiến trình <i className="bi bi-arrow-right" />
              </Link>
            </div>
          </section>

          {/* ── Section 2: Mức độ vận động & Tiêu hao năng lượng (TDEE) ── */}
          <section className="hp-card" aria-labelledby="sec-activity">
            <div className="hp-card__header">
              <div className="hp-card__badge">2</div>
              <div>
                <h2 id="sec-activity">Mức độ vận động thể chất <span className="hp-required">*</span></h2>
                <p>Chọn mức độ vận động để NutriLens tính toán chính xác tổng năng lượng tiêu hao mỗi ngày (TDEE) từ năng lượng chuyển hóa cơ bản (BMR).</p>
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
                      <div className="hp-activity-card__head">
                        <strong>{opt.label}</strong>
                        <span className="hp-activity-card__mult">×{opt.multiplier}</span>
                      </div>
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

            {/* Hiển thị BMR & TDEE sau khi chọn mức độ vận động */}
            {bmr && form.activityLevel && tdee ? (
              <div className="hp-activity-results">
                <div className="hp-activity-results__header">
                  <div className="hp-activity-results__title">
                    <i className="bi bi-fire" />
                    <div>
                      <h3>Chỉ số chuyển hóa &amp; Tiêu hao năng lượng (Mifflin-St Jeor)</h3>
                      <p>Dựa trên chỉ số thể chất kết hợp với mức độ vận động bạn vừa chọn</p>
                    </div>
                  </div>
                  <span className="hp-activity-results__tag">
                    <i className="bi bi-check2-circle" /> Đã cập nhật theo mức vận động
                  </span>
                </div>

                <div className="hp-bmr-stats">
                  <div className="hp-bmr-stat">
                    <i className="bi bi-heart-pulse-fill" />
                    <div>
                      <strong>{bmr.toLocaleString('vi-VN')} <span>kcal/ngày</span></strong>
                      <p>BMR (Năng lượng chuyển hóa cơ bản)</p>
                      <small className="hp-bmr-stat__detail">Lượng calo tối thiểu cơ thể cần ở trạng thái nghỉ ngơi hoàn toàn</small>
                    </div>
                  </div>
                  <div className="hp-bmr-stat hp-bmr-stat--highlight">
                    <i className="bi bi-lightning-charge-fill" />
                    <div>
                      <strong>{tdee.toLocaleString('vi-VN')} <span>kcal/ngày</span></strong>
                      <p>TDEE (Tổng năng lượng tiêu hao cả ngày)</p>
                      <small className="hp-bmr-stat__detail">
                        = BMR ({bmr.toLocaleString('vi-VN')} kcal) × {ACTIVITY_OPTIONS.find((o) => o.value === form.activityLevel)?.multiplier || 1.2} ({ACTIVITY_OPTIONS.find((o) => o.value === form.activityLevel)?.label})
                      </small>
                    </div>
                  </div>
                </div>

                <div className="hp-activity-results__footer">
                  <i className="bi bi-info-circle-fill" />
                  <span>
                    Chỉ số <strong>TDEE ({tdee.toLocaleString('vi-VN')} kcal/ngày)</strong> phản ánh tổng lượng calo cơ thể bạn đốt cháy mỗi ngày và là căn cứ cốt lõi để xác định mục tiêu calo ở bước tiếp theo.
                  </span>
                </div>
              </div>
            ) : bmr && !form.activityLevel ? (
              <div className="hp-activity-prompt">
                <div className="hp-activity-prompt__icon">
                  <i className="bi bi-arrow-up-circle-fill" />
                </div>
                <div>
                  <strong>BMR của bạn là {bmr.toLocaleString('vi-VN')} kcal/ngày</strong>
                  <p>Vui lòng chọn 1 mức độ vận động ở trên để hệ thống tính toán chính xác chỉ số <strong>TDEE</strong> (Tổng năng lượng tiêu hao hàng ngày).</p>
                </div>
              </div>
            ) : null}
          </section>

          {/* ── Section 3: Mục tiêu dinh dưỡng ── */}
          <section className="hp-card" aria-labelledby="sec-goal">
            <div className="hp-card__header">
              <div className="hp-card__badge">3</div>
              <div>
                <h2 id="sec-goal">Mục tiêu dinh dưỡng &amp; Phân bổ năng lượng</h2>
                <p>Hệ thống tự động đề xuất mục tiêu calo và tỉ lệ macro dựa trên chỉ số trao đổi chất của bạn. Kết quả chỉ mang tính tham khảo.</p>
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
                      <i className="bi bi-shield" /> Cân nặng dưới {targetWeightConstraint.safeguardMax} kg tương ứng BMI &lt; 23 (ngưỡng thừa cân WHO Châu Á).
                    </small>
                  )}
                  {estimatedWeeks && (
                    <div className="hp-estimate-row">
                      <div className="hp-estimate-row__main">
                        <i className="bi bi-clock-history" />
                        <span>Ước tính đạt mục tiêu sau khoảng</span>
                        <strong className="hp-estimate-row__value">
                          {estimatedWeeks} tuần
                          <em>({Math.round(estimatedWeeks / 4.3)} tháng)</em>
                        </strong>
                      </div>
                      <p className="hp-estimate-row__note">
                        <i className="bi bi-info-circle" />
                        Chỉ mang tính tham khảo — kết quả thực tế phụ thuộc vào nhiều yếu tố.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bảng Calo & Macro */}
            <div className="hp-macro-panel">
              <div className="hp-macro-panel__header">
                <div className="hp-macro-panel__title">
                  <span className="hp-macro-panel__tag">Đề xuất của hệ thống mỗi ngày</span>
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
                  {customized ? 'Dùng đề xuất của hệ thống' : 'Tùy chỉnh mục tiêu'}
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

      {/* ── Modal xác nhận mốc cân nặng sau chu kỳ 14 ngày (Tùy chọn 2) ── */}
      {milestoneModalOpen && (
        <div className="hp-modal-backdrop" role="presentation" onMouseDown={() => setMilestoneModalOpen(false)}>
          <section
            className="hp-milestone-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="milestone-dialog-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="hp-milestone-modal__header">
              <div className="hp-milestone-modal__icon">
                <i className="bi bi-trophy-fill" />
              </div>
              <div className="hp-milestone-modal__title-box">
                <h2 id="milestone-dialog-title">Cập nhật mốc cân nặng sau 14 ngày</h2>
                <p>Đánh giá hiệu quả dinh dưỡng và thiết lập chu kỳ 14 ngày tiếp theo</p>
              </div>
              <button
                type="button"
                className="hp-milestone-modal__close"
                onClick={() => setMilestoneModalOpen(false)}
                title="Đóng"
                aria-label="Đóng"
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <form onSubmit={handleApplyMilestone} noValidate>
              <div className="hp-milestone-modal__body">
                <div className="hp-milestone-prompt-box">
                  <p>
                    <strong>Đã hết chu kỳ 14 ngày!</strong> Bạn có muốn cập nhật lại chỉ số mốc và tính lại mục tiêu Calo không?
                  </p>
                  {baselineStatus?.latestWeightLog ? (
                    <div className="hp-milestone-prompt-box__recent">
                      <i className="bi bi-clock-history" />
                      <span>
                        Số cân cuối cùng đã nhập trong hệ thống: <strong>{baselineStatus.latestWeightLog.weightKg} kg</strong> (ngày {formatLogDate(baselineStatus.latestWeightLog.recordedDate)})
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="hp-field" style={{ marginTop: '14px' }}>
                  <label htmlFor="milestoneWeightInput" style={{ fontWeight: 600 }}>
                    Xác nhận số cân mốc cho chu kỳ mới (kg):
                  </label>
                  <div className="hp-unit-input">
                    <input
                      id="milestoneWeightInput"
                      type="number"
                      step="0.1"
                      min="20"
                      max="300"
                      autoFocus
                      value={milestoneForm.weightKg}
                      onChange={(e) => setMilestoneForm({ weightKg: e.target.value })}
                    />
                    <span>kg</span>
                  </div>
                  <small style={{ color: '#64748b', fontSize: '12px', marginTop: '5px', display: 'block' }}>
                    Hệ thống tự động điền số cân cuối cùng bạn đã ghi nhận. Bạn có thể xác nhận số cân này hoặc điều chỉnh nếu vừa đo lại trước khi lưu vào hồ sơ.
                  </small>
                </div>

                {milestoneError && (
                  <div className="hp-milestone-modal__error" role="alert">
                    <i className="bi bi-exclamation-circle-fill" /> {milestoneError}
                  </div>
                )}
              </div>

              <div className="hp-milestone-modal__actions">
                <button
                  type="button"
                  className="hp-weight-modal__cancel"
                  onClick={() => setMilestoneModalOpen(false)}
                  disabled={applyingMilestone}
                >
                  Để sau
                </button>
                <button
                  type="submit"
                  className="hp-milestone-modal__submit"
                  disabled={applyingMilestone}
                >
                  {applyingMilestone ? (
                    <><div className="hp-spinner" /><span>Đang lưu…</span></>
                  ) : (
                    <><i className="bi bi-check2" /><span>Xác nhận &amp; Cập nhật hồ sơ</span></>
                  )}
                </button>
              </div>
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
            ref={goalWarningModalRef}
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
              {goalWarning.risk.level !== 'danger' && (
                <button
                  type="button"
                  className={`hp-goal-warning-modal__confirm hp-goal-warning-modal__confirm--${goalWarning.risk.level}`}
                  onClick={confirmGoalWarning}
                >
                  <i className="bi bi-check2" />
                  Tiếp tục với lựa chọn này
                </button>
              )}
            </div>

          </section>
        </div>
      )}
    </div>
  )
}
