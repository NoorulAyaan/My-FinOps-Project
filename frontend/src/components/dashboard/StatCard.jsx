import Sparkline from '@/components/charts/Sparkline'
import StatusPill from '@/components/StatusPill'

/** Headline KPI card with trend sparkline and budget progress. */
export default function StatCard({ label, value, delta, trend, positive, foot, status, meter }) {
  return (
    <article className="flex flex-col gap-space-sm rounded-2xl border border-white/[0.08] bg-surface-container/70 p-space-md shadow-lg backdrop-blur-xl">
      <div className="flex items-start justify-between gap-space-sm">
        <span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant">
          {label}
        </span>
        {status ? <StatusPill tone={status.tone}>{status.label}</StatusPill> : null}
      </div>

      <div className="flex items-end justify-between gap-space-sm">
        <span className="tnum font-headline-md text-headline-md font-bold text-on-surface">{value}</span>
        {trend && <Sparkline points={trend} positive={positive} />}
      </div>

      {meter}

      <div className="flex items-center justify-between gap-space-sm font-body-sm text-body-sm">
        {delta !== undefined && (
          <span
            className={`tnum font-semibold ${positive ? 'text-status-ok' : 'text-status-crit'}`}
          >
            {delta > 0 ? '+' : ''}
            {delta.toFixed(1)}%
          </span>
        )}
        {foot && <span className="truncate text-on-surface-variant">{foot}</span>}
      </div>
    </article>
  )
}
