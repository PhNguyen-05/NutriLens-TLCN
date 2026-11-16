import OtpInput from './OtpInput'
import LoadingButton from '../common/LoadingButton'

/**
 * Bước 1 của trang Đăng ký: Nhập mã OTP xác thực email.
 */
export default function RegisterOtpStep({
  registeredEmail,
  otp,
  onChangeOtp,
  onSubmit,
  loading,
  countdown,
  onResendOtp,
  onBack,
}) {
  return (
    <form onSubmit={onSubmit} noValidate>
      {/* Icon email lớn */}
      <div className="text-center mb-3">
        <div
          className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
          style={{
            width: 72,
            height: 72,
            background: 'linear-gradient(135deg, #d1fae5, #ecfdf5)',
            border: '2px solid #a7f3d0',
          }}
        >
          <i className="bi bi-envelope-check fs-3" style={{ color: 'var(--nl-brand-mid)' }} aria-hidden="true" />
        </div>
        <p className="mb-1 fw-semibold" style={{ fontSize: '1.1rem' }}>Kiểm tra hộp thư của bạn</p>
        <p className="text-muted small mb-0">
          Mã xác thực 6 chữ số đã được gửi đến
        </p>
        <p className="fw-semibold small" style={{ color: 'var(--nl-brand-mid)' }}>
          {registeredEmail}
        </p>
      </div>

      <OtpInput value={otp} onChange={onChangeOtp} />

      <p className="text-muted text-center" style={{ fontSize: 12 }}>
        Mã có hiệu lực trong <strong>5 phút</strong>. Kiểm tra cả thư mục spam nếu không nhận được.
      </p>

      <LoadingButton
        type="submit"
        loading={loading}
        loadingText="Đang xác thực..."
        className="btn btn-brand w-100 py-2 fw-semibold mt-1"
        disabled={otp.length < 6}
        style={{ height: 48 }}
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
            onClick={onResendOtp}
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
          onClick={onBack}
        >
          ← Quay lại chỉnh sửa thông tin
        </button>
      </div>
    </form>
  )
}
