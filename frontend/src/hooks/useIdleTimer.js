import { useEffect, useRef, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { logout } from '../store/slices/authSlice'

/** Thời gian idle mặc định: 30 phút (ms) */
const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000

/** Các sự kiện được coi là "hoạt động" của user */
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']

/**
 * Hook tự động đăng xuất user sau một khoảng thời gian không hoạt động.
 *
 * - Chỉ kích hoạt khi user đang đăng nhập (có accessToken).
 * - Reset timer mỗi khi user có tương tác với trang.
 * - Khi hết thời gian idle → dispatch logout() và redirect về /login.
 *
 * @param {number} [timeoutMs] - Thời gian idle tối đa tính bằng milliseconds.
 *                               Mặc định 30 phút.
 *
 * @example
 * // Dùng trong App.jsx với timeout 15 phút
 * useIdleTimer(15 * 60 * 1000)
 */
export function useIdleTimer(timeoutMs = DEFAULT_IDLE_TIMEOUT_MS) {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { accessToken } = useSelector((state) => state.auth)

  const timerRef = useRef(null)

  const handleLogout = useCallback(() => {
    dispatch(logout())
    navigate('/login', { replace: true })
  }, [dispatch, navigate])

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(handleLogout, timeoutMs)
  }, [handleLogout, timeoutMs])

  useEffect(() => {
    // Chỉ chạy khi user đang đăng nhập
    if (!accessToken) return

    // Bắt đầu đếm ngay khi mount
    resetTimer()

    // Gắn listener cho các sự kiện hoạt động
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, resetTimer))

    return () => {
      // Cleanup khi unmount hoặc user logout
      if (timerRef.current) clearTimeout(timerRef.current)
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, resetTimer))
    }
  }, [accessToken, resetTimer])
}
