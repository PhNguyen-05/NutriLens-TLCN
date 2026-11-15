import { useState, useEffect, useRef, useCallback } from 'react'
import axiosInstance from '../../api/axiosInstance'
import { useAuth } from '../../hooks/useAuth'
import nutrilensLogo from '../../assets/nutrilens-logo.jpg'
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

  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`
}

function formatModalDate(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''

  const d = date.getDate()
  const m = date.getMonth() + 1
  const y = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${d}/${m}/${y} ${hours}:${minutes}`
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
    case 'food_request_submitted':
      return {
        icon: 'bi-send-check-fill',
        wrapperClass: 'type-info',
        tag: 'Gửi yêu cầu',
      }
    case 'community_comment':
      return {
        icon: 'bi-chat-dots-fill',
        wrapperClass: 'type-community',
        tag: 'Bình luận',
      }
    case 'community_like':
      return {
        icon: 'bi-heart-fill',
        wrapperClass: 'type-danger',
        tag: 'Yêu thích',
      }
    case 'community':
    case 'community_post_approved':
      return {
        icon: 'bi-people-fill',
        wrapperClass: 'type-community',
        tag: 'Cộng đồng',
      }
    case 'security':
      return {
        icon: 'bi-shield-check',
        wrapperClass: 'type-warning',
        tag: 'Bảo mật',
      }
    case 'meal_reminder':
      return {
        icon: 'bi-egg-fried',
        wrapperClass: 'type-warning',
        tag: 'Bữa ăn',
      }
    case 'water_reminder':
      return {
        icon: 'bi-droplet-fill',
        wrapperClass: 'type-info',
        tag: 'Uống nước',
      }
    case 'reminder':
      return {
        icon: 'bi-alarm-fill',
        wrapperClass: 'type-warning',
        tag: 'Nhắc nhở',
      }
    case 'system':
    default:
      return {
        icon: 'bi-stars',
        wrapperClass: 'type-primary',
        tag: 'Hệ thống',
      }
  }
}

