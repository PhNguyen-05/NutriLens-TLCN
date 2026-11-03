import { useEffect, useMemo, useRef, useState } from 'react'
import axiosInstance from '../../api/axiosInstance'
import { COMMUNITY_POSTS_STORAGE_KEY, getCommunityPostsSnapshot, saveCommunityPosts } from './communityPostStore'
import './CommunityModerationPage.css'

const FILTERS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'displaying', label: 'Đang hiển thị' },
  { id: 'reported', label: 'Báo cáo' },
  { id: 'hidden', label: 'Đã ẩn' },
]

const KEEP_REASONS = [
  'Nội dung phù hợp với quy định Community.',
  'Thông tin có căn cứ, không phát hiện vi phạm.',
  'Báo cáo không có đủ căn cứ xác định vi phạm.',
  'Nội dung bị hiểu nhầm do thiếu ngữ cảnh.',
  'Khác.',
]

const HIDE_REASONS = [
  'Nội dung sai lệch hoặc gây hiểu nhầm về sức khỏe, dinh dưỡng.',
  'Nội dung quảng cáo hoặc spam.',
  'Ngôn từ xúc phạm, quấy rối hoặc công kích.',
  'Nội dung phản cảm hoặc không phù hợp.',
  'Vi phạm bản quyền hoặc quyền riêng tư.',
  'Khác.',
]

function formatPostDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const day = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(date)
  const time = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(date)
  return `${day} ${time}`
}

function statusLabel(post) {
  return post.reviewPending ? 'Cần xem xét' : post.status
}

function statusClass(post) {
  if (post.reviewPending) return 'review'
  if (post.status === 'Đang hiển thị') return 'displaying'
  if (post.status === 'Đã ẩn') return 'hidden'
  return 'displaying'
}

function getEngagementCount(post, field) {
  return Number(post?.[field] || 0)
}

function getReportDetails(post) {
  if (Array.isArray(post?.reportDetails) && post.reportDetails.length) return post.reportDetails
  if (!post?.reports) return []
  return [{
    reporter: 'Người dùng Community',
    reason: post.reportReason || 'Bài đăng được người dùng báo cáo để xem xét.',
    reportedAt: post.createdAt,
  }]
}

