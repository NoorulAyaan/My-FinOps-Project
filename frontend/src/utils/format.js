export const usd = (n, opts = {}) => {
  const dp = opts.dp ?? 0
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
    notation: opts.compact ? 'compact' : 'standard',
  }).format(n)
}

export const usdCompact = (n) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)

export const num = (n) => new Intl.NumberFormat('en-US').format(n)

export const pct = (n, dp = 1) => `${n > 0 ? '+' : ''}${n.toFixed(dp)}%`

// Compact "how long ago was this" label for sync timestamps, e.g. "3m ago".
// Lets the UI show data freshness (a free Postgres read) instead of forcing a
// paid provider call just to prove the data is current.
export const timeAgo = (iso) => {
  if (!iso) return 'never'
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
