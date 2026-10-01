import { Link } from 'react-router-dom'
import AuthLink from './AuthLink'
import StatusPill from './StatusPill'
import { guarantees, kpis, totalResources } from '@/data/finops'
import { usdCompact } from '@/utils/format'

export default function FinalCta() {
  return (
    <section className="w-full px-margin py-space-xl">
      <div className="shell relative mx-auto flex flex-col items-center gap-space-lg overflow-hidden rounded-3xl bg-gradient-to-br from-surface-container to-surface-container-high p-space-xl text-center shadow-2xl">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-primary-container/15 blur-[100px]" />

        <div className="relative z-10 flex max-w-3xl flex-col items-center gap-space-xs">
          <StatusPill tone="cyan" className="mb-space-xs">
            Read-Only · No agents · No write access
          </StatusPill>
          <h2 className="font-headline-lg text-headline-lg text-on-surface">
            Know exactly what your cloud costs — and what it should cost
          </h2>
          <p className="max-w-xl font-body-lg text-body-lg text-on-surface-variant">
            Connect AWS, Azure and Google Cloud in minutes. CloudPulse reconciles billing line items to
            resources, allocates every dollar to a cost centre, and surfaces{' '}
            {usdCompact(kpis.savingsIdentified)} of monthly savings you can act on today.
          </p>
        </div>

        <div className="relative z-10 grid w-full max-w-3xl grid-cols-1 gap-space-sm sm:grid-cols-3">
          {[
            ['Resources Reconciled', totalResources.toLocaleString()],
            ['Spend Under Management', usdCompact(kpis.mtdSpend)],
            ['Ingest to First Insight', '4 min'],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-space-xs rounded-xl bg-surface-container-low p-space-md">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">{label}</span>
              <span className="tnum font-headline-sm text-headline-sm font-bold text-primary">{value}</span>
            </div>
          ))}
        </div>

        <div className="relative z-10 flex flex-wrap items-center justify-center gap-space-md pt-space-xs">
          <Link to="/dashboard" className="btn-primary">
            <span className="material-symbols-outlined text-headline-sm leading-none">play_arrow</span>
            <span>View Live Dashboard</span>
          </Link>
          <AuthLink
            signedInTo="/connect"
            className="inline-flex items-center justify-center gap-space-xs rounded-lg bg-surface-container-highest px-space-xl py-space-md font-title-md text-title-md text-on-surface shadow-sm transition-all hover:bg-surface-bright"
          >
            <span>Connect Your Clouds</span>
            <span className="material-symbols-outlined text-headline-sm leading-none">arrow_forward</span>
          </AuthLink>
        </div>

        <div className="relative z-10 flex flex-wrap items-center justify-center gap-space-md pt-space-xs font-body-sm text-body-sm text-on-surface-variant">
          {guarantees.map((g, i) => (
            <span key={g.label} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden="true" className="mr-space-md">•</span>}
              <span className="material-symbols-outlined text-sm leading-none text-primary">{g.icon}</span>
              {g.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
