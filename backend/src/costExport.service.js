import { query } from './db.js'
import { listCloudAccounts } from './cloud.service.js'
import { PROVIDER_LABELS, round2, isoDate } from './cost.service.js'

// Quote a CSV field only when it needs it, doubling embedded quotes.
function csvCell(value) {
  const s = String(value ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s
}

/**
 * Builds a downloadable CSV containing every stored billing row for the user:
 * a per-service summary (what each service cost, month-to-date vs the same
 * days last month, share of the window) with the grand totals, followed by
 * the complete daily detail, so nothing AWS reported is left out.
 */
export async function buildCostExportCsv(userId) {
  const accounts = await listCloudAccounts(userId)
  const { rows } = await query(
    `SELECT cr.date, cr.provider, cr.service, cr.category, cr.amount,
            ca.label, ca.account_ref
       FROM cost_records cr
       JOIN cloud_accounts ca ON ca.id = cr.account_id
      WHERE ca.user_id = $1
      ORDER BY cr.date, ca.label, cr.service`,
    [userId],
  )

  const now = new Date()
  const mtdStart = isoDate(new Date(now.getFullYear(), now.getMonth(), 1))
  const prevStartD = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevEndD = new Date(prevStartD)
  prevEndD.setDate(prevStartD.getDate() + now.getDate())
  const prevStart = isoDate(prevStartD)
  const prevEnd = isoDate(prevEndD)

  const windowStart = rows.length ? isoDate(new Date(rows[0].date)) : ''
  const windowEnd = rows.length ? isoDate(new Date(rows[rows.length - 1].date)) : ''

  // Per-(account, service) totals across the three windows we report on.
  const byService = new Map()
  let mtdTotal = 0
  let prevTotal = 0
  let windowTotal = 0

  for (const row of rows) {
    const date = isoDate(new Date(row.date))
    const amount = Number(row.amount)
    const key = `${row.label}\u0000${row.provider}\u0000${row.service}`
    let s = byService.get(key)
    if (!s) {
      s = {
        account: row.label,
        provider: PROVIDER_LABELS[row.provider] ?? row.provider,
        service: row.service,
        category: row.category,
        mtd: 0,
        prev: 0,
        window: 0,
      }
      byService.set(key, s)
    }
    s.window += amount
    windowTotal += amount
    if (date >= mtdStart) {
      s.mtd += amount
      mtdTotal += amount
    } else if (date >= prevStart && date < prevEnd) {
      s.prev += amount
      prevTotal += amount
    }
  }

  const summary = [...byService.values()].sort(
    (a, b) => b.window - a.window || b.mtd - a.mtd || a.service.localeCompare(b.service),
  )
  const grandChange = prevTotal ? round2(((mtdTotal - prevTotal) / prevTotal) * 100) : ''
  const share = (amount) => (windowTotal ? round2((amount / windowTotal) * 100) : 0)
  const money = (n) => round2(n).toFixed(2)

  const out = []
  const push = (...cols) => out.push(cols.map(csvCell).join(','))

  push('CloudPulse cost report')
  push('Generated', now.toISOString())
  push('Currency', 'USD')
  if (rows.length) push('Window', windowStart, windowEnd)
  push(
    'Accounts',
    accounts.length
      ? accounts.map((a) => `${a.label} (${a.accountRef})`).join('; ')
      : 'none connected',
  )

  out.push('')
  push('Service summary')
  push(
    'Account',
    'Provider',
    'Service',
    'Category',
    'MTD (USD)',
    'Previous month same days (USD)',
    'Change %',
    'Window total (USD)',
    'Share of window %',
  )
  for (const s of summary) {
    const change = s.prev ? round2(((s.mtd - s.prev) / s.prev) * 100) : ''
    push(
      s.account,
      s.provider,
      s.service,
      s.category,
      money(s.mtd),
      money(s.prev),
      change,
      money(s.window),
      share(s.window),
    )
  }
  push(
    'Total',
    '',
    '',
    '',
    money(mtdTotal),
    money(prevTotal),
    grandChange,
    money(windowTotal),
    share(windowTotal),
  )

  out.push('')
  push('Daily detail')
  push('Date', 'Account', 'Provider', 'Service', 'Category', 'Amount (USD)')
  for (const row of rows) {
    push(
      isoDate(new Date(row.date)),
      row.label,
      PROVIDER_LABELS[row.provider] ?? row.provider,
      row.service,
      row.category,
      money(row.amount),
    )
  }

  return {
    filename: `cloudpulse-costs-${isoDate(now)}.csv`,
    csv: out.join('\n') + '\n',
  }
}
