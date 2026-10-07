import { query, withTransaction } from './db.js'
import { getCloudAccount, listCloudAccounts, readSecretForProvider } from './cloud.service.js'

// 60 days are ingested so the overview can compare the current month-to-date
// against the same number of days in the previous month; the chart renders
// the most recent 30.
const INGEST_DAYS = 60
const CHART_DAYS = 30

export const PROVIDER_LABELS = { aws: 'AWS', azure: 'Azure', gcp: 'GCP' }

// Cost Explorer reports raw service names; map the common ones to dashboard
// categories. Anything unmapped lands in 'Other'.
const AWS_SERVICE_CATEGORIES = {
  'Amazon Elastic Compute Cloud - Compute': 'Compute',
  'Amazon Simple Storage Service': 'Storage',
  'Amazon Relational Database Service': 'Database',
  'AmazonCloudWatch': 'Monitoring',
  'AWS Key Management Service': 'Security',
  'AWS Glue': 'Analytics',
  'Amazon Virtual Private Cloud': 'Network',
  'Amazon CloudFront': 'Network',
  'AWS Lambda': 'Serverless',
  'Amazon Elastic Container Service for Kubernetes': 'Container',
  'Amazon Elastic Kubernetes Service': 'Container',
}

export const round2 = (n) => Math.round(n * 100) / 100

export function isoDate(d) {
  return d.toISOString().slice(0, 10)
}

const awsCategory = (service) => AWS_SERVICE_CATEGORIES[service] ?? 'Other'

/* ------------------------------------------------------------------ *
 * Live AWS Cost Explorer ingestion
 * ------------------------------------------------------------------ */

/**
 * Pulls the last 60 days of daily, per-service unblended cost from AWS Cost
 * Explorer using the stored credentials. The rows are stored exactly as AWS
 * reports them — $0.00 days included. The Cost Explorer API is only served
 * from us-east-1, so the client region is pinned there regardless of the
 * account's default region.
 */
async function fetchAwsCostRows(account, secret) {
  const { CostExplorerClient, GetCostAndUsageCommand } = await import(
    '@aws-sdk/client-cost-explorer'
  )
  const client = new CostExplorerClient({
    region: 'us-east-1',
    credentials: { accessKeyId: account.accessKeyId, secretAccessKey: secret },
  })

  const end = new Date()
  const start = new Date(end)
  start.setDate(end.getDate() - (INGEST_DAYS - 1))

  const command = new GetCostAndUsageCommand({
    TimePeriod: { Start: isoDate(start), End: isoDate(new Date(end.getTime() + 86400000)) },
    Granularity: 'DAILY',
    Metrics: ['UnblendedCost'],
    GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
  })

  const { ResultsByTime = [] } = await client.send(command)

  const rows = []
  for (const day of ResultsByTime) {
    for (const group of day.Groups ?? []) {
      rows.push({
        date: day.TimePeriod.Start,
        service: group.Keys[0] ?? 'Unknown',
        amount: round2(Number(group.Metrics?.UnblendedCost?.Amount ?? 0)),
      })
    }
  }
  return rows
}

/* ------------------------------------------------------------------ *
 * Sync + overview
 * ------------------------------------------------------------------ */

async function writeRowsAndMark(accountId, status, rows) {
  await withTransaction(async (client) => {
    // Serialize writers for this account: StrictMode/double-clicks can fire
    // two syncs at once, and two interleaved DELETE+INSERT runs would collide
    // on the (account, day, service) unique index. The second transaction
    // blocks here until the first commits, then replaces the same rows.
    await client.query('SELECT pg_advisory_xact_lock(815, $1::int)', [accountId])
    await client.query('DELETE FROM cost_records WHERE account_id = $1', [accountId])
    for (const row of rows) {
      await client.query(
        `INSERT INTO cost_records (account_id, provider, service, category, date, amount, live)
         VALUES ($1, 'aws', $2, $3, $4, $5, true)`,
        [accountId, row.service, awsCategory(row.service), row.date, row.amount],
      )
    }
    await client.query(
      `UPDATE cloud_accounts SET status = $2, last_synced_at = now() WHERE id = $1`,
      [accountId, status],
    )
  })
}

/**
 * Ingests the last 60 days of cost for one account from the provider's own
 * API using the stored credentials. There is no synthetic fallback: whatever
 * AWS reports — including $0.00 — is what gets stored and displayed.
 *
 * Success  -> status 'connected', real rows written.
 * Failure  -> status 'error', previous rows cleared, the reason returned to
 *             the caller so the UI can show it.
 */
