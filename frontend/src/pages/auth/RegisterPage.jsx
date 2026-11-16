import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import AuthLayout from '../../components/auth/AuthLayout'
import AuthNotice from '../../components/auth/AuthNotice'
import StepIndicator from '../../components/auth/StepIndicator'
import RegisterPersonalInfoStep from '../../components/auth/RegisterPersonalInfoStep'
import RegisterOtpStep from '../../components/auth/RegisterOtpStep'
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
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/

/**
 * Trang đăng ký (UC01) — Điều phối luồng 2 bước:
 *  Bước 0: RegisterPersonalInfoStep
 *  Bước 1: RegisterOtpStep
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
  const [googleError, setGoogleError] = useState('')

  function handleFormChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (error) dispatch(clearError())
    if (formError) setFormError('')
    if (googleError) setGoogleError('')
  }

  /** Validate form trước khi gửi API */
  function validate() {
    if (!form.fullName.trim()) return 'Vui lòng nhập họ và tên.'
    if (form.fullName.trim().length > 70) return 'Họ và tên không được vượt quá 70 ký tự.'
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

  return (
    <AuthLayout>
      <div className="mb-3">
        <p className="auth-eyebrow">Bắt đầu hành trình</p>
        <h2 className="fw-bold mb-0" style={{ fontSize: '2rem', letterSpacing: '-0.02em' }}>
          Tạo tài khoản
        </h2>
      </div>

      <StepIndicator steps={STEPS} current={step} />

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

      {step === 0 && (
        <RegisterPersonalInfoStep
          form={form}
          onChange={handleFormChange}
          onSubmit={handleRegisterSubmit}
          medicalConfirmed={medicalConfirmed}
          onMedicalConfirmChange={setMedicalConfirmed}
          loading={loading}
          formError={formError}
          onClearFormError={() => setFormError('')}
          onGoogleError={setGoogleError}
        />
      )}

      {step === 1 && (
        <RegisterOtpStep
          registeredEmail={registeredEmail}
          otp={otp}
          onChangeOtp={setOtp}
          onSubmit={handleVerifyOtp}
          loading={loading}
          countdown={countdown}
          onResendOtp={handleResendOtp}
          onBack={handleBackToForm}
        />
      )}

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
