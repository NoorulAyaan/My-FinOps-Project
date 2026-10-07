/**
 * Stacked area chart of daily spend split by provider.
 * Pure SVG — no chart library, no runtime cost.
 * Only providers that are actually connected are stacked and shown in the
 * legend — an AWS-only account never sees Azure/GCP entries.
 */
const COLORS = {
  aws: '#00f0ff',
  azure: '#c0c1ff',
  gcp: '#7bd0ff',
}

const LABELS = { aws: 'AWS', azure: 'Azure', gcp: 'GCP' }

const ALL_KEYS = ['aws', 'azure', 'gcp']

export default function SpendTrendChart({
  data,
  peak,
  providers = ALL_KEYS,
  height = 190,
  showAxis = true,
}) {
  const W = 720
  const H = height
  const padT = 10
  const padB = showAxis ? 22 : 0
  const plotH = H - padT - padB

  const n = data.aws.length
  const x = (i) => (i / (n - 1)) * W
  const y = (v) => padT + plotH - (v / peak) * plotH

  // Build a stacked path per connected provider, plus the running baseline.
  const keys = ALL_KEYS.filter((k) => providers.includes(k))
  const baselines = new Array(n).fill(0)
  const areas = []
  const lines = []

  keys.forEach((key) => {
    const top = data[key].map((v, i) => baselines[i] + v)

    const line = top.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')

    // Walk the baseline right-to-left so the area closes underneath the line.
    let base = ''
    for (let i = n - 1; i >= 0; i--) {
      base += ` L${x(i).toFixed(1)},${y(baselines[i]).toFixed(1)}`
    }

    areas.push({ key, d: `${line}${base} Z`, color: COLORS[key] })
    lines.push({ key, d: line, color: COLORS[key] })
    for (let i = 0; i < n; i++) baselines[i] = top[i]
  })

  const gridYs = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div className="w-full">
      <div className="flex items-center gap-space-md">
        {keys.map((k) => (
          <span key={k} className="flex items-center gap-1.5 font-label-caps text-label-caps text-on-surface-variant">
            <span className="h-2 w-2 rounded-full" style={{ background: COLORS[k] }} />
            {LABELS[k]}
          </span>
        ))}
      </div>

      <svg
        className="mt-space-sm h-full w-full"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Daily cloud spend over the last 30 days, stacked by provider"
      >
        <defs>
          {keys.map((k) => (
            <linearGradient key={k} id={`grad-${k}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={COLORS[k]} stopOpacity="0.45" />
              <stop offset="100%" stopColor={COLORS[k]} stopOpacity="0.04" />
            </linearGradient>
          ))}
        </defs>

        {gridYs.map((g) => (
          <line
            key={g}
            x1="0"
            x2={W}
            y1={padT + plotH - g * plotH}
            y2={padT + plotH - g * plotH}
            stroke="currentColor"
            className="text-surface-bright/40"
            strokeDasharray="3 3"
          />
        ))}

        {areas.map((a) => (
          <path key={a.key} d={a.d} fill={`url(#grad-${a.key})`} />
        ))}
        {lines.map((l) => (
          <path key={l.key} d={l.d} fill="none" stroke={l.color} strokeWidth="1.75" vectorEffect="non-scaling-stroke" />
        ))}

        {showAxis &&
          ['30d ago', '20d', '10d', 'Today'].map((t, i) => (
            <text
              key={t}
              x={(i / 3) * W}
              y={H - 6}
              className="fill-on-surface-variant font-code-sm"
              fontSize="10"
              textAnchor={i === 0 ? 'start' : i === 3 ? 'end' : 'middle'}
            >
              {t}
            </text>
          ))}
      </svg>
    </div>
  )
}
