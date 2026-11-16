import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import axiosInstance from '../../api/axiosInstance'
import { userUpdated } from '../../store/slices/authSlice'
import UserHeader from '../../components/common/UserHeader'
import UserFooter from '../../components/common/UserFooter'

import PersonalInfoSection from '../../components/profile/PersonalInfoSection'
import BodyMetricsSection from '../../components/profile/BodyMetricsSection'
import ActivityLevelSection from '../../components/profile/ActivityLevelSection'
import NutritionGoalSection from '../../components/profile/NutritionGoalSection'
import MilestoneReviewModal from '../../components/profile/MilestoneReviewModal'
import UnsafeGoalModal from '../../components/profile/UnsafeGoalModal'

import {
  PHONE_RE,
  CALORIE_FLOOR,
  NUTRITION_GOAL_OPTIONS,
  EMPTY_FORM,
  getBmiCategory,
  getSystemAdvice,
  getGoalRisk,
  getLocalDateValue,
  isoToDisplayDate,
  parseDobToIso,
} from '../../constants/healthConstants'

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '')

export default function HealthProfilePage() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const formRef = useRef(null)
  const goalWarningModalRef = useRef(null)
  const timeoutRef = useRef(null)

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
  const [goalWarning, setGoalWarning] = useState(null)
  const [acknowledgedRisk, setAcknowledgedRisk] = useState(null)

  // Custom calorie/macro mode
  const [customized, setCustomized] = useState(false)
  const [customForm, setCustomForm] = useState({ calorieTarget: '', protein: '', carbs: '', fat: '' })

  // Chế độ xem bảng phân loại BMI: 'table' hoặc 'image'
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
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
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
          allergies, medicalConditions, nutritionGoal, specialConditions,
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
  // Computed values
  // ---------------------------------------------------------------------------
  const age = useMemo(() => {
    if (!form.dateOfBirth) return 0
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
    if (h >= 100 && h <= 250 && w >= 20 && w <= 300) {
      return (w / (h / 100) ** 2).toFixed(1)
    }
    return null
  }, [form.heightCm, form.currentWeightKg])

  const isMinor = age > 0 && age < 18

  const bmiInfo = useMemo(() => (bmi && !isMinor ? getBmiCategory(bmi) : null), [bmi, isMinor])

  const systemAdvice = useMemo(() => getSystemAdvice(bmiInfo), [bmiInfo])

  const bmr = useMemo(() => {
    const h = Number(form.heightCm)
    const w = Number(form.currentWeightKg)
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

  const activeCalorieTarget = useMemo(() => {
    if (customized) {
      const val = Number(customForm.calorieTarget)
      return Number.isFinite(val) && val > 0 ? val : null
    }
    return calculatedProposal?.calorieTarget ?? null
  }, [customized, customForm.calorieTarget, calculatedProposal])

  const activeMacros = useMemo(() => {
    if (customized) {
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
    const dailyDiff = Math.abs(tdee - activeCalorieTarget)
    if (!diffKg || !dailyDiff) return null
    const days = Math.round((diffKg * 7700) / dailyDiff)
    const weeks = Math.round(days / 7)
    return weeks > 0 ? weeks : null
  }, [form.healthGoal, form.currentWeightKg, form.targetWeightKg, activeCalorieTarget, tdee])

  const macroSum = (Number(customForm.protein) || 0) + (Number(customForm.carbs) || 0) + (Number(customForm.fat) || 0)
  const macroSumOk = macroSum === 100

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

  const targetWeightConstraint = useMemo(() => {
    const current = Number(form.currentWeightKg)
    const h = Number(form.heightCm)
    if (!current || current < 20) return { min: 20, max: 300, disabled: false }

    switch (form.healthGoal) {
      case 'lose_weight': {
        const minBmiSafe = h >= 100 ? Math.ceil(18.5 * (h / 100) ** 2 * 10) / 10 : 20
        return {
          min: 20,
          max: Number((current - 0.1).toFixed(1)),
          disabled: false,
          hint: `Phải nhỏ hơn ${current} kg${minBmiSafe < current ? ` (khuyến nghị ≥ ${minBmiSafe} kg để duy trì BMI ≥ 18,5)` : ''}`,
          safeguardMin: minBmiSafe,
        }
      }
      case 'gain_weight': {
        const maxBmiSafe = h >= 100 ? Math.floor(23 * (h / 100) ** 2 * 10) / 10 : null
        return {
          min: Number((current + 0.1).toFixed(1)),
          max: 300,
          disabled: false,
          hint: `Phải lớn hơn ${current} kg${maxBmiSafe && maxBmiSafe > current ? ` (khuyến nghị ≤ ${maxBmiSafe} kg để giữ BMI < 23)` : ''}`,
          safeguardMax: maxBmiSafe,
        }
      }
      case 'maintain_weight':
        return { min: current, max: current, disabled: true }
      default:
        return { min: 20, max: 300, disabled: false }
    }
  }, [form.healthGoal, form.currentWeightKg, form.heightCm])

  const targetWeightBmiWarning = useMemo(() => {
    const h = Number(form.heightCm)
    const targetW = Number(form.targetWeightKg)
    if (!h || !targetW || h < 100) return null
    const targetBmi = targetW / (h / 100) ** 2

    if (form.healthGoal === 'lose_weight' && targetBmi < 18.5) {
      return `Cân nặng mục tiêu này tương ứng BMI ${targetBmi.toFixed(1)} — dưới ngưỡng thiếu cân (< 18,5). Giảm cân quá sâu có thể gây suy nhược cơ thể.`
    }
    if (form.healthGoal === 'gain_weight' && targetBmi >= 23) {
      return `Cân nặng mục tiêu này tương ứng BMI ${targetBmi.toFixed(1)} — mức thừa cân (ngưỡng WHO Châu Á ≥ 23,0). Cân nhắc đặt mục tiêu trong giới hạn an toàn.`
    }
    return null
  }, [form.healthGoal, form.heightCm, form.targetWeightKg])

  useEffect(() => {
    const newLabel = bmiInfo?.label
    const recommended = systemAdvice?.recommended
    if (!newLabel || !recommended) return
    if (newLabel === prevBmiLabelRef.current) return
    prevBmiLabelRef.current = newLabel

    const userExplicitlyChoseOther =
      acknowledgedRisk?.bmiLabel === newLabel && acknowledgedRisk?.goal !== recommended
    if (userExplicitlyChoseOther) return

    setAcknowledgedRisk(null)
    setForm((current) => ({
      ...current,
      healthGoal: recommended,
      targetWeightKg:
        recommended === 'maintain_weight' ? current.currentWeightKg : current.targetWeightKg,
    }))
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
    val = val.replace(/[^0-9/]/g, '')

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
        !current.targetWeightKg ||
        targetW === currentW ||
        (newGoal === 'lose_weight' && targetW >= currentW) ||
        (newGoal === 'gain_weight' && targetW <= currentW)
      ) {
        newTarget = ''
      }

      return { ...current, healthGoal: newGoal, targetWeightKg: newTarget }
    })
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

  function handleGoalChange(newGoal) {
    const risk = bmiInfo ? getGoalRisk(newGoal, bmiInfo.label, age, form.specialConditions) : null
    prevBmiLabelRef.current = bmiInfo?.label ?? prevBmiLabelRef.current
    if (risk) {
      setGoalWarning({ pendingGoal: newGoal, risk, fromSubmit: false })
    } else {
      if (newGoal === systemAdvice?.recommended) setAcknowledgedRisk(null)
      applyGoal(newGoal)
    }
  }

  function confirmGoalWarning() {
    if (!goalWarning) return
    const { pendingGoal, fromSubmit } = goalWarning
    setAcknowledgedRisk({ goal: pendingGoal, bmiLabel: bmiInfo?.label })

    if (!fromSubmit) {
      applyGoal(pendingGoal)
    } else {
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
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) {
      setError('Ảnh đại diện chỉ hỗ trợ JPG, PNG hoặc WebP và không được vượt quá 3MB.')
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
      if (data?.user) {
        dispatch(userUpdated(data.user))
        setForm((current) => ({ ...current, avatarUrl: data.user.avatarUrl }))
      }
      setSuccess('Đã cập nhật ảnh đại diện thành công!')
      setTimeout(() => setSuccess(''), 4000)
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

    const currentW = w
    if (form.healthGoal !== 'maintain_weight' && !form.targetWeightKg) {
      setError('Vui lòng nhập cân nặng mục tiêu khi chọn mục tiêu giảm cân hoặc tăng cân.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    if (form.healthGoal === 'lose_weight' && form.targetWeightKg) {
      const targetW = Number(form.targetWeightKg)
      if (targetW >= currentW) {
        setError('Cân nặng mục tiêu phải nhỏ hơn cân nặng hiện tại khi chọn mục tiêu giảm cân.')
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      if (targetW < 20) {
        setError('Cân nặng mục tiêu tối thiểu là 20 kg.')
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
      if (targetW > 300) {
        setError('Cân nặng mục tiêu tối đa là 300 kg.')
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
    }

    const risk = bmiInfo ? getGoalRisk(form.healthGoal, bmiInfo.label, age, form.specialConditions) : null
    const alreadyAcknowledged =
      acknowledgedRisk?.goal === form.healthGoal && acknowledgedRisk?.bmiLabel === bmiInfo?.label
    if (risk && !alreadyAcknowledged) {
      setGoalWarning({ pendingGoal: form.healthGoal, risk, fromSubmit: true })
      return
    }

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
      setError('Vui lòng hoàn tất giới tính, ngày sinh, chiều cao, cân nặng và mức độ vận động để hệ thống tính toán chỉ số dinh dưỡng.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setSaving(true)
    try {
      const goal = form.healthGoal || 'maintain_weight'
      const finalTargetWeight =
        goal === 'maintain_weight' ? currentW : (form.targetWeightKg ? Number(form.targetWeightKg) : null)

      const payload = {
        ...form,
        targetWeightKg: finalTargetWeight,
        healthGoal: goal,
        acknowledgeUnsafeGoal: true,
        nutritionGoal: {
          goal,
          calorieTarget: activeCalorieTarget,
          macroPercentages: activeMacros,
          proteinG: typeof activeGrams.protein === 'number' ? activeGrams.protein : null,
          carbsG: typeof activeGrams.carbs === 'number' ? activeGrams.carbs : null,
          fatG: typeof activeGrams.fat === 'number' ? activeGrams.fat : null,
          customized,
          acknowledgeUnsafeGoal: true,
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
      <div className="dashboard-shell hp-shell">
        <UserHeader />
        <div className="hp-loading">
          <div className="hp-loading__spinner">
            <div className="hp-loading__ring" />
            <i className="bi bi-heart-pulse hp-loading__icon" />
          </div>
          <p className="hp-loading__text">Đang tải hồ sơ sức khỏe của bạn…</p>
        </div>
        <UserFooter />
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Main Render
  // ---------------------------------------------------------------------------
  return (
    <div className="dashboard-shell hp-shell">
      <UserHeader />

      <main className="hp-main">
        <section className="fs-page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span className="fs-page-icon"><i className="bi bi-person-gear" /></span>
            <div>
              <h1 style={{ margin: 0, color: '#0f172a', fontSize: '1.7rem', fontWeight: 750 }}>Hồ Sơ Cá Nhân &amp; Sức Khỏe</h1>
              <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.92rem' }}>
                Quản lý thông tin thể chất, tính toán tự động chỉ số BMI, BMR/TDEE y khoa và thiết lập mục tiêu dinh dưỡng cá nhân hóa.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Link to="/dashboard" className="wt-btn wt-btn--secondary" title="Quay lại Tổng quan">
              <i className="bi bi-arrow-left" /> Tổng quan
            </Link>
            <Link to="/weight-tracker" className="wt-btn wt-btn--secondary" title="Xem tiến trình cân nặng">
              <i className="bi bi-graph-up-arrow" /> Tiến trình cân nặng
            </Link>
          </div>
        </section>

        <div className="hp-banner">
          <i className="bi bi-shield-check" />
          <p>
            Dữ liệu này giúp NutriLens tự động tính toán nhu cầu năng lượng (BMR/TDEE) và cá nhân hóa thực đơn phù hợp nhất cho bạn.{' '}
            <strong>Thông tin mang tính tham khảo y khoa, không thay thế chẩn đoán hoặc chỉ định trực tiếp của bác sĩ chuyên khoa.</strong>
          </p>
        </div>

        <form className="hp-form" ref={formRef} onSubmit={handleSubmit} noValidate>
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

          {/* Section 1: Thông tin cá nhân */}
          <PersonalInfoSection
            form={form}
            displayAvatar={displayAvatar}
            uploadingAvatar={uploadingAvatar}
            imgError={imgError}
            setImgError={setImgError}
            updateAvatar={updateAvatar}
            updateField={updateField}
            isInvalid={isInvalid}
            submitted={submitted}
            setForm={setForm}
            setError={setError}
            setSuccess={setSuccess}
            dobDisplay={dobDisplay}
            handleDobChange={handleDobChange}
            handleDobBlur={handleDobBlur}
            age={age}
            getLocalDateValue={getLocalDateValue}
            isoToDisplayDate={isoToDisplayDate}
            PHONE_RE={PHONE_RE}
          />

          {/* Section 2: Chỉ số thể chất & BMI */}
          <BodyMetricsSection
            form={form}
            updateField={updateField}
            isInvalid={isInvalid}
            submitted={submitted}
            baselineStatus={baselineStatus}
            bmi={bmi}
            bmiInfo={bmiInfo}
            bmiTableView={bmiTableView}
            setBmiTableView={setBmiTableView}
            systemAdvice={systemAdvice}
            openMilestoneModal={openMilestoneModal}
          />

          {/* Section 3: Mức độ vận động & Tiêu hao năng lượng (TDEE) */}
          <ActivityLevelSection
            form={form}
            updateField={updateField}
            isInvalid={isInvalid}
            bmr={bmr}
            tdee={tdee}
          />

          {/* Section 4: Mục tiêu dinh dưỡng & Phân bổ năng lượng */}
          <NutritionGoalSection
            form={form}
            updateField={updateField}
            handleGoalChange={handleGoalChange}
            systemAdvice={systemAdvice}
            selectedGoalConfig={selectedGoalConfig}
            bmiInfo={bmiInfo}
            age={age}
            targetWeightConstraint={targetWeightConstraint}
            targetWeightBmiWarning={targetWeightBmiWarning}
            estimatedWeeks={estimatedWeeks}
            customized={customized}
            setCustomized={setCustomized}
            customForm={customForm}
            setCustomForm={setCustomForm}
            activeCalorieTarget={activeCalorieTarget}
            activeMacros={activeMacros}
            activeGrams={activeGrams}
            actualDeficit={actualDeficit}
            customWarnings={customWarnings}
            macroSum={macroSum}
            macroSumOk={macroSumOk}
            bmr={bmr}
            tdee={tdee}
          />

          <div className="hp-actions">
            <Link to="/dashboard" className="hp-actions__cancel">
              <i className="bi bi-arrow-left" /> Quay lại
            </Link>
            <button type="submit" className="hp-actions__save" disabled={saving}>
              {saving ? (
                <><div className="hp-spinner" /><span>Đang lưu hồ sơ…</span></>
              ) : (
                <><i className="bi bi-check2" /><span>Lưu hồ sơ &amp; Mục tiêu</span></>
              )}
            </button>
          </div>
        </form>
      </main>

      <UserFooter />

      <MilestoneReviewModal
        open={milestoneModalOpen}
        onClose={() => setMilestoneModalOpen(false)}
        baselineStatus={baselineStatus}
        milestoneForm={milestoneForm}
        setMilestoneForm={setMilestoneForm}
        handleApplyMilestone={handleApplyMilestone}
        applyingMilestone={applyingMilestone}
        milestoneError={milestoneError}
      />

      <UnsafeGoalModal
        goalWarning={goalWarning}
        setGoalWarning={setGoalWarning}
        goalWarningModalRef={goalWarningModalRef}
        confirmGoalWarning={confirmGoalWarning}
      />
    </div>
  )
}
