import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { config } from './config.js'
import { ApiError, tooManyRequests } from './errors.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'
import authRoutes from './routes/auth.js'
import cloudAccountRoutes from './routes/cloudAccounts.js'
import { databaseStatus, renderStatusPage } from './statusPage.js'

export function createApp() {
  const app = express()

  // Required for correct client IPs (and therefore rate limiting) behind a
  // reverse proxy. `1` trusts exactly one hop, so a client cannot spoof
  // X-Forwarded-For to evade the limiter.
  app.set('trust proxy', 1)
  app.disable('x-powered-by')

  app.use(helmet())
  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin and non-browser clients (curl, health checks) send no
        // Origin header.
        if (!origin) return callback(null, true)
        if (config.cors.origins.includes(origin)) return callback(null, true)
        return callback(new ApiError(403, 'cors_denied', 'Origin not allowed.'))
      },
      credentials: true,
    }),
  )

  app.use(express.json({ limit: '10kb' }))

  const STARTED_AT = Date.now()
  const ENDPOINTS = [
    ['POST', '/api/auth/signup', 'create an account'],
    ['POST', '/api/auth/signin', 'start a session'],
    ['POST', '/api/auth/refresh', 'rotate tokens'],
    ['POST', '/api/auth/logout', 'revoke a session'],
    ['GET', '/api/auth/me', 'current user'],
    ['GET', '/health', 'JSON status'],
  ]

  app.get('/', async (_req, res) => {
    const status = await databaseStatus()
    res.type('html').send(
      renderStatusPage({
        status,
        uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
        nodeVersion: process.versions.node,
        endpoints: ENDPOINTS,
      }),
    )
  })

  app.get('/health', async (_req, res) => {
    const status = await databaseStatus()
    if (!status.connected) {
      return res.status(503).json({ status: 'degraded', database: 'down' })
    }
    res.json({
      status: 'ok',
      database: 'up',
      databaseName: status.database,
      latencyMs: status.latencyMs,
      uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
    })
  })

  // Throttles credential-stuffing against the two password endpoints.
  const authLimiter = rateLimit({
    windowMs: config.rateLimit.authWindowMs,
    limit: config.rateLimit.authMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => config.nodeEnv === 'test',
    handler: (_req, _res, next) => next(tooManyRequests()),
  })

  // Verification is rate limited harder than sign-in: a 6-digit code is only
  // 1e6 possibilities, so an unthrottled endpoint is brute-forceable.
  const verifyLimiter = rateLimit({
    windowMs: config.rateLimit.authWindowMs,
    limit: config.rateLimit.verifyMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => config.nodeEnv === 'test',
    handler: (_req, _res, next) => next(tooManyRequests()),
  })

  app.use('/api/auth/signup', authLimiter)
  app.use('/api/auth/signin', authLimiter)
  app.use('/api/auth/verify-email', verifyLimiter)
  app.use('/api/auth/resend-verification', verifyLimiter)
  app.use('/api/auth', authRoutes)
  app.use('/api/cloud-accounts', cloudAccountRoutes)

  app.use(notFound)
  app.use(errorHandler)

  return app
}
