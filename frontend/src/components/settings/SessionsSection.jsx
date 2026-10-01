import { useCallback, useEffect, useState } from 'react'
import MaterialSymbol from '@/components/MaterialSymbol'
import Panel from '@/components/Panel'
import { api } from '@/api/client'

/** Device label from a user-agent string, used only when the server has none. */
export function describeDevice(userAgent) {
  const ua = userAgent ?? ''
  if (/\bWindows NT/i.test(ua)) return 'Windows'
  if (/\biPhone|iPad|iPod/i.test(ua)) return 'iOS device'
  if (/\bAndroid/i.test(ua)) return 'Android device'
  if (/\bMac OS X|Macintosh/i.test(ua)) return 'Mac'
  if (/\bLinux/i.test(ua)) return 'Linux'
  return 'Unknown device'
}

const relative = (iso) => {
  if (!iso) return ''
  const delta = Date.now() - new Date(iso).getTime()
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (delta < minute) return 'just now'
  if (delta < hour) return `${Math.floor(delta / minute)}m ago`
  if (delta < day) return `${Math.floor(delta / hour)}h ago`
  return `${Math.floor(delta / day)}d ago`
}

export default function SessionsSection() {
  const [sessions, setSessions] = useState([])
  const [currentSessionId, setCurrentSessionId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [confirmingId, setConfirmingId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.listSessions()
      setSessions(res.sessions ?? [])
      setCurrentSessionId(res.currentSessionId ?? null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleRevokeOne(id) {
    setBusyId(id)
    setError('')
    setNotice('')
    try {
      await api.revokeSession(id)
      setConfirmingId(null)
      // Revoking the session this request came from leaves the access token
      // valid until it expires, so reload from the server to show the truth.
      await load()
      setNotice('Session signed out.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function handleRevokeOthers() {
    setBusyId('others')
    setError('')
    setNotice('')
    try {
      const res = await api.revokeOtherSessions()
      await load()
      setNotice(res?.message ?? 'Other devices have been signed out.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  const otherCount = sessions.filter((s) => s.id !== currentSessionId).length

  return (
    <Panel
      title="Active sessions"
      subtitle="Devices currently signed in to this account."
      icon="devices"
      actions={
        <button
          type="button"
          onClick={handleRevokeOthers}
          disabled={busyId === 'others' || otherCount === 0}
          className="flex items-center gap-space-xs rounded-lg bg-surface-container-high px-space-sm py-2 font-title-md text-title-md text-on-surface transition-colors hover:bg-surface-bright disabled:cursor-not-allowed disabled:opacity-40"
        >
          <MaterialSymbol name="logout" className="text-title-md" />
          Sign out others{otherCount > 0 ? ` (${otherCount})` : ''}
        </button>
      }
    >
      {error && (
        <p role="alert" className="mb-space-md flex items-center gap-space-xs text-body-sm text-error">
          <MaterialSymbol name="error" className="text-body-sm" />
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mb-space-md flex items-center gap-space-xs text-body-sm text-status-ok">
          <MaterialSymbol name="check_circle" className="text-body-sm" />
          {notice}
        </p>
      )}

      {loading && (
        <p className="py-space-md text-center text-body-md text-on-surface-variant">Loading sessions…</p>
      )}

      {!loading && sessions.length === 0 && (
        <p className="py-space-md text-center text-body-md text-on-surface-variant">
          No active sessions found.
        </p>
      )}

      <ul className="flex flex-col gap-space-sm">
        {sessions.map((session) => {
          const isCurrent = session.id === currentSessionId
          const confirming = confirmingId === session.id
          const label = session.label?.trim() || describeDevice(session.userAgent)
          return (
            <li
              key={session.id}
              className="flex flex-wrap items-center justify-between gap-space-sm rounded-lg border border-surface-container-highest bg-surface-container-lowest/40 px-space-md py-3"
            >
              <div className="flex min-w-0 items-center gap-space-sm">
                <MaterialSymbol name="devices" className="text-headline-sm text-primary-container" />
                <div className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-2 truncate font-title-md text-title-md">
                    {label}
                    {isCurrent && (
                      <span className="rounded-full bg-primary-container/15 px-2 py-0.5 font-label-caps text-label-caps uppercase tracking-wider text-primary-container">
                        This device
                      </span>
                    )}
                  </span>
                  <span className="truncate font-code-sm text-code-sm text-on-surface-variant">
                    {session.ipAddress ?? 'unknown IP'} · signed in {relative(session.createdAt)} · last
                    active {relative(session.lastSeenAt)}
                  </span>
                </div>
              </div>

              {confirming ? (
                <span className="flex items-center gap-space-xs">
                  <span className="font-body-sm text-body-sm text-on-surface-variant">Sign out?</span>
                  <button
                    type="button"
                    onClick={() => handleRevokeOne(session.id)}
                    disabled={busyId === session.id}
                    className="rounded-md bg-error/15 px-2 py-1 font-title-md text-title-md text-error transition-colors hover:bg-error/25 disabled:opacity-50"
                  >
                    {busyId === session.id ? 'Signing out…' : 'Confirm'}
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
                  onClick={() => setConfirmingId(session.id)}
                  aria-label={`Sign out ${label}`}
                  className="text-on-surface-variant transition-colors hover:text-status-crit"
                >
                  <MaterialSymbol name="logout" className="text-title-md" />
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}