import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import axiosInstance from '../../api/axiosInstance'
import UserFooter from '../../components/common/UserFooter'
import { GuestHeader } from './GuestLandingPage'
import './GuestCommunityPage.css'

const COMMUNITY_TAGS = [
  'Tất cả',
  'Công thức món ăn',
  'Kinh nghiệm dinh dưỡng',
  'Quá trình tập luyện',
  'Mẹo sức khỏe',
  'Hỏi đáp cộng đồng',
  'Chia sẻ chung',
]

const TRENDING_TAGS = ['#SaladEatClean', '#ThanhHuCalo', '#Chuoi14Ngay', '#BMR_TDEE', '#GiamCanKhoaHoc']
const DEFAULT_MEAL_IMAGE = 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=900&auto=format&fit=crop&q=85'

function resolveMediaUrl(value) {
  const url = String(value || '').trim()
  if (!url) return ''
  if (/^(https?:|data:|blob:)/i.test(url)) return url
  const apiOrigin = String(axiosInstance.defaults.baseURL || '').replace(/\/api\/?$/, '')
  return apiOrigin ? `${apiOrigin}${url.startsWith('/') ? '' : '/'}${url}` : url
}

function formatRelativeTime(value) {
  if (!value) return 'Vừa xong'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Vừa xong'
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000))
  if (minutes < 1) return 'Vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} ngày trước`
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function initials(name) {
  return String(name || 'H').trim().charAt(0).toUpperCase() || 'H'
}

