import { query } from './db.js'

/**
 * Checks the database round-trip rather than trusting the pool, so a page load
 * reports real connectivity instead of a stale cached state.
 */
export async function databaseStatus() {
  const startedAt = process.hrtime.bigint()
  try {
    const { rows } = await query(
      'SELECT current_database() AS name, current_user AS user, version() AS version',
    )
    const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1e6
    const info = rows[0]
    return {
      connected: true,
      latencyMs: Math.round(latencyMs * 10) / 10,
      database: info.name,
      user: info.user,
      serverVersion: info.version.split(' ').slice(0, 2).join(' '),
    }
  } catch (err) {
    return { connected: false, error: err.message }
  }
}

const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  )

const styles = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 2rem;
    font: 15px/1.6 ui-sans-serif, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: radial-gradient(circle at 50% 0%, #16233a 0%, #0b111c 55%, #070b12 100%);
    color: #e6edf7;
  }
  .card {
    width: 100%; max-width: 34rem; padding: 2.25rem;
    background: rgba(19, 27, 42, .72); backdrop-filter: blur(12px);
    border: 1px solid rgba(148, 176, 214, .16); border-radius: 16px;
    box-shadow: 0 24px 60px -20px rgba(0, 0, 0, .7);
  }
  h1 { margin: 0 0 .25rem; font-size: 1.4rem; letter-spacing: -.02em; }
  .sub { margin: 0 0 1.75rem; color: #8fa3c0; font-size: .875rem; }
  .banner {
    display: flex; align-items: center; gap: .7rem;
    padding: .9rem 1.1rem; border-radius: 10px; margin-bottom: 1.5rem;
    font-weight: 600; font-size: .95rem; border: 1px solid;
  }
  .ok   { background: rgba(34, 197, 94, .1);  border-color: rgba(34, 197, 94, .35);  color: #86efac; }
  .bad  { background: rgba(239, 68, 68, .1);  border-color: rgba(239, 68, 68, .35);  color: #fca5a5; }
  .dot  { width: .6rem; height: .6rem; border-radius: 50%; background: currentColor; flex: none; }
  .ok .dot { animation: pulse 2s ease-in-out infinite; }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
  dl { display: grid; grid-template-columns: auto 1fr; gap: .55rem 1.5rem; margin: 0; font-size: .875rem; }
  dt { color: #8fa3c0; }
  dd { margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; text-align: right; word-break: break-all; }
  ul { margin: 1.5rem 0 0; padding: 1.1rem 0 0; border-top: 1px solid rgba(148, 176, 214, .14); list-style: none; }
  li { display: flex; justify-content: space-between; gap: 1rem; padding: .3rem 0; font-size: .8125rem; }
  li span:first-child { color: #8fa3c0; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #9dc4f5; }
  footer { margin-top: 1.4rem; font-size: .75rem; color: #64748b; }
`

export function renderStatusPage({ status, uptimeSeconds, nodeVersion, endpoints }) {
  const connected = status.connected

  const rows = connected
    ? [
        ['Database', status.database],
        ['User', status.user],
        ['Server', status.serverVersion],
        ['Latency', `${status.latencyMs} ms`],
      ]
    : [['Error', status.error]]

  const heading = connected
    ? 'Backend is running with database connected'
    : 'Backend is running, but the database is not reachable'

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CloudPulse API</title>
<style>${styles}</style>
</head>
<body>
  <main class="card">
    <h1>CloudPulse API</h1>
    <p class="sub">Auth service &middot; Node ${esc(nodeVersion)} &middot; up ${esc(uptimeSeconds)}s</p>

    <div class="banner ${connected ? 'ok' : 'bad'}" role="status">
      <span class="dot"></span>
      <span>${esc(heading)}</span>
    </div>

    <dl>
      ${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('\n      ')}
    </dl>

    <ul>
      ${endpoints
        .map(
          ([method, path, note]) =>
            `<li><span><code>${esc(method)} ${esc(path)}</code></span><span>${esc(note)}</span></li>`,
        )
        .join('\n      ')}
    </ul>

    <footer>Machine-readable status at <code>/health</code></footer>
  </main>
</body>
</html>
`
}
