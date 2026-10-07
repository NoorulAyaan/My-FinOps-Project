import { useCallback, useEffect, useState } from 'react'

import MaterialSymbol from '@/components/MaterialSymbol'
import Panel from '@/components/Panel'
import StatusPill from '@/components/StatusPill'
import { api } from '@/api/client'

const TYPE_META = {
  EC2: { icon: 'memory', tone: 'cyan' },
  S3: { icon: 'inventory_2', tone: 'indigo' },
  Lambda: { icon: 'bolt', tone: 'warn' },
  RDS: { icon: 'storage', tone: 'info' },
}

const ACTIVE_STATES = new Set(['running', 'available', 'Active', 'pending'])
const STOPPED_STATES = new Set(['stopped', 'stopping', 'Inactive'])

function stateTone(state) {
  if (ACTIVE_STATES.has(state)) return 'ok'
  if (STOPPED_STATES.has(state)) return 'warn'
  if (['terminated', 'failed', 'Error'].includes(state)) return 'crit'
  return 'muted'
}

/**
 * Live resource inventory: fetches from /api/resources (which queries AWS
 * with the stored credentials on every request) whenever the section opens.
 */
export default function ResourceInventory() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await api.getResources())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading && !data) {
    return (
      <Panel title="Resource inventory" subtitle="Querying AWS across all regions…" icon="dns">
        <p className="py-space-xl text-center text-body-md text-on-surface-variant">
          Calling EC2, S3, Lambda and RDS in every enabled region…
        </p>
      </Panel>
    )
  }

  if (error) {
    return (
      <Panel title="Resource inventory" subtitle="Could not reach the API" icon="dns">
        <p role="alert" className="flex items-center gap-space-xs text-body-md text-error">
          <MaterialSymbol name="error" className="text-body-sm" />
          {error}
        </p>
      </Panel>
    )
  }

  const { resources, summary, errors, fetchedAt } = data
  const active = summary.byState.running ?? 0
  const available = summary.byState.available ?? 0
  const activeTotal = active + available + (summary.byState.Active ?? 0)
  const stopped =
    (summary.byState.stopped ?? 0) + (summary.byState.stopping ?? 0) + (summary.byState.Inactive ?? 0)

  return (
    <>
      <Panel
        title="Resource inventory"
        subtitle={`Live from AWS · ${summary.accounts} account${summary.accounts === 1 ? '' : 's'} · ${summary.regions} region${summary.regions === 1 ? '' : 's'} checked · fetched ${new Date(fetchedAt).toLocaleTimeString()}`}
        icon="dns"
        actions={
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-space-xs rounded-lg bg-surface-container-high px-space-sm py-1.5 font-title-md text-title-md text-on-surface transition-colors hover:bg-surface-bright disabled:opacity-50"
          >
            <MaterialSymbol
              name="refresh"
              className={`text-title-md ${loading ? 'animate-spin' : ''}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        }
      >
        <div className="grid grid-cols-2 gap-space-sm sm:grid-cols-4">
          <Chip label="Total resources" value={summary.total} />
          <Chip label="Active / running" value={activeTotal} tone="text-status-ok" />
          <Chip label="Stopped" value={stopped} tone="text-status-warn" />
          <Chip label="Regions checked" value={summary.regions} />
        </div>

        {resources.length === 0 ? (
          <div className="flex flex-col items-center gap-space-sm py-space-lg text-center">
            <MaterialSymbol name="cloud_off" className="text-headline-md text-on-surface-variant" />
            <p className="max-w-md text-body-md text-on-surface-variant">
              No EC2 instances, S3 buckets, Lambda functions or RDS databases exist in this account
              yet. Launch a free-tier t2.micro instance or create a bucket — it appears here after
              the next refresh.
            </p>
          </div>
        ) : (
          <ul className="mt-space-md flex flex-col divide-y divide-white/[0.04]">
            {resources.map((r) => {
              const meta = TYPE_META[r.type] ?? { icon: 'device_unknown', tone: 'muted' }
              return (
                <li
                  key={`${r.type}:${r.id}:${r.region}`}
                  className="flex flex-wrap items-center gap-space-md py-2.5"
                >
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-surface-container-high text-primary-container">
                    <MaterialSymbol name={meta.icon} className="text-body-md" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-title-md text-title-md">{r.name}</span>
                    <span className="truncate font-code-sm text-code-sm text-on-surface-variant">
                      {r.type} · {r.id} · {r.detail}
                      {r.account ? ` · ${r.account}` : ''}
                    </span>
                  </div>
                  <span className="tnum font-code-sm text-code-sm text-on-surface-variant">
                    {r.region}
                  </span>
                  <StatusPill tone={stateTone(r.state)}>{r.state}</StatusPill>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      {errors.length > 0 && (
        <Panel title="Partial results" subtitle={`${errors.length} AWS call(s) were refused`} icon="warning">
          <ul className="flex flex-col gap-space-xs">
            {errors.map((e) => (
              <li key={`${e.api}:${e.name}`} className="text-body-sm text-on-surface-variant">
                <span className="font-code-sm text-code-sm text-on-surface">{e.api}</span>
                {e.affected > 1 ? ` (failed in ${e.affected} regions)` : ''} — {e.name}:{' '}
                {e.message}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  )
}

function Chip({ label, value, tone = 'text-on-surface' }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-surface-container-high px-space-sm py-2">
      <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">{label}</span>
      <span className={`tnum font-headline-sm text-headline-sm font-bold ${tone}`}>{value}</span>
    </div>
  )
}
