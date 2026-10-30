import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import axiosInstance from '../../api/axiosInstance'
import FoodNavMenu from '../../components/common/FoodNavMenu'
import ExerciseNavMenu from '../../components/common/ExerciseNavMenu'
import UserNavMenu from '../../components/common/UserNavMenu'

const COMMUNITY_TAGS = [
  'Tất cả',
  'Công thức món ăn',
  'Kinh nghiệm dinh dưỡng',
  'Quá trình tập luyện',
  'Mẹo sức khỏe',
  'Hỏi đáp cộng đồng',
  'Chia sẻ chung',
]

const TAG_COLOR_MAP = {
  'Công thức món ăn': { bg: '#e0f2fe', text: '#0284c7', icon: 'bi-egg-fried' },
  'Kinh nghiệm dinh dưỡng': { bg: '#ecfdf5', text: '#059669', icon: 'bi-journal-check' },
  'Quá trình tập luyện': { bg: '#fef3c7', text: '#d97706', icon: 'bi-lightning-charge' },
  'Mẹo sức khỏe': { bg: '#f3e8ff', text: '#9333ea', icon: 'bi-heart-pulse' },
  'Hỏi đáp cộng đồng': { bg: '#ffedd5', text: '#ea580c', icon: 'bi-question-circle' },
  'Chia sẻ chung': { bg: '#f1f5f9', text: '#475569', icon: 'bi-chat-quote' },
}

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

function resolveMediaUrl(value) {
  const url = String(value || '').trim()
  if (!url) return null
  if (/^(https?:|data:|blob:)/i.test(url)) return url
  const apiOrigin = String(axiosInstance.defaults.baseURL || '').replace(/\/api\/?$/, '')
  if (!apiOrigin) return url
  return url.startsWith('/') ? `${apiOrigin}${url}` : `${apiOrigin}/${url}`
}

