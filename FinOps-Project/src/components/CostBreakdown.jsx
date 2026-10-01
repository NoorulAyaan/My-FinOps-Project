import { useMemo, useState } from 'react'
import MaterialSymbol from './MaterialSymbol'
import Panel from './Panel'
import DeltaChip from './DeltaChip'
import ShareBar from './charts/ShareBar'
import Sparkline from './charts/Sparkline'
import { categories, providers, services, totalMtd } from '@/data/finops'
import { usd, usdCompact, pct } from '@/utils/format'

const TONE = { aws: 'cyan', azure: 'indigo', gcp: 'sky' }
const DOT = {
  aws: 'bg-primary-container',
  azure: 'bg-secondary',
  gcp: 'bg-tertiary-fixed-dim',
}
const CATEGORY_TONE = {
  Compute: 'cyan',
  Database: 'indigo',
  Container: 'sky',
  Analytics: 'warn',
  Storage: 'info',
  Network: 'muted',
  Serverless: 'ok',
}

export default function CostBreakdown() {
  const [provider, setProvider] = useState('all')

  const rows = useMemo(
    () => (provider === 'all' ? services : services.filter((s) => s.provider === provider)),
    [provider],
  )

  const shownTotal = rows.reduce((s, r) => s + r.mtd, 0)

  return (
    <section id="cost" className="w-full scroll-mt-24 px-margin py-space-xl">
      <div className="shell mx-auto flex flex-col gap-space-xl">
        <div className="flex flex-col justify-between gap-space-sm md:flex-row md:items-end">
          <div className="flex flex-col gap-space-xs">
            <span className="font-label-caps text-label-caps uppercase tracking-wider text-primary">
              Cost Attribution
            </span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Where the Money Goes</h2>
            <p className="max-w-2xl font-body-md text-body-md text-on-surface-variant">
              Every billing line item reconciled against the resource that produced it — no shared-cost
              guesswork, no unattributed remainder.
            </p>
          </div>

          {/* Provider filter */}
          <div className="flex flex-none items-center gap-1 rounded-lg bg-surface-container-low p-1">
            {[{ id: 'all', label: 'All' }, ...providers.map((p) => ({ id: p.id, label: p.short }))].map((f) => (
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
        </div>

        <div className="grid grid-cols-1 gap-gutter lg:grid-cols-12">
          {/* Service table */}
          <Panel
            className="lg:col-span-8"
            title="Cost by Service"
            subtitle={`${rows.length} services · ${usd(shownTotal)} month to date`}
            icon="receipt_long"
            bodyClassName="p-0"
          >
            <div className="max-h-[520px] overflow-y-auto">
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-surface-container/95 backdrop-blur-xl">
                  <tr className="border-b border-white/[0.08]">
                    {['Service', 'Category', 'MTD Cost', 'vs Last Month', 'Share', 'Trend'].map((h, i) => (
                      <th
                        key={h}
                        scope="col"
                        className={`px-space-md py-space-sm font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant ${
                          i >= 2 ? 'text-right' : ''
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr
                      key={s.id}
                      className="group border-b border-white/[0.04] transition-colors odd:bg-white/[0.015] hover:bg-primary-container/[0.03]"
                    >
                      <td className="px-space-md py-2.5">
                        <div className="flex items-center gap-space-sm">
                          <span className={`h-1.5 w-1.5 flex-none rounded-full ${DOT[s.provider]}`} />
                          <span className="font-body-md text-body-md font-medium text-on-surface">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-space-md py-2.5 font-body-sm text-body-sm text-on-surface-variant">
                        {s.category}
                      </td>
                      <td className="tnum px-space-md py-2.5 text-right font-code-sm text-code-sm text-on-surface">
                        {usd(s.mtd)}
                      </td>
                      <td className="px-space-md py-2.5 text-right">
                        <DeltaChip value={s.deltaPct} />
                      </td>
                      <td className="px-space-md py-2.5">
                        <div className="flex items-center justify-end gap-space-sm">
                          <span className="tnum w-10 text-right font-code-sm text-code-sm text-on-surface-variant">
                            {s.share}%
                          </span>
                          <div className="w-14">
                            <ShareBar
                              height="h-1"
                              segments={[{ label: s.name, value: s.share, tone: TONE[s.provider] }]}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-space-md py-2.5 text-right">
                        <Sparkline points={s.trend} positive={s.deltaPct <= 0} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* Category mix */}
          <div className="flex flex-col gap-gutter lg:col-span-4">
            <Panel title="Spend by Category" subtitle={`${usd(totalMtd)} total`} icon="donut_small">
              <div className="flex flex-col gap-space-md">
                {categories.map((c) => (
                  <div key={c.name} className="flex flex-col gap-space-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-body-md text-body-md text-on-surface">{c.name}</span>
                      <span className="tnum font-code-sm text-code-sm text-on-surface-variant">
                        {usdCompact(c.value)} · {c.pct}%
                      </span>
                    </div>
                    <ShareBar
                      segments={[{ label: c.name, value: c.pct, tone: CATEGORY_TONE[c.name] || 'cyan' }]}
                      height="h-1.5"
                    />
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Cost per Unit" subtitle="Unit economics" icon="functions">
              <dl className="flex flex-col gap-space-sm">
                {[
                  ['Cost / 1K API requests', '$0.0041', 'crit'],
                  ['Cost / active customer', '$0.38', 'ok'],
                  ['Cost / 1M log lines', '$2.14', 'warn'],
                  ['Cost / deploy-minute', '$0.009', 'ok'],
                ].map(([label, value, tone]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-lg bg-surface-container-low px-space-sm py-2"
                  >
                    <dt className="font-body-sm text-body-sm text-on-surface-variant">{label}</dt>
                    <dd className="tnum font-code-sm text-code-sm font-semibold text-on-surface">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-space-md flex items-start gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
                <MaterialSymbol name="info" className="text-body-sm text-on-surface-variant" />
                Without allocation, FinOps is just a bigger invoice.
              </p>
            </Panel>
          </div>
        </div>
      </div>
    </section>
  )
}
