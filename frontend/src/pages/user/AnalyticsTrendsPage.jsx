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
  const [activeTooltip, setActiveTooltip] = useState(null)
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
  const insights = analyticsData?.smartInsights || []

  // Tính toán tọa độ biểu đồ SVG Năng lượng & Calo (Canvas widescreen 1100x280)
  const chartConfig = useMemo(() => {
    if (!daily || daily.length === 0) return null

    const width = 1100
    const height = 280
    const padLeft = 60
    const padRight = 35
    const padTop = 30
    const padBottom = 40

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

    // Path builder (Smooth Curve)
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

    // Grid ticks (5 horizontal lines)
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

  return (
    <div className="at-shell">
      {/* ── HEADER NAVIGATION BAR (FULL SCREEN EDGE-TO-EDGE) ── */}
      <UserHeader />

      {/* ── MAIN CONTENT CONTAINER (FULL SCREEN FLUID) ── */}
      <main className="at-container">
        {/* ── REDESIGNED EXECUTIVE PAGE HEADER ── */}
        <section className="at-hero">
          <div className="at-hero__left">
            <div className="at-hero__badge-icon">
              <i className="bi bi-graph-up-arrow" />
            </div>
            <div className="at-hero__title-wrap">
              <div className="at-hero__title-row">
                <h1>Chỉ số &amp; Xu hướng</h1>
                <span className="at-hero__status-pill">
                  <span className="at-live-dot" /> Dữ liệu cập nhật
                </span>
              </div>
              <p className="at-hero__subtitle">
                Báo cáo phân tích chuyên sâu về năng lượng, vi chất dinh dưỡng, thể chất và biến thiên thể trạng
              </p>
              {analyticsData?.startDate && analyticsData?.endDate && (
                <div className="at-hero__meta-row">
                  <span className="at-meta-item">
                    <i className="bi bi-calendar3" />
                    Chu kỳ: <strong>{formatDateVi(analyticsData.startDate)} — {formatDateVi(analyticsData.endDate)}</strong>
                  </span>
                  <span className="at-meta-divider">•</span>
                  <span className="at-meta-item">
                    <i className="bi bi-clock-history" />
                    <strong>{analyticsData.numDays} ngày</strong> phân tích
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="at-hero__right">
            {/* Segmented Timeframe Control */}
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

        {/* Loading State */}
        {loading && (
          <div className="at-loading-skeleton">
            <div className="at-skeleton-box" style={{ height: '110px' }} />
            <div className="at-skeleton-box" style={{ height: '340px' }} />
            <div className="at-skeleton-box" style={{ height: '240px' }} />
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

        {/* Content Body */}
        {!loading && !error && analyticsData && (
          <>
            {/* 1. KPI SUMMARY CARDS */}
            <section className="at-kpi-grid">
              {/* Calo nạp trung bình */}
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
                  </div>
                </div>
              </div>

              {/* Tiêu hao từ tập luyện */}
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

              {/* Cân bằng năng lượng (Net Deficit) */}
              <div className="at-kpi-card">
                <div className="at-kpi-card__top">
                  <span className="at-kpi-card__label">Cân bằng năng lượng</span>
                  <span className="at-kpi-card__icon at-kpi-card__icon--blue">
                    <i className="bi bi-arrow-left-right" />
                  </span>
                </div>
                <div>
                  <div className="at-kpi-card__value">
                    {kpi.avgDeficit != null ? (kpi.avgDeficit > 0 ? `+${kpi.avgDeficit}` : kpi.avgDeficit) : 0}
                    <small>kcal/ngày</small>
                  </div>
                  <div className="at-kpi-card__sub">
                    {kpi.avgDeficit < 0 ? (
                      <span className="at-badge at-badge--success">
                        <i className="bi bi-arrow-down-right" /> Thâm hụt calo
                      </span>
                    ) : kpi.avgDeficit > 150 ? (
                      <span className="at-badge at-badge--warning">
                        <i className="bi bi-arrow-up-right" /> Thặng dư calo
                      </span>
                    ) : (
                      <span className="at-badge at-badge--info">
                        <i className="bi bi-check-circle" /> Cân bằng
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Kỷ luật ghi nhận & Chuỗi */}
              <div className="at-kpi-card">
                <div className="at-kpi-card__top">
                  <span className="at-kpi-card__label">Kỷ luật ghi chép</span>
                  <span className="at-kpi-card__icon at-kpi-card__icon--purple">
                    <i className="bi bi-calendar-check-fill" />
                  </span>
                </div>
                <div>
                  <div className="at-kpi-card__value">
                    {kpi.consistencyPercent || 0}
                    <small>% ({kpi.daysLogged || 0}/{kpi.totalDays || 7} ngày)</small>
                  </div>
                  <div className="at-kpi-card__sub">
                    Chuỗi: <strong>{kpi.streak || 0} ngày liên tiếp 🔥</strong>
                  </div>
                </div>
              </div>

              {/* Cân nặng & BMI */}
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

            {/* 2. BIỂU ĐỒ CÂN BẰNG NĂNG LƯỢNG (INTERACTIVE ENERGY CHART) */}
            <section className="at-card">
              <div className="at-card__header">
                <div className="at-card__title-group">
                  <h2>
                    <i className="bi bi-activity" /> Biểu đồ Xu hướng Năng lượng &amp; Calo
                  </h2>
                  <p>So sánh calo nạp vào thực tế, calo đốt cháy và đường mục tiêu hàng ngày</p>
                </div>
                <div className="at-chart-legend">
                  <span className="at-legend-item">
                    <span className="at-legend-color" style={{ background: '#10b981' }} />
                    Calo nạp vào (Ăn uống)
                  </span>
                  <span className="at-legend-item">
                    <span className="at-legend-color" style={{ background: '#0284c7' }} />
                    Calo tiêu hao (Tập luyện)
                  </span>
                  <span className="at-legend-item">
                    <span className="at-legend-line" style={{ background: '#a855f7', borderTop: '2px dashed #a855f7' }} />
                    Mục tiêu ({kpi.calorieTarget || 2000} kcal)
                  </span>
                </div>
              </div>

              {/* SVG Chart */}
              {chartConfig && (
                <div
                  className="at-chart-container"
                  ref={chartContainerRef}
                  onMouseLeave={() => setActiveTooltip(null)}
                >
                  <svg
                    className="at-chart-svg"
                    viewBox={`0 0 ${chartConfig.width} ${chartConfig.height}`}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <defs>
                      <linearGradient id="atCaloInGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.32" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Gridlines */}
                    {chartConfig.gridTicks.map((tick, idx) => (
                      <g key={`grid-${idx}`}>
                        <line
                          x1={chartConfig.padLeft}
                          y1={tick.y}
                          x2={chartConfig.width - chartConfig.padRight}
                          y2={tick.y}
                          className="at-chart-grid-line"
                        />
                        <text
                          x={chartConfig.padLeft - 8}
                          y={tick.y + 4}
                          textAnchor="end"
                          className="at-chart-tick-text"
                        >
                          {tick.val}
                        </text>
                      </g>
                    ))}

                    {/* Target Calorie Line */}
                    {chartConfig.targetY != null && (
                      <g>
                        <line
                          x1={chartConfig.padLeft}
                          y1={chartConfig.targetY}
                          x2={chartConfig.width - chartConfig.padRight}
                          y2={chartConfig.targetY}
                          className="at-chart-target-line"
                        />
                        <text
                          x={chartConfig.width - chartConfig.padRight - 4}
                          y={chartConfig.targetY - 6}
                          textAnchor="end"
                          fill="#a855f7"
                          fontSize="10.5"
                          fontWeight="700"
                        >
                          Mục tiêu {kpi.calorieTarget} kcal
                        </text>
                      </g>
                    )}

                    {/* Calories In Area */}
                    {chartConfig.areaInD && (
                      <path d={chartConfig.areaInD} fill="url(#atCaloInGrad)" />
                    )}

                    {/* Calories In Line */}
                    {chartConfig.pathInD && (
                      <path
                        d={chartConfig.pathInD}
                        fill="none"
                        stroke="#059669"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                      />
                    )}

                    {/* Calories Burned Line */}
                    {chartConfig.pathBurnedD && (
                      <path
                        d={chartConfig.pathBurnedD}
                        fill="none"
                        stroke="#0284c7"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                      />
                    )}

                    {/* Interactive Points and Hover targets */}
                    {chartConfig.pointsIn.map((pt, idx) => (
                      <g key={`point-in-${idx}`}>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={activeTooltip?.index === idx ? 6 : 4}
                          fill="#ffffff"
                          stroke="#059669"
                          strokeWidth="2.5"
                        />
                        {/* Invisible larger hover circle */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="18"
                          fill="transparent"
                          cursor="pointer"
                          onMouseEnter={() =>
                            setActiveTooltip({
                              index: idx,
                              data: pt.data,
                              x: pt.x,
                              y: Math.min(pt.y, chartConfig.pointsBurned[idx]?.y || pt.y),
                            })
                          }
                        />
                      </g>
                    ))}

                    {chartConfig.pointsBurned.map((pt, idx) => (
                      <circle
                        key={`point-burned-${idx}`}
                        cx={pt.x}
                        cy={pt.y}
                        r={activeTooltip?.index === idx ? 5 : 3.5}
                        fill="#ffffff"
                        stroke="#0284c7"
                        strokeWidth="2.2"
                      />
                    ))}

                    {/* Bottom Date Labels */}
                    {daily.map((d, idx) => {
                      const pt = chartConfig.pointsIn[idx]
                      if (!pt) return null
                      return (
                        <g key={`label-${idx}`}>
                          <text
                            x={pt.x}
                            y={chartConfig.height - 18}
                            textAnchor="middle"
                            className="at-chart-tick-text"
                            fontWeight={d.isToday ? '800' : '600'}
                            fill={d.isToday ? '#059669' : '#64748b'}
                          >
                            {d.dayLabel}
                          </text>
                          <text
                            x={pt.x}
                            y={chartConfig.height - 5}
                            textAnchor="middle"
                            fontSize="9.5"
                            fill="#94a3b8"
                          >
                            {d.formattedDate}
                          </text>
                        </g>
                      )
                    })}

                    {/* Active Tooltip Popover */}
                    {activeTooltip && (
                      <g
                        transform={`translate(${Math.min(
                          Math.max(activeTooltip.x - 70, 10),
                          chartConfig.width - 150
                        )}, ${Math.max(activeTooltip.y - 85, 10)})`}
                      >
                        <rect
                          width="140"
                          height="75"
                          rx="8"
                          fill="#0f172a"
                          opacity="0.94"
                        />
                        <text x="12" y="18" fill="#94a3b8" fontSize="10" fontWeight="600">
                          {activeTooltip.data.dayLabel} ({activeTooltip.data.formattedDate})
                        </text>
                        <text x="12" y="34" fill="#34d399" fontSize="11" fontWeight="700">
                          Nạp: {activeTooltip.data.caloriesIn} kcal
                        </text>
                        <text x="12" y="50" fill="#38bdf8" fontSize="11" fontWeight="700">
                          Đốt: {activeTooltip.data.caloriesBurned} kcal
                        </text>
                        <text x="12" y="66" fill="#cbd5e1" fontSize="10.5">
                          {activeTooltip.data.deficit < 0
                            ? `Thâm hụt: ${Math.abs(activeTooltip.data.deficit)} kcal`
                            : `Thặng dư: +${activeTooltip.data.deficit} kcal`}
                        </text>
                      </g>
                    )}
                  </svg>

                  {/* Summary Strip below chart */}
                  <div className="at-chart-summary-strip">
                    <div className="at-strip-item">
                      <span className="at-strip-label">Tổng calo nạp kỳ này</span>
                      <span className="at-strip-value text-emerald-600">
                        {kpi.totalCaloriesIn ? kpi.totalCaloriesIn.toLocaleString() : 0} kcal
                      </span>
                    </div>
                    <div className="at-strip-item">
                      <span className="at-strip-label">Tổng calo đốt tập luyện</span>
                      <span className="at-strip-value text-blue-600">
                        {kpi.totalCaloriesBurned ? kpi.totalCaloriesBurned.toLocaleString() : 0} kcal
                      </span>
                    </div>
                    <div className="at-strip-item">
                      <span className="at-strip-label">Thâm hụt ròng dự kiến</span>
                      <span className="at-strip-value">
                        {kpi.projectedWeightChangeKg < 0 ? (
                          <span style={{ color: '#059669' }}>
                            Giảm ~{Math.abs(kpi.projectedWeightChangeKg)} kg mỡ
                          </span>
                        ) : kpi.projectedWeightChangeKg > 0 ? (
                          <span style={{ color: '#ea580c' }}>
                            Tăng ~{kpi.projectedWeightChangeKg} kg
                          </span>
                        ) : (
                          'Cân bằng ổn định'
                        )}
                      </span>
                    </div>
                    <div className="at-strip-item">
                      <span className="at-strip-label">Số ngày đạt mục tiêu</span>
                      <span className="at-strip-value">
                        {kpi.daysMeetingCalorieGoal || 0} / {daily.length} ngày
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* 3. TWO COLUMNS: MACRO BREAKDOWN & WORKOUT ANALYSIS */}
            <div className="at-columns-grid">
              {/* CỘT TRÁI: ĐA LƯỢNG MACROS & DINH DƯỠNG */}
              <section className="at-card">
                <div className="at-card__header">
                  <div className="at-card__title-group">
                    <h2>
                      <i className="bi bi-pie-chart" /> Phân bổ Đa lượng &amp; Vi chất
                    </h2>
                    <p>So sánh tỷ lệ thực tế trung bình mỗi ngày với khuyến nghị</p>
                  </div>
                </div>

                <div className="at-macro-bars">
                  {/* Protein */}
                  <div className="at-macro-item">
                    <div className="at-macro-item__header">
                      <span className="at-macro-item__label">
                        <span className="at-macro-item__dot" style={{ background: '#059669' }} />
                        Chất đạm (Protein)
                      </span>
                      <span className="at-macro-item__val">
                        {macros.avgProtein || 0}g
                        <small>/ {macros.targets?.proteinG || 125}g ({macros.actualPercentages?.protein || 0}%)</small>
                      </span>
                    </div>
                    <div className="at-progress-track">
                      <div
                        className="at-progress-fill"
                        style={{
                          width: `${Math.min(100, Math.round(((macros.avgProtein || 0) / (macros.targets?.proteinG || 125)) * 100))}%`,
                          background: '#059669',
                        }}
                      />
                    </div>
                  </div>

                  {/* Carbs */}
                  <div className="at-macro-item">
                    <div className="at-macro-item__header">
                      <span className="at-macro-item__label">
                        <span className="at-macro-item__dot" style={{ background: '#f97316' }} />
                        Tinh bột (Carbohydrates)
                      </span>
                      <span className="at-macro-item__val">
                        {macros.avgCarbs || 0}g
                        <small>/ {macros.targets?.carbsG || 250}g ({macros.actualPercentages?.carbs || 0}%)</small>
                      </span>
                    </div>
                    <div className="at-progress-track">
                      <div
                        className="at-progress-fill"
                        style={{
                          width: `${Math.min(100, Math.round(((macros.avgCarbs || 0) / (macros.targets?.carbsG || 250)) * 100))}%`,
                          background: '#f97316',
                        }}
                      />
                    </div>
                  </div>

                  {/* Fat */}
                  <div className="at-macro-item">
                    <div className="at-macro-item__header">
                      <span className="at-macro-item__label">
                        <span className="at-macro-item__dot" style={{ background: '#eab308' }} />
                        Chất béo (Fat)
                      </span>
                      <span className="at-macro-item__val">
                        {macros.avgFat || 0}g
                        <small>/ {macros.targets?.fatG || 55}g ({macros.actualPercentages?.fat || 0}%)</small>
                      </span>
                    </div>
                    <div className="at-progress-track">
                      <div
                        className="at-progress-fill"
                        style={{
                          width: `${Math.min(100, Math.round(((macros.avgFat || 0) / (macros.targets?.fatG || 55)) * 100))}%`,
                          background: '#eab308',
                        }}
                      />
                    </div>
                  </div>

                  {/* Fiber & Sodium Sub-card */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginTop: '8px' }}>
                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>Chất xơ trung bình</span>
                      <div style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                        {macros.avgFiber || 0} g
                        <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500 }}> (Chuẩn &gt;25g)</span>
                      </div>
                    </div>
                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600 }}>Natri (Muối) trung bình</span>
                      <div style={{ fontSize: '17px', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                        {macros.avgSodium || 0} mg
                        <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 500 }}> (&lt;2000mg)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* CỘT PHẢI: LUYỆN TẬP & THỂ CHẤT */}
              <section className="at-card">
                <div className="at-card__header">
                  <div className="at-card__title-group">
                    <h2>
                      <i className="bi bi-fire" /> Luyện tập &amp; Thể chất
                    </h2>
                    <p>Các bộ môn và bài tập đốt nhiều năng lượng nhất trong kỳ</p>
                  </div>
                </div>

                {exercises.topExercises && exercises.topExercises.length > 0 ? (
                  <div className="at-exercise-list">
                    {exercises.topExercises.map((ex, idx) => (
                      <div className="at-ex-row" key={`top-ex-${idx}`}>
                        <div className="at-ex-row__left">
                          <span className="at-ex-row__icon">
                            <i className="bi bi-lightning-fill" />
                          </span>
                          <div>
                            <div className="at-ex-row__title">{ex.name}</div>
                            <div className="at-ex-row__meta">
                              {ex.count} buổi • {ex.minutes} phút tập
                            </div>
                          </div>
                        </div>
                        <div className="at-ex-row__right">
                          <div className="at-ex-row__calories">{ex.calories.toLocaleString()} kcal</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="at-empty-state" style={{ padding: '24px 16px' }}>
                    <i className="bi bi-bicycle" style={{ fontSize: '36px' }} />
                    <p style={{ margin: '0 0 12px', fontSize: '13px' }}>
                      Chưa có ghi nhận bài tập nào trong chu kỳ này.
                    </p>
                    <Link to="/exercise" className="at-action-btn at-action-btn--primary">
                      <i className="bi bi-plus-circle" /> Ghi bài tập ngay
                    </Link>
                  </div>
                )}
              </section>
            </div>

            {/* 4. DAY OF WEEK ANALYSIS & THÓI QUEN THEO THỨ */}
            <section className="at-card">
              <div className="at-card__header">
                <div className="at-card__title-group">
                  <h2>
                    <i className="bi bi-calendar-week" /> Thói quen Dinh dưỡng theo Ngày trong tuần
                  </h2>
                  <p>Mức calo nạp vào trung bình từ Thứ Hai đến Chủ Nhật để phát hiện các ngày hay vượt mức</p>
                </div>
              </div>

              <div className="at-dow-grid">
                {dow.map((dItem, idx) => {
                  const maxDowCal = Math.max(kpi.calorieTarget || 2000, ...dow.map((d) => d.avgCaloriesIn || 0))
                  const barHeightPct = maxDowCal > 0 ? Math.round(((dItem.avgCaloriesIn || 0) / maxDowCal) * 100) : 0
                  const isHigh = dItem.avgCaloriesIn > (kpi.calorieTarget || 2000)

                  return (
                    <div className="at-dow-col" key={`dow-${idx}`}>
                      <div className="at-dow-bar-track" title={`${dItem.dayLabel}: ${dItem.avgCaloriesIn} kcal`}>
                        <div
                          className={`at-dow-bar-fill ${isHigh ? 'is-high' : ''}`}
                          style={{ height: `${Math.max(10, barHeightPct)}%` }}
                        />
                      </div>
                      <span className="at-dow-label">{dItem.dayLabel}</span>
                      <span className="at-dow-val">
                        {dItem.avgCaloriesIn ? `${dItem.avgCaloriesIn} kcal` : '-'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>

            {/* 5. THỂ TRẠNG, CÂN NẶNG & TIẾN TRÌNH CƠ THỂ */}
            <section className="at-card">
              <div className="at-card__header">
                <div className="at-card__title-group">
                  <h2>
                    <i className="bi bi-speedometer" /> Tiến trình Thể trạng &amp; Cân nặng
                  </h2>
                  <p>Theo dõi sự biến thiên cân nặng và vị trí trên thang đo BMI y khoa (WHO Châu Á)</p>
                </div>
                <Link to="/weight-tracker" className="at-action-btn">
                  <i className="bi bi-journal-plus" /> Xem chi tiết nhật ký cân nặng
                </Link>
              </div>

              <div className="at-weight-stats">
                <div className="at-weight-box">
                  <span className="at-weight-box__label">Cân nặng đầu kỳ</span>
                  <div className="at-weight-box__val">{weight.initialWeight || '-'} kg</div>
                </div>
                <div className="at-weight-box">
                  <span className="at-weight-box__label">Cân nặng hiện tại</span>
                  <div className="at-weight-box__val text-emerald-600">{weight.currentWeight || '-'} kg</div>
                </div>
                <div className="at-weight-box">
                  <span className="at-weight-box__label">Biến thiên kỳ này</span>
                  <div className="at-weight-box__val">
                    {weight.weightChange != null ? (
                      <span style={{ color: weight.weightChange <= 0 ? '#059669' : '#ea580c' }}>
                        {weight.weightChange > 0 ? `+${weight.weightChange}` : weight.weightChange} kg
                      </span>
                    ) : '-'}
                  </div>
                </div>
                <div className="at-weight-box">
                  <span className="at-weight-box__label">Cân nặng mục tiêu</span>
                  <div className="at-weight-box__val">
                    {weight.targetWeight ? `${weight.targetWeight} kg` : 'Chưa đặt'}
                  </div>
                </div>
              </div>

              {/* BMI Gauge */}
              <div className="at-bmi-gauge">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 750, color: '#0f172a' }}>
                    Chỉ số BMI hiện tại: <strong style={{ color: '#059669' }}>{weight.bmi || '-'}</strong>
                  </span>
                  <span className="at-badge at-badge--success">{weight.bmiCategory || 'Bình thường'}</span>
                </div>

                <div className="at-bmi-track">
                  {/* Pin position calculation (approx 15 to 30 BMI) */}
                  {weight.bmi && (
                    <div
                      className="at-bmi-pin"
                      style={{
                        left: `${Math.min(98, Math.max(2, ((weight.bmi - 15) / 15) * 100))}%`,
                      }}
                      title={`BMI: ${weight.bmi}`}
                    />
                  )}
                </div>

                <div className="at-bmi-labels">
                  <span>Thiếu cân (&lt;18.5)</span>
                  <span>Bình thường (18.5 - 22.9)</span>
                  <span>Thừa cân (23 - 24.9)</span>
                  <span>Béo phì (&ge;25)</span>
                </div>
              </div>
            </section>

            {/* 6. NHẬN ĐỊNH THÔNG MINH TỪ AI (SMART HEALTH INSIGHTS) */}
            <section className="at-card">
              <div className="at-card__header">
                <div className="at-card__title-group">
                  <h2>
                    <i className="bi bi-stars" /> Đánh giá &amp; Lời khuyên Cá nhân hóa
                  </h2>
                  <p>Hệ thống tự động phân tích các chỉ số trong kỳ và đưa ra khuyến nghị thực tế</p>
                </div>
              </div>

              <div className="at-insights-grid">
                {insights.map((ins, idx) => (
                  <div className={`at-insight-card at-insight-card--${ins.type}`} key={`ins-${idx}`}>
                    <span className="at-insight-card__icon">
                      <i className={`bi ${ins.icon || 'bi-info-circle'}`} />
                    </span>
                    <div className="at-insight-card__content">
                      <strong>{ins.title}</strong>
                      <p>{ins.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 7. PHÂN BỔ BỮA ĂN & MÓN PHỔ BIẾN */}
            {meals.topFoods && meals.topFoods.length > 0 && (
              <section className="at-card">
                <div className="at-card__header">
                  <div className="at-card__title-group">
                    <h2>
                      <i className="bi bi-basket" /> Món ăn Ghi nhận Nhiều nhất
                    </h2>
                    <p>Các món đóng góp nhiều năng lượng nhất trong nhật ký bữa ăn của bạn</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                  {meals.topFoods.map((f, idx) => (
                    <div
                      key={`top-food-${idx}`}
                      style={{
                        padding: '16px',
                        borderRadius: '14px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                      }}
                    >
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '12px',
                          background: '#ecfdf5',
                          color: '#059669',
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: '19px',
                          flexShrink: 0,
                        }}
                      >
                        <i className="bi bi-cup-hot" />
                      </div>
                      <div>
                        <strong style={{ fontSize: '14px', color: '#0f172a', display: 'block' }}>
                          {f.name}
                        </strong>
                        <small style={{ color: '#64748b' }}>
                          {f.count} lần • {f.calories.toLocaleString()} kcal
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* ── FOOTER ── */}
      <UserFooter />
    </div>
  )
}
