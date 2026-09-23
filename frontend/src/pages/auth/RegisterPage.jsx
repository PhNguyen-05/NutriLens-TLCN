import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import AuthLayout from '../../components/auth/AuthLayout'
import AuthNotice from '../../components/auth/AuthNotice'
import PasswordInput from '../../components/auth/PasswordInput'
import OtpInput from '../../components/auth/OtpInput'
import StepIndicator from '../../components/auth/StepIndicator'
import LoadingButton from '../../components/common/LoadingButton'
import {
  registerThunk,
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

  // ── State ngày sinh (3 select riêng) ───────────────────────────────────────
  const [dobDay, setDobDay] = useState('')
  const [dobMonth, setDobMonth] = useState('')
  const [dobYear, setDobYear] = useState('')

  /** Ghép ngày/tháng/năm thành chuỗi ISO YYYY-MM-DD để gửi lên API */
  function buildDateOfBirth(d, m, y) {
    if (!d || !m || !y) return ''
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }

  const currentYear = new Date().getFullYear()
  const YEARS = Array.from({ length: 100 }, (_, i) => currentYear - i) // 100 năm gần nhất
  const MONTHS = [
    { value: '1', label: 'Tháng 1' }, { value: '2', label: 'Tháng 2' },
    { value: '3', label: 'Tháng 3' }, { value: '4', label: 'Tháng 4' },
    { value: '5', label: 'Tháng 5' }, { value: '6', label: 'Tháng 6' },
    { value: '7', label: 'Tháng 7' }, { value: '8', label: 'Tháng 8' },
    { value: '9', label: 'Tháng 9' }, { value: '10', label: 'Tháng 10' },
    { value: '11', label: 'Tháng 11' }, { value: '12', label: 'Tháng 12' },
  ]
  // Số ngày theo tháng (có xét năm nhuận)
  function getDaysInMonth(month, year) {
    if (!month) return 31
    return new Date(year || currentYear, parseInt(month), 0).getDate()
  }
  const DAYS = Array.from(
    { length: getDaysInMonth(dobMonth, dobYear) },
    (_, i) => i + 1
  )

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleFormChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (error) dispatch(clearError())
    if (formError) setFormError('')
  }

  // Regex khớp với PASSWORD_REGEX ở backend
  const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/

  /** Validate form trước khi gọi API */
  function validate() {
    if (!form.fullName.trim()) return 'Vui lòng nhập họ và tên.'
    if (!form.email.trim()) return 'Vui lòng nhập địa chỉ email.'
    if (form.password.length < 8) return 'Mật khẩu phải có ít nhất 8 ký tự.'
    if (!PASSWORD_REGEX.test(form.password))
      return 'Mật khẩu phải gồm chữ cái, chữ số và ít nhất 1 ký tự đặc biệt (vd: @, #, !).'
    if (form.password !== form.confirmPassword) return 'Mật khẩu xác nhận không khớp.'
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

    // Chỉ gửi các field backend cần, bỏ confirmPassword; ghép ngày sinh
    const { confirmPassword, ...rest } = form
    const payload = {
      ...rest,
      dateOfBirth: buildDateOfBirth(dobDay, dobMonth, dobYear),
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
        message={formError || error}
        onDismiss={() => {
          setFormError('')
          dispatch(clearError())
        }}
      />

      {/* ════════════════════════════════════════
          Bước 0 — Thông tin cá nhân
      ════════════════════════════════════════ */}
      {step === 0 && (
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

          {/* ── Ngày sinh — 3 select: Ngày / Tháng / Năm ── */}
          <div className="mb-3">
            <label className="form-label">
              <i className="bi bi-calendar3 me-1 text-muted" aria-hidden="true" />
              Ngày sinh
            </label>
            <div className="row g-2">
              {/* Ngày */}
              <div className="col-3">
                <select
                  id="reg-dob-day"
                  className="form-select form-select-sm"
                  value={dobDay}
                  onChange={(e) => setDobDay(e.target.value)}
                  aria-label="Ngày"
                >
                  <option value="">Ngày</option>
                  {DAYS.map((d) => (
                    <option key={d} value={String(d)}>
                      {String(d).padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>
              {/* Tháng */}
              <div className="col-5">
                <select
                  id="reg-dob-month"
                  className="form-select form-select-sm"
                  value={dobMonth}
                  onChange={(e) => {
                    setDobMonth(e.target.value)
                    // Reset ngày nếu ngày hiện tại vượt quá số ngày trong tháng mới
                    const max = new Date(dobYear || currentYear, parseInt(e.target.value), 0).getDate()
                    if (parseInt(dobDay) > max) setDobDay(String(max))
                  }}
                  aria-label="Tháng"
                >
                  <option value="">Tháng</option>
                  {MONTHS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              {/* Năm */}
              <div className="col-4">
                <select
                  id="reg-dob-year"
                  className="form-select form-select-sm"
                  value={dobYear}
                  onChange={(e) => setDobYear(e.target.value)}
                  aria-label="Năm"
                >
                  <option value="">Năm</option>
                  {YEARS.map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ── Giới tính ── */}
          <div className="mb-3">
            <label htmlFor="reg-gender" className="form-label">
              <i className="bi bi-gender-ambiguous me-1 text-muted" aria-hidden="true" />
              Giới tính
            </label>
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


          {/* Mật khẩu */}
          <PasswordInput
            label={<>Mật khẩu <span className="text-danger">*</span></>}
            id="reg-password"
            name="password"
            showStrength
            autoComplete="new-password"
            placeholder="Chữ + số + ký tự đặc biệt, ≥ 8 ký tự"
            value={form.password}
            onChange={handleFormChange}
            required
          />

          {/* Xác nhận mật khẩu */}
          <PasswordInput
            label={<>Xác nhận mật khẩu <span className="text-danger">*</span></>}
            id="reg-confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Nhập lại mật khẩu"
            value={form.confirmPassword}
            onChange={handleFormChange}
            required
          />

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
            Đăng ký
          </LoadingButton>
        </form>
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
    </AuthLayout>
  )
}
