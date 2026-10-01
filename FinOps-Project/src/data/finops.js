import { seeded, pick, between, round } from './random'

/* ------------------------------------------------------------------ *
 * Connected cloud accounts
 * ------------------------------------------------------------------ */

export const providers = [
  {
    id: 'aws',
    name: 'Amazon Web Services',
    short: 'AWS',
    icon: 'cloud',
    accent: 'text-primary-container',
    hoverAccent: 'group-hover:text-primary-container',
    account: 'prod-payments-4821',
    collector: 'CUR 2.0 + Cost & Usage Report',
    services: 'EC2 • S3 • EKS • RDS • Lambda • DynamoDB • NAT Gateway',
    mtdSpend: 742_180,
    lastMonth: 701_400,
    resources: 24_180,
    syncLatency: '1.2 sec',
    latencyAccent: 'text-primary',
    auth: 'Agentless IAM Role Ingest',
    share: 58,
  },
  {
    id: 'azure',
    name: 'Microsoft Azure',
    short: 'Azure',
    icon: 'dns',
    accent: 'text-secondary',
    hoverAccent: 'group-hover:text-secondary',
    account: 'sub-9f21c0a4 (fin-prod)',
    collector: 'Azure Cost Management + Resource Graph',
    services: 'VMs • AKS • CosmosDB • Blob • App Services • Front Door',
    mtdSpend: 318_640,
    lastMonth: 334_900,
    resources: 13_640,
    syncLatency: '1.8 sec',
    latencyAccent: 'text-secondary',
    auth: 'Service Principal Authentication',
    share: 25,
  },
  {
    id: 'gcp',
    name: 'Google Cloud',
    short: 'GCP',
    icon: 'hub',
    accent: 'text-primary-fixed-dim',
    hoverAccent: 'group-hover:text-primary-fixed-dim',
    account: 'cloudpulse-prod-88213',
    collector: 'Cloud Billing Export + Pub/Sub Telemetry',
    services: 'GCE • GKE • BigQuery • Cloud Run • Cloud SQL • Storage',
    mtdSpend: 224_390,
    lastMonth: 208_600,
    resources: 10_399,
    syncLatency: '1.4 sec',
    latencyAccent: 'text-primary-fixed-dim',
    auth: 'Workload Identity Federation',
    share: 17,
  },
]

export const totalMtd = providers.reduce((s, p) => s + p.mtdSpend, 0)
export const totalResources = providers.reduce((s, p) => s + p.resources, 0)

/* ------------------------------------------------------------------ *
 * Headline KPIs
 * ------------------------------------------------------------------ */

export const kpis = {
  mtdSpend: totalMtd,
  budget: 1_500_000,
  forecast: 1_462_800,
  savingsRealized: 187_340,
  // Must equal the sum of `opportunities[].monthly` — asserted in tests/finops.smoke.jsx
  savingsIdentified: 366_200,
  wasteMonthly: 86_410,
  coveragePct: 99.4,
  unallocated: 14_280,
}

/* ------------------------------------------------------------------ *
 * 30-day spend series, stacked by provider
 * ------------------------------------------------------------------ */

function buildSeries() {
  const rand = seeded(20260929)
  const days = 30
  const out = { aws: [], azure: [], gcp: [] }

  // Weekday/weekend pattern + mild upward drift, so the chart has real shape.
  for (let d = 0; d < days; d++) {
    const weekday = new Date(2026, 8, 1 + d).getDay()
    const weekend = weekday === 0 || weekday === 6
    const drift = 1 + d * 0.004
    const noise = between(rand, 0.94, 1.07)

    out.aws.push(round((742_180 / 30) * drift * noise * (weekend ? 0.82 : 1), 0))
    out.azure.push(round((318_640 / 30) * drift * noise * (weekend ? 0.86 : 1), 0))
    out.gcp.push(round((224_390 / 30) * drift * noise * (weekend ? 0.78 : 1), 0))
  }
  return out
}

export const spendSeries = buildSeries()

