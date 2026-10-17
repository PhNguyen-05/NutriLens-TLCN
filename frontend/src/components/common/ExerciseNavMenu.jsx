import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'

const exerciseMenuItems = [
  {
    to: '/exercise?tab=catalog',
    tab: 'catalog',
    icon: 'bi-journal-plus',
    title: 'Danh mục bài tập',
    description: 'Tra cứu bài tập, tính calo & ghi nhận buổi tập',
  },
  {
    to: '/exercise?tab=history',
    tab: 'history',
    icon: 'bi-clock-history',
    title: 'Lịch sử tập luyện',
    description: 'Xem lại, chỉnh sửa và quản lý lịch sử bài tập',
  },
]

export default function ExerciseNavMenu() {
  const { pathname, search } = useLocation()
  const isExercise = pathname === '/exercise'
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  // Đóng menu khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Đóng menu ngay lập tức khi click bất kỳ mục nào
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
        className={`food-nav-trigger${isExercise ? ' active' : ''}`}
        to="/exercise"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        Luyện tập
      </Link>
      <div
        className="food-nav-dropdown"
        role="group"
        aria-label="Các chức năng Luyện tập"
        style={{ display: isOpen ? 'grid' : 'none' }}
      >
        {exerciseMenuItems.map(({ to, icon, title, description, tab }) => {
          const isActive = isExercise && (
            (tab === 'catalog' && (!search || search.includes('tab=catalog'))) ||
            (tab === 'history' && search.includes('tab=history'))
          )
          return (
            <Link
              className={`food-nav-dropdown-item${isActive ? ' active' : ''}`}
              key={to}
              to={to}
              onClick={handleItemClick}
            >
              <i className={`bi ${icon}`} aria-hidden="true" />
              <span><strong>{title}</strong><small>{description}</small></span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
