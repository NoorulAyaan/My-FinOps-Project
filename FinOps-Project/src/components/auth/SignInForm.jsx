import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GoogleIcon from '@/components/GoogleIcon'
import MaterialSymbol from '@/components/MaterialSymbol'
import Divider from './Divider'
import TextField from './TextField'
import { api } from '@/api/client'
import { useAuth } from '@/auth/AuthContext'

export default function SignInForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const { adoptSession } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Enter your work email and password to continue.')
      return
    }

    setBusy(true)
    setError('')
    setFieldErrors({})
    try {
      const session = await api.signin({ email: email.trim(), password, remember })
      adoptSession(session)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message)
      setFieldErrors(err.details ?? {})
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col">
      <div className="mb-space-lg">
        <h1 className="font-headline-md text-headline-md tracking-tight text-on-surface">Welcome Back</h1>
        <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
          Sign in to access your cloud infrastructure dashboard.
        </p>
      </div>

      <GoogleButton />
      <Divider className="my-space-lg">Or continue with enterprise email</Divider>

      <form className="flex flex-col gap-space-md" onSubmit={handleSubmit} noValidate>
        <TextField
          label="Work Email Address"
          icon="mail"
          type="email"
          placeholder="alex@company.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
        />

        <TextField
          label="Password"
          icon="lock"
          type="password"
          placeholder="••••••••••••"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
        />

        <div className="mt-1 flex items-center justify-between">
          <label className="flex cursor-pointer select-none items-center gap-2">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded bg-surface-container-lowest accent-primary-container"
            />
            <span className="font-body-sm text-body-sm text-on-surface-variant">Remember me for 30 days</span>
          </label>
          <a href="#forgot" className="font-title-md text-title-md text-primary-container hover:underline">
            Forgot Password?
          </a>
        </div>

        {error && (
          <p role="alert" className="flex items-center gap-space-xs text-body-sm text-error">
            <MaterialSymbol name="error" className="text-body-sm" />
            {error}
          </p>
        )}

        <button type="submit" className="btn-auth-primary" disabled={busy}>
          <span>{busy ? 'Signing In…' : 'Sign In to CloudPulse'}</span>
          <MaterialSymbol name="arrow_forward" className="text-title-md" />
        </button>
      </form>
    </div>
  )
}

export function GoogleButton() {
  return (
    <button
      type="button"
      disabled
      title="Not wired up yet"
      className="flex w-full items-center justify-center gap-space-md rounded-lg bg-surface-container-highest px-space-md py-3 font-title-md text-title-md text-on-surface opacity-50 shadow-sm"
    >
      <GoogleIcon />
      <span>Continue with Google</span>
    </button>
  )
}
