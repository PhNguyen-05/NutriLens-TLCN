import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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

const REPORT_REASONS = [
  'Nội dung spam hoặc quảng cáo',
  'Nội dung không phù hợp / phản cảm',
  'Thông tin sai lệch / gây hiểu nhầm',
  'Ngôn ngữ thù địch / quấy rối',
  'Vi phạm quyền riêng tư',
  'Lý do khác',
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

  // State chế độ bảng tin: 'all' (bảng tin chung), 'mine' (bài viết của tôi), hoặc 'author' (bài viết của thành viên khác)
  const [searchParams, setSearchParams] = useSearchParams()
  const authorIdParam = searchParams.get('authorId')
  const filterParam = searchParams.get('filter')
  const initialMode = authorIdParam ? 'author' : filterParam === 'mine' ? 'mine' : 'all'
  const [feedMode, setFeedMode] = useState(initialMode)
  const [myStats, setMyStats] = useState({ postsCount: 0, totalLikes: 0 })
  const [viewedAuthor, setViewedAuthor] = useState(null)

  // Sắp xếp bài viết: 'latest' (Mới nhất) | 'popular' (Thịnh hành / Nhiều tương tác nhất)
  const [sortBy, setSortBy] = useState('latest')
  const [topContributors, setTopContributors] = useState([])
  const [trendingRecipe, setTrendingRecipe] = useState(null)

  // State Modal Đăng bài (UC26)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [postContent, setPostContent] = useState('')
  const [postTag, setPostTag] = useState('Chia sẻ chung')
  const [selectedImageFile, setSelectedImageFile] = useState(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)

  // Thông số dinh dưỡng cho Modal Đăng bài (Đặc trưng NutriLens)
  const [showNutritionInputs, setShowNutritionInputs] = useState(false)
  const [nutrition, setNutrition] = useState({
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
  })

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

  // UC30: State modal báo cáo vi phạm bài đăng
  const [reportModal, setReportModal] = useState(null) // { postId }
  const [reportReason, setReportReason] = useState('')
  const [reportNote, setReportNote] = useState('')
  const [reportEvidenceFile, setReportEvidenceFile] = useState(null)
  const [reportEvidencePreview, setReportEvidencePreview] = useState(null)
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const reportFileInputRef = useRef(null)

  // State chỉnh sửa bài viết
  const [editingPost, setEditingPost] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [editTag, setEditTag] = useState('Chia sẻ chung')
  const [editSelectedImageFile, setEditSelectedImageFile] = useState(null)
  const [editImagePreviewUrl, setEditImagePreviewUrl] = useState('')
  const [editRemoveImage, setEditRemoveImage] = useState(false)
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editShowNutritionInputs, setEditShowNutritionInputs] = useState(false)
  const [editNutrition, setEditNutrition] = useState({
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
  })
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

  // Xem bài viết của một tác giả cụ thể (Option 1)
  function handleViewAuthorPosts(targetAuthor) {
    if (!targetAuthor) return
    const authorId = targetAuthor._id || targetAuthor.id

    // Nếu bấm vào chính mình thì chuyển sang "Bài viết của tôi"
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

  // Tải danh sách bài viết khi filter tag, search, feedMode hoặc authorId thay đổi
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

    const currentAuthorId = searchParams.get('authorId')
    if (currentAuthorId) {
      params.authorId = currentAuthorId
    } else if (feedMode === 'mine') {
      params.onlyMine = 'true'
    }

    if (sortBy) {
      params.sortBy = sortBy
    }

    axiosInstance
      .get('/community/posts', { params })
      .then(({ data }) => {
        if (!isActive) return
        setPosts(Array.isArray(data?.posts) ? data.posts : [])
        if (data?.myStats) {
          setMyStats(data.myStats)
        }
        if (data?.viewedAuthor) {
          setViewedAuthor(data.viewedAuthor)
        } else if (!currentAuthorId) {
          setViewedAuthor(null)
        }
        if (Array.isArray(data?.topContributors)) {
          setTopContributors(data.topContributors)
        }
        if (data?.trendingRecipe !== undefined) {
          setTrendingRecipe(data.trendingRecipe)
        }
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
  }, [selectedTag, activeSearch, feedMode, searchParams, sortBy])

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
    if (feedMode === 'author') {
      handleSwitchFeedMode('all')
    }
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
    setShowNutritionInputs(defaultTag === 'Công thức món ăn')
    setNutrition({ calories: '', protein: '', carbs: '', fat: '' })
    setIsModalOpen(true)
  }

  // Luồng thay thế 3a & 4a: Người dùng hủy thao tác đăng bài
  function handleCancelCreatePost() {
    setIsModalOpen(false)
    setPostContent('')
    setSelectedImageFile(null)
    setShowMentionMenu(false)
    setMentionQuery('')
    setShowNutritionInputs(false)
    setNutrition({ calories: '', protein: '', carbs: '', fat: '' })
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

      const hasNutrition = Boolean(
        nutrition.calories !== '' ||
        nutrition.protein !== '' ||
        nutrition.carbs !== '' ||
        nutrition.fat !== ''
      )
      if (hasNutrition) {
        formData.append(
          'nutrition',
          JSON.stringify({
            calories: nutrition.calories !== '' ? Number(nutrition.calories) : null,
            protein: nutrition.protein !== '' ? Number(nutrition.protein) : null,
            carbs: nutrition.carbs !== '' ? Number(nutrition.carbs) : null,
            fat: nutrition.fat !== '' ? Number(nutrition.fat) : null,
          })
        )
      }

      const { data } = await axiosInstance.post('/community/posts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      // Bước 10: Thông báo "Đăng bài thành công"
      setFeedbackSuccess(data.message || 'Đăng bài thành công')

      // Cập nhật ngay bài viết mới vào đầu danh sách Feed
      if (data.post) {
        setPosts((prev) => [data.post, ...prev])
        setMyStats((prev) => ({ ...prev, postsCount: (prev?.postsCount || 0) + 1 }))
      }

      // Đóng modal và dọn dẹp
      setIsModalOpen(false)
      setPostContent('')
      setSelectedImageFile(null)
      setShowMentionMenu(false)
      setMentionQuery('')
      setShowNutritionInputs(false)
      setNutrition({ calories: '', protein: '', carbs: '', fat: '' })
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

    const postNutr = post.nutrition || {}
    const hasNutr = Boolean(
      postNutr.calories != null ||
      postNutr.protein != null ||
      postNutr.carbs != null ||
      postNutr.fat != null
    )
    setEditNutrition({
      calories: postNutr.calories != null ? String(postNutr.calories) : '',
      protein: postNutr.protein != null ? String(postNutr.protein) : '',
      carbs: postNutr.carbs != null ? String(postNutr.carbs) : '',
      fat: postNutr.fat != null ? String(postNutr.fat) : '',
    })
    setEditShowNutritionInputs(hasNutr)
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
    setEditShowNutritionInputs(false)
    setEditNutrition({ calories: '', protein: '', carbs: '', fat: '' })
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

      const hasEditNutrition = Boolean(
        editNutrition.calories !== '' ||
        editNutrition.protein !== '' ||
        editNutrition.carbs !== '' ||
        editNutrition.fat !== ''
      )
      if (hasEditNutrition) {
        formData.append(
          'nutrition',
          JSON.stringify({
            calories: editNutrition.calories !== '' ? Number(editNutrition.calories) : null,
            protein: editNutrition.protein !== '' ? Number(editNutrition.protein) : null,
            carbs: editNutrition.carbs !== '' ? Number(editNutrition.carbs) : null,
            fat: editNutrition.fat !== '' ? Number(editNutrition.fat) : null,
          })
        )
      } else {
        formData.append(
          'nutrition',
          JSON.stringify({
            calories: null,
            protein: null,
            carbs: null,
            fat: null,
          })
        )
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
      setMyStats((prev) => ({ ...prev, postsCount: Math.max(0, (prev?.postsCount || 1) - 1) }))
      setFeedbackSuccess('Đã xóa bài viết thành công')
      setDeleteConfirmPost(null)
    } catch (err) {
      console.error('[CommunityPage] Lỗi xóa bài:', err)
      const msg = err.response?.data?.message
      if (err.response?.status === 404) {
        setFeedbackError(msg || 'Bài đăng không còn tồn tại')
        setPosts((prev) => prev.filter((p) => p._id !== deleteConfirmPost._id))
        setDeleteConfirmPost(null)
      } else {
        setFeedbackError(msg || 'Không thể xóa bài viết, vui lòng thử lại')
      }
    } finally {
      setDeletePostSubmitting(false)
    }
  }

  // --- UC30: BÁO CÁO VI PHẠM BÀI ĐĂNG ---
  function handleOpenReportModal(postId) {
    setReportModal({ postId })
    setReportReason('')
    setReportNote('')
    setReportEvidenceFile(null)
    setReportEvidencePreview(null)
  }

  function handleCloseReportModal() {
    setReportModal(null)
    setReportReason('')
    setReportNote('')
    setReportEvidenceFile(null)
    if (reportEvidencePreview) {
      URL.revokeObjectURL(reportEvidencePreview)
    }
    setReportEvidencePreview(null)
  }

  function handleSelectReportEvidence(e) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setFeedbackError('Vui lòng chọn tệp hình ảnh hợp lệ (JPG, PNG, WEBP...)')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setFeedbackError('Dung lượng ảnh bằng chứng không được vượt quá 5MB')
      return
    }

    if (reportEvidencePreview) {
      URL.revokeObjectURL(reportEvidencePreview)
    }

    setReportEvidenceFile(file)
    setReportEvidencePreview(URL.createObjectURL(file))
    e.target.value = ''
  }

  function handleRemoveReportEvidence() {
    setReportEvidenceFile(null)
    if (reportEvidencePreview) {
      URL.revokeObjectURL(reportEvidencePreview)
    }
    setReportEvidencePreview(null)
  }

  async function handleSubmitReport() {
    if (!reportModal) return

    if (!reportReason) {
      setFeedbackError('Vui lòng chọn lý do báo cáo')
      return
    }

    setReportSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('reason', reportReason)
      if (reportNote) formData.append('note', reportNote)
      if (reportEvidenceFile) {
        formData.append('evidenceImage', reportEvidenceFile)
      }

      await axiosInstance.post(`/community/posts/${reportModal.postId}/report`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      // Cập nhật ngay trạng thái isReported trên giao diện
      setPosts((prev) =>
        prev.map((p) => (p._id === reportModal.postId ? { ...p, isReported: true } : p))
      )
      handleCloseReportModal()
      setFeedbackSuccess('Báo cáo thành công')
    } catch (err) {
      console.error('[CommunityPage] Lỗi báo cáo bài viết:', err)
      const status = err.response?.status
      const msg = err.response?.data?.message
      if (status === 409) {
        setFeedbackError(msg || 'Bạn đã báo cáo bài đăng này')
        setPosts((prev) =>
          prev.map((p) => (p._id === reportModal.postId ? { ...p, isReported: true } : p))
        )
        handleCloseReportModal()
      } else if (status === 400) {
        setFeedbackError(msg || 'Vui lòng chọn lý do báo cáo')
      } else if (status === 404) {
        setFeedbackError(msg || 'Bài đăng không còn tồn tại')
        handleCloseReportModal()
      } else {
        setFeedbackError(msg || 'Không thể gửi báo cáo, vui lòng thử lại')
      }
    } finally {
      setReportSubmitting(false)
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

              {/* THỐNG KÊ BÀI ĐĂNG CÁ NHÂN & NÚT XEM LẠI */}
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
                  title="Tổng số lượt thích bạn nhận được trên tất cả bài viết"
                >
                  <strong>{myStats.totalLikes}</strong>
                  <span>Lượt thích</span>
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

          {/* CỘT GIỮA: FEED BÀI VIẾT FACEBOOK-STYLE */}
          <section className="community-col-feed">
            {/* TABS CHUYỂN ĐỔI: BẢNG TIN CHUNG VS BÀI VIẾT CỦA TÔI / TÁC GIẢ */}
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

              {/* BỘ LỌC PHÂN LOẠI HIỂN THỊ (SORT CONTROLS) */}
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

            {/* BANNER THÔNG TIN KHI ĐANG XEM BÀI VIẾT CỦA TÔI */}
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
                      <strong>{myStats.totalLikes} lượt thích</strong> từ cộng đồng NutriLens.
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

            {/* BANNER THÔNG TIN KHI ĐANG XEM BÀI VIẾT CỦA THÀNH VIÊN KHÁC (CÁCH 1) */}
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
                        <i className="bi bi-heart-fill" style={{ color: '#ef4444' }} /> <strong>{viewedAuthor.totalLikes ?? 0}</strong> lượt thích
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
                ) : feedMode === 'author' && viewedAuthor ? (
                  <>
                    <i
                      className="bi bi-person-x"
                      style={{ fontSize: '46px', color: '#94a3b8', marginBottom: '12px', display: 'inline-block' }}
                    />
                    <h3>{viewedAuthor.fullName || 'Thành viên'} chưa có bài viết nào</h3>
                    <p>
                      Thành viên này hiện chưa đăng tải bài viết hoặc công thức nào lên cộng đồng NutriLens.
                    </p>
                    <div className="empty-actions-wrap">
                      <button
                        type="button"
                        className="community-btn-primary"
                        onClick={() => handleSwitchFeedMode('all')}
                      >
                        <i className="bi bi-globe2" /> Quay lại Bảng tin chung
                      </button>
                    </div>
                  </>
                ) : feedMode === 'mine' ? (
                  <>
                    <i
                      className="bi bi-journal-plus"
                      style={{ fontSize: '46px', color: '#059669', marginBottom: '12px', display: 'inline-block' }}
                    />
                    <h3>Bạn chưa đăng bài viết nào</h3>
                    <p>
                      Hãy chia sẻ công thức ăn uống lành mạnh, thực đơn calo hoặc hành trình tập luyện đầu tiên của bạn với cộng đồng!
                    </p>
                    <div className="empty-actions-wrap">
                      <button
                        type="button"
                        className="community-btn-primary"
                        onClick={() => handleOpenCreateModal('Chia sẻ chung')}
                      >
                        <i className="bi bi-pencil-square" /> Tạo bài viết đầu tiên ngay
                      </button>
                      <button
                        type="button"
                        className="community-btn-secondary"
                        onClick={() => handleSwitchFeedMode('all')}
                      >
                        <i className="bi bi-globe2" /> Khám phá bảng tin chung
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
                              className="avatar-sm post-author-avatar-clickable"
                              onClick={() => handleViewAuthorPosts(author)}
                              title={`Xem các bài viết của ${author.fullName || 'thành viên'}`}
                            />
                          ) : (
                            <div
                              className="avatar-sm-fallback post-author-avatar-clickable"
                              onClick={() => handleViewAuthorPosts(author)}
                              title={`Xem các bài viết của ${author.fullName || 'thành viên'}`}
                            >
                              {authorInitial}
                            </div>
                          )}

                          <div className="post-author-info">
                            <div className="post-author-name-row">
                              <strong
                                className="post-author-name-clickable"
                                onClick={() => handleViewAuthorPosts(author)}
                                title={`Xem các bài viết của ${author.fullName || 'thành viên'}`}
                              >
                                {author.fullName || 'Thành viên'}
                              </strong>
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

                              {/* UC36: Trạng thái bài đăng cá nhân (Công khai / Đã bị ẩn) */}
                              {(feedMode === 'mine' || isAuthor) && post.status === 'hidden' && (
                                <span
                                  className="post-status-badge post-status-hidden"
                                  style={{
                                    backgroundColor: '#fee2e2',
                                    color: '#b91c1c',
                                    border: '1px solid #fca5a5',
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                  title="Bài viết đã bị quản trị viên ẩn do vi phạm quy định"
                                >
                                  <i className="bi bi-eye-slash-fill" /> Đã bị ẩn
                                </span>
                              )}
                              {(feedMode === 'mine' || isAuthor) && post.status === 'published' && (
                                <span
                                  className="post-status-badge post-status-published"
                                  style={{
                                    backgroundColor: '#ecfdf5',
                                    color: '#047857',
                                    border: '1px solid #a7f3d0',
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                  title="Bài viết hiển thị công khai trên cộng đồng"
                                >
                                  <i className="bi bi-check-circle-fill" /> Công khai
                                </span>
                              )}
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

                        {/* HUY HIỆU DINH DƯỠNG / MACRO PILL ĐẶC TRƯNG NUTRILENS */}
                        {post.nutrition &&
                          (post.nutrition.calories != null ||
                            post.nutrition.protein != null ||
                            post.nutrition.carbs != null ||
                            post.nutrition.fat != null) && (
                            <div className="post-macro-pill-bar" title="Thông số dinh dưỡng của món ăn">
                              <span className="macro-tag macro-tag-badge">
                                <i className="bi bi-shield-check" /> Dinh dưỡng
                              </span>
                              {post.nutrition.calories != null && (
                                <span className="macro-tag macro-cal">
                                  <i className="bi bi-fire" /> <strong>{post.nutrition.calories}</strong> kcal
                                </span>
                              )}
                              {post.nutrition.protein != null && (
                                <span className="macro-tag macro-pro">
                                  🥩 <strong>{post.nutrition.protein}g</strong> Protein
                                </span>
                              )}
                              {post.nutrition.carbs != null && (
                                <span className="macro-tag macro-carb">
                                  🍚 <strong>{post.nutrition.carbs}g</strong> Carbs
                                </span>
                              )}
                              {post.nutrition.fat != null && (
                                <span className="macro-tag macro-fat">
                                  🥑 <strong>{post.nutrition.fat}g</strong> Fat
                                </span>
                              )}
                            </div>
                          )}
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

                        {/* UC30: Nút báo cáo vi phạm - chỉ hiển thị khi không phải chủ bài viết */}
                        {user && !isAuthor && (
                          post.isReported ? (
                            <button
                              type="button"
                              className="post-footer-btn post-footer-btn--reported"
                              disabled
                              title="Bạn đã gửi báo cáo bài đăng này cho quản trị viên"
                              style={{
                                color: '#ea580c',
                                cursor: 'default',
                                background: '#fff7ed',
                                fontWeight: 700,
                              }}
                            >
                              <i className="bi bi-flag-fill" style={{ color: '#ea580c' }} />
                              <span>Đã báo cáo</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="post-footer-btn post-footer-btn--report"
                              onClick={() => handleOpenReportModal(post._id)}
                              title="Báo cáo bài đăng vi phạm"
                            >
                              <i className="bi bi-flag" />
                              <span>Báo cáo</span>
                            </button>
                          )
                        )}
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
                                        className="avatar-xs post-author-avatar-clickable"
                                        onClick={() => handleViewAuthorPosts(cAuthor)}
                                        title={`Xem các bài viết của ${cAuthor.fullName || 'thành viên'}`}
                                      />
                                    ) : (
                                      <div
                                        className="avatar-xs-fallback post-author-avatar-clickable"
                                        onClick={() => handleViewAuthorPosts(cAuthor)}
                                        title={`Xem các bài viết của ${cAuthor.fullName || 'thành viên'}`}
                                      >
                                        {cInitial}
                                      </div>
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
                                          <div
                                            className="comment-author-name comment-author-name-clickable"
                                            onClick={() => handleViewAuthorPosts(cAuthor)}
                                            title={`Xem các bài viết của ${cAuthor.fullName || 'thành viên'}`}
                                          >
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

            {/* GỢI Ý B: BẢNG VINH DANH THÀNH VIÊN TÍCH CỰC (TOP CONTRIBUTORS) */}
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
                        onClick={() => handleViewAuthorPosts(c)}
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

            {/* GỢI Ý C: MÓN ĂN ĐƯỢC YÊU THÍCH NHẤT TUẦN (TRENDING RECIPE OF THE WEEK) */}
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
                      handleViewAuthorPosts(trendingRecipe.authorId)
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
                    <span className="trending-recipe-likes">
                      <i className="bi bi-heart-fill" />{' '}
                      {trendingRecipe.likeCount || (trendingRecipe.likes ? trendingRecipe.likes.length : 0)}
                    </span>
                  </div>
                </div>
              </div>
            )}
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

              {/* ĐÍNH KÈM THÔNG SỐ DINH DƯỠNG (TÙY CHỌN - ĐẶC TRƯNG NUTRILENS) */}
              {!showNutritionInputs ? (
                <button
                  type="button"
                  className="nutrition-toggle-btn"
                  onClick={() => setShowNutritionInputs(true)}
                >
                  <i className="bi bi-shield-check" />
                  <span>Đính kèm thông số dinh dưỡng (Calo, Protein, Carbs, Fat)</span>
                </button>
              ) : (
                <div className="nutrition-fields-panel">
                  <div className="nutrition-fields-header">
                    <span>
                      <i className="bi bi-fire" /> Thông số dinh dưỡng món ăn (Tùy chọn)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNutritionInputs(false)
                        setNutrition({ calories: '', protein: '', carbs: '', fat: '' })
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <i className="bi bi-x-lg" /> Bỏ đính kèm
                    </button>
                  </div>
                  <div className="nutrition-grid">
                    <div className="nutrition-input-col">
                      <label htmlFor="create-calories">
                        <i className="bi bi-fire" style={{ color: '#ea580c' }} /> Calo (kcal)
                      </label>
                      <input
                        id="create-calories"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="VD: 420"
                        value={nutrition.calories}
                        onChange={(e) => setNutrition((prev) => ({ ...prev, calories: e.target.value }))}
                      />
                    </div>
                    <div className="nutrition-input-col">
                      <label htmlFor="create-protein">🥩 Protein (g)</label>
                      <input
                        id="create-protein"
                        type="number"
                        min="0"
                        step="0.5"
                        placeholder="VD: 35"
                        value={nutrition.protein}
                        onChange={(e) => setNutrition((prev) => ({ ...prev, protein: e.target.value }))}
                      />
                    </div>
                    <div className="nutrition-input-col">
                      <label htmlFor="create-carbs">🍚 Carbs (g)</label>
                      <input
                        id="create-carbs"
                        type="number"
                        min="0"
                        step="0.5"
                        placeholder="VD: 40"
                        value={nutrition.carbs}
                        onChange={(e) => setNutrition((prev) => ({ ...prev, carbs: e.target.value }))}
                      />
                    </div>
                    <div className="nutrition-input-col">
                      <label htmlFor="create-fat">🥑 Fat (g)</label>
                      <input
                        id="create-fat"
                        type="number"
                        min="0"
                        step="0.5"
                        placeholder="VD: 12"
                        value={nutrition.fat}
                        onChange={(e) => setNutrition((prev) => ({ ...prev, fat: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}

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

              {/* ĐÍNH KÈM THÔNG SỐ DINH DƯỠNG TRONG MODAL CHỈNH SỬA */}
              {!editShowNutritionInputs ? (
                <button
                  type="button"
                  className="nutrition-toggle-btn"
                  onClick={() => setEditShowNutritionInputs(true)}
                  disabled={editSubmitting}
                >
                  <i className="bi bi-shield-check" />
                  <span>Đính kèm thông số dinh dưỡng (Calo, Protein, Carbs, Fat)</span>
                </button>
              ) : (
                <div className="nutrition-fields-panel">
                  <div className="nutrition-fields-header">
                    <span>
                      <i className="bi bi-fire" /> Thông số dinh dưỡng món ăn (Tùy chọn)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditShowNutritionInputs(false)
                        setEditNutrition({ calories: '', protein: '', carbs: '', fat: '' })
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        cursor: 'pointer',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                      disabled={editSubmitting}
                    >
                      <i className="bi bi-x-lg" /> Bỏ đính kèm
                    </button>
                  </div>
                  <div className="nutrition-grid">
                    <div className="nutrition-input-col">
                      <label htmlFor="edit-calories">
                        <i className="bi bi-fire" style={{ color: '#ea580c' }} /> Calo (kcal)
                      </label>
                      <input
                        id="edit-calories"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="VD: 420"
                        value={editNutrition.calories}
                        onChange={(e) => setEditNutrition((prev) => ({ ...prev, calories: e.target.value }))}
                        disabled={editSubmitting}
                      />
                    </div>
                    <div className="nutrition-input-col">
                      <label htmlFor="edit-protein">🥩 Protein (g)</label>
                      <input
                        id="edit-protein"
                        type="number"
                        min="0"
                        step="0.5"
                        placeholder="VD: 35"
                        value={editNutrition.protein}
                        onChange={(e) => setEditNutrition((prev) => ({ ...prev, protein: e.target.value }))}
                        disabled={editSubmitting}
                      />
                    </div>
                    <div className="nutrition-input-col">
                      <label htmlFor="edit-carbs">🍚 Carbs (g)</label>
                      <input
                        id="edit-carbs"
                        type="number"
                        min="0"
                        step="0.5"
                        placeholder="VD: 40"
                        value={editNutrition.carbs}
                        onChange={(e) => setEditNutrition((prev) => ({ ...prev, carbs: e.target.value }))}
                        disabled={editSubmitting}
                      />
                    </div>
                    <div className="nutrition-input-col">
                      <label htmlFor="edit-fat">🥑 Fat (g)</label>
                      <input
                        id="edit-fat"
                        type="number"
                        min="0"
                        step="0.5"
                        placeholder="VD: 12"
                        value={editNutrition.fat}
                        onChange={(e) => setEditNutrition((prev) => ({ ...prev, fat: e.target.value }))}
                        disabled={editSubmitting}
                      />
                    </div>
                  </div>
                </div>
              )}

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

      {/* UC30: MODAL BÁO CÁO VI PHẠM BÀI ĐĂNG */}
      {reportModal && (
        <div
          className="community-modal-backdrop"
          onClick={() => !reportSubmitting && handleCloseReportModal()}
        >
          <div
            className="community-modal"
            style={{
              maxWidth: '480px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-report-post-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="community-modal-header" style={{ flexShrink: 0 }}>
              <h3 id="modal-report-post-title">
                <i className="bi bi-flag-fill" style={{ color: '#ea580c', marginRight: '8px' }} />
                Báo cáo vi phạm bài đăng
              </h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseReportModal}
                title="Đóng"
                disabled={reportSubmitting}
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <div
              className="community-modal-body"
              style={{
                overflowY: 'auto',
                flex: 1,
                padding: '16px 20px',
              }}
            >
              <p style={{ fontSize: '13px', color: '#475569', marginBottom: '10px', lineHeight: 1.4 }}>
                Vui lòng chọn lý do bài đăng này vi phạm tiêu chuẩn cộng đồng để quản trị viên kiểm duyệt:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                {REPORT_REASONS.map((reason) => (
                  <label
                    key={reason}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: reportReason === reason ? '1.5px solid #ea580c' : '1px solid #e2e8f0',
                      background: reportReason === reason ? '#fff7ed' : '#fff',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: reportReason === reason ? '#9a3412' : '#334155',
                      fontWeight: reportReason === reason ? 600 : 400,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      value={reason}
                      checked={reportReason === reason}
                      onChange={(e) => setReportReason(e.target.value)}
                      disabled={reportSubmitting}
                      style={{ accentColor: '#ea580c' }}
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label
                  htmlFor="report-note-input"
                  style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}
                >
                  Ghi chú chi tiết (không bắt buộc):
                </label>
                <textarea
                  id="report-note-input"
                  value={reportNote}
                  onChange={(e) => setReportNote(e.target.value)}
                  placeholder="Mô tả cụ thể vi phạm nếu có..."
                  maxLength={500}
                  rows={2}
                  disabled={reportSubmitting}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    color: '#1e293b',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* CUNG CẤP BẰNG CHỨNG VI PHẠM BẰNG HÌNH ẢNH (THU NHỎ GỌN GÀNG) */}
              <div style={{ marginBottom: '10px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '4px',
                  }}
                >
                  <i className="bi bi-image" style={{ marginRight: '6px', color: '#0284c7' }} />
                  Bằng chứng vi phạm bằng hình ảnh:
                </label>

                {reportEvidencePreview ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                    }}
                  >
                    <div
                      style={{
                        position: 'relative',
                        width: '56px',
                        height: '56px',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        border: '1px solid #e2e8f0',
                        flexShrink: 0,
                        background: '#fff',
                        cursor: 'pointer',
                      }}
                      onClick={() => setLightboxImage(reportEvidencePreview)}
                      title="Nhấn để xem ảnh phóng to"
                    >
                      <img
                        src={reportEvidencePreview}
                        alt="Ảnh bằng chứng vi phạm"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '12.5px',
                          fontWeight: 600,
                          color: '#1e293b',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {reportEvidenceFile?.name || 'Ảnh bằng chứng'}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        {reportEvidenceFile ? `${(reportEvidenceFile.size / 1024).toFixed(0)} KB` : 'Đã đính kèm'} · Nhấn ảnh để phóng to
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleRemoveReportEvidence}
                      disabled={reportSubmitting}
                      style={{
                        padding: '4px 8px',
                        background: '#fee2e2',
                        color: '#dc2626',
                        border: '1px solid #fca5a5',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        flexShrink: 0,
                      }}
                      title="Gỡ ảnh này"
                    >
                      <i className="bi bi-trash" /> Gỡ ảnh
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      ref={reportFileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleSelectReportEvidence}
                      disabled={reportSubmitting}
                    />
                    <button
                      type="button"
                      onClick={() => reportFileInputRef.current?.click()}
                      disabled={reportSubmitting}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: '1px dashed #0284c7',
                        background: '#f0f9ff',
                        color: '#0369a1',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <i className="bi bi-cloud-arrow-up" style={{ fontSize: '15px' }} />
                      <span>Đính kèm ảnh bằng chứng (JPG, PNG, tối đa 5MB)</span>
                    </button>
                  </div>
                )}
              </div>

              <div
                className="community-modal-footer"
                style={{
                  flexShrink: 0,
                  marginTop: '14px',
                  paddingTop: '10px',
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <button
                  type="button"
                  className="community-btn-secondary"
                  onClick={handleCloseReportModal}
                  disabled={reportSubmitting}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="community-btn-primary"
                  onClick={handleSubmitReport}
                  disabled={reportSubmitting}
                  style={{ background: '#ea580c', borderColor: '#ea580c' }}
                >
                  {reportSubmitting ? (
                    <>
                      <i className="bi bi-arrow-repeat spin" /> Đang gửi...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-send-fill" /> Gửi báo cáo
                    </>
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
