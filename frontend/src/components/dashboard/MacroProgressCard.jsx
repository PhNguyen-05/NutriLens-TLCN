import React, { useState, useEffect } from 'react'

function AnimatedNumber({ value, duration = 600 }) {
  const [displayValue, setDisplayValue] = useState(0)
  const target = typeof value === 'number' ? value : parseInt(String(value).replace(/\D/g, ''), 10) || 0

  useEffect(() => {
    if (target === 0) {
      setDisplayValue(0)
      return
    }
    const startTime = performance.now()
    let frameId

    const step = (now) => {
      const progress = Math.min((now - startTime) / duration, 1)
      const easeOut = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(Math.floor(easeOut * target))
      if (progress < 1) {
        frameId = requestAnimationFrame(step)
      } else {
        setDisplayValue(target)
      }
    }

    frameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameId)
  }, [target, duration])

  return <span>{displayValue.toLocaleString('vi-VN')}</span>
}

export function MetricCardSkeleton() {
  return (
    <article className="metric-card metric-skeleton">
      <div className="skeleton-box skeleton-icon" />
      <div className="skeleton-box skeleton-label" />
      <div className="skeleton-box skeleton-value" />
      <div className="skeleton-box skeleton-progress" />
      <div className="skeleton-box skeleton-note" />
    </article>
  )
}

export default function MacroProgressCard({ dynamicMetrics = [], statsLoading = false }) {
  return (
    <section className="metric-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
      {statsLoading ? (
        <>
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </>
      ) : (
        dynamicMetrics.map((item) => (
          <article className={`metric-card ${item.theme}`} key={item.label}>
            <div className={`metric-icon ${item.theme}`}>
              <i className={`bi ${item.icon}`} />
            </div>
            <span>{item.label}</span>
            <strong>
              <AnimatedNumber value={item.numericVal} />
              {item.unit && <span style={{ marginLeft: '2px', fontSize: '18px' }}>{item.unit}</span>}
              <small>{item.targetStr}</small>
            </strong>
            <div className="metric-progress">
              <i style={{ width: item.progress }} className={item.theme} />
            </div>
            <em className={item.theme}>{item.progressText || `${item.progress} mục tiêu`}</em>
            <small>{item.note}</small>
          </article>
        ))
      )}
    </section>
  )
}
