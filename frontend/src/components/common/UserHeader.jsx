import { Link, useLocation } from 'react-router-dom'
import FoodNavMenu from './FoodNavMenu'
import ExerciseNavMenu from './ExerciseNavMenu'
import UserNavMenu from './UserNavMenu'
import nutrilensLogo from '../../assets/nutrilens-logo.jpg'

export default function UserHeader() {
  const { pathname } = useLocation()

  return (
    <header className="dashboard-header">
      <Link className="dashboard-logo" to="/">
        <img src={nutrilensLogo} alt="NutriLens" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} /> NutriLens
      </Link>
      <nav className="dashboard-nav" aria-label="Điều hướng chính">
        <Link className={pathname === '/dashboard' || pathname === '/' ? 'active' : ''} to="/">
          Tổng quan
        </Link>
        <FoodNavMenu />
        <ExerciseNavMenu />
        <Link
          className={pathname === '/trends' || pathname === '/analytics' || pathname === '/stats' ? 'active' : ''}
          to="/trends"
        >
          Chỉ số &amp; Xu hướng
        </Link>
        <Link className={pathname === '/weight-tracker' ? 'active' : ''} to="/weight-tracker">
          Tiến trình &amp; Cân nặng
        </Link>
        <Link className={pathname === '/community' ? 'active' : ''} to="/community">
          Cộng đồng
        </Link>
        <Link className={pathname.startsWith('/articles') ? 'active' : ''} to="/articles">
          Bài viết &amp; Mẹo
        </Link>
      </nav>
      <div className="dashboard-actions">
        <button className="dashboard-bell" type="button" aria-label="Thông báo" title="Thông báo">
          <i className="bi bi-bell" />
        </button>
        <UserNavMenu />
      </div>
    </header>
  )
}
