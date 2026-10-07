import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import AuthLayout from '../../components/auth/AuthLayout'
import AuthNotice from '../../components/auth/AuthNotice'
import PasswordInput from '../../components/auth/PasswordInput'
import OtpInput from '../../components/auth/OtpInput'
import StepIndicator from '../../components/auth/StepIndicator'
import LoadingButton from '../../components/common/LoadingButton'
import HealthDisclaimerModal from '../../components/auth/HealthDisclaimerModal'
import {
  registerThunk,
  googleLoginThunk,
  verifyOtpThunk,
  resendOtpThunk,
  clearError,
} from '../../store/slices/authSlice'
import { useCountdown } from '../../hooks/useCountdown'
import {
  INITIAL_REGISTER_FORM,
  OTP_RESEND_COUNTDOWN_SEC,
} from '../../constants/authConstants'

const STEPS = ['Thông tin cá nhân', 'Xác thực email']

const GENDER_OPTIONS = [
  { value: '', label: 'Chọn giới tính' },
  { value: 'male', label: '👨 Nam' },
  { value: 'female', label: '👩 Nữ' },
  { value: 'other', label: '🧑 Khác' },
]

/**
 * Trang đăng ký (UC01) — 2 bước:
 *  Bước 0: Điền thông tin cá nhân (họ tên, email, ngày sinh, giới tính, mật khẩu)
 *  Bước 1: Nhập OTP gửi về email để xác thực tài khoản
 */
