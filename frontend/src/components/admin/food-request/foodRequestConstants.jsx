import axiosInstance from '../../../api/axiosInstance'

export const PAGE_SIZE = 10

export const DEFAULT_FOOD_GROUPS = [
  'Cơm & Xôi',
  'Bún, Mì & Phở',
  'Bánh mì & Sandwich',
  'Bánh truyền thống & Dimsum',
  'Món thịt, cá & Hải sản',
  'Canh, Cháo & Súp',
  'Rau, Gỏi & Salad',
  'Ăn vặt & Đường phố',
  'Tráng miệng & Chè',
  'Đồ uống & Giải khát',
  'Khác',
]

export const QUICK_REJECT_REASONS = [
  'Món ăn đã có sẵn trong danh mục chính thức',
  'Hình ảnh không rõ ràng hoặc không phù hợp',
  'Thông tin dinh dưỡng chưa chính xác hoặc thiếu cơ sở kiểm chứng',
  'Tên món ăn hoặc đơn vị định lượng không hợp lệ',
  'Món ăn trùng lặp với một yêu cầu đã được duyệt trước đó',
]

export function getImageUrl(url) {
  if (!url) return ''
  if (/^(https?:|data:|blob:)/i.test(url)) return url
  const base = axiosInstance.defaults?.baseURL || ''
  return `${base.replace(/\/api\/?$/, '')}${url}`
}

export function formatDateDisplay(dateValue) {
  if (!dateValue) return 'N/A'
  try {
    const d = new Date(dateValue)
    if (isNaN(d.getTime())) return String(dateValue)
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return String(dateValue)
  }
}

export function Toast({ message, type, onClose }) {
  if (!message) return null
  return (
    <div
      className={`frm-toast ${type === 'error' ? 'frm-toast--error' : 'frm-toast--success'}`}
      role="alert"
    >
      <i
        className={`bi ${
          type === 'error' ? 'bi-exclamation-circle-fill' : 'bi-check-circle-fill'
        }`}
      />
      <span>{message}</span>
      <button type="button" onClick={onClose} aria-label="Đóng thông báo">
        <i className="bi bi-x-lg" />
      </button>
    </div>
  )
}
