import { useEffect, useMemo, useRef, useState } from 'react'
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

// Hàm chuẩn hóa tiếng Việt bỏ dấu để tìm kiếm gợi ý mượt mà
function normalizeVietnamese(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

// Định dạng nội dung bài viết: highlight các mention @NgườiDùng hoặc @ChủĐề hoặc #Hashtag
function renderFormattedContent(content, onTagClick) {
  if (!content) return null
  const lines = String(content).split('\n')

  return lines.map((line, lineIdx) => {
    const regex = /(@[a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9\s]+?)(?=[,\.!\?;\n\r]|$|\s{2,}|@|#)|\B(#[a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9]+)/g
    const parts = []
    let lastIndex = 0
    let match

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.substring(lastIndex, match.index))
      }
      const token = match[0].trim()
      const isTag = token.startsWith('@') && COMMUNITY_TAGS.includes(token.slice(1))

      parts.push(
        <span
          key={`token-${lineIdx}-${match.index}`}
          className="mention-highlight"
          onClick={
            isTag && typeof onTagClick === 'function'
              ? (e) => {
                  e.stopPropagation()
                  onTagClick(token.slice(1))
                }
              : undefined
          }
          style={isTag ? { cursor: 'pointer' } : undefined}
          title={isTag ? `Nhấn để lọc theo chủ đề "${token.slice(1)}"` : undefined}
        >
          {match[0]}
        </span>
      )
      lastIndex = match.index + match[0].length
    }

    if (lastIndex < line.length) {
      parts.push(line.substring(lastIndex))
    }

    return (
      <span key={`line-${lineIdx}`}>
        {parts.length > 0 ? parts : line}
        {lineIdx < lines.length - 1 && <br />}
      </span>
    )
  })
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

  // Ref input file, textarea và dropdown gợi ý tag/mention
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)
  const mentionMenuRef = useRef(null)

  // State cho tính năng Gợi ý gắn thẻ (Mention @)
  const [mentionData, setMentionData] = useState({ users: [], tags: [] })
  const [mentionQuery, setMentionQuery] = useState('')
  const [showMentionMenu, setShowMentionMenu] = useState(false)
  const [mentionStartIndex, setMentionStartIndex] = useState(0)
  const [mentionCursorIndex, setMentionCursorIndex] = useState(0)
  const [activeMentionIndex, setActiveMentionIndex] = useState(0)

  // State xác nhận xóa bài viết (Modal in-app thay cho window.confirm / localhost)
  const [deleteConfirmPost, setDeleteConfirmPost] = useState(null)
  const [deletePostSubmitting, setDeletePostSubmitting] = useState(false)

  // State chỉnh sửa bài viết
  const [editingPost, setEditingPost] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [editTag, setEditTag] = useState('Chia sẻ chung')
  const [editSelectedImageFile, setEditSelectedImageFile] = useState(null)
  const [editImagePreviewUrl, setEditImagePreviewUrl] = useState('')
  const [editRemoveImage, setEditRemoveImage] = useState(false)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const editFileInputRef = useRef(null)
  const editTextareaRef = useRef(null)
  const editMentionMenuRef = useRef(null)

  // Mention cho Modal Chỉnh sửa bài viết
  const [editShowMentionMenu, setEditShowMentionMenu] = useState(false)
  const [editMentionQuery, setEditMentionQuery] = useState('')
  const [editMentionStartIndex, setEditMentionStartIndex] = useState(0)
  const [editMentionCursorIndex, setEditMentionCursorIndex] = useState(0)
  const [editActiveMentionIndex, setEditActiveMentionIndex] = useState(0)

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
        if (isActive) {
          // UC29 Ngoại lệ 4c / 5c: Lỗi khi truy vấn dữ liệu
          const errorMsg =
            err.response?.data?.message || 'Không thể tải kết quả, vui lòng thử lại'
          setFeedbackError(errorMsg)
        }
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

  // --- TẢI DỮ LIỆU GỢI Ý GẮN THẺ (MENTION @) ---
  useEffect(() => {
    let isActive = true
    axiosInstance
      .get('/community/mention-suggestions')
      .then(({ data }) => {
        if (!isActive) return
        setMentionData({
          users: Array.isArray(data?.users) ? data.users : [],
          tags:
            Array.isArray(data?.tags) && data.tags.length > 0
              ? data.tags
              : COMMUNITY_TAGS.filter((t) => t !== 'Tất cả'),
        })
      })
      .catch((err) => {
        console.error('[CommunityPage] Không thể tải danh sách gợi ý mention:', err)
      })

    return () => {
      isActive = false
    }
  }, [isModalOpen])

  // Lắng nghe click ngoài dropdown để tự đóng menu gợi ý
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        mentionMenuRef.current &&
        !mentionMenuRef.current.contains(e.target) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target)
      ) {
        setShowMentionMenu(false)
      }
    }

    if (showMentionMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMentionMenu])

  // Danh sách gợi ý sau khi lọc theo từ khóa sau ký tự @
  const filteredMentions = useMemo(() => {
    if (!showMentionMenu) return []
    const normQuery = normalizeVietnamese(mentionQuery)

    // 1. Lọc thành viên
    const matchedUsers = (mentionData.users || [])
      .filter((u) => {
        if (!normQuery) return true
        return (
          normalizeVietnamese(u.fullName).includes(normQuery) ||
          normalizeVietnamese(u.email).includes(normQuery)
        )
      })
      .slice(0, 8)
      .map((u) => ({
        type: 'user',
        id: u.id || u._id,
        text: u.fullName,
        subtitle: u.role === 'admin' ? 'Quản trị viên' : u.email || 'Thành viên',
        avatarUrl: u.avatarUrl,
        role: u.role,
      }))

    // 2. Lọc chủ đề / Tag cộng đồng
    const allTags =
      mentionData.tags && mentionData.tags.length > 0
        ? mentionData.tags
        : COMMUNITY_TAGS.filter((t) => t !== 'Tất cả')

    const matchedTags = allTags
      .filter((t) => {
        if (t === 'Tất cả') return false
        if (!normQuery) return true
        return normalizeVietnamese(t).includes(normQuery)
      })
      .map((t) => {
        const meta = TAG_COLOR_MAP[t] || {
          bg: '#ecfdf5',
          text: '#059669',
          icon: 'bi-tag',
        }
        return {
          type: 'tag',
          id: t,
          text: t,
          subtitle: 'Chủ đề bài viết',
          icon: meta.icon,
          color: meta.text,
          bg: meta.bg,
        }
      })

    return [...matchedUsers, ...matchedTags]
  }, [showMentionMenu, mentionQuery, mentionData])

  // Lắng nghe click ngoài edit mention menu để tự đóng
  useEffect(() => {
    function handleClickOutsideEdit(e) {
      if (
        editMentionMenuRef.current &&
        !editMentionMenuRef.current.contains(e.target) &&
        editTextareaRef.current &&
        !editTextareaRef.current.contains(e.target)
      ) {
        setEditShowMentionMenu(false)
      }
    }

    if (editShowMentionMenu) {
      document.addEventListener('mousedown', handleClickOutsideEdit)
      return () => document.removeEventListener('mousedown', handleClickOutsideEdit)
    }
  }, [editShowMentionMenu])

  // Danh sách gợi ý tag/mention cho Modal Chỉnh sửa bài viết
  const filteredEditMentions = useMemo(() => {
    if (!editShowMentionMenu) return []
    const normQuery = normalizeVietnamese(editMentionQuery)

    const matchedUsers = (mentionData.users || [])
      .filter((u) => {
        if (!normQuery) return true
        return (
          normalizeVietnamese(u.fullName).includes(normQuery) ||
          normalizeVietnamese(u.email).includes(normQuery)
        )
      })
      .slice(0, 8)
      .map((u) => ({
        type: 'user',
        id: u.id || u._id,
        text: u.fullName,
        subtitle: u.role === 'admin' ? 'Quản trị viên' : u.email || 'Thành viên',
        avatarUrl: u.avatarUrl,
        role: u.role,
      }))

    const allTags =
      mentionData.tags && mentionData.tags.length > 0
        ? mentionData.tags
        : COMMUNITY_TAGS.filter((t) => t !== 'Tất cả')

    const matchedTags = allTags
      .filter((t) => {
        if (t === 'Tất cả') return false
        if (!normQuery) return true
        return normalizeVietnamese(t).includes(normQuery)
      })
      .map((t) => {
        const meta = TAG_COLOR_MAP[t] || {
          bg: '#ecfdf5',
          text: '#059669',
          icon: 'bi-tag',
        }
        return {
          type: 'tag',
          id: t,
          text: t,
          subtitle: 'Chủ đề bài viết',
          icon: meta.icon,
          color: meta.text,
          bg: meta.bg,
        }
      })

    return [...matchedUsers, ...matchedTags]
  }, [editShowMentionMenu, editMentionQuery, mentionData])

  useEffect(() => {
    if (editActiveMentionIndex >= filteredEditMentions.length && filteredEditMentions.length > 0) {
      setEditActiveMentionIndex(0)
    }
  }, [filteredEditMentions.length, editActiveMentionIndex])

  // Giữ activeMentionIndex trong khoảng hợp lệ khi danh sách gợi ý thay đổi
  useEffect(() => {
    if (activeMentionIndex >= filteredMentions.length && filteredMentions.length > 0) {
      setActiveMentionIndex(0)
    }
  }, [filteredMentions.length, activeMentionIndex])

  // Kiểm tra vị trí con trỏ để kích hoạt menu gợi ý khi gõ @
  function checkMentionTrigger(text, cursor) {
    const textBefore = text.slice(0, cursor)
    const match = textBefore.match(/(?:^|\s)@([^\n\r@]{0,25})$/)
    if (match) {
      const atSymbolOffset = match[0].indexOf('@')
      const atIndex = match.index + atSymbolOffset
      const query = match[1]

      // Cho phép tối đa 1 khoảng trắng (hỗ trợ họ và tên 2 từ)
      if (query.split(/\s+/).length <= 2) {
        setShowMentionMenu(true)
        setMentionQuery(query)
        setMentionStartIndex(atIndex)
        setMentionCursorIndex(cursor)
        setActiveMentionIndex(0)
        return
      }
    }
    setShowMentionMenu(false)
  }

  function handleTextareaChange(e) {
    const value = e.target.value
    const cursor = e.target.selectionStart
    setPostContent(value)
    if (feedbackError) setFeedbackError('')
    checkMentionTrigger(value, cursor)
  }

  function handleTextareaCursorMove(e) {
    checkMentionTrigger(e.target.value, e.target.selectionStart)
  }

  function handleTextareaKeyDown(e) {
    if (!showMentionMenu || filteredMentions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveMentionIndex((prev) => (prev + 1) % filteredMentions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveMentionIndex(
        (prev) => (prev - 1 + filteredMentions.length) % filteredMentions.length
      )
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const selectedItem = filteredMentions[activeMentionIndex]
      if (selectedItem) {
        handleSelectMention(selectedItem)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setShowMentionMenu(false)
    }
  }

  function handleSelectMention(item) {
    const before = postContent.slice(0, mentionStartIndex)
    const after = postContent.slice(mentionCursorIndex)
    const mentionText = `@${item.text} `
    const nextContent = `${before}${mentionText}${after}`

    setPostContent(nextContent)
    setShowMentionMenu(false)

    // Nếu chọn Tag chủ đề thì đồng bộ với bộ chọn chủ đề bài viết
    if (item.type === 'tag') {
      setPostTag(item.text)
    }

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        const newPos = mentionStartIndex + mentionText.length
        textareaRef.current.setSelectionRange(newPos, newPos)
      }
    }, 10)
  }

  function handleInsertQuickTag(tagName) {
    const tagText = `@${tagName} `
    let nextContent = postContent
    if (!nextContent) {
      nextContent = tagText
    } else if (nextContent.endsWith(' ')) {
      nextContent += tagText
    } else {
      nextContent += ' ' + tagText
    }
    setPostContent(nextContent)
    setPostTag(tagName)
    setShowMentionMenu(false)
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        const len = nextContent.length
        textareaRef.current.setSelectionRange(len, len)
      }
    }, 10)
  }

  // --- UC29: TÌM KIẾM / LỌC BÀI ĐĂNG THEO TAG ---

  // Luồng chính 1 - 5: Thực hiện tìm kiếm từ khóa
  function handleExecuteSearch(customQuery = null) {
    const query = customQuery !== null ? customQuery : searchQuery
    const trimmed = String(query || '').trim()

    // Ngoại lệ 3a / 4a: Điều kiện tìm kiếm không hợp lệ
    if (trimmed.length > 100) {
      setFeedbackError('Thông tin tìm kiếm không hợp lệ. Từ khóa không được vượt quá 100 ký tự.')
      return
    }

    setFeedbackError('')
    setActiveSearch(trimmed)
  }

  // Luồng thay thế 1b / 2b: Xóa từ khóa tìm kiếm
  function handleClearSearch() {
    setSearchQuery('')
    setActiveSearch('')
  }

  // Luồng chính & Thay thế: Chọn Tag lọc chủ đề
  function handleSelectTag(tag) {
    setSelectedTag(tag)
    setFeedbackError('')
  }

  // Luồng thay thế 1b / 2b: Xóa tất cả bộ lọc và từ khóa, quay về mặc định
  function handleResetAllFilters() {
    setSearchQuery('')
    setActiveSearch('')
    setSelectedTag('Tất cả')
    setFeedbackError('')
  }

  // --- XỬ LÝ ĐĂNG BÀI VIẾT (UC26) ---

  // Luồng chính 1: Mở biểu mẫu đăng bài
  function handleOpenCreateModal(defaultTag = 'Chia sẻ chung') {
    setPostContent('')
    setPostTag(defaultTag)
    setSelectedImageFile(null)
    setImagePreviewUrl('')
    setFeedbackError('')
    setShowMentionMenu(false)
    setMentionQuery('')
    setActiveMentionIndex(0)
    setIsModalOpen(true)
  }

  // Luồng thay thế 3a & 4a: Người dùng hủy thao tác đăng bài
  function handleCancelCreatePost() {
    setIsModalOpen(false)
    setPostContent('')
    setSelectedImageFile(null)
    setShowMentionMenu(false)
    setMentionQuery('')
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
      setShowMentionMenu(false)
      setMentionQuery('')
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

  // --- UC28: THÍCH / BỎ THÍCH BÀI ĐĂNG (LUỒNG CHÍNH 1-6 & THAY THẾ 1a-4a) ---
  async function handleToggleLike(postId) {
    try {
      const { data } = await axiosInstance.post(`/community/posts/${postId}/like`)
      // Cập nhật trạng thái thích và số lượt thích ngay tức thì
      setPosts((prev) =>
        prev.map((p) =>
          p._id === postId
            ? { ...p, isLiked: data.isLiked, likeCount: data.likeCount }
            : p
        )
      )
    } catch (err) {
      console.error('[CommunityPage] Lỗi cập nhật trạng thái thích:', err)
      // Ngoại lệ 2a / 3a: Bài đăng không còn tồn tại
      // Ngoại lệ 3b / 4b: Không thể cập nhật trạng thái thích do lỗi hệ thống
      const errorMsg =
        err.response?.data?.message || 'Không thể cập nhật trạng thái thích, vui lòng thử lại'
      setFeedbackError(errorMsg)

      if (err.response?.status === 404) {
        setPosts((prev) => prev.filter((p) => p._id !== postId))
      }
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

  // --- XỬ LÝ CHỈNH SỬA BÀI VIẾT ---
  function handleOpenEditModal(post) {
    setEditingPost(post)
    setEditContent(post.content || '')
    setEditTag(post.tag || 'Chia sẻ chung')
    setEditSelectedImageFile(null)
    setEditImagePreviewUrl(post.imageUrl ? resolveMediaUrl(post.imageUrl) : '')
    setEditRemoveImage(false)
    setEditShowMentionMenu(false)
    setEditMentionQuery('')
    setEditActiveMentionIndex(0)
    setFeedbackError('')
  }

  function handleCancelEditPost() {
    setEditingPost(null)
    setEditContent('')
    setEditSelectedImageFile(null)
    if (editImagePreviewUrl && editImagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(editImagePreviewUrl)
    }
    setEditImagePreviewUrl('')
    setEditRemoveImage(false)
    setEditShowMentionMenu(false)
    setEditMentionQuery('')
    setFeedbackError('')
  }

  function validateAndSetEditImage(file) {
    if (!file) return

    const fileType = (file.type || '').toLowerCase()
    const fileName = (file.name || '').toLowerCase()
    const hasValidMime = ALLOWED_IMAGE_TYPES.includes(fileType) || fileType.startsWith('image/')
    const hasValidExt = /\.(jpe?g|png|webp|gif|jfif|bmp)$/i.test(fileName)

    if (!hasValidMime && !hasValidExt) {
      setFeedbackError('Hình ảnh không hợp lệ. Vui lòng chọn ảnh có định dạng JPG, PNG, WEBP hoặc GIF.')
      return
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setFeedbackError('Hình ảnh không hợp lệ. Dung lượng ảnh không được vượt quá 5MB.')
      return
    }

    setFeedbackError('')
    setEditSelectedImageFile(file)
    setEditRemoveImage(false)
    const preview = URL.createObjectURL(file)
    setEditImagePreviewUrl(preview)
  }

  function handleEditFileSelected(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    validateAndSetEditImage(file)
  }

  function handleEditFileDrop(event) {
    event.preventDefault()
    const file = event.dataTransfer?.files?.[0]
    validateAndSetEditImage(file)
  }

  function handleRemoveEditImage() {
    setEditSelectedImageFile(null)
    if (editImagePreviewUrl && editImagePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(editImagePreviewUrl)
    }
    setEditImagePreviewUrl('')
    setEditRemoveImage(true)
  }

  function checkEditMentionTrigger(text, cursor) {
    const textBefore = text.slice(0, cursor)
    const match = textBefore.match(/(?:^|\s)@([^\n\r@]{0,25})$/)
    if (match) {
      const atSymbolOffset = match[0].indexOf('@')
      const atIndex = match.index + atSymbolOffset
      const query = match[1]

      if (query.split(/\s+/).length <= 2) {
        setEditShowMentionMenu(true)
        setEditMentionQuery(query)
        setEditMentionStartIndex(atIndex)
        setEditMentionCursorIndex(cursor)
        setEditActiveMentionIndex(0)
        return
      }
    }
    setEditShowMentionMenu(false)
  }

  function handleEditTextareaChange(e) {
    const value = e.target.value
    const cursor = e.target.selectionStart
    setEditContent(value)
    if (feedbackError) setFeedbackError('')
    checkEditMentionTrigger(value, cursor)
  }

  function handleEditTextareaCursorMove(e) {
    checkEditMentionTrigger(e.target.value, e.target.selectionStart)
  }

  function handleEditTextareaKeyDown(e) {
    if (!editShowMentionMenu || filteredEditMentions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setEditActiveMentionIndex((prev) => (prev + 1) % filteredEditMentions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setEditActiveMentionIndex(
        (prev) => (prev - 1 + filteredEditMentions.length) % filteredEditMentions.length
      )
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const selectedItem = filteredEditMentions[editActiveMentionIndex]
      if (selectedItem) {
        handleSelectEditMention(selectedItem)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setEditShowMentionMenu(false)
    }
  }

  function handleSelectEditMention(item) {
    const before = editContent.slice(0, editMentionStartIndex)
    const after = editContent.slice(editMentionCursorIndex)
    const mentionText = `@${item.text} `
    const nextContent = `${before}${mentionText}${after}`

    setEditContent(nextContent)
    setEditShowMentionMenu(false)

    if (item.type === 'tag') {
      setEditTag(item.text)
    }

    setTimeout(() => {
      if (editTextareaRef.current) {
        editTextareaRef.current.focus()
        const newPos = editMentionStartIndex + mentionText.length
        editTextareaRef.current.setSelectionRange(newPos, newPos)
      }
    }, 10)
  }

  function handleInsertEditQuickTag(tagName) {
    const tagText = `@${tagName} `
    let nextContent = editContent
    if (!nextContent) {
      nextContent = tagText
    } else if (nextContent.endsWith(' ')) {
      nextContent += tagText
    } else {
      nextContent += ' ' + tagText
    }
    setEditContent(nextContent)
    setEditTag(tagName)
    setEditShowMentionMenu(false)
    setTimeout(() => {
      if (editTextareaRef.current) {
        editTextareaRef.current.focus()
        const len = nextContent.length
        editTextareaRef.current.setSelectionRange(len, len)
      }
    }, 10)
  }

  async function handleSubmitEditPost(e) {
    if (e) e.preventDefault()
    if (!editingPost) return

    const trimmed = editContent.trim()
    if (!trimmed) {
      setFeedbackError('Nội dung bài viết không được để trống')
      return
    }

    setEditSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('content', trimmed)
      formData.append('tag', editTag || 'Chia sẻ chung')
      if (editRemoveImage) {
        formData.append('removeImage', 'true')
      } else if (editSelectedImageFile) {
        formData.append('image', editSelectedImageFile)
      }

      const { data } = await axiosInstance.put(`/community/posts/${editingPost._id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      if (data?.post) {
        setPosts((prev) =>
          prev.map((p) => (p._id === data.post._id ? data.post : p))
        )
      }

      setFeedbackSuccess(data.message || 'Cập nhật bài viết thành công')
      handleCancelEditPost()
    } catch (err) {
      console.error('[CommunityPage] Lỗi cập nhật bài:', err)
      setFeedbackError(err.response?.data?.message || 'Không thể cập nhật bài viết, vui lòng thử lại')
    } finally {
      setEditSubmitting(false)
    }
  }

  // --- XÁC NHẬN XÓA BÀI VIẾT (Thay thế hoàn toàn window.confirm / không còn thông báo localhost) ---
  function handlePromptDeletePost(post) {
    setDeleteConfirmPost(post)
  }

  async function handleConfirmDeletePost() {
    if (!deleteConfirmPost) return

    setDeletePostSubmitting(true)
    try {
      await axiosInstance.delete(`/community/posts/${deleteConfirmPost._id}`)
      setPosts((prev) => prev.filter((p) => p._id !== deleteConfirmPost._id))
      setFeedbackSuccess('Đã xóa bài viết thành công')
      setDeleteConfirmPost(null)
    } catch (err) {
      console.error('[CommunityPage] Lỗi xóa bài:', err)
      setFeedbackError(err.response?.data?.message || 'Không thể xóa bài viết, vui lòng thử lại')
    } finally {
      setDeletePostSubmitting(false)
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
          <form
            className="community-header-search"
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
              type="text"
              placeholder="Tìm kiếm bài viết, công thức..."
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

            {/* UC29: BANNER ĐIỀU KIỆN TÌM KIẾM / LỌC (LUỒNG CHÍNH 5 & THAY THẾ 1b) */}
            {(selectedTag !== 'Tất cả' || activeSearch) && (
              <div className="active-filter-banner">
                <div className="filter-chips-wrap">
                  <span className="filter-lead">
                    <i className="bi bi-funnel-fill" /> Đang lọc:
                  </span>
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
                {activeSearch || selectedTag !== 'Tất cả' ? (
                  <>
                    <i className="bi bi-search" style={{ fontSize: '42px', color: '#94a3b8', marginBottom: '12px', display: 'inline-block' }} />
                    {/* UC29 Ngoại lệ 4b / 5b: Không tìm thấy bài đăng phù hợp */}
                    <h3>Không tìm thấy kết quả phù hợp</h3>
                    <p>
                      Không tìm thấy bài đăng nào phù hợp với {activeSearch ? `từ khóa "${activeSearch}"` : ''}{activeSearch && selectedTag !== 'Tất cả' ? ' thuộc ' : ''}{selectedTag !== 'Tất cả' ? `chủ đề "${selectedTag}"` : ''}. Vui lòng thử từ khóa khác hoặc xóa điều kiện lọc để xem thêm bài đăng.
                    </p>
                    <div className="empty-actions-wrap">
                      <button
                        type="button"
                        className="community-btn-secondary"
                        onClick={handleResetAllFilters}
                      >
                        <i className="bi bi-arrow-counterclockwise" /> Xóa bộ lọc &amp; Tải lại
                      </button>
                      <button
                        type="button"
                        className="community-btn-primary"
                        onClick={() => handleOpenCreateModal(selectedTag !== 'Tất cả' ? selectedTag : 'Chia sẻ chung')}
                      >
                        <i className="bi bi-pencil-square" /> Tạo bài viết mới
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <i className="bi bi-chat-heart" />
                    <h3>Chưa có bài viết nào</h3>
                    <p>
                      Hãy là người đầu tiên chia sẻ công thức món ăn hoặc kinh nghiệm dinh dưỡng hôm nay!
                    </p>
                    <button
                      type="button"
                      className="community-btn-primary"
                      onClick={() => handleOpenCreateModal('Chia sẻ chung')}
                    >
                      <i className="bi bi-pencil-square" /> Đăng bài ngay
                    </button>
                  </>
                )}
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
                              {post.isEdited && (
                                <span
                                  className="post-edited-indicator"
                                  title={
                                    post.editedAt
                                      ? `Chỉnh sửa lúc ${formatRelativeTime(post.editedAt)}`
                                      : 'Đã chỉnh sửa'
                                  }
                                >
                                  · (Đã chỉnh sửa)
                                </span>
                              )}
                            </span>
                          </div>
                        </div>

                        {/* MENU TÙY CHỌN (CHỈNH SỬA & XÓA BÀI NẾU LÀ TÁC GIẢ HOẶC ADMIN) */}
                        {(isAuthor || isAdmin) && (
                          <div className="post-header-actions">
                            <button
                              type="button"
                              className="post-action-icon-btn post-edit-btn"
                              title="Chỉnh sửa bài viết"
                              onClick={() => handleOpenEditModal(post)}
                            >
                              <i className="bi bi-pencil-square" />
                            </button>
                            <button
                              type="button"
                              className="post-action-icon-btn post-delete-btn"
                              title="Xóa bài viết"
                              onClick={() => handlePromptDeletePost(post)}
                            >
                              <i className="bi bi-trash" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* NỘI DUNG VĂN BẢN */}
                      <div className="post-body">
                        <p className="post-text">{renderFormattedContent(post.content, handleSelectTag)}</p>
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

                      {/* THANH NÚT TƯƠNG TÁC (LIKE, COMMENT - BỎ NÚT CHIA SẺ) */}
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
                                          <div className="comment-content">
                                            {renderFormattedContent(c.content, handleSelectTag)}
                                          </div>
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
                {/* Gợi ý gắn thẻ nhanh */}
                <div className="quick-mention-bar">
                  <span className="quick-mention-label">
                    <i className="bi bi-magic" /> Gợi ý gắn thẻ:
                  </span>
                  <div className="quick-mention-chips">
                    {COMMUNITY_TAGS.filter((t) => t !== 'Tất cả').map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="quick-mention-chip"
                        onClick={() => handleInsertQuickTag(tag)}
                        title={`Bấm để chèn @${tag}`}
                      >
                        <i className="bi bi-at" />{tag}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  ref={textareaRef}
                  rows={5}
                  placeholder={`${firstName} ơi, bạn muốn chia sẻ điều gì về dinh dưỡng, công thức hay bài tập hôm nay? Gõ @ để gắn thẻ thành viên hoặc chủ đề...`}
                  value={postContent}
                  onChange={handleTextareaChange}
                  onKeyDown={handleTextareaKeyDown}
                  onClick={handleTextareaCursorMove}
                  onKeyUp={handleTextareaCursorMove}
                  autoFocus
                />

                {/* POPUP MENU GỢI Ý KHI GÕ @ */}
                {showMentionMenu && (
                  <div className="mention-dropdown-menu" ref={mentionMenuRef}>
                    <div className="mention-dropdown-header">
                      <div className="mention-header-title">
                        <i className="bi bi-at" /> Gợi ý gắn thẻ {mentionQuery ? `cho "${mentionQuery}"` : ''}
                      </div>
                      <button
                        type="button"
                        className="mention-dropdown-close"
                        onClick={() => setShowMentionMenu(false)}
                        title="Đóng menu gợi ý (Esc)"
                      >
                        <i className="bi bi-x" />
                      </button>
                    </div>

                    <div className="mention-dropdown-body">
                      {filteredMentions.length === 0 ? (
                        <div className="mention-empty-hint">
                          <i className="bi bi-search" /> Không tìm thấy gợi ý phù hợp
                        </div>
                      ) : (
                        filteredMentions.map((item, index) => {
                          const isActive = index === activeMentionIndex
                          return (
                            <div
                              key={`${item.type}-${item.id}`}
                              className={`mention-item ${isActive ? 'is-active' : ''}`}
                              onMouseEnter={() => setActiveMentionIndex(index)}
                              onClick={() => handleSelectMention(item)}
                            >
                              {item.type === 'user' ? (
                                <div className="mention-avatar-wrap">
                                  {item.avatarUrl ? (
                                    <img
                                      src={resolveMediaUrl(item.avatarUrl)}
                                      alt={item.text}
                                      className="mention-avatar"
                                    />
                                  ) : (
                                    <div className="mention-avatar-fallback">
                                      {item.text.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div
                                  className="mention-tag-icon"
                                  style={{ backgroundColor: item.bg, color: item.color }}
                                >
                                  <i className={`bi ${item.icon}`} />
                                </div>
                              )}

                              <div className="mention-item-info">
                                <div className="mention-item-name">
                                  <span className="mention-item-at">@</span>
                                  <strong>{item.text}</strong>
                                  {item.role === 'admin' && (
                                    <span className="mention-badge-admin">Admin</span>
                                  )}
                                  {item.type === 'tag' && (
                                    <span className="mention-badge-tag">Chủ đề</span>
                                  )}
                                </div>
                                <div className="mention-item-sub">{item.subtitle}</div>
                              </div>

                              <div className="mention-item-enter-hint">
                                <i className="bi bi-arrow-return-left" />
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>

                    <div className="mention-dropdown-footer">
                      <span>
                        Dùng <strong>↑</strong> <strong>↓</strong> và <strong>Enter</strong> để chọn, <strong>Esc</strong> để thoát
                      </span>
                    </div>
                  </div>
                )}
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

      {/* MODAL XÁC NHẬN XÓA BÀI VIẾT (Thay thế hoàn toàn window.confirm / không còn thông báo localhost) */}
      {deleteConfirmPost && (
        <div
          className="community-modal-backdrop"
          onClick={() => !deletePostSubmitting && setDeleteConfirmPost(null)}
        >
          <div
            className="community-modal delete-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-delete-post-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="community-modal-header">
              <h3 id="modal-delete-post-title">
                <i className="bi bi-trash3-fill" style={{ color: '#ef4444', marginRight: '8px' }} />
                Xác nhận xóa bài viết
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => !deletePostSubmitting && setDeleteConfirmPost(null)}
                title="Hủy"
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div className="community-modal-body">
              <p className="delete-modal-desc">
                Bạn có chắc chắn muốn xóa bài viết này không? Bài viết sẽ được gỡ khỏi bảng tin cộng đồng và hành động này không thể hoàn tác.
              </p>
              {deleteConfirmPost.content && (
                <div className="delete-comment-quote">
                  <i className="bi bi-chat-quote-fill" />
                  <span>
                    "{deleteConfirmPost.content.length > 140
                      ? deleteConfirmPost.content.slice(0, 140) + '...'
                      : deleteConfirmPost.content}"
                  </span>
                </div>
              )}
              <div className="community-modal-footer">
                <button
                  type="button"
                  className="community-btn-secondary"
                  onClick={() => setDeleteConfirmPost(null)}
                  disabled={deletePostSubmitting}
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  className="btn-danger-confirm"
                  onClick={handleConfirmDeletePost}
                  disabled={deletePostSubmitting}
                >
                  {deletePostSubmitting ? (
                    <>
                      <i className="bi bi-arrow-repeat spin" /> Đang xóa...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-trash-fill" /> Xác nhận xóa
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CHỈNH SỬA BÀI VIẾT */}
      {editingPost && (
        <div className="community-modal-backdrop" onClick={handleCancelEditPost}>
          <div
            className="community-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-edit-post-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="community-modal-header">
              <h3 id="modal-edit-post-title">
                <i className="bi bi-pencil-square" style={{ color: '#059669', marginRight: '8px' }} />
                Chỉnh sửa bài viết
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCancelEditPost}
                title="Đóng"
                disabled={editSubmitting}
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>

            <form onSubmit={handleSubmitEditPost} className="community-modal-body">
              {/* THÔNG TIN TÁC GIẢ BÀI VIẾT */}
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
                    <i className="bi bi-pencil-fill" /> Đang chỉnh sửa nội dung
                  </div>
                </div>
              </div>

              {/* CHỌN CHỦ ĐỀ CHO BÀI VIẾT */}
              <div className="modal-tag-selector">
                <label htmlFor="edit-post-tag-select">
                  <i className="bi bi-tag-fill" /> Chọn chủ đề bài viết:
                </label>
                <select
                  id="edit-post-tag-select"
                  value={editTag}
                  onChange={(e) => setEditTag(e.target.value)}
                  disabled={editSubmitting}
                >
                  {COMMUNITY_TAGS.filter((t) => t !== 'Tất cả').map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {/* NHẬP NỘI DUNG BÀI VIẾT */}
              <div className="modal-textarea-wrap">
                {/* Gợi ý gắn thẻ nhanh */}
                <div className="quick-mention-bar">
                  <span className="quick-mention-label">
                    <i className="bi bi-magic" /> Gợi ý gắn thẻ:
                  </span>
                  <div className="quick-mention-chips">
                    {COMMUNITY_TAGS.filter((t) => t !== 'Tất cả').map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="quick-mention-chip"
                        onClick={() => handleInsertEditQuickTag(tag)}
                        title={`Bấm để chèn @${tag}`}
                        disabled={editSubmitting}
                      >
                        <i className="bi bi-at" />{tag}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  ref={editTextareaRef}
                  rows={5}
                  placeholder="Cập nhật nội dung bài viết... Gõ @ để gắn thẻ thành viên hoặc chủ đề..."
                  value={editContent}
                  onChange={handleEditTextareaChange}
                  onKeyDown={handleEditTextareaKeyDown}
                  onClick={handleEditTextareaCursorMove}
                  onKeyUp={handleEditTextareaCursorMove}
                  disabled={editSubmitting}
                  autoFocus
                />

                {/* MENU GỢI Ý KHI GÕ @ TRONG EDIT MODAL */}
                {editShowMentionMenu && (
                  <div className="mention-dropdown-menu" ref={editMentionMenuRef}>
                    <div className="mention-dropdown-header">
                      <div className="mention-header-title">
                        <i className="bi bi-at" /> Gợi ý gắn thẻ {editMentionQuery ? `cho "${editMentionQuery}"` : ''}
                      </div>
                      <button
                        type="button"
                        className="mention-dropdown-close"
                        onClick={() => setEditShowMentionMenu(false)}
                        title="Đóng menu gợi ý (Esc)"
                      >
                        <i className="bi bi-x" />
                      </button>
                    </div>

                    <div className="mention-dropdown-body">
                      {filteredEditMentions.length === 0 ? (
                        <div className="mention-empty-hint">
                          <i className="bi bi-search" /> Không tìm thấy gợi ý phù hợp
                        </div>
                      ) : (
                        filteredEditMentions.map((item, index) => {
                          const isActive = index === editActiveMentionIndex
                          return (
                            <div
                              key={`${item.type}-${item.id}`}
                              className={`mention-item ${isActive ? 'is-active' : ''}`}
                              onMouseEnter={() => setEditActiveMentionIndex(index)}
                              onClick={() => handleSelectEditMention(item)}
                            >
                              {item.type === 'user' ? (
                                <div className="mention-avatar-wrap">
                                  {item.avatarUrl ? (
                                    <img
                                      src={resolveMediaUrl(item.avatarUrl)}
                                      alt={item.text}
                                      className="mention-avatar"
                                    />
                                  ) : (
                                    <div className="mention-avatar-fallback">
                                      {item.text.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div
                                  className="mention-tag-icon"
                                  style={{ backgroundColor: item.bg, color: item.color }}
                                >
                                  <i className={`bi ${item.icon}`} />
                                </div>
                              )}

                              <div className="mention-item-info">
                                <div className="mention-item-name">
                                  <span className="mention-item-at">@</span>
                                  <strong>{item.text}</strong>
                                  {item.role === 'admin' && (
                                    <span className="mention-badge-admin">Admin</span>
                                  )}
                                  {item.type === 'tag' && (
                                    <span className="mention-badge-tag">Chủ đề</span>
                                  )}
                                </div>
                                <div className="mention-item-sub">{item.subtitle}</div>
                              </div>

                              <div className="mention-item-enter-hint">
                                <i className="bi bi-arrow-return-left" />
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>

                    <div className="mention-dropdown-footer">
                      <span>
                        Dùng <strong>↑</strong> <strong>↓</strong> và <strong>Enter</strong> để chọn, <strong>Esc</strong> để thoát
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* HÌNH ẢNH MINH HỌA */}
              <div className="modal-media-section">
                {editImagePreviewUrl && !editRemoveImage ? (
                  <div className="modal-image-preview-box">
                    <img src={editImagePreviewUrl} alt="Xem trước ảnh minh họa" />
                    <button
                      type="button"
                      className="remove-image-btn"
                      onClick={handleRemoveEditImage}
                      title="Gỡ ảnh minh họa"
                      disabled={editSubmitting}
                    >
                      <i className="bi bi-x-circle-fill" />
                    </button>
                  </div>
                ) : (
                  <div
                    className="modal-upload-trigger"
                    onClick={() => editFileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleEditFileDrop}
                  >
                    <i className="bi bi-image" />
                    <div>
                      <strong>
                        {editRemoveImage
                          ? 'Đã gỡ ảnh — Nhấn để chọn ảnh mới nếu muốn'
                          : 'Thêm hình ảnh minh họa cho bài viết'}
                      </strong>
                      <small>Hỗ trợ định dạng JPG, PNG, WEBP tối đa 5MB</small>
                    </div>
                  </div>
                )}

                <input
                  ref={editFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  style={{ display: 'none' }}
                  onChange={handleEditFileSelected}
                  disabled={editSubmitting}
                />
              </div>

              {/* THÔNG BÁO LỖI INLINE NẾU CÓ */}
              {feedbackError && (
                <div className="modal-inline-error">
                  <i className="bi bi-exclamation-triangle-fill" />
                  <span>{feedbackError}</span>
                </div>
              )}

              {/* NÚT HÀNH ĐỘNG MODAL: HỦY VÀ LƯU THAY ĐỔI */}
              <div className="community-modal-footer">
                <button
                  type="button"
                  className="community-btn-secondary"
                  onClick={handleCancelEditPost}
                  disabled={editSubmitting}
                >
                  Hủy thao tác
                </button>
                <button
                  type="submit"
                  className="community-btn-primary"
                  disabled={editSubmitting || !editContent.trim()}
                >
                  {editSubmitting ? (
                    <>
                      <i className="bi bi-arrow-repeat spin" /> Đang lưu...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check2-circle" /> Lưu thay đổi
                    </>
                  )}
                </button>
              </div>
            </form>
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