/** Normalised 0..1 stacked series for the area chart, plus the peak total. */
export function stackSeries() {
  const keys = ['aws', 'azure', 'gcp']
  const totals = spendSeries.aws.map((_, i) =>
    keys.reduce((s, k) => s + spendSeries[k][i], 0),
  )
  const peak = Math.max(...totals) * 1.08
  return { keys, totals, peak }
}

/** 12-month actual vs budget for the forecast chart. */
export function monthlySpend() {
  const rand = seeded(778812)
  const months = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']
  return months.map((m) => ({
    month: m,
    spend: round(between(rand, 1_040_000, 1_320_000), 0),
    budget: 1_500_000,
  }))
}

/* ------------------------------------------------------------------ *
 * Cost by service
 * ------------------------------------------------------------------ */

const SERVICE_DEFS = [
  ['Amazon EC2', 'aws', 'Compute', 318_400, 8.2, 41],
  ['Azure Virtual Machines', 'azure', 'Compute', 142_800, -3.4, 19],
  ['Amazon RDS', 'aws', 'Database', 146_200, 2.1, 19],
  ['Amazon EKS', 'aws', 'Container', 124_300, 11.9, 16],
  ['Google BigQuery', 'gcp', 'Analytics', 88_400, 22.4, 12],
  ['Amazon S3', 'aws', 'Storage', 98_700, 14.6, 13],
  ['Azure AKS', 'azure', 'Container', 64_900, 1.8, 8],
  ['AWS Lambda', 'aws', 'Serverless', 61_200, -6.1, 8],
  ['Google Cloud SQL', 'gcp', 'Database', 52_800, 4.2, 7],
  ['Amazon CloudFront', 'aws', 'Network', 44_900, 4.7, 6],
  ['Azure Cosmos DB', 'azure', 'Database', 41_200, 9.8, 5],
  ['NAT Gateway', 'aws', 'Network', 38_400, 18.3, 5],
  ['Google Cloud Run', 'gcp', 'Serverless', 29_600, -12.4, 4],
  ['Azure Blob Storage', 'azure', 'Storage', 24_100, 1.2, 3],
  ['Amazon ElastiCache', 'aws', 'Database', 19_800, -2.7, 3],
  ['GKE Autopilot', 'gcp', 'Container', 17_400, 6.5, 2],
  ['AWS Glue', 'aws', 'Analytics', 14_200, 15.1, 2],
  ['Azure Front Door', 'azure', 'Network', 11_300, -0.8, 1],
]

export const services = SERVICE_DEFS.map(([name, provider, category, mtd, deltaPct, share], i) => {
  const rand = seeded(1000 + i * 37)
  const prev = mtd / (1 + deltaPct / 100)
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    provider,
    category,
    mtd,
    prev,
    deltaPct,
    share,
    trend: Array.from({ length: 14 }, () => round(between(rand, 0.7, 1.3), 3)),
  }
}).sort((a, b) => b.mtd - a.mtd)

export const categoryTotals = services.reduce((acc, s) => {
  acc[s.category] = (acc[s.category] || 0) + s.mtd
  return acc
}, {})

export const categories = Object.entries(categoryTotals)
  .map(([name, value]) => ({ name, value, pct: round((value / totalMtd) * 100, 1) }))
  .sort((a, b) => b.value - a.value)

/* ------------------------------------------------------------------ *
 * Resource inventory
 * ------------------------------------------------------------------ */

