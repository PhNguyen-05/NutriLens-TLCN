import { Link } from 'react-router-dom'

export default function UserFooter() {
  return (
    <footer className="modern-footer">
      <div className="modern-footer__container">
        {/* HÀNG TRÊN: 4 CỘT THÔNG TIN CHUYÊN NGHIỆP */}
        <div className="modern-footer__grid">
          {/* CỘT 1: THƯƠNG HIỆU & GIỚI THIỆU */}
          <div className="modern-footer__brand-col">
            <Link to="/dashboard" className="modern-footer__logo">
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
                <Link to="/dashboard">
                  <i className="bi bi-speedometer2" /> Tổng quan dinh dưỡng
                </Link>
              </li>
              <li>
                <Link to="/food-scan">
                  <i className="bi bi-camera" /> Nhận diện món ăn AI
                </Link>
              </li>
              <li>
                <Link to="/meal-diary">
                  <i className="bi bi-journal-text" /> Nhật ký bữa ăn
                </Link>
              </li>
              <li>
                <Link to="/exercise">
                  <i className="bi bi-activity" /> Luyện tập &amp; Vận động
                </Link>
              </li>
              <li>
                <Link to="/weight-tracker">
                  <i className="bi bi-graph-up-arrow" /> Tiến trình cân nặng
                </Link>
              </li>
            </ul>
          </div>

          {/* CỘT 3: CỘNG ĐỒNG & BÀI VIẾT */}
          <div className="modern-footer__col">
            <h4 className="modern-footer__title">Khám phá &amp; Kết nối</h4>
            <ul className="modern-footer__list">
              <li>
                <Link to="/community">
                  <i className="bi bi-people" /> Cộng đồng NutriLens
                </Link>
              </li>
              <li>
                <Link to="/articles">
                  <i className="bi bi-journal-richtext" /> Bài viết &amp; Mẹo sống khỏe
                </Link>
              </li>
              <li>
                <Link to="/profile">
                  <i className="bi bi-person-gear" /> Hồ sơ cá nhân &amp; Sức khỏe
                </Link>
              </li>
              <li>
                <Link to="/food-requests">
                  <i className="bi bi-plus-circle" /> Yêu cầu bổ sung món
                </Link>
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
