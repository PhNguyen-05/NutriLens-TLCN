import React, { useState } from 'react'

export default function WaterTrackerCard({
  currentMl = 1500,
  targetMl = 2000,
  onAddWater,
}) {
  const [localWater, setLocalWater] = useState(currentMl)
  const percent = Math.min(100, Math.round((localWater / targetMl) * 100))

  const handleAdd = (amount) => {
    const nextVal = localWater + amount
    setLocalWater(nextVal)
    onAddWater?.(nextVal)
  }

  return (
    <article className="content-panel water-tracker-card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <span style={{ fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#0284c7', fontWeight: 700 }}>
            Thủy hóa cơ thể
          </span>
          <h3 style={{ margin: '4px 0 0', fontSize: '1.1rem', color: '#0f172a' }}>Theo dõi nước uống</h3>
        </div>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
          <i className="bi bi-droplet-fill" style={{ fontSize: '20px' }} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
        <strong style={{ fontSize: '1.8rem', color: '#0284c7', fontWeight: 800 }}>{localWater}</strong>
        <span style={{ color: '#64748b', fontSize: '14px' }}>/ {targetMl} ml ({percent}%)</span>
      </div>

      <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{ width: `${percent}%`, height: '100%', background: '#0284c7', transition: 'width 0.3s ease' }} />
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          onClick={() => handleAdd(250)}
          style={{
            flex: 1,
            padding: '7px 0',
            border: '1px solid #bae6fd',
            background: '#f0f9ff',
            color: '#0369a1',
            borderRadius: '6px',
            fontSize: '12.5px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          +250 ml
        </button>
        <button
          type="button"
          onClick={() => handleAdd(500)}
          style={{
            flex: 1,
            padding: '7px 0',
            border: '1px solid #bae6fd',
            background: '#f0f9ff',
            color: '#0369a1',
            borderRadius: '6px',
            fontSize: '12.5px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          +500 ml
        </button>
      </div>
    </article>
  )
}
