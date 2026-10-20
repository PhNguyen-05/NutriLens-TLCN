import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import axiosInstance from '../../api/axiosInstance'
import FoodNavMenu from '../../components/common/FoodNavMenu'

const PAGE_SIZE = 7
const FAVORITES_PAGE_SIZE = 6
const BLOG_VIEWER_STORAGE_KEY = 'nutrilens:blog-viewer-id'
let fallbackBlogViewerId = ''

function createBlogViewerId() {
  const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16)
    return (character === 'x' ? random : (random & 0x3) | 0x8).toString(16)
  })
  return `guest:${uuid}`
}

function getBlogViewerId() {
  try {
    const existing = window.localStorage.getItem(BLOG_VIEWER_STORAGE_KEY)
    if (/^guest:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing || '')) return existing
    const viewerId = createBlogViewerId()
    window.localStorage.setItem(BLOG_VIEWER_STORAGE_KEY, viewerId)
    return viewerId
  } catch {
    if (!fallbackBlogViewerId) fallbackBlogViewerId = createBlogViewerId()
    return fallbackBlogViewerId
  }
}

function formatDate(value) {
  if (!value) return 'Chưa rõ ngày'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa rõ ngày'
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function formatCategory(value) {
  const label = String(value || '').trim()
  return label ? label.charAt(0).toLocaleUpperCase('vi') + label.slice(1) : ''
}

function getArticleCategory(article) {
  return article.category || article.categoryTags?.[0] || 'Dinh dưỡng'
}

function getArticleTags(article) {
  if (Array.isArray(article.tags)) return article.tags
  return (article.categoryTags || []).slice(article.category ? 1 : 0)
}

function getImageUrl(url) {
  if (!url) return ''
  if (/^(https?:|data:)/i.test(url)) return url
  const apiOrigin = String(axiosInstance.defaults.baseURL || '').replace(/\/api\/?$/, '')
  return `${apiOrigin}${url.startsWith('/') ? '' : '/'}${url}`
}

function formatCount(value) {
  return Number(value || 0).toLocaleString('vi-VN')
}

function ArticleCover({ article, className = '' }) {
  const [imageFailed, setImageFailed] = useState(false)
  const imageUrl = getImageUrl(article?.imageUrl)

  if (!imageUrl || imageFailed) {
    return <div className={`ua-cover-fallback ${className}`} aria-hidden="true"><i className="bi bi-journal-richtext" /></div>
  }

  return <div className={`ua-cover ${className}`}><img src={imageUrl} alt={article?.title ? `Ảnh minh họa ${article.title}` : ''} onError={() => setImageFailed(true)} /></div>
}

function UserHeader({ user, onLogout, isActive = false }) {
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)
  const firstName = user?.fullName?.split(' ')[0] || 'bạn'

  return (
    <header className="dashboard-header ua-header">
      <Link className="dashboard-logo" to="/dashboard"><span><i className="bi bi-leaf-fill" /></span>NutriLens</Link>
      <nav className="dashboard-nav" aria-label="Điều hướng chính">
        <Link to="/dashboard">Tổng quan</Link>
        <FoodNavMenu />
        <Link to="/dashboard">Luyện tập</Link>
        <Link to="/weight-tracker">Chỉ số &amp; Xu hướng</Link>
        <Link to="/dashboard">Cộng đồng</Link>
        <Link className={isActive ? 'active' : ''} to="/articles">Bài viết &amp; Mẹo</Link>
      </nav>
      <div className="dashboard-actions">
        <span className="dashboard-search"><i className="bi bi-search" />Tra cứu thực phẩm, món ăn...</span>
        <button className="foodscan-bell" type="button" aria-label="Thông báo"><i className="bi bi-bell" /></button>
        {user && <div className="profile-menu">
          <button className="dashboard-avatar" onClick={() => setProfileOpen((open) => !open)} aria-expanded={profileOpen} aria-haspopup="menu" title="Mở menu tài khoản">
            {user?.avatarUrl ? <img src={user.avatarUrl} alt="Ảnh đại diện" /> : firstName.charAt(0).toUpperCase()}
          </button>
          {profileOpen && <div className="profile-dropdown" role="menu">
            <div className="profile-name">Xin chào, {firstName}</div>
            <button className="profile-link" onClick={() => navigate('/profile')} role="menuitem"><i className="bi bi-person-circle" /> Hồ sơ cá nhân</button>
            <button className="profile-link" onClick={() => navigate('/weight-tracker')} role="menuitem"><i className="bi bi-activity" /> Tiến trình cân nặng</button>
            <button onClick={onLogout} role="menuitem"><i className="bi bi-box-arrow-right" /> Đăng xuất</button>
          </div>}
        </div>}
      </div>
    </header>
  )
}

