import React from 'react'
import { formatLogDate, formatLogTime } from '../../constants/healthConstants'

export default function WeightChart({
  timeframe,
  setTimeframe,
  weightLogs,
  chartData,
  activePoint,
  setActivePoint,
  stats,
  openDialog,
}) {
  return (
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
                  y={
                    chartData.points[0].y > chartData.paddingTop + chartData.plotHeight * 0.65
                      ? chartData.points[0].y - 20
                      : chartData.points[0].y + 36
                  }
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
  )
}