const FLEET = {
  aws: {
    types: [
      ['EC2', 'm5.2xlarge', 't3.medium', 'c5.4xlarge', 'r6i.xlarge', 'm6g.large'],
      ['RDS', 'PostgreSQL 15', 'MySQL 8.0', 'Aurora PostgreSQL'],
      ['EKS Node', 'm5.4xlarge node pool', 'c5.9xlarge node pool'],
      ['S3 Bucket', 'Standard storage', 'Intelligent-Tiering', 'Glacier Deep Archive'],
      ['EBS Volume', 'gp3 500Gi', 'io2 BlockExpress 1Ti'],
      ['Lambda', 'Python 3.12', 'Node 20 arm64'],
    ],
    regions: ['us-east-1', 'eu-central-1', 'us-west-2', 'ap-south-1', 'eu-west-1'],
  },
  azure: {
    types: [
      ['Virtual Machine', 'Standard_D8s_v5', 'Standard_E4ds_v5', 'Standard_B2ms'],
      ['AKS Node', 'Standard_D16s_v5 pool', 'Standard_E8ds_v5 pool'],
      ['Azure SQL', 'Business Critical Gen5', 'General Purpose Gen5'],
      ['Blob Storage', 'Hot tier', 'Cool tier'],
      ['Front Door', 'Standard', 'Premium'],
      ['Cosmos DB', 'Provisioned RU/s', 'Autoscale RU/s'],
    ],
    regions: ['westeurope', 'eastus', 'northeurope', 'southeastasia'],
  },
  gcp: {
    types: [
      ['GCE Instance', 'n2-standard-8', 'c3-highcpu-8', 'e2-medium'],
      ['GKE Node', 'n2-standard-16 pool', 'c3-highmem-8 pool'],
      ['BigQuery', 'On-demand slots', 'Reservation'],
      ['Cloud Run', 'Knative service', 'Cloud Run Job'],
      ['Cloud Storage', 'Nearline', 'Standard'],
      ['Cloud SQL', 'PostgreSQL 15', 'PostgreSQL 16'],
    ],
    regions: ['us-central1', 'europe-west1', 'asia-east1', 'us-east4'],
  },
}

const OWNERS = ['platform-core', 'payments', 'checkout-web', 'data-eng', 'ml-platform', 'growth', 'sre-oncall', 'identity']
const STATUSES = ['healthy', 'underutilized', 'idle', 'oversized', 'healthy', 'healthy', 'unallocated']
const STATUS_META = {
  healthy: { label: 'Healthy', tone: 'ok' },
  underutilized: { label: 'Underutilized', tone: 'warn' },
  oversized: { label: 'Oversized', tone: 'warn' },
  idle: { label: 'Idle · no traffic', tone: 'crit' },
  unallocated: { label: 'No cost centre', tone: 'muted' },
}

function buildResources() {
  const rand = seeded(424242)
  const rows = []

  providers.forEach((p) => {
    const cfg = FLEET[p.id]
    for (let i = 0; i < 11; i++) {
      const [type, ...sizes] = cfg.types[i % cfg.types.length]
      const size = sizes.length > 1 ? pick(rand, sizes) : sizes[0]
      const status = pick(rand, STATUSES)
      const util = status === 'idle' ? 0 : status === 'underutilized' ? round(between(rand, 3, 22), 0) : status === 'oversized' ? round(between(rand, 8, 20), 0) : round(between(rand, 45, 92), 0)
      const monthly = Math.round(between(rand, 40, 2400) * (type === 'RDS' || type === 'Azure SQL' || type === 'Cloud SQL' ? 2.4 : 1))

      rows.push({
        id: `${p.id}-res-${String(i + 1).padStart(3, '0')}`,
        name: `${type.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${p.short.toLowerCase()}-${String(1200 + i * 37)}`,
        type,
        size,
        provider: p.id,
        region: pick(rand, cfg.regions),
        monthly,
        util,
        status,
        statusLabel: STATUS_META[status].label,
        statusTone: STATUS_META[status].tone,
        owner: pick(rand, OWNERS),
        env: rand() > 0.35 ? 'production' : rand() > 0.5 ? 'staging' : 'development',
        commitment: rand() > 0.6 ? 'Savings Plan' : rand() > 0.4 ? 'Reserved' : 'On-Demand',
        daily: round(monthly / 30, 2),
      })
    }
  })

  return rows.sort((a, b) => b.monthly - a.monthly)
}

export const resources = buildResources()
export const resourceOwners = [...new Set(resources.map((r) => r.owner))].sort()
export const resourceRegions = [...new Set(resources.map((r) => r.region))].sort()
export const resourceTypes = [...new Set(resources.map((r) => r.type))].sort()

/* ------------------------------------------------------------------ *
 * Savings opportunities
 * ------------------------------------------------------------------ */

