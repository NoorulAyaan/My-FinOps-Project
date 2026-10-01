import { useMemo, useState } from 'react'
import MaterialSymbol from './MaterialSymbol'
import Panel from './Panel'
import StatusPill from './StatusPill'
import { providers, resources, totalResources } from '@/data/finops'
import { usd, usdCompact } from '@/utils/format'

const DOT = { aws: 'bg-primary-container', azure: 'bg-secondary', gcp: 'bg-tertiary-fixed-dim' }
const SHORT = { aws: 'AWS', azure: 'Azure', gcp: 'GCP' }

const TONE_BY_STATUS = { healthy: 'ok', underutilized: 'warn', oversized: 'warn', idle: 'crit', unallocated: 'muted' }

export default function ResourceInventory() {
  const [provider, setProvider] = useState('all')
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return resources
      .filter((r) => (provider === 'all' ? true : r.provider === provider))
      .filter((r) => !q || r.name.includes(q) || r.type.toLowerCase().includes(q) || r.owner.includes(q) || r.region.includes(q))
      .slice(0, 12)
  }, [provider, query])

  const waste = resources
    .filter((r) => r.status === 'idle' || r.status === 'underutilized' || r.status === 'oversized')
    .reduce((s, r) => s + r.monthly, 0)

  return (
    <section id="inventory" className="w-full scroll-mt-24 bg-surface-container-low py-space-xl">
      <div className="shell gutter-x flex flex-col gap-space-lg">
        <div className="flex flex-col justify-between gap-space-sm md:flex-row md:items-end">
          <div className="flex flex-col gap-space-xs">
            <span className="font-label-caps text-label-caps uppercase tracking-wider text-primary">
              Unified Resource Register
            </span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">
              Every Resource, With Its Owner and Its Bill
            </h2>
            <p className="max-w-2xl font-body-md text-body-md text-on-surface-variant">
              {totalResources.toLocaleString()} resources across three clouds, joined to cost centres and
              live utilisation. If a resource exists, it has an owner and a monthly cost here.
            </p>
          </div>
          <div className="flex flex-none items-center gap-2 rounded-xl border border-status-warn/25 bg-status-warn/10 px-space-md py-space-sm">
            <MaterialSymbol name="warning" className="text-status-warn" />
            <div className="flex flex-col">
              <span className="font-label-caps text-label-caps uppercase text-status-warn">Flagged Waste</span>
              <span className="tnum font-title-md text-title-md font-semibold text-on-surface">
                {usdCompact(waste)} / mo
              </span>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-space-sm">
          <div className="flex items-center gap-1 rounded-lg bg-surface-container p-1">
            {[{ id: 'all', label: 'All clouds' }, ...providers.map((p) => ({ id: p.id, label: p.short }))].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setProvider(f.id)}
                aria-pressed={provider === f.id}
                className={`rounded px-space-sm py-1.5 font-title-md text-title-md transition-all ${
                  provider === f.id
                    ? 'bg-surface-container-high text-primary-container shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative flex min-w-[220px] flex-1 items-center">
            <MaterialSymbol
              name="search"
              className="pointer-events-none absolute left-3 text-headline-sm text-on-surface-variant"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, type, region or owner…"
              aria-label="Search resources"
              className="w-full rounded-lg border border-white/[0.10] bg-surface-container-lowest py-2 pl-10 pr-3 font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary-container focus:outline-none focus:ring-1 focus:ring-primary-container"
            />
          </div>
        </div>

        <Panel
          title="Resource Inventory"
          subtitle={`Showing ${rows.length} of ${totalResources.toLocaleString()} tracked resources`}
          icon="inventory_2"
          bodyClassName="p-0"
        >
          <div className="max-h-[560px] overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-surface-container/95 backdrop-blur-xl">
                <tr className="border-b border-white/[0.08]">
                  {['Resource', 'Cloud / Region', 'Owner', 'Monthly Cost', 'Utilisation', 'Status', 'Commitment'].map(
                    (h, i) => (
                      <th
                        key={h}
                        scope="col"
                        className={`px-space-md py-space-sm font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant ${
                          i === 3 || i === 4 ? 'text-right' : ''
                        }`}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-white/[0.04] transition-colors odd:bg-white/[0.015] hover:bg-primary-container/[0.03]"
                  >
                    <td className="px-space-md py-2.5">
                      <div className="flex flex-col">
                        <span className="font-code-sm text-code-sm text-on-surface">{r.name}</span>
                        <span className="font-body-sm text-body-sm text-on-surface-variant">
                          {r.type} · {r.size}
                        </span>
                      </div>
                    </td>
                    <td className="px-space-md py-2.5">
                      <div className="flex flex-col">
                        <span className="flex items-center gap-1.5 font-body-sm text-body-sm text-on-surface">
                          <span className={`h-1.5 w-1.5 rounded-full ${DOT[r.provider]}`} />
                          {SHORT[r.provider]}
                        </span>
                        <span className="font-code-sm text-code-sm text-on-surface-variant">{r.region}</span>
                      </div>
                    </td>
                    <td className="px-space-md py-2.5">
                      <div className="flex flex-col">
                        <span className="font-body-sm text-body-sm text-on-surface">{r.owner}</span>
                        <span className="font-code-sm text-code-sm text-on-surface-variant">{r.env}</span>
                      </div>
                    </td>
                    <td className="tnum px-space-md py-2.5 text-right">
                      <div className="flex flex-col">
                        <span className="font-code-sm text-code-sm text-on-surface">{usd(r.monthly)}</span>
                        <span className="font-code-sm text-code-sm text-on-surface-variant">
                          {usd(r.daily, { dp: 2 })}/day
                        </span>
                      </div>
                    </td>
                    <td className="px-space-md py-2.5">
                      <div className="flex items-center justify-end gap-space-sm">
                        <div className="h-1 w-12 overflow-hidden rounded-full bg-surface-container-highest">
                          <div
                            className={`h-full rounded-full ${
                              r.util >= 45 ? 'bg-status-ok' : r.util >= 8 ? 'bg-status-warn' : 'bg-status-crit'
                            }`}
                            style={{ width: `${Math.max(r.util, 2)}%` }}
                          />
                        </div>
                        <span className="tnum w-9 text-right font-code-sm text-code-sm text-on-surface-variant">
                          {r.util}%
                        </span>
                      </div>
                    </td>
                    <td className="px-space-md py-2.5">
                      <StatusPill tone={TONE_BY_STATUS[r.status]}>{r.statusLabel}</StatusPill>
                    </td>
                    <td className="px-space-md py-2.5 font-body-sm text-body-sm text-on-surface-variant">
                      {r.commitment}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rows.length === 0 && (
            <p className="px-space-lg py-space-xl text-center font-body-md text-body-md text-on-surface-variant">
              No resources match “{query}”.
            </p>
          )}
        </Panel>
      </div>
    </section>
  )
}
