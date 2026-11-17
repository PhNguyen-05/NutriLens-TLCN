import React from 'react'
import { useNavigate } from 'react-router-dom'
import { resolveMediaUrl } from '../community/communityUtils'

function mealTypeInfo(type) {
  switch (type) {
    case 'breakfast':
      return { label: 'Bữa Sáng', icon: '🍳', tone: '#10b981' }
    case 'lunch':
      return { label: 'Bữa Trưa', icon: '🍲', tone: '#f59e0b' }
    case 'dinner':
      return { label: 'Bữa Tối', icon: '🥗', tone: '#3b82f6' }
    case 'snack':
    default:
      return { label: 'Bữa Phụ', icon: '🥪', tone: '#8b5cf6' }
  }
}

export default function TodayActivityCard({
  selectedDate,
  todayStr,
  meals = [],
  exercises = [],
  statsLoading = false,
  eatenCalo = 0,
  burnedCalo = 0,
  burnTarget = 400,
  exerciseMinutes = 0,
  netCalories = 0,
  workoutCount = 0,
}) {
  const navigate = useNavigate()
  const todayLatestMeals = meals.slice(0, 3)

  return (
    <>
      {/* KHỐI MÓN ĂN TRONG NGÀY */}
      <article className="content-panel meal-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Dinh dưỡng hàng ngày</span>
            <h2>Món ăn {selectedDate === todayStr ? 'hôm nay' : selectedDate} (3 món mới nhất)</h2>
            <p>Danh sách 3 món ăn mới nhất được ghi nhận trong ngày</p>
          </div>
          <span className="heading-chip">
            {todayLatestMeals.length > 0 ? `${todayLatestMeals.length} món mới nhất` : 'Chưa có món ăn'}
          </span>
        </div>

        {statsLoading ? (
          <div className="meal-skeleton-container" style={{ padding: '4px 0' }}>
            <div className="skeleton-box" style={{ height: '70px', marginBottom: '8px', borderRadius: '8px' }} />
            <div className="skeleton-box" style={{ height: '70px', marginBottom: '8px', borderRadius: '8px' }} />
          </div>
        ) : todayLatestMeals.length === 0 ? (
          <div style={{ padding: '36px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '10px', margin: '14px 0', border: '1.5px dashed #cbd5e1' }}>
            <i className="bi bi-journal-x" style={{ fontSize: '2.4rem', color: '#94a3b8', display: 'block', marginBottom: '8px' }} />
            <strong style={{ display: 'block', fontSize: '0.98rem', color: '#334155', marginBottom: '4px' }}>
              Chưa có món ăn nào trong ngày {selectedDate === todayStr ? 'hôm nay' : selectedDate}
            </strong>
            <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '0.85rem' }}>
              Món ăn được nhận diện từ mục quét phía trên sẽ hiển thị tại đây.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => navigate(`/meal-diary?date=${selectedDate}`)}
                style={{ padding: '8px 18px', background: '#008560', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
              >
                <i className="bi bi-journal-text" /> Xem nhật ký bữa ăn
              </button>
            </div>
          </div>
        ) : (
          todayLatestMeals.map((meal) => {
            const meta = mealTypeInfo(meal.mealType)
            const imageSrc = resolveMediaUrl(meal.imageUrl)
            return (
              <div className="meal-row" key={meal._id}>
                <div className="meal-image" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#f1f5f9' }}>
                  {imageSrc ? (
                    <img src={imageSrc} alt={meal.foodName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '2rem' }}>{meta.icon}</span>
                  )}
                  {meal.confidence && <small>AI: {Math.round(meal.confidence)}%</small>}
                </div>
                <div className="meal-details">
                  <small style={{ color: meta.tone, fontWeight: 700 }}>
                    {meta.label} · {meal.servings} khẩu phần
                  </small>
                  <h3>{meal.foodName}</h3>
                  <div className="meal-macros-row">
                    <span className="macro-badge macro-protein">
                      <i className="macro-dot protein-dot" /> Protein {meal.protein}g
                    </span>
                    <span className="macro-badge macro-carbs">
                      <i className="macro-dot carbs-dot" /> Carbs {meal.carbs}g
                    </span>
                    <span className="macro-badge macro-fat">
                      <i className="macro-dot fat-dot" /> Fat {meal.fat}g
                    </span>
                  </div>
                </div>
                <strong className="meal-kcal">{meal.calories} kcal</strong>
              </div>
            )
          })
        )}

        {meals.length > 0 && (
          <div className="meal-footer">
            <b>Tổng năng lượng các bữa ăn:</b>
            <span>{eatenCalo.toLocaleString('vi-VN')} kcal ({meals.length} món)</span>
            <small>Xem và quản lý thực đơn đầy đủ tại trang Nhật ký bữa ăn</small>
            <button type="button" onClick={() => navigate(`/meal-diary?date=${selectedDate}`)}>
              <i className="bi bi-journal-text" /> Xem toàn bộ nhật ký
            </button>
          </div>
        )}
      </article>

      {/* KHỐI BÀI TẬP VẬN ĐỘNG TRONG NGÀY */}
      <section className="content-panel workout-panel" style={{ marginTop: '20px' }}>
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Hoạt động thể chất &amp; Vận động</span>
            <h2>Bài tập ngày {selectedDate === todayStr ? 'hôm nay' : selectedDate}</h2>
            <p>
              Đã ghi nhận <b>{workoutCount} bài tập</b> · Tiêu hao <b>{burnedCalo} kcal</b> ({exerciseMinutes} phút vận động)
            </p>
          </div>
          <div>
            <button className="solid-button" onClick={() => navigate('/exercise')}>
              ⊕ Thêm bài tập
            </button>
          </div>
        </div>
        <div className="workout-content">
          <div>
            {exercises.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                <i className="bi bi-person-walking" style={{ fontSize: '2rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }} />
                <p style={{ margin: '0 0 10px', color: '#64748b', fontSize: '0.85rem' }}>
                  Chưa có bài tập nào được ghi nhận cho ngày này.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/exercise')}
                  style={{ padding: '6px 14px', background: '#008560', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  ⊕ Ghi nhận buổi tập
                </button>
              </div>
            ) : (
              exercises.slice(0, 3).map((ex, index) => (
                <div className={`workout-row ${index === 0 ? 'focus' : ''}`} key={ex._id}>
                  <b>
                    {ex.category === 'cardio' ? '🏃' : ex.category === 'strength' ? '🏋' : ex.category === 'flexibility' ? '🧘' : '⚽'}
                  </b>
                  <span>
                    <strong>{ex.exerciseName}</strong>
                    <small>
                      {ex.durationMinutes} phút · Tiêu hao {ex.caloriesBurned} kcal
                      {ex.time ? ` · Lúc ${ex.time}` : ''}
                      {ex.notes ? ` · ${ex.notes}` : ''}
                    </small>
                  </span>
                  <button type="button" onClick={() => navigate('/exercise?tab=history')}>
                    Xem nhật ký →
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="energy-box">
            <b>Tổng quan thể lực</b>
            <span>
              Tiến độ tiêu hao <strong>{burnedCalo} / {burnTarget} kcal ({Math.min(100, Math.round((burnedCalo / burnTarget) * 100))}%)</strong>
            </span>
            <div className="energy-progress">
              <i style={{ width: `${Math.min(100, Math.round((burnedCalo / burnTarget) * 100))}%` }} />
            </div>
            <div className="energy-values">
              <b>
                {exerciseMinutes}
                <small>Thời gian tập (phút)</small>
              </b>
              <b>
                {netCalories >= 0 ? `+${netCalories}` : netCalories}
                <small>Calo ròng (kcal)</small>
              </b>
              <b>
                {workoutCount}
                <small>Bài tập đã hoàn thành</small>
              </b>
            </div>
            <p>
              <b>Gợi ý vận động:</b> {burnedCalo >= burnTarget ? 'Tuyệt vời! Bạn đã hoàn thành mức vận động lý tưởng hôm nay để tăng cường trao đổi chất.' : `Dành thêm 15-20 phút đi bộ nhanh hoặc nhảy dây để đạt mốc ${burnTarget} kcal tiêu hao nhé!`}
            </p>
          </div>
        </div>
      </section>
    </>
  )
}
