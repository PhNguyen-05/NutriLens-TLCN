import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import axiosInstance from '../../api/axiosInstance'
import { userUpdated } from '../../store/slices/authSlice'
import UserHeader from '../../components/common/UserHeader'
import UserFooter from '../../components/common/UserFooter'
import MilestoneReviewModal from '../../components/profile/MilestoneReviewModal'
import {
  WeightKpiCards,
  WeightChart,
  WeightHistoryTable,
  WeightLogDialog,
  WeightDeleteModal,
  WeightEditHistoryModal,
} from '../../components/weight'
import {
  getLocalDateValue,
  formatLogDate,
  formatLogTime,
  getBmiInfo,
  getSmoothPath,
  getNiceYAxis,
} from '../../constants/healthConstants'

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

  // Edit history modal state
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

    let distanceToTarget = null
    let progressPct = null
    if (targetWeight && initialWeight !== targetWeight) {
      distanceToTarget = Number(Math.abs(currentWeight - targetWeight).toFixed(1))
      const totalSpan = Math.abs(targetWeight - initialWeight)
      const accomplished = totalSpan - distanceToTarget
      progressPct = Math.min(100, Math.max(0, Math.round((accomplished / totalSpan) * 100)))
    }

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
      const nextLog = arr[index + 1]
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
      if (minDayDiff <= 1.05 && diffKg > 5) {
        setWeightError({
          field: 'weight',
          message: `Chặn cứng: Biến động ${diffKg.toFixed(1)} kg trong vòng 1 ngày là không khả thi về mặt sinh lý (> 5 kg). Hệ thống từ chối ghi nhận để bảo vệ tính chính xác.`,
        })
        return
      }
      if (minDayDiff <= 3.05 && diffKg > 8) {
        setWeightError({
          field: 'weight',
          message: `Chặn cứng: Biến động ${diffKg.toFixed(1)} kg trong vòng 3 ngày vượt quá giới hạn an toàn (> 8 kg). Vui lòng kiểm tra lại số cân.`,
        })
        return
      }
      if (minDayDiff <= 7.05 && diffKg > 12) {
        setWeightError({
          field: 'weight',
          message: `Chặn cứng: Biến động ${diffKg.toFixed(1)} kg trong vòng 7 ngày vượt quá giới hạn an toàn (> 12 kg). Vui lòng kiểm tra lại số cân.`,
        })
        return
      }

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

    if (targetW && targetW >= minW - 15 && targetW <= maxW + 15) {
      minW = Math.min(minW, targetW)
      maxW = Math.max(maxW, targetW)
    }

    const { lower, upper, range, ticks } = getNiceYAxis(minW, maxW)

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

    const gridSteps = ticks.map((val, idx) => {
      const y = paddingTop + plotHeight - ((val - lower) / range) * plotHeight
      return { val, y, isAxis: idx === ticks.length - 1 }
    })

    let targetY = null
    if (targetW && targetW >= lower && targetW <= upper) {
      targetY = paddingTop + plotHeight - ((targetW - lower) / range) * plotHeight
    }

    if (filteredLogs.length === 1) {
      const log = filteredLogs[0]
      const w = Number(log.weightKg)
      const y = paddingTop + plotHeight - ((w - lower) / range) * plotHeight
      const x = paddingLeft + plotWidth / 2
      const bmiInfo = getBmiInfo(w, profile?.heightCm)
      return {
        width,
        height,
        lower,
        upper,
        points: [{
          x,
          y,
          log,
          isFirst: true,
          isLatest: true,
          isLowest: true,
          isHighest: true,
          bmiInfo,
          showDate: true,
          dateAnchor: 'middle',
          dateX: x,
          diffFromPrev: null,
          diffFromBaseline: null,
        }],
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

      lastPt.showDate = true
      lastPt.dateAnchor = 'end'
      lastPt.dateX = Math.min(lastPt.x, width - paddingRight)
      const lastInterval = [lastPt.dateX - LABEL_WIDTH, lastPt.dateX]

      firstPt.dateAnchor = 'start'
      firstPt.dateX = Math.max(firstPt.x, paddingLeft)
      const firstInterval = [firstPt.dateX, firstPt.dateX + LABEL_WIDTH]

      if (firstInterval[1] + MIN_LABEL_GAP > lastInterval[0]) {
        firstPt.showDate = false
      } else {
        firstPt.showDate = true
      }

      const occupiedIntervals = []
      if (firstPt.showDate) occupiedIntervals.push(firstInterval)
      occupiedIntervals.push(lastInterval)

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
    <div className="dashboard-shell wt-shell">
      {/* ── Header chính dùng chung ── */}
      <UserHeader />

      <main className="wt-main">
        {/* ── Page heading ── */}
        <section className="fs-page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span className="fs-page-icon"><i className="bi bi-activity" /></span>
            <div>
              <h1 style={{ margin: 0, color: '#172c42', fontSize: '1.7rem', fontWeight: 750 }}>Tiến Trình &amp; Cân Nặng</h1>
              <p style={{ margin: '4px 0 0', color: '#758994', fontSize: '0.92rem' }}>
                Theo dõi chỉ số cân nặng, phân tích xu hướng BMI và lịch sử tiến trình thay đổi vóc dáng.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
        </section>

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
        <WeightKpiCards
          stats={stats}
          profile={profile}
          weightLogs={weightLogs}
          formatLogDate={formatLogDate}
        />

        {/* ── Chart Section ── */}
        <WeightChart
          timeframe={timeframe}
          setTimeframe={setTimeframe}
          weightLogs={weightLogs}
          chartData={chartData}
          activePoint={activePoint}
          setActivePoint={setActivePoint}
          stats={stats}
          openDialog={openDialog}
        />

        {/* ── History Table Section ── */}
        <WeightHistoryTable
          tableLogs={tableLogs}
          openDialog={openDialog}
          setHistoryModalLog={setHistoryModalLog}
          setDeleteConfirmLog={setDeleteConfirmLog}
        />
      </main>

      {/* ── Dialog Ghi nhận cân nặng ── */}
      <WeightLogDialog
        open={dialogOpen}
        onClose={closeDialog}
        weightModalRef={weightModalRef}
        weightForm={weightForm}
        setWeightForm={setWeightForm}
        weightError={weightError}
        setWeightError={setWeightError}
        weightDiffWarning={weightDiffWarning}
        setWeightDiffWarning={setWeightDiffWarning}
        confirmOverwrite={confirmOverwrite}
        setConfirmOverwrite={setConfirmOverwrite}
        savingWeight={savingWeight}
        handleSaveWeight={handleSaveWeight}
      />

      {/* ── Dialog Xác nhận xóa bản ghi ── */}
      <WeightDeleteModal
        log={deleteConfirmLog}
        onClose={() => setDeleteConfirmLog(null)}
        onDelete={handleDeleteLog}
        deleting={deleting}
      />

      {/* ── Dialog Xem lịch sử các lần sửa trong ngày ── */}
      <WeightEditHistoryModal
        log={historyModalLog}
        onClose={() => setHistoryModalLog(null)}
      />

      {/* ── Modal xác nhận mốc cân nặng sau chu kỳ 14 ngày ── */}
      <MilestoneReviewModal
        open={milestoneModalOpen}
        onClose={() => setMilestoneModalOpen(false)}
        baselineStatus={baselineStatus}
        weightLogs={weightLogs}
        milestoneForm={milestoneForm}
        setMilestoneForm={setMilestoneForm}
        handleApplyMilestone={handleApplyMilestone}
        applyingMilestone={applyingMilestone}
        milestoneError={milestoneError}
      />

      <UserFooter />
    </div>
  )
}
