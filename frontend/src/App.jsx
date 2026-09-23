import { Navigate, Route, Routes } from 'react-router-dom'
import { useSelector } from 'react-redux'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage'
import DashboardPage from './pages/DashboardPage'

// ---------------------------------------------------------------------------
// Route Guards
// ---------------------------------------------------------------------------

/**
 * Route chỉ dành cho user ĐÃ đăng nhập.
 * Redirect về /login nếu chưa xác thực.
 */
function PrivateRoute({ children }) {
  const { user, accessToken } = useSelector((state) => state.auth)
  return user && accessToken ? children : <Navigate to="/login" replace />
}

/**
 * Route chỉ dành cho user CHƯA đăng nhập (login, register, forgot-password).
 * Redirect về /dashboard nếu đã xác thực, tránh truy cập lại form login khi đang có session.
 */
function PublicRoute({ children }) {
  const { user, accessToken } = useSelector((state) => state.auth)
  return user && accessToken ? <Navigate to="/dashboard" replace /> : children
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

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
