import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Hook đếm ngược dùng cho nút "Gửi lại OTP".
 *
 * @example
 * const { countdown, startCountdown } = useCountdown()
 * // countdown: số giây còn lại (0 = hết)
 * // startCountdown(60): bắt đầu đếm ngược 60 giây
 */
export function useCountdown() {
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef(null)

  // Dọn dẹp interval khi component unmount
  useEffect(() => () => clearInterval(timerRef.current), [])

  const startCountdown = useCallback((seconds = 60) => {
    clearInterval(timerRef.current)
    setCountdown(seconds)

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  return { countdown, startCountdown }
}
