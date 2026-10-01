/** Tiny inline trend line for table rows. Colour encodes direction. */
export default function Sparkline({ points, positive = true, width = 76, height = 22 }) {
  if (!points?.length) return null

  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const x = (i) => (i / (points.length - 1)) * width
  const y = (v) => height - 2 - ((v - min) / span) * (height - 4)

  const d = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const stroke = positive ? '#00f0ff' : '#f43f5e'

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" aria-hidden="true">
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(points.length - 1)} cy={y(points[points.length - 1])} r="2" fill={stroke} />
    </svg>
  )
}
