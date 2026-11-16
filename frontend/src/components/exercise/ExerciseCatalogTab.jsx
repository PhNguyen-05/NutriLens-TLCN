import { useEffect, useMemo, useState } from 'react'
import {
  CATEGORY_TABS,
  EXERCISE_FALLBACK_IMAGES,
  INTENSITY_CHIP,
  calcCalories,
  getExerciseThumbnail,
} from '../../constants/exerciseConstants'

export default function ExerciseCatalogTab({
  exercises = [],
  loadingEx = false,
  userWeight = null,
  searchQ = '',
  onSearchChange,
  catFilter = 'all',
  onCatFilterChange,
  intensityFilter = 'all',
  onIntensityFilterChange,
  sortBy = 'default',
  onSortByChange,
  myCustomCount = 0,
  onOpenLog,
  onOpenCreate,
  onOpenVideo,
  onDeleteCustom,
}) {
  // Local state for debounced input
  const [localSearch, setLocalSearch] = useState(searchQ)

  // Sync incoming searchQ to local state
  useEffect(() => {
    setLocalSearch(searchQ)
  }, [searchQ])

  // Debounce search update (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== searchQ) {
        onSearchChange(localSearch)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [localSearch, searchQ, onSearchChange])

  function handleClearSearch() {
    setLocalSearch('')
    onSearchChange('')
  }

  // Filter & sort
  const filteredEx = useMemo(() => {
    let list = exercises.filter((e) => {
      const inCat =
        catFilter === 'all'
          ? true
          : catFilter === 'my'
          ? Boolean(e.isCustom)
          : e.category === catFilter
      const inIntensity = intensityFilter === 'all' || e.intensity === intensityFilter
      const q = searchQ.toLowerCase().trim()
      const inQ =
        !q ||
        e.name.toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q)
      return inCat && inIntensity && inQ
    })

    if (sortBy === 'met-desc') {
      list.sort((a, b) => (b.met || 0) - (a.met || 0))
    } else if (sortBy === 'met-asc') {
      list.sort((a, b) => (a.met || 0) - (b.met || 0))
    } else if (sortBy === 'name-asc') {
      list.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    } else if (sortBy === 'name-desc') {
      list.sort((a, b) => b.name.localeCompare(a.name, 'vi'))
    }
    return list
  }, [exercises, catFilter, intensityFilter, searchQ, sortBy])

  return (
    <section>
      {/* Toolbar */}
      <div className="ex-catalog-toolbar">
        <div className="ex-catalog-toolbar-row">
          <div className="ex-search-wrap">
            <i className="bi bi-search" />
            <input
              type="text"
              placeholder="Tìm bài tập (vd: chạy bộ, yoga, đạp xe...)"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
            />
            {localSearch && (
              <button
                type="button"
                className="ex-clear-btn"
                onClick={handleClearSearch}
                aria-label="Xóa"
              >
                <i className="bi bi-x-circle-fill" />
              </button>
            )}
          </div>

          <div className="ex-filter-group">
            <select
              className="ex-cat-select"
              value={intensityFilter}
              onChange={(e) => onIntensityFilterChange(e.target.value)}
              aria-label="Lọc theo cường độ"
            >
              <option value="all">Tất cả cường độ</option>
              <option value="Nhẹ">Cường độ: Nhẹ</option>
              <option value="Trung bình">Cường độ: Trung bình</option>
              <option value="Cao">Cường độ: Cao</option>
            </select>

            <select
              className="ex-cat-select"
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value)}
              aria-label="Sắp xếp"
            >
              <option value="default">Sắp xếp: Mặc định</option>
              <option value="met-desc">Calo tiêu hao: Cao → Thấp</option>
              <option value="met-asc">Calo tiêu hao: Thấp → Cao</option>
              <option value="name-asc">Tên bài tập: A → Z</option>
              <option value="name-desc">Tên bài tập: Z → A</option>
            </select>

            <button
              type="button"
              className="ex-btn ex-btn--primary"
              onClick={() => onOpenCreate()}
              title="Tạo bài tập mới vào danh mục cá nhân"
            >
              <i className="bi bi-plus-circle" /> Thêm bài tập
            </button>
          </div>
        </div>

        <div className="ex-cat-tabs" role="group" aria-label="Lọc theo thể loại">
          {CATEGORY_TABS.map((ct) => {
            const badge = ct.id === 'my' && myCustomCount > 0 ? ` (${myCustomCount})` : ''
            return (
              <button
                key={ct.id}
                type="button"
                className={`ex-cat-tab ${catFilter === ct.id ? 'active' : ''}`}
                onClick={() => onCatFilterChange(ct.id)}
              >
                <i className={`bi ${ct.icon}`} />
                {ct.label}
                {badge}
              </button>
            )
          })}
        </div>
      </div>

      {/* Grid */}
      {loadingEx ? (
        <div className="ex-state-empty">
          <span className="fs-mini-spinner" />
          <p>Đang tải danh mục bài tập...</p>
        </div>
      ) : filteredEx.length === 0 ? (
        <div className="ex-state-empty">
          {catFilter === 'my' ? (
            <>
              <i className="bi bi-person-heart" style={{ fontSize: '2.5rem', color: '#10b981' }} />
              <strong>Bạn chưa có bài tập cá nhân nào</strong>
              <p>Hãy thêm bài tập yêu thích hoặc môn thể thao đặc thù của riêng bạn để ghi nhận nhanh chóng.</p>
              <button className="ex-btn ex-btn--primary" onClick={() => onOpenCreate()}>
                <i className="bi bi-plus-circle" /> Tạo bài tập đầu tiên
              </button>
            </>
          ) : (
            <>
              <i className="bi bi-search" />
              <strong>Không tìm thấy bài tập phù hợp</strong>
              <p>Bạn có thể tự tạo bài tập mới vào danh mục cá nhân hoặc xóa bộ lọc để tìm lại.</p>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="ex-btn ex-btn--primary" onClick={() => onOpenCreate(searchQ)}>
                  <i className="bi bi-plus-circle" /> Tạo bài tập "{searchQ || 'mới'}"
                </button>
                <button
                  className="ex-btn ex-btn--outline"
                  onClick={() => {
                    handleClearSearch()
                    onCatFilterChange('all')
                    onIntensityFilterChange('all')
                    onSortByChange('default')
                  }}
                >
                  Xóa bộ lọc
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="ex-exercise-grid">
          {filteredEx.map((ex) => {
            const chip = INTENSITY_CHIP[ex.intensity] || INTENSITY_CHIP['Trung bình']
            const est = userWeight ? calcCalories(ex.met, userWeight, 30) : null
            return (
              <article key={ex._id} className="fd-panel ex-card">
                {/* Media */}
                <div className="ex-card-media">
                  <img
                    src={getExerciseThumbnail(ex)}
                    alt={ex.name}
                    className="ex-card-thumb"
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.onerror = null
                      e.currentTarget.src =
                        EXERCISE_FALLBACK_IMAGES[ex.category] || EXERCISE_FALLBACK_IMAGES.cardio
                    }}
                  />
                  <div className="ex-card-badges-overlay">
                    {ex.isCustom && (
                      <span className="ex-chip ex-chip--custom" title="Bài tập cá nhân">
                        <i className="bi bi-person-fill" /> Cá nhân
                      </span>
                    )}
                    <span className={`ex-chip ${chip.cls}`}>
                      <i className={`bi ${chip.icon}`} />
                      {ex.intensity}
                    </span>
                    <span className="ex-chip ex-chip--met">MET {ex.met}</span>
                  </div>
                  {ex.youtubeUrl && (
                    <button
                      type="button"
                      className="ex-card-yt-badge"
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenVideo(ex)
                      }}
                      title="Xem video hướng dẫn trên YouTube"
                    >
                      <i className="bi bi-youtube" />
                      <span>Video hướng dẫn</span>
                    </button>
                  )}
                </div>
                <h3 className="ex-card-title">{ex.name}</h3>
                <p className="ex-card-desc">
                  {ex.description || (ex.isCustom ? 'Bài tập cá nhân do bạn tạo' : '')}
                </p>
                <div className="ex-card-foot">
                  {est != null ? (
                    <span className="ex-card-est">
                      <i className="bi bi-fire" /> ~<strong>{est}</strong> kcal / 30 phút
                    </span>
                  ) : (
                    <span className="ex-card-est ex-card-est--met">
                      <i className="bi bi-lightning-charge" /> Tiêu chuẩn MET <strong>{ex.met}</strong>
                    </span>
                  )}
                  <div className="ex-card-actions">
                    {ex.isCustom && (
                      <button
                        type="button"
                        className="ex-icon-btn ex-icon-btn--del ex-icon-btn--sm"
                        title="Xóa bài tập cá nhân này"
                        onClick={() => onDeleteCustom(ex)}
                      >
                        <i className="bi bi-trash3" />
                      </button>
                    )}
                    <button
                      type="button"
                      className="ex-btn ex-btn--primary"
                      onClick={() => onOpenLog(ex)}
                    >
                      <i className="bi bi-plus-lg" /> Ghi nhận
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
