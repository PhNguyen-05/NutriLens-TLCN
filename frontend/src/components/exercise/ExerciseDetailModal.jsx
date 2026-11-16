import { useEffect, useState } from 'react'
import axiosInstance from '../../api/axiosInstance'
import {
  ADMIN_CATEGORIES,
  DEFAULT_CATEGORY_ICONS,
  calcCalories,
  extractYouTubeId,
} from '../../constants/exerciseConstants'

function getCategoryMeta(catId) {
  return ADMIN_CATEGORIES.find((c) => c.id === catId) || {
    id: catId || 'other',
    label: 'Khác',
    icon: 'bi-activity',
  }
}

function getIntensityCls(intensity) {
  if (intensity === 'Cao') return 'exm-chip--high'
  if (intensity === 'Nhẹ') return 'exm-chip--low'
  return 'exm-chip--mid'
}

export default function ExerciseDetailModal({
  exercise,
  onClose,
  onEdit,
  onToggleStatus,
}) {
  const [detailData, setDetailData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!exercise?._id) return
    let isMounted = true
    axiosInstance
      .get(`/admin/exercises/${exercise._id}`)
      .then(({ data }) => {
        if (isMounted) setDetailData(data.data)
      })
      .catch(() => {
        if (isMounted) setDetailData(exercise)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })
    return () => {
      isMounted = false
    }
  }, [exercise])

  const item = detailData || exercise
  if (!item) return null

  const isHidden = !item.isActive
  const cat = getCategoryMeta(item.category)
  const metVal = Number(item.met) || 0
  const duration =
    Number(item.defaultDurationMinutes) > 0 ? Number(item.defaultDurationMinutes) : 30
  const ytVideoId = extractYouTubeId(item.youtubeUrl)

  return (
    <div
      className="fm-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <section className="fm-detail-modal exm-detail-modal" role="dialog" aria-modal="true">
        <header className="fm-detail-header">
          <div className="fm-detail-heading">
            {item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt=""
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  objectFit: 'cover',
                  border: '1px solid #e2e8f0',
                  flexShrink: 0,
                }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            ) : (
              <span className="exm-icon-avatar">
                <i
                  className={`bi ${
                    item.icon || DEFAULT_CATEGORY_ICONS[item.category] || 'bi-activity'
                  }`}
                />
              </span>
            )}
            <div>
              <h2>{item.name}</h2>
              <div className="fm-detail-badges">
                <code className="fdm-code">{item.slug || 'Chưa gán slug'}</code>
                <span className="fdm-group-chip">
                  <i className={`bi ${cat.icon}`} /> {item.categoryName || cat.label}
                </span>
                <span
                  className={`fdm-status ${
                    isHidden ? 'fdm-status--hidden' : 'fdm-status--active'
                  }`}
                >
                  <i />
                  {isHidden ? 'Không hoạt động (Đã ẩn)' : 'Đang hoạt động'}
                </span>
              </div>
            </div>
          </div>
          <button className="fm-close" onClick={onClose} aria-label="Đóng">
            <i className="bi bi-x-lg" />
          </button>
        </header>

        <div className="fm-detail-body">
          {/* Thẻ chỉ số tổng quan */}
          <div className="exm-stats-cards">
            <div className="exm-stat-card">
              <span className="exm-stat-label">CHỈ SỐ MET</span>
              <strong className="exm-stat-value text-emerald">
                <i className="bi bi-speedometer2" /> {metVal.toFixed(1)}
              </strong>
              <small className="exm-stat-met-sub" title="Metabolic Equivalent of Task">
                Metabolic Equivalent of Task
              </small>
            </div>
            <div className="exm-stat-card">
              <span className="exm-stat-label">MỨC ĐỘ / CƯỜNG ĐỘ</span>
              <span
                className={`ex-chip ${getIntensityCls(item.intensity)}`}
                style={{ fontSize: '0.85rem', padding: '4px 10px' }}
              >
                {item.intensity}
              </span>
              <small>
                {item.intensity === 'Cao'
                  ? 'Tiêu hao năng lượng nhanh'
                  : item.intensity === 'Nhẹ'
                  ? 'Thư giãn phục hồi'
                  : 'Tập luyện vừa sức'}
              </small>
            </div>
            <div className="exm-stat-card">
              <span className="exm-stat-label">THỜI LƯỢNG GỢI Ý</span>
              <strong className="exm-stat-value">
                {duration} <small style={{ fontSize: '0.8rem', fontWeight: 600 }}>phút</small>
              </strong>
              <small>Mặc định cho mỗi buổi</small>
            </div>
            <div className="exm-stat-card highlight">
              <span className="exm-stat-label">LƯỢT GHI NHẬN</span>
              <strong className="exm-stat-value text-blue">
                <i className="bi bi-people-fill" /> {item.logCount || 0}
              </strong>
              <small>Lượt tập từ người dùng</small>
            </div>
          </div>

          {/* Bảng ước tính Calo theo cân nặng chuẩn */}
          <div className="fm-detail-section">
            <h3 className="fm-detail-section-title">
              <i className="bi bi-fire" /> Ước tính năng lượng tiêu hao theo trọng lượng cơ thể ({duration} phút)
            </h3>
            <div className="exm-calorie-grid">
              {[50, 60, 70, 80].map((kg) => {
                const burn = calcCalories(metVal, kg, duration)
                return (
                  <div
                    key={kg}
                    className={`exm-cal-box ${kg === 60 ? 'exm-cal-box--standard' : ''}`}
                  >
                    <span className="exm-cal-weight">
                      {kg} kg {kg === 60 && <b className="exm-cal-tag">Chuẩn</b>}
                    </span>
                    <strong className="exm-cal-burn">
                      ~{burn} <span>kcal</span>
                    </strong>
                  </div>
                )
              })}
            </div>
            <small className="exm-formula-note">
              <i className="bi bi-info-circle" /> Công thức chuẩn hóa:{' '}
              <code>Calories = (MET × 3.5 × Cân nặng(kg) × Thời gian(phút)) / 200</code>
            </small>
          </div>

          {/* Link video YouTube nếu có */}
          {item.youtubeUrl && (
            <div className="fm-detail-section">
              <h3 className="fm-detail-section-title">
                <i className="bi bi-youtube" style={{ color: '#ef4444' }} /> Video hướng dẫn kỹ thuật trên YouTube
              </h3>
              {ytVideoId && (
                <div style={{ maxWidth: 480, margin: '8px 0 12px', borderRadius: 10, overflow: 'hidden' }}>
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${ytVideoId}?rel=0`}
                    title={`Video ${item.name}`}
                    style={{ width: '100%', height: 260, border: 'none', display: 'block' }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}
              <a
                href={item.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ex-btn ex-btn--yt"
                style={{
                  textDecoration: 'none',
                  display: 'inline-flex',
                  padding: '6px 14px',
                  borderRadius: 8,
                  gap: 6,
                  alignItems: 'center',
                }}
              >
                <i className="bi bi-play-circle-fill" /> Xem trên YouTube: {item.youtubeUrl}
              </a>
            </div>
          )}

          {/* Mô tả bài tập */}
          <div className="fm-detail-section">
            <h3 className="fm-detail-section-title">
              <i className="bi bi-card-text" /> Mô tả bài tập &amp; Hướng dẫn kỹ thuật
            </h3>
            <div className="exm-description-box">
              {item.description ? (
                <p>{item.description}</p>
              ) : (
                <p className="text-muted italic">Chưa có mô tả chi tiết cho bài tập này.</p>
              )}
            </div>
          </div>

          {/* Thông tin hệ thống */}
          <div className="fm-detail-meta">
            <div>
              <i className="bi bi-calendar-plus" /> Ngày tạo:{' '}
              <b>
                {item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : '—'}
              </b>
            </div>
            <div>
              <i className="bi bi-clock-history" /> Cập nhật lần cuối:{' '}
              <b>
                {item.updatedAt ? new Date(item.updatedAt).toLocaleString('vi-VN') : '—'}
              </b>
            </div>
          </div>
        </div>

        <footer className="fm-detail-footer">
          <div className="exm-footer-left">
            <button
              type="button"
              className={`frm-btn ${isHidden ? 'frm-btn--approve' : 'frm-btn--reject'}`}
              onClick={() => {
                onClose()
                onToggleStatus(item)
              }}
            >
              <i className={`bi ${isHidden ? 'bi-eye-fill' : 'bi-eye-slash-fill'}`} />
              <span>{isHidden ? 'Hiển thị bài tập' : 'Ẩn bài tập'}</span>
            </button>
          </div>
          <div className="exm-footer-right">
            <button type="button" className="fm-btn-cancel" onClick={onClose}>
              Đóng
            </button>
            <button
              type="button"
              className="fm-btn-save"
              onClick={() => {
                onClose()
                onEdit(item)
              }}
            >
              <i className="bi bi-pencil-fill" /> Chỉnh sửa thông tin
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}
