import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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

export default function WeightTrackerPage() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const weightModalRef = useRef(null)

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [weightLogs, setWeightLogs] = useState([])
  const [timeframe, setTimeframe] = useState('30d') // '7d' | '30d' | '90d' | 'all'
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
    if (!dialogOpen && !deleteConfirmLog && !historyModalLog) return
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        if (dialogOpen) closeDialog()
        if (deleteConfirmLog) setDeleteConfirmLog(null)
        if (historyModalLog) setHistoryModalLog(null)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [dialogOpen, deleteConfirmLog, historyModalLog])

  // Filter logs by timeframe
  const filteredLogs = useMemo(() => {
    if (!weightLogs.length) return []
    if (timeframe === 'all') return weightLogs

    const now = new Date()
    const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const result = weightLogs.filter((l) => l.recordedDate >= cutoff)
    // If filtered is empty but we have logs, show at least the latest few
    return result.length ? result : weightLogs.slice(-5)
  }, [weightLogs, timeframe])

  // Stats summary calculations
  const stats = useMemo(() => {
    if (!weightLogs.length) return null

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
    const fallbackWeight = defaultWeight || profile?.currentWeightKg || (weightLogs.length ? weightLogs[weightLogs.length - 1].weightKg : '')
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
      if (data.profile) {
        setProfile(data.profile)
        if (data.profile.currentWeightKg) {
          dispatch(userUpdated(data.profile))
        }
      }
      setSuccess(`Đã ghi nhận ${newLog.weightKg} kg cho ngày ${formatLogDate(newLog.recordedDate)}`)
      closeDialog()
      setTimeout(() => setSuccess(''), 4000)
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
      if (data.profile) {
        setProfile(data.profile)
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

  // Render SVG Chart Points
  const chartData = useMemo(() => {
    if (!filteredLogs.length) return null
    const weights = filteredLogs.map((l) => Number(l.weightKg))
    const minW = Math.min(...weights)
    const maxW = Math.max(...weights)
    const padding = Math.max((maxW - minW) * 0.25, 1.5)
    const lower = Number((minW - padding).toFixed(1))
    const upper = Number((maxW + padding).toFixed(1))
    const range = upper - lower || 1

    const width = 760
    const height = 260
    const paddingLeft = 46
    const paddingRight = 30
    const paddingTop = 24
    const paddingBottom = 40
    const plotWidth = width - paddingLeft - paddingRight
    const plotHeight = height - paddingTop - paddingBottom

    if (filteredLogs.length === 1) {
      const log = filteredLogs[0]
      const y = paddingTop + plotHeight / 2
      const x = paddingLeft + plotWidth / 2
      return {
        width, height, lower, upper, points: [{ x, y, log }],
        pathD: '', targetY: null,
      }
    }

    const dates = filteredLogs.map((l) => new Date(l.recordedDate.slice(0, 10) + 'T00:00:00').getTime())
    const minDate = Math.min(...dates)
    const maxDate = Math.max(...dates)
    const dateRange = maxDate - minDate || 1

    const points = filteredLogs.map((log) => {
      const t = new Date(log.recordedDate.slice(0, 10) + 'T00:00:00').getTime()
      const x = paddingLeft + ((t - minDate) / dateRange) * plotWidth
      const y = paddingTop + plotHeight - ((Number(log.weightKg) - lower) / range) * plotHeight
      return { x, y, log }
    })

    const pathD = points.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`, '')

    // Area path for gradient fill
    const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)},${(paddingTop + plotHeight).toFixed(1)} L ${points[0].x.toFixed(1)},${(paddingTop + plotHeight).toFixed(1)} Z`

    // Target weight line
    let targetY = null
    if (stats?.targetWeight && stats.targetWeight >= lower && stats.targetWeight <= upper) {
      targetY = paddingTop + plotHeight - ((stats.targetWeight - lower) / range) * plotHeight
    }

    return {
      width, height, lower, upper, points, pathD, areaD, targetY,
      paddingLeft, paddingRight, paddingTop, paddingBottom, plotHeight, plotWidth,
    }
  }, [filteredLogs, stats?.targetWeight])

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

        {/* ── KPI Cards ── */}
        <section className="wt-kpi-grid">
          {/* Card 1: Cân nặng hiện tại */}
          <article className="wt-kpi-card wt-kpi-card--current">
            <div className="wt-kpi-card__header">
              <span>Cân nặng hiện tại</span>
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
                  <i className="bi bi-clock" /> Cập nhật: {formatLogDate(stats.latestDate)} {stats.latestTime ? `lúc ${stats.latestTime}` : ''}
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
              <span>Bắt đầu: <b>{stats?.initialWeight ?? '—'} kg</b> ({formatLogDate(weightLogs[0]?.recordedDate) || '—'})</span>
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
                className={`wt-tf-btn ${timeframe === '30d' ? 'is-active' : ''}`}
                onClick={() => setTimeframe('30d')}
              >
                30 ngày
              </button>
              <button
                type="button"
                className={`wt-tf-btn ${timeframe === '90d' ? 'is-active' : ''}`}
                onClick={() => setTimeframe('90d')}
              >
                90 ngày
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

          {/* Chart Display */}
          {chartData ? (
            <div className="wt-chart-container">
              <svg
                className="wt-svg-chart"
                viewBox={`0 0 ${chartData.width} ${chartData.height}`}
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label="Biểu đồ tiến trình cân nặng"
              >
                <defs>
                  <linearGradient id="wtChartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Gridlines */}
                <line x1={chartData.paddingLeft} y1={chartData.paddingTop} x2={chartData.width - chartData.paddingRight} y2={chartData.paddingTop} className="wt-chart-grid" />
                <line x1={chartData.paddingLeft} y1={chartData.paddingTop + chartData.plotHeight * 0.5} x2={chartData.width - chartData.paddingRight} y2={chartData.paddingTop + chartData.plotHeight * 0.5} className="wt-chart-grid" />
                <line x1={chartData.paddingLeft} y1={chartData.paddingTop + chartData.plotHeight} x2={chartData.width - chartData.paddingRight} y2={chartData.paddingTop + chartData.plotHeight} className="wt-chart-axis" />

                {/* Y-axis Labels */}
                <text x={chartData.paddingLeft - 8} y={chartData.paddingTop + 4} textAnchor="end" className="wt-chart-tick">{chartData.upper} kg</text>
                <text x={chartData.paddingLeft - 8} y={chartData.paddingTop + chartData.plotHeight * 0.5 + 4} textAnchor="end" className="wt-chart-tick">{((chartData.upper + chartData.lower) / 2).toFixed(1)} kg</text>
                <text x={chartData.paddingLeft - 8} y={chartData.paddingTop + chartData.plotHeight + 4} textAnchor="end" className="wt-chart-tick">{chartData.lower} kg</text>

                {/* Target Weight Reference Line */}
                {chartData.targetY != null && (
                  <g className="wt-target-line-group">
                    <line
                      x1={chartData.paddingLeft}
                      y1={chartData.targetY}
                      x2={chartData.width - chartData.paddingRight}
                      y2={chartData.targetY}
                      className="wt-target-line"
                    />
                    <text
                      x={chartData.width - chartData.paddingRight}
                      y={chartData.targetY - 5}
                      textAnchor="end"
                      className="wt-target-label"
                    >
                      Mục tiêu: {stats.targetWeight} kg
                    </text>
                  </g>
                )}

                {/* Area Gradient Fill */}
                {chartData.areaD && (
                  <path d={chartData.areaD} fill="url(#wtChartGrad)" />
                )}

                {/* Main Polyline */}
                {chartData.pathD && (
                  <path d={chartData.pathD} className="wt-chart-line" />
                )}

                {/* Data Points */}
                {chartData.points.map(({ x, y, log }, idx) => {
                  const isHovered = activePoint?.log?._id === log._id || activePoint?.log?.recordedDate === log.recordedDate
                  const showDate = chartData.points.length <= 10 || idx === 0 || idx === chartData.points.length - 1 || idx % Math.ceil(chartData.points.length / 6) === 0
                  return (
                    <g key={log._id || log.id || idx}>
                      <circle
                        cx={x}
                        cy={y}
                        r={isHovered ? 7 : 4.5}
                        className={`wt-chart-point ${isHovered ? 'is-active' : ''}`}
                        onMouseEnter={() => setActivePoint({ x, y, log })}
                        onClick={() => openDialog(log.recordedDate.slice(0, 10), log.weightKg)}
                      />
                      {showDate && (
                        <text x={x} y={chartData.height - 12} textAnchor="middle" className="wt-chart-datelabel">
                          {formatLogDate(log.recordedDate)}
                        </text>
                      )}
                    </g>
                  )
                })}
              </svg>

              {/* Tooltip Overlay */}
              {activePoint && (
                <div
                  className="wt-chart-tooltip"
                  style={{
                    left: `${(activePoint.x / chartData.width) * 100}%`,
                    top: `${(activePoint.y / chartData.height) * 100}%`,
                  }}
                >
                  <strong>{activePoint.log.weightKg} kg</strong>
                  <span>
                    {formatLogDate(activePoint.log.recordedDate)}
                    {formatLogTime(activePoint.log.loggedAt || activePoint.log.updatedAt || activePoint.log.createdAt) || activePoint.log.timeStr
                      ? ` lúc ${formatLogTime(activePoint.log.loggedAt || activePoint.log.updatedAt || activePoint.log.createdAt) || activePoint.log.timeStr}`
                      : ''}
                  </span>
                </div>
              )}
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
                  Đã cập nhật <b>{historyModalLog.updateCount || (historyModalLog.editHistory?.length ? historyModalLog.editHistory.length - 1 : 0)}/5</b> lần. Số cân ở lần ghi nhận mới nhất được dùng làm số liệu chính thức để vẽ biểu đồ và tính chỉ số BMI/TDEE.
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
    </div>
  )
}
