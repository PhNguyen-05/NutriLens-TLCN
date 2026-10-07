import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import axiosInstance from '../../api/axiosInstance'
import { userUpdated } from '../../store/slices/authSlice'

function getLocalDateValue() {
  const today = new Date()
  const offset = today.getTimezoneOffset() * 60_000
  return new Date(today.getTime() - offset).toISOString().slice(0, 10)
}

function formatLogDate(dateStr) {
  if (!dateStr) return ''
  const str = typeof dateStr === 'string' ? dateStr.slice(0, 10) : ''
  const [y, m, d] = str.split('-')
  if (!y || !m || !d) return str
  return `${d}/${m}/${y}`
}

function formatLogTime(timeVal) {
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

function getBmiInfo(weightKg, heightCm) {
  const w = Number(weightKg)
  const h = Number(heightCm)
  if (!w || !h || h <= 0) return null
  const bmi = Number((w / ((h / 100) ** 2)).toFixed(1))
  if (bmi < 18.5) return { bmi, label: 'Thiếu cân', color: '#3b82f6', bg: '#eff6ff' }
  if (bmi < 23) return { bmi, label: 'Bình thường', color: '#10b981', bg: '#ecfdf5' }
  if (bmi < 25) return { bmi, label: 'Thừa cân', color: '#f59e0b', bg: '#fffbeb' }
  return { bmi, label: 'Béo phì', color: '#ef4444', bg: '#fef2f2' }
}

function getSmoothPath(points) {
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

export default function WeightTrackerPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  const weightModalRef = useRef(null)

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [weightLogs, setWeightLogs] = useState([])
  const [timeframe, setTimeframe] = useState('14d') // '7d' | '14d' | '30d' | 'all'
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [weightForm, setWeightForm] = useState({ weightKg: '', recordedDate: getLocalDateValue() })
  const [weightError, setWeightError] = useState({ field: '', message: '' })
  const [savingWeight, setSavingWeight] = useState(false)
  const [confirmOverwrite, setConfirmOverwrite] = useState(false)
  const [weightDiffWarning, setWeightDiffWarning] = useState(false)

  // Delete confirm state
  const [deleteConfirmLog, setDeleteConfirmLog] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Edit history modal state (Phuong an 2)
  const [historyModalLog, setHistoryModalLog] = useState(null)

  // Baseline lock & Milestone modal state
  const [baselineStatus, setBaselineStatus] = useState(null)
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false)
  const [milestoneForm, setMilestoneForm] = useState({ weightKg: '' })
  const [applyingMilestone, setApplyingMilestone] = useState(false)
  const [milestoneError, setMilestoneError] = useState('')

  // Tooltip hover in chart
  const [activePoint, setActivePoint] = useState(null)

  // Load profile and logs
  useEffect(() => {
    let isActive = true
    async function loadData() {
      try {
        const [{ data: profileData }, { data: logsData }] = await Promise.all([
          axiosInstance.get('/profile'),
          axiosInstance.get('/profile/weight-logs'),
        ])
        if (!isActive) return
        setProfile(profileData.profile || {})
        setBaselineStatus(profileData.baselineStatus || logsData.baselineStatus || null)
        const sorted = (logsData.weightLogs || []).slice().sort((a, b) => a.recordedDate.localeCompare(b.recordedDate))
        setWeightLogs(sorted)
      } catch (err) {
        if (isActive) setError(err.response?.data?.message || 'Không thể tải dữ liệu theo dõi cân nặng')
      } finally {
        if (isActive) setLoading(false)
      }
    }
    loadData()
    return () => { isActive = false }
  }, [])

  // Esc / focus trap for modal
  useEffect(() => {
    if (!dialogOpen && !deleteConfirmLog && !historyModalLog && !milestoneModalOpen) return
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        if (dialogOpen) closeDialog()
        if (deleteConfirmLog) setDeleteConfirmLog(null)
        if (historyModalLog) setHistoryModalLog(null)
        if (milestoneModalOpen && !applyingMilestone) setMilestoneModalOpen(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [dialogOpen, deleteConfirmLog, historyModalLog, milestoneModalOpen, applyingMilestone])

  // Filter logs by timeframe
  const filteredLogs = useMemo(() => {
    if (!weightLogs.length) return []
    if (timeframe === 'all') return weightLogs

    const now = new Date()
    const days = timeframe === '7d' ? 7 : timeframe === '14d' ? 14 : 30
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const result = weightLogs.filter((l) => l.recordedDate >= cutoff)
    // If filtered is empty but we have logs, show at least the latest few
    return result.length ? result : weightLogs.slice(-5)
  }, [weightLogs, timeframe])

  // Stats summary calculations
  const stats = useMemo(() => {
    if (!weightLogs.length) {
      if (!profile?.currentWeightKg) return null
      const currentWeight = Number(profile.currentWeightKg)
      const targetWeight = profile?.targetWeightKg ? Number(profile.targetWeightKg) : null
      const heightCm = profile?.heightCm ? Number(profile.heightCm) : null
      const goal = profile?.healthGoal || profile?.nutritionGoal?.goal || 'maintain_weight'
      const bmiInfo = getBmiInfo(currentWeight, heightCm)
      const distanceToTarget = targetWeight ? Number(Math.abs(currentWeight - targetWeight).toFixed(1)) : null

      return {
        initialWeight: currentWeight,
        currentWeight,
        targetWeight,
        totalDiff: 0,
        distanceToTarget,
        progressPct: distanceToTarget === 0 ? 100 : 0,
        weeklyRate: null,
        bmiInfo,
        goal,
        totalLogs: 0,
        latestDate: profile?.currentWeightRecordedDate || null,
        latestTime: '',
      }
    }

    const initialLog = weightLogs[0]
    const latestLog = weightLogs[weightLogs.length - 1]
    const initialWeight = Number(initialLog.weightKg)
    const currentWeight = Number(latestLog.weightKg)
    const targetWeight = profile?.targetWeightKg ? Number(profile.targetWeightKg) : null
    const heightCm = profile?.heightCm ? Number(profile.heightCm) : null
    const goal = profile?.healthGoal || profile?.nutritionGoal?.goal || 'maintain_weight'

    const totalDiff = Number((currentWeight - initialWeight).toFixed(1))
    const bmiInfo = getBmiInfo(currentWeight, heightCm)

    // Distance to target
    let distanceToTarget = null
    let progressPct = null
    if (targetWeight && initialWeight !== targetWeight) {
      distanceToTarget = Number(Math.abs(currentWeight - targetWeight).toFixed(1))
      const totalSpan = Math.abs(targetWeight - initialWeight)
      const accomplished = totalSpan - distanceToTarget
      progressPct = Math.min(100, Math.max(0, Math.round((accomplished / totalSpan) * 100)))
    }

    // Weekly average rate
    let weeklyRate = null
    if (weightLogs.length >= 2) {
      const firstDate = new Date(initialLog.recordedDate).getTime()
      const lastDate = new Date(latestLog.recordedDate).getTime()
      const diffWeeks = (lastDate - firstDate) / (1000 * 60 * 60 * 24 * 7)
      if (diffWeeks >= 1) {
        weeklyRate = Number((totalDiff / diffWeeks).toFixed(2))
      }
    }

    const latestTime = formatLogTime(latestLog.loggedAt || latestLog.updatedAt || latestLog.createdAt) || latestLog.timeStr || ''

    return {
      initialWeight,
      currentWeight,
      targetWeight,
      totalDiff,
      distanceToTarget,
      progressPct,
      weeklyRate,
      bmiInfo,
      goal,
      totalLogs: weightLogs.length,
      latestDate: latestLog.recordedDate,
      latestTime,
    }
  }, [weightLogs, profile])

  // Sorted logs descending for table display
  const tableLogs = useMemo(() => {
    return [...weightLogs].reverse().map((log, index, arr) => {
      const nextLog = arr[index + 1] // chronological previous
      const currentW = Number(log.weightKg)
      const prevW = nextLog ? Number(nextLog.weightKg) : null
      const diff = prevW != null ? Number((currentW - prevW).toFixed(1)) : null
      const bmiInfo = getBmiInfo(currentW, profile?.heightCm)
      const formattedTime = formatLogTime(log.loggedAt || log.updatedAt || log.createdAt) || log.timeStr || ''
      return {
        ...log,
        diff,
        bmiInfo,
        formattedTime,
      }
    })
  }, [weightLogs, profile?.heightCm])

  // Dialog actions
  function openDialog(defaultDate = getLocalDateValue(), defaultWeight = '') {
    if (!profile?.heightCm) {
      setError('Bạn cần thiết lập hồ sơ sức khỏe (chiều cao, cân nặng cơ sở) trước khi có thể ghi nhận nhật ký cân nặng.')
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    const fallbackWeight = defaultWeight || (weightLogs.length ? weightLogs[weightLogs.length - 1].weightKg : profile?.currentWeightKg)
    setWeightForm({
      weightKg: String(fallbackWeight || ''),
      recordedDate: defaultDate,
    })
    setWeightError({ field: '', message: '' })
    setConfirmOverwrite(false)
    setWeightDiffWarning(false)
    setDialogOpen(true)
  }

  function closeDialog() {
    if (savingWeight) return
    setDialogOpen(false)
    setWeightError({ field: '', message: '' })
    setConfirmOverwrite(false)
    setWeightDiffWarning(false)
  }

  // Tự động mở hộp thoại ghi cân nếu được điều hướng từ Dashboard hoặc Hồ sơ
  useEffect(() => {
    if (!loading && location.state?.openLog) {
      openDialog(getLocalDateValue(), '')
      try {
        window.history.replaceState({}, document.title)
      } catch {
        // ignore
      }
    }
  }, [loading, location.state])

  async function handleSaveWeight(overwrite = false) {
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

    const targetDateStr = weightForm.recordedDate

    // Kiểm tra giới hạn số lần sửa nếu đã ghi nhận ngày này
    const existingForDate = weightLogs.find((l) => l.recordedDate === targetDateStr)
    if (existingForDate && (existingForDate.updateCount || 0) >= 5) {
      setWeightError({
        field: 'date',
        message: 'Bạn đã đạt giới hạn tối đa 5 lần cập nhật cân nặng trong ngày này. Vui lòng quay lại vào ngày mai.',
      })
      return
    }

    // Chặn cứng & cảnh báo mềm dựa trên bản ghi lân cận gần nhất
    const otherLogs = weightLogs.filter((l) => l.recordedDate !== targetDateStr)
    let nearestLog = null
    let minDayDiff = Infinity
    for (const l of otherLogs) {
      const dayDiff = Math.abs(
        (new Date(targetDateStr).getTime() - new Date(l.recordedDate).getTime()) / (1000 * 60 * 60 * 24)
      )
      if (dayDiff < minDayDiff) {
        minDayDiff = dayDiff
        nearestLog = l
      }
    }

    if (!nearestLog && profile?.currentWeightKg != null) {
      const baselineDate = (profile.currentWeightRecordedDate || profile.createdAt || new Date().toISOString()).slice(0, 10)
      const dayDiff = Math.abs(
        (new Date(targetDateStr).getTime() - new Date(baselineDate).getTime()) / (1000 * 60 * 60 * 24)
      )
      nearestLog = {
        weightKg: profile.currentWeightKg,
        recordedDate: baselineDate,
      }
      minDayDiff = dayDiff
    }

    if (nearestLog) {
      const diffKg = Math.abs(weightKg - Number(nearestLog.weightKg))
      // Chặn cứng 1: <= 1 ngày và > 5 kg
      if (minDayDiff <= 1.05 && diffKg > 5) {
        setWeightError({
          field: 'weight',
          message: `Chặn cứng: Biến động ${diffKg.toFixed(1)} kg trong vòng 1 ngày là không khả thi về mặt sinh lý (> 5 kg). Hệ thống từ chối ghi nhận để bảo vệ tính chính xác.`,
        })
        return
      }
      // Chặn cứng 2: <= 3 ngày và > 8 kg
      if (minDayDiff <= 3.05 && diffKg > 8) {
        setWeightError({
          field: 'weight',
          message: `Chặn cứng: Biến động ${diffKg.toFixed(1)} kg trong vòng 3 ngày vượt quá giới hạn an toàn (> 8 kg). Vui lòng kiểm tra lại số cân.`,
        })
        return
      }
      // Chặn cứng 3: <= 7 ngày và > 12 kg
      if (minDayDiff <= 7.05 && diffKg > 12) {
        setWeightError({
          field: 'weight',
          message: `Chặn cứng: Biến động ${diffKg.toFixed(1)} kg trong vòng 7 ngày vượt quá giới hạn an toàn (> 12 kg). Vui lòng kiểm tra lại số cân.`,
        })
        return
      }

      // Cảnh báo mềm: <= 1 ngày và chênh lệch 3–5 kg
      if (!weightDiffWarning && !overwrite && minDayDiff <= 1.05 && diffKg >= 3) {
        setWeightDiffWarning({ diffKg: Number(diffKg.toFixed(1)), lastWeight: nearestLog.weightKg })
        return
      }
    }

    setSavingWeight(true)
    setWeightError({ field: '', message: '' })
    try {
      const { data } = await axiosInstance.post('/profile/weight-logs', { ...weightForm, overwrite })
      const newLog = data.weightLog
      setWeightLogs((curr) => {
        const filtered = curr.filter((l) => l.recordedDate !== newLog.recordedDate)
        return [...filtered, newLog].sort((a, b) => a.recordedDate.localeCompare(b.recordedDate))
      })
      if (data.baselineStatus) {
        setBaselineStatus(data.baselineStatus)
      }
      if (data.canReviewMilestone) {
        setSuccess(`Đã ghi nhận ${newLog.weightKg} kg. 🎉 Bạn đã hoàn thành chu kỳ 14 ngày! Hãy cập nhật mốc cân nặng để tính lại mục tiêu Calo.`)
      } else {
        setSuccess(`Đã ghi nhận ${newLog.weightKg} kg cho ngày ${formatLogDate(newLog.recordedDate)}.`)
      }
      closeDialog()
      setTimeout(() => setSuccess(''), 5000)
    } catch (err) {
      if (err.response?.data?.code === 'WEIGHT_LOG_EXISTS') {
        setConfirmOverwrite({
          currentUpdateCount: err.response.data.currentUpdateCount || 0,
          remainingUpdates: err.response.data.remainingUpdates ?? (5 - (err.response.data.currentUpdateCount || 0)),
        })
      } else if (err.response?.data?.code === 'DAILY_UPDATE_LIMIT_EXCEEDED') {
        setWeightError({
          field: 'date',
          message: err.response.data.message || 'Bạn đã đạt giới hạn tối đa 5 lần cập nhật cân nặng trong ngày này.',
        })
      } else if (err.response?.data?.code === 'UNREALISTIC_WEIGHT_CHANGE') {
        setWeightError({
          field: 'weight',
          message: err.response.data.message || 'Chênh lệch cân nặng không hợp lý.',
        })
      } else {
        setWeightError({ field: 'weight', message: err.response?.data?.message || 'Không thể lưu bản ghi cân nặng' })
      }
    } finally {
      setSavingWeight(false)
    }
  }

  async function handleDeleteLog(logId) {
    if (!logId) return
    setDeleting(true)
    try {
      const { data } = await axiosInstance.delete(`/profile/weight-logs/${logId}`)
      setWeightLogs((curr) => curr.filter((l) => (l._id || l.id) !== logId))
      if (data.weightProfileUpdated && data.profile) {
        setProfile(data.profile)
      }
      if (data.baselineStatus) {
        setBaselineStatus(data.baselineStatus)
      }
      setSuccess('Đã xóa bản ghi cân nặng')
      setDeleteConfirmLog(null)
      setTimeout(() => setSuccess(''), 4000)
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể xóa bản ghi cân nặng')
    } finally {
      setDeleting(false)
    }
  }

  function openMilestoneModal() {
    const latestWeight = weightLogs.length ? weightLogs[weightLogs.length - 1].weightKg : (profile?.currentWeightKg || '')
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
      setProfile(data.profile)
      setBaselineStatus(data.baselineStatus)
      dispatch(userUpdated(data.profile))
      setMilestoneModalOpen(false)
      setSuccess('Cập nhật mốc cân nặng và thiết lập chu kỳ 14 ngày mới thành công!')
      setTimeout(() => setSuccess(''), 4000)
      const { data: logsData } = await axiosInstance.get('/profile/weight-logs')
      const sorted = (logsData.weightLogs || []).slice().sort((a, b) => a.recordedDate.localeCompare(b.recordedDate))
      setWeightLogs(sorted)
    } catch (err) {
      setMilestoneError(err.response?.data?.message || 'Không thể cập nhật mốc cân nặng, vui lòng thử lại')
    } finally {
      setApplyingMilestone(false)
    }
  }

  // Render SVG Chart Points
  const chartData = useMemo(() => {
    if (!filteredLogs.length) return null
    const weights = filteredLogs.map((l) => Number(l.weightKg))
    let minW = Math.min(...weights)
    let maxW = Math.max(...weights)
    const targetW = stats?.targetWeight ? Number(stats.targetWeight) : null

    // Gộp mục tiêu vào dải đo nếu ở cự ly hợp lý để người dùng luôn thấy đường mốc mục tiêu
    if (targetW && targetW >= minW - 15 && targetW <= maxW + 15) {
      minW = Math.min(minW, targetW)
      maxW = Math.max(maxW, targetW)
    }

    const rawSpan = maxW - minW
    const padding = Math.max(rawSpan * 0.22, 1.2)
    const step = rawSpan <= 3 ? 0.5 : 1
    const lower = Number((Math.floor((minW - padding) / step) * step).toFixed(1))
    const upper = Number((Math.ceil((maxW + padding) / step) * step).toFixed(1))
    const range = upper - lower || 1

    const width = 800
    const height = 280
    const paddingLeft = 56
    const paddingRight = 44
    const paddingTop = 30
    const paddingBottom = 42
    const plotWidth = width - paddingLeft - paddingRight
    const plotHeight = height - paddingTop - paddingBottom

    const firstLog = filteredLogs[0]
    const latestLog = filteredLogs[filteredLogs.length - 1]
    const periodDiff = Number((Number(latestLog.weightKg) - Number(firstLog.weightKg)).toFixed(1))

    let minLog = filteredLogs[0]
    let maxLog = filteredLogs[0]
    for (const l of filteredLogs) {
      if (Number(l.weightKg) < Number(minLog.weightKg)) minLog = l
      if (Number(l.weightKg) > Number(maxLog.weightKg)) maxLog = l
    }

    // 5 mốc lưới đều đặn
    const gridSteps = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
      const val = Number((lower + range * (1 - ratio)).toFixed(1))
      const y = paddingTop + plotHeight * ratio
      return { val, y, isAxis: ratio === 1 }
    })

    // Đường mốc mục tiêu
    let targetY = null
    if (targetW && targetW >= lower && targetW <= upper) {
      targetY = paddingTop + plotHeight - ((targetW - lower) / range) * plotHeight
    }

    // Trường hợp người dùng mới có 1 bản ghi
    if (filteredLogs.length === 1) {
      const log = filteredLogs[0]
      const w = Number(log.weightKg)
      const y = paddingTop + plotHeight / 2
      const x = paddingLeft + plotWidth / 2
      const bmiInfo = getBmiInfo(w, profile?.heightCm)
      return {
        width,
        height,
        lower,
        upper,
        points: [{ x, y, log, isFirst: true, isLatest: true, isLowest: true, isHighest: true, bmiInfo, showDate: true, dateAnchor: 'middle', dateX: x }],
        pathD: '',
        areaD: '',
        targetY,
        paddingLeft,
        paddingRight,
        paddingTop,
        paddingBottom,
        plotHeight,
        plotWidth,
        isSinglePoint: true,
        periodDiff: 0,
        minLog: log,
        maxLog: log,
        gridSteps,
      }
    }

    const dates = filteredLogs.map((l) => new Date(l.recordedDate.slice(0, 10) + 'T00:00:00').getTime())
    const minDate = Math.min(...dates)
    const maxDate = Math.max(...dates)
    const dateRange = maxDate - minDate || 1

    const points = filteredLogs.map((log, idx) => {
      const t = new Date(log.recordedDate.slice(0, 10) + 'T00:00:00').getTime()
      const x = paddingLeft + ((t - minDate) / dateRange) * plotWidth
      const w = Number(log.weightKg)
      const y = paddingTop + plotHeight - ((w - lower) / range) * plotHeight

      const prevLog = idx > 0 ? filteredLogs[idx - 1] : null
      const diffFromPrev = prevLog ? Number((w - Number(prevLog.weightKg)).toFixed(1)) : null
      const diffFromBaseline = stats?.initialWeight != null ? Number((w - stats.initialWeight).toFixed(1)) : null
      const bmiInfo = getBmiInfo(w, profile?.heightCm)

      return {
        x,
        y,
        log,
        isFirst: idx === 0,
        isLatest: idx === filteredLogs.length - 1,
        isLowest: w === Number(minLog.weightKg),
        isHighest: w === Number(maxLog.weightKg),
        diffFromPrev,
        diffFromBaseline,
        bmiInfo,
      }
    })

    // Thuật toán chống đè nhãn ngày trục X (Collision-free X-axis label positioning)
    const LABEL_WIDTH = 64
    const MIN_LABEL_GAP = 14

    if (points.length === 1) {
      points[0].showDate = true
      points[0].dateAnchor = 'middle'
      points[0].dateX = points[0].x
    } else if (points.length > 1) {
      const n = points.length
      const firstPt = points[0]
      const lastPt = points[n - 1]

      // Nhãn cuối cùng (hôm nay / mới nhất) luôn được ưu tiên cao nhất
      lastPt.showDate = true
      lastPt.dateAnchor = 'end'
      lastPt.dateX = Math.min(lastPt.x, width - paddingRight)
      const lastInterval = [lastPt.dateX - LABEL_WIDTH, lastPt.dateX]

      // Nhãn đầu tiên (ngày bắt đầu) được ưu tiên số 2
      firstPt.dateAnchor = 'start'
      firstPt.dateX = Math.max(firstPt.x, paddingLeft)
      const firstInterval = [firstPt.dateX, firstPt.dateX + LABEL_WIDTH]

      // Kiểm tra nếu nhãn đầu và nhãn cuối bị đè nhau
      if (firstInterval[1] + MIN_LABEL_GAP > lastInterval[0]) {
        firstPt.showDate = false
      } else {
        firstPt.showDate = true
      }

      const occupiedIntervals = []
      if (firstPt.showDate) occupiedIntervals.push(firstInterval)
      occupiedIntervals.push(lastInterval)

      // Xử lý các điểm ở giữa (từ 1 đến n - 2)
      const step = n > 12 ? Math.ceil(n / 6) : 1
      for (let i = 1; i < n - 1; i += step) {
        const pt = points[i]
        pt.dateAnchor = 'middle'
        pt.dateX = pt.x
        const candidateInterval = [pt.dateX - LABEL_WIDTH / 2, pt.dateX + LABEL_WIDTH / 2]

        const hasCollision = occupiedIntervals.some(
          ([start, end]) => candidateInterval[0] < end + MIN_LABEL_GAP && candidateInterval[1] + MIN_LABEL_GAP > start
        )

        if (!hasCollision) {
          pt.showDate = true
          occupiedIntervals.push(candidateInterval)
        } else {
          pt.showDate = false
        }
      }

      points.forEach((pt) => {
        if (pt.showDate === undefined) pt.showDate = false
      })
    }

    const pathD = getSmoothPath(points)
    const baselineY = paddingTop + plotHeight
    const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)},${baselineY.toFixed(1)} L ${points[0].x.toFixed(1)},${baselineY.toFixed(1)} Z`

    return {
      width,
      height,
      lower,
      upper,
      points,
      pathD,
      areaD,
      targetY,
      paddingLeft,
      paddingRight,
      paddingTop,
      paddingBottom,
      plotHeight,
      plotWidth,
      isSinglePoint: false,
      periodDiff,
      minLog,
      maxLog,
      gridSteps,
    }
  }, [filteredLogs, stats?.targetWeight, stats?.initialWeight, profile?.heightCm])

  if (loading) {
    return (
      <div className="hp-loading">
        <div className="hp-loading__spinner">
          <div className="hp-loading__ring" />
          <i className="bi bi-speedometer2 hp-loading__icon" />
        </div>
        <p className="hp-loading__text">Đang tải dữ liệu cân nặng…</p>
      </div>
    )
  }

  return (
    <div className="wt-shell">
      <header className="wt-topbar">
        <div className="wt-topbar__inner">
          <div className="wt-topbar__left">
            <Link to="/dashboard" className="wt-back" title="Quay lại Trang chủ">
              <i className="bi bi-arrow-left" />
            </Link>
            <div>
              <span className="wt-eyebrow">
                <i className="bi bi-activity" /> NutriLens Progress
              </span>
              <h1>Theo dõi Cân nặng &amp; Tiến trình</h1>
            </div>
          </div>
          <div className="wt-topbar__actions">
            <Link to="/profile" className="wt-btn wt-btn--secondary" title="Xem hồ sơ & mục tiêu sức khỏe">
              <i className="bi bi-person-gear" /> Hồ sơ dinh dưỡng
            </Link>
            <button
              type="button"
              className="wt-btn wt-btn--primary"
              onClick={() => openDialog()}
            >
              <i className="bi bi-plus-circle-fill" /> Ghi nhận cân nặng
            </button>
          </div>
        </div>
      </header>

      <main className="wt-main">
        {/* Alerts */}
        {error && (
          <div className="wt-alert wt-alert--error" role="alert">
            <i className="bi bi-exclamation-triangle-fill" />
            <span>{error}</span>
            <button type="button" onClick={() => setError('')}><i className="bi bi-x" /></button>
          </div>
        )}
        {success && (
          <div className="wt-alert wt-alert--success" role="status">
            <i className="bi bi-check-circle-fill" />
            <span>{success}</span>
            <button type="button" onClick={() => setSuccess('')}><i className="bi bi-x" /></button>
          </div>
        )}

        {/* ── Banner cảnh báo chưa hoàn tất hồ sơ cơ sở ── */}
        {!profile?.heightCm && (
          <div className="wt-profile-missing-banner" role="region" aria-label="Chưa thiết lập hồ sơ">
            <div className="wt-profile-missing-banner__left">
              <div className="wt-profile-missing-banner__icon">
                <i className="bi bi-info-circle-fill" />
              </div>
              <div>
                <strong>Chưa hoàn tất hồ sơ sức khỏe cơ sở</strong>
                <p>
                  Vui lòng cập nhật chiều cao, cân nặng mốc và mục tiêu dinh dưỡng để hệ thống tính toán chính xác BMI, TDEE và theo dõi tiến trình của bạn.
                </p>
              </div>
            </div>
            <Link to="/profile" className="wt-profile-missing-banner__btn">
              <i className="bi bi-person-gear" /> Thiết lập ngay →
            </Link>
          </div>
        )}

        {/* ── Banner đánh giá chu kỳ 14 ngày (Tùy chọn 2) ── */}
        {baselineStatus?.canReviewMilestone && (
          <div className="wt-milestone-banner" role="region" aria-label="Đánh giá chu kỳ 14 ngày">
            <div className="wt-milestone-banner__left">
              <div className="wt-milestone-banner__icon">
                <i className="bi bi-trophy-fill" />
              </div>
              <div>
                <strong>Đã hoàn thành chu kỳ 14 ngày!</strong>
                <p>
                  Đã hết chu kỳ 14 ngày! Bạn có muốn cập nhật lại chỉ số mốc và tính lại mục tiêu Calo không?
                </p>
              </div>
            </div>
            <button
              type="button"
              className="wt-milestone-banner__btn"
              onClick={openMilestoneModal}
            >
              <i className="bi bi-arrow-repeat" /> Cập nhật mốc mới
            </button>
          </div>
        )}

        {baselineStatus?.isLocked && (
          <div className="wt-cycle-status-strip">
            <i className="bi bi-lock-fill" />
            <span>
              Cân nặng mốc trong hồ sơ ({profile?.currentWeightKg} kg) đang được bảo lưu chu kỳ 14 ngày (còn {baselineStatus.daysRemaining} ngày để cơ thể thích nghi trước khi đánh giá lại).
            </span>
          </div>
        )}

        {baselineStatus?.inGracePeriod && (
          <div className="wt-cycle-status-strip wt-cycle-status-strip--grace">
            <i className="bi bi-clock-history" />
            <span>
              Khoảng ân hạn sửa nhầm số cân mốc trong hồ sơ: còn <strong>{baselineStatus.hoursRemainingInGrace} giờ</strong>.
            </span>
          </div>
        )}

        {/* ── KPI Cards ── */}
        <section className="wt-kpi-grid">
          {/* Card 1: Cân nặng mới nhất trong nhật ký */}
          <article className="wt-kpi-card wt-kpi-card--current">
            <div className="wt-kpi-card__header">
              <span>Cân nặng mới nhất</span>
              <i className="bi bi-speedometer2" />
            </div>
            <div className="wt-kpi-card__val">
              <strong>{stats?.currentWeight ?? profile?.currentWeightKg ?? '—'}</strong>
              <small>kg</small>
            </div>
            <div className="wt-kpi-card__sub">
              {stats?.bmiInfo ? (
                <span className="wt-badge" style={{ backgroundColor: stats.bmiInfo.bg, color: stats.bmiInfo.color }}>
                  BMI {stats.bmiInfo.bmi} • {stats.bmiInfo.label}
                </span>
              ) : (
                <span className="text-muted">Chưa có dữ liệu BMI</span>
              )}
              {stats?.latestDate && (
                <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '4px' }}>
                  <i className="bi bi-clock" /> Ghi nhận: {formatLogDate(stats.latestDate)} {stats.latestTime ? `lúc ${stats.latestTime}` : ''}
                </div>
              )}
            </div>
          </article>

          {/* Card 2: Thay đổi tổng cộng */}
          <article className="wt-kpi-card wt-kpi-card--change">
            <div className="wt-kpi-card__header">
              <span>Thay đổi tổng cộng</span>
              <i className="bi bi-arrow-left-right" />
            </div>
            <div className="wt-kpi-card__val">
              <strong className={stats?.totalDiff && stats.totalDiff < 0 ? 'is-down' : stats?.totalDiff && stats.totalDiff > 0 ? 'is-up' : ''}>
                {stats?.totalDiff ? (stats.totalDiff > 0 ? `+${stats.totalDiff}` : stats.totalDiff) : '0.0'}
              </strong>
              <small>kg</small>
            </div>
            <div className="wt-kpi-card__sub">
              <span>Bắt đầu: <b>{stats?.initialWeight ?? '—'} kg</b> ({formatLogDate(weightLogs[0]?.recordedDate || profile?.currentWeightRecordedDate || profile?.createdAt) || '—'})</span>
            </div>
          </article>

          {/* Card 3: Mục tiêu */}
          <article className="wt-kpi-card wt-kpi-card--target">
            <div className="wt-kpi-card__header">
              <span>Cân nặng mục tiêu</span>
              <i className="bi bi-bullseye" />
            </div>
            <div className="wt-kpi-card__val">
              <strong>{stats?.targetWeight ?? '—'}</strong>
              <small>kg</small>
            </div>
            <div className="wt-kpi-card__sub">
              {stats?.distanceToTarget != null ? (
                stats.distanceToTarget === 0 ? (
                  <span className="wt-badge wt-badge--green"><i className="bi bi-check2" /> Đã đạt mục tiêu!</span>
                ) : (
                  <span>Còn cách: <b>{stats.distanceToTarget} kg</b> {stats.progressPct != null && `(${stats.progressPct}%)`}</span>
                )
              ) : (
                <Link to="/profile" className="wt-link-small">Thiết lập mục tiêu trong hồ sơ →</Link>
              )}
            </div>
          </article>

          {/* Card 4: Tốc độ thay đổi */}
          <article className="wt-kpi-card wt-kpi-card--rate">
            <div className="wt-kpi-card__header">
              <span>Tốc độ trung bình</span>
              <i className="bi bi-graph-up-arrow" />
            </div>
            <div className="wt-kpi-card__val">
              <strong>{stats?.weeklyRate != null ? (stats.weeklyRate > 0 ? `+${stats.weeklyRate}` : stats.weeklyRate) : '—'}</strong>
              <small>kg/tuần</small>
            </div>
            <div className="wt-kpi-card__sub">
              <small className="text-muted">
                {stats?.weeklyRate != null
                  ? Math.abs(stats.weeklyRate) <= 0.75
                    ? '✦ Tốc độ an toàn, lành mạnh'
                    : '⚠ Tốc độ thay đổi tương đối nhanh'
                  : 'Cần ít nhất 2 bản ghi cách 1 tuần'}
              </small>
            </div>
          </article>
        </section>

        {/* ── Chart Section ── */}
        <section className="wt-card wt-chart-section">
          <div className="wt-chart-section__header">
            <div>
              <h2>Biểu đồ xu hướng cân nặng</h2>
              <p>Trực quan hóa sự biến thiên cân nặng theo chu kỳ ghi nhận</p>
            </div>
            <div className="wt-timeframe-selector" role="group" aria-label="Khoảng thời gian biểu đồ">
              <button
                type="button"
                className={`wt-tf-btn ${timeframe === '7d' ? 'is-active' : ''}`}
                onClick={() => setTimeframe('7d')}
              >
                7 ngày
              </button>
              <button
                type="button"
                className={`wt-tf-btn ${timeframe === '14d' ? 'is-active' : ''}`}
                onClick={() => setTimeframe('14d')}
              >
                14 ngày
              </button>
              <button
                type="button"
                className={`wt-tf-btn ${timeframe === '30d' ? 'is-active' : ''}`}
                onClick={() => setTimeframe('30d')}
              >
                30 ngày
              </button>
              <button
                type="button"
                className={`wt-tf-btn ${timeframe === 'all' ? 'is-active' : ''}`}
                onClick={() => setTimeframe('all')}
              >
                Tất cả ({weightLogs.length})
              </button>
            </div>
          </div>

          {/* Quick Insights Strip */}
          {chartData && (
            <div className="wt-chart-stat-strip">
              <div className="wt-stat-chip">
                <span className="wt-stat-chip__label">Thay đổi kỳ này</span>
                <span className={`wt-stat-chip__val ${chartData.periodDiff < 0 ? 'is-down' : chartData.periodDiff > 0 ? 'is-up' : ''}`}>
                  {chartData.periodDiff > 0 ? `+${chartData.periodDiff}` : chartData.periodDiff} kg
                  {chartData.periodDiff < 0 ? (
                    <i className="bi bi-arrow-down-right" />
                  ) : chartData.periodDiff > 0 ? (
                    <i className="bi bi-arrow-up-right" />
                  ) : (
                    <i className="bi bi-dash" />
                  )}
                </span>
              </div>

              <div className="wt-stat-chip">
                <span className="wt-stat-chip__label">Thấp nhất kỳ</span>
                <span className="wt-stat-chip__val is-min">
                  {chartData.minLog.weightKg} kg
                  <small>({formatLogDate(chartData.minLog.recordedDate)})</small>
                </span>
              </div>

              <div className="wt-stat-chip">
                <span className="wt-stat-chip__label">Cao nhất kỳ</span>
                <span className="wt-stat-chip__val is-max">
                  {chartData.maxLog.weightKg} kg
                  <small>({formatLogDate(chartData.maxLog.recordedDate)})</small>
                </span>
              </div>

              {stats?.targetWeight ? (
                <div className="wt-stat-chip">
                  <span className="wt-stat-chip__label">Mục tiêu</span>
                  <span className="wt-stat-chip__val is-target">
                    {stats.targetWeight} kg
                    {stats.distanceToTarget != null && (
                      <small>
                        ({stats.distanceToTarget === 0 ? 'Đã đạt! 🎉' : `còn ${stats.distanceToTarget} kg`})
                      </small>
                    )}
                  </span>
                </div>
              ) : (
                <div className="wt-stat-chip">
                  <span className="wt-stat-chip__label">Mốc ban đầu</span>
                  <span className="wt-stat-chip__val">
                    {stats?.initialWeight ?? '-'} kg
                    <small>({formatLogDate(weightLogs[0]?.recordedDate) || '-'})</small>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Chart Display */}
          {chartData ? (
            <div className="wt-chart-container" onMouseLeave={() => setActivePoint(null)}>
              <svg
                className="wt-svg-chart"
                viewBox={`0 0 ${chartData.width} ${chartData.height}`}
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label="Biểu đồ tiến trình cân nặng"
              >
                <defs>
                  <linearGradient id="wtChartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                  <filter id="wtPointGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#10b981" floodOpacity="0.45" />
                  </filter>
                  <filter id="wtActiveGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#059669" floodOpacity="0.65" />
                  </filter>
                </defs>

                {/* Gridlines & Y-axis Labels */}
                {chartData.gridSteps.map((step, idx) => (
                  <g key={`grid-${idx}`}>
                    <line
                      x1={chartData.paddingLeft}
                      y1={step.y}
                      x2={chartData.width - chartData.paddingRight}
                      y2={step.y}
                      className={step.isAxis ? 'wt-chart-axis' : 'wt-chart-grid'}
                    />
                    <text
                      x={chartData.paddingLeft - 10}
                      y={step.y + 4}
                      textAnchor="end"
                      className="wt-chart-tick"
                    >
                      {step.val} kg
                    </text>
                  </g>
                ))}

                {/* Target Weight Reference Line & Pill Badge */}
                {chartData.targetY != null && (
                  <g className="wt-target-line-group">
                    <line
                      x1={chartData.paddingLeft}
                      y1={chartData.targetY}
                      x2={chartData.width - chartData.paddingRight}
                      y2={chartData.targetY}
                      className="wt-target-line"
                    />
                    <rect
                      x={chartData.width - chartData.paddingRight - 138}
                      y={chartData.targetY - 12}
                      width="138"
                      height="22"
                      rx="11"
                      className="wt-target-pill-bg"
                    />
                    <text
                      x={chartData.width - chartData.paddingRight - 69}
                      y={chartData.targetY + 3}
                      textAnchor="middle"
                      className="wt-target-pill-text"
                    >
                      🎯 Mục tiêu: {stats.targetWeight} kg
                    </text>
                  </g>
                )}

                {/* Area Gradient Fill */}
                {chartData.areaD && (
                  <path d={chartData.areaD} fill="url(#wtChartGrad)" />
                )}

                {/* Smooth Curve Polyline */}
                {chartData.pathD && (
                  <path d={chartData.pathD} className="wt-chart-line" />
                )}

                {/* Single Point Guideline and Hint */}
                {chartData.isSinglePoint && (
                  <g>
                    <line
                      x1={chartData.paddingLeft}
                      y1={chartData.points[0].y}
                      x2={chartData.width - chartData.paddingRight}
                      y2={chartData.points[0].y}
                      className="wt-single-guideline"
                    />
                    <text
                      x={chartData.width / 2}
                      y={chartData.points[0].y + 42}
                      textAnchor="middle"
                      className="wt-single-point-hint"
                    >
                      ✨ Ghi nhận thêm các ngày tiếp theo để NutriLens tự động vẽ đường xu hướng sinh học!
                    </text>
                  </g>
                )}

                {/* Interactive Crosshair Line */}
                {activePoint && (
                  <line
                    x1={activePoint.x}
                    y1={chartData.paddingTop}
                    x2={activePoint.x}
                    y2={chartData.paddingTop + chartData.plotHeight}
                    className="wt-chart-crosshair"
                  />
                )}

                {/* Latest Point Floating Callout Pill */}
                {!chartData.isSinglePoint && chartData.points.length > 1 && (() => {
                  const latestPt = chartData.points[chartData.points.length - 1]
                  const isNearRight = latestPt.x > chartData.width - chartData.paddingRight - 50
                  const shiftX = isNearRight ? -28 : 0
                  const badgeY = Math.max(chartData.paddingTop + 14, latestPt.y - 18)
                  return (
                    <g className="wt-latest-callout-group" transform={`translate(${latestPt.x + shiftX}, ${badgeY})`}>
                      <rect
                        x="-36"
                        y="-12"
                        width="72"
                        height="20"
                        rx="10"
                        className="wt-latest-callout-bg"
                      />
                      <text
                        x="0"
                        y="2"
                        textAnchor="middle"
                        className="wt-latest-callout-text"
                      >
                        {latestPt.log.weightKg} kg
                      </text>
                    </g>
                  )
                })()}

                {/* Data Points */}
                {chartData.points.map((pt, idx) => {
                  const { x, y, log, isLatest, showDate, dateAnchor, dateX } = pt
                  const isHovered = activePoint?.log?._id === log._id || activePoint?.log?.recordedDate === log.recordedDate

                  return (
                    <g key={log._id || log.id || idx}>
                      {/* Pulse halo on latest point */}
                      {isLatest && (
                        <circle
                          cx={x}
                          cy={y}
                          r={isHovered ? 14 : 10}
                          className="wt-latest-halo"
                        />
                      )}

                      {/* Main point circle */}
                      <circle
                        cx={x}
                        cy={y}
                        r={isHovered ? 7.5 : isLatest ? 5.5 : 4.5}
                        className={`wt-chart-point ${isHovered ? 'is-active' : ''} ${isLatest ? 'is-latest' : ''}`}
                        filter={isHovered ? 'url(#wtActiveGlow)' : 'url(#wtPointGlow)'}
                        onMouseEnter={() => setActivePoint(pt)}
                        onClick={() => openDialog(log.recordedDate.slice(0, 10), log.weightKg)}
                      />

                      {/* X-axis Date Label */}
                      {showDate && (
                        <text
                          x={dateX ?? x}
                          y={chartData.height - 12}
                          textAnchor={dateAnchor || (idx === 0 ? 'start' : idx === chartData.points.length - 1 ? 'end' : 'middle')}
                          className={`wt-chart-datelabel ${isLatest ? 'is-latest' : ''}`}
                        >
                          {formatLogDate(log.recordedDate)}
                        </text>
                      )}
                    </g>
                  )
                })}
              </svg>

              {/* Enhanced Floating Tooltip Card */}
              {activePoint && (
                <div
                  className="wt-chart-tooltip"
                  style={{
                    left: `${Math.min(88, Math.max(12, (activePoint.x / chartData.width) * 100))}%`,
                    top: `${(activePoint.y / chartData.height) * 100}%`,
                  }}
                >
                  <div className="wt-tooltip__header">
                    <span className="wt-tooltip__date">
                      <i className="bi bi-calendar3" /> {formatLogDate(activePoint.log.recordedDate)}
                    </span>
                    {formatLogTime(activePoint.log.loggedAt || activePoint.log.updatedAt || activePoint.log.createdAt) || activePoint.log.timeStr ? (
                      <span className="wt-tooltip__time">
                        <i className="bi bi-clock" /> {formatLogTime(activePoint.log.loggedAt || activePoint.log.updatedAt || activePoint.log.createdAt) || activePoint.log.timeStr}
                      </span>
                    ) : null}
                  </div>

                  <div className="wt-tooltip__body">
                    <div className="wt-tooltip__weight">
                      <strong>{activePoint.log.weightKg}</strong>
                      <span>kg</span>
                    </div>
                    {activePoint.bmiInfo && (
                      <span
                        className="wt-tooltip__bmi"
                        style={{ color: activePoint.bmiInfo.color, backgroundColor: activePoint.bmiInfo.bg }}
                      >
                        {activePoint.bmiInfo.label}
                      </span>
                    )}
                  </div>

                  <div className="wt-tooltip__comparisons">
                    {activePoint.diffFromPrev != null && (
                      <div className="wt-tooltip__row">
                        <span>Lần trước:</span>
                        <span className={activePoint.diffFromPrev > 0 ? 'wt-diff--up' : activePoint.diffFromPrev < 0 ? 'wt-diff--down' : 'wt-diff--neutral'}>
                          {activePoint.diffFromPrev > 0 ? `+${activePoint.diffFromPrev}` : activePoint.diffFromPrev} kg
                        </span>
                      </div>
                    )}
                    {activePoint.diffFromBaseline != null && (
                      <div className="wt-tooltip__row">
                        <span>Mốc ban đầu:</span>
                        <span className={activePoint.diffFromBaseline > 0 ? 'wt-diff--up' : activePoint.diffFromBaseline < 0 ? 'wt-diff--down' : 'wt-diff--neutral'}>
                          {activePoint.diffFromBaseline > 0 ? `+${activePoint.diffFromBaseline}` : activePoint.diffFromBaseline} kg
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="wt-tooltip__footer">
                    <i className="bi bi-pencil-square" /> Nhấp để chỉnh sửa hoặc xem chi tiết
                  </div>
                </div>
              )}

              {/* Chart Legend & Tips */}
              <div className="wt-chart-legend">
                <span className="wt-chart-legend__item">
                  <span className="wt-chart-legend__dot wt-chart-legend__dot--actual" /> Đường xu hướng cân nặng
                </span>
                {stats?.targetWeight && (
                  <span className="wt-chart-legend__item">
                    <span className="wt-chart-legend__line wt-chart-legend__line--target" /> Mốc mục tiêu ({stats.targetWeight} kg)
                  </span>
                )}
                <span className="wt-chart-legend__item wt-chart-legend__hint">
                  <i className="bi bi-cursor-fill" /> Rê chuột hoặc chạm điểm để xem chi tiết
                </span>
              </div>
            </div>
          ) : (
            <div className="wt-empty-chart">
              <i className="bi bi-clipboard2-pulse" />
              <p>Chưa có dữ liệu cân nặng trong khoảng thời gian này.</p>
              <button type="button" className="wt-btn wt-btn--primary" onClick={() => openDialog()}>
                Ghi nhận số cân đầu tiên
              </button>
            </div>
          )}
        </section>

        {/* ── History Table Section ── */}
        <section className="wt-card wt-history-section">
          <div className="wt-history-section__header">
            <div>
              <h2>Nhật ký lịch sử cân nặng</h2>
              <p>Danh sách các lần bạn đã ghi nhận số cân thực tế</p>
            </div>
            <span className="wt-badge wt-badge--neutral">
              Tổng cộng {tableLogs.length} bản ghi
            </span>
          </div>

          {tableLogs.length > 0 ? (
            <div className="wt-table-wrap">
              <table className="wt-table">
                <thead>
                  <tr>
                    <th>Thời gian ghi nhận</th>
                    <th>Cân nặng</th>
                    <th>Biến động</th>
                    <th>Chỉ số BMI</th>
                    <th className="text-end">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {tableLogs.map((log) => {
                    const isToday = log.recordedDate.slice(0, 10) === getLocalDateValue()
                    const logId = log._id || log.id
                    return (
                      <tr key={logId || log.recordedDate}>
                        <td className="wt-cell-date">
                          <div className="wt-cell-datetime">
                            <div className="wt-cell-datetime-row">
                              <strong className="wt-date-main">{formatLogDate(log.recordedDate)}</strong>
                              {isToday && <span className="wt-pill-today">Hôm nay</span>}
                              {log.updateCount > 0 && (
                                <button
                                  type="button"
                                  className="wt-pill-edited wt-pill-edited--btn"
                                  title="Bấm để xem lịch sử các lần sửa của ngày này"
                                  onClick={() => setHistoryModalLog(log)}
                                >
                                  <i className="bi bi-clock-history" /> Sửa {log.updateCount}/5
                                </button>
                              )}
                            </div>
                            <span className="wt-time-badge" title="Giờ ghi nhận">
                              <i className="bi bi-clock" /> {log.formattedTime || formatLogTime(log.loggedAt || log.updatedAt || log.createdAt) || log.timeStr || '—'}
                            </span>
                          </div>
                        </td>
                        <td className="wt-cell-weight">
                          <b>{log.weightKg}</b> <span>kg</span>
                        </td>
                        <td className="wt-cell-diff">
                          {log.diff != null ? (
                            <span className={`wt-diff-tag ${log.diff < 0 ? 'is-down' : log.diff > 0 ? 'is-up' : 'is-flat'}`}>
                              <i className={`bi ${log.diff < 0 ? 'bi-arrow-down-short' : log.diff > 0 ? 'bi-arrow-up-short' : 'bi-dash'}`} />
                              {log.diff > 0 ? `+${log.diff}` : log.diff} kg
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="wt-cell-bmi">
                          {log.bmiInfo ? (
                            <span className="wt-badge-small" style={{ backgroundColor: log.bmiInfo.bg, color: log.bmiInfo.color }}>
                              {log.bmiInfo.bmi} ({log.bmiInfo.label})
                            </span>
                          ) : '—'}
                        </td>
                        <td className="wt-cell-actions text-end">
                          {((log.editHistory && log.editHistory.length > 1) || log.updateCount > 0) && (
                            <button
                              type="button"
                              className="wt-action-btn"
                              title="Xem lịch sử các lần sửa trong ngày"
                              onClick={() => setHistoryModalLog(log)}
                            >
                              <i className="bi bi-clock-history" />
                            </button>
                          )}
                          <button
                            type="button"
                            className="wt-action-btn"
                            title="Sửa bản ghi này"
                            onClick={() => openDialog(log.recordedDate.slice(0, 10), log.weightKg)}
                          >
                            <i className="bi bi-pencil" />
                          </button>
                          <button
                            type="button"
                            className="wt-action-btn wt-action-btn--delete"
                            title="Xóa bản ghi này"
                            onClick={() => setDeleteConfirmLog(log)}
                          >
                            <i className="bi bi-trash3" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="wt-empty-state">
              <i className="bi bi-speedometer2" />
              <h3>Chưa có bản ghi nào</h3>
              <p>Hãy bắt đầu xây dựng thói quen ghi nhận cân nặng đều đặn để NutriLens giúp bạn theo dõi tiến trình!</p>
              <button type="button" className="wt-btn wt-btn--primary" onClick={() => openDialog()}>
                <i className="bi bi-plus-lg" /> Thêm bản ghi mới
              </button>
            </div>
          )}
        </section>
      </main>

      {/* ── Dialog Ghi nhận cân nặng ── */}
      {dialogOpen && (
        <div className="hp-modal-backdrop" role="presentation" onMouseDown={closeDialog}>
          <section
            ref={weightModalRef}
            className="hp-weight-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wt-dialog-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="hp-weight-modal__header">
              <div>
                <span>Theo dõi tiến trình</span>
                <h2 id="wt-dialog-title">Ghi nhận cân nặng</h2>
              </div>
              <button
                type="button"
                className="hp-weight-modal__close"
                onClick={closeDialog}
                title="Đóng"
                aria-label="Đóng"
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSaveWeight(false)
              }}
              noValidate
            >
              <div className={`hp-field ${weightError.field === 'weight' ? 'is-invalid' : ''}`}>
                <label htmlFor="wt-weightInput">Cân nặng (kg)</label>
                <div className="hp-unit-input">
                  <input
                    id="wt-weightInput"
                    type="number"
                    min="20"
                    max="300"
                    step="0.1"
                    inputMode="decimal"
                    placeholder="ví dụ: 62.5"
                    autoFocus
                    value={weightForm.weightKg}
                    onChange={(e) => {
                      setWeightForm((c) => ({ ...c, weightKg: e.target.value }))
                      setWeightError({ field: '', message: '' })
                      setConfirmOverwrite(false)
                      setWeightDiffWarning(false)
                    }}
                  />
                  <span>kg</span>
                </div>
                {weightError.field === 'weight' && (
                  <span className="hp-field__error">{weightError.message}</span>
                )}
              </div>

              <div className={`hp-field ${weightError.field === 'date' ? 'is-invalid' : ''}`}>
                <label htmlFor="wt-dateInput">Ngày ghi nhận</label>
                <input
                  id="wt-dateInput"
                  type="date"
                  max={getLocalDateValue()}
                  value={weightForm.recordedDate}
                  onChange={(e) => {
                    setWeightForm((c) => ({ ...c, recordedDate: e.target.value }))
                    setWeightError({ field: '', message: '' })
                    setConfirmOverwrite(false)
                    setWeightDiffWarning(false)
                  }}
                />
                {weightError.field === 'date' && (
                  <span className="hp-field__error">{weightError.message}</span>
                )}
              </div>

              {/* Cảnh báo mềm chênh lệch (3-5 kg trong 1 ngày) */}
              {weightDiffWarning && (
                <div className="hp-advice-note hp-advice-note--warning" style={{ margin: '12px 0' }}>
                  <i className="bi bi-exclamation-triangle-fill" />
                  <div>
                    Số cân bạn nhập (<strong>{weightForm.weightKg} kg</strong>) chênh lệch <b>{weightDiffWarning.diffKg} kg</b> so với lần ghi nhận gần nhất ({weightDiffWarning.lastWeight} kg).
                    Bạn có chắc chắn số liệu này là chính xác?
                    <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="wt-btn-inline wt-btn-inline--confirm"
                        onClick={() => handleSaveWeight(true)}
                        disabled={savingWeight}
                      >
                        Đúng, tiếp tục lưu
                      </button>
                      <button
                        type="button"
                        className="wt-btn-inline"
                        onClick={() => setWeightDiffWarning(false)}
                      >
                        Kiểm tra lại
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Confirm ghi đè ngày cũ & hiển thị số lần sửa */}
              {confirmOverwrite && (
                <div className="hp-weight-modal__confirm" role="alert">
                  <i className="bi bi-exclamation-circle" />
                  <div>
                    <p style={{ margin: 0 }}>
                      Bạn đã có bản ghi cân nặng ngày{' '}
                      <strong>{formatLogDate(weightForm.recordedDate)}</strong>. Bạn có muốn cập nhật lại thành <strong>{weightForm.weightKg} kg</strong> không?
                    </p>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                      <i className="bi bi-arrow-repeat" /> Đã cập nhật: <b>{confirmOverwrite.currentUpdateCount || 0}/5 lần</b>
                      {confirmOverwrite.remainingUpdates <= 0 ? (
                        <span style={{ color: '#ef4444', fontWeight: 700, marginLeft: '6px' }}>
                          (Đã hết lượt sửa hôm nay)
                        </span>
                      ) : (
                        <span style={{ color: '#059669', marginLeft: '6px' }}>
                          (Còn <b>{confirmOverwrite.remainingUpdates}</b> lần sửa hôm nay)
                        </span>
                      )}
                    </div>
                  </div>
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
                      onClick={() => handleSaveWeight(true)}
                      disabled={savingWeight || (confirmOverwrite.remainingUpdates <= 0)}
                    >
                      Cập nhật
                    </button>
                  </div>
                </div>
              )}

              {!confirmOverwrite && !weightDiffWarning && (
                <div className="hp-weight-modal__actions">
                  <button
                    type="button"
                    className="hp-weight-modal__cancel"
                    onClick={closeDialog}
                    disabled={savingWeight}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="hp-weight-modal__save"
                    disabled={savingWeight}
                  >
                    {savingWeight ? 'Đang lưu…' : 'Lưu bản ghi'}
                  </button>
                </div>
              )}
            </form>
          </section>
        </div>
      )}

      {/* ── Dialog Xác nhận xóa bản ghi ── */}
      {deleteConfirmLog && (
        <div className="hp-modal-backdrop" role="presentation" onMouseDown={() => setDeleteConfirmLog(null)}>
          <section
            className="hp-weight-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="wt-del-title"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ maxWidth: '420px' }}
          >
            <div className="hp-weight-modal__header">
              <div>
                <span style={{ color: '#ef4444' }}>Cảnh báo</span>
                <h2 id="wt-del-title">Xóa bản ghi cân nặng</h2>
              </div>
              <button
                type="button"
                className="hp-weight-modal__close"
                onClick={() => setDeleteConfirmLog(null)}
                title="Đóng"
                aria-label="Đóng"
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <p style={{ fontSize: '14px', color: '#475569', margin: '14px 0 20px' }}>
              Bạn có chắc chắn muốn xóa bản ghi ngày <strong>{formatLogDate(deleteConfirmLog.recordedDate)}</strong> ({deleteConfirmLog.weightKg} kg) không? Thao tác này không thể hoàn tác.
            </p>
            <div className="hp-weight-modal__actions">
              <button
                type="button"
                className="hp-weight-modal__cancel"
                onClick={() => setDeleteConfirmLog(null)}
                disabled={deleting}
              >
                Hủy
              </button>
              <button
                type="button"
                className="hp-weight-modal__save"
                style={{ backgroundColor: '#ef4444', borderColor: '#dc2626' }}
                onClick={() => handleDeleteLog(deleteConfirmLog._id || deleteConfirmLog.id)}
                disabled={deleting}
              >
                {deleting ? 'Đang xóa…' : 'Xóa bản ghi'}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ── Dialog Xem lịch sử các lần sửa trong ngày (Phương án 2) ── */}
      {historyModalLog && (
        <div className="hp-modal-backdrop" role="presentation" onMouseDown={() => setHistoryModalLog(null)}>
          <section
            className="hp-weight-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wt-hist-title"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ maxWidth: '500px' }}
          >
            <div className="hp-weight-modal__header">
              <div>
                <span>Nhật ký chi tiết trong ngày</span>
                <h2 id="wt-hist-title">Lịch sử cân ngày {formatLogDate(historyModalLog.recordedDate)}</h2>
              </div>
              <button
                type="button"
                className="hp-weight-modal__close"
                onClick={() => setHistoryModalLog(null)}
                title="Đóng"
                aria-label="Đóng"
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <div className="wt-hist-modal-body">
              <div className="wt-hist-modal-intro">
                <i className="bi bi-info-circle-fill" />
                <span>
                  Đã cập nhật <b>{historyModalLog.updateCount || (historyModalLog.editHistory?.length ? historyModalLog.editHistory.length - 1 : 0)}/5</b> lần. Số cân ở lần ghi nhận mới nhất được dùng để vẽ biểu đồ theo dõi; hồ sơ sức khỏe chỉ nhận cân nặng khi đến mốc chu kỳ 2 tuần.
                </span>
              </div>

              <div className="wt-timeline">
                {(() => {
                  const historyList = (historyModalLog.editHistory && historyModalLog.editHistory.length > 0)
                    ? historyModalLog.editHistory
                    : [{
                        version: 1,
                        weightKg: historyModalLog.weightKg,
                        loggedAt: historyModalLog.loggedAt || historyModalLog.createdAt,
                        timeStr: historyModalLog.timeStr || '',
                      }]

                  return historyList.map((item, idx) => {
                    const isLatest = idx === historyList.length - 1
                    const prevItem = historyList[idx - 1]
                    const diff = prevItem ? Number((item.weightKg - prevItem.weightKg).toFixed(1)) : null
                    const formattedTime = formatLogTime(item.loggedAt) || item.timeStr || '—'

                    return (
                      <div key={idx} className={`wt-timeline-item ${isLatest ? 'is-latest' : ''}`}>
                        <div className="wt-timeline-track">
                          <span className={`wt-timeline-dot ${isLatest ? 'is-latest' : ''}`} />
                          {idx < historyList.length - 1 && <span className="wt-timeline-line" />}
                        </div>
                        <div className="wt-timeline-content">
                          <div className="wt-timeline-top">
                            <span className="wt-timeline-version">
                              {idx === 0 ? 'Lần 1 (Ban đầu)' : `Lần ${idx + 1}`}
                            </span>
                            <span className="wt-timeline-time">
                              <i className="bi bi-clock" /> {formattedTime}
                            </span>
                          </div>
                          <div className="wt-timeline-val-row">
                            <strong className="wt-timeline-val">{item.weightKg} kg</strong>
                            {diff != null && (
                              <span className={`wt-diff-tag ${diff < 0 ? 'is-down' : diff > 0 ? 'is-up' : 'is-flat'}`} style={{ fontSize: '11px', padding: '1px 5px' }}>
                                <i className={`bi ${diff < 0 ? 'bi-arrow-down-short' : diff > 0 ? 'bi-arrow-up-short' : 'bi-dash'}`} />
                                {diff > 0 ? `+${diff}` : diff} kg
                              </span>
                            )}
                            {isLatest && (
                              <span className="wt-pill-official">
                                <i className="bi bi-check-circle-fill" /> Chính thức
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                })()}
              </div>
            </div>

            <div className="hp-weight-modal__actions" style={{ marginTop: '20px' }}>
              <button
                type="button"
                className="wt-btn wt-btn--secondary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => setHistoryModalLog(null)}
              >
                Đóng
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ── Modal xác nhận mốc cân nặng sau chu kỳ 14 ngày (Tùy chọn 2) ── */}
      {milestoneModalOpen && (
        <div className="hp-modal-backdrop" role="presentation" onMouseDown={() => setMilestoneModalOpen(false)}>
          <section
            className="hp-milestone-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wt-milestone-dialog-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="hp-milestone-modal__header">
              <div className="hp-milestone-modal__icon">
                <i className="bi bi-trophy-fill" />
              </div>
              <div className="hp-milestone-modal__title-box">
                <h2 id="wt-milestone-dialog-title">Cập nhật mốc cân nặng sau 14 ngày</h2>
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
                  {weightLogs.length > 0 && (
                    <div className="hp-milestone-prompt-box__recent">
                      <i className="bi bi-clock-history" />
                      <span>
                        Số cân cuối cùng đã nhập trong hệ thống: <strong>{weightLogs[weightLogs.length - 1].weightKg} kg</strong> (ngày {formatLogDate(weightLogs[weightLogs.length - 1].recordedDate)})
                      </span>
                    </div>
                  )}
                </div>

                <div className="hp-field" style={{ marginTop: '14px' }}>
                  <label htmlFor="wtMilestoneWeightInput" style={{ fontWeight: 600 }}>
                    Xác nhận số cân mốc cho chu kỳ mới (kg):
                  </label>
                  <div className="hp-unit-input">
                    <input
                      id="wtMilestoneWeightInput"
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
    </div>
  )
}
