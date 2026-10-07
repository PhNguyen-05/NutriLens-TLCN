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
  forgotPasswordThunk,
  verifyOtpThunk,
  resetPasswordThunk,
  resendOtpThunk,
  clearError,
} from '../../store/slices/authSlice'
import { useCountdown } from '../../hooks/useCountdown'
import { OTP_RESEND_COUNTDOWN_SEC } from '../../constants/authConstants'

const STEPS = ['Nhập email', 'Xác thực OTP', 'Mật khẩu mới']

/**
 * Trang khôi phục mật khẩu (UC03) — 3 bước:
 *  Bước 0: Nhập email
 *  Bước 1: Xác thực OTP gửi về email
 *  Bước 2: Đặt mật khẩu mới
 */
export default function ForgotPasswordPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const { loading, error } = useSelector((state) => state.auth)
  const { countdown, startCountdown } = useCountdown()

  const [step, setStep] = useState(0)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [formError, setFormError] = useState('')

  function clearMessages() {
    setSuccessMsg('')
    setFormError('')
    dispatch(clearError())
  }

  // ── Bước 0: Gửi OTP ───────────────────────────────────────────────────────

  async function handleSendOtp(e) {
    e.preventDefault()
    clearMessages()

    const result = await dispatch(forgotPasswordThunk({ email }))

    if (forgotPasswordThunk.fulfilled.match(result)) {
      setSuccessMsg(result.payload?.message || `Mã OTP đã được gửi đến ${email}`)
      setStep(1)
      startCountdown(OTP_RESEND_COUNTDOWN_SEC)
    }
  }

  // ── Bước 1: Xác thực OTP ─────────────────────────────────────────────────

  async function handleVerifyOtp(e) {
    e.preventDefault()
    clearMessages()

    const result = await dispatch(
      verifyOtpThunk({ email, otp, purpose: 'reset' })
    )

    if (verifyOtpThunk.fulfilled.match(result)) {
      setResetToken(result.payload?.resetToken || '')
      setSuccessMsg('OTP hợp lệ. Hãy tạo mật khẩu mới cho tài khoản của bạn.')
      setStep(2)
    }
  }

  async function handleResendOtp() {
    clearMessages()

    const result = await dispatch(
      resendOtpThunk({ email, purpose: 'reset' })
    )

    if (resendOtpThunk.fulfilled.match(result)) {
      setSuccessMsg(result.payload?.message || 'Đã gửi lại mã OTP.')
      setOtp('')
      startCountdown(OTP_RESEND_COUNTDOWN_SEC)
    }
  }

  // ── Bước 2: Đặt mật khẩu mới ─────────────────────────────────────────────

  async function handleResetPassword(e) {
    e.preventDefault()
    setFormError('')

    if (newPassword !== confirmNewPassword) {
      setFormError('Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại.')
      return
    }
    if (newPassword.length < 8) {
      setFormError('Mật khẩu mới phải có ít nhất 8 ký tự.')
      return
    }

    dispatch(clearError())

    const result = await dispatch(
      resetPasswordThunk({ email, resetToken, newPassword, confirmNewPassword })
    )

    if (resetPasswordThunk.fulfilled.match(result)) {
      navigate('/login', {
        replace: true,
        state: {
          successMsg:
            result.payload?.message ||
            'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập với mật khẩu mới.',
        },
      })
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AuthLayout>
      {/* ── Tiêu đề ── */}
      <div className="mb-3">
        <p className="auth-eyebrow">Tài khoản</p>
        <h2 className="fw-bold mb-0" style={{ fontSize: '1.9rem' }}>
          Khôi phục mật khẩu
        </h2>
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
          Bước 0 — Nhập email
      ════════════════════════════════════════ */}
      {step === 0 && (
        <form onSubmit={handleSendOtp} noValidate>
          <p className="text-muted small mb-3">
            Nhập email đã đăng ký để nhận mã xác thực.
          </p>

          <div className="mb-4">
            <label htmlFor="fp-email" className="form-label">
              Email
            </label>
            <div className="input-group">
              <span className="input-group-text">
                <i className="bi bi-envelope" aria-hidden="true" />
              </span>
              <input
                id="fp-email"
                type="email"
                className="form-control"
                placeholder="example@email.com"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (error) dispatch(clearError())
                }}
                required
              />
            </div>
          </div>

          <LoadingButton
            type="submit"
            loading={loading}
            loadingText="Đang gửi OTP..."
            className="btn btn-brand w-100 py-2 fw-semibold"
          >
            <i className="bi bi-send me-2" aria-hidden="true" />
            Gửi mã OTP
          </LoadingButton>
        </form>
      )}

      {/* ════════════════════════════════════════
          Bước 1 — Xác thực OTP
      ════════════════════════════════════════ */}
      {step === 1 && (
        <form onSubmit={handleVerifyOtp} noValidate>
          <p className="text-muted small mb-1">
            Mã OTP đã được gửi đến{' '}
            <strong className="text-dark">{email}</strong>
          </p>
          <p className="text-muted small mb-0">
            Mã có hiệu lực trong <strong>10 phút</strong>.
          </p>

          <OtpInput value={otp} onChange={setOtp} />

          <LoadingButton
            type="submit"
            loading={loading}
            loadingText="Đang xác thực..."
            className="btn btn-brand w-100 py-2 fw-semibold"
            disabled={otp.length < 6}
          >
            <i className="bi bi-shield-check me-2" aria-hidden="true" />
            Xác nhận OTP
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
                Gửi lại mã OTP
              </button>
            )}
          </div>

          {/* Quay lại bước trước */}
          <div className="text-center mt-2">
            <button
              type="button"
              className="btn btn-link text-muted p-0 small text-decoration-none"
              onClick={() => {
                setStep(0)
                setOtp('')
                clearMessages()
              }}
            >
              ← Thay đổi email
            </button>
          </div>
        </form>
      )}

      {/* ════════════════════════════════════════
          Bước 2 — Đặt mật khẩu mới
      ════════════════════════════════════════ */}
      {step === 2 && (
        <form onSubmit={handleResetPassword} noValidate>
          <p className="text-muted small mb-3">
            Tạo mật khẩu mới cho tài khoản{' '}
            <strong className="text-dark">{email}</strong>.
          </p>

          <PasswordInput
            label="Mật khẩu mới"
            id="fp-newPassword"
            showStrength
            autoComplete="new-password"
            placeholder="Tối thiểu 8 ký tự"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value)
              if (formError) setFormError('')
            }}
            required
          />

          <PasswordInput
            label="Xác nhận mật khẩu mới"
            id="fp-confirmNewPassword"
            autoComplete="new-password"
            placeholder="Nhập lại mật khẩu"
            value={confirmNewPassword}
            onChange={(e) => {
              setConfirmNewPassword(e.target.value)
              if (formError) setFormError('')
            }}
            required
          />

          <LoadingButton
            type="submit"
            loading={loading}
            loadingText="Đang cập nhật..."
            className="btn btn-brand w-100 py-2 fw-semibold mt-1"
          >
            <i className="bi bi-check-circle me-2" aria-hidden="true" />
            Đặt lại mật khẩu
          </LoadingButton>
        </form>
      )}

      {/* ── Link quay lại đăng nhập ── */}
      <p className="text-center mt-4 mb-0">
        <Link to="/login" className="text-muted small text-decoration-none">
          ← Quay lại đăng nhập
        </Link>
      </p>
    </AuthLayout>
  )
}