export const opportunities = [
  {
    id: 'op-1',
    title: 'Stop 76 non-production environments running 24/7',
    category: 'Idle Resources',
    provider: 'aws',
    monthly: 33_600,
    confidence: 'High',
    effort: 'Low',
    window: 'Apply in < 5 min',
  },
  {
    id: 'op-2',
    title: 'Delete 1,284 unattached EBS volumes',
    category: 'Idle Resources',
    provider: 'aws',
    monthly: 41_700,
    confidence: 'High',
    effort: 'Low',
    window: 'Apply in < 5 min',
  },
  {
    id: 'op-3',
    title: 'Rightsize 42 over-provisioned EC2 instances',
    category: 'Rightsizing',
    provider: 'aws',
    monthly: 68_400,
    confidence: 'High',
    effort: 'Medium',
    window: '1–2 days',
  },
  {
    id: 'op-4',
    title: 'Commit to a 1-year Savings Plan on m5 / c5',
    category: 'Commitments',
    provider: 'aws',
    monthly: 94_200,
    confidence: 'High',
    effort: 'Medium',
    window: 'Finance approval',
  },
  {
    id: 'op-5',
    title: 'Migrate 380 workloads to Graviton / ARM instances',
    category: 'Architecture',
    provider: 'multi',
    monthly: 52_100,
    confidence: 'Medium',
    effort: 'High',
    window: '2–4 weeks',
  },
  {
    id: 'op-6',
    title: 'Move BigQuery analytics to slot reservations',
    category: 'Commitment',
    provider: 'gcp',
    monthly: 28_900,
    confidence: 'Medium',
    effort: 'Low',
    window: 'Apply in < 15 min',
  },
  {
    id: 'op-7',
    title: 'Introduce Azure Advisor + reservation auto-purchase',
    category: 'Commitments',
    provider: 'azure',
    monthly: 47_300,
    confidence: 'Medium',
    effort: 'Medium',
    window: '1–2 days',
  },
].sort((a, b) => b.monthly - a.monthly)

/* ------------------------------------------------------------------ *
 * Budgets by cost centre
 * ------------------------------------------------------------------ */

export const budgets = [
  { owner: 'platform-core', team: 'Platform Core', budget: 320_000, mtd: 298_400 },
  { owner: 'payments', team: 'Payments', budget: 280_000, mtd: 271_600 },
  { owner: 'data-eng', team: 'Data Engineering', budget: 240_000, mtd: 226_800 },
  { owner: 'ml-platform', team: 'ML Platform', budget: 210_000, mtd: 198_400 },
  { owner: 'checkout-web', team: 'Checkout & Web', budget: 180_000, mtd: 164_200 },
  { owner: 'growth', team: 'Growth', budget: 150_000, mtd: 143_900 },
  { owner: 'sre-oncall', team: 'SRE & On-Call', budget: 80_000, mtd: 71_300 },
  { owner: 'identity', team: 'Identity', budget: 40_000, mtd: 30_410 },
].map((b) => ({ ...b, pct: round((b.mtd / b.budget) * 100, 1) }))

/* ------------------------------------------------------------------ *
 * Capability grid
 * ------------------------------------------------------------------ */

