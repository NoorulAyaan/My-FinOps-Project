export const usd = (n, opts = {}) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: opts.dp ?? 0,
    notation: opts.compact ? 'compact' : 'standard',
  }).format(n)

export const usdCompact = (n) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)

export const num = (n) => new Intl.NumberFormat('en-US').format(n)

export const pct = (n, dp = 1) => `${n > 0 ? '+' : ''}${n.toFixed(dp)}%`
