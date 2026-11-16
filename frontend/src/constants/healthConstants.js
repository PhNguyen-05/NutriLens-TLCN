/** Regex số điện thoại Việt Nam: bắt đầu 0, đủ 10 chữ số */
export const PHONE_RE = /^0\d{9}$/

/** Calo tối thiểu an toàn theo giới tính */
export const CALORIE_FLOOR = { male: 1500, female: 1200 }

export const ACTIVITY_OPTIONS = [
  { value: 'sedentary', label: 'Ít vận động', detail: 'Hầu như chỉ ngồi hoặc nằm', multiplier: 1.2, icon: 'bi-person-seated' },
  { value: 'light', label: 'Vận động nhẹ', detail: 'Đi bộ hoặc tập nhẹ 1–3 ngày/tuần', multiplier: 1.375, icon: 'bi-person-walking' },
  { value: 'moderate', label: 'Vận động vừa', detail: 'Tập luyện 3–5 ngày/tuần', multiplier: 1.55, icon: 'bi-bicycle' },
  { value: 'active', label: 'Năng động', detail: 'Tập luyện 6–7 ngày/tuần', multiplier: 1.725, icon: 'bi-lightning-charge' },
  { value: 'very_active', label: 'Rất năng động', detail: 'Lao động nặng hoặc tập cường độ cao', multiplier: 1.9, icon: 'bi-trophy' },
]

