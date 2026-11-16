import { useMemo, useState } from 'react'
import {
  DEFAULT_CATEGORY_ICONS,
  EXERCISE_ICON_LIBRARY,
  ICON_CATEGORIES,
} from '../../constants/exerciseConstants'

export default function IconPickerModal({
  currentIcon,
  currentCategory = 'cardio',
  onSelect,
  onClose,
}) {
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
    const finalIcon = customInput.trim().startsWith('bi-')
      ? customInput.trim()
      : `bi-${customInput.trim()}`
    onSelect(finalIcon)
    onClose()
  }

  return (
    <div
      className="fm-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <section className="fm-modal exm-icon-modal" role="dialog" aria-modal="true">
        <header className="fm-header">
          <div
            className="fm-header-icon"
            style={{
              background: 'linear-gradient(135deg, #ecfdf5, #a7f3d0)',
              color: '#059669',
            }}
          >
            <i className="bi bi-grid-3x3-gap-fill" />
          </div>
          <div className="fm-header-text">
            <h2>Kho biểu tượng bài tập &amp; vận động</h2>
            <p>Chọn biểu tượng có sẵn, dùng mặc định theo nhóm hoặc nhập mã Bootstrap Icon tùy ý</p>
          </div>
          <button className="fm-close" onClick={onClose} aria-label="Đóng">
            <i className="bi bi-x-lg" />
          </button>
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
              <button
                type="button"
                className="exm-picker-search-clear"
                onClick={() => setSearchQuery('')}
              >
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
            {/* Tùy chọn: Mặc định theo nhóm */}
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
                {isDefaultSelected && (
                  <span className="exm-picker-card-check">
                    <i className="bi bi-check-lg" />
                  </span>
                )}
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
                  {isSelected && (
                    <span className="exm-picker-card-check">
                      <i className="bi bi-check-lg" />
                    </span>
                  )}
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
          <button type="button" className="fm-btn-cancel" onClick={onClose}>
            Đóng
          </button>
        </footer>
      </section>
    </div>
  )
}
