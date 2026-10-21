import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import axiosInstance from '../../api/axiosInstance'

// ─── Constants ───────────────────────────────────────────────────────────────
const PAGE_SIZE = 10

const CATEGORIES = [
  { id: 'cardio', label: 'Cardio & Vận động', icon: 'bi-lightning-charge' },
  { id: 'strength', label: 'Sức mạnh & Gym', icon: 'bi-shield-check' },
  { id: 'sports', label: 'Thể thao', icon: 'bi-dribbble' },
  { id: 'flexibility', label: 'Yoga & Thư giãn', icon: 'bi-yin-yang' },
  { id: 'other', label: 'Khác', icon: 'bi-activity' },
]

const INTENSITIES = [
  { label: 'Nhẹ', cls: 'exm-chip--low', desc: 'MET < 3.0 • Vận động thư giãn nhẹ nhàng' },
  { label: 'Trung bình', cls: 'exm-chip--mid', desc: 'MET 3.0 - 6.0 • Nhịp tim tăng vừa phải' },
  { label: 'Cao', cls: 'exm-chip--high', desc: 'MET > 6.0 • Thử thách thể lực, đốt mỡ tối đa' },
]

const ICON_CATEGORIES = [
  { id: 'all', label: 'Tất cả' },
  { id: 'running', label: '🏃 Chạy & Đi bộ' },
  { id: 'cycling', label: '🚴 Đạp xe' },
  { id: 'water', label: '🏊 Bơi & Dưới nước' },
  { id: 'strength', label: '🏋️ Gym & Thể hình' },
  { id: 'sports', label: '⚽ Thể thao & Bóng' },
  { id: 'mind', label: '🧘 Yoga & Giãn cơ' },
  { id: 'cardio', label: '⚡ Cardio & Tim mạch' },
  { id: 'dance', label: '🎵 Nhảy & Vũ đạo' },
]

const EXERCISE_ICON_LIBRARY = [
  // Chạy & Đi bộ
  { id: 'bi-person-walking', name: 'Đi bộ', cat: 'running', keywords: 'di bo, walk, buoc chan' },
  { id: 'bi-person-running', name: 'Chạy bộ', cat: 'running', keywords: 'chay bo, run, chay, sprint, marathon' },
  { id: 'bi-compass', name: 'Leo núi / Trekking', cat: 'running', keywords: 'leo nui, trekking, da ngoai, hike, compass' },
  { id: 'bi-geo-alt', name: 'Lộ trình chạy', cat: 'running', keywords: 'lo trinh, ngoai troi, outdoor, gps' },
  { id: 'bi-signpost-2', name: 'Chạy việt dã (Trail)', cat: 'running', keywords: 'viet da, trail, duong mon' },
  { id: 'bi-wind', name: 'Chạy cản gió', cat: 'running', keywords: 'gio, toc do, wind' },

  // Đạp xe
  { id: 'bi-bicycle', name: 'Đạp xe', cat: 'cycling', keywords: 'dap xe, xe dap, cycling, bike' },
  { id: 'bi-speedometer2', name: 'Đạp xe tốc độ', cat: 'cycling', keywords: 'toc do, cadence, speed, van toc' },
  { id: 'bi-arrow-repeat', name: 'Vòng lặp / Cadence', cat: 'cycling', keywords: 'vong lap, cadence, tap xoay' },

  // Bơi lội
  { id: 'bi-water', name: 'Bơi lội', cat: 'water', keywords: 'boi loi, boi, swim, water, ho boi' },
  { id: 'bi-droplet-half', name: 'Thủy lực / Dưới nước', cat: 'water', keywords: 'nuoc, aqua, droplet' },
  { id: 'bi-tsunami', name: 'Lướt sóng / Vượt sóng', cat: 'water', keywords: 'luot song, song, surf, bien' },

  // Gym & Thể hình
  { id: 'bi-hammer', name: 'Tập tạ / Gym', cat: 'strength', keywords: 'ta, ta tay, dumbbell, gym, ta nang, hammer, the hinh' },
  { id: 'bi-shield-check', name: 'Sức mạnh cơ bắp', cat: 'strength', keywords: 'co bap, the hinh, gym, strength, shield, chong day' },
  { id: 'bi-fire', name: 'Đốt mỡ / Siết cơ', cat: 'strength', keywords: 'dot mo, chay mo, calo, burn, fire, siet co' },
  { id: 'bi-lightning-charge', name: 'HIIT / Thể lực cao', cat: 'strength', keywords: 'bung no, hiit, nang luong, lightning, the luc' },
  { id: 'bi-trophy', name: 'Thử thách tạ nặng', cat: 'strength', keywords: 'thu thach, ta nang, trophy, cup, thi dau' },
  { id: 'bi-award', name: 'Huy chương thể hình', cat: 'strength', keywords: 'huan chuong, huy chuong, award, dat chuan' },
  { id: 'bi-box-seam', name: 'CrossFit / Bật hộp', cat: 'strength', keywords: 'crossfit, bat hop, box jump, plyometrics' },

  // Thể thao & Bóng
  { id: 'bi-dribbble', name: 'Bóng rổ / Bóng đá', cat: 'sports', keywords: 'bong, bong ro, bong da, bong chuyen, ball, dribble' },
  { id: 'bi-bullseye', name: 'Bắn cung / Mục tiêu', cat: 'sports', keywords: 'ban cung, muc tieu, target, archery, phi tieu' },
  { id: 'bi-flag', name: 'Golf / Cờ hiệu', cat: 'sports', keywords: 'golf, co hieu, flag, the thao' },
  { id: 'bi-disc', name: 'Ném đĩa / Frisbee', cat: 'sports', keywords: 'nem dia, frisbee, disc' },
  { id: 'bi-controller', name: 'Thể thao điện tử', cat: 'sports', keywords: 'game, dien tu, esports' },

  // Yoga & Giãn cơ
  { id: 'bi-yin-yang', name: 'Yoga / Khí công', cat: 'mind', keywords: 'yoga, thai cuc quyen, khi cong, balance, can bang' },
  { id: 'bi-flower1', name: 'Thiền định / Tĩnh tâm', cat: 'mind', keywords: 'thien, thu gian, relax, meditation, tinh tam' },
  { id: 'bi-brightness-high', name: 'Vận động buổi sáng', cat: 'mind', keywords: 'buoi sang, nang, morning, nang luong' },
  { id: 'bi-moon-stars', name: 'Giãn cơ buổi tối', cat: 'mind', keywords: 'buoi toi, ngu, night, stretch, gian co' },
  { id: 'bi-peace', name: 'Hài hòa thân tâm', cat: 'mind', keywords: 'can bang, hoa binh, peace, hai hoa' },
  { id: 'bi-heart', name: 'Tập dưỡng sinh', cat: 'mind', keywords: 'duong sinh, tim, yeu thich, heart' },

  // Cardio & Tim mạch
  { id: 'bi-heart-pulse', name: 'Đo nhịp tim / Cardio', cat: 'cardio', keywords: 'nhip tim, cardio, heart rate, pulse, tim mach' },
  { id: 'bi-activity', name: 'Vận động tổng hợp', cat: 'cardio', keywords: 'tong hop, hoat dong, activity, van dong' },
  { id: 'bi-stopwatch', name: 'Bấm giờ / Tabata', cat: 'cardio', keywords: 'bam gio, tabata, stopwatch, interval, ngat quang' },
  { id: 'bi-clock-history', name: 'Sức bền đường dài', cat: 'cardio', keywords: 'suc ben, thoi gian, endurance, lich su' },
  { id: 'bi-hourglass-split', name: 'Thử thách thời gian', cat: 'cardio', keywords: 'tinh gio, hourglass, thoi gian' },

  // Nhảy & Vũ đạo
  { id: 'bi-music-note-beamed', name: 'Zumba / Khiêu vũ', cat: 'dance', keywords: 'zumba, nhay, vu dao, khieu vu, dance, music, am nhac' },
  { id: 'bi-headphones', name: 'Tập cùng âm nhạc', cat: 'dance', keywords: 'tai nghe, nhac, beat, giai điệu' },
  { id: 'bi-soundwave', name: 'Aerobic / Vũ đạo', cat: 'dance', keywords: 'aerobic, nhip dieu, soundwave, vu dao' },
]

