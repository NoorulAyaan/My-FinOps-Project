import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import BrandLogo from '@/components/BrandLogo'
import MaterialSymbol from '@/components/MaterialSymbol'
import Panel from '@/components/Panel'
import StatusPill from '@/components/StatusPill'
import DashboardNav from '@/components/dashboard/DashboardNav'
import ResourceInventory from '@/components/dashboard/ResourceInventory'
import SpendTrendChart from '@/components/charts/SpendTrendChart'
import ShareBar from '@/components/charts/ShareBar'

import { useAuth } from '@/auth/AuthContext'
import { api } from '@/api/client'
import { useCloudAccounts } from '@/hooks/useCloudAccounts'
import { useCostOverview } from '@/hooks/useCostOverview'
import { usd, pct } from '@/utils/format'

const PROVIDER_META = {
  aws: { label: 'AWS', icon: 'cloud', tone: 'warn' },
  azure: { label: 'Azure', icon: 'cloud', tone: 'info' },
  gcp: { label: 'GCP', icon: 'cloud', tone: 'ok' },
}

const STATUS_TONE = { connected: 'ok', pending: 'warn', error: 'crit', disconnected: 'muted' }

const SECTIONS = {
  overview: 'Cloud Cost Overview',
  cost: 'Cost Analytics',
  inventory: 'Resource Inventory',
  budgets: 'Budgets & Allocation',
  savings: 'Savings Recommendations',
  policies: 'Governance Policies',
}

