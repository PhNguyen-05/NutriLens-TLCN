import { Link, useLocation } from 'react-router-dom'

const foodRoutes = ['/food-scan', '/meal-diary', '/food-request', '/food-requests']

const foodMenuItems = [
  { to: '/food-scan', icon: 'bi-camera', title: 'Nhận diện món ăn', description: 'Chụp ảnh bằng camera hoặc tải ảnh lên' },
  { to: '/meal-diary', icon: 'bi-book', title: 'Nhật ký bữa ăn', description: 'Xem, sửa và xóa món đã ghi nhận' },
  { to: '/food-request', icon: 'bi-plus-circle', title: 'Yêu cầu bổ sung món ăn', description: 'Gửi món chưa có trong danh mục' },
  { to: '/food-requests', icon: 'bi-clipboard-check', title: 'Yêu cầu bổ sung của tôi', description: 'Theo dõi trạng thái và kết quả duyệt' },
]

export default function FoodNavMenu() {
  const { pathname } = useLocation()
  const isFoodSection = foodRoutes.includes(pathname)

  return (
    <div className="food-nav-menu">
      <Link className={`food-nav-trigger${isFoodSection ? ' active' : ''}`} to="/food-scan">
        Nhận diện &amp; Đồ ăn
      </Link>
      <div className="food-nav-dropdown" role="group" aria-label="Các trang Nhận diện và Đồ ăn">
        {foodMenuItems.map(({ to, icon, title, description }) => (
          <Link className={`food-nav-dropdown-item${pathname === to ? ' active' : ''}`} key={to} to={to}>
            <i className={`bi ${icon}`} aria-hidden="true" />
            <span><strong>{title}</strong><small>{description}</small></span>
          </Link>
        ))}
      </div>
    </div>
  )
}
