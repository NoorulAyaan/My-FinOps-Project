import { ApiError } from '../errors.js'
import { config } from '../config.js'

export function notFound(req, _res, next) {
  next(new ApiError(404, 'not_found', `No route for ${req.method} ${req.originalUrl}`))
}

export function errorHandler(err, _req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details && { details: err.details }) },
    })
  }

  // Malformed JSON surfaces from body-parser as a SyntaxError with .status 400.
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'bad_json', message: 'Request body is not valid JSON.' } })
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'payload_too_large', message: 'Request body is too large.' } })
  }

  // Postgres: unique violation that slipped past a service-level guard.
  if (err?.code === '23505') {
    return res.status(409).json({ error: { code: 'conflict', message: 'That record already exists.' } })
  }
  // Postgres: connection refused / auth failure / not-yet-available.
  if (err?.code === 'ECONNREFUSED' || err?.code === '57P03') {
    return res.status(503).json({ error: { code: 'db_unavailable', message: 'Database unavailable.' } })
  }

  console.error('[error]', err)
  return res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'Something went wrong.',
      // Never surface a stack trace or driver message to the client in
      // production; it leaks schema and file paths.
      ...(config.isProd ? {} : { debug: err?.message }),
    },
  })
}
