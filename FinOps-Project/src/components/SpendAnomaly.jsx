import MaterialSymbol from './MaterialSymbol'
import StatusPill from './StatusPill'
import ShareBar from './charts/ShareBar'
import { anomaly } from '@/data/finops'
import { usd, usdCompact } from '@/utils/format'

const TONES = ['crit', 'warn', 'sky']

export default function SpendAnomaly() {
  return (
    <section className="w-full bg-surface-container-low py-space-xl">
      <div className="shell gutter-x grid grid-cols-1 items-center gap-gutter lg:grid-cols-12">
        {/* Story copy — 5 columns */}
        <div className="flex flex-col gap-space-md lg:col-span-5">
          <span className="font-label-caps text-label-caps uppercase text-primary">Anomaly Detection</span>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">{anomaly.title}</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">{anomaly.body}</p>

          <div className="flex flex-col gap-space-sm pt-space-xs">
            {anomaly.points.map((p) => (
              <div key={p.title} className="flex items-start gap-space-sm">
                <MaterialSymbol name="check_circle" className="mt-1 text-primary-container" />
                <div className="flex flex-col">
                  <span className="font-title-md text-title-md text-on-surface">{p.title}</span>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">{p.body}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Anomaly console — 7 columns */}
        <div className="flex flex-col gap-space-md lg:col-span-7">
          <div className="flex flex-col gap-space-md rounded-2xl bg-surface-container p-space-lg shadow-2xl">
            {/* Terminal header */}
            <div className="flex flex-wrap items-center justify-between gap-space-sm pb-space-xs">
              <div className="flex items-center gap-space-xs">
                <span className="h-3 w-3 rounded-full bg-error-container" />
                <span className="h-3 w-3 rounded-full bg-surface-container-high" />
                <span className="h-3 w-3 rounded-full bg-surface-bright" />
                <span className="ml-space-xs font-code-sm text-code-sm text-on-surface-variant">
                  cost-anomaly: billing/us-east-1 · 14:22:07 UTC
                </span>
              </div>
              <StatusPill tone="crit" pulse>
                22% over forecast
              </StatusPill>
            </div>

            {/* Root cause breakdown */}
            <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md">
              <div className="flex items-center justify-between font-label-caps text-label-caps text-on-surface-variant">
                <span>Attributed Root Cause</span>
                <span className="tnum font-mono text-status-crit">+$66,030 today</span>
              </div>

              <div className="flex flex-col gap-space-sm">
                {anomaly.rootCauses.map((c, i) => (
                  <div key={c.label} className="flex flex-col gap-space-xs">
                    <div className="flex items-center justify-between gap-space-sm">
                      <span className="truncate font-code-sm text-code-sm text-on-surface">{c.label}</span>
                      <span className="tnum flex-none font-code-sm text-code-sm text-on-surface-variant">
                        {usd(c.value)}
                      </span>
                    </div>
                    <ShareBar segments={[{ label: c.label, value: c.share, tone: TONES[i] }]} height="h-1.5" />
                  </div>
                ))}
              </div>
            </div>

            {/* Finding + actions */}
            <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md">
              <div className="flex items-start gap-space-sm">
                <div className="rounded-lg bg-surface-container p-2 text-primary-container">
                  <MaterialSymbol name="lightbulb" />
                </div>
                <div className="flex flex-col">
                  <div className="flex flex-wrap items-center gap-space-xs">
                    <span className="font-title-md text-title-md text-on-surface">Nightly Export Job Oversized</span>
                    <StatusPill tone="warn">High confidence</StatusPill>
                  </div>
                  <span className="font-body-sm text-body-sm text-on-surface-variant">
                    412 slots reserved against a 90-day average of 140. Owned by data-eng · created 6 weeks ago.
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-space-sm">
                <span className="inline-flex items-center gap-space-xs rounded-lg bg-primary-container px-space-md py-2 font-title-md text-title-md font-semibold text-on-primary">
                  <MaterialSymbol name="bolt" className="text-title-md" />
                  Reserve 140 slots
                </span>
                <span className="tnum inline-flex items-center gap-space-xs rounded-lg bg-surface-container-highest px-space-md py-2 font-title-md text-title-md text-on-surface">
                  Saves {usdCompact(28_900)} / mo
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">Apply in under 15 minutes</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
