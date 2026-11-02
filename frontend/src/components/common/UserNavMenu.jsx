import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '')

function resolveAvatarUrl(url) {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`
}

/**
 * Menu tài khoản (Avatar Dropdown) dùng chung trên toàn bộ header của ứng dụng.
 * Tự động đồng bộ các mục: Hồ sơ cá nhân, Theo dõi cân nặng & tiến trình, Đăng xuất.
 * Tự động đóng khi người dùng click ra ngoài.
 */
export default function UserNavMenu() {
  const { user, handleLogout } = useAuth()
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)
  const menuRef = useRef(null)

  const firstName = user?.fullName
    ? user.fullName.trim().split(/\s+/).slice(-1)[0]
    : 'bạn'

  // Tự động đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!user) return null

  return (
    <div className="profile-menu" ref={menuRef}>
      <button
        className="dashboard-avatar"
        onClick={() => setProfileOpen((prev) => !prev)}
        aria-expanded={profileOpen}
        aria-haspopup="menu"
        title="Mở menu tài khoản"
        type="button"
      >
        {user.avatarUrl ? (
          <img src={resolveAvatarUrl(user.avatarUrl)} alt="Ảnh đại diện" />
        ) : (
          firstName.charAt(0).toUpperCase()
        )}
      </button>

      {profileOpen && (
        <div className="profile-dropdown" role="menu">
          <div className="profile-name">Xin chào, {firstName}</div>
          <button
            className="profile-link"
            onClick={() => {
              setProfileOpen(false)
              navigate('/profile')
            }}
            role="menuitem"
            type="button"
          >
            <i className="bi bi-person-circle" /> Hồ sơ cá nhân &amp; Sức khỏe
          </button>
          <button
            className="profile-link"
            onClick={() => {
              setProfileOpen(false)
              navigate('/community?filter=mine')
            }}
            role="menuitem"
            type="button"
          >
            <i className="bi bi-journal-richtext" /> Bài đăng của tôi
          </button>
          <button
            onClick={() => {
              setProfileOpen(false)
              handleLogout()
            }}
            role="menuitem"
            type="button"
          >
            <i className="bi bi-box-arrow-right" /> Đăng xuất
          </button>
        </div>
      )}
    </div>
  )
}
