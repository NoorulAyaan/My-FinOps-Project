import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthShell from '@/components/auth/AuthShell'
import SignInForm from '@/components/auth/SignInForm'
import SignUpForm from '@/components/auth/SignUpForm'

export default function Auth({ initialMode = 'signin' }) {
  const [mode, setMode] = useState(initialMode)
  const isSignIn = mode === 'signin'
  const navigate = useNavigate()

  // Keep the address bar in step with the active tab, so /signup is what you see
  // on Create Account and /login on Sign In. replace: true avoids a history entry
  // per tab switch.
  useEffect(() => {
    navigate(isSignIn ? '/login' : '/signup', { replace: true })
  }, [isSignIn, navigate])

  return (
    <AuthShell
      footer={
        <>
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            {isSignIn ? "Don't have an account?" : 'Already have an account?'}
          </span>
          <button
            type="button"
            onClick={() => setMode(isSignIn ? 'signup' : 'signin')}
            className="ml-2 font-title-md text-title-md text-primary-container hover:underline"
          >
            {isSignIn ? 'Sign Up' : 'Sign In'}
          </button>
        </>
      }
    >
      {/* Active view */}
      <div role="tabpanel" id={`view-${mode}`} aria-labelledby={`tab-${mode}`} className="flex w-full flex-col">
        {isSignIn ? <SignInForm /> : <SignUpForm />}
      </div>
    </AuthShell>
  )
}