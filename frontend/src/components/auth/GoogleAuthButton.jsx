import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import HealthDisclaimerModal from './HealthDisclaimerModal'
import { googleLoginThunk } from '../../store/slices/authSlice'

/**
 * Component nút xác thực bằng Google dùng chung cho LoginPage và RegisterPage.
 * Đóng gói toàn bộ vòng đời khởi tạo Google Identity Services (GSI),
 * hiển thị modal xác nhận điều kiện y tế cho tài khoản mới và điều hướng.
 *
 * @param {Object} props
 * @param {'continue_with'|'signup_with'} [props.buttonText='continue_with'] - Chữ trên nút Google
 * @param {number} [props.buttonWidth=400] - Chiều rộng nút (px)
 * @param {boolean} [props.medicalConfirmed=false] - Trạng thái đã tích checkbox y tế từ form đăng ký
 * @param {(error: string) => void} [props.onError] - Callback khi có lỗi
 * @param {(user: Object) => void} [props.onSuccess] - Callback khi đăng nhập thành công
 */
export default function GoogleAuthButton({
  buttonText = 'continue_with',
  buttonWidth = 400,
  medicalConfirmed = false,
  onError,
  onSuccess,
}) {
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleError, setGoogleError] = useState('')

  // State Modal Xác nhận Y tế cho tài khoản mới qua Google
  const [showGoogleModal, setShowGoogleModal] = useState(false)
  const [pendingGoogleIdToken, setPendingGoogleIdToken] = useState('')
  const [googleUserInfo, setGoogleUserInfo] = useState({ fullName: '', email: '' })
  const [confirmingGoogle, setConfirmingGoogle] = useState(false)

  const googleBtnRef = useRef(null)

  function getHomeRoute(user) {
    return String(user?.role || '').toLowerCase() === 'admin' ? '/admin' : '/dashboard'
  }

  function handleNotifyError(msg) {
    setGoogleError(msg)
    onError?.(msg)
  }

  // Xác nhận điều kiện y tế trong Modal
  async function handleConfirmGoogleDisclaimer() {
    setConfirmingGoogle(true)
    setGoogleError('')
    const result = await dispatch(
      googleLoginThunk({
        idToken: pendingGoogleIdToken,
        healthDisclaimerAccepted: true,
      })
    )
    setConfirmingGoogle(false)

    if (googleLoginThunk.fulfilled.match(result)) {
      setShowGoogleModal(false)
      setPendingGoogleIdToken('')
      if (onSuccess) {
        onSuccess(result.payload?.user)
      } else {
        navigate(getHomeRoute(result.payload?.user), { replace: true })
      }
    } else {
      const err = result.payload || 'Đăng nhập Google thất bại.'
      handleNotifyError(err)
    }
  }

  function handleCancelGoogleDisclaimer() {
    setShowGoogleModal(false)
    setPendingGoogleIdToken('')
    setGoogleUserInfo({ fullName: '', email: '' })
    const rejectNotice =
      'NutriLens rất tiếc vì chưa thể phục vụ bạn do yêu cầu an toàn y tế (dành riêng cho người trưởng thành khỏe mạnh, không mang thai/cho con bú, không có bệnh nền). Tài khoản Google của bạn chưa được lưu vào hệ thống.'
    handleNotifyError(rejectNotice)
  }

  // Khởi tạo Google Identity Services
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) {
      handleNotifyError('Google Client ID chưa được cấu hình. Thêm VITE_GOOGLE_CLIENT_ID vào frontend/.env')
      return
    }

    async function handleCredentialResponse(credentialResponse) {
      setGoogleLoading(true)
      setGoogleError('')
      const payload = {
        idToken: credentialResponse.credential,
        ...(medicalConfirmed ? { healthDisclaimerAccepted: true } : {}),
      }

      const result = await dispatch(googleLoginThunk(payload))
      if (googleLoginThunk.fulfilled.match(result)) {
        if (result.payload?.requiresHealthDisclaimer) {
          setPendingGoogleIdToken(credentialResponse.credential)
          setGoogleUserInfo({
            fullName: result.payload.fullName,
            email: result.payload.email,
          })
          setShowGoogleModal(true)
        } else {
          if (onSuccess) {
            onSuccess(result.payload?.user)
          } else {
            navigate(getHomeRoute(result.payload?.user), { replace: true })
          }
        }
      } else {
        const err = result.payload || 'Đăng nhập Google thất bại.'
        handleNotifyError(err)
      }
      setGoogleLoading(false)
    }

    function initGSI() {
      if (!window.google?.accounts || !googleBtnRef.current) return

      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
          auto_select: false,
        })

        googleBtnRef.current.innerHTML = ''
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: buttonText,
          shape: 'pill',
          width: buttonWidth,
          logo_alignment: 'left',
        })
      } catch (err) {
        console.error('Lỗi khởi tạo Google Identity Services:', err)
      }
    }

    if (window.google?.accounts) {
      initGSI()
    } else {
      const gsiScript = document.querySelector('script[src*="accounts.google.com/gsi/client"]')
      if (gsiScript) {
        gsiScript.addEventListener('load', initGSI, { once: true })
      }
    }
  }, [buttonText, buttonWidth, medicalConfirmed, dispatch, navigate])

  return (
    <>
      <div className="mb-3">
        {googleLoading ? (
          <div className="text-center py-2">
            <span className="spinner-border spinner-border-sm text-success me-2" role="status" />
            <small className="text-muted">Đang xử lý đăng nhập Google...</small>
          </div>
        ) : (
          <div
            ref={googleBtnRef}
            className="d-flex justify-content-center"
            style={{ minHeight: 44 }}
          />
        )}
      </div>

      {/* Modal Tiêu chuẩn Y tế cho tài khoản đăng ký mới qua Google */}
      <HealthDisclaimerModal
        isOpen={showGoogleModal}
        userInfo={googleUserInfo}
        loading={confirmingGoogle}
        onConfirm={handleConfirmGoogleDisclaimer}
        onCancel={handleCancelGoogleDisclaimer}
      />
    </>
  )
}
