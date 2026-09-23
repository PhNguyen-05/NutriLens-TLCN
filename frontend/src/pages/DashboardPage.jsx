import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/**
 * Placeholder trang Dashboard — sẽ được thay bằng UI thật sau khi phát triển.
 * Hiện tại dùng để test luồng đăng nhập thành công.
 */
export default function DashboardPage() {
  const { user, handleLogout } = useAuth()
  const navigate = useNavigate()

  return (
    <div
      className="min-vh-100 d-flex align-items-center justify-content-center"
      style={{ background: 'var(--nl-bg)' }}
    >
      <div
        className="card border-0 text-center p-5 dashboard-card"
        style={{ boxShadow: 'var(--nl-shadow-card)' }}
      >
        {/* Logo */}
        <div className="brand-mark mx-auto mb-4">NL</div>

        {/* Chào mừng */}
        <h2 className="fw-bold mb-1">
          Xin chào, {user?.fullName}! 👋
        </h2>
        <p className="text-muted small mb-0">{user?.email}</p>
        <p className="text-muted small mb-0">
          Vai trò:{' '}
          <span className="fw-semibold">
            {user?.role === 'admin' ? 'Quản trị viên' : 'Người dùng'}
          </span>
        </p>

        {/* Divider */}
        <hr className="my-4" />

        {/* Thông báo placeholder */}
        <div className="alert alert-info py-2 small mb-4" role="alert">
          <i className="bi bi-info-circle me-2" aria-hidden="true" />
          Dashboard đang được phát triển. Quay lại sau nhé!
        </div>

        {/* Actions */}
        <div className="d-flex gap-2 justify-content-center flex-wrap">
          <button
            className="btn btn-brand px-4"
            onClick={() => navigate('/dashboard')}
          >
            <i className="bi bi-house me-2" aria-hidden="true" />
            Trang chủ
          </button>
          <button
            className="btn btn-outline-danger px-4"
            onClick={handleLogout}
          >
            <i className="bi bi-box-arrow-right me-2" aria-hidden="true" />
            Đăng xuất
          </button>
        </div>
      </div>
    </div>
  )
}