export default function NotificationBell() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [selectedNotification, setSelectedNotification] = useState(null)
  const bellRef = useRef(null)

  // 1. Tải số lượng chưa đọc (endpoint nhẹ cho polling)
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return
    if (typeof document !== 'undefined' && document.hidden) return

    try {
      const res = await axiosInstance.get('/notifications/unread-count')
      if (res.data?.success) {
        setUnreadCount(Number(res.data.unreadCount) || 0)
      }
    } catch {
      // Bỏ qua lỗi ngầm
    }
  }, [user])

  // 2. Tải danh sách thông báo (trang 1)
  const fetchNotifications = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const res = await axiosInstance.get('/notifications', {
        params: { page: 1, limit: 15 },
      })
      if (res.data?.success) {
        setNotifications(Array.isArray(res.data.data) ? res.data.data : [])
        setPage(1)
        setHasMore(Boolean(res.data.pagination?.hasMore))
        if (typeof res.data.unreadCount === 'number') {
          setUnreadCount(res.data.unreadCount)
        }
      }
    } catch (err) {
      console.error('Lỗi khi tải danh sách thông báo:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  // 3. Tải thêm thông báo cũ hơn
  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || !user) return
    try {
      setLoadingMore(true)
      const nextPage = page + 1
      const res = await axiosInstance.get('/notifications', {
        params: { page: nextPage, limit: 15 },
      })
      if (res.data?.success) {
        const newItems = Array.isArray(res.data.data) ? res.data.data : []
        setNotifications((prev) => [...prev, ...newItems])
        setPage(nextPage)
        setHasMore(Boolean(res.data.pagination?.hasMore))
      }
    } catch (err) {
      console.error('Lỗi tải thêm thông báo:', err)
    } finally {
      setLoadingMore(false)
    }
  }

  // 4. Polling thông minh & đồng bộ khi quay lại tab
  useEffect(() => {
    let ignore = false

    async function loadInitial() {
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

    loadInitial()

    const interval = setInterval(() => {
      if (!ignore) fetchUnreadCount()
    }, 45_000)

    const handleVisibilityChange = () => {
      if (!document.hidden && !ignore) {
        fetchUnreadCount()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleVisibilityChange)

    return () => {
      ignore = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleVisibilityChange)
    }
  }, [user, fetchUnreadCount])

  // 5. Đóng dropdown khi click ra ngoài hoặc bấm Escape
  useEffect(() => {
    function handleClickOutside(event) {
      if (bellRef.current && !bellRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        if (selectedNotification) {
          setSelectedNotification(null)
        } else {
          setIsOpen(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedNotification])

  // 6. Mở dropdown và tải thông báo
  const handleToggleOpen = () => {
    setIsOpen((prev) => {
      const next = !prev
      if (next) {
        fetchNotifications()
      }
      return next
    })
  }

  // 7. Đánh dấu 1 thông báo là đã đọc (Optimistic UI)
  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation()
    setNotifications((prev) =>
      prev.map((item) => (item._id === id ? { ...item, isRead: true } : item))
    )
    setUnreadCount((c) => Math.max(0, c - 1))

    try {
      const res = await axiosInstance.patch(`/notifications/${id}/read`)
      if (res.data?.success && typeof res.data.unreadCount === 'number') {
        setUnreadCount(res.data.unreadCount)
      }
    } catch (err) {
      console.error('Không thể đánh dấu đã đọc:', err)
    }
  }

  // 8. Đánh dấu tất cả là đã đọc (Optimistic UI)
  const handleMarkAllAsRead = async () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })))
    setUnreadCount(0)

    try {
      await axiosInstance.patch('/notifications/read-all')
    } catch (err) {
      console.error('Không thể đánh dấu tất cả đã đọc:', err)
      fetchNotifications()
    }
  }

  // 9. Click vào thông báo: Đánh dấu đã đọc + MỞ FORM CHI TIẾT (KHÔNG ĐIỀU HƯỚNG)
  const handleItemClick = (item) => {
    if (!item.isRead) {
      handleMarkAsRead(item._id)
    }
    setIsOpen(false)
    setSelectedNotification(item)
  }

  return (
    <>
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
                <img
                  src={nutrilensLogo}
                  alt="NutriLens"
                  style={{ width: 22, height: 22, borderRadius: 5, objectFit: 'cover' }}
                />
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
                <>
                  {notifications.map((item) => {
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
                          {item.type === 'system' ? (
                            <img
                              src={nutrilensLogo}
                              alt="NutriLens"
                              style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'cover' }}
                            />
                          ) : (
                            <i className={`bi ${meta.icon}`} />
                          )}
                        </div>

                        <div className="notification-content">
                          <div className="notification-item-header">
                            <h4 className="notification-item-title">{item.title}</h4>
                            <div className="notification-item-meta">
                              <span className="notification-item-time">
                                <i className="bi bi-clock notif-item-clock-icon" /> {formatTimeAgoVi(item.createdAt)}
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
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {/* Nút Xem thêm khi còn thông báo cũ */}
                  {hasMore && (
                    <div className="notif-load-more-wrap">
                      <button
                        className="notif-load-more-btn"
                        type="button"
                        onClick={handleLoadMore}
                        disabled={loadingMore}
                      >
                        {loadingMore ? (
                          <>
                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                            Đang tải...
                          </>
                        ) : (
                          <>
                            <i className="bi bi-chevron-down" /> Xem thêm thông báo cũ hơn
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="notification-footer">
                <span className="notif-footer-tip">
                  Lịch sử {notifications.length} thông báo
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL XEM CHI TIẾT THÔNG BÁO (THEO MẪU NGƯỜI DÙNG CUNG CẤP) */}
      {selectedNotification && (
        <div
          className="notif-modal-backdrop"
          onClick={() => setSelectedNotification(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="notif-modal-title"
        >
          <div
            className="notif-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="notif-modal-header">
              <div className="notif-modal-brand">
                <img
                  src={nutrilensLogo}
                  alt="NutriLens"
                  className="notif-modal-logo"
                  style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }}
                />
                <h3 className="notif-modal-title" id="notif-modal-title">
                  {selectedNotification.title}
                </h3>
              </div>
              <button
                type="button"
                className="notif-modal-close-icon"
                onClick={() => setSelectedNotification(null)}
                aria-label="Đóng"
                title="Đóng"
              >
                <i className="bi bi-x-lg" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="notif-modal-body">
              <p className="notif-modal-message">
                {selectedNotification.message}
              </p>

              {selectedNotification.data?.reason && (
                <div className="notif-modal-callout notif-modal-callout-warning">
                  <strong>Lý do từ chối:</strong> {selectedNotification.data.reason}
                </div>
              )}

              {selectedNotification.data?.requestCode && (
                <div className="notif-modal-meta-field">
                  <span className="notif-meta-label">Mã yêu cầu:</span>
                  <span className="notif-meta-value">{selectedNotification.data.requestCode}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="notif-modal-footer">
              <span className="notif-modal-time">
                <i className="bi bi-clock" /> {formatModalDate(selectedNotification.createdAt)}
              </span>
              <button
                type="button"
                className="notif-modal-btn-close"
                onClick={() => setSelectedNotification(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
