import { useEffect, useState } from 'react'
import axiosInstance from '../../../api/axiosInstance'
import { getImageUrl, nutrientPercent } from './foodConstants'

export default function FoodDetailModal({ food, onClose, onEdit }) {
  const [detailData, setDetailData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!food?._id) return
    let active = true
    axiosInstance
      .get(`/admin/foods/${food._id}`)
      .then(({ data }) => {
        if (active) setDetailData(data.data)
      })
      .catch(() => {
        if (active) setDetailData(food)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [food])

  const item = detailData || food
  if (!item) return null

  const isHidden = (item.status || 'active') === 'hidden'
  const servingSize = item.servingSize || 100
  const ratio = servingSize / 100
  const calPerServing = Math.round((item.calories || 0) * ratio)
  const proPerServing = ((item.protein || 0) * ratio).toFixed(1)
  const carbPerServing = ((item.carbs || 0) * ratio).toFixed(1)
  const fatPerServing = ((item.fat || 0) * ratio).toFixed(1)
  const pct = nutrientPercent(item)

  return (
    <div
      className="fm-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <section className="fm-detail-modal" role="dialog" aria-modal="true">
        <header className="fm-detail-header">
          <div className="fm-detail-heading">
            <span className="fm-detail-icon">
              <i className="bi bi-card-heading" />
            </span>
            <div>
              <h2>{item.name}</h2>
              <div className="fm-detail-badges">
                <code className="fdm-code">{item.foodCode || 'Chưa gán mã'}</code>
                <span className="fdm-group-chip">{item.foodGroup || 'Chưa phân nhóm'}</span>
                <span className={`fdm-status ${isHidden ? 'fdm-status--hidden' : 'fdm-status--active'}`}>
                  <i />
                  {isHidden ? 'Đã ẩn' : 'Đang sử dụng'}
                </span>
              </div>
            </div>
          </div>
          <button className="fm-close" onClick={onClose} aria-label="Đóng">
            <i className="bi bi-x-lg" />
          </button>
        </header>

        <div className="fm-detail-body">
          {/* Top visual section */}
          <div className="fm-detail-top">
            <div className="fm-detail-image-box">
              {item.imageUrl ? (
                <img src={getImageUrl(item.imageUrl)} alt={item.name} />
              ) : (
                <div className="fm-detail-no-img">
                  🍽<span>Chưa có ảnh đại diện</span>
                </div>
              )}
            </div>

            <div className="fm-detail-overview">
              <div className="fm-detail-stat-card">
                <small>Khẩu phần tiêu chuẩn</small>
                <strong>{servingSize} gram</strong>
                <span>~{calPerServing} kcal mỗi suất</span>
              </div>
              <div className="fm-detail-stat-card highlight">
                <small>Năng lượng trên 100g</small>
                <strong>{item.calories} kcal</strong>
                <span>Chuẩn Viện Dinh Dưỡng</span>
              </div>
              {item.mealLogCount !== undefined && (
                <div className="fm-detail-stat-card log-count">
                  <small>Lịch sử sử dụng</small>
                  <strong>{item.mealLogCount}</strong>
                  <span>Lượt trong MealLog người dùng</span>
                </div>
              )}
            </div>
          </div>

          {/* Dinh dưỡng chi tiết */}
          <div className="fm-detail-section">
            <h3 className="fm-detail-section-title">
              <i className="bi bi-pie-chart-fill" /> Giá trị dinh dưỡng chi tiết
            </h3>
            <div className="fm-detail-nutrient-grid">
              <div className="fm-detail-nutrient fm-detail-nutrient--cal">
                <span className="fm-detail-nut-icon">🔥</span>
                <div>
                  <small>Calo / Năng lượng</small>
                  <strong>
                    {item.calories} <span className="fm-unit">kcal / 100g</span>
                  </strong>
                  <p>
                    Suất {servingSize}g: <b>{calPerServing} kcal</b>
                  </p>
                </div>
              </div>

              <div className="fm-detail-nutrient fm-detail-nutrient--pro">
                <span className="fm-detail-nut-icon">💪</span>
                <div>
                  <small>Chất đạm (Protein)</small>
                  <strong>
                    {item.protein} <span className="fm-unit">g / 100g</span>
                  </strong>
                  <p>
                    Suất {servingSize}g: <b>{proPerServing} g</b>
                  </p>
                </div>
              </div>

              <div className="fm-detail-nutrient fm-detail-nutrient--carb">
                <span className="fm-detail-nut-icon">🌾</span>
                <div>
                  <small>Đường bột (Carbs)</small>
                  <strong>
                    {item.carbs} <span className="fm-unit">g / 100g</span>
                  </strong>
                  <p>
                    Suất {servingSize}g: <b>{carbPerServing} g</b>
                  </p>
                </div>
              </div>

              <div className="fm-detail-nutrient fm-detail-nutrient--fat">
                <span className="fm-detail-nut-icon">🫒</span>
                <div>
                  <small>Chất béo (Fat)</small>
                  <strong>
                    {item.fat} <span className="fm-unit">g / 100g</span>
                  </strong>
                  <p>
                    Suất {servingSize}g: <b>{fatPerServing} g</b>
                  </p>
                </div>
              </div>
            </div>

            {/* Macro bar */}
            {pct.p + pct.c + pct.f > 0 && (
              <div
                className="fm-macro-bar-wrap"
                style={{ marginTop: 12, borderRadius: 10, background: '#f8fafc', padding: '12px 16px' }}
              >
                <div className="fm-macro-bar" style={{ height: 8 }}>
                  <div className="fm-macro-seg fm-macro-seg--pro" style={{ width: `${pct.p}%` }} title={`Protein ${pct.p}%`} />
                  <div className="fm-macro-seg fm-macro-seg--carb" style={{ width: `${pct.c}%` }} title={`Carbs ${pct.c}%`} />
                  <div className="fm-macro-seg fm-macro-seg--fat" style={{ width: `${pct.f}%` }} title={`Fat ${pct.f}%`} />
                </div>
                <div className="fm-macro-legend" style={{ marginTop: 8 }}>
                  <span>
                    <i style={{ background: '#1a5fa0' }} />
                    Protein {pct.p}%
                  </span>
                  <span>
                    <i style={{ background: '#a06010' }} />
                    Carbs {pct.c}%
                  </span>
                  <span>
                    <i style={{ background: '#a01f1f' }} />
                    Fat {pct.f}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Mô tả & Thông tin hệ thống */}
          <div className="fm-detail-section">
            <h3 className="fm-detail-section-title">
              <i className="bi bi-file-text-fill" /> Mô tả &amp; Thông tin hệ thống
            </h3>
            <p className="fm-detail-desc">{item.description || 'Chưa có ghi chú mô tả cho món ăn này.'}</p>
            <div className="fm-detail-meta">
              <span>
                <b>Slug nghiệp vụ:</b> <code>{item.slug}</code>
              </span>
              {item.createdAt && (
                <span>
                  <b>Ngày tạo:</b> {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                </span>
              )}
              {item.updatedAt && (
                <span>
                  <b>Cập nhật:</b> {new Date(item.updatedAt).toLocaleDateString('vi-VN')}
                </span>
              )}
            </div>
          </div>
        </div>

        <footer className="fm-detail-footer">
          <button className="fm-btn-cancel" onClick={onClose}>
            Đóng
          </button>
          <button
            className="fm-btn-save"
            onClick={() => {
              onClose()
              onEdit(item)
            }}
          >
            <i className="bi bi-pencil-fill" /> Chỉnh sửa món ăn
          </button>
        </footer>
      </section>
    </div>
  )
}
