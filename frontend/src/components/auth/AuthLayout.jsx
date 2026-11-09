import heroMeal from '../../assets/hero-meal.jpg'
import nutrilensLogo from '../../assets/nutrilens-logo.jpg'

const FEATURES = [
  { icon: 'bi-camera', text: 'Nhận diện món ăn bằng AI' },
  { icon: 'bi-graph-up-arrow', text: 'Theo dõi calo & dinh dưỡng' },
  { icon: 'bi-bullseye', text: 'Quản lý mục tiêu sức khỏe' },
]

/**
 * Layout 2 cột dùng chung cho tất cả trang auth.
 * - Cột trái: Brand panel màu xanh đậm với logo, tagline, tính năng nổi bật
 * - Cột phải: Slot `children` chứa form
 *
 * @param {ReactNode} children - Nội dung form auth
 */
export default function AuthLayout({ children }) {
  return (
    <div className="auth-shell">
      {/* ── Brand Panel ── */}
      <section className="brand-panel" aria-label="NutriLens">
        <div className="brand-panel__content">
          {/* Logo + Brand name inline */}
          <div className="brand-logo-row">
            <img
              src={nutrilensLogo}
              alt="NutriLens Logo"
              className="brand-logo-img"
            />
            <span className="brand-logo-text">NutriLens</span>
          </div>

          <h1 className="brand-heading">
            Theo dõi dinh dưỡng thông minh mỗi ngày
          </h1>

          <ul className="brand-features list-unstyled mt-3">
            {FEATURES.map(({ icon, text }) => (
              <li key={text} className="brand-feature-item">
                <span className="brand-feature-icon">
                  <i className={`bi ${icon}`} aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>

        </div>

        {/* ── Hero image ── */}
        <div className="brand-hero-wrap">
          <img
            src={heroMeal}
            alt="NutriLens nhận diện dinh dưỡng món ăn bằng AI"
            className="brand-hero-img"
          />
        </div>
      </section>

      {/* ── Auth Panel ── */}
      <section className="auth-panel" aria-label="Xác thực tài khoản">
        <div className="auth-form-wrapper mx-auto">
          {children}
        </div>
      </section>
    </div>
  )
}
