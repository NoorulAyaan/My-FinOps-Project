import pg from 'pg'
import { config } from './config.js'

const { Pool } = pg

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ...config.pool,
})

pool.on('error', (err) => {
  // An idle client blew up (network blip, DB restart). Log it and let the pool
  // replace it rather than taking the process down.
  console.error('[db] idle client error:', err.message)
})

export function query(text, params) {
  return pool.query(text, params)
}

export async function withTransaction(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function closePool() {
  await pool.end()
}
