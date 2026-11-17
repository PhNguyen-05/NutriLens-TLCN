import React, { useEffect, useState, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import UserHeader from '../../components/common/UserHeader'
import UserFooter from '../../components/common/UserFooter'
import { useAuth } from '../../hooks/useAuth'
import axiosInstance from '../../api/axiosInstance'

// Sub-components
import PostCard from '../../components/community/PostCard'
import CommunitySidebar from '../../components/community/CommunitySidebar'
import CreatePostModal from '../../components/community/CreatePostModal'
import EditPostModal from '../../components/community/EditPostModal'
import ReportPostModal from '../../components/community/ReportPostModal'
import DeleteConfirmModal from '../../components/community/DeleteConfirmModal'

// Utilities & constants
import {
  COMMUNITY_TAGS,
  TAG_COLOR_MAP,
  resolveMediaUrl,
} from '../../components/community/communityUtils'

export default function CommunityPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // State danh sách bài viết & filter
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTag, setSelectedTag] = useState('Tất cả')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSearch, setActiveSearch] = useState('')

  // State chế độ bảng tin: 'all' | 'mine' | 'author'
  const [searchParams, setSearchParams] = useSearchParams()
  const authorIdParam = searchParams.get('authorId')
  const filterParam = searchParams.get('filter')
  const initialMode = authorIdParam ? 'author' : filterParam === 'mine' ? 'mine' : 'all'
  const [feedMode, setFeedMode] = useState(initialMode)
  const [viewedAuthor, setViewedAuthor] = useState(null)
  const [sortBy, setSortBy] = useState('latest')
  const [topContributors, setTopContributors] = useState([])
  const [trendingRecipe, setTrendingRecipe] = useState(null)

  // State modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createModalInitialTag, setCreateModalInitialTag] = useState('Chia sẻ chung')
  const [editingPost, setEditingPost] = useState(null)
  const [reportPostId, setReportPostId] = useState(null)
  const [deleteConfirmPost, setDeleteConfirmPost] = useState(null)
  const [deleteConfirmComment, setDeleteConfirmComment] = useState(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Lightbox
  const [lightboxImage, setLightboxImage] = useState(null)

  // Expanded comments by post id
  const [expandedComments, setExpandedComments] = useState({})

  // User stats
  const [myStats, setMyStats] = useState({ postsCount: 0, totalLikes: 0 })

  // Feedback notifications
  const [feedbackSuccess, setFeedbackSuccess] = useState('')
  const [feedbackError, setFeedbackError] = useState('')

  const searchInputRef = useRef(null)
  const firstName = user?.fullName
    ? user.fullName.trim().split(/\s+/).slice(-1)[0]
    : 'bạn'

  // Tự tắt thông báo sau 4 giây
  useEffect(() => {
    if (feedbackSuccess) {
      const timer = setTimeout(() => setFeedbackSuccess(''), 4000)
      return () => clearTimeout(timer)
    }
  }, [feedbackSuccess])

  useEffect(() => {
    if (feedbackError) {
      const timer = setTimeout(() => setFeedbackError(''), 4000)
      return () => clearTimeout(timer)
    }
  }, [feedbackError])

  // Đồng bộ chế độ hiển thị từ URL query parameter (?filter=mine hoặc ?authorId=...)
  useEffect(() => {
    const authorId = searchParams.get('authorId')
    const filter = searchParams.get('filter')

    if (authorId) {
      if (user?.id && String(authorId) === String(user.id)) {
        setFeedMode('mine')
        setViewedAuthor(null)
      } else {
        setFeedMode('author')
      }
    } else if (filter === 'mine') {
      setFeedMode('mine')
      setViewedAuthor(null)
    } else {
      setFeedMode('all')
      setViewedAuthor(null)
    }
  }, [searchParams, user?.id])

  // Lấy danh sách bài viết từ server
  useEffect(() => {
    let isActive = true
    setLoading(true)

    const params = new URLSearchParams()
    if (selectedTag && selectedTag !== 'Tất cả') {
      params.append('tag', selectedTag)
    }
    if (activeSearch) {
      params.append('search', activeSearch)
    }
    if (sortBy) {
      params.append('sortBy', sortBy)
    }

    if (feedMode === 'mine') {
      params.append('onlyMine', 'true')
    } else if (feedMode === 'author' && authorIdParam) {
      params.append('authorId', authorIdParam)
    }

    axiosInstance
      .get(`/community/posts?${params.toString()}`)
      .then(({ data }) => {
        if (!isActive) return
        setPosts(Array.isArray(data?.posts) ? data.posts : [])
        if (data?.myStats) {
          setMyStats(data.myStats)
        }
        if (data?.viewedAuthor) {
          setViewedAuthor(data.viewedAuthor)
        }
        if (Array.isArray(data?.topContributors)) {
          setTopContributors(data.topContributors)
        }
        if (data?.trendingRecipe !== undefined) {
          setTrendingRecipe(data.trendingRecipe)
        }
      })
      .catch((err) => {
        if (!isActive) return
        console.error('[CommunityPage] Lỗi tải bài viết:', err)
        setFeedbackError('Không thể tải bài viết, vui lòng thử lại sau')
      })
      .finally(() => {
        if (isActive) setLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [selectedTag, activeSearch, feedMode, authorIdParam, sortBy])

  // Tải riêng thống kê sidebar (/sidebar-stats) một lần khi mở trang
  useEffect(() => {
    let isActive = true
    axiosInstance
      .get('/community/sidebar-stats')
      .then(({ data }) => {
        if (!isActive) return
        if (Array.isArray(data?.topContributors)) {
          setTopContributors(data.topContributors)
        }
        if (data?.trendingRecipe !== undefined) {
          setTrendingRecipe(data.trendingRecipe)
        }
      })
      .catch((err) => {
        console.warn('[CommunityPage] Không thể tải sidebar stats:', err.message)
      })

    return () => {
      isActive = false
    }
  }, [])

  // Chuyển đổi giữa Bảng tin chung và Bài viết của tôi
  function handleSwitchFeedMode(mode) {
    setFeedMode(mode)
    setViewedAuthor(null)
    if (mode === 'mine') {
      setSearchParams({ filter: 'mine' }, { replace: true })
    } else {
      setSearchParams({}, { replace: true })
    }
  }

  // Xem bài viết của một tác giả cụ thể
  function handleViewAuthorPosts(targetAuthor) {
    if (!targetAuthor) return
    const authorId = targetAuthor._id || targetAuthor.id

    if (user?.id && String(authorId) === String(user.id)) {
      handleSwitchFeedMode('mine')
      return
    }

    setFeedMode('author')
    setViewedAuthor({
      id: authorId,
      fullName: targetAuthor.fullName || 'Thành viên',
      avatarUrl: targetAuthor.avatarUrl,
      role: targetAuthor.role,
    })
    setSearchParams({ authorId }, { replace: true })
  }

  // Thực thi tìm kiếm
  function handleExecuteSearch() {
    const trimmed = searchQuery.trim()
    if (trimmed.length > 100) {
      setFeedbackError('Từ khóa tìm kiếm không được vượt quá 100 ký tự')
      return
    }
    setActiveSearch(trimmed)
  }

  function handleClearSearch() {
    setSearchQuery('')
    setActiveSearch('')
  }

  function handleResetAllFilters() {
    setSelectedTag('Tất cả')
    setSearchQuery('')
    setActiveSearch('')
    setSortBy('latest')
    if (feedMode === 'author') {
      handleSwitchFeedMode('all')
    }
  }

  // Like / Unlike bài viết
  async function handleToggleLike(postId) {
    if (!user) {
      navigate('/login')
      return
    }

    // Optimistic UI update
    setPosts((prev) =>
      prev.map((p) => {
        if (p._id !== postId) return p
        const isLikedNow = !p.isLiked
        const currentLikes = p.likeCount ?? 0
        return {
          ...p,
          isLiked: isLikedNow,
          likeCount: isLikedNow ? currentLikes + 1 : Math.max(0, currentLikes - 1),
        }
      })
    )

    try {
      const { data } = await axiosInstance.post(`/community/posts/${postId}/like`)
      setPosts((prev) =>
        prev.map((p) => {
          if (p._id !== postId) return p
          return {
            ...p,
            isLiked: data.isLiked,
            likeCount: data.likeCount,
          }
        })
      )
    } catch (err) {
      console.error('[CommunityPage] Lỗi like bài:', err)
      // Revert if failed
      setPosts((prev) =>
        prev.map((p) => {
          if (p._id !== postId) return p
          const isLikedNow = !p.isLiked
          const currentLikes = p.likeCount ?? 0
          return {
            ...p,
            isLiked: isLikedNow,
            likeCount: isLikedNow ? currentLikes + 1 : Math.max(0, currentLikes - 1),
          }
        })
      )
      setFeedbackError(err.response?.data?.message || 'Không thể cập nhật trạng thái thích')
    }
  }

  function toggleComments(postId) {
    setExpandedComments((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }))
  }

  // Thêm bình luận
  async function handleAddComment(postId, content) {
    if (!user) {
      navigate('/login')
      return
    }

    try {
      const { data } = await axiosInstance.post(`/community/posts/${postId}/comments`, {
        content,
      })
      setPosts((prev) =>
        prev.map((p) => {
          if (p._id !== postId) return p
          return {
            ...p,
            comments: data.comments,
            commentCount: data.commentCount,
          }
        })
      )
      setFeedbackSuccess('Bình luận thành công')
    } catch (err) {
      console.error('[CommunityPage] Lỗi bình luận:', err)
      setFeedbackError(err.response?.data?.message || 'Không thể gửi bình luận, vui lòng thử lại')
      throw err
    }
  }

  // Sửa bình luận
  async function handleEditComment(postId, commentId, content) {
    try {
      const { data } = await axiosInstance.put(
        `/community/posts/${postId}/comments/${commentId}`,
        { content }
      )
      setPosts((prev) =>
        prev.map((p) => {
          if (p._id !== postId) return p
          return {
            ...p,
            comments: data.comments,
            commentCount: data.commentCount,
          }
        })
      )
      setFeedbackSuccess('Cập nhật bình luận thành công')
    } catch (err) {
      console.error('[CommunityPage] Lỗi sửa bình luận:', err)
      setFeedbackError(err.response?.data?.message || 'Không thể cập nhật bình luận')
      throw err
    }
  }

  // Xóa bình luận
  async function handleConfirmDeleteComment() {
    if (!deleteConfirmComment) return
    const { postId, commentId } = deleteConfirmComment

    setDeleteLoading(true)
    try {
      const { data } = await axiosInstance.delete(
        `/community/posts/${postId}/comments/${commentId}`
      )
      setPosts((prev) =>
        prev.map((p) => {
          if (p._id !== postId) return p
          return {
            ...p,
            comments: data.comments,
            commentCount: data.commentCount,
          }
        })
      )
      setFeedbackSuccess('Xóa bình luận thành công')
      setDeleteConfirmComment(null)
    } catch (err) {
      console.error('[CommunityPage] Lỗi xóa bình luận:', err)
      setFeedbackError(err.response?.data?.message || 'Không thể xóa bình luận')
    } finally {
      setDeleteLoading(false)
    }
  }

  // Xóa bài viết
  async function handleConfirmDeletePost() {
    if (!deleteConfirmPost) return
    setDeleteLoading(true)

    try {
      await axiosInstance.delete(`/community/posts/${deleteConfirmPost._id}`)
      setPosts((prev) => prev.filter((p) => p._id !== deleteConfirmPost._id))
      setMyStats((prev) => ({ ...prev, postsCount: Math.max(0, (prev?.postsCount || 1) - 1) }))
      setFeedbackSuccess('Đã xóa bài viết thành công')
      setDeleteConfirmPost(null)
    } catch (err) {
      console.error('[CommunityPage] Lỗi xóa bài:', err)
      const msg = err.response?.data?.message
      if (err.response?.status === 404) {
        setPosts((prev) => prev.filter((p) => p._id !== deleteConfirmPost._id))
        setDeleteConfirmPost(null)
      }
      setFeedbackError(msg || 'Không thể xóa bài viết, vui lòng thử lại')
    } finally {
      setDeleteLoading(false)
    }
  }

  function handleOpenCreateModal(tag = 'Chia sẻ chung') {
    if (!user) {
      navigate('/login')
      return
    }
    setCreateModalInitialTag(tag)
    setIsCreateModalOpen(true)
  }

  return (
    <div className="dashboard-shell community-shell">
      <UserHeader />

      {/* TOAST FEEDBACK FLOATING */}
      {feedbackSuccess && (
        <div className="community-toast community-toast--success">
          <i className="bi bi-check-circle-fill" />
          <span>{feedbackSuccess}</span>
        </div>
      )}
      {feedbackError && (
        <div className="community-toast community-toast--error">
          <i className="bi bi-exclamation-triangle-fill" />
          <span>{feedbackError}</span>
        </div>
      )}

      {/* THÂN TRANG CỘNG ĐỒNG - BỐ CỤC 3 CỘT */}
      <main className="community-main">
        <div className="community-container">
          {/* CỘT TRÁI: THÔNG TIN USER & BỘ LỌC CHỦ ĐỀ */}
          <aside className="community-col-left">
            <div className="community-card community-user-card">
              <div className="user-card-cover" />
              <div className="user-card-avatar-wrap">
                {user?.avatarUrl ? (
                  <img
                    src={resolveMediaUrl(user.avatarUrl)}
                    alt={user.fullName}
                    className="user-card-avatar"
                  />
                ) : (
                  <div className="user-card-avatar-fallback">
                    {firstName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <h3 className="user-card-name">{user?.fullName || 'Người dùng NutriLens'}</h3>
              <p className="user-card-email">{user?.email}</p>

              {/* THỐNG KÊ BÀI ĐĂNG CÁ NHÂN */}
              <div className="user-card-stats-row">
                <button
                  type="button"
                  className={`user-card-stat-item ${feedMode === 'mine' ? 'is-active' : ''}`}
                  onClick={() => handleSwitchFeedMode('mine')}
                  title="Nhấn để xem các bài viết do bạn đã đăng"
                >
                  <strong>{myStats.postsCount}</strong>
                  <span>Bài viết</span>
                </button>
                <div
                  className="user-card-stat-item"
                  title="Tổng số lượt tim bạn nhận được trên tất cả bài viết"
                >
                  <strong>{myStats.totalLikes}</strong>
                  <span>Lượt tim</span>
                </div>
              </div>

              <div className="user-card-divider" />

              <button
                type="button"
                className={`community-btn-my-posts full-width ${feedMode === 'mine' ? 'active' : ''}`}
                onClick={() => handleSwitchFeedMode(feedMode === 'mine' ? 'all' : 'mine')}
                title={feedMode === 'mine' ? 'Quay lại xem toàn bộ bảng tin' : 'Xem danh sách bài viết của cá nhân bạn'}
              >
                <i className={`bi ${feedMode === 'mine' ? 'bi-globe2' : 'bi-journal-richtext'}`} />
                <span>{feedMode === 'mine' ? 'Về Bảng tin chung' : 'Xem bài viết của tôi'}</span>
              </button>

              <button
                type="button"
                className="community-btn-primary full-width"
                onClick={() => handleOpenCreateModal()}
              >
                <i className="bi bi-pencil-square" /> Tạo bài viết mới
              </button>
            </div>

            {/* DANH MỤC / TAGS FILTER */}
            <div className="community-card community-tags-card">
              <h4 className="sidebar-card-title">
                <i className="bi bi-tags-fill" /> Chủ đề cộng đồng
              </h4>
              <ul className="community-tags-list">
                {COMMUNITY_TAGS.map((tag) => {
                  const tagMeta = TAG_COLOR_MAP[tag] || { icon: 'bi-tag', text: '#059669', bg: '#ecfdf5' }
                  const isCurrent = selectedTag === tag
                  return (
                    <li key={tag}>
                      <button
                        type="button"
                        className={`community-tag-btn ${isCurrent ? 'active' : ''}`}
                        onClick={() => setSelectedTag(tag)}
                      >
                        <i className={`bi ${tagMeta.icon}`} />
                        <span>{tag}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>

            {/* QUY TẮC CỘNG ĐỒNG */}
            <div className="community-card community-rules-card">
              <h4 className="sidebar-card-title">
                <i className="bi bi-shield-check" /> Tiêu chuẩn cộng đồng
              </h4>
              <ul className="rules-list">
                <li>
                  <i className="bi bi-check2-circle" /> Chia sẻ thực đơn và công thức calo minh bạch.
                </li>
                <li>
                  <i className="bi bi-check2-circle" /> Giữ thái độ văn minh, tích cực, hỗ trợ đồng hành.
                </li>
                <li>
                  <i className="bi bi-check2-circle" /> Không quảng cáo hoặc đăng nội dung sai lệch sức khỏe.
                </li>
              </ul>
            </div>
          </aside>

          {/* CỘT GIỮA: FEED BÀI VIẾT */}
          <section className="community-col-feed">
            {/* THANH TÌM KIẾM */}
            <form
              className="community-feed-search"
              onSubmit={(e) => {
                e.preventDefault()
                handleExecuteSearch()
              }}
            >
              <button
                type="submit"
                className="search-submit-icon-btn"
                title="Bấm để tìm kiếm (hoặc nhấn Enter)"
                aria-label="Tìm kiếm"
              >
                <i className="bi bi-search" />
              </button>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Tìm kiếm bài viết, công thức trong cộng đồng..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="clear-search-btn"
                  onClick={handleClearSearch}
                  title="Xóa tìm kiếm"
                >
                  <i className="bi bi-x-circle-fill" />
                </button>
              )}
            </form>

            {/* TABS CHUYỂN ĐỔI FEED & SẮP XẾP */}
            <div className="community-feed-tabs-card">
              <div className="community-feed-tabs">
                <button
                  type="button"
                  className={`feed-tab-btn ${feedMode === 'all' ? 'active' : ''}`}
                  onClick={() => handleSwitchFeedMode('all')}
                >
                  <i className="bi bi-globe2" />
                  <span>Bảng tin chung</span>
                </button>
                <button
                  type="button"
                  className={`feed-tab-btn ${feedMode === 'mine' ? 'active' : ''}`}
                  onClick={() => handleSwitchFeedMode('mine')}
                >
                  <i className="bi bi-person-badge-fill" />
                  <span>Bài viết của tôi</span>
                  {myStats.postsCount > 0 && (
                    <span className="feed-tab-badge">{myStats.postsCount}</span>
                  )}
                </button>
                {feedMode === 'author' && viewedAuthor && (
                  <button
                    type="button"
                    className="feed-tab-btn active"
                    title={`Đang xem bài viết của ${viewedAuthor.fullName}`}
                  >
                    <i className="bi bi-person-lines-fill" />
                    <span>Bài viết của {viewedAuthor.fullName}</span>
                    <span className="feed-tab-badge">{posts.length}</span>
                  </button>
                )}
              </div>

              <div className="feed-sort-wrap" title="Sắp xếp bài viết">
                <button
                  type="button"
                  className={`feed-sort-btn ${sortBy === 'latest' ? 'active' : ''}`}
                  onClick={() => setSortBy('latest')}
                  title="Hiển thị bài viết mới đăng gần đây nhất"
                >
                  <i className="bi bi-clock-history" />
                  <span>Mới nhất</span>
                </button>
                <button
                  type="button"
                  className={`feed-sort-btn ${sortBy === 'popular' ? 'active' : ''}`}
                  onClick={() => setSortBy('popular')}
                  title="Hiển thị bài viết thịnh hành / nhiều tương tác tim nhất"
                >
                  <i className="bi bi-fire" />
                  <span>Thịnh hành</span>
                </button>
              </div>
            </div>

            {/* BANNER THÔNG TIN KHI ĐANG XEM BÀI CÁ NHÂN */}
            {feedMode === 'mine' && (
              <div className="my-posts-spotlight-card">
                <div className="my-posts-spotlight-left">
                  <div className="my-posts-spotlight-avatar">
                    {user?.avatarUrl ? (
                      <img src={resolveMediaUrl(user.avatarUrl)} alt={user.fullName} />
                    ) : (
                      firstName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h4>Bài viết cá nhân của bạn</h4>
                    <p>
                      Bạn đã đăng <strong>{myStats.postsCount} bài viết</strong> và nhận được{' '}
                      <strong>{myStats.totalLikes} lượt tim</strong> từ cộng đồng NutriLens.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="my-posts-return-btn"
                  onClick={() => handleSwitchFeedMode('all')}
                  title="Quay lại xem tất cả bài viết trên bảng tin chung"
                >
                  <i className="bi bi-arrow-left" /> Bảng tin chung
                </button>
              </div>
            )}

            {/* BANNER THÔNG TIN KHI ĐANG XEM BÀI CỦA THÀNH VIÊN KHÁC */}
            {feedMode === 'author' && viewedAuthor && (
              <div className="author-profile-spotlight-card">
                <div className="author-spotlight-left">
                  <div className="author-spotlight-avatar">
                    {viewedAuthor.avatarUrl ? (
                      <img
                        src={resolveMediaUrl(viewedAuthor.avatarUrl)}
                        alt={viewedAuthor.fullName}
                      />
                    ) : (
                      (viewedAuthor.fullName || 'U').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="author-spotlight-info">
                    <div className="author-spotlight-name-row">
                      <h3>{viewedAuthor.fullName}</h3>
                      {viewedAuthor.role === 'admin' && (
                        <span className="author-badge-admin" title="Quản trị viên">
                          <i className="bi bi-patch-check-fill" /> Admin
                        </span>
                      )}
                    </div>
                    <p className="author-spotlight-stats">
                      <span>
                        <i className="bi bi-journal-text" /> <strong>{viewedAuthor.postsCount ?? posts.length}</strong> bài viết
                      </span>
                      <span>
                        <i className="bi bi-heart-fill" style={{ color: '#ef4444' }} /> <strong>{viewedAuthor.totalLikes ?? 0}</strong> tim
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="my-posts-return-btn"
                  onClick={() => handleSwitchFeedMode('all')}
                  title="Quay lại xem tất cả bài viết trên bảng tin chung"
                >
                  <i className="bi bi-arrow-left" /> Bảng tin chung
                </button>
              </div>
            )}

            {/* KHUNG TẠO BÀI VIẾT NHANH */}
            <div className="community-card create-post-trigger-box">
              <div className="create-post-top">
                {user?.avatarUrl ? (
                  <img
                    src={resolveMediaUrl(user.avatarUrl)}
                    alt={user.fullName}
                    className="avatar-sm"
                  />
                ) : (
                  <div className="avatar-sm-fallback">
                    {firstName.charAt(0).toUpperCase()}
                  </div>
                )}
                <button
                  type="button"
                  className="create-post-fake-input"
                  onClick={() => handleOpenCreateModal()}
                >
                  {firstName} ơi, bạn đang nghĩ gì thế? Chia sẻ công thức hoặc kinh nghiệm hôm nay nhé...
                </button>
              </div>

              <div className="create-post-actions-row">
                <button
                  type="button"
                  className="post-action-btn action-photo"
                  onClick={() => handleOpenCreateModal()}
                >
                  <i className="bi bi-image" />
                  <span>Ảnh / Minh họa</span>
                </button>

                <button
                  type="button"
                  className="post-action-btn action-recipe"
                  onClick={() => handleOpenCreateModal('Công thức món ăn')}
                >
                  <i className="bi bi-egg-fried" />
                  <span>Công thức món</span>
                </button>

                <button
                  type="button"
                  className="post-action-btn action-workout"
                  onClick={() => handleOpenCreateModal('Quá trình tập luyện')}
                >
                  <i className="bi bi-lightning-charge" />
                  <span>Tập luyện</span>
                </button>
              </div>
            </div>

            {/* BANNER ĐIỀU KIỆN LỌC ĐANG ÁP DỤNG */}
            {(selectedTag !== 'Tất cả' || activeSearch || (feedMode === 'author' && viewedAuthor)) && (
              <div className="active-filter-banner">
                <div className="filter-chips-wrap">
                  <span className="filter-lead">
                    <i className="bi bi-funnel-fill" /> Đang lọc:
                  </span>
                  {feedMode === 'author' && viewedAuthor && (
                    <span className="filter-pill">
                      Tác giả: <strong>{viewedAuthor.fullName}</strong>
                      <button
                        type="button"
                        onClick={() => handleSwitchFeedMode('all')}
                        title="Bỏ lọc theo tác giả này"
                      >
                        <i className="bi bi-x-lg" />
                      </button>
                    </span>
                  )}
                  {selectedTag !== 'Tất cả' && (
                    <span className="filter-pill">
                      Chủ đề: <strong>{selectedTag}</strong>
                      <button
                        type="button"
                        onClick={() => setSelectedTag('Tất cả')}
                        title="Bỏ lọc chủ đề này"
                      >
                        <i className="bi bi-x-lg" />
                      </button>
                    </span>
                  )}
                  {activeSearch && (
                    <span className="filter-pill">
                      Từ khóa: <strong>"{activeSearch}"</strong>
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        title="Bỏ tìm kiếm từ khóa này"
                      >
                        <i className="bi bi-x-lg" />
                      </button>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="filter-reset-all-btn"
                  onClick={handleResetAllFilters}
                  title="Xóa tất cả điều kiện lọc và tìm kiếm"
                >
                  <i className="bi bi-arrow-counterclockwise" /> Xóa tất cả lọc
                </button>
              </div>
            )}

            {/* DANH SÁCH BÀI VIẾT FEED */}
            {loading ? (
              <div className="community-card loading-state-card">
                <div className="feed-skeleton-header">
                  <div className="skeleton-avatar" />
                  <div className="skeleton-lines">
                    <div className="skeleton-line" style={{ width: '40%' }} />
                    <div className="skeleton-line" style={{ width: '25%' }} />
                  </div>
                </div>
                <div className="skeleton-line" style={{ width: '90%', margin: '14px 0' }} />
                <div className="skeleton-line" style={{ width: '75%', marginBottom: '14px' }} />
                <div className="skeleton-block" />
              </div>
            ) : posts.length === 0 ? (
              <div className="community-card empty-feed-card">
                {activeSearch || selectedTag !== 'Tất cả' ? (
                  <>
                    <div className="empty-feed-icon-badge muted">
                      <i className="bi bi-search" />
                    </div>
                    <h3>Không tìm thấy kết quả phù hợp</h3>
                    <p>
                      Không tìm thấy bài đăng nào phù hợp với {activeSearch ? `từ khóa "${activeSearch}"` : ''}{activeSearch && selectedTag !== 'Tất cả' ? ' thuộc ' : ''}{selectedTag !== 'Tất cả' ? `chủ đề "${selectedTag}"` : ''}. Vui lòng thử từ khóa khác hoặc xóa điều kiện lọc để xem thêm bài đăng.
                    </p>
                    <div className="empty-actions-wrap">
                      <button
                        type="button"
                        className="empty-btn-secondary"
                        onClick={handleResetAllFilters}
                      >
                        <i className="bi bi-arrow-counterclockwise" /> Xóa bộ lọc &amp; Tải lại
                      </button>
                      <button
                        type="button"
                        className="empty-btn-primary"
                        onClick={() => handleOpenCreateModal(selectedTag !== 'Tất cả' ? selectedTag : 'Chia sẻ chung')}
                      >
                        <i className="bi bi-pencil-square" /> Tạo bài viết mới
                      </button>
                    </div>
                  </>
                ) : feedMode === 'author' && viewedAuthor ? (
                  <>
                    <div className="empty-feed-icon-badge muted">
                      <i className="bi bi-person-x" />
                    </div>
                    <h3>{viewedAuthor.fullName || 'Thành viên'} chưa có bài viết nào</h3>
                    <p>
                      Thành viên này hiện chưa đăng tải bài viết hoặc công thức nào lên cộng đồng NutriLens.
                    </p>
                    <div className="empty-actions-wrap">
                      <button
                        type="button"
                        className="empty-btn-primary"
                        onClick={() => handleSwitchFeedMode('all')}
                      >
                        <i className="bi bi-compass" /> Quay lại Bảng tin chung
                      </button>
                    </div>
                  </>
                ) : feedMode === 'mine' ? (
                  <>
                    <div className="empty-feed-icon-badge success">
                      <i className="bi bi-journal-plus" />
                    </div>
                    <h3>Bạn chưa đăng bài viết nào</h3>
                    <p>
                      Hãy chia sẻ công thức ăn uống lành mạnh, thực đơn calo hoặc hành trình tập luyện đầu tiên của bạn với cộng đồng!
                    </p>
                    <div className="empty-actions-wrap">
                      <button
                        type="button"
                        className="empty-btn-primary"
                        onClick={() => handleOpenCreateModal('Chia sẻ chung')}
                      >
                        <i className="bi bi-pencil-square" /> Tạo bài viết đầu tiên ngay
                      </button>
                      <button
                        type="button"
                        className="empty-btn-secondary"
                        onClick={() => handleSwitchFeedMode('all')}
                      >
                        <i className="bi bi-compass" /> Khám phá bảng tin chung
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="empty-feed-icon-badge success">
                      <i className="bi bi-chat-heart" />
                    </div>
                    <h3>Chưa có bài viết nào</h3>
                    <p>
                      Hãy là người đầu tiên chia sẻ công thức món ăn hoặc kinh nghiệm dinh dưỡng hôm nay!
                    </p>
                    <div className="empty-actions-wrap">
                      <button
                        type="button"
                        className="empty-btn-primary"
                        onClick={() => handleOpenCreateModal('Chia sẻ chung')}
                      >
                        <i className="bi bi-pencil-square" /> Đăng bài ngay
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="community-posts-list">
                {posts.map((post) => (
                  <PostCard
                    key={post._id}
                    post={post}
                    user={user}
                    feedMode={feedMode}
                    isCommentsOpen={Boolean(expandedComments[post._id])}
                    onToggleLike={handleToggleLike}
                    onToggleComments={toggleComments}
                    onOpenEditModal={(p) => setEditingPost(p)}
                    onPromptDeletePost={(p) => setDeleteConfirmPost(p)}
                    onOpenReportModal={(id) => setReportPostId(id)}
                    onViewAuthor={handleViewAuthorPosts}
                    onSelectTag={(tag) => setSelectedTag(tag)}
                    onSetLightboxImage={(url) => setLightboxImage(url)}
                    onAddComment={handleAddComment}
                    onEditComment={handleEditComment}
                    onRequestDeleteComment={(pId, c) =>
                      setDeleteConfirmComment({ postId: pId, commentId: c._id })
                    }
                  />
                ))}
              </div>
            )}
          </section>

          {/* CỘT PHẢI: HASHTAGS & TOP CONTRIBUTORS */}
          <CommunitySidebar
            topContributors={topContributors}
            trendingRecipe={trendingRecipe}
            onSelectTag={(tag) => setSelectedTag(tag)}
            onViewAuthor={handleViewAuthorPosts}
          />
        </div>
      </main>

      {/* MODAL TẠO BÀI VIẾT (UC26) */}
      <CreatePostModal
        isOpen={isCreateModalOpen}
        user={user}
        initialTag={createModalInitialTag}
        onClose={() => setIsCreateModalOpen(false)}
        onPostCreated={(newPost, msg) => {
          setPosts((prev) => [newPost, ...prev])
          setMyStats((prev) => ({ ...prev, postsCount: (prev?.postsCount || 0) + 1 }))
          setFeedbackSuccess(msg)
        }}
        onError={(err) => setFeedbackError(err)}
      />

      {/* MODAL CHỈNH SỬA BÀI VIẾT */}
      {editingPost && (
        <EditPostModal
          post={editingPost}
          user={user}
          onClose={() => setEditingPost(null)}
          onPostUpdated={(updatedPost, msg) => {
            setPosts((prev) =>
              prev.map((p) => (p._id === updatedPost._id ? updatedPost : p))
            )
            setFeedbackSuccess(msg)
          }}
          onError={(err) => setFeedbackError(err)}
        />
      )}

      {/* MODAL BÁO CÁO VI PHẠM (UC30) */}
      {reportPostId && (
        <ReportPostModal
          postId={reportPostId}
          onClose={() => setReportPostId(null)}
          onSuccess={(pId, msg) => {
            setPosts((prev) =>
              prev.map((p) => (p._id === pId ? { ...p, isReported: true } : p))
            )
            if (msg) setFeedbackSuccess(msg)
          }}
          onError={(err) => setFeedbackError(err)}
        />
      )}

      {/* MODAL XÁC NHẬN XÓA BÀI VIẾT */}
      <DeleteConfirmModal
        isOpen={Boolean(deleteConfirmPost)}
        title="Xóa bài viết"
        message="Bạn có chắc chắn muốn xóa bài viết này không? Bài viết và toàn bộ bình luận liên quan sẽ bị xóa vĩnh viễn khỏi cộng đồng."
        confirmText="Xóa bài viết"
        isLoading={deleteLoading}
        onConfirm={handleConfirmDeletePost}
        onClose={() => setDeleteConfirmPost(null)}
      />

      {/* MODAL XÁC NHẬN XÓA BÌNH LUẬN */}
      <DeleteConfirmModal
        isOpen={Boolean(deleteConfirmComment)}
        title="Xóa bình luận"
        message="Bạn có chắc chắn muốn xóa bình luận này không? Hành động này không thể hoàn tác."
        confirmText="Xóa bình luận"
        isLoading={deleteLoading}
        onConfirm={handleConfirmDeleteComment}
        onClose={() => setDeleteConfirmComment(null)}
      />

      {/* LIGHTBOX PHÓNG TO ẢNH */}
      {lightboxImage && (
        <div className="lightbox-backdrop" onClick={() => setLightboxImage(null)}>
          <div className="lightbox-content">
            <button
              type="button"
              className="lightbox-close-btn"
              onClick={() => setLightboxImage(null)}
            >
              <i className="bi bi-x-lg" />
            </button>
            <img src={lightboxImage} alt="Hình ảnh đầy đủ" />
          </div>
        </div>
      )}

      <UserFooter />
    </div>
  )
}
