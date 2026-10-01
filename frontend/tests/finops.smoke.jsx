/**
 * Smoke test for the FinOps landing page and the /dashboard route.
 * Rendered with react-dom/server to assert structure and data integrity.
 *
 * Run: npm run test:finops
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { createElement } from 'react'
import Landing from '../src/pages/Landing.jsx'
import Dashboard from '../src/pages/Dashboard.jsx'
import Auth from '../src/pages/Auth.jsx'
import { AuthProvider } from '../src/auth/AuthContext.jsx'
import { providers, resources, services, opportunities, budgets, kpis, totalMtd, totalResources } from '../src/data/finops.js'

// Dashboard and the auth forms read session state, so mirror App.jsx and
// wrap the tree in AuthProvider.
const renderAt = (el, path) =>
  renderToStaticMarkup(
    createElement(
      AuthProvider,
      null,
      createElement(
        MemoryRouter,
        { initialEntries: [path] },
        createElement(
          Routes,
          null,
          createElement(Route, { path: '/', element: el }),
          createElement(Route, { path: '/dashboard', element: el }),
          createElement(Route, { path: '/connect', element: el }),
          createElement(Route, { path: '/login', element: el }),
          createElement(Route, { path: '/signup', element: el }),
        ),
      ),
    ),
  )

const landing = renderAt(createElement(Landing), '/')
const dash = renderAt(createElement(Dashboard), '/dashboard')

const has = (html, ...needles) => needles.every((n) => html.includes(n))

const dataChecks = [
  // Provider totals must reconcile with the advertised MTD figure.
  ['data: provider spend sums to totalMtd', providers.reduce((s, p) => s + p.mtdSpend, 0) === totalMtd],
  ['data: provider share sums to ~100', Math.abs(providers.reduce((s, p) => s + p.share, 0) - 100) < 0.5],
  ['data: every provider has resources', providers.every((p) => p.resources > 0)],
  ['data: service costs are positive + sorted desc', services.every((s, i) => s.mtd > 0 && (i === 0 || services[i - 1].mtd >= s.mtd))],
  ['data: services have 14-point trends', services.every((s) => s.trend.length === 14)],
  ['data: resource fleet is populated', resources.length === providers.length * 11],
  ['data: resource util within 0-100', resources.every((r) => r.util >= 0 && r.util <= 100)],
  ['data: every resource has a status label', resources.every((r) => typeof r.statusLabel === 'string' && r.statusLabel.length > 0)],
  ['data: every resource has a provider + region', resources.every((r) => r.provider && r.region)],
  ['data: opportunities sorted by saving desc', opportunities.every((o, i) => i === 0 || opportunities[i - 1].monthly >= o.monthly)],
  ['data: opportunity sum matches headline', opportunities.reduce((s, o) => s + o.monthly, 0) === kpis.savingsIdentified],
  ['data: budget percentages computed', budgets.every((b) => b.pct > 0 && b.pct < 200)],
  ['data: budgets sum to the 1.5M budget', budgets.reduce((s, b) => s + b.budget, 0) === 1_500_000],
]

const landingChecks = [
  ['landing: FinOps headline', has(landing, 'Every Cloud Dollar')],
  ['landing: no stale observability copy', !has(landing, 'Monitor Your Cloud Infrastructure', 'Global Mesh Telemetry', 'Topology Mesh Latency', 'CloudPulse Core')],
  ['landing: connects all three clouds', has(landing, 'Amazon Web Services', 'Microsoft Azure', 'Google Cloud')],
  ['landing: cost breakdown section', has(landing, 'Where the Money Goes', 'Cost by Service', 'BigQuery')],
  ['landing: resource inventory section', has(landing, 'Every Resource, With Its Owner and Its Bill', 'Monthly Cost', 'Utilisation')],
  ['landing: savings queue section', has(landing, 'Your Savings Queue', 'Rightsizing', 'Accept')],
  ['landing: anomaly story', has(landing, 'Catch a Spend Spike', 'Attributed Root Cause')],
  ['landing: capability grid', has(landing, 'Cost Allocation &amp; Tagging', 'Unit Economics')],
  ['landing: spend trend chart', has(landing, 'Daily Spend', 'Last 30 Days', 'unfold_more') === false],
  ['landing: links to the dashboard route', has(landing, 'href="/dashboard"')],
  ['landing: links to the auth route', has(landing, 'href="/login"')],
  ['landing: no dead href="#" CTAs', !landing.includes('href="#"')],
]

// The dashboard is data-driven from the API now, so the server-rendered output
// is the pre-data state. These checks guard the important regression: no sample
// figures may leak back into the authenticated dashboard.
const dashChecks = [
  ['dashboard: renders', has(dash, 'Cloud Cost Overview')],
  ['dashboard: sidebar nav', has(dash, 'Overview', 'Cost Analytics', 'Resources', 'Budgets', 'Savings', 'Policies')],
  ['dashboard: account count from API state', dash.includes('0 accounts')],
  ['dashboard: no-accounts badge', has(dash, 'No accounts')],
  ['dashboard: links to connect flow', has(dash, 'href="/connect"')],
  ['dashboard: no dead href="#"', !dash.includes('href="#"')],
  ['dashboard: no hardcoded KPI headings', !has(dash, 'Month-to-Date Spend', 'Forecast End of Month')],
  ['dashboard: no hardcoded budget total', !dash.includes('$1,500,000')],
  ['dashboard: no mock savings recommendations', !dash.includes('Stop 76 non-production')],
  ['dashboard: no mock resource fleet rows', !has(dash, 'Every Resource, With Its Owner and Its Bill')],
  ['dashboard: sign-out control present', dash.includes('Sign out')],
]

const authChecks = [
  ['auth: still renders sign in', has(renderAt(createElement(Auth), '/login'), 'Welcome Back')],
  ['auth: still renders sign up', has(renderAt(createElement(Auth, { initialMode: 'signup' }), '/signup'), 'Start Your Free Cloud Observability Trial')],
]

const checks = [...landingChecks, ...dashChecks, ...authChecks, ...dataChecks]

let failed = 0
for (const [name, ok] of checks) {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
}
console.log(
  failed
    ? `\n${failed} of ${checks.length} checks failed`
    : `\nAll ${checks.length} checks passed  (${totalResources.toLocaleString()} resources, $${(totalMtd / 1e6).toFixed(2)}M tracked)`,
)
process.exit(failed ? 1 : 0)
