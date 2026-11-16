import UserHeader from '../../components/common/UserHeader'
import { useEffect, useState, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import axiosInstance from '../../api/axiosInstance'
import UserFooter from '../../components/common/UserFooter'
import './AnalyticsTrendsPage.css'

function formatDateVi(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  if (!y || !m || !d) return dateStr
  return `${d}/${m}/${y}`
}

export default function AnalyticsTrendsPage() {
  const [period, setPeriod] = useState('7d')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [analyticsData, setAnalyticsData] = useState(null)
  const [energyTooltip, setEnergyTooltip] = useState(null)
  const [workoutTooltip, setWorkoutTooltip] = useState(null)
  const [dowTooltip, setDowTooltip] = useState(null)
  const chartContainerRef = useRef(null)

  useEffect(() => {
    let isMounted = true
    async function fetchAnalytics() {
      try {
        setLoading(true)
        setError(null)
        const res = await axiosInstance.get(`/profile/analytics?period=${period}`)
        if (isMounted) {
          setAnalyticsData(res.data)
        }
      } catch (err) {
        console.error('Lỗi khi tải dữ liệu chỉ số & xu hướng:', err)
        if (isMounted) {
          setError(err.response?.data?.message || 'Không thể tải dữ liệu chỉ số và xu hướng')
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    fetchAnalytics()
    return () => {
      isMounted = false
    }
  }, [period])

  const handleRefresh = async () => {
    try {
      setRefreshing(true)
      const res = await axiosInstance.get(`/profile/analytics?period=${period}`)
      setAnalyticsData(res.data)
    } catch (err) {
      console.error('Lỗi làm mới:', err)
    } finally {
      setTimeout(() => setRefreshing(false), 500)
    }
  }

  const kpi = analyticsData?.kpiSummary || {}
  const macros = analyticsData?.macroAnalysis || {}
  const weight = analyticsData?.weightAnalysis || {}
  const exercises = analyticsData?.exerciseAnalysis || {}
  const meals = analyticsData?.mealAnalysis || {}
  const dow = analyticsData?.dayOfWeekAnalysis || []
  const daily = analyticsData?.dailyData || []

  // 1. Tọa độ biểu đồ SVG Năng lượng & Calo (Widescreen 1100x290)
  const energyChartConfig = useMemo(() => {
    if (!daily || daily.length === 0) return null

    const width = 1100
    const height = 290
    const padLeft = 55
    const padRight = 35
    const padTop = 30
    const padBottom = 42

    const plotW = width - padLeft - padRight
    const plotH = height - padTop - padBottom

    const targetCal = kpi.calorieTarget || 2000
    const maxValInSeries = Math.max(
      targetCal,
      ...daily.map((d) => Math.max(d.caloriesIn || 0, d.caloriesBurned || 0, d.calorieTarget || 0))
    )
    const yMax = Math.ceil((maxValInSeries * 1.15) / 500) * 500 || 2500

    const stepX = daily.length > 1 ? plotW / (daily.length - 1) : plotW / 2

    const pointsIn = daily.map((d, i) => {
      const x = daily.length > 1 ? padLeft + i * stepX : padLeft + plotW / 2
      const y = padTop + plotH - ((d.caloriesIn || 0) / yMax) * plotH
      return { x, y, data: d }
    })

    const pointsBurned = daily.map((d, i) => {
      const x = daily.length > 1 ? padLeft + i * stepX : padLeft + plotW / 2
      const y = padTop + plotH - ((d.caloriesBurned || 0) / yMax) * plotH
      return { x, y, data: d }
    })

    const targetY = padTop + plotH - (targetCal / yMax) * plotH

    // Smooth Bezier Curve Path Builder
    function buildCurvePath(pts) {
      if (!pts || pts.length === 0) return ''
      if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`
      let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)]
        const p1 = pts[i]
        const p2 = pts[i + 1]
        const p3 = pts[Math.min(pts.length - 1, i + 2)]
        const cp1x = p1.x + (p2.x - p0.x) / 6
        const cp1y = p1.y + (p2.y - p0.y) / 6
        const cp2x = p2.x - (p3.x - p1.x) / 6
        const cp2y = p2.y - (p3.y - p1.y) / 6
        d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`
      }
      return d
    }

    const pathInD = buildCurvePath(pointsIn)
    const pathBurnedD = buildCurvePath(pointsBurned)

    // Area fill path for Calories In
    let areaInD = ''
    if (pointsIn.length > 1) {
      areaInD = `${pathInD} L ${pointsIn[pointsIn.length - 1].x.toFixed(1)},${(padTop + plotH).toFixed(1)} L ${pointsIn[0].x.toFixed(1)},${(padTop + plotH).toFixed(1)} Z`
    }

    const gridTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
      const val = Math.round(yMax * ratio)
      const y = padTop + plotH - ratio * plotH
      return { val, y }
    })

    return {
      width,
      height,
      padLeft,
      padRight,
      padTop,
      padBottom,
      plotW,
      plotH,
      yMax,
      pointsIn,
      pointsBurned,
      targetY,
      pathInD,
      pathBurnedD,
      areaInD,
      gridTicks,
    }
  }, [daily, kpi.calorieTarget])

  // 2. Tọa độ biểu đồ SVG Donut Chart cho Macros
  const macroDonutConfig = useMemo(() => {
    const pPct = macros.actualPercentages?.protein || 0
    const cPct = macros.actualPercentages?.carbs || 0
    const fPct = macros.actualPercentages?.fat || 0

    const radius = 54
    const circumference = 2 * Math.PI * radius

    const hasData = pPct > 0 || cPct > 0 || fPct > 0
    const pRatio = hasData ? pPct / 100 : 0.25
    const cRatio = hasData ? cPct / 100 : 0.50
    const fRatio = hasData ? fPct / 100 : 0.25

    const pDash = pRatio * circumference
    const cDash = cRatio * circumference
    const fDash = fRatio * circumference

    const pOffset = 0
    const cOffset = -pDash
    const fOffset = -(pDash + cDash)

    return {
      radius,
      circumference,
      hasData,
      pPct: hasData ? pPct : 0,
      cPct: hasData ? cPct : 0,
      fPct: hasData ? fPct : 0,
      pDash,
      cDash,
      fDash,
      pOffset,
      cOffset,
      fOffset,
    }
  }, [macros.actualPercentages])

  // 3. Tọa độ biểu đồ cột Thời lượng Vận động
  const workoutChartConfig = useMemo(() => {
    if (!daily || daily.length === 0) return null

    const width = 800
    const height = 230
    const padLeft = 45
    const padRight = 20
    const padTop = 25
    const padBottom = 35

    const plotW = width - padLeft - padRight
    const plotH = height - padTop - padBottom

    const maxMinutes = Math.max(60, ...daily.map((d) => d.exerciseMinutes || 0))
    const yMax = Math.ceil((maxMinutes * 1.2) / 30) * 30 || 90

    const targetMins = 30
    const targetY = padTop + plotH - (targetMins / yMax) * plotH

    const numBars = daily.length
    const barSlotW = plotW / numBars
    const barW = Math.min(38, Math.max(12, barSlotW * 0.55))

    const bars = daily.map((d, i) => {
      const cx = padLeft + i * barSlotW + barSlotW / 2
      const mins = d.exerciseMinutes || 0
      const barH = (mins / yMax) * plotH
      const y = padTop + plotH - barH
      const meetsTarget = mins >= targetMins
      return {
        cx,
        x: cx - barW / 2,
        y,
        w: barW,
        h: Math.max(2, barH),
        mins,
        workouts: d.workoutCount || 0,
        caloriesBurned: d.caloriesBurned || 0,
        meetsTarget,
        dayLabel: d.dayLabel,
        formattedDate: d.formattedDate,
        isToday: d.isToday,
      }
    })

    const gridTicks = [0, 0.33, 0.66, 1].map((ratio) => {
      const val = Math.round(yMax * ratio)
      const y = padTop + plotH - ratio * plotH
      return { val, y }
    })

    return {
      width,
      height,
      padLeft,
      padRight,
      plotW,
      plotH,
      yMax,
      targetY,
      targetMins,
      bars,
      gridTicks,
    }
  }, [daily])

  // 4. Tọa độ biểu đồ so sánh Calo nạp vs đốt theo Thứ (Grouped DOW)
  const dowChartConfig = useMemo(() => {
    if (!dow || dow.length === 0) return null

    const width = 800
    const height = 230
    const padLeft = 50
    const padRight = 20
    const padTop = 25
    const padBottom = 35

    const plotW = width - padLeft - padRight
    const plotH = height - padTop - padBottom

    const targetCal = kpi.calorieTarget || 2000
    const maxVal = Math.max(
      targetCal,
      ...dow.map((d) => Math.max(d.avgCaloriesIn || 0, d.avgCaloriesBurned || 0))
    )
    const yMax = Math.ceil((maxVal * 1.15) / 500) * 500 || 2500
    const targetY = padTop + plotH - (targetCal / yMax) * plotH

    const groupW = plotW / 7
    const singleBarW = Math.min(22, groupW * 0.32)
    const gap = 3

    const groups = dow.map((d, i) => {
      const groupCenter = padLeft + i * groupW + groupW / 2
      const calIn = d.avgCaloriesIn || 0
      const calBurn = d.avgCaloriesBurned || 0

      const hIn = (calIn / yMax) * plotH
      const yIn = padTop + plotH - hIn

      const hBurn = (calBurn / yMax) * plotH
      const yBurn = padTop + plotH - hBurn

      return {
        dayLabel: d.dayLabel,
        calIn,
        calBurn,
        xIn: groupCenter - singleBarW - gap / 2,
        yIn,
        wIn: singleBarW,
        hIn: Math.max(2, hIn),
        xBurn: groupCenter + gap / 2,
        yBurn,
        wBurn: singleBarW,
        hBurn: Math.max(2, hBurn),
        groupCenter,
        isWeekend: d.dayLabel === 'T7' || d.dayLabel === 'CN',
      }
    })

    const gridTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
      const val = Math.round(yMax * ratio)
      const y = padTop + plotH - ratio * plotH
      return { val, y }
    })

    return {
      width,
      height,
      padLeft,
      padRight,
      plotW,
      plotH,
      yMax,
      targetY,
      targetCal,
      groups,
      gridTicks,
    }
  }, [dow, kpi.calorieTarget])

  const mealBreakdown = meals.mealBreakdown || {}

  return (
    <div className="at-shell">
      {/* ── HEADER NAVIGATION BAR (FULL SCREEN EDGE-TO-EDGE) ── */}
      <UserHeader />

      {/* ── MAIN CONTENT CONTAINER (FULL SCREEN UNIFIED) ── */}
      <main className="at-container">
        {/* ── CLEAN EXECUTIVE HEADER BANNER ── */}
        <section className="at-hero">
          <div className="at-hero__left">
            <div className="at-hero__badge-icon">
              <i className="bi bi-graph-up-arrow" />
            </div>
            <div className="at-hero__title-wrap">
              <div className="at-hero__title-row">
                <h1>Chỉ số &amp; Xu hướng</h1>
                {analyticsData?.startDate && analyticsData?.endDate && (
                  <span className="at-hero__period-pill">
                    <i className="bi bi-calendar3" />
                    {formatDateVi(analyticsData.startDate)} — {formatDateVi(analyticsData.endDate)}
                    <span className="at-hero__dot" />
                    {analyticsData.numDays} ngày
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="at-hero__right">
            <div className="at-timeframe-group" role="group" aria-label="Chọn khoảng thời gian">
              {[
                { id: '7d', label: '7 ngày' },
                { id: '14d', label: '14 ngày' },
                { id: '30d', label: '30 ngày' },
                { id: '90d', label: '90 ngày' },
              ].map((tf) => (
                <button
                  key={tf.id}
                  type="button"
                  className={`at-tf-btn ${period === tf.id ? 'is-active' : ''}`}
                  onClick={() => setPeriod(tf.id)}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className={`at-refresh-btn ${refreshing ? 'is-spinning' : ''}`}
              onClick={handleRefresh}
              title="Làm mới dữ liệu"
              aria-label="Làm mới dữ liệu"
            >
              <i className="bi bi-arrow-clockwise" />
            </button>
          </div>
        </section>

        {/* Loading State Skeleton */}
        {loading && (
          <div className="at-loading-skeleton">
            <div className="at-skeleton-box" style={{ height: '90px' }} />
            <div className="at-skeleton-box" style={{ height: '360px' }} />
            <div className="at-skeleton-box" style={{ height: '280px' }} />
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="at-empty-state">
            <i className="bi bi-exclamation-octagon text-danger" />
            <h3>Không thể tải chỉ số</h3>
            <p>{error}</p>
            <button
              type="button"
              className="at-action-btn at-action-btn--primary"
              onClick={() => setPeriod(period)}
            >
              <i className="bi bi-arrow-clockwise" /> Thử lại
            </button>
          </div>
        )}

        {/* Unified Full-Page Dashboard Content */}
        {!loading && !error && analyticsData && (
          <>
            {/* ── 1. KPI SUMMARY CARDS (4 THẺ ĐIỀU HÀNH TINH GỌN, ĐÃ BỎ THẺ ĐẠM PROTEIN) ── */}
            <section className="at-kpi-grid">
              {/* 1. Calo nạp trung bình */}
              <div className="at-kpi-card">
                <div className="at-kpi-card__top">
                  <span className="at-kpi-card__label">Calo nạp trung bình</span>
                  <span className="at-kpi-card__icon at-kpi-card__icon--orange">
                    <i className="bi bi-fire" />
                  </span>
                </div>
                <div>
                  <div className="at-kpi-card__value">
                    {kpi.avgCaloriesIn ? kpi.avgCaloriesIn.toLocaleString() : 0}
                    <small>kcal/ngày</small>
                  </div>
                  <div className="at-kpi-card__sub">
                    Mục tiêu: <strong>{kpi.calorieTarget ? kpi.calorieTarget.toLocaleString() : 2000} kcal</strong>
                    {kpi.calorieTarget && (
                      <span className={`at-badge ${(kpi.avgCaloriesIn || 0) <= kpi.calorieTarget ? 'at-badge--success' : 'at-badge--warning'}`}>
                        {Math.round(((kpi.avgCaloriesIn || 0) / kpi.calorieTarget) * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Tiêu hao tập luyện */}
              <div className="at-kpi-card">
                <div className="at-kpi-card__top">
                  <span className="at-kpi-card__label">Tiêu hao tập luyện</span>
                  <span className="at-kpi-card__icon at-kpi-card__icon--emerald">
                    <i className="bi bi-lightning-charge-fill" />
                  </span>
                </div>
                <div>
                  <div className="at-kpi-card__value">
                    {kpi.avgCaloriesBurned ? kpi.avgCaloriesBurned.toLocaleString() : 0}
                    <small>kcal/ngày</small>
                  </div>
                  <div className="at-kpi-card__sub">
                    Tổng <strong>{kpi.totalWorkouts || 0} buổi</strong> ({kpi.totalExerciseMinutes || 0} phút)
                  </div>
                </div>
              </div>

              {/* 3. Thời lượng vận động */}
              <div className="at-kpi-card">
                <div className="at-kpi-card__top">
                  <span className="at-kpi-card__label">Thời lượng vận động</span>
                  <span className="at-kpi-card__icon at-kpi-card__icon--purple">
                    <i className="bi bi-stopwatch-fill" />
                  </span>
                </div>
                <div>
                  <div className="at-kpi-card__value">
                    {kpi.totalExerciseMinutes || 0}
                    <small>phút</small>
                  </div>
                  <div className="at-kpi-card__sub">
                    TB: <strong>{kpi.totalDays ? Math.round((kpi.totalExerciseMinutes || 0) / kpi.totalDays) : 0} p/ngày</strong>
                    <span className="at-badge at-badge--info">
                      {(kpi.totalExerciseMinutes || 0) >= (kpi.totalDays || 7) * 30 ? 'Chuẩn WHO' : 'Cần tăng'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. Thể trạng & BMI */}
              <div className="at-kpi-card">
                <div className="at-kpi-card__top">
                  <span className="at-kpi-card__label">Thể trạng &amp; BMI</span>
                  <span className="at-kpi-card__icon at-kpi-card__icon--teal">
                    <i className="bi bi-speedometer2" />
                  </span>
                </div>
                <div>
                  <div className="at-kpi-card__value">
                    {weight.currentWeight || '-'}
                    <small>kg</small>
                  </div>
                  <div className="at-kpi-card__sub">
                    BMI: <strong>{weight.bmi || '-'}</strong> ({weight.bmiCategory || 'Bình thường'})
                  </div>
                </div>
              </div>
            </section>

            {/* ── 2. XU HƯỚNG NĂNG LƯỢNG & CÂN BẰNG CALO (WIDESCREEN CURVE) ── */}
            <section className="at-card">
              <div className="at-card__header">
                <div className="at-card__title-group">
                  <h2>
                    <i className="bi bi-activity" /> Xu hướng Năng lượng &amp; Cân bằng Calo
                  </h2>
                </div>
                <div className="at-chart-legend">
                  <span className="at-legend-item">
                    <span className="at-legend-color" style={{ background: '#10b981' }} />
                    Calo nạp vào
                  </span>
                  <span className="at-legend-item">
                    <span className="at-legend-color" style={{ background: '#0284c7' }} />
                    Calo đốt cháy
                  </span>
                  <span className="at-legend-item">
                    <span className="at-legend-line" style={{ background: '#8b5cf6', borderTop: '2px dashed #8b5cf6' }} />
                    Mục tiêu ({kpi.calorieTarget || 2000} kcal)
                  </span>
                </div>
              </div>

              {energyChartConfig && (
                <div
                  className="at-chart-container"
                  ref={chartContainerRef}
                  onMouseLeave={() => setEnergyTooltip(null)}
                >
                  <svg
                    className="at-chart-svg"
                    viewBox={`0 0 ${energyChartConfig.width} ${energyChartConfig.height}`}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <defs>
                      <linearGradient id="atCaloInGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.01" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Gridlines */}
                    {energyChartConfig.gridTicks.map((tick, idx) => (
                      <g key={`grid-${idx}`}>
                        <line
                          x1={energyChartConfig.padLeft}
                          y1={tick.y}
                          x2={energyChartConfig.width - energyChartConfig.padRight}
                          y2={tick.y}
                          className="at-chart-grid-line"
                        />
                        <text
                          x={energyChartConfig.padLeft - 8}
                          y={tick.y + 4}
                          textAnchor="end"
                          className="at-chart-tick-text"
                        >
                          {tick.val}
                        </text>
                      </g>
                    ))}

                    {/* Calorie Target Line */}
                    {energyChartConfig.targetY != null && (
                      <g>
                        <line
                          x1={energyChartConfig.padLeft}
                          y1={energyChartConfig.targetY}
                          x2={energyChartConfig.width - energyChartConfig.padRight}
                          y2={energyChartConfig.targetY}
                          className="at-chart-target-line"
                        />
                        <text
                          x={energyChartConfig.width - energyChartConfig.padRight - 4}
                          y={energyChartConfig.targetY - 6}
                          textAnchor="end"
                          fill="#8b5cf6"
                          fontSize="10.5"
                          fontWeight="700"
                        >
                          Mục tiêu {kpi.calorieTarget} kcal
                        </text>
                      </g>
                    )}

                    {/* Calories In Area */}
                    {energyChartConfig.areaInD && (
                      <path d={energyChartConfig.areaInD} fill="url(#atCaloInGrad)" />
                    )}

                    {/* Calories In Line */}
                    {energyChartConfig.pathInD && (
                      <path
                        d={energyChartConfig.pathInD}
                        fill="none"
                        stroke="#059669"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                      />
                    )}

                    {/* Calories Burned Line */}
                    {energyChartConfig.pathBurnedD && (
                      <path
                        d={energyChartConfig.pathBurnedD}
                        fill="none"
                        stroke="#0284c7"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                      />
                    )}

                    {/* Interactive Points */}
                    {energyChartConfig.pointsIn.map((pt, idx) => (
                      <g key={`point-in-${idx}`}>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={energyTooltip?.index === idx ? 6 : 4}
                          fill="#ffffff"
                          stroke="#059669"
                          strokeWidth="2.5"
                        />
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="22"
                          fill="transparent"
                          cursor="pointer"
                          onMouseEnter={() =>
                            setEnergyTooltip({
                              index: idx,
                              data: pt.data,
                              x: pt.x,
                              y: Math.min(pt.y, energyChartConfig.pointsBurned[idx]?.y || pt.y),
                            })
                          }
                        />
                      </g>
                    ))}

                    {energyChartConfig.pointsBurned.map((pt, idx) => (
                      <circle
                        key={`point-burned-${idx}`}
                        cx={pt.x}
                        cy={pt.y}
                        r={energyTooltip?.index === idx ? 5 : 3.5}
                        fill="#ffffff"
                        stroke="#0284c7"
                        strokeWidth="2.2"
                      />
                    ))}

                    {/* Date Labels */}
                    {daily.map((d, idx) => {
                      const pt = energyChartConfig.pointsIn[idx]
                      if (!pt) return null
                      return (
                        <g key={`label-${idx}`}>
                          <text
                            x={pt.x}
                            y={energyChartConfig.height - 18}
                            textAnchor="middle"
                            className="at-chart-tick-text"
                            fontWeight={d.isToday ? '800' : '600'}
                            fill={d.isToday ? '#059669' : '#64748b'}
                          >
                            {d.dayLabel}
                          </text>
                          <text
                            x={pt.x}
                            y={energyChartConfig.height - 5}
                            textAnchor="middle"
                            fontSize="9.5"
                            fill="#94a3b8"
                          >
                            {d.formattedDate}
                          </text>
                        </g>
                      )
                    })}

                    {/* Tooltip */}
                    {energyTooltip && (
                      <g
                        transform={`translate(${Math.min(
                          Math.max(energyTooltip.x - 75, 10),
                          energyChartConfig.width - 165
                        )}, ${Math.max(energyTooltip.y - 90, 10)})`}
                      >
                        <rect
                          width="155"
                          height="82"
                          rx="8"
                          fill="#0f172a"
                          opacity="0.94"
                          filter="drop-shadow(0 4px 12px rgba(0,0,0,0.25))"
                        />
                        <text x="12" y="19" fill="#94a3b8" fontSize="10.5" fontWeight="600">
                          {energyTooltip.data.dayLabel} ({energyTooltip.data.formattedDate})
                        </text>
                        <text x="12" y="37" fill="#34d399" fontSize="11" fontWeight="700">
                          Nạp: {energyTooltip.data.caloriesIn.toLocaleString()} kcal
                        </text>
                        <text x="12" y="53" fill="#38bdf8" fontSize="11" fontWeight="700">
                          Đốt: {energyTooltip.data.caloriesBurned.toLocaleString()} kcal
                        </text>
                        <text x="12" y="70" fill="#f8fafc" fontSize="10.5">
                          {energyTooltip.data.deficit < 0
                            ? `Thâm hụt: ${Math.abs(energyTooltip.data.deficit)} kcal`
                            : `Thặng dư: +${energyTooltip.data.deficit} kcal`}
                        </text>
                      </g>
                    )}
                  </svg>

                  {/* Summary Strip */}
                  <div className="at-chart-summary-strip">
                    <div className="at-strip-item">
                      <span className="at-strip-label">Tổng calo nạp</span>
                      <span className="at-strip-value text-emerald-600">
                        {kpi.totalCaloriesIn ? kpi.totalCaloriesIn.toLocaleString() : 0} kcal
                      </span>
                    </div>
                    <div className="at-strip-item">
                      <span className="at-strip-label">Tổng calo đốt</span>
                      <span className="at-strip-value text-blue-600">
                        {kpi.totalCaloriesBurned ? kpi.totalCaloriesBurned.toLocaleString() : 0} kcal
                      </span>
                    </div>
                    <div className="at-strip-item">
                      <span className="at-strip-label">Ngày đạt mục tiêu</span>
                      <span className="at-strip-value">
                        {kpi.daysMeetingCalorieGoal || 0} / {daily.length} ngày
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* ── 3. HAI CỘT: DINH DƯỠNG (MACROS & BỮA ĂN) & VẬN ĐỘNG THỂ CHẤT ── */}
            <div className="at-columns-grid">
              {/* CỘT 1: CƠ CẤU DINH DƯỠNG & BỮA ĂN */}
              <section className="at-card">
                <div className="at-card__header">
                  <div className="at-card__title-group">
                    <h2>
                      <i className="bi bi-pie-chart" /> Cơ cấu Dinh dưỡng &amp; Bữa ăn
                    </h2>
                  </div>
                </div>

                <div className="at-nutrition-clean">
                  {/* Donut Chart & Legend */}
                  <div className="at-macro-donut-wrapper">
                    <div className="at-donut-svg-box">
                      <svg className="at-donut-svg" viewBox="0 0 140 140">
                        <circle
                          cx="70"
                          cy="70"
                          r={macroDonutConfig.radius}
                          fill="transparent"
                          stroke="#e2e8f0"
                          strokeWidth="15"
                        />
                        {macroDonutConfig.pDash > 0 && (
                          <circle
                            cx="70"
                            cy="70"
                            r={macroDonutConfig.radius}
                            fill="transparent"
                            stroke="#059669"
                            strokeWidth="15"
                            strokeDasharray={`${macroDonutConfig.pDash} ${macroDonutConfig.circumference - macroDonutConfig.pDash}`}
                            strokeDashoffset={macroDonutConfig.pOffset}
                            strokeLinecap="butt"
                            transform="rotate(-90 70 70)"
                          />
                        )}
                        {macroDonutConfig.cDash > 0 && (
                          <circle
                            cx="70"
                            cy="70"
                            r={macroDonutConfig.radius}
                            fill="transparent"
                            stroke="#f97316"
                            strokeWidth="15"
                            strokeDasharray={`${macroDonutConfig.cDash} ${macroDonutConfig.circumference - macroDonutConfig.cDash}`}
                            strokeDashoffset={macroDonutConfig.cOffset}
                            strokeLinecap="butt"
                            transform="rotate(-90 70 70)"
                          />
                        )}
                        {macroDonutConfig.fDash > 0 && (
                          <circle
                            cx="70"
                            cy="70"
                            r={macroDonutConfig.radius}
                            fill="transparent"
                            stroke="#eab308"
                            strokeWidth="15"
                            strokeDasharray={`${macroDonutConfig.fDash} ${macroDonutConfig.circumference - macroDonutConfig.fDash}`}
                            strokeDashoffset={macroDonutConfig.fOffset}
                            strokeLinecap="butt"
                            transform="rotate(-90 70 70)"
                          />
                        )}
                      </svg>
                      <div className="at-donut-center-label">
                        <span className="at-donut-pct">100%</span>
                        <span className="at-donut-sub">Macros</span>
                      </div>
                    </div>

                    <div className="at-macro-legend-col">
                      <div className="at-macro-legend-row">
                        <span className="at-legend-dot" style={{ background: '#059669' }} />
                        <div className="at-legend-desc">
                          <strong>Chất đạm</strong>
                          <small>{macroDonutConfig.pPct}% (Mục tiêu: {macros.targetPercentages?.protein || 25}%)</small>
                        </div>
                        <span className="at-legend-gram text-emerald-600">{macros.avgProtein || 0}g</span>
                      </div>

                      <div className="at-macro-legend-row">
                        <span className="at-legend-dot" style={{ background: '#f97316' }} />
                        <div className="at-legend-desc">
                          <strong>Tinh bột</strong>
                          <small>{macroDonutConfig.cPct}% (Mục tiêu: {macros.targetPercentages?.carbs || 50}%)</small>
                        </div>
                        <span className="at-legend-gram text-orange-600">{macros.avgCarbs || 0}g</span>
                      </div>

                      <div className="at-macro-legend-row">
                        <span className="at-legend-dot" style={{ background: '#eab308' }} />
                        <div className="at-legend-desc">
                          <strong>Chất béo</strong>
                          <small>{macroDonutConfig.fPct}% (Mục tiêu: {macros.targetPercentages?.fat || 25}%)</small>
                        </div>
                        <span className="at-legend-gram text-amber-600">{macros.avgFat || 0}g</span>
                      </div>
                    </div>
                  </div>

                  {/* Phân bổ calo theo 4 bữa */}
                  <div className="at-meal-section-clean">
                    <span className="at-section-label">Phân bổ calo theo 4 bữa:</span>
                    <div className="at-meal-stacked-bar">
                      <div
                        className="at-meal-bar-seg at-meal-bar-seg--bf"
                        style={{ width: `${mealBreakdown.breakfast?.percent || 25}%` }}
                        title={`Sáng: ${mealBreakdown.breakfast?.calories || 0} kcal`}
                      />
                      <div
                        className="at-meal-bar-seg at-meal-bar-seg--lu"
                        style={{ width: `${mealBreakdown.lunch?.percent || 40}%` }}
                        title={`Trưa: ${mealBreakdown.lunch?.calories || 0} kcal`}
                      />
                      <div
                        className="at-meal-bar-seg at-meal-bar-seg--di"
                        style={{ width: `${mealBreakdown.dinner?.percent || 25}%` }}
                        title={`Tối: ${mealBreakdown.dinner?.calories || 0} kcal`}
                      />
                      <div
                        className="at-meal-bar-seg at-meal-bar-seg--sn"
                        style={{ width: `${mealBreakdown.snack?.percent || 10}%` }}
                        title={`Phụ: ${mealBreakdown.snack?.calories || 0} kcal`}
                      />
                    </div>

                    <div className="at-meal-chips-row">
                      <div className="at-meal-chip">
                        <span className="at-meal-dot" style={{ background: '#0284c7' }} />
                        <span>Sáng: <strong>{mealBreakdown.breakfast?.calories || 0} kcal</strong> ({mealBreakdown.breakfast?.percent || 0}%)</span>
                      </div>
                      <div className="at-meal-chip">
                        <span className="at-meal-dot" style={{ background: '#10b981' }} />
                        <span>Trưa: <strong>{mealBreakdown.lunch?.calories || 0} kcal</strong> ({mealBreakdown.lunch?.percent || 0}%)</span>
                      </div>
                      <div className="at-meal-chip">
                        <span className="at-meal-dot" style={{ background: '#f59e0b' }} />
                        <span>Tối: <strong>{mealBreakdown.dinner?.calories || 0} kcal</strong> ({mealBreakdown.dinner?.percent || 0}%)</span>
                      </div>
                      <div className="at-meal-chip">
                        <span className="at-meal-dot" style={{ background: '#8b5cf6' }} />
                        <span>Phụ: <strong>{mealBreakdown.snack?.calories || 0} kcal</strong> ({mealBreakdown.snack?.percent || 0}%)</span>
                      </div>
                    </div>
                  </div>


                </div>
              </section>

              {/* CỘT 2: THỜI LƯỢNG & HOẠT ĐỘNG THỂ CHẤT */}
              <section className="at-card">
                <div className="at-card__header">
                  <div className="at-card__title-group">
                    <h2>
                      <i className="bi bi-lightning-charge-fill" /> Thời lượng Vận động Thể chất
                    </h2>
                  </div>
                  <div className="at-chart-legend">
                    <span className="at-legend-item">
                      <span className="at-legend-color" style={{ background: '#10b981' }} />
                      Đạt chuẩn (&ge;30p)
                    </span>
                    <span className="at-legend-item">
                      <span className="at-legend-line" style={{ background: '#059669', borderTop: '2px dashed #059669' }} />
                      Mốc WHO (30p/ngày)
                    </span>
                  </div>
                </div>

                <div className="at-fitness-clean">
                  {workoutChartConfig && (
                    <div
                      className="at-workout-chart-box"
                      onMouseLeave={() => setWorkoutTooltip(null)}
                    >
                      <svg
                        className="at-chart-svg"
                        viewBox={`0 0 ${workoutChartConfig.width} ${workoutChartConfig.height}`}
                        preserveAspectRatio="xMidYMid meet"
                      >
                        {workoutChartConfig.gridTicks.map((tick, idx) => (
                          <g key={`w-grid-${idx}`}>
                            <line
                              x1={workoutChartConfig.padLeft}
                              y1={tick.y}
                              x2={workoutChartConfig.width - workoutChartConfig.padRight}
                              y2={tick.y}
                              className="at-chart-grid-line"
                            />
                            <text
                              x={workoutChartConfig.padLeft - 6}
                              y={tick.y + 4}
                              textAnchor="end"
                              className="at-chart-tick-text"
                            >
                              {tick.val}p
                            </text>
                          </g>
                        ))}

                        {/* WHO 30 mins Line */}
                        <line
                          x1={workoutChartConfig.padLeft}
                          y1={workoutChartConfig.targetY}
                          x2={workoutChartConfig.width - workoutChartConfig.padRight}
                          y2={workoutChartConfig.targetY}
                          stroke="#059669"
                          strokeWidth="1.8"
                          strokeDasharray="4 4"
                        />

                        {workoutChartConfig.bars.map((bar, idx) => (
                          <g key={`w-bar-${idx}`}>
                            <rect
                              x={bar.x}
                              y={bar.y}
                              width={bar.w}
                              height={bar.h}
                              rx="5"
                              fill={bar.mins === 0 ? '#e2e8f0' : bar.meetsTarget ? '#10b981' : '#0284c7'}
                              cursor="pointer"
                              onMouseEnter={() =>
                                setWorkoutTooltip({
                                  ...bar,
                                  chartX: bar.cx,
                                  chartY: bar.y,
                                })
                              }
                            />
                            <text
                              x={bar.cx}
                              y={workoutChartConfig.height - 18}
                              textAnchor="middle"
                              className="at-chart-tick-text"
                              fontWeight={bar.isToday ? '800' : '600'}
                              fill={bar.isToday ? '#059669' : '#64748b'}
                            >
                              {bar.dayLabel}
                            </text>
                            <text
                              x={bar.cx}
                              y={workoutChartConfig.height - 5}
                              textAnchor="middle"
                              fontSize="9"
                              fill="#94a3b8"
                            >
                              {bar.formattedDate}
                            </text>
                          </g>
                        ))}

                        {workoutTooltip && (
                          <g
                            transform={`translate(${Math.min(
                              Math.max(workoutTooltip.chartX - 65, 10),
                              workoutChartConfig.width - 145
                            )}, ${Math.max(workoutTooltip.chartY - 75, 10)})`}
                          >
                            <rect
                              width="130"
                              height="65"
                              rx="8"
                              fill="#0f172a"
                              opacity="0.94"
                            />
                            <text x="10" y="18" fill="#94a3b8" fontSize="10" fontWeight="600">
                              {workoutTooltip.dayLabel} ({workoutTooltip.formattedDate})
                            </text>
                            <text x="10" y="34" fill="#38bdf8" fontSize="11" fontWeight="700">
                              Thời lượng: {workoutTooltip.mins} phút
                            </text>
                            <text x="10" y="50" fill="#34d399" fontSize="10.5">
                              Đốt: {workoutTooltip.caloriesBurned.toLocaleString()} kcal
                            </text>
                          </g>
                        )}
                      </svg>
                    </div>
                  )}

                  {/* Top Exercises Clean Strip */}
                  {exercises.topExercises && exercises.topExercises.length > 0 && (
                    <div className="at-top-ex-clean-row">
                      {exercises.topExercises.slice(0, 3).map((ex, idx) => (
                        <div className="at-top-ex-badge" key={`top-ex-${idx}`}>
                          <i className="bi bi-lightning-fill text-orange-500" />
                          <span><strong>{ex.name}</strong> ({ex.minutes}p • {ex.calories} kcal)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* ── 4. HAI CỘT: HOẠT ĐỘNG THEO THỨ & THỂ TRẠNG BMI ── */}
            <div className="at-columns-grid">
              {/* CỘT 1: NHỊP ĐIỆU THEO THỨ TRONG TUẦN */}
              <section className="at-card">
                <div className="at-card__header">
                  <div className="at-card__title-group">
                    <h2>
                      <i className="bi bi-calendar-week-fill" /> So sánh các ngày trong tuần
                    </h2>
                  </div>
                  <div className="at-chart-legend">
                    <span className="at-legend-item">
                      <span className="at-legend-color" style={{ background: '#10b981' }} />
                      Calo nạp
                    </span>
                    <span className="at-legend-item">
                      <span className="at-legend-color" style={{ background: '#0284c7' }} />
                      Calo đốt
                    </span>
                  </div>
                </div>

                {dowChartConfig && (
                  <div
                    className="at-dow-chart-container"
                    onMouseLeave={() => setDowTooltip(null)}
                  >
                    <svg
                      className="at-chart-svg"
                      viewBox={`0 0 ${dowChartConfig.width} ${dowChartConfig.height}`}
                      preserveAspectRatio="xMidYMid meet"
                    >
                      {dowChartConfig.gridTicks.map((tick, idx) => (
                        <g key={`dow-grid-${idx}`}>
                          <line
                            x1={dowChartConfig.padLeft}
                            y1={tick.y}
                            x2={dowChartConfig.width - dowChartConfig.padRight}
                            y2={tick.y}
                            className="at-chart-grid-line"
                          />
                          <text
                            x={dowChartConfig.padLeft - 6}
                            y={tick.y + 4}
                            textAnchor="end"
                            className="at-chart-tick-text"
                          >
                            {tick.val}
                          </text>
                        </g>
                      ))}

                      {/* Calorie Target line */}
                      <line
                        x1={dowChartConfig.padLeft}
                        y1={dowChartConfig.targetY}
                        x2={dowChartConfig.width - dowChartConfig.padRight}
                        y2={dowChartConfig.targetY}
                        stroke="#8b5cf6"
                        strokeWidth="1.6"
                        strokeDasharray="4 4"
                      />

                      {dowChartConfig.groups.map((g, idx) => (
                        <g key={`dow-g-${idx}`}>
                          <rect
                            x={g.xIn}
                            y={g.yIn}
                            width={g.wIn}
                            height={g.hIn}
                            rx="4"
                            fill={g.calIn > dowChartConfig.targetCal ? '#f97316' : '#10b981'}
                            cursor="pointer"
                            onMouseEnter={() =>
                              setDowTooltip({
                                dayLabel: g.dayLabel,
                                calIn: g.calIn,
                                calBurn: g.calBurn,
                                x: g.groupCenter,
                                y: Math.min(g.yIn, g.yBurn),
                              })
                            }
                          />

                          <rect
                            x={g.xBurn}
                            y={g.yBurn}
                            width={g.wBurn}
                            height={g.hBurn}
                            rx="4"
                            fill="#0284c7"
                            cursor="pointer"
                            onMouseEnter={() =>
                              setDowTooltip({
                                dayLabel: g.dayLabel,
                                calIn: g.calIn,
                                calBurn: g.calBurn,
                                x: g.groupCenter,
                                y: Math.min(g.yIn, g.yBurn),
                              })
                            }
                          />

                          <text
                            x={g.groupCenter}
                            y={dowChartConfig.height - 14}
                            textAnchor="middle"
                            className="at-chart-tick-text"
                            fontWeight={g.isWeekend ? '800' : '600'}
                            fill={g.isWeekend ? '#ea580c' : '#334155'}
                          >
                            {g.dayLabel}
                          </text>
                        </g>
                      ))}

                      {dowTooltip && (
                        <g
                          transform={`translate(${Math.min(
                            Math.max(dowTooltip.x - 70, 10),
                            dowChartConfig.width - 150
                          )}, ${Math.max(dowTooltip.y - 75, 10)})`}
                        >
                          <rect
                            width="140"
                            height="68"
                            rx="8"
                            fill="#0f172a"
                            opacity="0.94"
                          />
                          <text x="10" y="18" fill="#94a3b8" fontSize="10.5" fontWeight="600">
                            Thứ: {dowTooltip.dayLabel}
                          </text>
                          <text x="10" y="34" fill="#34d399" fontSize="11" fontWeight="700">
                            Nạp: {dowTooltip.calIn.toLocaleString()} kcal
                          </text>
                          <text x="10" y="50" fill="#38bdf8" fontSize="11" fontWeight="700">
                            Đốt: {dowTooltip.calBurn.toLocaleString()} kcal
                          </text>
                        </g>
                      )}
                    </svg>
                  </div>
                )}
              </section>

              {/* CỘT 2: THỂ TRẠNG & THƯỚC ĐO BMI Y KHOA */}
              <section className="at-card">
                <div className="at-card__header">
                  <div className="at-card__title-group">
                    <h2>
                      <i className="bi bi-speedometer2" /> Thể trạng &amp; Thước đo BMI
                    </h2>
                  </div>
                  <Link to="/weight-tracker" className="at-link-sm">
                    Chi tiết &rarr;
                  </Link>
                </div>

                <div className="at-body-clean">
                  <div className="at-weight-stats-clean">
                    <div className="at-weight-box-sm">
                      <span className="at-weight-box__label">Cân đầu kỳ</span>
                      <div className="at-weight-box__val">{weight.initialWeight || '-'} kg</div>
                    </div>
                    <div className="at-weight-box-sm">
                      <span className="at-weight-box__label">Cân hiện tại</span>
                      <div className="at-weight-box__val text-emerald-600">{weight.currentWeight || '-'} kg</div>
                    </div>
                    <div className="at-weight-box-sm">
                      <span className="at-weight-box__label">Biến thiên</span>
                      <div className="at-weight-box__val">
                        {weight.weightChange != null ? (
                          <span style={{ color: weight.weightChange <= 0 ? '#059669' : '#ea580c' }}>
                            {weight.weightChange > 0 ? `+${weight.weightChange}` : weight.weightChange} kg
                          </span>
                        ) : '-'}
                      </div>
                    </div>
                    <div className="at-weight-box-sm">
                      <span className="at-weight-box__label">Mục tiêu</span>
                      <div className="at-weight-box__val">
                        {weight.targetWeight ? `${weight.targetWeight} kg` : '-'}
                      </div>
                    </div>
                  </div>

                  {/* BMI Gauge */}
                  <div className="at-bmi-gauge-card-clean">
                    <div className="at-bmi-gauge-header-clean">
                      <div className="at-bmi-score-row">
                        <span className="at-bmi-number">{weight.bmi || '-'}</span>
                        <span className={`at-badge ${weight.bmiCategory === 'Bình thường' ? 'at-badge--success' : 'at-badge--warning'}`}>
                          {weight.bmiCategory || 'Bình thường'}
                        </span>
                      </div>
                      <div className="at-ideal-range-note">
                        <span>Cân nặng chuẩn: <strong>{weight.minHealthyWeight || 50} — {weight.maxHealthyWeight || 65} kg</strong></span>
                      </div>
                    </div>

                    <div className="at-bmi-track-wrapper">
                      <div className="at-bmi-track">
                        {weight.bmi && (
                          <div
                            className="at-bmi-pin"
                            style={{
                              left: `${Math.min(98, Math.max(2, ((weight.bmi - 15) / 15) * 100))}%`,
                            }}
                            title={`BMI: ${weight.bmi}`}
                          >
                            <span className="at-bmi-pin-bubble">{weight.bmi}</span>
                          </div>
                        )}
                      </div>

                      <div className="at-bmi-labels">
                        <span className="at-bmi-zone--under">&lt;18.5 Thiếu cân</span>
                        <span className="at-bmi-zone--normal">18.5 - 22.9 Chuẩn</span>
                        <span className="at-bmi-zone--over">23 - 24.9 Thừa cân</span>
                        <span className="at-bmi-zone--obese">&ge;25 Béo phì</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>


          </>
        )}
      </main>

      {/* ── FOOTER ── */}
      <UserFooter />
    </div>
  )
}
