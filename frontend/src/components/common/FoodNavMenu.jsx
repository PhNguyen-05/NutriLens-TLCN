import { useState, useRef, useEffect } from 'react'
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
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleItemClick = () => {
    setIsOpen(false)
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur()
    }
  }

  return (
    <div
      ref={menuRef}
      className={`food-nav-menu ${isOpen ? 'is-open' : 'is-closed'}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <Link
        className={`food-nav-trigger${isFoodSection ? ' active' : ''}`}
        to="/food-scan"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        Nhận diện &amp; Đồ ăn
      </Link>
      <div
        className="food-nav-dropdown"
        role="group"
        aria-label="Các trang Nhận diện và Đồ ăn"
        style={{ display: isOpen ? 'grid' : 'none' }}
      >
        {foodMenuItems.map(({ to, icon, title, description }) => (
          <Link
            className={`food-nav-dropdown-item${pathname === to ? ' active' : ''}`}
            key={to}
            to={to}
            onClick={handleItemClick}
          >
            <i className={`bi ${icon}`} aria-hidden="true" />
            <span><strong>{title}</strong><small>{description}</small></span>
          </Link>
        ))}
      </div>
    </div>
  )
}
