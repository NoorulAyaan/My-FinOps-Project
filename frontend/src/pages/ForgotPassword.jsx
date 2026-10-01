import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MaterialSymbol from '@/components/MaterialSymbol'
import AuthShell from '@/components/auth/AuthShell'
import CodeInput from '@/components/auth/CodeInput'
import PasswordStrength from '@/components/auth/PasswordStrength'
import TextField from '@/components/auth/TextField'
import { api } from '@/api/client'

/**
 * Two steps on one screen: ask for the address, then take the emailed code and
 * the new password. The address carries across the step change so the user
 * types it once.
 */
export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [requested, setRequested] = useState(false)
  const [devCode, setDevCode] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [busy, setBusy] = useState(false)

  async function handleRequest(e) {
    e.preventDefault()
    if (!email.trim()) {
      setError('Enter the email address on your account.')
      return
    }
    setBusy(true)
    setError('')
    setFieldErrors({})
    setNotice('')
    try {
      const res = await api.forgotPassword(email.trim())
      // With no SMTP configured the API also returns the code, so the flow is
      // usable locally. With SMTP on, this field is simply absent.
      if (res?.devCode) setDevCode(res.devCode)
      setRequested(true)
    } catch (err) {
      setError(err.message)
      setFieldErrors(err.details ?? {})
    } finally {
      setBusy(false)
    }
  }

  if (requested) {
    return (
      <ResetStep
        email={email.trim()}
        devCode={devCode}
        notice={notice}
        onNotice={setNotice}
        onChangeEmail={() => {
          setRequested(false)
          setDevCode('')
          setNotice('')
          setError('')
        }}
      />
    )
  }

  return (
    <AuthShell
      footer={
        <>
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            Remembered it?
          </span>
          <Link to="/login" className="ml-2 font-title-md text-title-md text-primary-container hover:underline">
            Sign In
          </Link>
        </>
      }
    >
      <div className="flex flex-col">
        <div className="mb-space-lg">
          <h1 className="font-headline-md text-headline-md tracking-tight text-on-surface">
            Reset your password
          </h1>
          <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
            Enter your account email and we&apos;ll send you a 6-digit reset code.
          </p>
        </div>

        <form className="flex flex-col gap-space-sm" onSubmit={handleRequest} noValidate>
          <TextField
            label="Account Email"
            icon="mail"
            type="email"
            placeholder="devin@acme.corp"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
            inputClassName="pr-3"
          />

          {error && (
            <p role="alert" className="flex items-center gap-space-xs text-body-sm text-error">
              <MaterialSymbol name="error" className="text-body-sm" />
              {error}
            </p>
          )}

          <button type="submit" className="btn-auth-primary mt-1" disabled={busy}>
            <span>{busy ? 'Sending…' : 'Send Reset Code'}</span>
            <MaterialSymbol name="send" className="text-title-md" />
          </button>
        </form>
      </div>
    </AuthShell>
  )
}

/** Second step: the emailed code plus a new password. */
function ResetStep({ email, devCode, notice, onNotice, onChangeEmail }) {
  const [code, setCode] = useState('')
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const navigate = useNavigate()

  const mismatch = useMemo(
    () => form.confirm.length > 0 && form.confirm !== form.password,
    [form.confirm, form.password],
  )
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (code.length !== 6) {
      setError('Enter all 6 digits from the email.')
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
      await api.resetPassword({ email, code, password: form.password, confirm: form.confirm })
      setDone(true)
    } catch (err) {
      setError(err.message)
      setFieldErrors(err.details ?? {})
      // A wrong or spent code is spent input; clear it so the next attempt is clean.
      if (err.status === 400) setCode('')
    } finally {
      setBusy(false)
    }
  }

  async function handleResend() {
    onNotice('')
    try {
      const res = await api.forgotPassword(email)
      onNotice(res?.devCode ? `New code (dev): ${res.devCode}` : 'A new code is on its way.')
    } catch (err) {
      onNotice(err.message)
    }
  }

  if (done) {
    return (
      <AuthShell
        footer={
          <>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              Your password has been reset.
            </span>
            <Link to="/login" className="ml-2 font-title-md text-title-md text-primary-container hover:underline">
              Sign In
            </Link>
          </>
        }
      >
        <div className="flex flex-col items-center text-center">
          <div className="mb-space-md flex h-14 w-14 items-center justify-center rounded-full bg-primary-container/15 text-primary-container">
            <MaterialSymbol
              name="verified_user"
              className="text-headline-md"
              style={{ fontVariationSettings: "'FILL' 1" }}
            />
          </div>
          <h1 className="font-headline-md text-headline-md tracking-tight text-on-surface">
            Password updated
          </h1>
          <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
            We also signed out every other device, so any session using your old
            password is no longer valid.
          </p>
          <button
            type="button"
            className="btn-auth-primary mt-space-lg"
            onClick={() => navigate('/login', { replace: true })}
          >
            <span>Continue to Sign In</span>
            <MaterialSymbol name="arrow_forward" className="text-title-md" />
          </button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      footer={
        <>
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            Wrong address?
          </span>
          <button
            type="button"
            onClick={onChangeEmail}
            className="ml-2 font-title-md text-title-md text-primary-container hover:underline"
          >
            Start over
          </button>
        </>
      }
    >
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
          <div className="flex flex-col gap-1.5">
            <span className="font-label-md text-label-md text-on-surface-variant">Reset Code</span>
            <CodeInput value={code} onChange={setCode} disabled={busy} />
          </div>

          <div className="flex flex-col gap-1.5">
            <TextField
              label="New Password"
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
            label="Confirm New Password"
            icon="verified_user"
            type="password"
            placeholder="Re-enter new password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={set('confirm')}
            error={fieldErrors.confirm}
            inputClassName={mismatch ? 'ring-1 ring-status-crit' : ''}
          />

          {error && !mismatch && (
            <p role="alert" className="flex items-center gap-space-xs text-body-sm text-error">
              <MaterialSymbol name="error" className="text-body-sm" />
              {error}
            </p>
          )}

          <button type="submit" className="btn-auth-primary" disabled={busy || code.length !== 6}>
            <span>{busy ? 'Updating…' : 'Set New Password'}</span>
            <MaterialSymbol name="lock_reset" className="text-title-md" />
          </button>
        </form>

        <div className="mt-space-md flex items-center justify-center gap-space-sm text-body-sm text-on-surface-variant">
          <button type="button" onClick={handleResend} className="text-primary-container hover:underline">
            Resend code
          </button>
        </div>

        {notice && (
          <p role="status" className="mt-space-sm text-center font-body-sm text-body-sm text-on-surface-variant">
            {notice}
          </p>
        )}
      </div>
    </AuthShell>
  )
}