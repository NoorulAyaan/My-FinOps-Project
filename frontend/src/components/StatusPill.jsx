const TONES = {
  ok: { cls: 'bg-status-ok/12 border-status-ok/25 text-status-ok', dot: 'bg-status-ok' },
  warn: { cls: 'bg-status-warn/12 border-status-warn/25 text-status-warn', dot: 'bg-status-warn' },
  crit: { cls: 'bg-status-crit/15 border-status-crit/40 text-status-crit', dot: 'bg-status-crit' },
  info: { cls: 'bg-status-info/12 border-status-info/25 text-status-info', dot: 'bg-status-info' },
  muted: { cls: 'bg-surface-container-highest text-on-surface-variant border-surface-container-highest', dot: 'bg-status-muted' },
  cyan: { cls: 'bg-primary-container/12 border-primary-container/25 text-primary', dot: 'bg-primary-container' },
  indigo: { cls: 'bg-secondary-container/25 border-secondary/30 text-secondary', dot: 'bg-secondary' },
}

/** Pill-shaped telemetry tag. `pulse` adds the 6px glowing status dot. */
export default function StatusPill({ tone = 'muted', children, pulse = false, className = '' }) {
  const t = TONES[tone] || TONES.muted
  return (
    <span
      className={`inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full border px-2 font-label-caps text-label-caps uppercase tracking-wider ${t.cls} ${className}`}
    >
      {pulse && <span className={`h-1.5 w-1.5 animate-pulse rounded-full ${t.dot}`} />}
      {children}
    </span>
  )
}
