import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { logout } from '../store/slices/authSlice'

/**
 * Hook tiện ích cho auth state.
 * Dùng ở bất kỳ component nào cần biết user hiện tại hoặc thực hiện logout.
 *
 * @example
 * const { user, isAuthenticated, handleLogout } = useAuth()
 */
export function useAuth() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { user, accessToken, loading, error } = useSelector((state) => state.auth)

  function handleLogout() {
    dispatch(logout())
    navigate('/login', { replace: true })
  }

  return {
    user,
    accessToken,
    isAuthenticated: Boolean(user && accessToken),
    loading,
    error,
    handleLogout,
  }
}
