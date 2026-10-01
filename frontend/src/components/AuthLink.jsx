import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'

/**
 * A link that only sends anonymous visitors to sign-in.
 *
 * Hardcoding `to="/login"` on a marketing CTA means a signed-in user who clicks
 * it gets bounced to the login page mid-session. `signedOutTo` is the fallback;
 * `signedInTo` is where an authenticated visitor actually belongs.
 */
export default function AuthLink({ signedOutTo = '/login', signedInTo = '/dashboard', children, ...rest }) {
  const { status } = useAuth()

  // While the session is being restored, the destination is unknown. Sending the
  // user straight to their destination is harmless: RequireAuth re-checks the
  // token and redirects only if it turns out to be missing.
  const to = status === 'anonymous' ? signedOutTo : signedInTo

  return (
    <Link to={to} {...rest}>
      {children}
    </Link>
  )
}