function formatRelativeTime(dateInput) {
  if (!dateInput) return 'Vừa xong'
  const date = new Date(dateInput)
  if (Number.isNaN(date.getTime())) return 'Vừa xong'
  const now = new Date()
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffSec < 60) return 'Vừa xong'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} phút trước`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} giờ trước`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay} ngày trước`

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function CommunityPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // State danh sách bài viết & filter
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTag, setSelectedTag] = useState('Tất cả')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeSearch, setActiveSearch] = useState('')

  // State Modal Đăng bài (UC26)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [postContent, setPostContent] = useState('')
  const [postTag, setPostTag] = useState('Chia sẻ chung')
  const [selectedImageFile, setSelectedImageFile] = useState(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)

  // Thông báo phản hồi UI (Thành công / Ngoại lệ)
  const [feedbackError, setFeedbackError] = useState('')
  const [feedbackSuccess, setFeedbackSuccess] = useState('')

  // State cho bình luận đang mở rộng theo post ID
  const [expandedComments, setExpandedComments] = useState({})
  const [commentInputs, setCommentInputs] = useState({})
  const [commentSubmitting, setCommentSubmitting] = useState({})

  // State UC27: Chỉnh sửa và Xóa bình luận
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editingCommentText, setEditingCommentText] = useState('')
  const [editingCommentSubmitting, setEditingCommentSubmitting] = useState(false)
  const [deleteConfirmComment, setDeleteConfirmComment] = useState(null)
  const [deleteCommentSubmitting, setDeleteCommentSubmitting] = useState(false)

  // Lightbox xem ảnh lớn
  const [lightboxImage, setLightboxImage] = useState(null)

  // Ref input file
  const fileInputRef = useRef(null)

  const firstName = user?.fullName
    ? user.fullName.trim().split(/\s+/).slice(-1)[0]
    : 'bạn'

  // Tải danh sách bài viết khi filter tag hoặc search thay đổi
  useEffect(() => {
    let isActive = true
    setLoading(true)

    const params = {}
    if (selectedTag && selectedTag !== 'Tất cả') {
      params.tag = selectedTag
    }
    if (activeSearch) {
      params.search = activeSearch
    }

    axiosInstance
      .get('/community/posts', { params })
      .then(({ data }) => {
        if (!isActive) return
        setPosts(Array.isArray(data?.posts) ? data.posts : [])
      })
      .catch((err) => {
        console.error('[CommunityPage] Không thể tải bài viết:', err)
      })
      .finally(() => {
        if (isActive) setLoading(false)
      })

    return () => {
      isActive = false
    }
  }, [selectedTag, activeSearch])

  // Tự động ẩn thông báo sau 4 giây
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

  // --- XỬ LÝ ĐĂNG BÀI VIẾT (UC26) ---

  // Luồng chính 1: Mở biểu mẫu đăng bài
  function handleOpenCreateModal(defaultTag = 'Chia sẻ chung') {
    setPostContent('')
    setPostTag(defaultTag)
    setSelectedImageFile(null)
    setImagePreviewUrl('')
    setFeedbackError('')
    setIsModalOpen(true)
  }

  // Luồng thay thế 3a & 4a: Người dùng hủy thao tác đăng bài
  function handleCancelCreatePost() {
    setIsModalOpen(false)
    setPostContent('')
    setSelectedImageFile(null)
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl)
      setImagePreviewUrl('')
    }
    setFeedbackError('')
  }

  // Luồng 4 & Ngoại lệ 4b: Đính kèm hình ảnh và kiểm tra tính hợp lệ
  function validateAndSetImage(file) {
    if (!file) return

    const fileType = (file.type || '').toLowerCase()
    const fileName = (file.name || '').toLowerCase()
    const hasValidMime = ALLOWED_IMAGE_TYPES.includes(fileType) || fileType.startsWith('image/')
    const hasValidExt = /\.(jpe?g|png|webp|gif|jfif|bmp)$/i.test(fileName)

    // Ngoại lệ 4b: Hình ảnh không đúng định dạng hoặc vượt quá 5MB
    if (!hasValidMime && !hasValidExt) {
      setFeedbackError('Hình ảnh không hợp lệ. Vui lòng chọn ảnh có định dạng JPG, PNG, WEBP hoặc GIF.')
      return
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setFeedbackError('Hình ảnh không hợp lệ. Dung lượng ảnh không được vượt quá 5MB.')
      return
    }

    setFeedbackError('')
    setSelectedImageFile(file)
    const preview = URL.createObjectURL(file)
    setImagePreviewUrl(preview)
  }

  function handleFileSelected(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    validateAndSetImage(file)
  }

  function handleFileDrop(event) {
    event.preventDefault()
    const file = event.dataTransfer?.files?.[0]
    validateAndSetImage(file)
  }

  // Luồng thay thế 4b: Gỡ ảnh đính kèm (chỉ đăng bài văn bản)
  function handleRemoveImage() {
    setSelectedImageFile(null)
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl)
      setImagePreviewUrl('')
    }
  }

  // Luồng chính 6 - 10: Submit form đăng bài
  async function handleSubmitPost(e) {
    if (e) e.preventDefault()
    setFeedbackError('')

    // Ngoại lệ 3a: Nội dung để trống
    const trimmedContent = postContent.trim()
    if (!trimmedContent) {
      setFeedbackError('Nội dung bài viết không được để trống')
      return
    }

    // Luồng thay thế 5c: Áp dụng Tag mặc định nếu chưa chọn
    const resolvedTag = postTag || 'Chia sẻ chung'

    setSubmitLoading(true)

    try {
      const formData = new FormData()
      formData.append('content', trimmedContent)
      formData.append('tag', resolvedTag)
      if (selectedImageFile) {
        formData.append('image', selectedImageFile)
      }

      const { data } = await axiosInstance.post('/community/posts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      // Bước 10: Thông báo "Đăng bài thành công"
      setFeedbackSuccess(data.message || 'Đăng bài thành công')

      // Cập nhật ngay bài viết mới vào đầu danh sách Feed
      if (data.post) {
        setPosts((prev) => [data.post, ...prev])
      }

      // Đóng modal và dọn dẹp
      setIsModalOpen(false)
      setPostContent('')
      setSelectedImageFile(null)
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl)
        setImagePreviewUrl('')
      }
    } catch (err) {
      console.error('[CommunityPage] Lỗi đăng bài:', err)
      const errorMsg =
        err.response?.data?.message || 'Không thể đăng bài, vui lòng thử lại'
      setFeedbackError(errorMsg)
    } finally {
      setSubmitLoading(false)
    }
  }

  // --- TƯƠNG TÁC LIKE BÀI VIẾT ---
  async function handleToggleLike(postId) {
    try {
      const { data } = await axiosInstance.post(`/community/posts/${postId}/like`)
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId
            ? { ...p, isLiked: data.isLiked, likeCount: data.likeCount }
            : p
        )
      )
    } catch (err) {
      console.error('[CommunityPage] Lỗi like bài viết:', err)
    }
  }

  // --- UC27: TƯƠNG TÁC BÌNH LUẬN ---
  function toggleComments(postId) {
    setExpandedComments((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }))
  }

  function handleCommentInputChange(postId, text) {
    setCommentInputs((prev) => ({ ...prev, [postId]: text }))
  }

  // Luồng chính 3 - 8 & Ngoại lệ 3a, 3b, 6c: Gửi bình luận
  async function handleSubmitComment(postId) {
    const text = (commentInputs[postId] || '').trim()

    // Ngoại lệ 3a / 4a: Người dùng để trống nội dung bình luận và bấm "Gửi"
    if (!text) {
      setFeedbackError('Nội dung bình luận không được để trống')
      return
    }

    setCommentSubmitting((prev) => ({ ...prev, [postId]: true }))
    setFeedbackError('')

    try {
      const { data } = await axiosInstance.post(`/community/posts/${postId}/comments`, {
        content: text,
      })

      // Bước 6 & 7: Cập nhật danh sách bình luận bên dưới bài đăng
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId
            ? {
                ...p,
                comments: data.comments,
                commentCount: data.commentCount,
              }
            : p
        )
      )
      setCommentInputs((prev) => ({ ...prev, [postId]: '' }))
      setFeedbackSuccess('Bình luận thành công')
    } catch (err) {
      console.error('[CommunityPage] Lỗi gửi bình luận:', err)
      const errorMsg =
        err.response?.data?.message || 'Không thể gửi bình luận, vui lòng thử lại'
      setFeedbackError(errorMsg)
    } finally {
      setCommentSubmitting((prev) => ({ ...prev, [postId]: false }))
    }
  }

  // Luồng thay thế 3a & 4a: Bắt đầu chỉnh sửa bình luận
  function handleStartEditComment(comment) {
    setEditingCommentId(comment._id)
    setEditingCommentText(comment.content)
    setFeedbackError('')
  }

  // Hủy chỉnh sửa bình luận
  function handleCancelEditComment() {
    setEditingCommentId(null)
    setEditingCommentText('')
  }

  // Luồng thay thế 5a - 8a: Cập nhật bình luận đã chỉnh sửa
  async function handleSaveEditComment(postId, commentId) {
    const trimmed = editingCommentText.trim()

    // Ngoại lệ 3a / 4a: Để trống nội dung khi sửa
    if (!trimmed) {
      setFeedbackError('Nội dung bình luận không được để trống')
      return
    }

    setEditingCommentSubmitting(true)
    setFeedbackError('')

    try {
      const { data } = await axiosInstance.put(
        `/community/posts/${postId}/comments/${commentId}`,
        { content: trimmed }
      )

      // Cập nhật bình luận trong bài đăng
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId
            ? {
                ...p,
                comments: data.comments,
                commentCount: data.commentCount,
              }
            : p
        )
      )

      setEditingCommentId(null)
      setEditingCommentText('')
      // Bước 7a: "Cập nhật bình luận thành công"
      setFeedbackSuccess(data.message || 'Cập nhật bình luận thành công')
    } catch (err) {
      console.error('[CommunityPage] Lỗi cập nhật bình luận:', err)
      const errorMsg =
        err.response?.data?.message || 'Không thể cập nhật bình luận, vui lòng thử lại'
      setFeedbackError(errorMsg)
    } finally {
      setEditingCommentSubmitting(false)
    }
  }

  // Luồng thay thế 3b & 4b: Mở hộp thoại xác nhận xóa bình luận
  function handlePromptDeleteComment(postId, comment) {
    setDeleteConfirmComment({
      postId,
      commentId: comment._id,
      content: comment.content,
    })
  }

  // Hủy xóa bình luận
  function handleCancelDeleteComment() {
    setDeleteConfirmComment(null)
  }

  // Luồng thay thế 5b - 8b: Xác nhận xóa bình luận khỏi bài đăng
  async function handleConfirmDeleteComment() {
    if (!deleteConfirmComment) return

    const { postId, commentId } = deleteConfirmComment
    setDeleteCommentSubmitting(true)
    setFeedbackError('')

    try {
      const { data } = await axiosInstance.delete(
        `/community/posts/${postId}/comments/${commentId}`
      )

      // Cập nhật danh sách bình luận sau khi xóa
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId
            ? {
                ...p,
                comments: data.comments,
                commentCount: data.commentCount,
              }
            : p
        )
      )

      setDeleteConfirmComment(null)
      // Bước 7b: "Xóa bình luận thành công"
      setFeedbackSuccess(data.message || 'Xóa bình luận thành công')
    } catch (err) {
      console.error('[CommunityPage] Lỗi xóa bình luận:', err)
      const errorMsg =
        err.response?.data?.message || 'Không thể xóa bình luận, vui lòng thử lại'
      setFeedbackError(errorMsg)
    } finally {
      setDeleteCommentSubmitting(false)
    }
  }

  // --- XÓA BÀI VIẾT ---
  async function handleDeletePost(postId) {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bài viết này không?')) return

    try {
      await axiosInstance.delete(`/community/posts/${postId}`)
      setPosts((prev) => prev.filter((p) => p._id !== postId))
      setFeedbackSuccess('Đã xóa bài viết thành công')
    } catch (err) {
      console.error('[CommunityPage] Lỗi xóa bài:', err)
      setFeedbackError(err.response?.data?.message || 'Không thể xóa bài viết')
    }
  }

  // --- SAO CHÉP LIÊN KẾT BÀI VIẾT ---
  function handleSharePost(postId) {
    const shareUrl = `${window.location.origin}/community#post-${postId}`
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl)
      setFeedbackSuccess('Đã sao chép liên kết bài viết vào bộ nhớ tạm')
    } else {
      setFeedbackSuccess('Bài viết ID: ' + postId)
    }
  }

  return (
    <div className="dashboard-shell community-shell">
      {/* HEADER NUTRILENS TIÊU CHUẨN */}
      <header className="dashboard-header">
        <Link className="dashboard-logo" to="/dashboard">
          <span><i className="bi bi-leaf-fill" /></span> NutriLens
        </Link>
        <nav className="dashboard-nav" aria-label="Điều hướng chính">
          <Link to="/dashboard">Tổng quan</Link>
          <FoodNavMenu />
          <ExerciseNavMenu />
          <Link to="/weight-tracker">Tiến trình &amp; Cân nặng</Link>
          <Link className="active" to="/community">Cộng đồng</Link>
          <Link to="/articles">Bài viết &amp; Mẹo</Link>
        </nav>
        <div className="dashboard-actions">
          <div className="community-header-search">
            <i className="bi bi-search" />
            <input
              type="text"
              placeholder="Tìm kiếm bài viết, công thức..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setActiveSearch(searchQuery.trim())
                }
              }}
            />
            {activeSearch && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => {
                  setSearchQuery('')
                  setActiveSearch('')
                }}
                title="Xóa tìm kiếm"
              >
                <i className="bi bi-x-circle-fill" />
              </button>
            )}
          </div>
          <button
            type="button"
            className="community-post-btn-quick"
            onClick={() => handleOpenCreateModal()}
            title="Đăng bài viết mới"
          >
            <i className="bi bi-plus-lg" /> Đăng bài
          </button>
          <UserNavMenu />
        </div>
      </header>

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

      {/* THÂN TRANG CỘNG ĐỒNG - BỐ CỤC 3 CỘT FACEBOOK-STYLE */}
      <main className="community-main">
        <div className="community-container">
          {/* CỘT TRÁI: THÔNG TIN USER & CHỦ ĐỀ TAG */}
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
              <div className="user-card-divider" />
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

          {/* CỘT GIỮA: FEED BÀI VIẾT FACEBOOK-STYLE */}
          <section className="community-col-feed">
            {/* KHUNG TẠO BÀI VIẾT NHANH (CREATE POST BOX - FB STYLE) */}
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
                  onClick={() => {
                    handleOpenCreateModal()
                    setTimeout(() => fileInputRef.current?.click(), 250)
                  }}
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

            {/* BỘ LỌC ĐANG CHỌN (NẾU CÓ) */}
            {selectedTag !== 'Tất cả' && (
              <div className="active-tag-banner">
                <span>
                  Đang xem chủ đề: <strong>{selectedTag}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedTag('Tất cả')}
                  title="Bỏ lọc chủ đề"
                >
                  Xóa lọc <i className="bi bi-x-lg" />
                </button>
              </div>
            )}

            {/* DANH SÁCH BÀI VIẾT (POST FEED) */}
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
                <i className="bi bi-chat-heart" />
                <h3>Chưa có bài viết nào</h3>
                <p>
                  {selectedTag !== 'Tất cả'
                    ? `Chưa có bài viết nào trong chủ đề "${selectedTag}". Hãy là người đầu tiên chia sẻ nhé!`
                    : 'Hãy là người đầu tiên chia sẻ công thức món ăn hoặc kinh nghiệm dinh dưỡng hôm nay!'}
                </p>
                <button
                  type="button"
                  className="community-btn-primary"
                  onClick={() => handleOpenCreateModal(selectedTag !== 'Tất cả' ? selectedTag : 'Chia sẻ chung')}
                >
                  <i className="bi bi-pencil-square" /> Đăng bài ngay
                </button>
              </div>
            ) : (
              <div className="community-posts-list">
                {posts.map((post) => {
                  const tagMeta = TAG_COLOR_MAP[post.tag] || {
                    icon: 'bi-tag',
                    text: '#059669',
                    bg: '#ecfdf5',
                  }
                  const author = post.authorId || {}
                  const isAuthor = user?.id && String(author._id) === String(user.id)
                  const isAdmin = user?.role === 'admin'
                  const authorAvatar = resolveMediaUrl(author.avatarUrl)
                  const authorInitial = (author.fullName || 'U').charAt(0).toUpperCase()
                  const isPostLiked = Boolean(post.isLiked)
                  const isCommentsOpen = Boolean(expandedComments[post._id])
                  const commentsList = post.comments || []
                  const postImageUrl = resolveMediaUrl(post.imageUrl)

                  return (
                    <article
                      className="community-card post-card"
                      key={post._id}
                      id={`post-${post._id}`}
                    >
                      {/* HEADER BÀI VIẾT */}
                      <div className="post-header">
                        <div className="post-author-wrap">
                          {authorAvatar ? (
                            <img
                              src={authorAvatar}
                              alt={author.fullName}
                              className="avatar-sm"
                            />
                          ) : (
                            <div className="avatar-sm-fallback">{authorInitial}</div>
                          )}

                          <div className="post-author-info">
                            <div className="post-author-name-row">
                              <strong>{author.fullName || 'Thành viên'}</strong>
                              {author.role === 'admin' && (
                                <span className="author-badge-admin" title="Quản trị viên">
                                  <i className="bi bi-patch-check-fill" /> Admin
                                </span>
                              )}
                              <span
                                className="post-tag-badge"
                                style={{ backgroundColor: tagMeta.bg, color: tagMeta.text }}
                              >
                                <i className={`bi ${tagMeta.icon}`} /> {post.tag}
                              </span>
                            </div>
                            <span className="post-time" title={post.createdAt}>
                              <i className="bi bi-clock" /> {formatRelativeTime(post.createdAt)}
                            </span>
                          </div>
                        </div>

                        {/* MENU TÙY CHỌN (XÓA BÀI NẾU LÀ TÁC GIẢ HOẶC ADMIN) */}
                        {(isAuthor || isAdmin) && (
                          <button
                            type="button"
                            className="post-delete-btn"
                            title="Xóa bài viết"
                            onClick={() => handleDeletePost(post._id)}
                          >
                            <i className="bi bi-trash" />
                          </button>
                        )}
                      </div>

                      {/* NỘI DUNG VĂN BẢN */}
                      <div className="post-body">
                        <p className="post-text">{post.content}</p>
                      </div>

                      {/* HÌNH ẢNH MINH HỌA (NẾU CÓ) */}
                      {postImageUrl && (
                        <div
                          className="post-image-container"
                          onClick={() => setLightboxImage(postImageUrl)}
                          title="Nhấn để phóng to ảnh"
                        >
                          <img
                            src={postImageUrl}
                            alt="Ảnh đính kèm bài viết"
                            loading="lazy"
                          />
                        </div>
                      )}

                      {/* THỐNG KÊ TƯƠNG TÁC */}
                      <div className="post-stats-row">
                        <span className="stats-likes">
                          <i className="bi bi-hand-thumbs-up-fill" /> {post.likeCount || 0} lượt thích
                        </span>
                        <span
                          className="stats-comments"
                          onClick={() => toggleComments(post._id)}
                        >
                          {post.commentCount || commentsList.length} bình luận
                        </span>
                      </div>

                      {/* THANH NÚT TƯƠNG TÁC (LIKE, COMMENT, SHARE - FB STYLE) */}
                      <div className="post-actions-bar">
                        <button
                          type="button"
                          className={`post-footer-btn ${isPostLiked ? 'active-like' : ''}`}
                          onClick={() => handleToggleLike(post._id)}
                        >
                          <i className={`bi ${isPostLiked ? 'bi-hand-thumbs-up-fill' : 'bi-hand-thumbs-up'}`} />
                          <span>{isPostLiked ? 'Đã thích' : 'Thích'}</span>
                        </button>

                        <button
                          type="button"
                          className="post-footer-btn"
                          onClick={() => toggleComments(post._id)}
                        >
                          <i className="bi bi-chat-text" />
                          <span>Bình luận</span>
                        </button>

                        <button
                          type="button"
                          className="post-footer-btn"
                          onClick={() => handleSharePost(post._id)}
                        >
                          <i className="bi bi-share" />
                          <span>Chia sẻ</span>
                        </button>
                      </div>

                      {/* KHUNG BÌNH LUẬN (COMMENTS SECTION) */}
                      {isCommentsOpen && (
                        <div className="comments-section">
                          {/* FORM GỬI BÌNH LUẬN */}
                          <div className="comment-input-box">
                            {user?.avatarUrl ? (
                              <img
                                src={resolveMediaUrl(user.avatarUrl)}
                                alt={user.fullName}
                                className="avatar-xs"
                              />
                            ) : (
                              <div className="avatar-xs-fallback">
                                {firstName.charAt(0).toUpperCase()}
                              </div>
                            )}

                            <div className="comment-field-wrap">
                              <input
                                type="text"
                                placeholder="Viết bình luận của bạn..."
                                value={commentInputs[post._id] || ''}
                                onChange={(e) =>
                                  handleCommentInputChange(post._id, e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSubmitComment(post._id)
                                  }
                                }}
                              />
                              <button
                                type="button"
                                className="comment-send-btn"
                                disabled={
                                  !(commentInputs[post._id] || '').trim() ||
                                  commentSubmitting[post._id]
                                }
                                onClick={() => handleSubmitComment(post._id)}
                                title="Gửi bình luận"
                              >
                                {commentSubmitting[post._id] ? (
                                  <i className="bi bi-arrow-repeat spin" />
                                ) : (
                                  <i className="bi bi-send-fill" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* DANH SÁCH BÌNH LUẬN */}
                          {commentsList.length > 0 && (
                            <div className="comments-list">
                              {commentsList.map((c, index) => {
                                const cAuthor = c.authorId || {}
                                const cAvatar = resolveMediaUrl(cAuthor.avatarUrl)
                                const cInitial = (cAuthor.fullName || 'U').charAt(0).toUpperCase()
                                const currentUserId = user?.id || user?._id
                                const isCommentAuthor =
                                  currentUserId &&
                                  String(cAuthor._id || cAuthor) === String(currentUserId)
                                const isPostAuthor =
                                  currentUserId &&
                                  String(post.authorId?._id || post.authorId) === String(currentUserId)
                                const canDeleteComment =
                                  isCommentAuthor || isPostAuthor || user?.role === 'admin'
                                const isEditing = editingCommentId === c._id

                                return (
                                  <div className="comment-item" key={c._id || index}>
                                    {cAvatar ? (
                                      <img
                                        src={cAvatar}
                                        alt={cAuthor.fullName}
                                        className="avatar-xs"
                                      />
                                    ) : (
                                      <div className="avatar-xs-fallback">{cInitial}</div>
                                    )}

                                    {isEditing ? (
                                      <div className="comment-edit-wrap">
                                        <input
                                          type="text"
                                          className="comment-edit-input"
                                          value={editingCommentText}
                                          onChange={(e) => setEditingCommentText(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSaveEditComment(post._id, c._id)
                                            if (e.key === 'Escape') handleCancelEditComment()
                                          }}
                                          autoFocus
                                        />
                                        <div className="comment-edit-actions">
                                          <button
                                            type="button"
                                            className="btn-comment-cancel"
                                            onClick={handleCancelEditComment}
                                            disabled={editingCommentSubmitting}
                                          >
                                            Hủy
                                          </button>
                                          <button
                                            type="button"
                                            className="btn-comment-save"
                                            onClick={() => handleSaveEditComment(post._id, c._id)}
                                            disabled={editingCommentSubmitting || !editingCommentText.trim()}
                                          >
                                            {editingCommentSubmitting ? (
                                              <i className="bi bi-arrow-repeat spin" />
                                            ) : (
                                              'Lưu'
                                            )}
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="comment-body-wrap">
                                        <div className="comment-bubble">
                                          <div className="comment-author-name">
                                            {cAuthor.fullName || 'Thành viên'}
                                          </div>
                                          <div className="comment-content">{c.content}</div>
                                        </div>
                                        <div className="comment-footer-actions">
                                          <span className="comment-time">
                                            {formatRelativeTime(c.createdAt)}
                                          </span>
                                          {c.isEdited && (
                                            <span
                                              className="comment-edited-tag"
                                              title={
                                                c.editedAt
                                                  ? `Chỉnh sửa lúc ${formatRelativeTime(c.editedAt)}`
                                                  : 'Đã chỉnh sửa'
                                              }
                                            >
                                              · (Đã chỉnh sửa)
                                            </span>
                                          )}
                                          {isCommentAuthor && (
                                            <button
                                              type="button"
                                              className="comment-action-text-btn"
                                              onClick={() => handleStartEditComment(c)}
                                            >
                                              Chỉnh sửa
                                            </button>
                                          )}
                                          {canDeleteComment && (
                                            <button
                                              type="button"
                                              className="comment-action-text-btn comment-action-delete"
                                              onClick={() => handlePromptDeleteComment(post._id, c)}
                                            >
                                              Xóa
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          {/* CỘT PHẢI: HASHTAGS & GỢI Ý THỊNH HÀNH */}
          <aside className="community-col-right">
            <div className="community-card community-trending-card">
              <h4 className="sidebar-card-title">
                <i className="bi bi-fire" /> Xu hướng thảo luận
              </h4>
              <div className="trending-tags-grid">
                <button
                  type="button"
                  className="trending-chip"
                  onClick={() => setSelectedTag('Công thức món ăn')}
                >
                  #SaladEatClean
                </button>
                <button
                  type="button"
                  className="trending-chip"
                  onClick={() => setSelectedTag('Kinh nghiệm dinh dưỡng')}
                >
                  #ThamHutCalo
                </button>
                <button
                  type="button"
                  className="trending-chip"
                  onClick={() => setSelectedTag('Quá trình tập luyện')}
                >
                  #Chuoi14Ngay
                </button>
                <button
                  type="button"
                  className="trending-chip"
                  onClick={() => setSelectedTag('Mẹo sức khỏe')}
                >
                  #BMR_TDEE
                </button>
                <button
                  type="button"
                  className="trending-chip"
                  onClick={() => setSelectedTag('Công thức món ăn')}
                >
                  #GiamCanKhoaHoc
                </button>
              </div>
            </div>

            <div className="community-card community-tips-card">
              <h4 className="sidebar-card-title">
                <i className="bi bi-lightbulb-fill" /> Mẹo đăng bài thu hút
              </h4>
              <div className="tips-content">
                <p>
                  📸 <strong>Kèm hình ảnh:</strong> Bài viết có ảnh món ăn hoặc biểu đồ cân nặng thường nhận được nhiều tương tác hơn gấp 3 lần!
                </p>
                <p>
                  🏷️ <strong>Gắn đúng Tag:</strong> Chọn đúng chủ đề giúp các thành viên cùng mục tiêu dễ dàng tìm thấy kinh nghiệm của bạn.
                </p>
                <p>
                  🥗 <strong>Chi tiết Calo:</strong> Nếu chia sẻ công thức, hãy ghi rõ ước tính Calo và Macro để hỗ trợ cộng đồng nhé!
                </p>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* MODAL BIỂU MẪU ĐĂNG BÀI VIẾT CỘNG ĐỒNG (UC26) */}
      {isModalOpen && (
        <div className="community-modal-backdrop" onClick={handleCancelCreatePost}>
          <div
            className="community-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-create-post-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* TIÊU ĐỀ MODAL & NÚT HỦY (3a & 4a) */}
            <div className="community-modal-header">
              <h3 id="modal-create-post-title">Tạo bài viết</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCancelCreatePost}
                title="Hủy đăng bài"
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <form onSubmit={handleSubmitPost} className="community-modal-body">
              {/* THÔNG TIN NGƯỜI ĐĂNG */}
              <div className="modal-user-row">
                {user?.avatarUrl ? (
                  <img
                    src={resolveMediaUrl(user.avatarUrl)}
                    alt={user.fullName}
                    className="avatar-sm"
                  />
                ) : (
                  <div className="avatar-sm-fallback">{firstName.charAt(0).toUpperCase()}</div>
                )}
                <div>
                  <strong className="modal-user-name">{user?.fullName || 'Bạn'}</strong>
                  <div className="modal-privacy-chip">
                    <i className="bi bi-globe2" /> Công khai
                  </div>
                </div>
              </div>

              {/* CHỌN TAG / CHỦ ĐỀ CHO BÀI VIẾT (BƯỚC 5 & LUỒNG 5c) */}
              <div className="modal-tag-selector">
                <label htmlFor="post-tag-select">
                  <i className="bi bi-tag-fill" /> Chọn chủ đề bài viết:
                </label>
                <select
                  id="post-tag-select"
                  value={postTag}
                  onChange={(e) => setPostTag(e.target.value)}
                >
                  {COMMUNITY_TAGS.filter((t) => t !== 'Tất cả').map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* NHẬP NỘI DUNG BÀI VIẾT (BƯỚC 3 & NGOẠI LỆ 3a) */}
              <div className="modal-textarea-wrap">
                <textarea
                  rows={5}
                  placeholder={`${firstName} ơi, bạn muốn chia sẻ điều gì về dinh dưỡng, công thức hay bài tập hôm nay?...`}
                  value={postContent}
                  onChange={(e) => {
                    setPostContent(e.target.value)
                    if (feedbackError) setFeedbackError('')
                  }}
                  autoFocus
                />
              </div>

              {/* ĐÍNH KÈM HÌNH ẢNH (BƯỚC 4, LUỒNG 4b, NGOẠI LỆ 4b) */}
              <div className="modal-media-section">
                {imagePreviewUrl ? (
                  <div className="modal-image-preview-box">
                    <img src={imagePreviewUrl} alt="Xem trước ảnh minh họa" />
                    <button
                      type="button"
                      className="remove-image-btn"
                      onClick={handleRemoveImage}
                      title="Gỡ ảnh minh họa"
                    >
                      <i className="bi bi-x-circle-fill" />
                    </button>
                  </div>
                ) : (
                  <div
                    className="modal-upload-trigger"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleFileDrop}
                  >
                    <i className="bi bi-image" />
                    <div>
                      <strong>Thêm hình ảnh minh họa cho bài viết</strong>
                      <small>Hỗ trợ định dạng JPG, PNG, WEBP tối đa 5MB</small>
                    </div>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  style={{ display: 'none' }}
                  onChange={handleFileSelected}
                />
              </div>

              {/* THÔNG BÁO LỖI INLINE NẾU CÓ */}
              {feedbackError && (
                <div className="modal-inline-error">
                  <i className="bi bi-exclamation-triangle-fill" />
                  <span>{feedbackError}</span>
                </div>
              )}

              {/* NÚT HÀNH ĐỘNG MODAL: HỦY VÀ ĐĂNG BÀI */}
              <div className="community-modal-footer">
                <button
                  type="button"
                  className="community-btn-secondary"
                  onClick={handleCancelCreatePost}
                  disabled={submitLoading}
                >
                  Hủy thao tác
                </button>
                <button
                  type="submit"
                  className="community-btn-primary"
                  disabled={submitLoading || !postContent.trim()}
                >
                  {submitLoading ? (
                    <>
                      <i className="bi bi-arrow-repeat spin" /> Đang đăng...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-send-fill" /> Đăng bài
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN XÓA BÌNH LUẬN (UC27 - Luồng thay thế 4b & 5b) */}
      {deleteConfirmComment && (
        <div className="community-modal-backdrop" onClick={handleCancelDeleteComment}>
          <div
            className="community-modal delete-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-delete-comment-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="community-modal-header">
              <h3 id="modal-delete-comment-title">Xác nhận xóa bình luận</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCancelDeleteComment}
                title="Hủy"
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div className="community-modal-body">
              <p className="delete-modal-desc">
                Bạn có chắc chắn muốn xóa bình luận này không? Hành động này không thể hoàn tác.
              </p>
              <div className="delete-comment-quote">
                <i className="bi bi-chat-quote-fill" />
                <span>"{deleteConfirmComment.content}"</span>
              </div>
              <div className="community-modal-footer">
                <button
                  type="button"
                  className="community-btn-secondary"
                  onClick={handleCancelDeleteComment}
                  disabled={deleteCommentSubmitting}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="btn-danger-confirm"
                  onClick={handleConfirmDeleteComment}
                  disabled={deleteCommentSubmitting}
                >
                  {deleteCommentSubmitting ? (
                    <>
                      <i className="bi bi-arrow-repeat spin" /> Đang xóa...
                    </>
                  ) : (
                    'Xác nhận'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX PHÓNG TO HÌNH ẢNH */}
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
    </div>
  )
}
