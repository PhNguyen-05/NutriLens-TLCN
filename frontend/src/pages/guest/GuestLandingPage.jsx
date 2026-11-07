import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import axiosInstance from '../../api/axiosInstance'
import FoodNavMenu from '../../components/common/FoodNavMenu'
import ExerciseNavMenu from '../../components/common/ExerciseNavMenu'
import UserFooter from '../../components/common/UserFooter'
import './GuestLandingPage.css'

const topicPreviews = [
  {
    category: 'Dinh dưỡng',
    title: 'Dinh dưỡng cân bằng – Chìa khóa cho cơ thể khỏe mạnh',
    description: 'Khám phá cách xây dựng chế độ ăn uống hợp lý và cân bằng.',
    publishedAt: '2026-10-22T00:00:00.000Z',
    image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=700&auto=format&fit=crop&q=85',
  },
  {
    category: 'Luyện tập',
    title: 'Lợi ích của việc tập luyện thường xuyên',
    description: 'Tập luyện đều đặn giúp cơ thể khỏe mạnh và tràn đầy năng lượng.',
    publishedAt: '2026-10-20T00:00:00.000Z',
    image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=700&auto=format&fit=crop&q=85',
  },
  {
    category: 'Sức khỏe',
    title: 'Những loại thực phẩm tốt cho tim mạch',
    description: 'Bổ sung thực phẩm tốt cho tim mạch để chăm sóc sức khỏe mỗi ngày.',
    publishedAt: '2026-10-22T00:00:00.000Z',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=700&auto=format&fit=crop&q=85',
  },
  {
    category: 'Mẹo vặt',
    title: 'Uống đủ nước – Bí quyết nhỏ cho sức khỏe lớn',
    description: 'Nước giúp cơ thể hoạt động hiệu quả và giữ năng lượng tích cực.',
    publishedAt: '2026-10-16T00:00:00.000Z',
    image: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=700&auto=format&fit=crop&q=85',
  },
]

const featureCards = [
  { icon: 'bi-flower1', title: 'Khám phá dinh dưỡng', text: 'Thông tin chính xác, dễ hiểu', action: 'Dành cho thành viên', tone: 'mint', locked: true },
  { icon: 'bi-lightning-charge-fill', title: 'Luyện tập khoa học', text: 'Bài tập phù hợp với bạn', action: 'Dành cho thành viên', tone: 'lilac', locked: true },
  { icon: 'bi-heart-pulse-fill', title: 'Theo dõi sức khỏe', text: 'Quản lý cân nặng, chỉ số cơ thể', action: 'Dành cho thành viên', tone: 'peach', locked: true },
  { icon: 'bi-droplet-fill', title: 'Cộng đồng chia sẻ', text: 'Kết nối và học hỏi cùng cộng đồng', action: 'Khám phá cộng đồng', tone: 'blue', to: '/community' },
]

function resolveMediaUrl(value) {
  const url = String(value || '').trim()
  if (!url) return ''
  if (/^(https?:|data:|blob:)/i.test(url)) return url
  const apiOrigin = String(axiosInstance.defaults.baseURL || '').replace(/\/api\/?$/, '')
  return apiOrigin ? `${apiOrigin}${url.startsWith('/') ? '' : '/'}${url}` : url
}

function articleCategory(article) {
  const value = article?.category || article?.categoryTags?.[0] || 'Dinh dưỡng'
  return String(value).charAt(0).toUpperCase() + String(value).slice(1)
}