export default function GuestCommunityPage() {
  const [posts, setPosts] = useState([])
  const [topContributors, setTopContributors] = useState([])
  const [trendingRecipe, setTrendingRecipe] = useState(null)
  const [selectedTag, setSelectedTag] = useState('Tất cả')
  const [searchText, setSearchText] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [sortBy, setSortBy] = useState('latest')
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let isActive = true
    setLoading(true)
    axiosInstance.get('/community/posts', {
      params: {
        page: 1,
        limit: 10,
        tag: selectedTag === 'Tất cả' ? undefined : selectedTag,
        search: activeSearch || undefined,
        sortBy,
      },
    })
      .then(({ data }) => {
        if (!isActive) return
        setPosts(Array.isArray(data?.posts) ? data.posts : [])
        setTopContributors(Array.isArray(data?.topContributors) ? data.topContributors : [])
        setTrendingRecipe(data?.trendingRecipe || null)
      })
      .catch(() => {
        if (isActive) {
          setPosts([])
          setTopContributors([])
          setTrendingRecipe(null)
        }
      })
      .finally(() => { if (isActive) setLoading(false) })
    return () => { isActive = false }
  }, [selectedTag, activeSearch, sortBy])

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(''), 5000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const requireLogin = (message) => setNotice(
    typeof message === 'string' ? message : 'Bạn cần đăng nhập để tương tác với cộng đồng.'
  )
  const trendingImage = resolveMediaUrl(trendingRecipe?.imageUrl) || DEFAULT_MEAL_IMAGE

  return (
    <div className="guest-community-page">
      <GuestHeader activePage="community" onRequireLogin={requireLogin} />

      {notice && (
        <div className="guest-community-notice" role="status" aria-live="polite">
          <i className="bi bi-lock-fill" />
          <span>{notice}</span>
          <Link to="/login">Đăng nhập</Link>
          <button type="button" aria-label="Đóng thông báo" onClick={() => setNotice('')}><i className="bi bi-x-lg" /></button>
        </div>
      )}

      <main className="guest-community-main">
        <aside className="guest-community-left">
          <section className="gcommunity-card gcommunity-welcome">
            <div className="gcommunity-avatar gcommunity-avatar-large gcommunity-avatar-community" aria-hidden="true"><i className="bi bi-people-fill" /></div>
            <h1>Cộng đồng NutriLens</h1>
            <p>Khám phá, chia sẻ và học hỏi cùng cộng đồng yêu sức khỏe!</p>
            <div className="gcommunity-login-hint" role="note">
              <i className="bi bi-lock-fill" aria-hidden="true" />
              <span>Đăng nhập để tham gia, tương tác và chia sẻ cùng cộng đồng.</span>
            </div>
          </section>

          <section className="gcommunity-card gcommunity-topics">
            <h2><i className="bi bi-tags-fill" /> Chủ đề cộng đồng</h2>
            <div className="gcommunity-topic-list">
              {COMMUNITY_TAGS.map((tag) => (
                <button key={tag} type="button" className={selectedTag === tag ? 'active' : ''} onClick={() => setSelectedTag(tag)}>
                  <i className={`bi ${tag === 'Tất cả' ? 'bi-tag-fill' : 'bi-bookmark'}`} />{tag}
                </button>
              ))}
            </div>
          </section>

          <section className="gcommunity-card gcommunity-standards">
            <h2><i className="bi bi-shield-check" /> Tiêu chuẩn cộng đồng</h2>
            <ul>
              <li><i className="bi bi-check2-circle" />Chia sẻ thực đơn và công thức calo minh bạch.</li>
              <li><i className="bi bi-check2-circle" />Giữ thái độ văn minh, tích cực, hỗ trợ đồng hành.</li>
              <li><i className="bi bi-check2-circle" />Không quảng cáo hoặc đăng nội dung sai lệch sức khỏe.</li>
            </ul>
          </section>
        </aside>

        <section className="guest-community-feed" id="community-feed">
          <form className="gcommunity-search" onSubmit={(event) => { event.preventDefault(); setActiveSearch(searchText.trim()) }}>
            <i className="bi bi-search" />
            <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Tìm kiếm bài viết, cộng đồng hoặc chủ đề bạn quan tâm..." aria-label="Tìm kiếm cộng đồng" />
            {searchText && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => { setSearchText(''); setActiveSearch('') }}><i className="bi bi-x-circle-fill" /></button>}
          </form>

          <div className="gcommunity-toolbar">
            <button type="button" className="gcommunity-feed-tab active"><i className="bi bi-people-fill" /> Bảng tin chung</button>
            <button type="button" className="gcommunity-feed-tab" onClick={requireLogin}><i className="bi bi-person-badge" /> Bài viết của tôi <span className="gcommunity-lock"><i className="bi bi-lock-fill" /></span></button>
            <div className="gcommunity-sort">
              <button type="button" className={sortBy === 'latest' ? 'active' : ''} onClick={() => setSortBy('latest')}><i className="bi bi-clock" /> Mới nhất</button>
              <button type="button" className={sortBy === 'popular' ? 'active' : ''} onClick={() => setSortBy('popular')}><i className="bi bi-fire" /> Thịnh hành</button>
            </div>
          </div>

          <div className="gcommunity-info"><i className="bi bi-info-circle-fill" /><span>Đăng nhập để tham gia cộng đồng, tương tác và chia sẻ kinh nghiệm của bạn với mọi người!</span></div>

          <section className="gcommunity-card gcommunity-composer">
            <div className="gcommunity-avatar gcommunity-avatar-community" aria-hidden="true"><i className="bi bi-people-fill" /></div>
            <button type="button" className="gcommunity-composer-prompt" onClick={requireLogin}>Chia sẻ suy nghĩ, hình ảnh hoặc câu hỏi của bạn...</button>
            <div className="gcommunity-composer-actions">
              <button type="button" onClick={requireLogin}><i className="bi bi-image-fill" /> Ảnh / Minh họa</button>
              <button type="button" onClick={requireLogin}><i className="bi bi-egg-fried" /> Công thức món</button>
              <button type="button" onClick={requireLogin}><i className="bi bi-lightning-charge-fill" /> Tập luyện</button>
            </div>
          </section>

          {loading ? (
            <div className="gcommunity-card gcommunity-empty"><i className="bi bi-hourglass-split" /><p>Đang tải bảng tin cộng đồng...</p></div>
          ) : posts.length ? (
            <div className="gcommunity-post-list">
              {posts.map((post) => {
                const author = post.authorId || {}
                const avatar = resolveMediaUrl(author.avatarUrl)
                const image = resolveMediaUrl(post.imageUrl)
                const likeCount = post.likeCount ?? post.likes?.length ?? 0
                const commentCount = post.commentCount ?? post.comments?.length ?? 0
                return (
                  <article className="gcommunity-card gcommunity-post" key={post._id}>
                    <header className="gcommunity-post-header">
                      {avatar ? <img className="gcommunity-avatar" src={avatar} alt="" /> : <div className="gcommunity-avatar">{initials(author.fullName)}</div>}
                      <div className="gcommunity-author"><strong>{author.fullName || 'Thành viên NutriLens'}</strong><span><i className="bi bi-clock-history" /> {formatRelativeTime(post.createdAt)} <b>·</b> <em>#{post.tag || 'Chia sẻ chung'}</em></span></div>
                      <button className="gcommunity-more" type="button" aria-label="Tùy chọn bài viết" onClick={requireLogin}><i className="bi bi-three-dots-vertical" /></button>
                    </header>
                    <div className="gcommunity-post-copy">
                      {post.title && <h2>{post.title}</h2>}
                      <p>{post.content || 'Bài viết cộng đồng NutriLens'}</p>
                    </div>
                    {image && <img className="gcommunity-post-image" src={image} alt="Hình minh họa bài viết" loading="lazy" />}
                    <div className="gcommunity-post-stats">
                      <span className="gcommunity-stats-likes"><i className="bi bi-heart-fill" /> {likeCount} tim</span>
                      <button type="button" className="gcommunity-stats-comments" onClick={requireLogin}>{commentCount} bình luận</button>
                    </div>
                    <footer className="post-actions-bar">
                      <button type="button" className="post-footer-btn" onClick={requireLogin}><i className="bi bi-heart" /><span>Thả tim</span></button>
                      <button type="button" className="post-footer-btn" onClick={requireLogin}><i className="bi bi-chat-text" /><span>Bình luận</span></button>
                      <button type="button" className="post-footer-btn post-footer-btn--report" onClick={requireLogin}><i className="bi bi-flag" /><span>Báo cáo</span></button>
                    </footer>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="gcommunity-card gcommunity-empty"><i className="bi bi-chat-square-heart" /><h2>Chưa có bài viết phù hợp</h2><p>Hãy thử chủ đề hoặc từ khóa khác để khám phá bảng tin cộng đồng.</p></div>
          )}

          <div className="gcommunity-bottom-cta"><i className="bi bi-lock-fill" /><span><strong>Đăng nhập</strong> để khám phá thêm nhiều nội dung hữu ích từ cộng đồng NutriLens!</span><Link to="/login">Đăng nhập <i className="bi bi-arrow-right" /></Link></div>
        </section>

        <aside className="guest-community-right">
          <section className="gcommunity-card gcommunity-trends">
            <h2><i className="bi bi-fire" /> Xu hướng thảo luận</h2>
            <div>{TRENDING_TAGS.map((tag) => <button type="button" key={tag} onClick={() => { setSearchText(tag.slice(1)); setActiveSearch(tag.slice(1)) }}>{tag}</button>)}</div>
          </section>
          <section className="gcommunity-card gcommunity-members">
            <h2><i className="bi bi-trophy-fill" /> Thành viên tích cực</h2>
            {topContributors.length ? topContributors.map((member, index) => {
              const avatar = resolveMediaUrl(member.avatarUrl)
              return <div className="gcommunity-member" key={member._id || member.id || member.fullName}>
                <span className="gcommunity-medal">{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span>
                {avatar ? <img className="gcommunity-avatar" src={avatar} alt="" /> : <div className="gcommunity-avatar">{initials(member.fullName)}</div>}
                <div><strong>{member.fullName || 'Thành viên'}</strong><small><i className="bi bi-journal-text" /> {member.postsCount || 0} bài · <i className="bi bi-heart-fill" /> {member.totalLikes || 0}</small></div>
              </div>
            }) : <p className="gcommunity-muted">Thành viên nổi bật sẽ xuất hiện tại đây.</p>}
          </section>
          <section className="gcommunity-card gcommunity-recipe">
            <h2><span><i className="bi bi-stars" /> MÓN NGON NỔI BẬT TUẦN</span></h2>
            <img src={trendingImage} alt={trendingRecipe?.content || 'Món ăn lành mạnh nổi bật'} loading="lazy" />
            {trendingRecipe?.content && <p>{trendingRecipe.content}</p>}
          </section>
        </aside>
      </main>
      <UserFooter isGuest onRequireLogin={requireLogin} />
    </div>
  )
}