const POPULAR_QUICK_ICONS = [
  'bi-person-walking',
  'bi-person-running',
  'bi-bicycle',
  'bi-water',
  'bi-hammer',
  'bi-dribbble',
  'bi-yin-yang',
  'bi-heart-pulse',
  'bi-fire',
  'bi-activity',
]

export const DEFAULT_CATEGORY_ICONS = {
  cardio: 'bi-person-walking',
  strength: 'bi-hammer',
  sports: 'bi-dribbble',
  flexibility: 'bi-yin-yang',
  other: 'bi-activity',
}

function getRecommendedIntensity(met) {
  const m = Number(met)
  if (!Number.isFinite(m) || m <= 0) return null
  if (m < 3.0) return 'Nhẹ'
  if (m <= 6.0) return 'Trung bình'
  return 'Cao'
}

function getIconMeta(iconId, category = 'cardio') {
  if (!iconId || iconId === 'default') {
    const fallbackId = DEFAULT_CATEGORY_ICONS[category] || 'bi-activity'
    const found = EXERCISE_ICON_LIBRARY.find((i) => i.id === fallbackId)
    return {
      id: fallbackId,
      name: `Mặc định theo nhóm (${found?.name || 'Vận động'})`,
      isDefault: true,
    }
  }
  const found = EXERCISE_ICON_LIBRARY.find((i) => i.id === iconId)
  if (found) return { ...found, isDefault: false }
  return { id: iconId, name: `Tùy biến (${iconId})`, isDefault: false }
}

const EMPTY_FORM = {
  name: '',
  category: 'cardio',
  intensity: 'Trung bình',
  met: '4.0',
  defaultDurationMinutes: '30',
  description: '',
  icon: '',
  isActive: true,
}

