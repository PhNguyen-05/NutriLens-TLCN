import React from 'react'
import { Link } from 'react-router-dom'

export default function CalorieGaugeCard({
  weeklyDays = [],
  selectedDate,
  onSelectDate,
  maxCaloInWeek = 2500,
  statsLoading = false,
  avgDeficit = 0,
  caloPct = 0,
  eatenCalo = 0,
  targetCalo = 2000,
  healthProfile,
}) {
  return (
    <article className="content-panel chart-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Chuyển hóa &amp; Xu hướng</span>
          <h2>Cân bằng năng lượng tuần: Nạp vào vs Tiêu hao</h2>
          <p>Dữ liệu tổng hợp 7 ngày gần nhất giữa bữa ăn và vận động</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div className="chart-legend">
            <span>Nạp vào (kcal)</span>
            <span>Tiêu hao (kcal)</span>
          </div>
          <Link
            to="/trends"
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#059669',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: '#ecfdf5',
              padding: '4px 10px',
              borderRadius: '9999px',
              border: '1px solid #a7f3d0',
            }}
          >
            Chỉ số &amp; Xu hướng <i className="bi bi-arrow-right" />
          </Link>
        </div>
      </div>

      {statsLoading ? (
        <div style={{ height: '128px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', gap: '8px' }}>
          <i className="bi bi-arrow-repeat spin" />
          <span style={{ fontSize: '0.85rem' }}>Đang tổng hợp dữ liệu chuyển hóa tuần...</span>
        </div>
      ) : (
        <div className="bar-chart">
          {weeklyDays.map((day) => {
            const inHeight = Math.min(95, Math.max(day.caloriesIn > 0 ? 6 : 2, Math.round(((day.caloriesIn || 0) / maxCaloInWeek) * 95)))
            const outHeight = Math.min(95, Math.max(day.caloriesOut > 0 ? 6 : 2, Math.round(((day.caloriesOut || 0) / maxCaloInWeek) * 95)))
            const isDaySelected = day.date === selectedDate

            return (
              <div
                className="bar-day"
                key={day.date}
                onClick={() => onSelectDate?.(day.date)}
                style={{ cursor: 'pointer', opacity: isDaySelected ? 1 : 0.85 }}
                title={`Ngày ${day.date}: Nạp ${day.caloriesIn} kcal | Tiêu hao ${day.caloriesOut} kcal`}
              >
                <div>
                  <i style={{ height: `${inHeight}px`, outline: isDaySelected ? '2px solid #064e3b' : 'none' }} />
                  <b style={{ height: `${outHeight}px` }} />
                </div>
                <small style={{ fontWeight: isDaySelected ? 700 : 400, color: isDaySelected ? '#047857' : '#5e6e69' }}>
                  {day.dayLabel}
                </small>
              </div>
            )
          })}
        </div>
      )}

      <div className="chart-summary">
        <span>
          Thâm hụt TB tuần
          <strong className={avgDeficit > 0 ? 'orange-text' : ''}>
            {avgDeficit > 0 ? `+${avgDeficit}` : avgDeficit} kcal / ngày
          </strong>
        </span>
        <span>
          Tuân thủ Macro
          <strong>{caloPct >= 75 && caloPct <= 110 ? 'Chuẩn mục tiêu' : `${caloPct}% năng lượng`}</strong>
        </span>
        <span>
          Đánh giá chuyển hóa
          <strong className={eatenCalo > targetCalo * 1.05 ? 'orange-text' : ''}>
            {(() => {
              const goal = healthProfile?.nutritionGoal?.goal
              if (goal === 'gain_weight') {
                return eatenCalo >= targetCalo ? 'Thặng dư tăng cân' : 'Chưa đủ thặng dư'
              }
              if (goal === 'lose_weight') {
                return eatenCalo <= targetCalo ? 'Thâm hụt đốt mỡ' : 'Vượt mức calo'
              }
              return Math.abs(eatenCalo - targetCalo) <= targetCalo * 0.1 ? 'Cân bằng lý tưởng' : (eatenCalo > targetCalo ? 'Dư năng lượng' : 'Thâm hụt nhẹ')
            })()}
          </strong>
        </span>
      </div>
    </article>
  )
}
