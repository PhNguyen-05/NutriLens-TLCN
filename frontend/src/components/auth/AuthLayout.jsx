import heroImg from '../../assets/hero.png'

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
        <div>
          <div className="brand-mark">NL</div>
          <p className="brand-eyebrow">NutriLens</p>
          <h1 className="brand-heading">
            Theo dõi dinh dưỡng từ bữa ăn hằng ngày
          </h1>
          <p className="brand-copy">
            Nhận diện món ăn, quản lý mục tiêu sức khỏe và giữ dữ liệu tài
            khoản an toàn trong một trải nghiệm gọn gàng.
          </p>

          <ul className="brand-features list-unstyled mt-4">
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

        <img src={heroImg} alt="" className="brand-image" aria-hidden="true" />
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