export default function RegisterPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const { loading, error } = useSelector((state) => state.auth)
  const { countdown, startCountdown } = useCountdown()

  const [step, setStep] = useState(0)
  const [form, setForm] = useState(INITIAL_REGISTER_FORM)
  const [otp, setOtp] = useState('')
  const [registeredEmail, setRegisteredEmail] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [formError, setFormError] = useState('')
  const [medicalConfirmed, setMedicalConfirmed] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleError, setGoogleError] = useState('')

  // ── State Modal Xác nhận Y tế cho Google Sign-up ─────────────────────────
  const [showGoogleModal, setShowGoogleModal] = useState(false)
  const [pendingGoogleIdToken, setPendingGoogleIdToken] = useState('')
  const [googleUserInfo, setGoogleUserInfo] = useState({ fullName: '', email: '' })
  const [confirmingGoogle, setConfirmingGoogle] = useState(false)

  // Ref container để Google Identity Services render nút đăng ký chính thức
  const googleBtnRef = useRef(null)

  function getHomeRoute(user) {
    return String(user?.role || '').toLowerCase() === 'admin' ? '/admin' : '/dashboard'
  }

  // ── Handlers xác nhận tiêu chuẩn sức khỏe cho Google ─────────────────────
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
      navigate(getHomeRoute(result.payload?.user), { replace: true })
    } else {
      setGoogleError(result.payload || 'Đăng ký bằng Google thất bại.')
    }
  }

  function handleCancelGoogleDisclaimer() {
    setShowGoogleModal(false)
    setPendingGoogleIdToken('')
    setGoogleUserInfo({ fullName: '', email: '' })
    setFormError(
      'NutriLens rất tiếc vì chưa thể phục vụ bạn do yêu cầu an toàn y tế (dành riêng cho người trưởng thành khỏe mạnh, không mang thai/cho con bú, không có bệnh nền). Tài khoản Google của bạn chưa được lưu vào hệ thống.'
    )
  }

  // ── Khởi tạo Google Identity Services cho nút Đăng ký bằng Google ───────────
  useEffect(() => {
    if (step !== 0) return

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) {
      setGoogleError('Google Client ID chưa được cấu hình. Thêm VITE_GOOGLE_CLIENT_ID vào frontend/.env')
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
          // Người dùng mới qua Google -> Mở Modal xác nhận tiêu chuẩn sức khỏe trước khi tạo user trong DB
          setPendingGoogleIdToken(credentialResponse.credential)
          setGoogleUserInfo({
            fullName: result.payload.fullName,
            email: result.payload.email,
          })
          setShowGoogleModal(true)
        } else {
          navigate(getHomeRoute(result.payload?.user), { replace: true })
        }
      } else {
        setGoogleError(result.payload || 'Đăng ký bằng Google thất bại.')
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
          text: 'signup_with',
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
      const gsiScript = document.querySelector('script[src*="accounts.google.com/gsi/client"]')
      if (gsiScript) {
        gsiScript.addEventListener('load', initGSI, { once: true })
      }
    }
  }, [step, dispatch, navigate])

  // Ref cho ô input ngày sinh để mở lịch khi click icon
  const dobInputRef = useRef(null)

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleFormChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (error) dispatch(clearError())
    if (formError) setFormError('')
    if (googleError) setGoogleError('')
  }

  // Regex khớp với PASSWORD_REGEX ở backend
  const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/

  /** Validate form trước khi gọi API */
  function validate() {
    if (!form.fullName.trim()) return 'Vui lòng nhập họ và tên.'
    if (!form.email.trim()) return 'Vui lòng nhập địa chỉ email.'
    if (form.dateOfBirth) {
      const birthDate = new Date(form.dateOfBirth)
      const today = new Date()
      let age = today.getFullYear() - birthDate.getFullYear()
      const monthDiff = today.getMonth() - birthDate.getMonth()
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--
      }
      if (age < 18) {
        return 'NutriLens hiện chỉ dành cho người từ 18 tuổi trở lên.'
      }
    }
    if (form.password.length < 8) return 'Mật khẩu phải có ít nhất 8 ký tự.'
    if (!PASSWORD_REGEX.test(form.password))
      return 'Mật khẩu phải gồm chữ cái, chữ số và ít nhất 1 ký tự đặc biệt (vd: @, #, !).'
    if (form.password !== form.confirmPassword) return 'Mật khẩu xác nhận không khớp.'
    if (!medicalConfirmed) {
      return 'Vui lòng đọc và xác nhận bạn đủ điều kiện sức khỏe (không mang thai, không cho con bú, không có bệnh nền) để đăng ký.'
    }
    return null
  }

  /** Bước 0 → Đăng ký, server gửi OTP */
  async function handleRegisterSubmit(e) {
    e.preventDefault()
    setFormError('')

    const validationError = validate()
    if (validationError) {
      setFormError(validationError)
      return
    }

    // Chỉ gửi các field backend cần, bỏ confirmPassword
    const { confirmPassword, ...rest } = form
    const payload = {
      ...rest,
      healthDisclaimerAccepted: medicalConfirmed,
    }
    const result = await dispatch(registerThunk(payload))

    if (registerThunk.fulfilled.match(result)) {
      const email = result.payload?.email || form.email
      setRegisteredEmail(email)
      setSuccessMsg(result.payload?.message || `Mã xác thực đã gửi đến ${email}`)
      setStep(1)
      startCountdown(OTP_RESEND_COUNTDOWN_SEC)
    }
  }

  /** Bước 1 → Xác thực OTP */
  async function handleVerifyOtp(e) {
    e.preventDefault()
    dispatch(clearError())

    const result = await dispatch(
      verifyOtpThunk({ email: registeredEmail, otp, purpose: 'register' })
    )

    if (verifyOtpThunk.fulfilled.match(result)) {
      navigate('/login', {
        replace: true,
        state: { successMsg: 'Đăng ký thành công! Bạn có thể đăng nhập ngay.' },
      })
    }
  }

  /** Gửi lại OTP */
  async function handleResendOtp() {
    dispatch(clearError())
    setSuccessMsg('')

    const result = await dispatch(
      resendOtpThunk({ email: registeredEmail, purpose: 'register' })
    )

    if (resendOtpThunk.fulfilled.match(result)) {
      setSuccessMsg(result.payload?.message || 'Đã gửi lại mã xác thực.')
      setOtp('')
      startCountdown(OTP_RESEND_COUNTDOWN_SEC)
    }
  }

  function handleBackToForm() {
    setStep(0)
    setOtp('')
    dispatch(clearError())
    setSuccessMsg('')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AuthLayout>
      {/* ── Tiêu đề ── */}
      <div className="mb-3">
        <p className="auth-eyebrow">Bắt đầu hành trình</p>
        <h2 className="fw-bold mb-0" style={{ fontSize: '1.9rem' }}>
          Tạo tài khoản
        </h2>
        <p className="text-muted small mb-0 mt-1">
          Miễn phí, không cần thẻ tín dụng.
        </p>
      </div>

      <StepIndicator steps={STEPS} current={step} />

      {/* ── Thông báo ── */}
      <AuthNotice
        type="success"
        message={successMsg}
        onDismiss={() => setSuccessMsg('')}
      />
      <AuthNotice
        type="error"
        message={formError || googleError || error}
        onDismiss={() => {
          setFormError('')
          setGoogleError('')
          dispatch(clearError())
        }}
      />

      {/* ════════════════════════════════════════
          Bước 0 — Thông tin cá nhân
      ════════════════════════════════════════ */}
      {step === 0 && (
        <>
          {/* Nút Đăng ký nhanh Google */}
          <div className="mb-3">
            {googleLoading ? (
              <div className="text-center py-2">
                <span className="spinner-border spinner-border-sm text-success me-2" role="status" />
                <small className="text-muted">Đang xử lý đăng ký Google...</small>
              </div>
            ) : (
              <div
                ref={googleBtnRef}
                className="d-flex justify-content-center"
                style={{ minHeight: 44 }}
              />
            )}
          </div>

          <div className="auth-divider">
            <span>hoặc đăng ký bằng email</span>
          </div>

          <form onSubmit={handleRegisterSubmit} noValidate>
            {/* Họ và tên */}
            <div className="mb-3">
              <label htmlFor="reg-fullName" className="form-label">
                Họ và tên <span className="text-danger">*</span>
              </label>
              <div className="input-group">
                <span className="input-group-text">
                  <i className="bi bi-person" aria-hidden="true" />
                </span>
                <input
                  id="reg-fullName"
                  name="fullName"
                  type="text"
                  className="form-control"
                  placeholder="Nguyễn Văn A"
                  autoComplete="name"
                  value={form.fullName}
                  onChange={handleFormChange}
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div className="mb-3">
              <label htmlFor="reg-email" className="form-label">
                Email <span className="text-danger">*</span>
              </label>
              <div className="input-group">
                <span className="input-group-text">
                  <i className="bi bi-envelope" aria-hidden="true" />
                </span>
                <input
                  id="reg-email"
                  name="email"
                  type="email"
                  className="form-control"
                  placeholder="example@email.com"
                  autoComplete="email"
                  value={form.email}
                  onChange={handleFormChange}
                  required
                />
              </div>
            </div>

            {/* ── Ngày sinh (1 ô tích hợp lịch chọn) + Giới tính ── */}
            <div className="row g-2 mb-3">
              <div className="col-sm-6 col-12">
                <label htmlFor="reg-dob" className="form-label">
                  Ngày sinh
                </label>
                <div className="input-group">
                  <span
                    className="input-group-text"
                    style={{ cursor: 'pointer' }}
                    onClick={() => dobInputRef.current?.showPicker?.()}
                    title="Mở lịch chọn ngày sinh"
                  >
                    <i className="bi bi-calendar3" aria-hidden="true" />
                  </span>
                  <input
                    ref={dobInputRef}
                    id="reg-dob"
                    name="dateOfBirth"
                    type="date"
                    className="form-control"
                    value={form.dateOfBirth}
                    onChange={handleFormChange}
                    min="1900-01-01"
                    max={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>

              <div className="col-sm-6 col-12">
                <label htmlFor="reg-gender" className="form-label">
                  Giới tính
                </label>
                <div className="input-group">
                  <span className="input-group-text">
                    <i className="bi bi-gender-ambiguous" aria-hidden="true" />
                  </span>
                  <select
                    id="reg-gender"
                    name="gender"
                    className="form-select"
                    value={form.gender}
                    onChange={handleFormChange}
                  >
                    {GENDER_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* ── Mật khẩu (6 cột) + Xác nhận mật khẩu (6 cột) ── */}
            <div className="row g-2">
              <div className="col-sm-6 col-12">
                <PasswordInput
                  label={<>Mật khẩu <span className="text-danger">*</span></>}
                  id="reg-password"
                  name="password"
                  showStrength
                  autoComplete="new-password"
                  placeholder="≥ 8 ký tự"
                  value={form.password}
                  onChange={handleFormChange}
                  required
                />
              </div>

              <div className="col-sm-6 col-12">
                <PasswordInput
                  label={<>Xác nhận <span className="text-danger">*</span></>}
                  id="reg-confirmPassword"
                  name="confirmPassword"
                  autoComplete="new-password"
                  placeholder="Nhập lại mật khẩu"
                  value={form.confirmPassword}
                  onChange={handleFormChange}
                  required
                />
              </div>
            </div>

            {/* ── Thẻ Tiêu chuẩn An toàn NutriLens ── */}
            <div className="reg-safety-card">
              <div className="reg-safety-card__header">
                <div className="reg-safety-card__icon">
                  <i className="bi bi-shield-check" aria-hidden="true" />
                </div>
                <div className="reg-safety-card__title">
                  <strong>Tiêu chuẩn Đối tượng Sử dụng</strong>
                  <small>Khuyến nghị an toàn theo chuẩn y tế NutriLens</small>
                </div>
              </div>

              <div className="reg-safety-card__chips">
                <span className="reg-safety-chip">
                  <i className="bi bi-person-check-fill" aria-hidden="true" />
                  Từ 18 tuổi trở lên
                </span>
                <span className="reg-safety-chip">
                  <i className="bi bi-heart-pulse-fill" aria-hidden="true" />
                  Không mang thai / cho con bú
                </span>
                <span className="reg-safety-chip">
                  <i className="bi bi-clipboard2-check-fill" aria-hidden="true" />
                  Không bệnh nền mạn tính
                </span>
              </div>

              <div
                className={`form-check reg-safety-card__check ${
                  medicalConfirmed ? 'is-checked' : ''
                } ${formError && !medicalConfirmed ? 'has-error' : ''}`}
              >
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="reg-medical-confirm"
                  checked={medicalConfirmed}
                  onChange={(e) => {
                    setMedicalConfirmed(e.target.checked)
                    if (formError) setFormError('')
                  }}
                />
                <label className="form-check-label" htmlFor="reg-medical-confirm">
                  Tôi xác nhận đủ điều kiện sức khỏe trên và hiểu rằng NutriLens không thay thế chỉ định y khoa. <span className="text-danger">*</span>
                </label>
              </div>
            </div>

            {/* Điều khoản */}
            <p className="text-muted small mb-3" style={{ lineHeight: 1.5 }}>
              Bằng cách đăng ký, bạn đồng ý với{' '}
              <a href="#" className="link-brand">Điều khoản dịch vụ</a>
              {' '}và{' '}
              <a href="#" className="link-brand">Chính sách bảo mật</a>
              {' '}của NutriLens.
            </p>

            <LoadingButton
              type="submit"
              loading={loading}
              loadingText="Đang xử lý..."
              className="btn btn-brand w-100 py-2 fw-semibold"
            >
              <i className="bi bi-person-plus me-2" aria-hidden="true" />
              Đăng ký tài khoản
            </LoadingButton>
          </form>
        </>
      )}

      {/* ════════════════════════════════════════
          Bước 1 — Xác thực OTP
      ════════════════════════════════════════ */}
      {step === 1 && (
        <form onSubmit={handleVerifyOtp} noValidate>
          {/* Icon email lớn */}
          <div className="text-center mb-3">
            <div
              className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
              style={{
                width: 64,
                height: 64,
                background: '#f0faf6',
                border: '2px solid #d9f7c9',
              }}
            >
              <i className="bi bi-envelope-check fs-3" style={{ color: 'var(--nl-brand-mid)' }} aria-hidden="true" />
            </div>
            <p className="mb-1 fw-semibold">Kiểm tra hộp thư của bạn</p>
            <p className="text-muted small mb-0">
              Mã xác thực 6 chữ số đã được gửi đến
            </p>
            <p className="fw-semibold small" style={{ color: 'var(--nl-brand-mid)' }}>
              {registeredEmail}
            </p>
          </div>

          <OtpInput value={otp} onChange={setOtp} />

          <p className="text-muted text-center" style={{ fontSize: 12 }}>
            Mã có hiệu lực trong <strong>10 phút</strong>. Kiểm tra cả thư mục spam nếu không nhận được.
          </p>

          <LoadingButton
            type="submit"
            loading={loading}
            loadingText="Đang xác thực..."
            className="btn btn-brand w-100 py-2 fw-semibold mt-1"
            disabled={otp.length < 6}
          >
            <i className="bi bi-shield-check me-2" aria-hidden="true" />
            Xác thực tài khoản
          </LoadingButton>

          {/* Gửi lại OTP */}
          <div className="text-center mt-3">
            {countdown > 0 ? (
              <p className="text-muted small mb-0">
                Gửi lại sau{' '}
                <span className="fw-semibold text-dark">{countdown}s</span>
              </p>
            ) : (
              <button
                type="button"
                className="btn btn-link link-brand p-0 small text-decoration-none"
                onClick={handleResendOtp}
                disabled={loading}
              >
                <i className="bi bi-arrow-clockwise me-1" aria-hidden="true" />
                Gửi lại mã xác thực
              </button>
            )}
          </div>

          {/* Quay lại */}
          <div className="text-center mt-2">
            <button
              type="button"
              className="btn btn-link text-muted p-0 small text-decoration-none"
              onClick={handleBackToForm}
            >
              ← Quay lại chỉnh sửa thông tin
            </button>
          </div>
        </form>
      )}

      {/* ── Link đến trang đăng nhập ── */}
      {step === 0 && (
        <p className="text-center mt-4 mb-0 small text-muted">
          Đã có tài khoản?{' '}
          <Link to="/login" className="link-brand">
            Đăng nhập
          </Link>
        </p>
      )}

      {/* ── Modal Tiêu chuẩn Y tế cho Google Sign-up ── */}
      <HealthDisclaimerModal
        isOpen={showGoogleModal}
        userInfo={googleUserInfo}
        loading={confirmingGoogle}
        onConfirm={handleConfirmGoogleDisclaimer}
        onCancel={handleCancelGoogleDisclaimer}
      />
    </AuthLayout>
  )
}