export default function CommunityModerationPage({ initialFilter = 'all' }) {
  const [posts, setPosts] = useState(getCommunityPostsSnapshot)
  const [selectedId, setSelectedId] = useState(null)
  const [activeFilter, setActiveFilter] = useState(['approved', 'pending'].includes(initialFilter) ? 'displaying' : initialFilter)
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [toast, setToast] = useState('')
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isKeepModalOpen, setIsKeepModalOpen] = useState(false)
  const [keepReason, setKeepReason] = useState('')
  const [keepNote, setKeepNote] = useState('')
  const [isHideModalOpen, setIsHideModalOpen] = useState(false)
  const [hideReason, setHideReason] = useState('')
  const [hideNote, setHideNote] = useState('')
  const toastTimer = useRef(null)

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])
  useEffect(() => saveCommunityPosts(posts), [posts])
  useEffect(() => {
    function refreshPosts(event) {
      if (!event.key || event.key === COMMUNITY_POSTS_STORAGE_KEY) setPosts(getCommunityPostsSnapshot())
    }
    window.addEventListener('storage', refreshPosts)
    return () => window.removeEventListener('storage', refreshPosts)
  }, [])

  const filterCounts = useMemo(() => ({
    all: posts.length,
    displaying: posts.filter((post) => post.status === 'Đang hiển thị' && !post.reviewPending).length,
    reported: posts.filter((post) => post.reviewPending).length,
    hidden: posts.filter((post) => post.status === 'Đã ẩn' && !post.reviewPending).length,
  }), [posts])

  const visiblePosts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('vi')
    return posts
      .filter((post) => {
        const matchesFilter = activeFilter === 'all'
          || (activeFilter === 'displaying' && post.status === 'Đang hiển thị' && !post.reviewPending)
          || (activeFilter === 'reported' && post.reviewPending)
          || (activeFilter === 'hidden' && post.status === 'Đã ẩn' && !post.reviewPending)
        const reportText = getReportDetails(post).map((report) => `${report.reporter} ${report.reason}`).join(' ')
        const matchesQuery = !normalizedQuery || [post.title, post.content, post.author, post.handle, post.category, post.reportReason, reportText]
          .some((value) => String(value).toLocaleLowerCase('vi').includes(normalizedQuery))
        return matchesFilter && matchesQuery
      })
      .sort((left, right) => sortBy === 'reports'
        ? right.reports - left.reports || new Date(right.createdAt) - new Date(left.createdAt)
        : sortBy === 'oldest'
          ? new Date(left.createdAt) - new Date(right.createdAt)
          : new Date(right.createdAt) - new Date(left.createdAt))
  }, [posts, activeFilter, query, sortBy])

  const selectedPost = visiblePosts.find((post) => post.id === selectedId) || null

  function notify(message) {
    window.clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = window.setTimeout(() => setToast(''), 2600)
  }

  async function recordModerationAction(actionType, post, summary, detail) {
    try {
      await axiosInstance.post('/admin/users/action-logs/community', {
        actionType,
        targetId: post.id,
        reason: `${summary}: "${post.title}"`,
        note: `Người đăng: ${post.author} (${post.handle}). ${detail}`,
      })
      return true
    } catch {
      return false
    }
  }

  function notifyModerationResult(message, wasLogged) {
    notify(wasLogged ? message : `${message} Chưa lưu được vào lịch sử thao tác.`)
  }

  function openKeepForm() {
    if (!selectedPost || !selectedPost.reviewPending) return
    setKeepReason('')
    setKeepNote('')
    setIsKeepModalOpen(true)
  }

  function closeKeepForm() {
    setIsKeepModalOpen(false)
    setKeepReason('')
    setKeepNote('')
  }

  async function confirmKeepPost(event) {
    event.preventDefault()
    if (!selectedPost || !selectedPost.reviewPending || !keepReason) return
    const wasLogged = await recordModerationAction(
      'keep_community_report',
      selectedPost,
      'Giữ bài đăng sau khi xem xét báo cáo Community',
      `Lý do: ${keepReason}. ${keepNote.trim() ? `Ghi chú: ${keepNote.trim()}` : ''}`,
    )
    setPosts((current) => current.map((post) => post.id === selectedPost.id
      ? {
          ...post,
          status: 'Đang hiển thị',
          reports: 0,
          reviewPending: false,
          reportReason: '',
          keepReason,
          keepNote: keepNote.trim(),
        }
      : post))
    setSelectedId(selectedPost.id)
    setActiveFilter('displaying')
    closeKeepForm()
    notifyModerationResult('Đã xử lý báo cáo và giữ bài đăng ở trạng thái hiển thị.', wasLogged)
  }

  function openHideForm() {
    if (!selectedPost) return
    if (selectedPost.status !== 'Đang hiển thị' && !selectedPost.reviewPending) return
    setHideReason('')
    setHideNote('')
    setIsHideModalOpen(true)
  }

  function closeHideForm() {
    setIsHideModalOpen(false)
    setHideReason('')
    setHideNote('')
  }

  async function confirmHidePost(event) {
    event.preventDefault()
    if (!selectedPost || !hideReason) return
    if (selectedPost.status !== 'Đang hiển thị' && !selectedPost.reviewPending) return
    const wasLogged = await recordModerationAction(
      'hide_community_post',
      selectedPost,
      'Ẩn bài đăng Community',
      `Lý do: ${hideReason}. ${hideNote.trim() ? `Ghi chú: ${hideNote.trim()}` : ''}`,
    )
    setPosts((current) => current.map((post) => post.id === selectedPost.id
      ? {
          ...post,
          status: 'Đã ẩn',
          hideReason,
          hideNote: hideNote.trim(),
          reports: 0,
          reviewPending: false,
          reportReason: '',
        }
      : post))
    setSelectedId(selectedPost.id)
    setActiveFilter('hidden')
    closeHideForm()
    notifyModerationResult('Đã ẩn bài đăng khỏi Community.', wasLogged)
  }

  async function showPostAgain() {
    if (!selectedPost || selectedPost.status !== 'Đã ẩn') return
    const wasLogged = await recordModerationAction(
      'restore_community_post',
      selectedPost,
      'Hiển thị lại bài đăng Community',
      'Trạng thái: Đã ẩn → Đang hiển thị.',
    )
    setPosts((current) => current.map((post) => post.id === selectedPost.id
      ? {
          ...post,
          status: 'Đang hiển thị',
          reports: 0,
          reviewPending: false,
          reportReason: '',
        }
      : post))
    setActiveFilter('displaying')
    notifyModerationResult('Đã hiển thị lại bài đăng trên Community.', wasLogged)
  }

  function refreshDemo() {
    setPosts(getCommunityPostsSnapshot())
    notify('Đã làm mới danh sách bài đăng.')
  }

  return (
    <section className="community-moderation" aria-label="Kiểm duyệt Community">
      {toast && <div className="cm-toast" role="status"><i className="bi bi-check-circle-fill" />{toast}</div>}

      <div className="cm-toolbar">
        <div className="cm-filter-tabs" role="tablist" aria-label="Lọc bài đăng">
          {FILTERS.map((filter) => (
            <button
              type="button"
              role="tab"
              aria-selected={activeFilter === filter.id}
              className={activeFilter === filter.id ? 'active' : ''}
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
            >
              {filter.label}<span>{filterCounts[filter.id]}</span>
            </button>
          ))}
        </div>
        <button type="button" className="cm-refresh-button" onClick={refreshDemo}>
          <i className="bi bi-arrow-clockwise" /> Làm mới
        </button>
      </div>

      <div className="cm-workspace">
        <section className="cm-list-panel" aria-label="Danh sách bài đăng Community">
          <div className="cm-list-tools">
            <label className="cm-search">
              <i className="bi bi-search" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm kiếm bài đăng, người đăng, lý do báo cáo…" />
              {query && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setQuery('')}><i className="bi bi-x-lg" /></button>}
            </label>
            <label className="cm-sort">
              <i className="bi bi-filter" />
              <select aria-label="Sắp xếp bài đăng" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="newest">Mới nhất</option>
                <option value="oldest">Cũ nhất</option>
                <option value="reports">Nhiều báo cáo</option>
              </select>
              <i className="bi bi-chevron-down" />
            </label>
          </div>

          <div className="cm-post-list">
            {visiblePosts.length ? visiblePosts.map((post) => (
              <button
                type="button"
                className={`cm-post-card ${selectedPost?.id === post.id ? 'selected' : ''}`}
                key={post.id}
                onClick={() => { setSelectedId(post.id); setIsDetailOpen(true) }}
                aria-pressed={selectedPost?.id === post.id}
              >
                <span className={`cm-post-image ${post.imageTone}`} aria-hidden="true">{post.image}</span>
                <span className="cm-post-copy">
                  <span className="cm-post-author"><span className="cm-avatar">{post.avatar}</span><b>{post.author}</b><small>{post.handle}</small><em>· {formatPostDate(post.createdAt).split(' ')[0]}</em></span>
                  <strong>{post.title}</strong>
                  <span className="cm-post-excerpt">{post.content}</span>
                  <span className="cm-post-meta"><em>#{post.category}</em><span><i className="bi bi-heart" /> {getEngagementCount(post, 'likes')}</span><span><i className="bi bi-chat" /> {getEngagementCount(post, 'comments')}</span>{post.reports > 0 && <span className="cm-report-count"><i className="bi bi-flag" /> {post.reports} báo cáo</span>}</span>
                </span>
                <span className={`cm-status ${statusClass(post)}`}>{statusLabel(post)}</span>
              </button>
            )) : (
              <div className="cm-empty-list"><span><i className="bi bi-inbox" /></span><b>{query ? 'Không có bài đăng phù hợp' : 'Không tìm thấy bài đăng'}</b><small>{query ? 'Thử đổi bộ lọc hoặc từ khóa tìm kiếm.' : 'Danh sách sẽ được cập nhật khi có bài đăng mới.'}</small></div>
            )}
          </div>

          <div className="cm-list-footer">
            <span className="cm-pagination"><button disabled aria-label="Trang trước"><i className="bi bi-chevron-left" /></button><button className="current">1</button><button disabled aria-label="Trang sau"><i className="bi bi-chevron-right" /></button></span>
          </div>
        </section>

        <aside className="cm-detail-panel" aria-label="Chi tiết bài đăng">
          {isDetailOpen && selectedPost ? (
            <>
              <div className="cm-detail-heading"><h2>Chi tiết bài đăng</h2><button type="button" onClick={() => setIsDetailOpen(false)} aria-label="Đóng chi tiết bài đăng"><i className="bi bi-x-lg" /></button></div>
              <article className="cm-detail-post">
                <div className="cm-detail-post-heading">
                  <div className={`cm-detail-image ${selectedPost.imageTone}`} aria-hidden="true">{selectedPost.image}</div>
                  <h3>{selectedPost.title}</h3>
                  <span className={`cm-status ${statusClass(selectedPost)}`}>{statusLabel(selectedPost)}</span>
                </div>
                <div className="cm-detail-author"><span className="cm-avatar large">{selectedPost.avatar}</span><span><b>{selectedPost.author}</b><small>{selectedPost.handle}</small></span></div>
                <p className="cm-detail-time"><i className="bi bi-clock" /> {formatPostDate(selectedPost.createdAt)}</p>
                <p className="cm-detail-content">{selectedPost.content}</p>
                <div className="cm-detail-engagement"><span><i className="bi bi-heart" /> {getEngagementCount(selectedPost, 'likes')} lượt thích</span><span><i className="bi bi-chat" /> {getEngagementCount(selectedPost, 'comments')} bình luận</span></div>
              </article>

              <div className="cm-detail-section">
                <h3>Thông tin bài đăng</h3>
                <dl>
                  <div><dt><i className="bi bi-tag" /> Loại bài đăng</dt><dd>Bài viết Community</dd></div>
                  <div><dt><i className="bi bi-shield-check" /> Trạng thái hiện tại</dt><dd><span className={`cm-status ${statusClass(selectedPost)}`}>{statusLabel(selectedPost)}</span></dd></div>
                  <div><dt><i className="bi bi-flag" /> Số lượt báo cáo</dt><dd className={selectedPost.reports ? 'cm-report-value' : ''}>{selectedPost.reports}</dd></div>
                  <div><dt><i className="bi bi-chat-dots" /> Số bình luận</dt><dd>{getEngagementCount(selectedPost, 'comments')}</dd></div>
                </dl>
              </div>

              {selectedPost.reports > 0 && (
                <section className="cm-report-details" aria-label="Thông tin báo cáo">
                  <h3><i className="bi bi-exclamation-circle-fill" />Thông tin báo cáo ({selectedPost.reports} báo cáo)</h3>
                  {selectedPost.reviewPending && <p className="cm-report-review-note"><i className="bi bi-eye-slash-fill" />Bài đăng đã được ẩn tự động và đang chờ Admin xem xét.</p>}
                  <ul>{getReportDetails(selectedPost).map((report, index) => (
                    <li key={`${report.reporter}-${report.reportedAt}-${index}`}>
                      <span className="cm-reporter-avatar"><i className="bi bi-person-fill" /></span>
                      <span className="cm-reporter-copy"><b>{report.reporter}</b><span>{report.reason}</span><time>{formatPostDate(report.reportedAt)}</time></span>
                    </li>
                  ))}</ul>
                </section>
              )}

              <div className="cm-actions">
                <h3>Hành động</h3>
                <div className="cm-action-grid">
                  {selectedPost.reviewPending ? (
                    <>
                      <button type="button" className="keep" onClick={openKeepForm}><i className="bi bi-eye" /><span><b>Giữ bài đăng</b><small>Hiển thị lại công khai</small></span></button>
                      <button type="button" className="hide" onClick={openHideForm}><i className="bi bi-eye-slash" /><span><b>Xác nhận ẩn</b><small>Giữ bài đăng ở trạng thái ẩn</small></span></button>
                    </>
                  ) : selectedPost.status === 'Đã ẩn' ? (
                    <button type="button" className="approve" onClick={showPostAgain}><i className="bi bi-eye" /><span><b>Hiển thị lại</b><small>Đưa bài đăng trở lại Community</small></span></button>
                  ) : selectedPost.status === 'Đang hiển thị' ? (
                    <button type="button" className="hide" onClick={openHideForm}><i className="bi bi-eye-slash" /><span><b>Ẩn bài đăng</b><small>Không còn hiển thị công khai</small></span></button>
                  ) : (
                    <p className="cm-no-actions">Không có hành động cần xử lý.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="cm-detail-empty"><span><i className="bi bi-card-text" /></span><b>Chọn một bài đăng</b><small>Thông tin và hành động kiểm duyệt sẽ hiển thị tại đây.</small></div>
          )}
        </aside>
      </div>

      {isKeepModalOpen && selectedPost && (
        <div className="cm-keep-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) closeKeepForm() }}>
          <form className="cm-keep-modal" role="dialog" aria-modal="true" aria-labelledby="cm-keep-title" onSubmit={confirmKeepPost}>
            <div className="cm-keep-heading">
              <span className="cm-keep-confirm-icon"><i className="bi bi-check-lg" /></span>
              <div><h2 id="cm-keep-title">Giữ bài đăng</h2><p>Vui lòng cho biết lý do để ghi nhận quyết định của bạn.</p></div>
              <button type="button" aria-label="Đóng biểu mẫu" onClick={closeKeepForm}><i className="bi bi-x-lg" /></button>
            </div>

            <div className="cm-keep-post">
              <div className={`cm-keep-image ${selectedPost.imageTone}`} aria-hidden="true">{selectedPost.image}</div>
              <div><b>{selectedPost.author}</b><p>{selectedPost.content}</p></div>
            </div>

            <label className="cm-keep-field">
              <span><b>*</b> Lý do giữ bài đăng</span>
              <span className="cm-keep-select-wrap"><select autoFocus required value={keepReason} onChange={(event) => setKeepReason(event.target.value)}>
                <option value="">Chọn lý do giữ bài đăng</option>
                {KEEP_REASONS.map((reason) => <option value={reason} key={reason}>{reason}</option>)}
              </select><i className="bi bi-chevron-down" /></span>
            </label>

            <label className="cm-keep-field cm-keep-note-field">
              <span>Ghi chú bổ sung <small>(tùy chọn)</small></span>
              <textarea maxLength={500} value={keepNote} onChange={(event) => setKeepNote(event.target.value)} placeholder="Nhập thêm ghi chú nếu cần…" />
              <small className="cm-keep-counter">{keepNote.length}/500</small>
            </label>

            <div className="cm-keep-actions">
              <button type="button" className="cm-keep-cancel" onClick={closeKeepForm}>Hủy</button>
              <button type="submit" className="cm-keep-submit" disabled={!keepReason}><i className="bi bi-check-circle" />Giữ bài đăng</button>
            </div>
          </form>
        </div>
      )}

      {isHideModalOpen && selectedPost && (
        <div className="cm-hide-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) closeHideForm() }}>
          <form className="cm-keep-modal" role="dialog" aria-modal="true" aria-labelledby="cm-hide-title" onSubmit={confirmHidePost}>
            <div className="cm-keep-heading">
              <span className="cm-hide-warning-icon"><i className="bi bi-eye-slash-fill" /></span>
              <div><h2 id="cm-hide-title">Ẩn bài đăng</h2><p>Bài đăng sẽ không hiển thị công khai trên Community. Vui lòng chọn lý do.</p></div>
              <button type="button" aria-label="Đóng biểu mẫu" onClick={closeHideForm}><i className="bi bi-x-lg" /></button>
            </div>

            <div className="cm-keep-post">
              <div className={`cm-keep-image ${selectedPost.imageTone}`} aria-hidden="true">{selectedPost.image}</div>
              <div><b>{selectedPost.author}</b><p>{selectedPost.content}</p></div>
            </div>

            <label className="cm-keep-field">
              <span><b>*</b> Lý do ẩn bài đăng</span>
              <span className="cm-keep-select-wrap"><select autoFocus required value={hideReason} onChange={(event) => setHideReason(event.target.value)}>
                <option value="">Chọn lý do ẩn bài đăng</option>
                {HIDE_REASONS.map((reason) => <option value={reason} key={reason}>{reason}</option>)}
              </select><i className="bi bi-chevron-down" /></span>
            </label>

            <label className="cm-keep-field cm-keep-note-field">
              <span>Ghi chú bổ sung <small>(tùy chọn)</small></span>
              <textarea maxLength={500} value={hideNote} onChange={(event) => setHideNote(event.target.value)} placeholder="Nhập thêm ghi chú nếu cần…" />
              <small className="cm-keep-counter">{hideNote.length}/500</small>
            </label>

            <div className="cm-keep-actions">
              <button type="button" className="cm-keep-cancel" onClick={closeHideForm}>Hủy</button>
              <button type="submit" className="cm-hide-submit" disabled={!hideReason}><i className="bi bi-eye-slash" />Ẩn bài đăng</button>
            </div>
          </form>
        </div>
      )}

    </section>
  )
}
