import React, { useMemo, useState, useRef } from 'react'

export default function EnergyTrendChart({ daily = [], calorieTarget = 2000, kpi = {} }) {
  const [energyTooltip, setEnergyTooltip] = useState(null)
  const chartContainerRef = useRef(null)

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

    const targetCal = calorieTarget || 2000
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
  }, [daily, calorieTarget])

  if (!energyChartConfig) return null

  return (
    <section className="at-card at-card--full">
      <div className="at-card__header">
        <div className="at-card__title-group">
          <h2>
            <i className="bi bi-graph-up-arrow" /> Diễn biến Calo nạp vs Calo tiêu hao
          </h2>
          <span className="at-card__subtitle">
            Theo dõi xu hướng cân bằng năng lượng và mức độ bám sát mục tiêu
          </span>
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
            Mục tiêu ({calorieTarget} kcal)
          </span>
        </div>
      </div>

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
                Mục tiêu {calorieTarget} kcal
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
              key={`point-burn-${idx}`}
              cx={pt.x}
              cy={pt.y}
              r="3.5"
              fill="#ffffff"
              stroke="#0284c7"
              strokeWidth="2"
            />
          ))}

          {/* X Axis Labels */}
          {energyChartConfig.pointsIn.map((pt, idx) => (
            <g key={`x-lbl-${idx}`}>
              <text
                x={pt.x}
                y={energyChartConfig.height - 22}
                textAnchor="middle"
                className="at-chart-tick-text"
                fontWeight={pt.data.isToday ? '800' : '600'}
                fill={pt.data.isToday ? '#059669' : '#64748b'}
              >
                {pt.data.dayLabel}
              </text>
              <text
                x={pt.x}
                y={energyChartConfig.height - 8}
                textAnchor="middle"
                fontSize="9"
                fill="#94a3b8"
              >
                {pt.data.formattedDate}
              </text>
            </g>
          ))}

          {/* Interactive Tooltip */}
          {energyTooltip && (
            <g
              transform={`translate(${Math.min(
                Math.max(energyTooltip.x - 75, 10),
                energyChartConfig.width - 165
              )}, ${Math.max(energyTooltip.y - 95, 10)})`}
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
    </section>
  )
}
