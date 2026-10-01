import { Link } from 'react-router-dom'
import StatusPill from './StatusPill'
import SpendTrendChart from './charts/SpendTrendChart'
import ShareBar from './charts/ShareBar'
import { kpis, heroStats, providers, spendSeries, stackSeries } from '@/data/finops'
import { usd, usdCompact, pct } from '@/utils/format'

export default function Hero() {
  const { peak } = stackSeries()
  const budgetPct = (kpis.mtdSpend / kpis.budget) * 100

  return (
    <section id="top" className="relative w-full overflow-hidden px-margin py-space-xl">
      {/* Ambient atmospheric glows */}
      <div className="pointer-events-none absolute left-1/4 top-10 -z-10 h-96 w-96 rounded-full bg-primary-container/10 blur-[128px]" />
      <div className="pointer-events-none absolute bottom-10 right-10 -z-10 h-[500px] w-[500px] rounded-full bg-secondary-container/15 blur-[140px]" />

      <div className="shell mx-auto grid grid-cols-1 items-center gap-gutter lg:grid-cols-12">
        {/* Copy — 7 columns */}
        <div className="flex flex-col gap-space-lg lg:col-span-7">
          <div className="flex flex-col items-start gap-space-sm">
            <StatusPill tone="cyan" pulse>
              Multi-Cloud FinOps Platform
            </StatusPill>
          </div>

          <h1 className="text-balance font-display text-display leading-tight tracking-tight text-on-surface">
            Every Cloud Dollar and Every Resource,{' '}
            <span className="text-primary-container drop-shadow-[0_0_24px_rgba(0,240,255,0.4)]">
              In One Place
            </span>
          </h1>

          <p className="max-w-2xl text-pretty font-body-lg text-body-lg text-on-surface-variant">
            Connect AWS, Azure and Google Cloud once. Get a live register of all {kpis.coveragePct}% of your
            spend and all {providers.reduce((s, p) => s + p.resources, 0).toLocaleString()} resources — allocated
            to teams, forecast to month end, and continuously optimised.
          </p>

          {/* CTA cluster */}
          <div className="flex flex-wrap items-center gap-space-md pt-space-sm">
            <Link to="/dashboard" className="btn-primary group">
              <span className="material-symbols-outlined text-headline-sm leading-none">monitoring</span>
              <span>Open Cost Dashboard</span>
              <span className="absolute -inset-0.5 -z-10 rounded-lg bg-primary-container opacity-40 blur-sm transition duration-300 group-hover:opacity-75" />
            </Link>
            <Link to="/login" className="btn-secondary">
              <span className="material-symbols-outlined text-headline-sm leading-none">add_link</span>
              <span>Connect Cloud Accounts</span>
            </Link>
          </div>

          {/* Trust metrics */}
          <div className="grid max-w-lg grid-cols-3 gap-space-md pt-space-lg">
            {heroStats.map((s) => (
              <div key={s.label} className="flex flex-col gap-space-xs rounded-lg bg-surface-container-low p-space-sm">
                <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">{s.label}</span>
                <span className={`tnum font-headline-sm text-headline-sm ${s.accent ? 'text-primary' : 'text-on-surface'}`}>
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Live spend console — 5 columns */}
        <div className="relative flex flex-col gap-space-md lg:col-span-5">
          <div className="absolute -inset-4 -z-10 rounded-2xl bg-gradient-to-tr from-secondary-container/20 to-primary-container/10 blur-xl" />

          <div className="flex flex-col gap-space-md rounded-2xl bg-surface-container/90 p-space-lg shadow-2xl backdrop-blur-2xl">
            {/* Header */}
            <div className="flex items-center justify-between pb-space-sm">
              <div className="flex items-center gap-space-xs">
                <span className="h-3 w-3 animate-pulse rounded-full bg-primary-container" />
                <span className="font-title-md text-title-md text-on-surface">Unified Spend</span>
              </div>
              <span className="rounded-full bg-surface-container-highest px-space-xs py-0.5 font-label-caps text-label-caps uppercase tracking-wider text-primary">
                Live
              </span>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-3 gap-space-xs">
              <div className="flex flex-col rounded-xl bg-surface-container-high p-space-sm">
                <span className="font-label-caps text-label-caps text-on-surface-variant">MTD Spend</span>
                <span className="tnum font-headline-sm text-headline-sm font-bold text-on-surface">
                  {usdCompact(kpis.mtdSpend)}
                </span>
                <span className="font-body-sm text-body-sm text-status-crit">{pct(3.8)} vs plan</span>
              </div>
              <div className="flex flex-col rounded-xl bg-surface-container-high p-space-sm">
                <span className="font-label-caps text-label-caps text-on-surface-variant">Forecast EOM</span>
                <span className="tnum font-headline-sm text-headline-sm font-bold text-on-surface">
                  {usdCompact(kpis.forecast)}
                </span>
                <span className="font-body-sm text-body-sm text-primary-container">Under budget</span>
              </div>
              <div className="flex flex-col rounded-xl bg-surface-container-high p-space-sm">
                <span className="font-label-caps text-label-caps text-on-surface-variant">Savings Realised</span>
                <span className="tnum font-headline-sm text-headline-sm font-bold text-primary">
                  {usdCompact(kpis.savingsRealized)}
                </span>
                <span className="font-body-sm text-body-sm text-primary/70">12.6% of spend</span>
              </div>
            </div>

            {/* Trend */}
            <div className="flex flex-col gap-space-xs overflow-hidden rounded-xl bg-surface-container-lowest p-space-md">
              <div className="flex items-center justify-between font-label-caps text-label-caps text-on-surface-variant">
                <span>Daily Spend · Last 30 Days</span>
                <span className="tnum font-mono text-primary-container">
                  {usd(kpis.mtdSpend)} MTD
                </span>
              </div>
              <SpendTrendChart data={spendSeries} peak={peak} height={150} />
            </div>

            {/* Budget burn */}
            <div className="flex flex-col gap-space-xs rounded-xl bg-surface-container-high p-space-sm">
              <div className="flex items-center justify-between">
                <span className="font-title-md text-title-md text-on-surface">Budget Consumption</span>
                <span className="tnum font-code-sm text-code-sm text-on-surface-variant">
                  {usd(kpis.mtdSpend)} / {usdCompact(kpis.budget)}
                </span>
              </div>
              <ShareBar
                segments={[
                  { label: 'Spent', value: kpis.mtdSpend, tone: budgetPct > 85 ? 'crit' : 'cyan' },
                  { label: 'Remaining', value: kpis.budget - kpis.mtdSpend, tone: 'muted' },
                ]}
              />
              <div className="flex items-center justify-between font-body-sm text-body-sm text-on-surface-variant">
                <span>{budgetPct.toFixed(1)}% consumed · 9 days remaining</span>
                <span className="tnum text-primary-container">±2.8% forecast error</span>
              </div>
            </div>
          </div>

          {/* Floating inspector */}
          <div className="-ml-6 -mt-6 hidden max-w-sm items-center justify-between rounded-xl bg-surface-container-high/95 p-space-md shadow-xl backdrop-blur-xl sm:flex">
            <div className="flex items-center gap-space-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-bright text-status-warn">
                <span className="material-symbols-outlined text-headline-sm leading-none">savings</span>
              </div>
              <div className="flex flex-col">
                <span className="font-title-md text-title-md text-on-surface">Savings Identified</span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  6 open recommendations · 0 applied
                </span>
              </div>
            </div>
            <span className="tnum font-headline-sm text-headline-sm font-bold text-primary">
              {usdCompact(kpis.savingsIdentified)}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
