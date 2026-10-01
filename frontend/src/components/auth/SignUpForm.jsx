import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MaterialSymbol from '@/components/MaterialSymbol'
import Divider from './Divider'
import PasswordStrength from './PasswordStrength'
import TextField from './TextField'
import { GoogleButton } from './SignInForm'
import CodeInput from './CodeInput'
import { api } from '@/api/client'
import { useAuth } from '@/auth/AuthContext'

const EMPTY = { name: '', email: '', password: '', confirm: '' }

export default function SignUpForm() {
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [busy, setBusy] = useState(false)
  // Set once the address is proven, so the form swaps to the code step instead
  // of the user wondering whether the email arrived.
  const [pending, setPending] = useState(null)
  const { adoptSession } = useAuth()
  const navigate = useNavigate()

  const mismatch = useMemo(
    () => form.confirm.length > 0 && form.confirm !== form.password,
    [form.confirm, form.password],
  )

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  if (pending) {
    return (
      <VerifyStep
        email={pending.email}
        userId={pending.userId}
        devCode={pending.devCode}
        onBack={() => {
          setPending(null)
          setError('')
        }}
        onVerified={(session) => {
          adoptSession(session)
          navigate('/dashboard', { replace: true })
        }}
      />
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.password || !form.confirm) {
      setError('Fill in every field to create your account.')
      return
    }
    if (mismatch) {
      setError('Passwords do not match.')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setBusy(true)
    setError('')
    setFieldErrors({})
    try {
      const res = await api.signup({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        confirm: form.confirm,
      })
      setPending({ email: res.user.email, userId: res.user.id, devCode: res.devCode })
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
        <h1 className="font-headline-md text-headline-md tracking-tight text-on-surface">
          Start Your Free Cloud Observability Trial
        </h1>
        <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
          No credit card required. Full access to demo &amp; live telemetry.
        </p>
      </div>

      <GoogleButton />
      <Divider className="my-space-md">Or register with work email</Divider>

      <form className="flex flex-col gap-space-sm" onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2">
          <TextField
            label="Full Name"
            icon="badge"
            placeholder="Devin Patel"
            autoComplete="name"
            value={form.name}
            onChange={set('name')}
            error={fieldErrors.name}
            inputClassName="pr-3"
          />
          <TextField
            label="Work Email"
            icon="mail"
            type="email"
            placeholder="devin@acme.corp"
            autoComplete="email"
            value={form.email}
            onChange={set('email')}
            error={fieldErrors.email}
            inputClassName="pr-3"
          />
        </div>

        <div className="mt-1 flex flex-col gap-1.5">
          <TextField
            label="Password"
            icon="key"
            type="password"
            placeholder="Minimum 8 characters"
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
            error={fieldErrors.password}
          />
          <PasswordStrength password={form.password} />
        </div>

        <TextField
          label="Confirm Password"
          icon="verified_user"
          type="password"
          placeholder="Re-enter password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={set('confirm')}
          error={fieldErrors.confirm}
          inputClassName={mismatch ? 'ring-1 ring-status-crit' : ''}
        />

        {mismatch && (
          <p role="alert" className="flex items-center gap-space-xs text-body-sm text-error">
            <MaterialSymbol name="error" className="text-body-sm" />
            Passwords do not match.
          </p>
        )}

        <p className="mt-1 text-center font-body-sm text-body-sm text-on-surface-variant/80">
          By signing up, you agree to our{' '}
          <a href="#terms" className="text-primary-container hover:underline">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="#privacy" className="text-primary-container hover:underline">
            Privacy Policy
          </a>
          .
        </p>

        {error && !mismatch && (
          <p role="alert" className="flex items-center gap-space-xs text-body-sm text-error">
            <MaterialSymbol name="error" className="text-body-sm" />
            {error}
          </p>
        )}

        <button type="submit" className="btn-auth-primary mt-1" disabled={busy}>
          <span>{busy ? 'Creating Account…' : 'Create Account'}</span>
          <MaterialSymbol name="rocket_launch" className="text-title-md" />
        </button>
      </form>
    </div>
  )
}

/**
 * Second step: prove the address. The code arrives by email; with no SMTP
 * configured the API also returns it as `devCode` so the flow works locally.
 */
function VerifyStep({ email, userId, devCode: initialDevCode, onBack, onVerified }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [resent, setResent] = useState('')
  const [devCode, setDevCode] = useState(initialDevCode)

  async function handleSubmit(e) {
    e.preventDefault()
    if (code.length !== 6) {
      setError('Enter all 6 digits.')
      return
    }
    setBusy(true)
    setError('')
    try {
      onVerified(await api.verifyEmail(userId, code))
    } catch (err) {
      setError(err.message)
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  async function handleResend() {
    setResent('')
    try {
      const res = await api.resendVerification(email)
      if (res?.devCode) setDevCode(res.devCode)
      setResent('If that address needs verifying, a new code is on its way.')
    } catch (err) {
      setResent(err.message)
    }
  }

  return (
    <div className="flex flex-col">
      <div className="mb-space-lg">
        <h1 className="font-headline-md text-headline-md tracking-tight text-on-surface">
          Check your inbox
        </h1>
        <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
          We sent a 6-digit code to <span className="text-on-surface">{email}</span>.
        </p>
      </div>

      {devCode && (
        <p className="mb-space-md rounded-lg border border-status-warn/40 bg-status-warn/10 px-space-md py-2 font-code-sm text-code-sm text-status-warn">
          Dev mode — no SMTP configured, so your code is{' '}
          <strong className="font-semibold text-on-surface">{devCode}</strong>
        </p>
      )}

      <form className="flex flex-col gap-space-md" onSubmit={handleSubmit} noValidate>
        <CodeInput value={code} onChange={setCode} disabled={busy} />

        {error && (
          <p role="alert" className="flex items-center gap-space-xs text-body-sm text-error">
            <MaterialSymbol name="error" className="text-body-sm" />
            {error}
          </p>
        )}

        <button type="submit" className="btn-auth-primary" disabled={busy || code.length !== 6}>
          <span>{busy ? 'Verifying…' : 'Verify & Continue'}</span>
          <MaterialSymbol name="verified" className="text-title-md" />
        </button>
      </form>

      <div className="mt-space-md flex items-center justify-center gap-space-sm text-body-sm text-on-surface-variant">
        <button type="button" onClick={handleResend} className="text-primary-container hover:underline">
          Resend code
        </button>
        <span aria-hidden>·</span>
        <button type="button" onClick={onBack} className="text-primary-container hover:underline">
          Use a different email
        </button>
      </div>

      {resent && (
        <p role="status" className="mt-space-sm text-center font-body-sm text-body-sm text-on-surface-variant">
          {resent}
        </p>
      )}
    </div>
  )
}
