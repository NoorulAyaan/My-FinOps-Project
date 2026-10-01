import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'

/**
 * Gate for authenticated routes. `state.from` lets the sign-in page send the
 * user back where they were headed instead of always to /dashboard.
 */
export default function RequireAuth({ children }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface font-body-md text-on-surface-variant">
        Checking your session…
      </div>
    )
  }

  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}
