import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import axiosInstance from '../../api/axiosInstance'
import { useAuth } from '../../hooks/useAuth'
import './NotificationBell.css'

function formatTimeAgoVi(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''

  const now = new Date()
  const diffInSeconds = Math.floor((now - date) / 1000)

  if (diffInSeconds < 60) return 'Vừa xong'
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) return `${diffInMinutes} phút trước`
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours} giờ trước`
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) return `${diffInDays} ngày trước`

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  })
}

function getNotificationMeta(type) {
  switch (type) {
    case 'food_request_approved':
      return {
        icon: 'bi-check-circle-fill',
        wrapperClass: 'type-success',
        tag: 'Duyệt món',
      }
    case 'food_request_rejected':
      return {
        icon: 'bi-x-circle-fill',
        wrapperClass: 'type-danger',
        tag: 'Từ chối',
      }
    case 'reminder':
    case 'meal_reminder':
      return {
        icon: 'bi-alarm-fill',
        wrapperClass: 'type-warning',
        tag: 'Nhắc nhở',
      }
    case 'water_reminder':
      return {
        icon: 'bi-droplet-fill',
        wrapperClass: 'type-info',
        tag: 'Uống nước',
      }
    case 'community':
    case 'community_post_approved':
      return {
        icon: 'bi-chat-heart-fill',
        wrapperClass: 'type-community',
        tag: 'Cộng đồng',
      }
    case 'system':
    default:
      return {
        icon: 'bi-info-circle-fill',
        wrapperClass: 'type-primary',
        tag: 'Hệ thống',
      }
  }
}

export default function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const bellRef = useRef(null)

  // Tải số lượng chưa đọc
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return
    try {
      const res = await axiosInstance.get('/notifications/unread-count')
      if (res.data?.success) {
        setUnreadCount(Number(res.data.unreadCount) || 0)
      }
    } catch {
      // Bỏ qua lỗi ngầm
    }
  }, [user])

  // Tải toàn bộ danh sách thông báo
  const fetchNotifications = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const res = await axiosInstance.get('/notifications', {
        params: { limit: 30 },
      })
      if (res.data?.success) {
        setNotifications(Array.isArray(res.data.data) ? res.data.data : [])
        if (typeof res.data.unreadCount === 'number') {
          setUnreadCount(res.data.unreadCount)
        }
      }
    } catch (err) {
      console.error('Lỗi khi tải thông báo:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  // Định kỳ tải unread count (mỗi 45s) & khi focus lại tab
  useEffect(() => {
    let ignore = false

    async function loadInitialCount() {
      if (!user) return
      try {
        const res = await axiosInstance.get('/notifications/unread-count')
        if (!ignore && res.data?.success) {
          setUnreadCount(Number(res.data.unreadCount) || 0)
        }
      } catch {
        // Bỏ qua lỗi ngầm
      }
    }

    loadInitialCount()
    const interval = setInterval(() => {
      if (!ignore) fetchUnreadCount()
    }, 45_000)

    const handleFocus = () => {
      if (!ignore) fetchUnreadCount()
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      ignore = true
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [user, fetchUnreadCount])

  // Đóng khi click ngoài hoặc bấm phím Escape
  useEffect(() => {
    function handleClickOutside(event) {
      if (bellRef.current && !bellRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleToggleOpen = () => {
    setIsOpen((prev) => {
      const next = !prev
      if (next) {
        fetchNotifications()
      }
      return next
    })
  }

  // Đánh dấu 1 thông báo là đã đọc
  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation()
    try {
      const res = await axiosInstance.patch(`/notifications/${id}/read`)
      if (res.data?.success) {
        setNotifications((prev) =>
          prev.map((item) => (item._id === id ? { ...item, isRead: true } : item))
        )
        if (typeof res.data.unreadCount === 'number') {
          setUnreadCount(res.data.unreadCount)
        } else {
          setUnreadCount((c) => Math.max(0, c - 1))
        }
      }
    } catch (err) {
      console.error('Không thể đánh dấu đã đọc:', err)
    }
  }

  // Đánh dấu tất cả là đã đọc
  const handleMarkAllAsRead = async () => {
    try {
      const res = await axiosInstance.patch('/notifications/read-all')
      if (res.data?.success) {
        setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })))
        setUnreadCount(0)
      }
    } catch (err) {
      console.error('Không thể đánh dấu tất cả đã đọc:', err)
    }
  }

  // Xóa 1 thông báo
  const handleDeleteNotification = async (id, e) => {
    if (e) e.stopPropagation()
    try {
      const res = await axiosInstance.delete(`/notifications/${id}`)
      if (res.data?.success) {
        setNotifications((prev) => prev.filter((item) => item._id !== id))
        if (typeof res.data.unreadCount === 'number') {
          setUnreadCount(res.data.unreadCount)
        }
      }
    } catch (err) {
      console.error('Không thể xóa thông báo:', err)
    }
  }

  // Xóa tất cả thông báo
  const handleClearAll = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa toàn bộ thông báo không?')) return
    try {
      const res = await axiosInstance.delete('/notifications/clear-all')
      if (res.data?.success) {
        setNotifications([])
        setUnreadCount(0)
      }
    } catch (err) {
      console.error('Không thể xóa toàn bộ thông báo:', err)
    }
  }

  // Click vào thông báo để chuyển hướng hoặc xem
  const handleItemClick = (item) => {
    if (!item.isRead) {
      handleMarkAsRead(item._id)
    }
    setIsOpen(false)

    // Nếu thông báo có link điều hướng
    if (item.data?.link) {
      navigate(item.data.link)
    } else if (item.data?.foodId) {
      navigate('/food-scan')
    }
  }

  return (
    <div className="notification-wrapper" ref={bellRef}>
      <button
        className={`dashboard-bell dashboard-bell-btn ${isOpen ? 'is-active' : ''} ${
          unreadCount > 0 ? 'has-unread' : ''
        }`}
        type="button"
        aria-label="Thông báo"
        aria-expanded={isOpen}
        aria-haspopup="true"
        title={unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Thông báo'}
        onClick={handleToggleOpen}
      >
        <i className={isOpen || unreadCount > 0 ? 'bi bi-bell-fill' : 'bi bi-bell'} />
        {unreadCount > 0 && (
          <span className="dashboard-bell-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown" role="region" aria-label="Danh sách thông báo">
          {/* Header */}
          <div className="notification-header">
            <div className="notification-title-group">
              <h3 className="notification-title">Thông báo</h3>
              {unreadCount > 0 && (
                <span className="notification-unread-pill">{unreadCount} mới</span>
              )}
            </div>
            <div className="notification-header-actions">
              {unreadCount > 0 && (
                <button
                  className="notif-icon-btn notif-btn-read-all"
                  type="button"
                  title="Đánh dấu tất cả là đã đọc"
                  onClick={handleMarkAllAsRead}
                >
                  <i className="bi bi-check2-all" />
                </button>
              )}
              <button
                className="notif-icon-btn"
                type="button"
                title="Làm mới"
                onClick={fetchNotifications}
              >
                <i className="bi bi-arrow-clockwise" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="notification-list">
            {loading ? (
              <>
                <div className="notification-skeleton">
                  <div className="skeleton-icon" />
                  <div className="skeleton-lines">
                    <div className="skeleton-line medium" />
                    <div className="skeleton-line" />
                    <div className="skeleton-line short" />
                  </div>
                </div>
                <div className="notification-skeleton">
                  <div className="skeleton-icon" />
                  <div className="skeleton-lines">
                    <div className="skeleton-line medium" />
                    <div className="skeleton-line" />
                    <div className="skeleton-line short" />
                  </div>
                </div>
              </>
            ) : notifications.length === 0 ? (
              <div className="notification-empty">
                <div className="notification-empty-icon">
                  <i className="bi bi-bell-slash" />
                </div>
                <p className="notification-empty-title">Chưa có thông báo nào</p>
                <p className="notification-empty-desc">
                  Tất cả thông báo về dinh dưỡng, duyệt món ăn và lời nhắc sẽ hiển thị tại đây.
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const meta = getNotificationMeta(item.type)
                const isUnread = !item.isRead
                return (
                  <div
                    key={item._id}
                    className={`notification-item ${isUnread ? 'is-unread' : 'is-read'}`}
                    onClick={() => handleItemClick(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleItemClick(item)
                      }
                    }}
                  >
                    <div className={`notification-icon-wrap ${meta.wrapperClass}`}>
                      <i className={`bi ${meta.icon}`} />
                    </div>

                    <div className="notification-content">
                      <div className="notification-item-header">
                        <h4 className="notification-item-title">{item.title}</h4>
                        <div className="notification-item-meta">
                          <span className="notification-item-time">
                            {formatTimeAgoVi(item.createdAt)}
                          </span>
                          {isUnread && <span className="notification-unread-dot" />}
                        </div>
                      </div>

                      <p className="notification-item-msg">{item.message}</p>

                      <div className="notification-item-footer">
                        <span className="notification-type-tag">{meta.tag}</span>

                        <div className="notification-item-actions">
                          {isUnread && (
                            <button
                              className="item-action-btn"
                              type="button"
                              title="Đánh dấu đã đọc"
                              onClick={(e) => handleMarkAsRead(item._id, e)}
                            >
                              <i className="bi bi-check2" />
                            </button>
                          )}
                          <button
                            className="item-action-btn btn-delete"
                            type="button"
                            title="Xóa thông báo"
                            onClick={(e) => handleDeleteNotification(item._id, e)}
                          >
                            <i className="bi bi-trash3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="notification-footer">
              <span className="notif-footer-tip">
                Hiển thị {notifications.length} thông báo
              </span>
              <button
                className="notif-clear-all-btn"
                type="button"
                onClick={handleClearAll}
              >
                <i className="bi bi-trash3" /> Xóa tất cả
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