const DURATION_PRESETS = [
  { value: '15', label: '15 phút' },
  { value: '30', label: '30 phút (Mặc định)' },
  { value: '45', label: '45 phút' },
  { value: '60', label: '60 phút (1 giờ)' },
  { value: '90', label: '90 phút (1.5 giờ)' },
  { value: '120', label: '120 phút (2 giờ)' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
function calculateKcal(met, weightKg = 60, durationMinutes = 30) {
  const m = Number(met)
  const w = Number(weightKg)
  const d = Number(durationMinutes)
  if (!m || !w || !d || m <= 0 || w <= 0 || d <= 0) return 0
  return Math.round((m * 3.5 * w * d) / 200)
}

function getCategoryMeta(catId) {
  return CATEGORIES.find((c) => c.id === catId) || { label: 'Khác', icon: 'bi-activity' }
}

function getIntensityCls(intensity) {
  if (intensity === 'Cao') return 'exm-chip--high'
  if (intensity === 'Nhẹ') return 'exm-chip--low'
  return 'exm-chip--mid'
}

// ─── Modal: Chi tiết bài tập (ExerciseDetailModal) ───────────────────────────
function ExerciseDetailModal({ exercise, onClose, onEdit, onToggleStatus }) {
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
  const duration = Number(item.defaultDurationMinutes) > 0 ? Number(item.defaultDurationMinutes) : 30

  return (
    <div className="fm-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <section className="fm-detail-modal exm-detail-modal" role="dialog" aria-modal="true">
        <header className="fm-detail-header">
          <div className="fm-detail-heading">
            <span className="exm-icon-avatar">
              <i className={`bi ${item.icon || DEFAULT_CATEGORY_ICONS[item.category] || 'bi-activity'}`} />
            </span>
            <div>
              <h2>{item.name}</h2>
              <div className="fm-detail-badges">
                <code className="fdm-code">{item.slug || 'Chưa gán slug'}</code>
                <span className="fdm-group-chip"><i className={`bi ${cat.icon}`} /> {item.categoryName || cat.label}</span>
                <span className={`fdm-status ${isHidden ? 'fdm-status--hidden' : 'fdm-status--active'}`}>
                  <i />{isHidden ? 'Không hoạt động (Đã ẩn)' : 'Đang hoạt động'}
                </span>
              </div>
            </div>
          </div>
          <button className="fm-close" onClick={onClose} aria-label="Đóng"><i className="bi bi-x-lg" /></button>
        </header>

        <div className="fm-detail-body">
          {/* Thẻ chỉ số tổng quan */}
          <div className="exm-stats-cards">
            <div className="exm-stat-card">
              <span className="exm-stat-label">CHỈ SỐ MET</span>
              <strong className="exm-stat-value text-emerald">
                <i className="bi bi-speedometer2" /> {metVal.toFixed(1)}
              </strong>
              <small className="exm-stat-met-sub" title="Metabolic Equivalent of Task">Metabolic Equivalent of Task</small>
            </div>
            <div className="exm-stat-card">
              <span className="exm-stat-label">MỨC ĐỘ / CƯỜNG ĐỘ</span>
              <span className={`ex-chip ${getIntensityCls(item.intensity)}`} style={{ fontSize: '0.85rem', padding: '4px 10px' }}>
                {item.intensity}
              </span>
              <small>{item.intensity === 'Cao' ? 'Tiêu hao năng lượng nhanh' : item.intensity === 'Nhẹ' ? 'Thư giãn phục hồi' : 'Tập luyện vừa sức'}</small>
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
                const burn = calculateKcal(metVal, kg, duration)
                return (
                  <div key={kg} className={`exm-cal-box ${kg === 60 ? 'exm-cal-box--standard' : ''}`}>
                    <span className="exm-cal-weight">{kg} kg {kg === 60 && <b className="exm-cal-tag">Chuẩn</b>}</span>
                    <strong className="exm-cal-burn">~{burn} <span>kcal</span></strong>
                  </div>
                )
              })}
            </div>
            <small className="exm-formula-note">
              <i className="bi bi-info-circle" /> Công thức chuẩn hóa: <code>Calories = (MET × 3.5 × Cân nặng(kg) × Thời gian(phút)) / 200</code>
            </small>
          </div>

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
            <div><i className="bi bi-calendar-plus" /> Ngày tạo: <b>{item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : '—'}</b></div>
            <div><i className="bi bi-clock-history" /> Cập nhật lần cuối: <b>{item.updatedAt ? new Date(item.updatedAt).toLocaleString('vi-VN') : '—'}</b></div>
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
            <button type="button" className="fm-btn-cancel" onClick={onClose}>Đóng</button>
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

// ─── Modal: Kho biểu tượng thể thao trực quan (IconPickerModal) ───────────────
function IconPickerModal({ currentIcon, currentCategory = 'cardio', onSelect, onClose }) {
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [customInput, setCustomInput] = useState('')

  const filteredIcons = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return EXERCISE_ICON_LIBRARY.filter((item) => {
      const matchCat = activeCategory === 'all' || item.cat === activeCategory
      if (!matchCat) return false
      if (!q) return true
      return (
        item.name.toLowerCase().includes(q) ||
        item.keywords.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q)
      )
    })
  }, [activeCategory, searchQuery])

  const defaultCategoryIcon = DEFAULT_CATEGORY_ICONS[currentCategory] || 'bi-activity'
  const isDefaultSelected = !currentIcon || currentIcon === 'default'

  const previewCustomClass = useMemo(() => {
    const val = customInput.trim()
    if (!val) return 'bi-question-lg'
    return val.startsWith('bi-') ? val : `bi-${val}`
  }, [customInput])

  function handleApplyCustom() {
    if (!customInput.trim()) return
    const finalIcon = customInput.trim().startsWith('bi-') ? customInput.trim() : `bi-${customInput.trim()}`
    onSelect(finalIcon)
    onClose()
  }

  return (
    <div className="fm-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <section className="fm-modal exm-icon-modal" role="dialog" aria-modal="true">
        <header className="fm-header">
          <div className="fm-header-icon" style={{ background: 'linear-gradient(135deg, #ecfdf5, #a7f3d0)', color: '#059669' }}>
            <i className="bi bi-grid-3x3-gap-fill" />
          </div>
          <div className="fm-header-text">
            <h2>Kho biểu tượng bài tập &amp; vận động</h2>
            <p>Chọn biểu tượng có sẵn, dùng mặc định theo nhóm hoặc nhập mã Bootstrap Icon tùy ý</p>
          </div>
          <button className="fm-close" onClick={onClose} aria-label="Đóng"><i className="bi bi-x-lg" /></button>
        </header>

        <div className="fm-body" style={{ gap: 14 }}>
          {/* Thanh tìm kiếm */}
          <div className="exm-picker-search-bar">
            <i className="bi bi-search" />
            <input
              type="text"
              placeholder="Tìm kiếm biểu tượng (ví dụ: bơi, chạy, đạp xe, tạ, bóng, yoga, zumba...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button type="button" className="exm-picker-search-clear" onClick={() => setSearchQuery('')}>
                <i className="bi bi-x" />
              </button>
            )}
          </div>

          {/* Danh mục phân loại */}
          <div className="exm-picker-cats">
            {ICON_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`exm-picker-cat-btn ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Lưới Icon */}
          <div className="exm-picker-grid">
            {/* Tùy chọn 1: Mặc định theo nhóm */}
            {(!searchQuery || 'mặc định default nhóm'.includes(searchQuery.toLowerCase())) && (
              <button
                type="button"
                className={`exm-picker-card exm-picker-card--default ${isDefaultSelected ? 'active' : ''}`}
                onClick={() => {
                  onSelect('')
                  onClose()
                }}
                title="Tự động sử dụng biểu tượng mặc định theo nhóm bài tập đã chọn"
              >
                <span className="exm-picker-card-icon">
                  <i className={`bi ${defaultCategoryIcon}`} />
                </span>
                <span className="exm-picker-card-name">Mặc định theo nhóm</span>
                {isDefaultSelected && <span className="exm-picker-card-check"><i className="bi bi-check-lg" /></span>}
              </button>
            )}

            {filteredIcons.map((item) => {
              const isSelected = currentIcon === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`exm-picker-card ${isSelected ? 'active' : ''}`}
                  onClick={() => {
                    onSelect(item.id)
                    onClose()
                  }}
                  title={`${item.name} (${item.id})`}
                >
                  <span className="exm-picker-card-icon">
                    <i className={`bi ${item.id}`} />
                  </span>
                  <span className="exm-picker-card-name">{item.name}</span>
                  {isSelected && <span className="exm-picker-card-check"><i className="bi bi-check-lg" /></span>}
                </button>
              )
            })}
          </div>

          {/* Khung nhập custom icon Bootstrap */}
          <div className="exm-picker-custom-box">
            <div className="exm-picker-custom-label">
              <i className="bi bi-terminal-plus" />
              <strong>Không tìm thấy biểu tượng mong muốn?</strong>
              <span>Nhập mã Bootstrap Icon bất kỳ:</span>
            </div>
            <div className="exm-picker-custom-row">
              <span className="exm-picker-custom-preview" title={`Xem trước: ${previewCustomClass}`}>
                <i className={`bi ${previewCustomClass}`} />
              </span>
              <input
                type="text"
                className="exm-picker-custom-input"
                placeholder="Ví dụ: bi-trophy, bi-water, bi-bicycle, bi-shield-shaded..."
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleApplyCustom()
                  }
                }}
              />
              <button
                type="button"
                className="exm-picker-custom-btn"
                disabled={!customInput.trim()}
                onClick={handleApplyCustom}
              >
                <i className="bi bi-check-lg" /> Áp dụng
              </button>
            </div>
          </div>
        </div>

        <footer className="fm-footer" style={{ justifyContent: 'space-between' }}>
          <small style={{ color: '#64748b', fontSize: 12 }}>
            <i className="bi bi-info-circle" /> Có <b>{filteredIcons.length}</b> biểu tượng gợi ý + hỗ trợ 100% Bootstrap Icons
          </small>
          <button type="button" className="fm-btn-cancel" onClick={onClose}>Đóng</button>
        </footer>
      </section>
    </div>
  )
}

// ─── Modal: Thêm / Sửa bài tập (ExerciseFormModal) ───────────────────────────
function ExerciseFormModal({ mode = 'add', editTarget, onClose, onSaved }) {
  const [form, setForm] = useState(() => {
    if (mode === 'edit' && editTarget) {
      return {
        name: editTarget.name || '',
        category: editTarget.category || 'cardio',
        intensity: editTarget.intensity || 'Trung bình',
        met: String(editTarget.met != null ? editTarget.met : '4.0'),
        defaultDurationMinutes: String(editTarget.defaultDurationMinutes || '30'),
        description: editTarget.description || '',
        icon: editTarget.icon || '',
        isActive: editTarget.isActive !== undefined ? editTarget.isActive : true,
      }
    }
    return { ...EMPTY_FORM }
  })

  const [showIconPicker, setShowIconPicker] = useState(false)

  const [isCustomDuration, setIsCustomDuration] = useState(() => {
    if (mode === 'edit' && editTarget) {
      const dur = String(editTarget.defaultDurationMinutes || '30')
      return !DURATION_PRESETS.some((opt) => opt.value === dur)
    }
    return false
  })

  const [errors, setErrors] = useState({})
  const [apiError, setApiError] = useState('')
  const [saving, setSaving] = useState(false)

  function change(e) {
    const { name, value, type, checked } = e.target
    const val = type === 'checkbox' ? checked : value
    setForm((prev) => ({ ...prev, [name]: val }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }))
    if (apiError) setApiError('')
  }

  function handleDurationSelect(e) {
    const val = e.target.value
    if (val === '__CUSTOM__') {
      setIsCustomDuration(true)
    } else {
      setIsCustomDuration(false)
      setForm((prev) => ({ ...prev, defaultDurationMinutes: val }))
      if (errors.defaultDurationMinutes) setErrors((prev) => ({ ...prev, defaultDurationMinutes: undefined }))
    }
  }

  function handleSwitchToPreset() {
    setIsCustomDuration(false)
    setForm((prev) => ({ ...prev, defaultDurationMinutes: '30' }))
    if (errors.defaultDurationMinutes) setErrors((prev) => ({ ...prev, defaultDurationMinutes: undefined }))
  }

  function validateForm() {
    const errs = {}
    // Luồng ngoại lệ 4a: Bỏ trống tên bài tập
    if (!form.name.trim()) {
      errs.name = 'Tên bài tập không được để trống'
    }
    // Luồng ngoại lệ 4b: MET <= 0 hoặc > 30 hoặc không đúng định dạng
    const metNum = Number(form.met)
    if (form.met === '' || !Number.isFinite(metNum) || metNum <= 0) {
      errs.met = 'Giá trị MET không hợp lệ, phải lớn hơn 0'
    } else if (metNum > 30) {
      errs.met = 'Giá trị MET tối đa là 30.0 (giới hạn sinh lý người)'
    }

    // Ràng buộc thời lượng: bắt buộc lớn hơn 0 và <= 720 phút
    const durNum = Number(form.defaultDurationMinutes)
    if (form.defaultDurationMinutes === '' || !Number.isFinite(durNum) || durNum <= 0) {
      errs.defaultDurationMinutes = 'Thời lượng gợi ý phải lớn hơn 0 phút'
    } else if (durNum > 720) {
      errs.defaultDurationMinutes = 'Thời lượng gợi ý tối đa không quá 720 phút (12 giờ)'
    }
    return errs
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault()
    const errs = validateForm()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      if (errs.name) setApiError(errs.name)
      else if (errs.met) setApiError(errs.met)
      else if (errs.defaultDurationMinutes) setApiError(errs.defaultDurationMinutes)
      return
    }

    setSaving(true)
    setApiError('')

    try {
      const parsedDuration = Number(form.defaultDurationMinutes)
      const payload = {
        name: form.name.trim(),
        category: form.category,
        intensity: form.intensity,
        met: Number(form.met),
        defaultDurationMinutes: Number.isFinite(parsedDuration) && parsedDuration > 0 ? Math.round(parsedDuration) : 30,
        description: form.description.trim(),
        icon: form.icon,
        isActive: Boolean(form.isActive),
      }

      if (mode === 'add') {
        await axiosInstance.post('/admin/exercises', payload)
        onSaved('Lưu thông tin bài tập thành công')
      } else {
        await axiosInstance.put(`/admin/exercises/${editTarget._id}`, payload)
        onSaved('Lưu thông tin bài tập thành công')
      }
    } catch (err) {
      // Luồng ngoại lệ 4c (Bài tập đã tồn tại) & 7d (Lỗi cập nhật)
      const msg = err.response?.data?.message || 'Không thể cập nhật thông tin bài tập, vui lòng thử lại'
      setApiError(msg)
      if (err.response?.status === 409) {
        setErrors((prev) => ({ ...prev, name: msg }))
      }
    } finally {
      setSaving(false)
    }
  }

  const previewKcal = calculateKcal(form.met, 60, form.defaultDurationMinutes)
  const recommendedIntensity = getRecommendedIntensity(form.met)
  const isIntensityMismatched = recommendedIntensity && recommendedIntensity !== form.intensity

  return (
    <div className="fm-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose() }}>
      <section className="fm-modal exm-form-modal" role="dialog" aria-modal="true">
        {/* Header */}
        <header className="fm-header">
          <div className="fm-header-icon" style={{ background: 'linear-gradient(135deg, #ecfdf5, #a7f3d0)', color: '#059669' }}>
            <i className="bi bi-person-walking" />
          </div>
          <div className="fm-header-text">
            <h2>{mode === 'add' ? 'Thêm bài tập mới vào Danh mục' : `Chỉnh sửa bài tập: ${editTarget?.name}`}</h2>
          </div>
          <button className="fm-close" onClick={onClose} disabled={saving} aria-label="Đóng"><i className="bi bi-x-lg" /></button>
        </header>

        {/* Body */}
        <form onSubmit={handleSubmit} className="fm-body">
          {/* Tên bài tập */}
          <div className="fm-section">
            <div className="fm-field">
              <label className="fm-label" htmlFor="ex-name">
                TÊN BÀI TẬP <span className="fm-req">*</span>
              </label>
              <input
                id="ex-name"
                name="name"
                className={`fm-input ${errors.name ? 'fm-input--err' : ''}`}
                value={form.name}
                onChange={change}
                placeholder="Ví dụ: Chạy bộ địa hình dốc, Đạp xe trong nhà..."
                autoFocus
              />
              {errors.name ? (
                <span className="fm-err-msg">{errors.name}</span>
              ) : (
                <span className="fm-hint"><i className="bi bi-info-circle" /> Tên bài tập đại diện cho hành vi vận động của người dùng</span>
              )}
            </div>
          </div>

          {/* Nhóm bài tập + Cường độ */}
          <div className="fm-section">
            <div className="fm-row exm-row--cats">
              <div className="fm-field">
                <label className="fm-label" htmlFor="ex-category">NHÓM / THỂ LOẠI BÀI TẬP <span className="fm-req">*</span></label>
                <select id="ex-category" name="category" className="fm-input" value={form.category} onChange={change}>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
                <span className="fm-hint"><i className="bi bi-tag" /> Dùng để phân loại trên bộ lọc của người dùng</span>
              </div>

              <div className="fm-field">
                <label className="fm-label">MỨC ĐỘ / CƯỜNG ĐỘ <span className="fm-req">*</span></label>
                <div className="exm-intensity-selector">
                  {INTENSITIES.map((lvl) => (
                    <button
                      key={lvl.label}
                      type="button"
                      className={`exm-intensity-btn ${form.intensity === lvl.label ? 'active' : ''} ${lvl.cls}`}
                      onClick={() => setForm((p) => ({ ...p, intensity: lvl.label }))}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>
                <span className="fm-hint"><i className="bi bi-speedometer2" /> {INTENSITIES.find((i) => i.label === form.intensity)?.desc}</span>
              </div>
            </div>
          </div>

          {/* Giá trị MET + Thời lượng + Live Preview */}
          <div className="fm-section">
            <div className="fm-row fm-row--3">
              <div className="fm-field">
                <label className="fm-label" htmlFor="ex-met">
                  GIÁ TRỊ MET <span className="fm-req">*</span>
                </label>
                <input
                  id="ex-met"
                  name="met"
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="30"
                  className={`fm-input ${errors.met ? 'fm-input--err' : ''}`}
                  value={form.met}
                  onChange={change}
                  placeholder="3.8"
                />
                {errors.met ? (
                  <span className="fm-err-msg">{errors.met}</span>
                ) : (
                  <span className="fm-hint"><i className="bi bi-lightning-fill" /> 1 MET = 1 kcal/kg/h</span>
                )}
              </div>

              <div className="fm-field">
                <label className="fm-label" htmlFor="ex-dur">
                  THỜI LƯỢNG GỢI Ý (PHÚT)
                  {isCustomDuration ? (
                    <button
                      type="button"
                      className="fm-group-switch-btn"
                      onClick={handleSwitchToPreset}
                    >
                      (Chọn khung giờ)
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="fm-group-switch-btn"
                      onClick={() => setIsCustomDuration(true)}
                    >
                      (Tự điền)
                    </button>
                  )}
                </label>

                {isCustomDuration ? (
                  <input
                    id="ex-dur"
                    name="defaultDurationMinutes"
                    type="number"
                    min="1"
                    max="720"
                    className={`fm-input ${errors.defaultDurationMinutes ? 'fm-input--err' : ''}`}
                    value={form.defaultDurationMinutes}
                    onChange={change}
                    placeholder="30"
                    autoFocus
                  />
                ) : (
                  <select
                    id="ex-dur"
                    className="fm-select"
                    value={form.defaultDurationMinutes}
                    onChange={handleDurationSelect}
                  >
                    {DURATION_PRESETS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                    <option value="__CUSTOM__">➕ Tự điền số phút khác...</option>
                  </select>
                )}

                {errors.defaultDurationMinutes && (
                  <span className="fm-err-msg">{errors.defaultDurationMinutes}</span>
                )}
              </div>

              <div className="fm-field">
                <label className="fm-label">ƯỚC TÍNH NĂNG LƯỢNG</label>
                <div className="exm-live-kcal-box">
                  <span className="exm-live-kcal-icon"><i className="bi bi-fire" /></span>
                  <div>
                    <strong>~{previewKcal} kcal</strong>
                    <small>Người 60kg / {form.defaultDurationMinutes || 0}p</small>
                  </div>
                </div>
              </div>
            </div>

            {/* Gợi ý tương quan logic giữa MET và Cường độ nếu phát hiện không khớp */}
            {isIntensityMismatched && (
              <div className="exm-logic-hint">
                <div className="exm-logic-hint-content">
                  <i className="bi bi-lightbulb-fill" />
                  <span>
                    Gợi ý chuẩn hóa: Với chỉ số MET = <strong>{form.met}</strong>, mức độ khuyến nghị là <strong>"{recommendedIntensity}"</strong> (hiện tại: "{form.intensity}").
                  </span>
                </div>
                <button
                  type="button"
                  className="exm-logic-hint-btn"
                  onClick={() => setForm((p) => ({ ...p, intensity: recommendedIntensity }))}
                >
                  <i className="bi bi-magic" /> Đồng bộ: {recommendedIntensity}
                </button>
              </div>
            )}
          </div>

          {/* Biểu tượng bài tập (Icon) */}
          <div className="fm-section">
            <div className="fm-field">
              <div className="exm-icon-header-row">
                <label className="fm-label">BIỂU TƯỢNG BÀI TẬP (ICON)</label>
                <button
                  type="button"
                  className="exm-icon-browse-btn"
                  onClick={() => setShowIconPicker(true)}
                >
                  <i className="bi bi-grid-3x3-gap-fill" /> Mở Kho biểu tượng ({EXERCISE_ICON_LIBRARY.length}+ icon)
                </button>
              </div>

              {/* Thanh chọn icon trực quan */}
              <div className="exm-icon-bar">
                <div
                  className="exm-icon-selected-box"
                  onClick={() => setShowIconPicker(true)}
                  title="Bấm để mở Kho biểu tượng"
                >
                  <span className="exm-icon-selected-badge">
                    <i className={`bi ${form.icon || DEFAULT_CATEGORY_ICONS[form.category] || 'bi-activity'}`} />
                  </span>
                  <div className="exm-icon-selected-info">
                    <strong>{getIconMeta(form.icon, form.category).name}</strong>
                    <small>{form.icon ? 'Bấm để đổi biểu tượng' : 'Đang dùng mặc định theo nhóm bài tập'}</small>
                  </div>
                </div>

                {/* Nút đặt về mặc định nếu đang dùng icon riêng */}
                {form.icon && (
                  <button
                    type="button"
                    className="exm-icon-reset-btn"
                    onClick={() => setForm((p) => ({ ...p, icon: '' }))}
                    title="Khôi phục về biểu tượng mặc định theo nhóm thể loại"
                  >
                    <i className="bi bi-arrow-counterclockwise" /> Về mặc định
                  </button>
                )}

                <div className="exm-icon-quick-list">
                  <span className="exm-icon-quick-label">Gợi ý nhanh:</span>
                  {POPULAR_QUICK_ICONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      className={`exm-icon-choice ${form.icon === ic ? 'active' : ''}`}
                      onClick={() => setForm((p) => ({ ...p, icon: ic }))}
                      title={getIconMeta(ic, form.category).name}
                    >
                      <i className={`bi ${ic}`} />
                    </button>
                  ))}
                  <button
                    type="button"
                    className="exm-icon-more-btn"
                    onClick={() => setShowIconPicker(true)}
                    title="Xem thêm biểu tượng khác"
                  >
                    <i className="bi bi-three-dots" /> Thêm
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Mô tả */}
          <div className="fm-section">
            <div className="fm-field">
              <label className="fm-label" htmlFor="ex-desc">MÔ TẢ CHI TIẾT &amp; HƯỚNG DẪN KỸ THUẬT</label>
              <textarea
                id="ex-desc"
                name="description"
                className="fm-input fm-textarea"
                rows="3"
                value={form.description}
                onChange={change}
                placeholder="Mô tả kỹ thuật thực hiện, nhóm cơ tác động chính và các lưu ý an toàn khi tập..."
              />
            </div>
          </div>

          {/* Trạng thái hiển thị */}
          <div className="fm-section">
            <label className="exm-switch-row">
              <input
                type="checkbox"
                name="isActive"
                checked={form.isActive}
                onChange={change}
              />
              <span className="exm-switch-label">
                <strong>Hiển thị ngay cho người dùng</strong>
                <small>Nếu tắt, bài tập sẽ ở trạng thái "Không hoạt động" (ẩn) và chỉ hiển thị trong trang quản trị.</small>
              </span>
            </label>
          </div>

          {/* Pinned Error Banner */}
          {apiError && (
            <div className="fm-api-err" role="alert">
              <i className="bi bi-exclamation-triangle-fill" /> {apiError}
            </div>
          )}

          {/* Footer */}
          <footer className="fm-footer">
            <button type="button" className="fm-btn-cancel" onClick={onClose} disabled={saving}>Hủy bỏ</button>
            <button type="submit" className="fm-btn-save" disabled={saving}>
              {saving ? (
                <><span className="food-spinner-inline" /> Đang lưu...</>
              ) : (
                <><i className="bi bi-check-lg" /> {mode === 'add' ? 'Lưu bài tập' : 'Cập nhật bài tập'}</>
              )}
            </button>
          </footer>
        </form>
      </section>

      {showIconPicker && (
        <IconPickerModal
          currentIcon={form.icon}
          currentCategory={form.category}
          onSelect={(iconId) => setForm((p) => ({ ...p, icon: iconId }))}
          onClose={() => setShowIconPicker(false)}
        />
      )}
    </div>
  )
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ title, icon, iconClass, body, cancelLabel = 'Hủy', confirmLabel, confirmClass, onCancel, onConfirm, loading, extra }) {
  return (
    <div className="fm-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !loading) onCancel() }}>
      <section className="fm-confirm" role="dialog" aria-modal="true">
        <header className="fm-confirm-header">
          <span className={`fm-confirm-icon ${iconClass}`}><i className={icon} /></span>
          <h2>{title}</h2>
          <button className="fm-close" onClick={onCancel} disabled={loading}><i className="bi bi-x-lg" /></button>
        </header>
        <div className="fm-confirm-body">{body}</div>
        {extra && <div className="fm-confirm-extra">{extra}</div>}
        <footer className="fm-confirm-footer">
          <button className="fm-btn-cancel" onClick={onCancel} disabled={loading}>{cancelLabel}</button>
          <button className={`fm-confirm-action ${confirmClass}`} onClick={onConfirm} disabled={loading}>
            {loading ? <><span className="food-spinner-inline" />Đang xử lý...</> : confirmLabel}
          </button>
        </footer>
      </section>
    </div>
  )
}

// ─── Main Component: ExerciseManagementPage (UC25) ───────────────────────────
export default function ExerciseManagementPage() {
  const [exercises, setExercises] = useState([])
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    hidden: 0,
    totalLogs: 0,
    categoryCounts: {},
  })
  const [pagination, setPagination] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  // Filters & Search
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [intensityFilter, setIntensityFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [page, setPage] = useState(1)

  // Modals state
  const [modalMode, setModalMode] = useState(null) // 'add' | 'edit' | null
  const [editTarget, setEditTarget] = useState(null)
  const [detailTarget, setDetailTarget] = useState(null)
  const [hideTarget, setHideTarget] = useState(null)
  const [hideSaving, setHideSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteSaving, setDeleteSaving] = useState(false)
  const [deleteResult, setDeleteResult] = useState(null)

  // Toast
  const [toast, setToast] = useState(null)
  const toastTimeoutRef = useRef(null)

  function showToast(message, type = 'success') {
    clearTimeout(toastTimeoutRef.current)
    setToast({ message, type })
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3500)
  }

  function triggerRefresh() {
    setRefreshKey((k) => k + 1)
  }

  // ── Hide ──
  async function executeHide(exercise) {
    if (!exercise) return
    setHideSaving(true)
    try {
      await axiosInstance.patch(`/admin/exercises/${exercise._id}/status`, { isActive: false })
      showToast('Ẩn bài tập thành công')
      setHideTarget(null)
      setDeleteTarget(null)
      setDeleteResult(null)
      triggerRefresh()
    } catch (err) {
      showToast(err.response?.data?.message || 'Không thể cập nhật thông tin bài tập, vui lòng thử lại', 'error')
      setHideTarget(null)
    } finally {
      setHideSaving(false)
    }
  }

  // ── Show ──
  async function executeShow(exercise) {
    if (!exercise) return
    try {
      await axiosInstance.patch(`/admin/exercises/${exercise._id}/status`, { isActive: true })
      showToast('Hiển thị bài tập thành công')
      triggerRefresh()
    } catch (err) {
      showToast(err.response?.data?.message || 'Không thể cập nhật thông tin bài tập, vui lòng thử lại', 'error')
    }
  }

  // ── Delete ──
  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleteSaving(true)
    try {
      await axiosInstance.delete(`/admin/exercises/${deleteTarget._id}`)
      showToast('Xóa bài tập thành công')
      setDeleteTarget(null)
      setDeleteResult(null)
      triggerRefresh()
    } catch (err) {
      const { logCount, refCount, canHide } = err.response?.data || {}
      if ((err.response?.status === 400 || err.response?.status === 409) && (logCount !== undefined || refCount !== undefined)) {
        setDeleteResult({
          refCount: logCount ?? refCount,
          canHide: canHide !== false,
          message: err.response.data.message || 'Bài tập này đã có lượt ghi nhận từ người dùng. Hệ thống khuyến cáo bạn nên Ẩn bài tập thay vì xóa để bảo toàn dữ liệu lịch sử.',
        })
      } else {
        showToast(err.response?.data?.message || 'Không thể xóa bài tập, vui lòng thử lại', 'error')
        setDeleteTarget(null)
      }
    } finally {
      setDeleteSaving(false)
    }
  }

  // Fetch exercises list from server
  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      setListError('')
      try {
        const { data } = await axiosInstance.get('/admin/exercises', {
          params: {
            search,
            category: categoryFilter,
            intensity: intensityFilter,
            status: statusFilter,
            sort: sortBy,
            page,
            limit: PAGE_SIZE,
          },
          signal: controller.signal,
        })
        setExercises(data.data || [])
        setPagination(data.pagination || { page, limit: PAGE_SIZE, total: 0, totalPages: 1 })
        setSummary(data.summary || { total: 0, active: 0, hidden: 0, totalLogs: 0, categoryCounts: {} })
      } catch (err) {
        if (err.code !== 'ERR_CANCELED') {
          setListError(err.response?.data?.message || 'Không thể tải danh sách bài tập, vui lòng thử lại')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, search ? 280 : 0)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [search, categoryFilter, intensityFilter, statusFilter, sortBy, page, refreshKey])

  const si = pagination.total ? (page - 1) * PAGE_SIZE + 1 : 0
  const ei = Math.min(page * PAGE_SIZE, pagination.total)

  return (
    <div className="fdm-shell exm-shell">
      {/* Toast */}
      {toast && (
        <div className={`fdm-toast ${toast.type === 'error' ? 'fdm-toast--err' : ''}`} role="alert">
          <i className={`bi ${toast.type === 'error' ? 'bi-exclamation-circle-fill' : 'bi-check-circle-fill'}`} />
          {toast.message}
        </div>
      )}

      {/* ── KPI Row ── */}
      <div className="fdm-kpi-row">
        <div className="fdm-kpi">
          <span className="fdm-kpi-icon fdm-kpi-icon--all">
            <i className="bi bi-collection-play-fill" />
          </span>
          <div>
            <p>Tổng danh mục bài tập</p>
            <strong>{summary.total.toLocaleString('vi-VN')}</strong>
          </div>
        </div>

        <div className="fdm-kpi">
          <span className="fdm-kpi-icon fdm-kpi-icon--active">
            <i className="bi bi-check-circle-fill" />
          </span>
          <div>
            <p>Đang hoạt động</p>
            <strong>{summary.active.toLocaleString('vi-VN')}</strong>
          </div>
        </div>

        <div className="fdm-kpi">
          <span className="fdm-kpi-icon fdm-kpi-icon--hidden">
            <i className="bi bi-eye-slash-fill" />
          </span>
          <div>
            <p>Không hoạt động (Đã ẩn)</p>
            <strong>{summary.hidden.toLocaleString('vi-VN')}</strong>
          </div>
        </div>

        <div className="fdm-kpi">
          <span className="fdm-kpi-icon" style={{ background: '#fdf4ff', color: '#a855f7' }}>
            <i className="bi bi-fire" />
          </span>
          <div>
            <p>Lượt ghi nhận tập luyện</p>
            <strong>{summary.totalLogs.toLocaleString('vi-VN')}</strong>
          </div>
        </div>

        <div className="fdm-kpi-actions">
          <button
            type="button"
            className="fdm-add-btn"
            onClick={() => {
              setModalMode('add')
              setEditTarget(null)
            }}
          >
            <i className="bi bi-plus-circle-fill" /> Thêm bài tập mới
          </button>
        </div>
      </div>

      {/* ── Filter Bar ── */}
      <div className="fdm-filters exm-filters">
        <label className="fdm-search-wrap">
          <i className="bi bi-search" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Tìm theo tên bài tập, mô tả..."
          />
          {search && (
            <button
              className="fdm-search-clear"
              onClick={() => {
                setSearch('')
                setPage(1)
              }}
            >
              <i className="bi bi-x-lg" />
            </button>
          )}
        </label>

        {/* Lọc theo Nhóm */}
        <label className="fdm-filter-select">
          <i className="bi bi-tags-fill" />
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="all">Tất cả thể loại</option>
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.label}</option>
            ))}
          </select>
        </label>

        {/* Lọc theo Cường độ */}
        <label className="fdm-filter-select">
          <i className="bi bi-speedometer2" />
          <select
            value={intensityFilter}
            onChange={(e) => {
              setIntensityFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="all">Tất cả cường độ</option>
            <option value="Nhẹ">Nhẹ (MET &lt; 3.0)</option>
            <option value="Trung bình">Trung bình (MET 3.0 - 6.0)</option>
            <option value="Cao">Cao (MET &gt; 6.0)</option>
          </select>
        </label>

        {/* Lọc theo Trạng thái */}
        <label className="fdm-filter-select">
          <i className="bi bi-funnel-fill" />
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="hidden">Không hoạt động (Đã ẩn)</option>
          </select>
        </label>

        {/* Sắp xếp */}
        <label className="fdm-filter-select">
          <i className="bi bi-sort-down" />
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value)
              setPage(1)
            }}
          >
            <option value="newest">Mới nhất (Mặc định)</option>
            <option value="a-z">Tên bài tập: A → Z</option>
            <option value="z-a">Tên bài tập: Z → A</option>
            <option value="met_desc">MET: Cao → Thấp</option>
            <option value="met_asc">MET: Thấp → Cao</option>
            <option value="oldest">Cũ nhất</option>
          </select>
        </label>

        <span className="fdm-result-count">
          {!loading && `${pagination.total.toLocaleString('vi-VN')} bài tập`}
        </span>
      </div>

      {/* ── Table Panel ── */}
      <div className="fdm-panel">
        {listError ? (
          <div className="fdm-state-msg fdm-state-msg--err">
            <i className="bi bi-exclamation-octagon-fill" />
            <span>{listError}</span>
            <button onClick={() => { setListError(''); triggerRefresh() }}>Thử lại</button>
          </div>
        ) : (
          <div className="fdm-table-scroll">
            <table className="fdm-table">
              <thead>
                <tr>
                  <th className="fdm-th-center" style={{ width: 48 }}>#</th>
                  <th style={{ width: '27%', minWidth: 200 }}>Bài tập thể chất</th>
                  <th style={{ width: '18%', minWidth: 140 }}>Nhóm thể loại</th>
                  <th className="fdm-th-center" style={{ width: '13%', minWidth: 105 }}>Cường độ</th>
                  <th className="fdm-th-center" style={{ width: '12%', minWidth: 95 }}>Chỉ số MET</th>
                  <th className="fdm-th-center" style={{ width: '16%', minWidth: 130 }}>Trạng thái</th>
                  <th className="fdm-th-center" style={{ width: 135 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="fdm-td-msg">
                      <span className="food-spinner" /> Đang tải danh mục bài tập...
                    </td>
                  </tr>
                ) : exercises.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="fdm-td-msg fdm-td-empty">
                      <i className="bi bi-inbox" />
                      <span>Không tìm thấy bài tập phù hợp với bộ lọc hiện tại</span>
                    </td>
                  </tr>
                ) : (
                  exercises.map((ex, idx) => {
                    const isHidden = !ex.isActive
                    const cat = getCategoryMeta(ex.category)

                    return (
                      <tr key={ex._id} className={isHidden ? 'fdm-row--dim' : ''}>
                        <td className="fdm-td-center fdm-td-idx">{si + idx}</td>
                        <td>
                          <div className="fdm-food-cell">
                            <span className="exm-icon-badge">
                              <i className={`bi ${ex.icon || DEFAULT_CATEGORY_ICONS[ex.category] || 'bi-activity'}`} />
                            </span>
                            <div className="fdm-food-info">
                              <strong>{ex.name}</strong>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="fdm-group-chip">
                            <i className={`bi ${cat.icon}`} /> {ex.categoryName || cat.label}
                          </span>
                        </td>
                        <td className="fdm-td-center">
                          <span className={`ex-chip ${getIntensityCls(ex.intensity)}`}>
                            {ex.intensity}
                          </span>
                        </td>
                        <td className="fdm-td-center">
                          <span className="exm-met-badge">
                            MET <strong>{Number(ex.met).toFixed(1)}</strong>
                          </span>
                        </td>
                        <td className="fdm-td-center">
                          <span className={`fdm-status ${isHidden ? 'fdm-status--hidden' : 'fdm-status--active'}`}>
                            <i />{isHidden ? 'Không hoạt động' : 'Đang hoạt động'}
                          </span>
                        </td>
                        <td className="fdm-td-center">
                          <div className="fdm-actions fdm-actions--center">
                            {/* Nút Xem chi tiết */}
                            <button
                              type="button"
                              className="fdm-btn fdm-btn--view"
                              onClick={() => setDetailTarget(ex)}
                              title="Xem chi tiết bài tập"
                            >
                              <i className="bi bi-eye" />
                            </button>

                            {/* Nút Chỉnh sửa */}
                            <button
                              type="button"
                              className="fdm-btn fdm-btn--edit"
                              onClick={() => {
                                setEditTarget(ex)
                                setModalMode('edit')
                              }}
                              title="Chỉnh sửa thông tin"
                            >
                              <i className="bi bi-pencil-fill" />
                            </button>

                            {/* Nút Ẩn / Hiển thị */}
                            {isHidden ? (
                              <button
                                type="button"
                                className="fdm-btn fdm-btn--show"
                                onClick={() => executeShow(ex)}
                                title="Hiển thị lại bài tập"
                              >
                                <i className="bi bi-eye-fill" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="fdm-btn fdm-btn--hide"
                                onClick={() => setHideTarget(ex)}
                                title="Ẩn bài tập"
                              >
                                <i className="bi bi-eye-slash-fill" />
                              </button>
                            )}

                            {/* Nút Xóa */}
                            <button
                              type="button"
                              className="fdm-btn fdm-btn--del"
                              onClick={() => {
                                setDeleteTarget(ex)
                                setDeleteResult(null)
                              }}
                              title="Xóa bài tập"
                            >
                              <i className="bi bi-trash3-fill" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ── */}
        {!loading && !listError && pagination.totalPages > 1 && (
          <footer className="fdm-pagination">
            <span className="fdm-page-info">Hiển thị {si}-{ei} / {pagination.total.toLocaleString('vi-VN')} bài tập</span>
            <div className="fdm-page-btns">
              <button disabled={page <= 1} onClick={() => setPage(1)} title="Trang đầu"><i className="bi bi-chevron-double-left" /></button>
              <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} title="Trang trước"><i className="bi bi-chevron-left" /></button>
              {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
                const f = Math.max(1, Math.min(page - 3, pagination.totalPages - 6))
                const pn = f + i
                return <button key={pn} type="button" className={pn === page ? 'active' : ''} onClick={() => setPage(pn)}>{pn}</button>
              })}
              <button disabled={page >= pagination.totalPages} onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} title="Trang sau"><i className="bi bi-chevron-right" /></button>
              <button disabled={page >= pagination.totalPages} onClick={() => setPage(pagination.totalPages)} title="Trang cuối"><i className="bi bi-chevron-double-right" /></button>
            </div>
          </footer>
        )}
      </div>

      {/* ── Modals ── */}
      {modalMode && (
        <ExerciseFormModal
          mode={modalMode}
          editTarget={editTarget}
          onClose={() => {
            setModalMode(null)
            setEditTarget(null)
          }}
          onSaved={(msg) => {
            setModalMode(null)
            setEditTarget(null)
            showToast(msg)
            triggerRefresh()
          }}
        />
      )}

      {detailTarget && (
        <ExerciseDetailModal
          exercise={detailTarget}
          onClose={() => setDetailTarget(null)}
          onEdit={(ex) => {
            setDetailTarget(null)
            setEditTarget(ex)
            setModalMode('edit')
          }}
          onToggleStatus={(ex) => {
            setDetailTarget(null)
            if (ex.isActive) {
              setHideTarget(ex)
            } else {
              executeShow(ex)
            }
          }}
        />
      )}

      {/* ─── Hide Confirm ─── */}
      {hideTarget && (
        <ConfirmModal
          title="Ẩn bài tập"
          icon="bi bi-eye-slash-fill"
          iconClass="fci--warn"
          body={<>Ẩn <strong>"{hideTarget.name}"</strong> sẽ ngừng hiển thị trong danh mục ghi nhận bài tập của người dùng. Dữ liệu lịch sử đã ghi nhận vẫn được giữ nguyên. Tiếp tục?</>}
          confirmLabel={<><i className="bi bi-eye-slash" />Xác nhận ẩn</>}
          confirmClass="fca--warn"
          loading={hideSaving}
          onCancel={() => setHideTarget(null)}
          onConfirm={() => executeHide(hideTarget)}
        />
      )}

      {/* ─── Delete Confirm ─── */}
      {deleteTarget && !deleteResult && (
        <ConfirmModal
          title="Xóa vĩnh viễn bài tập"
          icon="bi bi-trash3-fill"
          iconClass="fci--danger"
          body={<>Bạn có chắc muốn xóa vĩnh viễn <strong>"{deleteTarget.name}"</strong>? Hệ thống sẽ kiểm tra xem bài tập này có trong nhật ký của người dùng không trước khi xóa.</>}
          confirmLabel={<><i className="bi bi-trash3" />Xóa vĩnh viễn</>}
          confirmClass="fca--danger"
          loading={deleteSaving}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}

      {/* ─── Cannot Delete (đang có dữ liệu tham chiếu) ─── */}
      {deleteTarget && deleteResult && (
        <ConfirmModal
          title="Không thể xóa"
          icon="bi bi-shield-exclamation"
          iconClass="fci--warn"
          body={<p className="fdm-blocked-msg">{deleteResult.message}</p>}
          cancelLabel="Giữ nguyên"
          confirmLabel={deleteResult.canHide ? <><i className="bi bi-eye-slash" />Ẩn thay vì xóa</> : null}
          confirmClass="fca--warn"
          loading={hideSaving}
          onCancel={() => { setDeleteTarget(null); setDeleteResult(null) }}
          onConfirm={deleteResult.canHide ? () => executeHide(deleteTarget) : null}
        />
      )}
    </div>
  )
}
