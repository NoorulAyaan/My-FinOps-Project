import MaterialSymbol from './MaterialSymbol'
import ShareBar from './charts/ShareBar'
import StatusPill from './StatusPill'
import { providers, totalMtd } from '@/data/finops'
import { usd, usdCompact, pct } from '@/utils/format'

export default function ConnectedClouds() {
  return (
    <section id="platforms" className="w-full scroll-mt-24 bg-surface-container-low py-space-xl">
      <div className="shell gutter-x flex flex-col gap-space-lg">
        <div className="flex flex-col justify-between gap-space-sm md:flex-row md:items-end">
          <div className="flex flex-col gap-space-xs">
            <span className="font-label-caps text-label-caps uppercase tracking-wider text-primary">
              Read-Only Billing Ingestion
            </span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Connected Cloud Accounts</h2>
          </div>
          <p className="max-w-md font-body-md text-body-md text-on-surface-variant">
            Native cost and usage reports from all three providers. No agents, no write access, no changes to
            your infrastructure.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-gutter md:grid-cols-3">
          {providers.map((p) => {
            const delta = ((p.mtdSpend - p.lastMonth) / p.lastMonth) * 100
            return (
              <article
                key={p.id}
                className="group flex flex-col justify-between gap-space-md rounded-2xl bg-surface-container p-space-lg shadow-md transition-all hover:bg-surface-bright"
              >
                <div className="flex flex-col gap-space-md">
                  <div className="flex items-start justify-between gap-space-sm">
                    <div className="flex items-center gap-space-sm">
                      <div
                        className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-surface-container-high ${p.accent}`}
                      >
                        <MaterialSymbol name={p.icon} className="text-headline-md" />
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-title-md text-title-md text-on-surface">{p.name}</span>
                        <span className="truncate font-code-sm text-code-sm text-on-surface-variant">
                          {p.account}
                        </span>
                      </div>
                    </div>
                    <StatusPill tone="ok" pulse>
                      Synced
                    </StatusPill>
                  </div>

                  <div className="flex items-baseline justify-between gap-space-sm">
                    <span className="tnum font-headline-md text-headline-md font-bold text-on-surface">
                      {usd(p.mtdSpend)}
                    </span>
                    <span
                      className={`tnum font-code-sm text-code-sm font-semibold ${
                        delta > 0 ? 'text-status-crit' : 'text-status-ok'
                      }`}
                    >
                      {pct(delta)}
                    </span>
                  </div>

                  <ShareBar
                    segments={[
                      { label: p.short, value: p.mtdSpend, tone: p.id === 'aws' ? 'cyan' : p.id === 'azure' ? 'indigo' : 'sky' },
                    ]}
                    height="h-1.5"
                  />

                  <div className="grid grid-cols-3 gap-space-sm pt-space-xs">
                    <div className="flex flex-col rounded bg-surface-container-low p-space-xs">
                      <span className="font-label-caps text-label-caps text-on-surface-variant">Share</span>
                      <span className="tnum font-title-md text-title-md font-semibold text-on-surface">
                        {p.share}%
                      </span>
                    </div>
                    <div className="flex flex-col rounded bg-surface-container-low p-space-xs">
                      <span className="font-label-caps text-label-caps text-on-surface-variant">Resources</span>
                      <span className="tnum font-title-md text-title-md font-semibold text-on-surface">
                        {p.resources.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex flex-col rounded bg-surface-container-low p-space-xs">
                      <span className="font-label-caps text-label-caps text-on-surface-variant">Ingest Lag</span>
                      <span className={`tnum font-title-md text-title-md font-semibold ${p.latencyAccent}`}>
                        {p.syncLatency}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-space-sm border-t border-white/[0.06] pt-space-sm">
                  <span className="font-code-sm text-code-sm text-on-surface-variant">{p.collector}</span>
                  <div className="flex items-center justify-between">
                    <span className="font-body-sm text-body-sm text-on-surface-variant">{p.auth}</span>
                    <MaterialSymbol
                      name="arrow_forward"
                      className={`text-on-surface-variant transition-colors ${p.hoverAccent}`}
                    />
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        {/* Total strip */}
        <div className="flex flex-wrap items-center justify-between gap-space-md rounded-2xl border border-white/[0.08] bg-surface-container/70 px-space-lg py-space-md">
          <div className="flex items-center gap-space-sm">
            <MaterialSymbol name="public" className="text-primary-container" />
            <span className="font-title-md text-title-md text-on-surface">Total across all accounts</span>
          </div>
          <div className="flex flex-wrap items-center gap-space-lg">
            <span className="tnum font-headline-sm text-headline-sm font-bold text-on-surface">
              {usd(totalMtd)} MTD
            </span>
            <span className="font-body-sm text-body-sm text-on-surface-variant">
              {providers.map((p) => p.short).join(' · ')} · 100% of line items reconciled
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
