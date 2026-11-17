import React from 'react'
import { resolveMediaUrl } from './communityUtils'

export default function CommunitySidebar({
  topContributors = [],
  trendingRecipe = null,
  onSelectTag,
  onViewAuthor,
}) {
  return (
    <aside className="community-col-right">
      {/* XU HƯỚNG THẢO LUẬN */}
      <div className="community-card community-trending-card">
        <h4 className="sidebar-card-title">
          <i className="bi bi-fire" /> Xu hướng thảo luận
        </h4>
        <div className="trending-tags-grid">
          <button
            type="button"
            className="trending-chip"
            onClick={() => onSelectTag?.('Công thức món ăn')}
          >
            #SaladEatClean
          </button>
          <button
            type="button"
            className="trending-chip"
            onClick={() => onSelectTag?.('Kinh nghiệm dinh dưỡng')}
          >
            #ThamHutCalo
          </button>
          <button
            type="button"
            className="trending-chip"
            onClick={() => onSelectTag?.('Quá trình tập luyện')}
          >
            #Chuoi14Ngay
          </button>
          <button
            type="button"
            className="trending-chip"
            onClick={() => onSelectTag?.('Mẹo sức khỏe')}
          >
            #BMR_TDEE
          </button>
          <button
            type="button"
            className="trending-chip"
            onClick={() => onSelectTag?.('Công thức món ăn')}
          >
            #GiamCanKhoaHoc
          </button>
        </div>
      </div>

      {/* TOP CONTRIBUTORS - THÀNH VIÊN TÍCH CỰC */}
      {topContributors.length > 0 && (
        <div className="community-card community-contributors-card">
          <h4 className="sidebar-card-title">
            <i className="bi bi-trophy-fill" style={{ color: '#eab308' }} /> Thành viên tích cực
          </h4>
          <div className="contributors-list">
            {topContributors.map((c, idx) => {
              const rankEmojis = ['🥇', '🥈', '🥉']
              const initial = (c.fullName || 'U').charAt(0).toUpperCase()
              return (
                <div
                  key={c.id || c._id}
                  className="contributor-item"
                  onClick={() => onViewAuthor?.(c)}
                  title={`Xem tất cả bài viết của ${c.fullName}`}
                >
                  <span className="contributor-rank">{rankEmojis[idx] || `#${idx + 1}`}</span>
                  {c.avatarUrl ? (
                    <img
                      src={resolveMediaUrl(c.avatarUrl)}
                      alt={c.fullName}
                      className="contributor-avatar"
                    />
                  ) : (
                    <div className="contributor-avatar-fallback">{initial}</div>
                  )}
                  <div className="contributor-info">
                    <div className="contributor-name">{c.fullName}</div>
                    <div className="contributor-stats">
                      <span>
                        <i className="bi bi-journal-text" /> {c.postsCount} bài
                      </span>
                      <span>
                        <i className="bi bi-heart-fill" style={{ color: '#ef4444' }} /> {c.totalLikes} tim
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TRENDING RECIPE OF THE WEEK */}
      {trendingRecipe && (
        <div className="community-card trending-recipe-card">
          <span className="trending-recipe-badge">
            <i className="bi bi-stars" /> Món ngon nổi bật tuần
          </span>
          <div
            className="trending-recipe-preview"
            onClick={() => {
              const el = document.getElementById(`post-${trendingRecipe._id}`)
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                el.style.boxShadow = '0 0 0 3px #10b981'
                setTimeout(() => {
                  el.style.boxShadow = ''
                }, 2500)
              } else if (trendingRecipe.authorId) {
                onViewAuthor?.(trendingRecipe.authorId)
              }
            }}
            title="Nhấn để xem chi tiết món ăn"
          >
            {trendingRecipe.imageUrl ? (
              <img
                src={resolveMediaUrl(trendingRecipe.imageUrl)}
                alt={trendingRecipe.content?.slice(0, 50)}
                className="trending-recipe-img"
              />
            ) : (
              <div className="trending-recipe-no-img">
                <i className="bi bi-egg-fried" />
              </div>
            )}

            <div className="trending-recipe-title">
              {trendingRecipe.content?.slice(0, 80)}
              {trendingRecipe.content?.length > 80 ? '...' : ''}
            </div>

            {trendingRecipe.nutrition?.calories != null && (
              <div className="macro-tag macro-cal" style={{ alignSelf: 'flex-start', margin: '2px 0' }}>
                <i className="bi bi-fire" /> <strong>{trendingRecipe.nutrition.calories}</strong> kcal
              </div>
            )}

            <div className="trending-recipe-author">
              <div className="trending-recipe-author-left">
                {trendingRecipe.authorId?.avatarUrl ? (
                  <img
                    src={resolveMediaUrl(trendingRecipe.authorId.avatarUrl)}
                    alt={trendingRecipe.authorId.fullName}
                    className="trending-recipe-author-avatar"
                  />
                ) : (
                  <div className="trending-recipe-author-avatar-fallback">
                    {(trendingRecipe.authorId?.fullName || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <span>{trendingRecipe.authorId?.fullName || 'Thành viên'}</span>
              </div>
              <span
                className="trending-recipe-likes"
                title={`${trendingRecipe.likeCount || (trendingRecipe.likes ? trendingRecipe.likes.length : 0)} tim`}
              >
                <i className="bi bi-heart-fill" />{' '}
                {trendingRecipe.likeCount || (trendingRecipe.likes ? trendingRecipe.likes.length : 0)} tim
              </span>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
