import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import BrandLogo from '@/components/BrandLogo'
import MaterialSymbol from '@/components/MaterialSymbol'
import StatusPill from '@/components/StatusPill'
import { api } from '@/api/client'
import { useAuth } from '@/auth/AuthContext'

// Tones match StatusPill's palette keys.
const PROVIDER_META = {
  aws: { label: 'Amazon Web Services', icon: 'cloud', tone: 'warn' },
  azure: { label: 'Microsoft Azure', icon: 'cloud', tone: 'info' },
  gcp: { label: 'Google Cloud', icon: 'cloud', tone: 'cyan' },
}

const EMPTY = {
  provider: 'aws',
  label: '',
  accountRef: '',
  accessKeyId: '',
  accessKeySecret: '',
  region: '',
}

export default function ConnectCloud() {
  const [form, setForm] = useState(EMPTY)
  const [providers, setProviders] = useState([])
  const [accounts, setAccounts] = useState([])
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false
    // Provider specs come from the API too, so they must go through the client
    // and carry the access token rather than a bare fetch().
    Promise.all([api.listCloudProviders(), api.listCloudAccounts()])
      .then(([providerRes, accountRes]) => {
        if (cancelled) return
        setProviders(providerRes.providers ?? [])
        setAccounts(accountRes.accounts)
      })
      .catch(() => !cancelled && setError('Could not load your cloud connections.'))
    return () => {
      cancelled = true
    }
  }, [])

  const spec = providers.find((p) => p.id === form.provider)

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setFieldErrors((f) => ({ ...f, [key]: undefined }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setFieldErrors({})
    try {
      await api.addCloudAccount({
        ...form,
        label: form.label.trim(),
        accountRef: form.accountRef.trim(),
        accessKeyId: form.accessKeyId.trim(),
        accessKeySecret: form.accessKeySecret.trim(),
        region: form.region.trim(),
      })
      setForm(EMPTY)
      const res = await api.listCloudAccounts()
      setAccounts(res.accounts)
    } catch (err) {
      setError(err.message)
      setFieldErrors(err.details ?? {})
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(id) {
    setError('')
    try {
      await api.deleteCloudAccount(id)
      setAccounts((list) => list.filter((a) => a.id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="min-h-screen bg-surface font-body-md text-on-surface">
      <div className="pointer-events-none fixed -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary-container/10 blur-3xl" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col gap-space-lg px-space-lg py-space-xl">
        <header className="flex flex-wrap items-center justify-between gap-space-sm">
          <div className="flex items-center gap-space-sm">
            <Link
              to="/"
              className="flex items-center gap-space-xs rounded-lg bg-surface-container-high px-space-sm py-2 font-title-md text-title-md text-on-surface transition-colors hover:bg-surface-bright"
            >
              <MaterialSymbol name="arrow_back" className="text-title-md" />
              <span className="hidden sm:inline">Back to home</span>
            </Link>
            <Link to="/" className="flex items-center gap-space-sm" aria-label="CloudPulse home">
              <BrandLogo className="h-8 w-8" />
              <span className="font-headline-sm text-headline-sm tracking-tight text-primary">
                CloudPulse
              </span>
            </Link>
          </div>
          <div className="flex items-center gap-space-sm">
            <span className="font-body-sm text-body-sm text-on-surface-variant">{user?.email}</span>
            <button
              type="button"
              onClick={async () => {
                await signOut()
                navigate('/login', { replace: true })
              }}
              className="font-title-md text-title-md text-primary-container hover:underline"
            >
              Sign out
            </button>
          </div>
        </header>

        <div>
          <h1 className="font-headline-md text-headline-md tracking-tight">Connect your cloud accounts</h1>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Add a read-only credential for each provider you want to see. Your dashboard fills in from
            here — the sample data is gone.
          </p>
        </div>

        {error && (
          <p role="alert" className="flex items-center gap-space-xs rounded-lg bg-error/10 px-space-md py-2 text-body-sm text-error">
            <MaterialSymbol name="error" className="text-body-sm" />
            {error}
          </p>
        )}

        {accounts.length > 0 && (
          <section className="flex flex-col gap-space-sm">
            <h2 className="font-title-md text-title-md text-on-surface-variant">Connected</h2>
            <ul className="flex flex-col gap-space-xs">
              {accounts.map((account) => {
                const meta = PROVIDER_META[account.provider] ?? { label: account.provider, icon: 'cloud' }
                return (
                  <li
                    key={account.id}
                    className="flex items-center justify-between rounded-lg border border-surface-container-highest bg-surface-container/60 px-space-md py-3"
                  >
                    <div className="flex items-center gap-space-sm">
                      <MaterialSymbol name={meta.icon} className="text-headline-sm text-primary-container" />
                      <div className="flex flex-col">
                        <span className="font-title-md text-title-md">{account.label}</span>
                        <span className="font-code-sm text-code-sm text-on-surface-variant">
                          {meta.label} · {account.accessKeyId}
                          {account.region ? ` · ${account.region}` : ''}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-space-sm">
                      <StatusPill tone={meta.tone}>{account.status}</StatusPill>
                      <button
                        type="button"
                        onClick={() => handleRemove(account.id)}
                        aria-label={`Remove ${account.label}`}
                        className="text-on-surface-variant transition-colors hover:text-status-crit"
                      >
                        <MaterialSymbol name="delete" className="text-title-md" />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="btn-auth-primary self-start"
            >
              <span>Go to dashboard</span>
              <MaterialSymbol name="arrow_forward" className="text-title-md" />
            </button>
          </section>
        )}

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-space-md">
          <h2 className="font-title-md text-title-md text-on-surface-variant">
            {accounts.length ? 'Add another' : 'Add a cloud account'}
          </h2>

          <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="font-label-md text-label-md text-on-surface-variant">Provider</span>
              <select
                value={form.provider}
                onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
                className="rounded-lg bg-surface-container-lowest px-3 py-2.5 text-body-md text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container"
              >
                {(providers.length ? providers : Object.keys(PROVIDER_META).map((id) => ({ id, label: PROVIDER_META[id].label }))).map(
                  (p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ),
                )}
              </select>
            </label>

            <Field label="Connection name" error={fieldErrors.label} placeholder="Production account">
              <input
                value={form.label}
                onChange={set('label')}
                placeholder="Production account"
                className={inputClass(fieldErrors.label)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2">
            <Field label={spec?.accountRefHint ?? 'Account ID'} error={fieldErrors.accountRef}>
              <input
                value={form.accountRef}
                onChange={set('accountRef')}
                placeholder={spec?.accountRefHint ?? 'Account ID'}
                className={inputClass(fieldErrors.accountRef)}
              />
            </Field>
            <Field label={spec?.regionHint ?? 'Default region'} error={fieldErrors.region}>
              <input
                value={form.region}
                onChange={set('region')}
                placeholder={spec?.regionHint ?? 'us-east-1'}
                className={inputClass(fieldErrors.region)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2">
            <Field label={spec?.accessKeyIdHint ?? 'Access key ID'} error={fieldErrors.accessKeyId}>
              <input
                value={form.accessKeyId}
                onChange={set('accessKeyId')}
                placeholder={spec?.accessKeyIdHint ?? 'AKIA…'}
                autoComplete="off"
                spellCheck={false}
                className={inputClass(fieldErrors.accessKeyId)}
              />
            </Field>
            <Field label="Access key secret" error={fieldErrors.accessKeySecret}>
              <input
                type="password"
                value={form.accessKeySecret}
                onChange={set('accessKeySecret')}
                autoComplete="new-password"
                className={inputClass(fieldErrors.accessKeySecret)}
              />
            </Field>
          </div>

          <p className="flex items-start gap-space-xs rounded-lg bg-surface-container/60 px-space-md py-2.5 text-body-sm text-on-surface-variant">
            <MaterialSymbol name="lock" className="mt-0.5 text-body-sm text-primary-container" />
            <span>
              Your secret is encrypted with AES-256-GCM before it touches the database and is never sent
              back to the browser. Use a read-only IAM key scoped to billing and cost-explorer read.
            </span>
          </p>

          <button type="submit" className="btn-auth-primary self-start" disabled={busy}>
            <span>{busy ? 'Connecting…' : 'Connect account'}</span>
            <MaterialSymbol name="add_link" className="text-title-md" />
          </button>
        </form>
      </div>
    </div>
  )
}

const inputClass = (error) =>
  `w-full rounded-lg bg-surface-container-lowest px-3 py-2.5 text-body-md text-black placeholder:text-black focus:outline-none focus:ring-1 focus:ring-primary-container ${
    error ? 'ring-1 ring-status-crit' : ''
  }`

function Field({ label, error, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-label-md text-label-md text-on-surface-variant">{label}</span>
      {children}
      {error && (
        <span role="alert" className="flex items-center gap-space-xs text-body-sm text-error">
          <MaterialSymbol name="error" className="text-body-sm" />
          {error}
        </span>
      )}
    </label>
  )
}