function articleExcerpt(content) {
  const text = String(content || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  return text.length > 100 ? `${text.slice(0, 100)}…` : text
}

function articleDate(article, preview) {
  const value = article?.publishedAt || article?.createdAt || preview.publishedAt
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

export function GuestHeader({ activePage, onRequireLogin }) {
  const { pathname } = useLocation()
  const currentPage = pathname.startsWith('/articles')
    ? 'articles'
    : pathname === '/community'
      ? 'community'
      : pathname === '/'
        ? 'home'
        : activePage
  const navClass = (page) => (currentPage === page ? 'is-current' : undefined)
  const currentPageAttr = (page) => (currentPage === page ? 'page' : undefined)
  const showMemberLoginNotice = () => {
    onRequireLogin?.('Bạn cần đăng nhập để sử dụng tính năng dành cho thành viên.')
  }
  const requireMemberLogin = (event) => {
    event.preventDefault()
    showMemberLoginNotice()
  }

  return (
    <header className="guest-header">
      <Link className="guest-logo" to="/" aria-label="NutriLens – Trang chủ">
        <span className="guest-logo-mark"><i className="bi bi-leaf-fill" /></span>
        <span>Nutri<span>Lens</span></span>
      </Link>

      <nav className="guest-nav" aria-label="Điều hướng chính">
        <Link className={navClass('home')} aria-current={currentPageAttr('home')} to="/">Tổng quan</Link>
        <FoodNavMenu onRequireLogin={showMemberLoginNotice} />
        <ExerciseNavMenu onRequireLogin={showMemberLoginNotice} />
        <Link to="/trends" onClick={requireMemberLogin}>Chỉ số &amp; Xu hướng</Link>
        <Link to="/weight-tracker" onClick={requireMemberLogin}>Tiến trình &amp; Cân nặng</Link>
        <Link className={navClass('community')} aria-current={currentPageAttr('community')} to="/community">Cộng đồng</Link>
        <Link className={navClass('articles')} aria-current={currentPageAttr('articles')} to="/articles">Bài viết &amp; Mẹo</Link>
      </nav>

      <div className="guest-auth-actions">
        <Link className="guest-login-button" to="/login">Đăng nhập</Link>
        <Link className="guest-register-button" to="/register">Đăng ký</Link>
      </div>
    </header>
  )
}

function GuestArticleCard({ article, preview, onRequireLogin }) {
  const href = article?._id ? `/articles/${article._id}` : '/articles'
  const title = article?.title || preview.title
  const image = resolveMediaUrl(article?.imageUrl) || preview.image
  const category = article ? articleCategory(article) : preview.category
  const excerpt = article ? articleExcerpt(article.content) : preview.description
  const published = articleDate(article, preview)

  return (
    <Link
      className="guest-article-card"
      to={href}
      onClick={(event) => {
        event.preventDefault()
        onRequireLogin('Bạn cần đăng nhập để xem chi tiết bài viết.')
      }}
    >
      <img className="guest-article-image" src={image} alt="" loading="lazy" />
      <div className="guest-article-copy">
        <div className="guest-article-meta">
          <span className="guest-article-category"><i className="bi bi-journal-text" />{category}</span>
          {published && <time dateTime={article?.publishedAt || article?.createdAt || preview.publishedAt}><i className="bi bi-clock-history" />{published}</time>}
        </div>
        <h3>{title}</h3>
        {excerpt && <p>{excerpt}</p>}
        <span className="guest-article-link">Đọc tiếp <i className="bi bi-arrow-right" /></span>
      </div>
    </Link>
  )
}

export default function GuestLandingPage() {
  const [articles, setArticles] = useState([])
  const [loginNotice, setLoginNotice] = useState('')

  useEffect(() => {
    let isActive = true
    axiosInstance.get('/blog')
      .then(({ data }) => {
        if (isActive && Array.isArray(data?.data)) setArticles(data.data.slice(0, 4))
      })
      .catch(() => {})
    return () => { isActive = false }
  }, [])

  useEffect(() => {
    if (!loginNotice) return undefined
    const timer = window.setTimeout(() => setLoginNotice(''), 5000)
    return () => window.clearTimeout(timer)
  }, [loginNotice])

  const visibleArticles = topicPreviews.map((preview, index) => ({ preview, article: articles[index] }))

  function requireLogin(message) {
    setLoginNotice(typeof message === 'string' ? message : 'Bạn cần đăng nhập để sử dụng tính năng dành cho thành viên.')
  }

  return (
    <div className="guest-home" id="home">
      <GuestHeader onRequireLogin={requireLogin} />
      {loginNotice && (
        <div className="guest-login-notice" role="status" aria-live="polite">
          <i className="bi bi-lock-fill" aria-hidden="true" />
          <span>{loginNotice}</span>
          <Link to="/login">Đăng nhập</Link>
          <button type="button" onClick={() => setLoginNotice('')} aria-label="Đóng thông báo"><i className="bi bi-x-lg" /></button>
        </div>
      )}

      <main className="guest-main">
        <section className="guest-hero" aria-labelledby="guest-hero-title">
          <div className="guest-hero-copy">
            <span className="guest-welcome">Chào mừng bạn đến với NutriLens!</span>
            <h1 id="guest-hero-title">Khám phá kiến thức dinh dưỡng, sức khỏe và luyện tập để sống khỏe hơn mỗi ngày!</h1>
            <p>Cùng NutriLens xây dựng lối sống lành mạnh và cân bằng.</p>
          </div>
          <div className="guest-hero-art" role="img" aria-label="Bữa ăn lành mạnh với rau củ và protein">
            <div className="guest-hero-halo" />
            <i className="bi bi-leaf-fill guest-floating-leaf leaf-one" />
            <i className="bi bi-leaf-fill guest-floating-leaf leaf-two" />
            <i className="bi bi-leaf-fill guest-floating-leaf leaf-three" />
            <img className="guest-hero-photo" src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=1200&auto=format&fit=crop&q=90" alt="Tô salad đầy màu sắc" />
          </div>
        </section>

        <section className="guest-features section-wrap" id="features" aria-label="Khám phá các chủ đề NutriLens">
          <div className="guest-feature-grid">
            {featureCards.map((feature) => (
              <article className="guest-feature-card" key={feature.title}>
                <span className={`guest-feature-icon ${feature.tone}`}><i className={`bi ${feature.icon}`} /></span>
                <span className="guest-feature-content">
                  <strong>{feature.title}</strong>
                  <small>{feature.text}</small>
                  {feature.locked ? (
                    <button className="guest-member-locked compact" type="button" onClick={requireLogin}>{feature.action} <i className="bi bi-lock-fill" /></button>
                  ) : (
                    <Link className="guest-feature-action" to={feature.to}>{feature.action} <i className="bi bi-arrow-right" /></Link>
                  )}
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="guest-spotlight-grid section-wrap" id="member-tools">
          <article className="guest-spotlight-panel">
            <div className="guest-card-heading">
              <span className="guest-section-icon"><i className="bi bi-journal-check" /></span>
              <h2>Nhật ký bữa ăn</h2>
            </div>
            <div className="guest-spotlight-content">
              <div className="guest-shield-art" aria-hidden="true">
                <span className="guest-shield"><i className="bi bi-leaf-fill" /></span>
                <i className="bi bi-leaf-fill shield-leaf shield-leaf-one" />
                <i className="bi bi-leaf-fill shield-leaf shield-leaf-two" />
                <i className="bi bi-stars shield-sparkle" />
              </div>
              <div className="guest-spotlight-copy">
                <h3>Ghi nhận và quản lý bữa ăn</h3>
                <ul className="guest-meal-capabilities">
                  <li><i className="bi bi-check-circle-fill" />Ghi nhận món ăn</li>
                  <li><i className="bi bi-check-circle-fill" />Quản lý thành phần dinh dưỡng</li>
                  <li><i className="bi bi-check-circle-fill" />Yêu cầu bổ sung món ăn</li>
                  <li><i className="bi bi-check-circle-fill" />Xem yêu cầu bổ sung của mình</li>
                </ul>
                <button className="guest-member-locked" type="button" onClick={requireLogin}>Dành cho thành viên <i className="bi bi-lock-fill" /></button>
              </div>
            </div>
          </article>

          <article className="guest-health-panel">
            <div className="guest-card-heading">
              <span className="guest-section-icon health"><i className="bi bi-bar-chart-fill" /></span>
              <h2>Chỉ số sức khỏe của bạn</h2>
            </div>
            <p className="guest-health-description">Theo dõi BMI, BMR và TDEE theo hồ sơ sức khỏe</p>
            <div className="guest-health-art" aria-hidden="true">
              <span className="guest-health-heart"><i className="bi bi-heart-fill" /></span>
              <span className="guest-health-scale"><i className="bi bi-person-standing" /><i className="bi bi-person-standing" /></span>
              <i className="bi bi-leaf-fill health-leaf-one" />
              <i className="bi bi-leaf-fill health-leaf-two" />
            </div>
            <button className="guest-member-locked guest-health-cta" type="button" onClick={requireLogin}>Dành cho thành viên <i className="bi bi-lock-fill" /></button>
          </article>
        </section>

        <section className="guest-support-grid section-wrap" id="community">
          <article className="guest-support-card energy-card">
            <div className="guest-support-art" aria-hidden="true"><i className="bi bi-person-walking" /></div>
            <div className="guest-support-copy">
              <h2>Bài tập và vận động</h2>
              <p>Khám phá bài tập, ghi nhận buổi tập và theo dõi năng lượng tiêu hao mỗi ngày.</p>
              <button className="guest-member-locked" type="button" onClick={requireLogin}>Dành cho thành viên <i className="bi bi-lock-fill" /></button>
            </div>
          </article>
          <article className="guest-support-card community-card">
            <div className="guest-support-art" aria-hidden="true"><i className="bi bi-people-fill" /></div>
            <div className="guest-support-copy">
              <h2>Cộng đồng NutriLens</h2>
              <p>Chia sẻ kinh nghiệm, đặt câu hỏi và nhận lời khuyên từ cộng đồng những người quan tâm đến sức khỏe.</p>
              <Link to="/community">Khám phá cộng đồng <i className="bi bi-arrow-right" /></Link>
            </div>
          </article>
        </section>

        <section className="guest-articles-section section-wrap" id="articles">
          <div className="guest-article-heading">
            <div className="guest-card-heading">
              <span className="guest-section-icon book"><i className="bi bi-book-half" /></span>
              <h2>Bài viết nổi bật</h2>
            </div>
            <Link className="guest-all-articles" to="/articles">Xem tất cả bài viết <i className="bi bi-arrow-right" /></Link>
          </div>
          <div className="guest-article-grid">
            {visibleArticles.map(({ preview, article }) => (
              <GuestArticleCard key={article?._id || preview.title} article={article} preview={preview} onRequireLogin={requireLogin} />
            ))}
          </div>
        </section>
      </main>

      <UserFooter isGuest onRequireLogin={requireLogin} />
    </div>
  )
}
