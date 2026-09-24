import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import AuthLayout from '../../components/auth/AuthLayout'
import AuthNotice from '../../components/auth/AuthNotice'
import PasswordInput from '../../components/auth/PasswordInput'
import LoadingButton from '../../components/common/LoadingButton'
import { loginThunk, googleLoginThunk, clearError } from '../../store/slices/authSlice'
import { INITIAL_LOGIN_FORM } from '../../constants/authConstants'

/**
 * Trang đăng nhập (UC02).
 * Hỗ trợ:
 *  - Đăng nhập bằng Email/Mật khẩu
 *  - Đăng nhập bằng Google (UC02 nhánh Google — dùng Google Identity Services)
 *
 * Nhận `location.state.successMsg` khi redirect từ RegisterPage / ForgotPasswordPage.
 */
export default function LoginPage() {
  const dispatch  = useDispatch()
  const navigate  = useNavigate()
  const location  = useLocation()

  const { loading, error } = useSelector((state) => state.auth)

  const [form, setForm]                   = useState(INITIAL_LOGIN_FORM)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleError, setGoogleError]     = useState('')
  const [successMsg, setSuccessMsg]       = useState(location.state?.successMsg || '')

  // Ref container để Google Identity Services render nút chính thức
  const googleBtnRef = useRef(null)

  function getHomeRoute(user) {
    return String(user?.role || '').toLowerCase() === 'admin' ? '/admin' : '/dashboard'
  }

  // ── Khởi tạo Google Identity Services ─────────────────────────────────────
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) {
      setGoogleError('Google Client ID chưa được cấu hình. Thêm VITE_GOOGLE_CLIENT_ID vào frontend/.env')
      return
    }

    async function handleCredentialResponse(credentialResponse) {
      setGoogleLoading(true)
      setGoogleError('')
      const result = await dispatch(
        googleLoginThunk({ idToken: credentialResponse.credential })
      )
      if (googleLoginThunk.fulfilled.match(result)) {
        navigate(getHomeRoute(result.payload?.user), { replace: true })
      } else {
        setGoogleError(result.payload || 'Đăng nhập Google thất bại.')
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

        // Render nút Google chính thức trực tiếp vào container
        googleBtnRef.current.innerHTML = ''
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          width: 400,
          logo_alignment: 'left',
        })
      } catch (err) {
        console.error('Lỗi khởi tạo Google Identity Services:', err)
      }
    }

    if (window.google?.accounts) {
      initGSI()
    } else {
      // GSI script load async — chờ nó sẵn sàng
      const gsiScript = document.querySelector('script[src*="accounts.google.com/gsi/client"]')
      if (gsiScript) {
        gsiScript.addEventListener('load', initGSI, { once: true })
      }
    }
  }, [dispatch, navigate])

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (error) dispatch(clearError())
  }

  async function handleEmailSubmit(e) {
    e.preventDefault()
    setSuccessMsg('')
    const result = await dispatch(loginThunk(form))
    if (loginThunk.fulfilled.match(result)) {
      navigate(getHomeRoute(result.payload?.user), { replace: true })
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AuthLayout>
      {/* ── Tiêu đề ── */}
      <div className="mb-4">
        <p className="auth-eyebrow">Chào mừng trở lại</p>
        <h2 className="fw-bold mb-0" style={{ fontSize: '1.9rem' }}>Đăng nhập</h2>
        <p className="text-muted small mb-0 mt-1">
          Tiếp tục theo dõi hành trình dinh dưỡng của bạn.
        </p>
      </div>

      {/* ── Thông báo ── */}
      <AuthNotice type="success" message={successMsg} onDismiss={() => setSuccessMsg('')} />
      <AuthNotice type="error"   message={error}      onDismiss={() => dispatch(clearError())} />
      <AuthNotice type="error"   message={googleError} onDismiss={() => setGoogleError('')} />

      {/* ════ Nút đăng nhập Google ════ */}
      <div className="mb-3 position-relative">
        <div
          ref={googleBtnRef}
          className="d-flex justify-content-center"
          style={{ minHeight: '44px' }}
        />
        {googleLoading && (
          <div
            className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center bg-white bg-opacity-75"
            style={{ borderRadius: 8, zIndex: 10 }}
          >
            <span className="spinner-border spinner-border-sm me-2 text-primary" role="status" aria-hidden="true" />
            <span className="small text-muted fw-semibold">Đang xác thực Google...</span>
          </div>
        )}
      </div>

      {/* ── Divider ── */}
      <div className="d-flex align-items-center gap-3 mb-3">
        <hr className="flex-grow-1 m-0" />
        <span className="text-muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
          hoặc đăng nhập bằng email
        </span>
        <hr className="flex-grow-1 m-0" />
      </div>

      {/* ════ Form Email / Mật khẩu ════ */}
      <form onSubmit={handleEmailSubmit} noValidate>
        {/* Email */}
        <div className="mb-3">
          <label htmlFor="login-email" className="form-label">Email</label>
          <div className="input-group">
            <span className="input-group-text">
              <i className="bi bi-envelope" aria-hidden="true" />
            </span>
            <input
              id="login-email"
              name="email"
              type="email"
              className="form-control"
              placeholder="example@email.com"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        {/* Mật khẩu */}
        <PasswordInput
          label="Mật khẩu"
          id="login-password"
          name="password"
          autoComplete="current-password"
          placeholder="Nhập mật khẩu"
          value={form.password}
          onChange={handleChange}
          required
        />

        {/* Quên mật khẩu */}
        <div className="d-flex justify-content-end mb-4" style={{ marginTop: '-4px' }}>
          <Link to="/forgot-password" className="link-brand small">
            Quên mật khẩu?
          </Link>
        </div>

        <LoadingButton
          type="submit"
          loading={loading}
          className="btn btn-brand w-100 py-2 fw-semibold"
        >
          <i className="bi bi-box-arrow-in-right me-2" aria-hidden="true" />
          Đăng nhập
        </LoadingButton>
      </form>

      {/* ── Link đến trang đăng ký ── */}
      <p className="text-center mt-4 mb-0 small text-muted">
        Chưa có tài khoản?{' '}
        <Link to="/register" className="link-brand">Đăng ký miễn phí</Link>
      </p>
    </AuthLayout>
  )
}
