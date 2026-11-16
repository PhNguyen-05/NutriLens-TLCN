import { useRef } from 'react'
import PasswordInput from './PasswordInput'
import LoadingButton from '../common/LoadingButton'
import GoogleAuthButton from './GoogleAuthButton'

const GENDER_OPTIONS = [
  { value: '', label: 'Chọn giới tính' },
  { value: 'male', label: '👨 Nam' },
  { value: 'female', label: '👩 Nữ' },
  { value: 'other', label: '🧑 Khác' },
]

/**
 * Bước 0 của trang Đăng ký: Nhập thông tin cá nhân và tài khoản.
 */
export default function RegisterPersonalInfoStep({
  form,
  onChange,
  onSubmit,
  medicalConfirmed,
  onMedicalConfirmChange,
  loading,
  formError,
  onClearFormError,
  onGoogleError,
}) {
  const dobInputRef = useRef(null)

  return (
    <>
      {/* Nút Đăng ký nhanh Google */}
      <GoogleAuthButton
        buttonText="signup_with"
        medicalConfirmed={medicalConfirmed}
        onError={onGoogleError}
      />

      <div className="auth-divider">
        <span>hoặc đăng ký bằng email</span>
      </div>

      <form onSubmit={onSubmit} noValidate>
        {/* Họ và tên - Giới hạn tối đa 70 ký tự */}
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
              maxLength={70}
              className="form-control"
              placeholder="Nguyễn Văn A (tối đa 70 ký tự)"
              autoComplete="name"
              value={form.fullName}
              onChange={onChange}
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
              onChange={onChange}
              required
            />
          </div>
        </div>

        {/* Ngày sinh + Giới tính */}
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
                onChange={onChange}
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
                onChange={onChange}
              >
                {GENDER_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Mật khẩu + Xác nhận mật khẩu */}
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
              onChange={onChange}
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
              onChange={onChange}
              required
            />
          </div>
        </div>

        {/* Thẻ Tiêu chuẩn An toàn Y tế NutriLens */}
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
                onMedicalConfirmChange(e.target.checked)
                if (formError) onClearFormError()
              }}
            />
            <label className="form-check-label" htmlFor="reg-medical-confirm" style={{ fontSize: '11.4px', lineHeight: 1.6 }}>
              Tôi xác nhận đủ điều kiện sức khỏe trên và hiểu rằng NutriLens không thay thế chỉ định y khoa.{' '}
              <span className="text-danger" style={{ whiteSpace: 'nowrap' }}>*</span>
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
          style={{ height: 48 }}
        >
          <i className="bi bi-person-plus me-2" aria-hidden="true" />
          Đăng ký tài khoản
        </LoadingButton>
      </form>
    </>
  )
}
