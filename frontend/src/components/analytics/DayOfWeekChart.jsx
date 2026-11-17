import React, { useMemo, useState } from 'react'

export default function DayOfWeekChart({ dow = [], calorieTarget = 2000 }) {
  const [dowTooltip, setDowTooltip] = useState(null)

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

    const targetCal = calorieTarget || 2000
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
        groupCenter,
        xIn: groupCenter - singleBarW - gap / 2,
        yIn,
        wIn: singleBarW,
        hIn: Math.max(2, hIn),
        xBurn: groupCenter + gap / 2,
        yBurn,
        wBurn: singleBarW,
        hBurn: Math.max(2, hBurn),
        isWeekend: d.dayLabel === 'CN' || d.dayLabel === 'T7',
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
      targetCal,
      groups,
      gridTicks,
    }
  }, [dow, calorieTarget])

  if (!dowChartConfig) return null

  return (
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
  )
}
