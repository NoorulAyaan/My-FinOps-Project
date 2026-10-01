const TONES = {
  ok: 'bg-status-ok',
  warn: 'bg-status-warn',
  crit: 'bg-status-crit',
  info: 'bg-status-info',
  muted: 'bg-status-muted',
  cyan: 'bg-primary-container',
  indigo: 'bg-secondary',
  sky: 'bg-tertiary-fixed-dim',
}

/** Horizontal stacked bar — used for spend share and budget utilisation. */
export default function ShareBar({ segments, height = 'h-2', className = '' }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1

  return (
    <div className={`flex w-full overflow-hidden rounded-full bg-surface-container-highest/50 ${height} ${className}`}>
      {segments.map((s) => (
        <div
          key={s.label}
          className={TONES[s.tone] || TONES.cyan}
          style={{ width: `${(s.value / total) * 100}%` }}
          title={`${s.label} · ${((s.value / total) * 100).toFixed(1)}%`}
        />
      ))}
    </div>
  )
}
