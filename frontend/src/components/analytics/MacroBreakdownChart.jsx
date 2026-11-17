import React, { useMemo } from 'react'

export default function MacroBreakdownChart({ macros = {} }) {
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

  return (
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
  )
}