export const capabilities = [
  {
    icon: 'account_balance_wallet',
    accent: 'text-primary-container',
    tag: 'ALLOCATION',
    tagAccent: 'text-primary',
    title: 'Cost Allocation & Tagging',
    body: 'Map every line item to a team, cost centre, project or customer. Enforce tagging policy so untagged spend is caught at ingest, not at month end.',
    footLabel: 'Allocated',
    footValue: '99.4% of spend',
    footAccent: 'text-primary',
  },
  {
    icon: 'inventory_2',
    accent: 'text-secondary',
    tag: 'INVENTORY',
    tagAccent: 'text-secondary',
    title: 'Unified Resource Inventory',
    body: 'One searchable register of every VM, cluster, bucket, database and serverless runtime across all three clouds — with owner, region and live utilisation.',
    footLabel: 'Resources Tracked',
    footValue: '48,219 live',
    footAccent: 'text-secondary',
  },
  {
    icon: 'savings',
    accent: 'text-tertiary-fixed-dim',
    tag: 'OPTIMIZE',
    tagAccent: 'text-tertiary-fixed-dim',
    title: 'Rightsizing & Waste Detection',
    body: 'Utilisation-based recommendations for idle, over-provisioned and unattached resources, ranked by monthly saving and confidence score.',
    footLabel: 'Waste Found',
    footValue: '$86.4K / mo',
    footAccent: 'text-primary-container',
  },
  {
    icon: 'query_stats',
    accent: 'text-primary-container',
    tag: 'FORECAST',
    tagAccent: 'text-primary',
    title: 'Anomaly & Forecast Engine',
    body: 'Day-ahead spend forecasting with per-service anomaly detection, so a runaway job is caught in hours instead of at the invoice.',
    footLabel: 'Forecast Error',
    footValue: '±2.8%',
    footAccent: 'text-primary',
  },
  {
    icon: 'verified_user',
    accent: 'text-secondary',
    tag: 'GOVERNANCE',
    tagAccent: 'text-secondary',
    title: 'Budgets, Policies & Guardrails',
    body: 'Hard budgets per cost centre with automated policy actions that stop, throttle or notify before a team blows through allocation.',
    footLabel: 'Active Policies',
    footValue: '37 enforced',
    footAccent: 'text-secondary',
  },
  {
    icon: 'handshake',
    accent: 'text-primary-container',
    tag: 'SHOWBACK',
    tagAccent: 'text-primary',
    title: 'Unit Economics & Chargeback',
    body: 'Cost per transaction, per request and per tenant — so engineering and finance argue from the same numbers.',
    footLabel: 'Cost / 1K Requests',
    footValue: '$0.0041',
    footAccent: 'text-primary-container',
  },
]

/* ------------------------------------------------------------------ *
 * Spend-anomaly story
 * ------------------------------------------------------------------ */

export const anomaly = {
  title: 'Catch a Spend Spike Hours, Not Bill Cycles',
  body: 'A runaway nightly export job in us-east-1 pushed BigQuery slot spend 22% above forecast on a Tuesday. CloudPulse correlated the billing line items against the resource inventory, attributed the cost to one cost centre, and proposed the reservation change before the day closed.',
  points: [
    {
      title: 'Line-item to resource attribution',
      body: 'Every dollar is traced from the invoice line down to the exact resource, tag and owner that produced it.',
    },
    {
      title: 'Forecast-aware alerting',
      body: 'Alerts fire on deviation from forecast, not on a static threshold that every team eventually ignores.',
    },
    {
      title: 'One-click remediation',
      body: 'Apply a rightsize, stop an idle environment or purchase a commitment without leaving the finding.',
    },
  ],
  rootCauses: [
    { label: 'BigQuery · slot_hours · us-east-1', value: '$41,280', share: 62 },
    { label: 'Cloud Run · egress · global', value: '$14,910', share: 22 },
    { label: 'Cloud Storage · early delete', value: '$9,840', share: 16 },
  ],
}

/* ------------------------------------------------------------------ *
 * Marketing stats
 * ------------------------------------------------------------------ */

export const heroStats = [
  { label: 'Spend Under Mgmt', value: '$1.28M', accent: true },
  { label: 'Resources Tracked', value: '48,219', accent: false },
  { label: 'Avg. Waste Found', value: '6.7%', accent: true },
]

export const guarantees = [
  { icon: 'lock', label: 'Read-Only Billing Access' },
  { icon: 'credit_card_off', label: 'No Credit Card Required' },
  { icon: 'bolt', label: 'First Data in 4 Minutes' },
]

export const footerColumns = [
  {
    title: 'Platform',
    links: ['Cost Dashboard', 'Resource Inventory', 'Budgets & Alerts', 'Savings Recommendations', 'Showback Reports'],
  },
  {
    title: 'Integrations',
    links: ['AWS Cost Explorer', 'Azure Cost Management', 'GCP Cloud Billing', 'Kubernetes / OpenShift', 'OpenTelemetry Collector'],
  },
  {
    title: 'Developers',
    links: ['API Documentation', 'Terraform Provider', 'Ingestion Webhooks', 'Export to S3 / BigQuery', 'Audit & Access Logs'],
  },
  {
    title: 'Trust',
    links: ['Security Whitepaper', 'SOC2 Type II Report', 'GDPR & Data Residency', 'Pricing & Billing Policy', '24/7 FinOps Support'],
  },
]