export const NUTRITION_GOAL_OPTIONS = [
  {
    value: 'lose_weight',
    label: 'Giảm cân',
    sub: 'Thâm hụt tối đa 20% TDEE (không quá 500 kcal/ngày), không dưới ngưỡng an toàn',
    icon: 'bi-arrow-down-circle',
    color: '#3b82f6',
    bg: '#eff6ff',
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

export const EMPTY_FORM = {
  fullName: '', phone: '', dateOfBirth: '', gender: '', avatarUrl: '',
  heightCm: '', currentWeightKg: '', targetWeightKg: '', activityLevel: '', healthGoal: 'maintain_weight',
  dietaryPreferences: [], allergies: '', medicalConditions: '', specialConditions: []
}

export const BMI_REFERENCE_ROWS = [
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

/**
 * Phân loại BMI theo chuẩn WHO Châu Á (IDI & WPRO).
 */
export function getBmiCategory(bmi) {
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
 */
export function getSystemAdvice(bmiInfo) {
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
 * Đánh giá mức độ rủi ro và tính phù hợp khoa học khi mục tiêu được chọn khác với khuyến nghị BMI.
 */
export function getGoalRisk(goal, bmiLabel, age = null, specialConditions = []) {
  if (!goal) return null

  // Phụ nữ mang thai + giảm cân
  const isPregnant = Array.isArray(specialConditions) && specialConditions.includes('pregnant')
  if (isPregnant && goal === 'lose_weight') {
    return {
      level: 'danger',
      bmiCategory: 'Thai kỳ',
      goalLabel: 'Giảm cân',
      note: 'Phụ nữ mang thai không nên hạn chế năng lượng — có thể ảnh hưởng đến sự phát triển của thai nhi. Hãy tham khảo bác sĩ sản khoa trước khi điều chỉnh chế độ ăn.',
    }
  }

  // Dưới 18 tuổi + giảm cân
  const isMinor = age > 0 && age < 18
  if (isMinor && goal === 'lose_weight') {
    return {
      level: 'warning',
      bmiCategory: 'Đang trong giai đoạn tăng trưởng',
      goalLabel: 'Giảm cân',
      note: 'Ở tuổi vị thành niên, cơ thể cần đủ năng lượng để phát triển. Nên tham khảo bác sĩ hoặc chuyên gia dinh dưỡng trước khi thực hiện kế hoạch giảm cân.',
    }
  }

  // Thiếu cân + giảm cân (mâu thuẫn trực tiếp)
  if (bmiLabel === 'Thiếu cân' && goal === 'lose_weight') {
    return {
      level: 'danger',
      bmiCategory: 'Thiếu cân',
      goalLabel: 'Giảm cân',
      note: 'Khi BMI đã dưới ngưỡng bình thường, tiếp tục giảm calo có thể gây mất cơ, suy giảm miễn dịch và ảnh hưởng nội tiết. Hướng can thiệp phù hợp là tăng cân có kiểm soát.',
    }
  }

  // Béo phì + tăng cân (mâu thuẫn trực tiếp)
  if (bmiLabel === 'Béo phì' && goal === 'gain_weight') {
    return {
      level: 'danger',
      bmiCategory: 'Béo phì',
      goalLabel: 'Tăng cân',
      note: 'Khi BMI đã vượt ngưỡng an toàn, tăng cân thêm làm tăng nguy cơ kháng insulin, huyết áp cao và rối loạn mỡ máu. Khuyến nghị là giảm 5–10% cân nặng trong 3–6 tháng đầu.',
    }
  }

  // Thừa cân + tăng cân (mâu thuẫn trực tiếp)
  if (bmiLabel === 'Thừa cân' && goal === 'gain_weight') {
    return {
      level: 'danger',
      bmiCategory: 'Thừa cân',
      goalLabel: 'Tăng cân',
      note: 'BMI đang ở mức tiền béo phì theo chuẩn châu Á. Tăng cân thêm sẽ đẩy vào vùng Béo phì (≥ 25,0 kg/m²), làm tăng nguy cơ hội chứng chuyển hóa và bệnh tim mạch.',
    }
  }

  return null
}

export function getLocalDateValue() {
  const today = new Date()
  const offset = today.getTimezoneOffset() * 60_000
  return new Date(today.getTime() - offset).toISOString().slice(0, 10)
}

export function formatLogDate(date) {
  const dateStr = typeof date === 'string' ? date.slice(0, 10) : date
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(`${dateStr}T00:00:00`)
  )
}

/** Chuyển ISO YYYY-MM-DD sang định dạng hiển thị dd/mm/yyyy */
export function isoToDisplayDate(iso) {
  if (!iso || typeof iso !== 'string') return ''
  const parts = iso.slice(0, 10).split('-')
  if (parts.length !== 3) return ''
  const [y, m, d] = parts
  if (!y || !m || !d) return ''
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`
}

/** Chuyển định dạng người dùng nhập dd/mm/yy hoặc dd/mm/yyyy sang ISO YYYY-MM-DD */
export function parseDobToIso(input) {
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

export function formatLogTime(timeVal) {
  if (!timeVal) return ''
  if (typeof timeVal === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(timeVal)) {
    return timeVal.length === 5 ? `${timeVal}:00` : timeVal
  }
  const d = new Date(timeVal)
  if (Number.isNaN(d.getTime())) return ''
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

export function getBmiInfo(weightKg, heightCm) {
  const w = Number(weightKg)
  const h = Number(heightCm)
  if (!w || !h || h <= 0) return null
  const bmi = Number((w / ((h / 100) ** 2)).toFixed(1))
  if (bmi < 18.5) return { bmi, label: 'Thiếu cân', color: '#3b82f6', bg: '#eff6ff' }
  if (bmi < 23) return { bmi, label: 'Bình thường', color: '#10b981', bg: '#ecfdf5' }
  if (bmi < 25) return { bmi, label: 'Thừa cân', color: '#f59e0b', bg: '#fffbeb' }
  return { bmi, label: 'Béo phì', color: '#ef4444', bg: '#fef2f2' }
}

export function getSmoothPath(points) {
  if (!points || points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)},${points[1].y.toFixed(1)}`
  }

  let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
  }
  return d
}

export function getNiceYAxis(minW, maxW) {
  let span = maxW - minW
  const minSpan = 3
  let paddedMin = minW
  let paddedMax = maxW

  if (span < minSpan) {
    const center = (minW + maxW) / 2
    paddedMin = center - minSpan / 2
    paddedMax = center + minSpan / 2
  } else {
    const pad = Math.max(span * 0.1, 1)
    paddedMin = minW - pad
    paddedMax = maxW + pad
  }

  const effectiveSpan = paddedMax - paddedMin
  let tickStep = 1
  if (effectiveSpan <= 4) {
    tickStep = 1
  } else if (effectiveSpan <= 14) {
    tickStep = 2
  } else if (effectiveSpan <= 30) {
    tickStep = 5
  } else {
    tickStep = 10
  }

  let lower = Math.floor(paddedMin / tickStep) * tickStep
  let upper = Math.ceil(paddedMax / tickStep) * tickStep

  if (minW - lower < 0.2 * tickStep) lower -= tickStep
  if (upper - maxW < 0.2 * tickStep) upper += tickStep

  const range = upper - lower || 1
  const ticks = []
  for (let v = upper; v >= lower - 0.0001; v -= tickStep) {
    ticks.push(Number(v.toFixed(1)))
  }

  return { lower, upper, range, ticks, tickStep }
}

