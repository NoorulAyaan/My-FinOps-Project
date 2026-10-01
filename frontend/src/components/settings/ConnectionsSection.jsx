import { useState } from 'react'
import { Link } from 'react-router-dom'
import MaterialSymbol from '@/components/MaterialSymbol'
import Panel from '@/components/Panel'
import StatusPill from '@/components/StatusPill'
import { useCloudAccounts } from '@/hooks/useCloudAccounts'

const PROVIDER_META = {
  aws: { label: 'Amazon Web Services', icon: 'cloud', tone: 'warn' },
  azure: { label: 'Microsoft Azure', icon: 'cloud', tone: 'info' },
  gcp: { label: 'Google Cloud', icon: 'cloud', tone: 'ok' },
}

export default function ConnectionsSection() {
  const { accounts, loading, error, removeAccount } = useCloudAccounts()
  const [pendingId, setPendingId] = useState(null)
  const [confirmingId, setConfirmingId] = useState(null)
  const [actionError, setActionError] = useState('')

  async function handleRemove(id) {
    setPendingId(id)
    setActionError('')
    try {
      await removeAccount(id)
      setConfirmingId(null)
    } catch (err) {
      setActionError(err.message)
    } finally {
      setPendingId(null)
    }
  }

  return (
    <Panel
      title="Cloud accounts"
      subtitle="Read-only credentials this account uses to read cost data."
      icon="hub"
      actions={
        <Link
          to="/connect"
          className="flex items-center gap-space-xs rounded-lg bg-surface-container-high px-space-sm py-2 font-title-md text-title-md text-on-surface transition-colors hover:bg-surface-bright"
        >
          <MaterialSymbol name="add_link" className="text-title-md" />
          Add
        </Link>
      }
    >
      {(error || actionError) && (
        <p role="alert" className="mb-space-md flex items-center gap-space-xs text-body-sm text-error">
          <MaterialSymbol name="error" className="text-body-sm" />
          {actionError || error.message}
        </p>
      )}

      {loading && (
        <p className="py-space-md text-center text-body-md text-on-surface-variant">Loading your accounts…</p>
      )}

      {!loading && accounts.length === 0 && (
        <p className="py-space-md text-center text-body-md text-on-surface-variant">
          No cloud accounts connected yet.
        </p>
      )}

      <ul className="flex flex-col gap-space-sm">
        {accounts.map((account) => {
          const meta = PROVIDER_META[account.provider] ?? {
            label: account.provider,
            icon: 'cloud',
            tone: 'muted',
          }
          const confirming = confirmingId === account.id
          return (
            <li
              key={account.id}
              className="flex flex-wrap items-center justify-between gap-space-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest/40 px-space-md py-3"
            >
              <div className="flex min-w-0 items-center gap-space-sm">
                <MaterialSymbol name={meta.icon} className="text-headline-sm text-primary-container" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-title-md text-title-md">{account.label}</span>
                  <span className="truncate font-code-sm text-code-sm text-on-surface-variant">
                    {meta.label} · {account.accessKeyId}
                    {account.region ? ` · ${account.region}` : ''}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-space-sm">
                <StatusPill tone={meta.tone}>{account.status}</StatusPill>

                {confirming ? (
                  <span className="flex items-center gap-space-xs">
                    <span className="font-body-sm text-body-sm text-on-surface-variant">Remove?</span>
                    <button
                      type="button"
                      onClick={() => handleRemove(account.id)}
                      disabled={pendingId === account.id}
                      className="rounded-md bg-error/15 px-2 py-1 font-title-md text-title-md text-error transition-colors hover:bg-error/25 disabled:opacity-50"
                    >
                      {pendingId === account.id ? 'Removing…' : 'Confirm'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      className="rounded-md px-2 py-1 font-title-md text-title-md text-on-surface-variant transition-colors hover:text-on-surface"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingId(account.id)}
                    aria-label={`Remove ${account.label}`}
                    className="text-on-surface-variant transition-colors hover:text-status-crit"
                  >
                    <MaterialSymbol name="delete" className="text-title-md" />
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}