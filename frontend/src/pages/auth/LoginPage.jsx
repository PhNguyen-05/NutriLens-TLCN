import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import AuthLayout from '../../components/auth/AuthLayout'
import AuthNotice from '../../components/auth/AuthNotice'
import PasswordInput from '../../components/auth/PasswordInput'
import LoadingButton from '../../components/common/LoadingButton'
import GoogleAuthButton from '../../components/auth/GoogleAuthButton'
import { loginThunk, clearError } from '../../store/slices/authSlice'
import { INITIAL_LOGIN_FORM } from '../../constants/authConstants'

/**
 * Trang đăng nhập (UC02).
 * Hỗ trợ:
 *  - Đăng nhập bằng Email/Mật khẩu
 *  - Đăng nhập bằng Google qua component dùng chung GoogleAuthButton
 */
export default function LoginPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()

  const { loading, error } = useSelector((state) => state.auth)

  const [form, setForm] = useState(INITIAL_LOGIN_FORM)
  const [googleError, setGoogleError] = useState('')
  const [successMsg, setSuccessMsg] = useState(location.state?.successMsg || '')

  function getHomeRoute(user) {
    return String(user?.role || '').toLowerCase() === 'admin' ? '/admin' : '/dashboard'
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (error) dispatch(clearError())
    if (googleError) setGoogleError('')
  }

  async function handleEmailSubmit(e) {
    e.preventDefault()
    setSuccessMsg('')
    const result = await dispatch(loginThunk(form))
    if (loginThunk.fulfilled.match(result)) {
      navigate(getHomeRoute(result.payload?.user), { replace: true })
    }
  }

  return (
    <AuthLayout>
      {/* ── Tiêu đề ── */}
      <div className="mb-3">
        <p className="auth-eyebrow">Chào mừng trở lại</p>
        <h2 className="fw-bold mb-0" style={{ fontSize: '1.75rem', letterSpacing: '-0.02em' }}>
          Đăng nhập
        </h2>
      </div>

      {/* ── Thông báo ── */}
      <AuthNotice type="success" message={successMsg} onDismiss={() => setSuccessMsg('')} />
      <AuthNotice type="error" message={error} onDismiss={() => dispatch(clearError())} />
      <AuthNotice type="error" message={googleError} onDismiss={() => setGoogleError('')} />

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
        <div className="d-flex justify-content-end mb-3" style={{ marginTop: '-4px' }}>
          <Link to="/forgot-password" className="link-brand small">
            Quên mật khẩu?
          </Link>
        </div>

        <LoadingButton
          type="submit"
          loading={loading}
          className="btn btn-brand w-100 py-2 fw-semibold"
          style={{ height: 48 }}
        >
          <i className="bi bi-box-arrow-in-right me-2" aria-hidden="true" />
          Đăng nhập
        </LoadingButton>
      </form>

      {/* ── Divider ── */}
      <div className="auth-divider mt-2">
        <span>hoặc tiếp tục với</span>
      </div>

      {/* ════ Nút đăng nhập Google ════ */}
      <GoogleAuthButton
        buttonText="continue_with"
        onError={setGoogleError}
      />

      {/* ── Link đến trang đăng ký ── */}
      <p className="text-center mt-3 mb-0 small text-muted">
        Chưa có tài khoản?{' '}
        <Link to="/register" className="link-brand">Đăng ký miễn phí</Link>
      </p>
    </AuthLayout>
  )
}
