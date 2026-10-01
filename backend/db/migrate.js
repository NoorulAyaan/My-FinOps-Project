import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { closePool, pool } from '../src/db.js'

const here = dirname(fileURLToPath(import.meta.url))

async function main() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  const files = (await readdir(here))
    .filter((f) => f.endsWith('.sql'))
    .sort()

  const { rows } = await pool.query('SELECT name FROM schema_migrations')
  const applied = new Set(rows.map((r) => r.name))

  let count = 0
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip   ${file} (already applied)`)
      continue
    }
    const sql = await readFile(join(here, file), 'utf8')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
      await client.query('COMMIT')
      console.log(`apply  ${file}`)
      count += 1
    } catch (err) {
      await client.query('ROLLBACK')
      throw new Error(`Migration ${file} failed: ${err.message}`, { cause: err })
    } finally {
      client.release()
    }
  }

  console.log(count ? `\n${count} migration(s) applied.` : '\nDatabase already up to date.')
}

main()
  .catch((err) => {
    console.error(`\nmigrate failed: ${err.message}`)
    process.exitCode = 1
  })
  .finally(() => closePool())
