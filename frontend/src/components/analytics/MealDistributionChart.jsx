import React, { useMemo, useState } from 'react'

export default function MealDistributionChart({ mealBreakdown = {}, daily = [], exercises = {} }) {
  const [workoutTooltip, setWorkoutTooltip] = useState(null)

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

  return (
    <>
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

      {/* Biểu đồ vận động thể chất */}
      {workoutChartConfig && (
        <div
          className="at-workout-chart-box"
          style={{ marginTop: '20px' }}
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

      {/* Top Exercises */}
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
    </>
  )
}