export default function ArticlesPage({ favoritesOnly = false }) {
  const { user, accessToken, handleLogout } = useAuth()
  const navigate = useNavigate()
  const [viewerId] = useState(getBlogViewerId)
  const [articles, setArticles] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [sortOrder, setSortOrder] = useState('newest')
  const [page, setPage] = useState(1)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    axiosInstance.get('/blog', { params: accessToken ? undefined : { viewerId } })
      .then(({ data }) => {
        if (!cancelled) setArticles(Array.isArray(data.data) ? data.data : [])
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error.response?.data?.message || 'Không thể tải bài viết. Vui lòng thử lại.')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [accessToken, reloadToken, viewerId])

  function retryLoading() {
    setIsLoading(true)
    setLoadError('')
    setReloadToken((current) => current + 1)
  }

  const categories = useMemo(() => {
    const counts = new Map()
    articles.forEach((article) => {
      const category = formatCategory(getArticleCategory(article))
      if (category) counts.set(category, (counts.get(category) || 0) + 1)
    })
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b, 'vi'))
  }, [articles])

  const tagOptions = useMemo(() => {
    const counts = new Map()
    articles.forEach((article) => getArticleTags(article).forEach((tag) => {
      const label = formatCategory(tag)
      if (label) counts.set(label, (counts.get(label) || 0) + 1)
    }))
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b, 'vi'))
  }, [articles])

  const filteredArticles = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('vi')
    return articles.filter((article) => {
      const category = getArticleCategory(article)
      const tags = getArticleTags(article)
      const searchable = [article.title, article.content, category, ...tags].join(' ').toLocaleLowerCase('vi')
      const matchesQuery = !query || searchable.includes(query)
      const matchesCategory = !selectedCategory || formatCategory(category) === selectedCategory
      const matchesTag = !selectedTag || tags.some((tag) => formatCategory(tag) === selectedTag)
      const matchesFavorite = !favoritesOnly || article.isLiked
      return matchesQuery && matchesCategory && matchesTag && matchesFavorite
    }).sort((a, b) => {
      if (sortOrder === 'oldest') return new Date(a.publishedAt || a.createdAt) - new Date(b.publishedAt || b.createdAt)
      if (sortOrder === 'popular') return Number(b.viewCount || 0) - Number(a.viewCount || 0)
      return new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt)
    })
  }, [articles, searchQuery, selectedCategory, selectedTag, favoritesOnly, sortOrder])

  const pageSize = favoritesOnly ? FAVORITES_PAGE_SIZE : PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(filteredArticles.length / pageSize))
  const pageArticles = filteredArticles.slice((page - 1) * pageSize, page * pageSize)
  const featuredArticle = page === 1 ? pageArticles[0] : null
  const gridArticles = featuredArticle ? pageArticles.slice(1) : pageArticles
  const articleGridItems = favoritesOnly ? pageArticles : gridArticles
  const hasActiveFilters = Boolean(searchQuery || selectedCategory || selectedTag || favoritesOnly)

  function updateFilter(update) {
    update()
    setPage(1)
  }

  function clearFilters() {
    setSearchInput('')
    setSearchQuery('')
    setSelectedCategory('')
    setSelectedTag('')
    setPage(1)
  }

  return (
    <div className="dashboard-shell ua-shell">
      <UserHeader user={user} onLogout={handleLogout} isActive />
      <main>
        {favoritesOnly ? <section className="ua-favorites-hero">
          <div className="ua-favorites-hero-inner">
            <div className="ua-favorites-heading-group">
              <span className="ua-favorites-hero-icon"><i className="bi bi-heart-fill" /></span>
              <div><h1>Bài viết yêu thích</h1><p>Danh sách các bài viết mà bạn đã lưu để xem lại bất cứ lúc nào.</p></div>
            </div>
            <button className="ua-favorites-back" type="button" onClick={() => navigate('/articles')}><i className="bi bi-arrow-left" />Quay lại</button>
          </div>
        </section> : <section className="ua-hero">
          <div className="ua-hero-inner">
            <div className="ua-hero-copy">
              <h1>Kiến thức dinh dưỡng cho cuộc sống khỏe mạnh hơn</h1>
              <p>Khám phá bài viết hữu ích về dinh dưỡng, thực phẩm, sức khỏe và lối sống lành mạnh từ các chuyên gia hàng đầu.</p>
              <div className="ua-search-row">
                <form className="ua-search-form" onSubmit={(event) => { event.preventDefault(); setSearchQuery(searchInput); setPage(1) }}>
                  <label><i className="bi bi-search" /><input aria-label="Tìm theo tiêu đề hoặc nội dung bài viết" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Tìm theo tiêu đề hoặc nội dung bài viết..." /></label>
                  <button type="submit"><i className="bi bi-search" />Tìm kiếm</button>
                </form>
                <button className="ua-favorites-button" type="button" aria-label="Xem bài viết yêu thích" onClick={() => navigate('/articles/favorites')}>
                  <span>Bài viết yêu thích</span>
                </button>
              </div>
            </div>
          </div>
        </section>}

        <div className={`ua-content-wrap${favoritesOnly ? ' ua-favorites-content' : ''}`}>
          <div className={favoritesOnly ? 'ua-favorites-layout' : 'ua-layout'}>
            {!favoritesOnly && <aside className="ua-sidebar" aria-label="Bộ lọc bài viết">
              <section className="ua-sidebar-section">
                <h2><i className="bi bi-grid" />Chuyên mục</h2>
                <div className="ua-filter-list">
                  <button type="button" className={!selectedCategory ? 'selected' : ''} onClick={() => updateFilter(() => setSelectedCategory(''))}><span><i className="bi bi-grid-fill" />Tất cả</span><b>{articles.length}</b></button>
                  {categories.map(([category, count]) => <button type="button" className={selectedCategory === category ? 'selected' : ''} key={category} onClick={() => updateFilter(() => setSelectedCategory((current) => current === category ? '' : category))}><span><i className="bi bi-tag" />{category}</span><b>{count}</b></button>)}
                </div>
              </section>

              <section className="ua-sidebar-section ua-tags-section">
                <h2><i className="bi bi-bookmark-heart-fill" />Tag</h2>
                <div className="ua-tag-list">
                  {tagOptions.length ? tagOptions.map(([tag]) => <button type="button" className={selectedTag === tag ? 'selected' : ''} key={tag} onClick={() => updateFilter(() => setSelectedTag((current) => current === tag ? '' : tag))}>#{tag}</button>) : <small>Chưa có tag</small>}
                </div>
              </section>
              <button className="ua-clear-filters" type="button" onClick={clearFilters}><i className="bi bi-arrow-counterclockwise" />Xóa bộ lọc</button>
            </aside>}

            <section className={`ua-results${favoritesOnly ? ' ua-favorite-results' : ''}`} aria-label="Danh sách bài viết">
              <header className="ua-results-heading">
                <h2>{favoritesOnly ? 'Bài viết yêu thích' : 'Tất cả bài viết'} <span>({filteredArticles.length})</span></h2>
                {!favoritesOnly && <label>Sắp xếp theo
                  <select value={sortOrder} onChange={(event) => { setSortOrder(event.target.value); setPage(1) }}>
                    <option value="newest">Mới nhất</option>
                    <option value="oldest">Cũ nhất</option>
                    <option value="popular">Đọc nhiều</option>
                  </select>
                </label>}
              </header>

              {isLoading ? <div className="ua-state"><i className="bi bi-arrow-repeat" /><span>Đang tải bài viết...</span></div>
                : loadError ? <div className="ua-state ua-error"><i className="bi bi-exclamation-circle" /><span>{loadError}</span><button type="button" onClick={retryLoading}>Thử lại</button></div>
                  : filteredArticles.length === 0 ? <div className="ua-state ua-empty"><i className="bi bi-journal-x" /><strong>{favoritesOnly ? 'Bạn chưa có bài viết yêu thích' : 'Chưa tìm thấy bài viết phù hợp'}</strong><span>{favoritesOnly ? 'Những bài viết bạn đã yêu thích sẽ xuất hiện tại đây.' : 'Hãy thử đổi từ khóa hoặc xóa bớt bộ lọc.'}</span>{favoritesOnly ? <button type="button" onClick={() => navigate('/articles')}>Xem tất cả bài viết</button> : hasActiveFilters && <button type="button" onClick={clearFilters}>Xóa bộ lọc</button>}</div>
                    : <>
                      {!favoritesOnly && featuredArticle && <button type="button" className="ua-featured" onClick={() => navigate(`/articles/${featuredArticle._id}`)}>
                        <ArticleCover article={featuredArticle} className="ua-featured-image" />
                        <span className="ua-featured-copy">
                          <span className="ua-featured-label"><i className="bi bi-stars" />Nổi bật</span>
                          <span className="ua-card-category">{formatCategory(getArticleCategory(featuredArticle))}</span>
                          <strong>{featuredArticle.title}</strong>
                          <span className="ua-card-excerpt">{String(featuredArticle.content || '').replace(/\s+/g, ' ').slice(0, 150)}{String(featuredArticle.content || '').length > 150 ? '…' : ''}</span>
                          <span className="ua-card-meta"><span><i className="bi bi-calendar3" />{formatDate(featuredArticle.publishedAt || featuredArticle.createdAt)}</span><span className="ua-engagement"><i className="bi bi-eye" />{formatCount(featuredArticle.viewCount)}</span><span className="ua-engagement ua-likes"><i className="bi bi-heart-fill" />{formatCount(featuredArticle.likeCount)}</span><i className="bi bi-arrow-right" /></span>
                        </span>
                      </button>}

                      {articleGridItems.length > 0 && <div className={`ua-article-grid${favoritesOnly ? ' ua-favorites-grid' : ''}`}>
                        {articleGridItems.map((article) => <button type="button" className="ua-article-card" key={article._id} onClick={() => navigate(`/articles/${article._id}`)}>
                          <ArticleCover article={article} className="ua-card-image" />
                          <span className="ua-article-card-content">
                            <span className="ua-card-category">{formatCategory(getArticleCategory(article))}</span>
                            <strong>{article.title}</strong>
                            <span className="ua-card-excerpt">{String(article.content || '').replace(/\s+/g, ' ').slice(0, 108)}{String(article.content || '').length > 108 ? '…' : ''}</span>
                            <span className="ua-card-meta"><span><i className="bi bi-calendar3" />{formatDate(article.publishedAt || article.createdAt)}</span><span className="ua-engagement"><i className="bi bi-eye" />{formatCount(article.viewCount)}</span><span className="ua-engagement ua-likes"><i className="bi bi-heart-fill" />{formatCount(article.likeCount)}</span><i className="bi bi-arrow-right" /></span>
                          </span>
                        </button>)}
                      </div>}

                      {totalPages > 1 && <nav className="ua-pagination" aria-label="Phân trang bài viết">
                        <button type="button" aria-label="Trang trước" disabled={page === 1} onClick={() => setPage((current) => current - 1)}><i className="bi bi-chevron-left" /></button>
                        {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => <button type="button" className={page === pageNumber ? 'active' : ''} key={pageNumber} onClick={() => setPage(pageNumber)}>{pageNumber}</button>)}
                        <button type="button" aria-label="Trang tiếp" disabled={page === totalPages} onClick={() => setPage((current) => current + 1)}><i className="bi bi-chevron-right" /></button>
                      </nav>}
                    </>}
            </section>
          </div>
        </div>
      </main>

      <footer className="dashboard-footer">
        <span className="footer-copy"><b><i className="bi bi-leaf-fill" /></b>© 2026 NutriLens Health Inc. Dinh dưỡng chính xác bắt đầu từ hiểu rõ bữa ăn.</span>
        <span className="footer-links">Điều khoản dịch vụ · Chính sách bảo mật · Trung tâm hỗ trợ</span>
      </footer>

    </div>
  )
}