export async function syncCloudAccount(userId, id) {
  const account = await getCloudAccount(userId, id)

  if (account.provider !== 'aws') {
    const message = `Live cost ingestion for ${account.provider} is not implemented yet — only AWS Cost Explorer is wired up.`
    await writeRowsAndMark(account.id, 'error', [])
    return { account: await getCloudAccount(userId, id), live: false, records: 0, error: message }
  }

  let rows
  try {
    const secret = await readSecretForProvider(userId, id)
    rows = await fetchAwsCostRows(account, secret)
  } catch (err) {
    console.warn(`[cost] live AWS sync failed for account ${id}: ${err.message}`)
    await writeRowsAndMark(account.id, 'error', [])
    return { account: await getCloudAccount(userId, id), live: false, records: 0, error: err.message }
  }

  try {
    await writeRowsAndMark(account.id, 'connected', rows)
  } catch (err) {
    // The AWS call succeeded but storing failed — report it like any other
    // ingestion failure instead of leaking a raw database error as 409/500.
    console.error(`[cost] storing cost rows failed for account ${id}: ${err.message}`)
    await query(`UPDATE cloud_accounts SET status = 'error' WHERE id = $1`, [account.id]).catch(
      () => {},
    )
    return {
      account: await getCloudAccount(userId, id),
      live: false,
      records: 0,
      error: `Costs were fetched from AWS but could not be stored: ${err.message}`,
    }
  }
  return { account: await getCloudAccount(userId, id), live: true, records: rows.length }
}

/**
 * Aggregates every user's cost records into the shape the dashboard renders:
 * headline KPIs, a 30-day series per provider, per-service breakdown and the
 * per-account sync state. Every stored row came from a live provider call.
 */
export async function getCostOverview(userId) {
  const accounts = await listCloudAccounts(userId)

  const { rows } = await query(
    `SELECT cr.account_id, cr.provider, cr.service, cr.category, cr.date, cr.amount, cr.live
       FROM cost_records cr
       JOIN cloud_accounts ca ON ca.id = cr.account_id
      WHERE ca.user_id = $1
      ORDER BY cr.date`,
    [userId],
  )

  const now = new Date()
  const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  // Like-for-like comparison: the previous month-to-date window covers the
  // same number of days as the current one, not the whole previous month.
  const prevEnd = new Date(prevStart)
  prevEnd.setDate(prevStart.getDate() + now.getDate())

  let mtdSpend = 0
  let prevMonthSpend = 0
  const byProvider = new Map()
  const byService = new Map()
  const series = { aws: new Array(CHART_DAYS).fill(0), azure: new Array(CHART_DAYS).fill(0), gcp: new Array(CHART_DAYS).fill(0) }

  const dayBuckets = []
  for (let d = 0; d < CHART_DAYS; d++) {
    const day = new Date(now)
    day.setDate(now.getDate() - (CHART_DAYS - 1 - d))
    dayBuckets.push(isoDate(day))
  }

  for (const row of rows) {
    const date = isoDate(row.date)
    const amount = Number(row.amount)
    const inMtd = date >= isoDate(mtdStart)
    const inPrev = date >= isoDate(prevStart) && date < isoDate(prevEnd)

    if (inMtd) {
      mtdSpend += amount
      byProvider.set(row.provider, (byProvider.get(row.provider) ?? 0) + amount)
      const s = byService.get(row.service) ?? { service: row.service, mtd: 0, prev: 0, provider: row.provider, category: row.category }
      s.mtd += amount
      byService.set(row.service, s)
    } else if (inPrev) {
      prevMonthSpend += amount
      const s = byService.get(row.service) ?? { service: row.service, mtd: 0, prev: 0, provider: row.provider, category: row.category }
      s.prev += amount
      byService.set(row.service, s)
    }

    const dayIndex = dayBuckets.indexOf(date)
    if (dayIndex >= 0 && series[row.provider]) {
      series[row.provider][dayIndex] += amount
    }
  }

  mtdSpend = round2(mtdSpend)
  prevMonthSpend = round2(prevMonthSpend)
  const deltaPct = prevMonthSpend ? round2(((mtdSpend - prevMonthSpend) / prevMonthSpend) * 100) : 0

  const dayOfMonth = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const forecast = round2((mtdSpend / dayOfMonth) * daysInMonth)
  // No budget source exists yet (the Budgets section is not ingested), so the
  // API reports null rather than inventing a number the UI would present as real.
  const budget = null

  const providerList = [...byProvider.entries()].map(([provider, mtd]) => ({
    provider,
    label: PROVIDER_LABELS[provider] ?? provider,
    mtd: round2(mtd),
    share: mtdSpend ? round2((mtd / mtdSpend) * 100) : 0,
  }))

  const serviceList = [...byService.values()]
    .map((s) => ({
      id: s.service.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: s.service,
      provider: s.provider,
      category: s.category,
      mtd: round2(s.mtd),
      prev: round2(s.prev),
      deltaPct: s.prev ? round2(((s.mtd - s.prev) / s.prev) * 100) : 0,
      share: mtdSpend ? round2((s.mtd / mtdSpend) * 100) : 0,
    }))
    .sort((a, b) => b.mtd - a.mtd)

  const accountList = accounts.map((a) => ({
    id: a.id,
    label: a.label,
    provider: a.provider,
    status: a.status,
    lastSyncedAt: a.lastSyncedAt,
  }))

  const chartTotal = round2(
    series.aws.reduce((s, v) => s + v, 0) +
      series.azure.reduce((s, v) => s + v, 0) +
      series.gcp.reduce((s, v) => s + v, 0),
  )

  return {
    mtdSpend,
    prevMonthSpend,
    deltaPct,
    forecast,
    budget,
    connectedProviders: [...new Set(accounts.map((a) => a.provider))],
    byProvider: providerList,
    series,
    services: serviceList,
    accounts: accountList,
    chartTotal,
    source: accounts.some((a) => a.status === 'connected') ? 'live' : 'none',
  }
}
