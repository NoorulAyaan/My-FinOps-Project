import 'dotenv/config'

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'ENCRYPTION_KEY']

const missing = REQUIRED.filter((key) => !process.env[key]?.trim())
if (missing.length) {
  throw new Error(
    `Missing required environment variables: ${missing.join(', ')}\n` +
      'Copy .env.example to .env and fill them in.',
  )
}

const NODE_ENV = process.env.NODE_ENV ?? 'development'
const isProd = NODE_ENV === 'production'

function int(value, fallback) {
  const n = Number.parseInt(value ?? '', 10)
  return Number.isFinite(n) ? n : fallback
}

const WEAK_SECRETS = new Set([
  'change-me',
  'changeme',
  'secret',
  'dev-secret',
  'please-change-this',
])

function assertStrong(name, value) {
  if (WEAK_SECRETS.has(value.toLowerCase())) {
    throw new Error(`${name} is set to a placeholder value. Generate a real one.`)
  }
  if (isProd && value.length < 32) {
    throw new Error(`${name} must be at least 32 characters in production.`)
  }
  if (!isProd && value.length < 16) {
    throw new Error(`${name} must be at least 16 characters.`)
  }
}

assertStrong('JWT_SECRET', process.env.JWT_SECRET)
assertStrong('JWT_REFRESH_SECRET', process.env.JWT_REFRESH_SECRET)

if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different values.')
}

if (process.env.ENCRYPTION_KEY === process.env.JWT_SECRET) {
  throw new Error('ENCRYPTION_KEY must be different from JWT_SECRET.')
}

export const config = {
  nodeEnv: NODE_ENV,
  isProd,
  port: int(process.env.PORT, 4000),
  databaseUrl: process.env.DATABASE_URL,
  pool: {
    max: int(process.env.PGPOOL_MAX, 10),
    idleTimeoutMillis: int(process.env.PG_IDLE_TIMEOUT_MS, 30_000),
    connectionTimeoutMillis: int(process.env.PG_CONNECT_TIMEOUT_MS, 5_000),
    // Local dev is a trusted network hop; in production the DB is expected to
    // be reachable over TLS.
    ssl: isProd && process.env.PGSSL !== 'false' ? { rejectUnauthorized: true } : false,
  },
  cors: {
    origins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },
  bcrypt: {
    // 12 is ~250ms on modern laptop hardware, which is the usual balance
    // between login latency and resistance to offline cracking.
    rounds: int(process.env.BCRYPT_ROUNDS, 12),
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    // Matches the "Remember me for 30 days" checkbox on the sign-in form.
    refreshTtlRemember: process.env.JWT_REFRESH_TTL_REMEMBER ?? '30d',
    refreshTtlDefault: process.env.JWT_REFRESH_TTL_DEFAULT ?? '1d',
    issuer: process.env.JWT_ISSUER ?? 'cloudpulse',
    audience: process.env.JWT_AUDIENCE ?? 'cloudpulse-app',
  },
  rateLimit: {
    authMax: int(process.env.RATE_LIMIT_AUTH_MAX, 10),
    authWindowMs: int(process.env.RATE_LIMIT_AUTH_WINDOW_MS, 15 * 60 * 1000),
    verifyMax: int(process.env.RATE_LIMIT_VERIFY_MAX, 20),
  },
  mail: {
    // Absent SMTP_HOST means verification codes are logged, not sent.
    smtpHost: process.env.SMTP_HOST || null,
    smtpPort: int(process.env.SMTP_PORT, 587),
    smtpSecure: process.env.SMTP_SECURE === 'true',
    smtpUser: process.env.SMTP_USER || null,
    smtpPassword: process.env.SMTP_PASSWORD || null,
    from: process.env.MAIL_FROM ?? 'CloudPulse <no-reply@cloudpulse.local>',
    codeTtlMinutes: int(process.env.VERIFY_CODE_TTL_MINUTES, 10),
    codeMaxAttempts: int(process.env.VERIFY_CODE_MAX_ATTEMPTS, 5),
  },
  encryption: {
    // base64 of exactly 32 bytes; wraps every stored cloud access key.
    key: process.env.ENCRYPTION_KEY,
  },
}
