import { useEffect, useMemo, useRef, useState } from 'react'
import axiosInstance from '../../api/axiosInstance'
import './CommunityModerationPage.css'

export const INITIAL_POSTS = [
  {
    id: '671000000000000000000001',
    author: 'Nguyễn Thị Mai',
    handle: '@mainguyen',
    avatar: 'M',
    title: 'Bữa trưa đủ chất cho ngày làm việc bận rộn',
    content: 'Hôm nay mình đã thử một chế độ ăn mới và thấy khá hiệu quả. Mọi người có ai đã thử chưa? Chia sẻ với mình nhé!',
    category: 'Chế độ ăn',
    createdAt: '2026-10-30T14:30:00+07:00',
    status: 'Đã duyệt',
    reports: 1,
    comments: 3,
    likes: 12,
    image: '🥗',
    imageTone: 'salad',
    reportReason: 'Nội dung chưa chính xác, có thể gây hiểu nhầm về dinh dưỡng.',
  },
  {
    id: '671000000000000000000002',
    author: 'Trần Văn Nam',
    handle: '@namtran',
    avatar: 'N',
    title: 'Chạy bộ sáng sớm thật là tuyệt vời!',
    content: 'Chạy bộ sáng sớm thật là tuyệt vời! Cảm giác chân tràn đầy năng lượng cho cả ngày dài.',
    category: 'Thể thao',
    createdAt: '2026-10-30T10:10:00+07:00',
    status: 'Chờ duyệt',
    reports: 0,
    comments: 0,
    likes: 0,
    image: '🏃🏻‍♂️',
    imageTone: 'run',
    reportReason: '',
  },
  {
    id: '671000000000000000000003',
    author: 'Lê Thị Hương',
    handle: '@huongle',
    avatar: 'H',
    title: 'Một ly sinh tố xanh cho buổi sáng',
    content: 'Bạn nào biết món sinh tố bổ béo này có nên nhiều calo không ạ? Mình tìm mãi chưa thấy.',
    category: 'Món ăn',
    createdAt: '2026-10-30T08:45:00+07:00',
    status: 'Cần xem xét',
    reports: 3,
    comments: 2,
    likes: 6,
    image: '🥑',
    imageTone: 'smoothie',
    reportReason: 'Bài đăng có thông tin sức khỏe chưa được kiểm chứng.',
  },
  {
    id: '671000000000000000000004',
    author: 'Phạm Đức Anh',
    handle: '@anhpham',
    avatar: 'A',
    title: 'Tập yoga giúp mình thư giãn hơn rất nhiều',
    content: 'Tập yoga giúp mình thư giãn hơn rất nhiều. Rất recommend cho mọi người!',
    category: 'Thể thao',
    createdAt: '2026-10-29T17:05:00+07:00',
    status: 'Đã duyệt',
    reports: 0,
    comments: 8,
    likes: 15,
    image: '🧘🏻‍♀️',
    imageTone: 'yoga',
    reportReason: '',
  },
  {
    id: '671000000000000000000005',
    author: 'Hoàng Thu Trang',
    handle: '@tranghoang',
    avatar: 'T',
    title: 'Bữa trưa hôm nay của mình đây!',
    content: 'Món này vừa ngon vừa tốt cho sức khỏe. Cùng chia sẻ thực đơn của bạn nhé.',
    category: 'Món ăn',
    createdAt: '2026-10-29T12:10:00+07:00',
    status: 'Đã ẩn',
    reports: 2,
    comments: 4,
    likes: 7,
    image: '🍱',
    imageTone: 'lunch',
    reportReason: 'Ảnh và nội dung không liên quan đến chủ đề cộng đồng.',
  },
  {
    id: '671000000000000000000006',
    author: 'Đỗ Minh Quân',
    handle: '@quan.do',
    avatar: 'Q',
    title: 'Chia sẻ mẹo ăn uống lành mạnh mỗi ngày',
    content: 'Mình muốn chia sẻ một vài mẹo nhỏ để mọi người có thêm động lực chăm sóc sức khỏe.',
    category: 'Lối sống',
    createdAt: '2026-10-28T09:25:00+07:00',
    status: 'Từ chối',
    reports: 0,
    comments: 0,
    likes: 2,
    image: '🍊',
    imageTone: 'fruit',
    reportReason: '',
    rejectionReason: 'Nội dung không phù hợp với chủ đề Community.',
  },
]

