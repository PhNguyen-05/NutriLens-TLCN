import { Link } from 'react-router-dom'

function FooterLink({ to, isGuest, requiresLogin = false, onRequireLogin, children }) {
  if (isGuest && requiresLogin) {
    return (
      <a
        href="#login-required"
        onClick={(event) => {
          event.preventDefault()
          onRequireLogin?.('Bạn cần đăng nhập để sử dụng tính năng dành cho thành viên.')
        }}
      >
        {children}
      </a>
    )
  }

  return <Link to={isGuest && to === '/dashboard' ? '/' : to}>{children}</Link>
}

export default function UserFooter({ isGuest = false, onRequireLogin }) {
  return (
    <footer className="modern-footer">
      <div className="modern-footer__container">
        {/* HÀNG TRÊN: 4 CỘT THÔNG TIN CHUYÊN NGHIỆP */}
        <div className="modern-footer__grid">
          {/* CỘT 1: THƯƠNG HIỆU & GIỚI THIỆU */}
          <div className="modern-footer__brand-col">
            <Link to={isGuest ? '/' : '/dashboard'} className="modern-footer__logo">
              <span className="modern-footer__logo-icon">
                <i className="bi bi-leaf-fill" />
              </span>
              <span className="modern-footer__logo-text">NutriLens</span>
            </Link>
            <p className="modern-footer__desc">
              Hệ sinh thái thông minh theo dõi dinh dưỡng, nhận diện calo qua hình ảnh bằng AI và đồng hành rèn luyện thể chất cá nhân hóa mỗi ngày.
            </p>
            <div className="modern-footer__trust-tags">
              <span className="modern-footer__tag">
                <i className="bi bi-shield-check" /> Chuẩn BMR/TDEE Y khoa
              </span>
              <span className="modern-footer__tag">
                <i className="bi bi-stars" /> Trợ lý AI Vision
              </span>
            </div>
            <div style={{ marginTop: '16px', fontSize: '12px', color: '#94a3b8' }}>
              &copy; {new Date().getFullYear()} NutriLens Health Inc.
            </div>
          </div>

          {/* CỘT 2: TÍNH NĂNG CHÍNH */}
          <div className="modern-footer__col">
            <h4 className="modern-footer__title">Tính năng cốt lõi</h4>
            <ul className="modern-footer__list">
              <li>
                <FooterLink to="/dashboard" isGuest={isGuest}>
                  <i className="bi bi-speedometer2" /> Tổng quan dinh dưỡng
                </FooterLink>
              </li>
              <li>
                <FooterLink to="/food-scan" isGuest={isGuest} requiresLogin onRequireLogin={onRequireLogin}>
                  <i className="bi bi-camera" /> Nhận diện món ăn AI
                </FooterLink>
              </li>
              <li>
                <FooterLink to="/meal-diary" isGuest={isGuest} requiresLogin onRequireLogin={onRequireLogin}>
                  <i className="bi bi-journal-text" /> Nhật ký bữa ăn
                </FooterLink>
              </li>
              <li>
                <FooterLink to="/exercise" isGuest={isGuest} requiresLogin onRequireLogin={onRequireLogin}>
                  <i className="bi bi-activity" /> Luyện tập &amp; Vận động
                </FooterLink>
              </li>
              <li>
                <FooterLink to="/trends" isGuest={isGuest} requiresLogin onRequireLogin={onRequireLogin}>
                  <i className="bi bi-bar-chart-line" /> Chỉ số &amp; Xu hướng (Thống kê)
                </FooterLink>
              </li>
              <li>
                <FooterLink to="/weight-tracker" isGuest={isGuest} requiresLogin onRequireLogin={onRequireLogin}>
                  <i className="bi bi-graph-up-arrow" /> Tiến trình cân nặng
                </FooterLink>
              </li>
            </ul>
          </div>

          {/* CỘT 3: CỘNG ĐỒNG & BÀI VIẾT */}
          <div className="modern-footer__col">
            <h4 className="modern-footer__title">Khám phá &amp; Kết nối</h4>
            <ul className="modern-footer__list">
              <li>
                <FooterLink to="/community" isGuest={isGuest}>
                  <i className="bi bi-people" /> Cộng đồng NutriLens
                </FooterLink>
              </li>
              <li>
                <FooterLink to="/articles" isGuest={isGuest}>
                  <i className="bi bi-journal-richtext" /> Bài viết &amp; Mẹo sống khỏe
                </FooterLink>
              </li>
              <li>
                <FooterLink to="/profile" isGuest={isGuest} requiresLogin onRequireLogin={onRequireLogin}>
                  <i className="bi bi-person-gear" /> Hồ sơ cá nhân &amp; Sức khỏe
                </FooterLink>
              </li>
              <li>
                <FooterLink to="/food-requests" isGuest={isGuest} requiresLogin onRequireLogin={onRequireLogin}>
                  <i className="bi bi-plus-circle" /> Yêu cầu bổ sung món
                </FooterLink>
              </li>
            </ul>
          </div>

          {/* CỘT 4: HỖ TRỢ & BẢO MẬT */}
          <div className="modern-footer__col">
            <h4 className="modern-footer__title">Hỗ trợ &amp; Pháp lý</h4>
            <ul className="modern-footer__list">
              <li>
                <a href="#terms" onClick={(e) => e.preventDefault()}>
                  <i className="bi bi-file-earmark-text" /> Điều khoản dịch vụ
                </a>
              </li>
              <li>
                <a href="#privacy" onClick={(e) => e.preventDefault()}>
                  <i className="bi bi-shield-lock" /> Chính sách bảo mật y tế
                </a>
              </li>
              <li>
                <a href="#disclaimer" onClick={(e) => e.preventDefault()}>
                  <i className="bi bi-heart-pulse" /> Miễn trừ trách nhiệm y tế
                </a>
              </li>
              <li>
                <a href="#support" onClick={(e) => e.preventDefault()}>
                  <i className="bi bi-question-circle" /> Trung tâm trợ giúp
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  )
}
