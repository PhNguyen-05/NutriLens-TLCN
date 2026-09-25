import { Navigate, Route, Routes } from 'react-router-dom'
import { useSelector } from 'react-redux'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import DashboardPage from './pages/user/DashboardPage'
import HealthProfilePage from './pages/user/HealthProfilePage'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'

function isAdminUser(user) {
  return String(user?.role || '').toLowerCase() === 'admin'
}

// ---------------------------------------------------------------------------
// Route Guards
// ---------------------------------------------------------------------------

/**
 * Route chỉ dành cho user ĐÃ đăng nhập.
 * Redirect về /login nếu chưa xác thực.
 */
function PrivateRoute({ children }) {
  const { user, accessToken } = useSelector((state) => state.auth)
  if (!user || !accessToken) return <Navigate to="/login" replace />
  return isAdminUser(user) ? <Navigate to="/admin" replace /> : children
}

function AdminRoute({ children }) {
  const { user, accessToken } = useSelector((state) => state.auth)
  return user && accessToken && isAdminUser(user) ? children : <Navigate to="/dashboard" replace />
}

/**
 * Route chỉ dành cho user CHƯA đăng nhập (login, register, forgot-password).
 * Redirect về /dashboard nếu đã xác thực, tránh truy cập lại form login khi đang có session.
 */
function PublicRoute({ children }) {
  const { user, accessToken } = useSelector((state) => state.auth)
  return user && accessToken ? <Navigate to={isAdminUser(user) ? '/admin' : '/dashboard'} replace /> : children
}

// ---------------------------------------------------------------------------
// App Routes
// ---------------------------------------------------------------------------
export default function App() {
  return (
    <Routes>
      {/* Mặc định redirect về trang đăng nhập */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Auth (Public) */}
      <Route
        path="/login"
        element={<PublicRoute><LoginPage /></PublicRoute>}
      />
      <Route
        path="/register"
        element={<PublicRoute><RegisterPage /></PublicRoute>}
      />
      <Route
        path="/forgot-password"
        element={<PublicRoute><ForgotPasswordPage /></PublicRoute>}
      />

      {/* Protected */}
      <Route
        path="/dashboard"
        element={<PrivateRoute><DashboardPage /></PrivateRoute>}
      />
      <Route
        path="/profile"
        element={<PrivateRoute><HealthProfilePage /></PrivateRoute>}
      />
      <Route
        path="/nutrition-goal"
        element={<Navigate to="/profile" replace />}
      />
      <Route
        path="/admin"
        element={<AdminRoute><AdminDashboardPage /></AdminRoute>}
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