function ArticleBody({ content }) {
  const blocks = String(content || '').split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean)

  return (
    <div className="ua-detail-body">
      {blocks.map((block, index) => {
        const lines = block.split(/\r?\n/)
        const firstLine = lines[0].trim()
        const conclusion = firstLine.match(/^(Kết luận|Tóm lại)\s*[:：]?\s*(.*)$/i)
        if (conclusion) {
          const conclusionText = [conclusion[2], ...lines.slice(1)].filter(Boolean).join('\n')
          return <section className="ua-conclusion" key={index}><h2><i className="bi bi-check-circle-fill" />{conclusion[1]}</h2>{conclusionText && <p>{conclusionText}</p>}</section>
        }
        if (/^\d+[.)]\s+/.test(firstLine) && firstLine.length <= 140) {
          return <section className="ua-article-section" key={index}><h2>{firstLine}</h2>{lines.length > 1 && <p>{lines.slice(1).join('\n')}</p>}</section>
        }
        return <p key={index}>{block}</p>
      })}
    </div>
  )
}

export function ArticleDetailPage() {
  const { articleId } = useParams()
  const { user, accessToken, handleLogout } = useAuth()
  const [viewerId] = useState(getBlogViewerId)
  const [article, setArticle] = useState(null)
  const [related, setRelated] = useState([])
  const [loadError, setLoadError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [isLiked, setIsLiked] = useState(false)
  const [isSavingLike, setIsSavingLike] = useState(false)
  const [favoriteError, setFavoriteError] = useState('')
  const viewSentForRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    axiosInstance.get(`/blog/${articleId}`, { params: accessToken ? undefined : { viewerId } })
      .then(({ data }) => {
        if (cancelled) return
        setArticle(data.data)
        setIsLiked(Boolean(data.data.isLiked))
        if (viewSentForRef.current !== articleId) {
          viewSentForRef.current = articleId
          axiosInstance.post(`/blog/${articleId}/view`)
            .then(({ data: viewData }) => {
              if (!cancelled) {
                setArticle((current) => current ? { ...current, viewCount: viewData.data.viewCount } : current)
              }
            })
            .catch(() => {})
        }
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error.response?.data?.message || 'Không thể tải bài viết. Vui lòng thử lại.')
      })
    axiosInstance.get('/blog')
      .then(({ data }) => {
        if (!cancelled) setRelated(Array.isArray(data.data) ? data.data : [])
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [accessToken, articleId, reloadToken, viewerId])

  const relatedArticles = useMemo(() => {
    if (!article) return []
    const category = formatCategory(getArticleCategory(article))
    return related
      .filter((item) => item._id !== article._id && formatCategory(getArticleCategory(item)) === category)
      .slice(0, 4)
  }, [article, related])
  const articleReady = article?._id === articleId
  const isLoading = !loadError && !articleReady

  function retryLoading() {
    setArticle(null)
    setLoadError('')
    setReloadToken((current) => current + 1)
  }

  async function toggleFavorite() {
    if (isSavingLike || !articleReady) return
    setIsSavingLike(true)
    setFavoriteError('')
    try {
      const { data } = await axiosInstance.post(`/blog/${articleId}/favorite`, accessToken ? {} : { viewerId })
      setIsLiked(Boolean(data.data.isLiked))
      setArticle((current) => current ? { ...current, likeCount: data.data.likeCount } : current)
    } catch (error) {
      setFavoriteError(error.response?.data?.message || 'Không thể cập nhật lượt yêu thích. Vui lòng thử lại.')
    } finally {
      setIsSavingLike(false)
    }
  }

  return (
    <div className="dashboard-shell ua-shell">
      <UserHeader user={user} onLogout={handleLogout} isActive />
      <main className="ua-detail-main">
        <div className="ua-detail-wrap">
          <Link className="ua-detail-back" to="/articles"><i className="bi bi-arrow-left" />Tất cả bài viết</Link>
          {isLoading && <div className="ua-state"><i className="bi bi-arrow-repeat" /><span>Đang tải bài viết...</span></div>}
          {loadError && <div className="ua-state ua-error"><i className="bi bi-exclamation-circle" /><span>{loadError}</span><button type="button" onClick={retryLoading}>Thử lại</button></div>}
          {articleReady && <>
            <div className="ua-detail-layout">
              <article className="ua-detail-article">
                <span className="ua-detail-category"><i className="bi bi-journal-text" />{formatCategory(getArticleCategory(article))}</span>
                <h1>{article.title}</h1>
                <div className="ua-detail-meta">
                  <span><i className="bi bi-calendar3" />{formatDate(article.publishedAt || article.createdAt)}</span>
                  <span><i className="bi bi-eye" />{formatCount(article.viewCount)} lượt xem</span>
                  <button
                    className={`ua-detail-like-toggle${isLiked ? ' is-liked' : ''}`}
                    type="button"
                    aria-label={isLiked ? 'Bỏ yêu thích bài viết' : 'Thêm bài viết vào yêu thích'}
                    aria-pressed={isLiked}
                    disabled={isSavingLike}
                    onClick={toggleFavorite}
                  >
                    <i className={`bi ${isLiked ? 'bi-heart-fill' : 'bi-heart'}`} />
                    {formatCount(article.likeCount)} lượt thích
                  </button>
                </div>
                {favoriteError && <p className="ua-favorite-error" role="alert">{favoriteError}</p>}
                <ArticleCover article={article} className="ua-detail-cover" />
                <ArticleBody content={article.content} />
                {getArticleTags(article).length > 0 && <div className="ua-detail-tags">{getArticleTags(article).map((tag) => <span key={tag}>#{tag}</span>)}</div>}
              </article>

              <aside className="ua-detail-sidebar">
                <section className="ua-detail-side-section">
                  <h2><i className="bi bi-grid" />Chuyên mục</h2>
                  <Link to="/articles"><i className="bi bi-tag" />{formatCategory(getArticleCategory(article))}</Link>
                </section>
                {getArticleTags(article).length > 0 && <section className="ua-detail-side-section">
                  <h2><i className="bi bi-bookmark-heart-fill" />Tag</h2>
                  <div className="ua-detail-tags">{getArticleTags(article).map((tag) => <span key={tag}>#{tag}</span>)}</div>
                </section>}
              </aside>
            </div>

            {relatedArticles.length > 0 && <section className="ua-related-bottom">
              <h2>Bài viết liên quan</h2>
              <div className="ua-article-grid">
                {relatedArticles.map((item) => <Link className="ua-article-card" to={`/articles/${item._id}`} key={item._id}>
                  <ArticleCover article={item} className="ua-card-image" />
                  <span className="ua-article-card-content">
                    <span className="ua-card-category">{formatCategory(getArticleCategory(item))}</span>
                    <strong>{item.title}</strong>
                    <span className="ua-card-meta"><span><i className="bi bi-calendar3" />{formatDate(item.publishedAt || item.createdAt)}</span><span className="ua-engagement"><i className="bi bi-eye" />{formatCount(item.viewCount)}</span><span className="ua-engagement ua-likes"><i className="bi bi-heart-fill" />{formatCount(item.likeCount)}</span></span>
                  </span>
                </Link>)}
              </div>
            </section>}
          </>}
        </div>
      </main>
      <footer className="dashboard-footer">
        <span className="footer-copy"><b><i className="bi bi-leaf-fill" /></b>© 2026 NutriLens Health Inc. Dinh dưỡng chính xác bắt đầu từ hiểu rõ bữa ăn.</span>
        <span className="footer-links">Điều khoản dịch vụ · Chính sách bảo mật · Trung tâm hỗ trợ</span>
      </footer>
    </div>
  )
}