function getTodayInVietnam() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
}

export function getCommunityDashboardStats(today = getTodayInVietnam()) {
  const dateInVietnam = (value) => new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value))

  return {
    postsToday: INITIAL_POSTS.filter((post) => dateInVietnam(post.createdAt) === today).length,
    reportedPosts: INITIAL_POSTS.filter((post) => post.reports > 0).length,
  }
}

const FILTERS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'approved', label: 'Đã duyệt' },
  { id: 'pending', label: 'Chờ duyệt' },
  { id: 'reported', label: 'Báo cáo' },
  { id: 'hidden', label: 'Đã ẩn' },
  { id: 'rejected', label: 'Đã từ chối' },
]

const REJECTION_REASONS = [
  'Nội dung không phù hợp với chủ đề Community.',
  'Thông tin sai lệch hoặc gây hiểu nhầm.',
  'Nội dung quảng cáo, spam.',
  'Ngôn từ xúc phạm, công kích người khác.',
  'Nội dung vi phạm bản quyền hoặc quyền riêng tư.',
  'Khác.',
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

function statusClass(status) {
  if (status === 'Đã duyệt') return 'approved'
  if (status === 'Chờ duyệt') return 'pending'
  if (status === 'Cần xem xét') return 'review'
  if (status === 'Đã ẩn') return 'hidden'
  return 'rejected'
}

function getEngagementCount(post, field) {
  if (post?.status === 'Chờ duyệt') return 0
  return Number(post?.[field] || 0)
}

export default function CommunityModerationPage({ initialFilter = 'all' }) {
  const [posts, setPosts] = useState(INITIAL_POSTS)
  const [selectedId, setSelectedId] = useState(null)
  const [activeFilter, setActiveFilter] = useState(initialFilter)
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState('newest')
  const [toast, setToast] = useState('')
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectionNote, setRejectionNote] = useState('')
  const [isKeepModalOpen, setIsKeepModalOpen] = useState(false)
  const [keepReason, setKeepReason] = useState('')
  const [keepNote, setKeepNote] = useState('')
  const [isHideModalOpen, setIsHideModalOpen] = useState(false)
  const [hideReason, setHideReason] = useState('')
  const [hideNote, setHideNote] = useState('')
  const [isRejectionReasonOpen, setIsRejectionReasonOpen] = useState(false)
  const toastTimer = useRef(null)

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  const filterCounts = useMemo(() => ({
    all: posts.length,
    approved: posts.filter((post) => post.status === 'Đã duyệt').length,
    pending: posts.filter((post) => post.status === 'Chờ duyệt').length,
    reported: posts.filter((post) => post.reports > 0).length,
    hidden: posts.filter((post) => post.status === 'Đã ẩn').length,
    rejected: posts.filter((post) => post.status === 'Từ chối').length,
  }), [posts])

  const visiblePosts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('vi')
    return posts
      .filter((post) => {
        const matchesFilter = activeFilter === 'all'
          || (activeFilter === 'approved' && post.status === 'Đã duyệt')
          || (activeFilter === 'pending' && post.status === 'Chờ duyệt')
          || (activeFilter === 'reported' && post.reports > 0)
          || (activeFilter === 'hidden' && post.status === 'Đã ẩn')
          || (activeFilter === 'rejected' && post.status === 'Từ chối')
        const matchesQuery = !normalizedQuery || [post.title, post.content, post.author, post.handle, post.category]
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

  async function applyDecision(status) {
    if (!selectedPost) return
    if (status === 'Đã duyệt' && selectedPost.status === 'Đã duyệt') {
      notify('Bài đăng này đã được duyệt rồi.')
      return
    }
    const wasLogged = await recordModerationAction(
      'approve_community_post',
      selectedPost,
      'Duyệt bài đăng Community',
      `Trạng thái: ${selectedPost.status} → ${status}.`,
    )
    setPosts((current) => current.map((post) => post.id === selectedPost.id
      ? { ...post, status, reports: status === 'Đã duyệt' ? 0 : post.reports }
      : post))
    notifyModerationResult(`Đã cập nhật trạng thái thành “${status}”.`, wasLogged)
  }

  function openRejectForm() {
    if (!selectedPost) return
    if (selectedPost.status === 'Từ chối') {
      notify('Bài đăng này đã được từ chối rồi.')
      return
    }
    if (selectedPost.status !== 'Chờ duyệt') return
    setRejectionReason('')
    setRejectionNote('')
    setIsRejectModalOpen(true)
  }

  function closeRejectForm() {
    setIsRejectModalOpen(false)
    setRejectionReason('')
    setRejectionNote('')
  }

  async function confirmRejection(event) {
    event.preventDefault()
    if (!selectedPost || selectedPost.status !== 'Chờ duyệt' || !rejectionReason) return
    const wasLogged = await recordModerationAction(
      'reject_community_post',
      selectedPost,
      'Từ chối bài đăng Community',
      `Lý do: ${rejectionReason}. ${rejectionNote.trim() ? `Ghi chú: ${rejectionNote.trim()}` : ''}`,
    )
    setPosts((current) => current.map((post) => post.id === selectedPost.id
      ? { ...post, status: 'Từ chối', rejectionReason, rejectionNote: rejectionNote.trim() }
      : post))
    closeRejectForm()
    notifyModerationResult('Đã từ chối bài đăng.', wasLogged)
  }

  function openKeepForm() {
    if (!selectedPost || selectedPost.reports < 1 || !['Đã duyệt', 'Cần xem xét'].includes(selectedPost.status)) return
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
    if (!selectedPost || selectedPost.reports < 1 || !['Đã duyệt', 'Cần xem xét'].includes(selectedPost.status) || !keepReason) return
    const wasLogged = await recordModerationAction(
      'keep_community_report',
      selectedPost,
      'Giữ bài đăng sau khi xem xét báo cáo Community',
      `Lý do: ${keepReason}. ${keepNote.trim() ? `Ghi chú: ${keepNote.trim()}` : ''}`,
    )
    setPosts((current) => current.map((post) => post.id === selectedPost.id
      ? { ...post, status: 'Đã duyệt', reports: 0, reportReason: '', keepReason, keepNote: keepNote.trim() }
      : post))
    closeKeepForm()
    notifyModerationResult('Đã giữ nguyên bài đăng.', wasLogged)
  }

  function openHideForm() {
    if (!selectedPost) return
    const canHidePost = selectedPost.status === 'Đã duyệt'
      || (selectedPost.status === 'Cần xem xét' && selectedPost.reports > 0)
    if (!canHidePost) return
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
    const canHidePost = selectedPost.status === 'Đã duyệt'
      || (selectedPost.status === 'Cần xem xét' && selectedPost.reports > 0)
    if (!canHidePost) return
    const wasLogged = await recordModerationAction(
      'hide_community_post',
      selectedPost,
      'Ẩn bài đăng Community',
      `Lý do: ${hideReason}. ${hideNote.trim() ? `Ghi chú: ${hideNote.trim()}` : ''}`,
    )
    setPosts((current) => current.map((post) => post.id === selectedPost.id
      ? { ...post, status: 'Đã ẩn', hideReason, hideNote: hideNote.trim() }
      : post))
    closeHideForm()
    notifyModerationResult('Đã ẩn bài đăng khỏi Community.', wasLogged)
  }

  async function showPostAgain() {
    if (!selectedPost || selectedPost.status !== 'Đã ẩn') return
    const wasLogged = await recordModerationAction(
      'restore_community_post',
      selectedPost,
      'Hiển thị lại bài đăng Community',
      'Trạng thái: Đã ẩn → Đã duyệt.',
    )
    setPosts((current) => current.map((post) => post.id === selectedPost.id
      ? { ...post, status: 'Đã duyệt', reports: 0, reportReason: '' }
      : post))
    notifyModerationResult('Đã hiển thị lại bài đăng trên Community.', wasLogged)
  }

  async function reapproveRejectedPost() {
    if (!selectedPost || selectedPost.status !== 'Từ chối') return
    const wasLogged = await recordModerationAction(
      'reapprove_community_post',
      selectedPost,
      'Duyệt lại bài đăng Community',
      `Trạng thái: Từ chối → Đã duyệt. Lý do từ chối trước: ${selectedPost.rejectionReason || 'Không có ghi chú.'}`,
    )
    setPosts((current) => current.map((post) => post.id === selectedPost.id
      ? { ...post, status: 'Đã duyệt' }
      : post))
    notifyModerationResult('Đã duyệt lại bài đăng.', wasLogged)
  }

  function refreshDemo() {
    setPosts((currentPosts) => [...currentPosts])
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
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm kiếm bài đăng, người dùng…" />
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
                {post.status !== 'Cần xem xét' && <span className={`cm-status ${statusClass(post.status)}`}>{post.status}</span>}
              </button>
            )) : (
              <div className="cm-empty-list"><span><i className="bi bi-inbox" /></span><b>{query ? 'Không có bài đăng phù hợp' : 'Không có bài đăng cần kiểm duyệt'}</b><small>{query ? 'Thử đổi bộ lọc hoặc từ khóa tìm kiếm.' : 'Danh sách sẽ được cập nhật khi có bài đăng mới.'}</small></div>
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
                <div className={`cm-detail-image ${selectedPost.imageTone}`} aria-hidden="true">{selectedPost.image}</div>
                <div className="cm-detail-author"><span className="cm-avatar large">{selectedPost.avatar}</span><span><b>{selectedPost.author}</b><small>{selectedPost.handle}</small></span>{selectedPost.status !== 'Cần xem xét' && <span className={`cm-status ${statusClass(selectedPost.status)}`}>{selectedPost.status}</span>}</div>
                <p className="cm-detail-time"><i className="bi bi-clock" /> {formatPostDate(selectedPost.createdAt)}</p>
                <h3>{selectedPost.title}</h3>
                <p className="cm-detail-content">{selectedPost.content}</p>
                <div className="cm-detail-engagement"><span><i className="bi bi-heart" /> {getEngagementCount(selectedPost, 'likes')} lượt thích</span><span><i className="bi bi-chat" /> {getEngagementCount(selectedPost, 'comments')} bình luận</span></div>
              </article>

              <div className="cm-detail-section">
                <h3>Thông tin bài đăng</h3>
                <dl>
                  <div><dt><i className="bi bi-tag" /> Loại bài đăng</dt><dd>Bài viết Community</dd></div>
                  <div><dt><i className="bi bi-shield-check" /> Trạng thái hiện tại</dt><dd>{selectedPost.status === 'Cần xem xét' ? selectedPost.status : <span className={`cm-status ${statusClass(selectedPost.status)}`}>{selectedPost.status}</span>}</dd></div>
                  <div><dt><i className="bi bi-flag" /> Số lượt báo cáo</dt><dd className={selectedPost.reports ? 'cm-report-value' : ''}>{selectedPost.reports}</dd></div>
                  <div><dt><i className="bi bi-chat-dots" /> Số bình luận</dt><dd>{getEngagementCount(selectedPost, 'comments')}</dd></div>
                </dl>
              </div>

              {selectedPost.reports > 0 && (
                <div className="cm-report-reason"><span><i className="bi bi-flag-fill" /> Lý do bị báo cáo</span><p>{selectedPost.reportReason || 'Bài đăng được người dùng báo cáo để xem xét.'}</p></div>
              )}

              <div className="cm-actions">
                <h3>Hành động</h3>
                <div className="cm-action-grid">
                  {selectedPost.status === 'Chờ duyệt' ? (
                    <>
                      <button type="button" className="approve" onClick={() => applyDecision('Đã duyệt')}><i className="bi bi-check-circle" />Duyệt</button>
                      <button type="button" className="reject" onClick={openRejectForm}><i className="bi bi-x-circle" />Từ chối</button>
                    </>
                  ) : selectedPost.status === 'Đã ẩn' ? (
                    <button type="button" className="approve" onClick={showPostAgain}><i className="bi bi-eye" />Hiển thị lại</button>
                  ) : selectedPost.status === 'Từ chối' ? (
                    <>
                      <button type="button" className="approve" onClick={reapproveRejectedPost}><i className="bi bi-check-circle" />Duyệt lại</button>
                      <button type="button" className="keep" onClick={() => setIsRejectionReasonOpen(true)}><i className="bi bi-file-text" />Xem lý do từ chối</button>
                    </>
                  ) : selectedPost.reports > 0 && ['Đã duyệt', 'Cần xem xét'].includes(selectedPost.status) ? (
                    <>
                      <button type="button" className="keep" onClick={openKeepForm}><i className="bi bi-eye" />Giữ bài đăng</button>
                      <button type="button" className="hide" onClick={openHideForm}><i className="bi bi-eye-slash" />Ẩn bài đăng</button>
                    </>
                  ) : selectedPost.status === 'Đã duyệt' ? (
                    <button type="button" className="hide" onClick={openHideForm}><i className="bi bi-eye-slash" />Ẩn bài đăng</button>
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

      {isRejectModalOpen && selectedPost && (
        <div className="cm-reject-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) closeRejectForm() }}>
          <form className="cm-reject-modal" role="dialog" aria-modal="true" aria-labelledby="cm-reject-title" onSubmit={confirmRejection}>
            <div className="cm-reject-heading">
              <span className="cm-reject-alert"><i className="bi bi-exclamation-lg" /></span>
              <div><h2 id="cm-reject-title">Từ chối bài đăng</h2><p>Vui lòng chọn lý do từ chối để thông báo đến người đăng bài.</p></div>
              <button type="button" aria-label="Đóng biểu mẫu" onClick={closeRejectForm}><i className="bi bi-x-lg" /></button>
            </div>

            <div className="cm-reject-post">
              <div className={`cm-reject-image ${selectedPost.imageTone}`} aria-hidden="true">{selectedPost.image}</div>
              <div><b>{selectedPost.author}</b><p>{selectedPost.content}</p></div>
            </div>

            <label className="cm-reject-field">
              <span><b>*</b> Lý do từ chối</span>
              <span className="cm-reject-select-wrap"><select autoFocus required value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)}>
                <option value="">Chọn lý do từ chối</option>
                {REJECTION_REASONS.map((reason) => <option value={reason} key={reason}>{reason}</option>)}
              </select><i className="bi bi-chevron-down" /></span>
            </label>

            <label className="cm-reject-field cm-reject-note-field">
              <span>Ghi chú bổ sung <small>(tùy chọn)</small></span>
              <textarea maxLength={500} value={rejectionNote} onChange={(event) => setRejectionNote(event.target.value)} placeholder="Nhập thêm ghi chú nếu cần…" />
              <small className="cm-reject-counter">{rejectionNote.length}/500</small>
            </label>

            <div className="cm-reject-actions">
              <button type="button" className="cm-reject-cancel" onClick={closeRejectForm}>Hủy</button>
              <button type="submit" className="cm-reject-confirm" disabled={!rejectionReason}><i className="bi bi-slash-circle" />Từ chối</button>
            </div>
          </form>
        </div>
      )}

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

      {isRejectionReasonOpen && selectedPost?.status === 'Từ chối' && (
        <div className="cm-rejection-reason-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsRejectionReasonOpen(false) }}>
          <section className="cm-rejection-reason-modal" role="dialog" aria-modal="true" aria-labelledby="cm-rejection-reason-title">
            <header className="cm-rejection-reason-heading">
              <span><i className="bi bi-file-text" /></span>
              <div><h2 id="cm-rejection-reason-title">Lý do từ chối</h2><p>Thông tin đã ghi nhận cho bài đăng này.</p></div>
              <button type="button" aria-label="Đóng lý do từ chối" onClick={() => setIsRejectionReasonOpen(false)}><i className="bi bi-x-lg" /></button>
            </header>
            <div className="cm-rejection-reason-content">
              <b>{selectedPost.title}</b>
              <p>{selectedPost.rejectionReason || 'Chưa có lý do từ chối được lưu.'}</p>
              {selectedPost.rejectionNote && <><b>Ghi chú bổ sung</b><p>{selectedPost.rejectionNote}</p></>}
            </div>
            <div className="cm-rejection-reason-actions">
              <button type="button" onClick={() => setIsRejectionReasonOpen(false)}>Đóng</button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}