export default function Dashboard() {
  const [section, setSection] = useState('overview')
  const { user, signOut } = useAuth()
  const { accounts, loading, error, removeAccount, syncAccount } = useCloudAccounts()
  const { overview, loading: overviewLoading, error: overviewError, reload: reloadOverview } =
    useCostOverview()
  const [syncingIds, setSyncingIds] = useState(() => new Set())
  const [syncError, setSyncError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const navigate = useNavigate()

  // Downloads the full billing report (per-service summary + every daily
  // row) as a CSV file straight from the API.
  const handleDownloadCsv = useCallback(async () => {
    setDownloading(true)
    try {
      await api.downloadCostReport()
    } catch (err) {
      setSyncError(err.message)
    } finally {
      setDownloading(false)
    }
  }, [])

  const syncOne = useCallback(
    async (id) => {
      setSyncingIds((s) => new Set(s).add(id))
      try {
        const result = await syncAccount(id)
        // The API returns 200 with { error } for a failed ingestion (bad
        // credentials, provider unreachable) so the reason reaches the UI.
        if (result?.error) setSyncError(result.error)
        else setSyncError('')
      } catch (err) {
        setSyncError(err.message)
      } finally {
        setSyncingIds((s) => {
          const next = new Set(s)
          next.delete(id)
          return next
        })
      }
    },
    [syncAccount],
  )

  // StrictMode mounts effects twice in dev, and the accounts list can change
  // while a sync is still in flight — remember which accounts this session
  // already auto-synced so we never fire the same ingestion concurrently.
  const autoSyncedRef = useRef(new Set())

  // Accounts start at 'pending' until their first ingestion run. Sync any
  // that have never synced, and re-sync connected accounts whose last sync
  // is older than 5 minutes, so the dashboard always reflects the latest
  // ingestion run.
  useEffect(() => {
    if (loading) return
    const stale = accounts.filter(
      (a) =>
        (a.status === 'pending' ||
          !a.lastSyncedAt ||
          Date.now() - new Date(a.lastSyncedAt).getTime() > 5 * 60 * 1000) &&
        !autoSyncedRef.current.has(a.id),
    )
    if (!stale.length) return
    stale.forEach((a) => autoSyncedRef.current.add(a.id))
    Promise.all(stale.map((a) => syncOne(a.id))).finally(reloadOverview)
  }, [loading, accounts, syncOne, reloadOverview])

  // Keep the overview in step with the account list (syncs, removals).
  useEffect(() => {
    if (!loading && accounts.length > 0) reloadOverview()
  }, [accounts, loading, reloadOverview])

  return (
    <div className="min-h-screen bg-surface font-body-md text-on-surface antialiased">
      <div className="pointer-events-none fixed left-1/3 top-0 -z-10 h-[420px] w-[520px] rounded-full bg-primary-container/[0.07] blur-[140px]" />

      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-60 flex-none flex-col gap-space-md border-r border-white/[0.06] bg-surface-container-lowest/60 p-space-md md:flex">
          <Link to="/" className="flex items-center gap-space-sm px-space-xs">
            <BrandLogo className="h-7 w-7" />
            <span className="font-headline-sm text-headline-sm tracking-tight text-primary">CloudPulse</span>
          </Link>

          <div className="flex items-center gap-space-xs rounded-lg bg-surface-container px-space-sm py-2">
            <span className={`h-2 w-2 rounded-full ${accounts.length ? 'bg-status-ok' : 'bg-status-warn'}`} />
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              {accounts.length ? 'Connected' : 'No accounts'}
            </span>
          </div>

          <DashboardNav active={section} onSelect={setSection} />

          <div className="mt-auto flex flex-col gap-space-xs">
            <div className="rounded-xl bg-surface-container p-space-sm">
              <p className="truncate font-body-sm text-body-sm text-on-surface-variant">{user?.email}</p>
              <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                {user?.name}
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                await signOut()
                navigate('/login', { replace: true })
              }}
              className="flex items-center gap-space-sm rounded-lg px-space-sm py-2 text-left font-title-md text-title-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
            >
              <MaterialSymbol name="logout" className="text-headline-sm" />
              Sign out
            </button>
            <Link
              to="/"
              className="flex items-center gap-space-sm rounded-lg px-space-sm py-2 font-title-md text-title-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
            >
              <MaterialSymbol name="arrow_back" className="text-headline-sm" />
              Back to site
            </Link>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-space-sm border-b border-white/[0.06] bg-surface/85 px-margin py-space-sm backdrop-blur-xl">
            <div className="flex items-center gap-space-sm">
              <h1 className="font-headline-sm text-headline-sm text-on-surface">{SECTIONS[section]}</h1>
              {accounts.length > 0 && (
                <StatusPill tone="ok" pulse className="hidden sm:inline-flex">
                  Live
                </StatusPill>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-space-sm">
              <span className="tnum rounded-lg bg-surface-container px-space-sm py-1 font-code-sm text-code-sm text-on-surface-variant">
                {accounts.length} account{accounts.length === 1 ? '' : 's'}
              </span>
              {accounts.length > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  disabled={downloading}
                  className="flex items-center gap-space-xs rounded-lg bg-primary-container px-space-sm py-2 font-title-md text-title-md text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <MaterialSymbol
                    name="download"
                    className={`text-title-md ${downloading ? 'animate-spin' : ''}`}
                  />
                  <span className="hidden sm:inline">
                    {downloading ? 'Preparing…' : 'Download CSV'}
                  </span>
                </button>
              )}
              <Link
                to="/connect"
                className="flex items-center gap-space-xs rounded-lg bg-surface-container-high px-space-sm py-2 font-title-md text-title-md text-on-surface transition-colors hover:bg-surface-bright"
              >
                <MaterialSymbol name="add_link" className="text-title-md" />
                <span className="hidden sm:inline">Add cloud</span>
              </Link>
            </div>
          </header>

          <main className="flex flex-col gap-gutter p-margin">
            {error && (
              <p
                role="alert"
                className="flex items-center gap-space-xs rounded-lg bg-error/10 px-space-md py-2 text-body-sm text-error"
              >
                <MaterialSymbol name="error" className="text-body-sm" />
                {error.message}
              </p>
            )}

            {loading && (
              <p className="py-space-xl text-center text-body-md text-on-surface-variant">
                Loading your accounts…
              </p>
            )}

            {!loading && accounts.length === 0 && <EmptyState />}

            {!loading && accounts.length > 0 && (
              <>
                <Panel
                  title="Connected clouds"
                  subtitle={`${accounts.length} account${accounts.length === 1 ? '' : 's'} registered`}
                  icon="cloud"
                  bodyClassName="p-0"
                >
                  <ul className="divide-y divide-white/[0.04]">
                    {accounts.map((account) => {
                      const meta = PROVIDER_META[account.provider] ?? {
                        label: account.provider,
                        icon: 'cloud',
                        tone: 'muted',
                      }
                      const syncing = syncingIds.has(account.id)
                      return (
                        <li
                          key={account.id}
                          className="flex flex-wrap items-center justify-between gap-space-sm px-space-lg py-3"
                        >
                          <div className="flex min-w-0 flex-col gap-1">
                            <span className="truncate font-title-md text-title-md">{account.label}</span>
                            <span className="font-code-sm text-code-sm text-on-surface-variant">
                              {meta.label} · {account.accessKeyId}
                              {account.region ? ` · ${account.region}` : ''}
                              {account.accountRef ? ` · ${account.accountRef}` : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-space-sm">
                            <StatusPill tone={STATUS_TONE[account.status] ?? 'muted'}>
                              {account.status}
                            </StatusPill>
                            <button
                              type="button"
                              onClick={() => syncOne(account.id)}
                              disabled={syncing}
                              aria-label={`Sync ${account.label}`}
                              title="Sync now"
                              className="text-on-surface-variant transition-colors hover:text-primary-container disabled:opacity-50"
                            >
                              <MaterialSymbol
                                name="refresh"
                                className={`text-title-md ${syncing ? 'animate-spin' : ''}`}
                              />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeAccount(account.id)}
                              aria-label={`Remove ${account.label}`}
                              className="text-on-surface-variant transition-colors hover:text-status-crit"
                            >
                              <MaterialSymbol name="delete" className="text-title-md" />
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </Panel>

                {(syncError || overviewError) && (
                  <p
                    role="alert"
                    className="flex items-center gap-space-xs rounded-lg bg-error/10 px-space-md py-2 text-body-sm text-error"
                  >
                    <MaterialSymbol name="error" className="text-body-sm" />
                    {syncError || overviewError.message}
                  </p>
                )}

                {section === 'inventory' && <ResourceInventory />}

                {section !== 'inventory' &&
                  !overviewError &&
                  (overview || overviewLoading) && (
                    <CostPanels section={section} overview={overview} loading={overviewLoading} />
                  )}
              </>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-space-md rounded-xl border border-dashed border-surface-container-highest bg-surface-container/40 px-space-xl py-space-2xl text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-container-highest text-primary-container">
        <MaterialSymbol name="cloud_off" className="text-headline-md" />
      </div>
      <div className="flex flex-col gap-space-xs">
        <h2 className="font-headline-sm text-headline-sm text-on-surface">No cloud accounts yet</h2>
        <p className="max-w-md text-body-md text-on-surface-variant">
          Connect AWS, Azure or Google Cloud and this dashboard fills in with your own spend, resources
          and budgets.
        </p>
      </div>
      <Link to="/connect" className="btn-auth-primary">
        <span>Connect your first account</span>
        <MaterialSymbol name="arrow_forward" className="text-title-md" />
      </Link>
    </div>
  )
}

function Kpi({ label, value, foot, footTone = 'text-on-surface-variant' }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-surface-container px-space-md py-space-sm">
      <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">{label}</span>
      <span className="tnum font-headline-sm text-headline-sm font-bold text-on-surface">{value}</span>
      <span className={`font-body-sm text-body-sm ${footTone}`}>{foot}</span>
    </div>
  )
}

/**
 * Renders the ingested cost data: headline KPIs, the 30-day stacked spend
 * chart, provider share and the per-service breakdown. Until an ingestion
 * run has produced records, the panels show a loading state rather than
 * empty placeholders.
 */
function CostPanels({ section, overview, loading }) {
  if (loading && !overview) {
    return (
      <Panel title={SECTIONS[section]} subtitle="Syncing cost data…" icon="monitoring">
        <p className="py-space-xl text-center text-body-md text-on-surface-variant">
          Pulling the last 30 days of spend from your cloud provider…
        </p>
      </Panel>
    )
  }

  if (section !== 'overview' && section !== 'cost') {
    return (
      <Panel title={SECTIONS[section]} subtitle="Not yet ingested" icon="hourglass_empty">
        <div className="flex flex-col items-center gap-space-sm py-space-lg text-center">
          <MaterialSymbol name="construction" className="text-headline-md text-on-surface-variant" />
          <p className="max-w-md text-body-md text-on-surface-variant">
            Cost figures are flowing in — resource inventory, budgets, savings and policies are the
            next ingestion stages.
          </p>
        </div>
      </Panel>
    )
  }

  const {
    mtdSpend,
    prevMonthSpend,
    deltaPct,
    forecast,
    budget,
    connectedProviders,
    byProvider,
    series,
    services,
    source,
    chartTotal,
  } = overview

  const budgetPct = budget ? Math.min(100, (mtdSpend / budget) * 100) : 0
  const peak =
    Math.max(1, ...series.aws.map((_, i) => series.aws[i] + series.azure[i] + series.gcp[i])) * 1.08
  const activeServices = services.filter((s) => s.mtd > 0)
  const noSpend = !chartTotal

  return (
    <>
      <div className="grid grid-cols-2 gap-space-sm lg:grid-cols-4">
        <Kpi
          label="MTD Spend"
          value={usd(mtdSpend, { dp: 2 })}
          foot={`${pct(deltaPct)} vs last month`}
          footTone={deltaPct > 0 ? 'text-status-crit' : 'text-status-ok'}
        />
        <Kpi
          label="Last Month"
          value={usd(prevMonthSpend, { dp: 2 })}
          foot="Same period last month"
        />
        <Kpi
          label="Forecast EOM"
          value={usd(forecast, { dp: 2 })}
          foot={
            budget
              ? forecast <= budget
                ? 'Under budget'
                : 'Over budget'
              : 'At current run-rate'
          }
          footTone={budget && forecast > budget ? 'text-status-crit' : 'text-status-ok'}
        />
        <Kpi
          label="Budget"
          value={budget ? usd(budget, { dp: 2 }) : '—'}
          foot={budget ? `${budgetPct.toFixed(0)}% consumed` : 'No budget configured'}
        />
      </div>

      <Panel
        title="Daily spend · last 30 days"
        subtitle={
          source === 'live'
            ? 'Source: AWS Cost Explorer via your connected credentials'
            : 'Waiting for the first successful sync'
        }
        icon="monitoring"
        actions={
          source === 'live' ? (
            <StatusPill tone="ok" pulse>
              Live
            </StatusPill>
          ) : undefined
        }
      >
        {noSpend ? (
          <div className="flex flex-col items-center gap-space-sm py-space-lg text-center">
            <MaterialSymbol name="savings" className="text-headline-md text-on-surface-variant" />
            <p className="max-w-md text-body-md text-on-surface-variant">
              AWS Cost Explorer reports <span className="tnum text-on-surface">$0.00</span> for this
              account over the last 30 days. Your credentials are working — the account simply has no
              billable usage in this period. Real figures appear here as soon as usage exceeds the
              free tier.
            </p>
          </div>
        ) : (
          <>
            <SpendTrendChart
              data={series}
              providers={connectedProviders}
              peak={peak}
              height={200}
            />
            {byProvider.length > 0 && (
              <div className="mt-space-md flex flex-col gap-space-xs">
                <ShareBar
                  segments={byProvider.map((p) => ({
                    label: p.label,
                    value: p.mtd,
                    tone: p.provider === 'aws' ? 'cyan' : p.provider === 'azure' ? 'indigo' : 'sky',
                  }))}
                />
                <div className="flex flex-wrap gap-space-md">
                  {byProvider.map((p) => (
                    <span
                      key={p.provider}
                      className="font-body-sm text-body-sm text-on-surface-variant"
                    >
                      {p.label} ·{' '}
                      <span className="tnum text-on-surface">{usd(p.mtd, { dp: 2 })}</span> ·{' '}
                      {p.share}%
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </Panel>

      <Panel
        title="Cost by service"
        subtitle={`${services.length} service${services.length === 1 ? '' : 's'} reported by AWS · ${activeServices.length} billing this month`}
        icon="account_tree"
      >
        {services.length === 0 ? (
          <p className="py-space-lg text-center text-body-md text-on-surface-variant">
            Cost Explorer has not reported any services for this account yet.
          </p>
        ) : (
          <>
            <div className="mb-space-xs flex items-center gap-space-md border-b border-white/[0.06] pb-2 font-label-caps text-label-caps uppercase text-on-surface-variant">
              <span className="flex-1">Service</span>
              <span className="hidden w-24 text-right sm:block">Last month</span>
              <span className="w-20 text-right">MTD</span>
              <span className="w-16 text-right">Share</span>
              <span className="hidden w-16 text-right md:block">Trend</span>
              <span className="hidden w-20 text-right lg:block">Category</span>
            </div>
            <ul className="flex flex-col divide-y divide-white/[0.04]">
              {services.map((s) => (
                <li key={s.id} className="flex items-center gap-space-md py-2.5">
                  <div className="flex min-w-0 flex-1 items-center gap-space-sm">
                    <span
                      className={`h-2 w-2 flex-none rounded-full ${s.mtd > 0 ? 'bg-status-ok' : 'bg-status-muted'}`}
                      title={s.mtd > 0 ? 'Billing this month' : 'No charges this month'}
                    />
                    <span className="truncate font-title-md text-title-md">{s.name}</span>
                  </div>
                  <span className="hidden w-24 text-right font-code-sm text-code-sm text-on-surface-variant sm:block">
                    {usd(s.prev, { dp: 2 })}
                  </span>
                  <span
                    className={`tnum w-20 text-right font-code-sm text-code-sm ${s.mtd > 0 ? 'text-on-surface' : 'text-on-surface-variant'}`}
                  >
                    {usd(s.mtd, { dp: 2 })}
                  </span>
                  <span className="tnum w-16 text-right font-label-caps text-label-caps text-on-surface-variant">
                    {s.share}%
                  </span>
                  <span
                    className={`tnum hidden w-16 text-right font-label-caps text-label-caps md:block ${
                      s.deltaPct > 0 ? 'text-status-crit' : 'text-status-ok'
                    }`}
                  >
                    {s.prev > 0 || s.mtd > 0 ? pct(s.deltaPct) : '—'}
                  </span>
                  <span className="hidden w-20 text-right font-label-caps text-label-caps uppercase text-on-surface-variant lg:block">
                    {s.category}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-space-sm">
              <span className="font-title-md text-title-md text-on-surface-variant">
                Total · all services
              </span>
              <span className="tnum font-title-md text-title-md text-on-surface">
                {usd(mtdSpend, { dp: 2 })}
              </span>
            </div>
          </>
        )}
      </Panel>
    </>
  )
}
