import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import AuthLayout from '../../components/auth/AuthLayout'
import AuthNotice from '../../components/auth/AuthNotice'
import PasswordInput from '../../components/auth/PasswordInput'
import LoadingButton from '../../components/common/LoadingButton'
import { loginThunk, clearError } from '../../store/slices/authSlice'
import { INITIAL_LOGIN_FORM } from '../../constants/authConstants'

/**
 * Trang đăng nhập (UC02).
 * Hỗ trợ:
 *  - Đăng nhập bằng Email/Mật khẩu
 *  - Đăng nhập bằng Google (UC02 nhánh Google)
 *
 * Nhận `location.state.successMsg` khi được redirect từ RegisterPage / ForgotPasswordPage.
 */
export default function LoginPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()

  const { loading, error } = useSelector((state) => state.auth)

  const [form, setForm] = useState(INITIAL_LOGIN_FORM)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState(location.state?.successMsg || '')

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (error) dispatch(clearError())
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSuccessMsg('')

    const result = await dispatch(loginThunk(form))
    if (loginThunk.fulfilled.match(result)) {
      navigate('/dashboard', { replace: true })
    }
  }

  /**
   * Google OAuth — khởi động luồng xác thực Google.
   * Hiện tại dùng Google Identity Services (GSI).
   * Cần thêm Google Client ID vào .env: VITE_GOOGLE_CLIENT_ID=...
   */
  function handleGoogleLogin() {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) {
      alert('Google Client ID chưa được cấu hình. Vui lòng thêm VITE_GOOGLE_CLIENT_ID vào file .env')
      return
    }

    setGoogleLoading(true)

    // Sử dụng Google Identity Services popup
    /* global google */
    google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response) => {
        try {
          const { default: axios } = await import('axios')
          const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
          const { data } = await axios.post(`${BASE_URL}/auth/google`, {
            idToken: response.credential,
          })
          // Lưu session và chuyển hướng
          const { store } = await import('../../store')
          const { loginSuccess } = await import('../../store/slices/authSlice')
          store.dispatch(loginSuccess(data))
          navigate('/dashboard', { replace: true })
        } catch (err) {
          alert(err.response?.data?.message || 'Đăng nhập Google thất bại.')
        } finally {
          setGoogleLoading(false)
        }
      },
    })

    google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        setGoogleLoading(false)
      }
    })
  }

  return (
    <AuthLayout>
      {/* ── Tiêu đề ── */}
      <div className="mb-4">
        <p className="auth-eyebrow">Chào mừng trở lại</p>
        <h2 className="fw-bold mb-0" style={{ fontSize: '1.9rem' }}>
          Đăng nhập
        </h2>
        <p className="text-muted small mb-0 mt-1">
          Tiếp tục theo dõi hành trình dinh dưỡng của bạn.
        </p>
      </div>

      {/* ── Thông báo ── */}
      <AuthNotice
        type="success"
        message={successMsg}
        onDismiss={() => setSuccessMsg('')}
      />
      <AuthNotice
        type="error"
        message={error}
        onDismiss={() => dispatch(clearError())}
      />

      {/* ── Đăng nhập bằng Google ── */}
      <button
        type="button"
        className="btn w-100 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2 mb-3"
        style={{
          border: '1.5px solid #dadce0',
          borderRadius: 8,
          background: '#fff',
          color: '#3c4043',
          fontSize: 15,
          transition: 'box-shadow 0.15s, border-color 0.15s',
        }}
        onClick={handleGoogleLogin}
        disabled={googleLoading || loading}
        onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 1px 8px rgba(0,0,0,0.12)' }}
        onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none' }}
      >
        {googleLoading ? (
          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
        ) : (
          /* Google G SVG logo */
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
        )}
        {googleLoading ? 'Đang xử lý...' : 'Tiếp tục với Google'}
      </button>

      {/* ── Divider ── */}
      <div className="d-flex align-items-center gap-3 mb-3">
        <hr className="flex-grow-1 m-0" />
        <span className="text-muted small px-1">hoặc đăng nhập bằng email</span>
        <hr className="flex-grow-1 m-0" />
      </div>

      {/* ── Form Email/Password ── */}
      <form onSubmit={handleSubmit} noValidate>
        {/* Email */}
        <div className="mb-3">
          <label htmlFor="login-email" className="form-label">
            Email
          </label>
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
        <Link to="/register" className="link-brand">
          Đăng ký miễn phí
        </Link>
      </p>
    </AuthLayout>
  )
}
