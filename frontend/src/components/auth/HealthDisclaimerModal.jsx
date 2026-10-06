import { useState } from 'react'

/**
 * Modal xác nhận tiêu chuẩn đối tượng sử dụng (Y tế)
 * Dành riêng cho luồng đăng ký Google hoặc các luồng cần xác thực điều kiện sức khỏe.
 * Nếu người dùng từ chối / hủy, hoàn toàn KHÔNG tạo tài khoản trong DB.
 */
export default function HealthDisclaimerModal({
  isOpen,
  userInfo,
  onConfirm,
  onCancel,
  loading = false,
}) {
  const [agreed, setAgreed] = useState(false)

  if (!isOpen) return null

  const displayName = userInfo?.fullName || userInfo?.email || 'bạn'

  return (
    <div className="health-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="health-modal-title">
      <div className="health-modal-dialog">
        {/* Header */}
        <div className="health-modal-header">
          <div className="health-modal-badge">
            <i className="bi bi-shield-check" aria-hidden="true" />
          </div>
          <div>
            <h5 id="health-modal-title" className="fw-bold mb-1" style={{ color: '#065f46' }}>
              Tiêu chuẩn Đối tượng Sử dụng
            </h5>
            <p className="text-muted small mb-0">
              Khuyến nghị an toàn theo chuẩn y tế NutriLens
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="health-modal-body">
          <p className="small text-secondary mb-2" style={{ lineHeight: 1.5 }}>
            Chào mừng <strong>{displayName}</strong>! Trước khi NutriLens tạo tài khoản và tính toán lộ trình dinh dưỡng cho bạn, vui lòng xác nhận bạn đáp ứng các tiêu chuẩn sức khỏe sau:
          </p>

          <div className="health-modal-list">
            <div className="health-modal-item">
              <span className="health-modal-item-icon">👤</span>
              <div className="health-modal-item-text">
                <strong>Từ 18 tuổi trở lên</strong>
                <p>NutriLens thiết kế công thức tính BMR/TDEE và phân bổ đa lượng cho người trưởng thành.</p>
              </div>
            </div>

            <div className="health-modal-item">
              <span className="health-modal-item-icon">🤰</span>
              <div className="health-modal-item-text">
                <strong>Không mang thai hoặc cho con bú</strong>
                <p>Giai đoạn này cần lượng vi chất và năng lượng đặc thù, thuật toán chuẩn không áp dụng.</p>
              </div>
            </div>

            <div className="health-modal-item">
              <span className="health-modal-item-icon">🩺</span>
              <div className="health-modal-item-text">
                <strong>Không mắc bệnh nền mạn tính</strong>
                <p>Tiểu đường, suy tim, bệnh thận mạn, bệnh gan, gút... cần phác đồ điều trị từ bác sĩ chuyên khoa.</p>
              </div>
            </div>
          </div>

          <div className="p-2 px-3 rounded-2 mb-3" style={{ background: '#f8fafc', border: '1px dashed #cbd5e1' }}>
            <p className="text-muted mb-0" style={{ fontSize: '11px', lineHeight: 1.45 }}>
              *Các phân tích calo và gợi ý bữa ăn từ NutriLens mang tính tham khảo lối sống lành mạnh, không có giá trị thay thế chỉ định hoặc điều trị y tế.
            </p>
          </div>

          {/* Checkbox cam kết */}
          <div className={`form-check health-modal-check ${agreed ? 'is-active' : ''}`}>
            <input
              type="checkbox"
              className="form-check-input"
              id="modal-health-agree"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="modal-health-agree">
              Tôi xác nhận mình là người trưởng thành khỏe mạnh, không thuộc các trường hợp trên và đồng ý tiếp tục. <span className="text-danger">*</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="health-modal-footer">
          <button
            type="button"
            className="btn btn-brand w-100 py-2 fw-semibold mb-2"
            disabled={!agreed || loading}
            onClick={onConfirm}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                Đang hoàn tất đăng ký...
              </>
            ) : (
              <>
                <i className="bi bi-check2-circle me-1" aria-hidden="true" />
                Tôi đủ điều kiện &amp; Hoàn tất đăng ký
              </>
            )}
          </button>

          <button
            type="button"
            className="btn btn-light w-100 py-2 text-secondary fw-semibold border-0"
            disabled={loading}
            onClick={onCancel}
          >
            <i className="bi bi-x-circle me-1" aria-hidden="true" />
            Tôi không thuộc đối tượng này (Hủy bỏ)
          </button>
        </div>
      </div>
    </div>
  )
}
