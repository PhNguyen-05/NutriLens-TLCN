import axiosInstance from '../../api/axiosInstance'

export const COMMUNITY_TAGS = [
  'Tất cả',
  'Công thức món ăn',
  'Kinh nghiệm dinh dưỡng',
  'Quá trình tập luyện',
  'Mẹo sức khỏe',
  'Hỏi đáp cộng đồng',
  'Chia sẻ chung',
]

export const REPORT_REASONS = [
  'Nội dung spam hoặc quảng cáo',
  'Nội dung không phù hợp / phản cảm',
  'Thông tin sai lệch / gây hiểu nhầm',
  'Ngôn ngữ thù địch / quấy rối',
  'Vi phạm quyền riêng tư',
  'Lý do khác',
]

export const TAG_COLOR_MAP = {
  'Công thức món ăn': { bg: '#e0f2fe', text: '#0284c7', icon: 'bi-egg-fried' },
  'Kinh nghiệm dinh dưỡng': { bg: '#ecfdf5', text: '#059669', icon: 'bi-journal-check' },
  'Quá trình tập luyện': { bg: '#fef3c7', text: '#d97706', icon: 'bi-lightning-charge' },
  'Mẹo sức khỏe': { bg: '#f3e8ff', text: '#9333ea', icon: 'bi-heart-pulse' },
  'Hỏi đáp cộng đồng': { bg: '#ffedd5', text: '#ea580c', icon: 'bi-question-circle' },
  'Chia sẻ chung': { bg: '#f1f5f9', text: '#475569', icon: 'bi-chat-quote' },
}

export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/**
 * Phục hồi URL media và tự động tối ưu hóa Cloudinary (f_auto, q_auto, w_800)
 */
export function resolveMediaUrl(value, options = {}) {
  const url = String(value || '').trim()
  if (!url) return null

  // Tự động tối ưu Cloudinary: resize và nén WebP/AVIF tự động
  if (url.includes('res.cloudinary.com') && url.includes('/upload/')) {
    const transform = options.transform || 'w_800,c_limit,f_auto,q_auto'
    if (!url.includes('/upload/w_') && !url.includes('/upload/c_')) {
      return url.replace('/upload/', `/upload/${transform}/`)
    }
    return url
  }

  if (/^(https?:|data:|blob:)/i.test(url)) return url
  const apiOrigin = String(axiosInstance.defaults.baseURL || '').replace(/\/api\/?$/, '')
  if (!apiOrigin) return url
  return url.startsWith('/') ? `${apiOrigin}${url}` : `${apiOrigin}/${url}`
}

/**
 * Định dạng thời gian tương đối thân thiện (VD: "Vừa xong", "15 phút trước")
 */
export function formatRelativeTime(dateInput) {
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

/**
 * Hàm chuẩn hóa tiếng Việt bỏ dấu để tìm kiếm gợi ý mượt mà
 */
export function normalizeVietnamese(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

/**
 * Định dạng nội dung bài viết: highlight các mention @NgườiDùng hoặc @ChủĐề hoặc #Hashtag
 */
export function renderFormattedContent(content, onTagClick) {
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
