import { createApp } from './app.js'
import { config } from './config.js'
import { closePool, pool } from './db.js'

async function main() {
  // Fail fast with a clear message rather than surfacing ENOTFOUND on the first
  // request after the server reports itself healthy.
  try {
    await pool.query('SELECT 1')
  } catch (err) {
    console.error(`[startup] cannot reach the database: ${err.message}`)
    process.exit(1)
  }

  const app = createApp()
  const server = app.listen(config.port, () => {
    console.log(`[startup] cloudpulse-backend listening on http://localhost:${config.port} (${config.nodeEnv})`)
    console.log(`[startup] CORS origins: ${config.cors.origins.join(', ')}`)
  })

  const shutdown = async (signal) => {
    console.log(`\n[shutdown] ${signal} received, closing`)
    server.close(async () => {
      await closePool()
      process.exit(0)
    })
    // Do not let a hung connection block the exit forever.
    setTimeout(() => process.exit(1), 10_000).unref()
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((err) => {
  console.error('[startup] fatal:', err)
  process.exit(1)
})
