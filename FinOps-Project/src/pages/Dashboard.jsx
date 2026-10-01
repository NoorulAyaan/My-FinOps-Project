import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import BrandLogo from '@/components/BrandLogo'
import MaterialSymbol from '@/components/MaterialSymbol'
import Panel from '@/components/Panel'
import StatusPill from '@/components/StatusPill'
import DashboardNav from '@/components/dashboard/DashboardNav'

import { useAuth } from '@/auth/AuthContext'
import { useCloudAccounts } from '@/hooks/useCloudAccounts'

const PROVIDER_META = {
  aws: { label: 'AWS', icon: 'cloud', tone: 'warn' },
  azure: { label: 'Azure', icon: 'cloud', tone: 'info' },
  gcp: { label: 'GCP', icon: 'cloud', tone: 'ok' },
}

const SECTIONS = {
  overview: 'Cloud Cost Overview',
  cost: 'Cost Analytics',
  inventory: 'Resource Inventory',
  budgets: 'Budgets & Allocation',
  savings: 'Savings Recommendations',
  policies: 'Governance Policies',
}

/**
 * The dashboard reads only from the API. With no cloud connected it shows an
 * onboarding state; with accounts connected it lists them, while the cost
 * panels stay empty until a cost puller exists — the sample data that used to
 * be imported here is deliberately gone.
 */
export default function Dashboard() {
  const [section, setSection] = useState('overview')
  const { user, signOut } = useAuth()
  const { accounts, loading, error, removeAccount } = useCloudAccounts()
  const navigate = useNavigate()

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
                            <StatusPill tone={meta.tone}>{account.status}</StatusPill>
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

                <PendingPanels section={section} />
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
          and budgets. The sample data has been removed.
        </p>
      </div>
      <Link to="/connect" className="btn-auth-primary">
        <span>Connect your first account</span>
        <MaterialSymbol name="arrow_forward" className="text-title-md" />
      </Link>
    </div>
  )
}

/**
 * Honest about what exists: the panels render as empty rather than showing
 * figures the backend cannot yet produce.
 */
function PendingPanels({ section }) {
  return (
    <Panel
      title={SECTIONS[section]}
      subtitle="Awaiting cost ingestion"
      icon="hourglass_empty"
    >
      <div className="flex flex-col items-center gap-space-sm py-space-lg text-center">
        <MaterialSymbol name="construction" className="text-headline-md text-on-surface-variant" />
        <p className="max-w-md text-body-md text-on-surface-variant">
          Your cloud accounts are connected and their credentials are stored. Pulling real cost figures
          from AWS Cost Explorer, Azure Cost Management and GCP Cloud Billing is the next step — until
          then this panel stays empty rather than showing invented numbers.
        </p>
      </div>
    </Panel>
  )
}
