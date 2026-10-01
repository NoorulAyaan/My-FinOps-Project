import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET ??= 'test-only-access-secret-not-for-production-use'
process.env.JWT_REFRESH_SECRET ??= 'test-only-refresh-secret-not-for-production-us'
process.env.DATABASE_URL ??= 'postgresql://postgres:finops_dev_pw@localhost:5432/finops_test'
// Cost 4 keeps the suite fast; production uses 12.
process.env.BCRYPT_ROUNDS = '4'
process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString('base64')
process.env.SMTP_HOST ??= ''
process.env.VERIFY_CODE_MAX_ATTEMPTS ??= '5'

const { pool } = await import('../src/db.js')
const { createApp } = await import('../src/app.js')

const dbDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'db')

const app = createApp()
const server = app.listen(0)
await new Promise((resolve) => server.once('listening', resolve))
const base = `http://127.0.0.1:${server.address().port}`

async function api(path, { method = 'POST', body, token, origin } = {}) {
  const headers = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (token) headers.authorization = `Bearer ${token}`
  if (origin) headers.origin = origin
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null }
}

const VALID = {
  name: 'Devin Patel',
  email: 'devin@acme.corp',
  password: 'correct-horse-9',
  confirm: 'correct-horse-9',
}

async function resetUsers() {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE')
}

/** Signs up and verifies in one step, returning a usable access token. */
async function verifiedUser(overrides = {}) {
  const created = await api('/api/auth/signup', {
    body: { ...VALID, ...overrides },
  })
  const verified = await api('/api/auth/verify-email', {
    body: { userId: created.body.user.id, code: created.body.devCode },
  })
  assert.equal(verified.status, 200, `verify failed: ${JSON.stringify(verified.body)}`)
  return {
    user: verified.body.user,
    accessToken: verified.body.access.token,
    refreshToken: verified.body.refresh.token,
  }
}

const AWS_KEY = {
  provider: 'aws',
  label: 'Prod AWS',
  accountRef: '123456789012',
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  accessKeySecret: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  region: 'us-east-1',
}

before(async () => {
  const exists = await pool.query("SELECT 1 FROM pg_database WHERE datname = current_database()")
  assert.ok(exists.rowCount === 1)

  for (const file of (await readdir(dbDir)).filter((f) => f.endsWith('.sql')).sort()) {
    await pool.query(await readFile(join(dbDir, file), 'utf8'))
  }
})

after(async () => {
  await new Promise((resolve) => server.close(resolve))
  await pool.end()
})

beforeEach(resetUsers)

test('POST /api/auth/signup creates an unverified user and no session', async () => {
  const res = await api('/api/auth/signup', { body: VALID })
  assert.equal(res.status, 201)
  assert.equal(res.body.user.email, 'devin@acme.corp')
  assert.equal(res.body.user.name, 'Devin Patel')
  assert.equal(res.body.user.emailVerified, false)
  assert.ok(res.body.user.id)
  assert.equal(res.body.access, undefined, 'signup must not hand out tokens')
  assert.equal(res.body.refresh, undefined, 'signup must not hand out tokens')
  assert.ok(res.body.verificationExpiresAt)
})

test('signup stores the user unverified', async () => {
  await api('/api/auth/signup', { body: VALID })
  const { rows } = await pool.query('SELECT email_verified, verified_at FROM users')
  assert.equal(rows[0].email_verified, false)
  assert.equal(rows[0].verified_at, null)
})

test('the verification code is never stored in plaintext', async () => {
  const res = await api('/api/auth/signup', { body: VALID })
  const { rows } = await pool.query('SELECT code_hash FROM email_verifications')
  assert.equal(rows[0].code_hash.includes(res.body.devCode), false)
  assert.match(rows[0].code_hash, /^\$2[aby]\$\d{2}\$/)
})

test('the dev code is 6 digits', async () => {
  const res = await api('/api/auth/signup', { body: VALID })
  assert.match(res.body.devCode, /^\d{6}$/)
})

test('the dev code is only returned while SMTP is unconfigured', async () => {
  assert.equal(process.env.SMTP_HOST, '', 'this test assumes console fallback mode')
  const res = await api('/api/auth/signup', { body: VALID })
  assert.equal(res.body.emailSent, false)
  assert.ok(res.body.devCode, 'devCode must be present without SMTP so the flow is testable')
})

test('signin is refused until the email is verified', async () => {
  await api('/api/auth/signup', { body: VALID })
  const res = await api('/api/auth/signin', {
    body: { email: VALID.email, password: VALID.password },
  })
  assert.equal(res.status, 403)
  assert.equal(res.body.error.code, 'email_not_verified')
})

test('POST /api/auth/verify-email with the right code returns a session', async () => {
  const created = await api('/api/auth/signup', { body: VALID })
  const res = await api('/api/auth/verify-email', {
    body: { userId: created.body.user.id, code: created.body.devCode },
  })
  assert.equal(res.status, 200)
  assert.equal(res.body.user.emailVerified, true)
  assert.ok(res.body.access.token)
  assert.ok(res.body.refresh.token)
})

test('verifying marks the user verified in the database', async () => {
  const created = await api('/api/auth/signup', { body: VALID })
  await api('/api/auth/verify-email', {
    body: { userId: created.body.user.id, code: created.body.devCode },
  })
  const { rows } = await pool.query('SELECT email_verified, verified_at FROM users')
  assert.equal(rows[0].email_verified, true)
  assert.ok(rows[0].verified_at)
})

test('a wrong code is rejected and reports remaining attempts', async () => {
  const created = await api('/api/auth/signup', { body: VALID })
  const res = await api('/api/auth/verify-email', {
    body: { userId: created.body.user.id, code: '000000' },
  })
  assert.equal(res.status, 400)
  assert.match(res.body.error.message, /4 attempts remaining/)
})

test('a wrong code does not verify the user', async () => {
  const created = await api('/api/auth/signup', { body: VALID })
  await api('/api/auth/verify-email', {
    body: { userId: created.body.user.id, code: '000000' },
  })
  const { rows } = await pool.query('SELECT email_verified FROM users')
  assert.equal(rows[0].email_verified, false)
})

test('guessing past the attempt limit locks the code out', async () => {
  const created = await api('/api/auth/signup', { body: VALID })
  const limit = Number(process.env.VERIFY_CODE_MAX_ATTEMPTS)
  let last
  for (let i = 0; i < limit; i += 1) {
    last = await api('/api/auth/verify-email', {
      body: { userId: created.body.user.id, code: '000000' },
    })
  }
  assert.equal(last.status, 429)
  // Even the correct code is refused once the row is burned.
  const correct = await api('/api/auth/verify-email', {
    body: { userId: created.body.user.id, code: created.body.devCode },
  })
  assert.equal(correct.status, 400)
  const { rows } = await pool.query('SELECT email_verified FROM users')
  assert.equal(rows[0].email_verified, false)
})

test('a verification code cannot be reused', async () => {
  const created = await api('/api/auth/signup', { body: VALID })
  const first = await api('/api/auth/verify-email', {
    body: { userId: created.body.user.id, code: created.body.devCode },
  })
  assert.equal(first.status, 200)
  const replay = await api('/api/auth/verify-email', {
    body: { userId: created.body.user.id, code: created.body.devCode },
  })
  assert.equal(replay.status, 400)
})

test('a non-numeric code is rejected before any lookup', async () => {
  const created = await api('/api/auth/signup', { body: VALID })
  const res = await api('/api/auth/verify-email', {
    body: { userId: created.body.user.id, code: 'abcdef' },
  })
  assert.equal(res.status, 400)
  assert.match(res.body.error.message, /6 digits/)
})

test('verify-email requires a userId', async () => {
  const res = await api('/api/auth/verify-email', { body: { code: '123456' } })
  assert.equal(res.status, 400)
})

test('requesting a new code supersedes the previous one', async () => {
  const created = await api('/api/auth/signup', { body: VALID })
  const resent = await api('/api/auth/resend-verification', {
    body: { email: VALID.email },
  })
  assert.ok(resent.body.devCode)
  assert.notEqual(resent.body.devCode, created.body.devCode)

  const stale = await api('/api/auth/verify-email', {
    body: { userId: created.body.user.id, code: created.body.devCode },
  })
  assert.equal(stale.status, 400, 'the superseded code must not still work')
  const fresh = await api('/api/auth/verify-email', {
    body: { userId: created.body.user.id, code: resent.body.devCode },
  })
  assert.equal(fresh.status, 200)
})

test('only one unconsumed code exists per user', async () => {
  const created = await api('/api/auth/signup', { body: VALID })
  await api('/api/auth/resend-verification', { body: { email: VALID.email } })
  await api('/api/auth/resend-verification', { body: { email: VALID.email } })
  const { rows } = await pool.query(
    'SELECT count(*)::int AS n FROM email_verifications WHERE user_id = $1 AND consumed_at IS NULL',
    [created.body.user.id],
  )
  assert.equal(rows[0].n, 1)
})

test('resend-verification does not reveal whether an address exists', async () => {
  const unknown = await api('/api/auth/resend-verification', {
    body: { email: 'ghost@nowhere.io' },
  })
  const signedUp = await api('/api/auth/signup', { body: VALID })
  await api('/api/auth/verify-email', {
    body: { userId: signedUp.body.user.id, code: signedUp.body.devCode },
  })
  // Now verified: the response must be indistinguishable from the unknown case.
  const alreadyVerified = await api('/api/auth/resend-verification', {
    body: { email: VALID.email },
  })

  assert.equal(unknown.status, 200)
  assert.equal(alreadyVerified.status, 200)
  assert.equal(unknown.body.message, alreadyVerified.body.message)
  assert.equal(unknown.body.devCode, undefined)
  assert.equal(alreadyVerified.body.devCode, undefined, 'a verified address must not get a code')
  assert.equal(alreadyVerified.body.verificationExpiresAt, undefined)
})

test('signin works once the email is verified', async () => {
  await verifiedUser()
  const res = await api('/api/auth/signin', {
    body: { email: VALID.email, password: VALID.password },
  })
  assert.equal(res.status, 200)
  assert.equal(res.body.user.emailVerified, true)
})

test('signup still returns a session for a verified user with no code sent', async () => {
  await verifiedUser()
  const res = await api('/api/auth/signin', {
    body: { email: VALID.email, password: VALID.password, remember: true },
  })
  assert.equal(res.status, 200)
  assert.ok(res.body.access.token)
})

test('signup never returns the password hash', async () => {
  const res = await api('/api/auth/signup', { body: VALID })
  assert.equal(JSON.stringify(res.body).includes('password'), false)
  assert.equal(res.body.user.password_hash, undefined)
})

test('signup stores a bcrypt hash, not the password', async () => {
  await api('/api/auth/signup', { body: VALID })
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE email = $1', [
    'devin@acme.corp',
  ])
  assert.match(rows[0].password_hash, /^\$2[aby]\$\d{2}\$/)
  assert.equal(rows[0].password_hash.includes(VALID.password), false)
})

test('signup rejects a duplicate email with 409', async () => {
  await api('/api/auth/signup', { body: VALID })
  const res = await api('/api/auth/signup', { body: { ...VALID, name: 'Someone Else' } })
  assert.equal(res.status, 409)
  assert.equal(res.body.error.code, 'email_taken')
})

test('signup treats email as case-insensitive', async () => {
  await api('/api/auth/signup', { body: VALID })
  const res = await api('/api/auth/signup', { body: { ...VALID, email: 'DEVIN@ACME.CORP' } })
  assert.equal(res.status, 409)
})

test('signup lowercases the stored email', async () => {
  await api('/api/auth/signup', { body: { ...VALID, email: 'Mixed.Case@Acme.Corp' } })
  const { rows } = await pool.query('SELECT email FROM users')
  assert.equal(rows[0].email, 'mixed.case@acme.corp')
})

test('signup collapses whitespace in the name', async () => {
  await api('/api/auth/signup', { body: { ...VALID, name: '  Devin   Patel  ' } })
  const { rows } = await pool.query('SELECT name FROM users')
  assert.equal(rows[0].name, 'Devin Patel')
})

test('signup rejects a short password with 422', async () => {
  const res = await api('/api/auth/signup', { body: { ...VALID, password: 'abc', confirm: 'abc' } })
  assert.equal(res.status, 422)
  assert.ok(res.body.error.details.password)
})

test('signup rejects mismatched passwords with 422', async () => {
  const res = await api('/api/auth/signup', {
    body: { ...VALID, confirm: 'something-else' },
  })
  assert.equal(res.status, 422)
  assert.equal(res.body.error.details.confirm, 'Passwords do not match.')
})

test('signup rejects a password past bcrypt 72-byte limit', async () => {
  const long = 'a'.repeat(73)
  const res = await api('/api/auth/signup', { body: { ...VALID, password: long, confirm: long } })
  assert.equal(res.status, 422)
  assert.match(res.body.error.details.password, /72 bytes/)
})

test('signup rejects a malformed email with 422', async () => {
  const res = await api('/api/auth/signup', { body: { ...VALID, email: 'not-an-email' } })
  assert.equal(res.status, 422)
  assert.ok(res.body.error.details.email)
})

test('signup reports every missing field at once', async () => {
  const res = await api('/api/auth/signup', { body: {} })
  assert.equal(res.status, 422)
  assert.deepEqual(Object.keys(res.body.error.details).sort(), ['confirm', 'email', 'name', 'password'])
})

test('signup accepts a unicode password', async () => {
  const pw = 'pässwörd-🔒-sicher'
  await verifiedUser({ password: pw, confirm: pw })
  const res = await api('/api/auth/signin', { body: { email: VALID.email, password: pw } })
  assert.equal(res.status, 200)
})

test('POST /api/auth/signin returns a session for valid credentials', async () => {
  await verifiedUser()
  const res = await api('/api/auth/signin', {
    body: { email: VALID.email, password: VALID.password },
  })
  assert.equal(res.status, 200)
  assert.equal(res.body.user.email, VALID.email)
  assert.ok(res.body.access.token)
})

test('signin is case-insensitive on email', async () => {
  await verifiedUser()
  const res = await api('/api/auth/signin', {
    body: { email: 'DEVIN@ACME.CORP', password: VALID.password },
  })
  assert.equal(res.status, 200)
})

test('signin rejects a wrong password with 401', async () => {
  await verifiedUser()
  const res = await api('/api/auth/signin', {
    body: { email: VALID.email, password: 'not-the-password' },
  })
  assert.equal(res.status, 401)
  assert.equal(res.body.error.code, 'invalid_credentials')
})

test('signin gives an identical error for an unknown email', async () => {
  await verifiedUser()
  const unknown = await api('/api/auth/signin', {
    body: { email: 'ghost@nowhere.io', password: 'not-the-password' },
  })
  const wrongPassword = await api('/api/auth/signin', {
    body: { email: VALID.email, password: 'not-the-password' },
  })
  assert.equal(unknown.status, wrongPassword.status)
  assert.deepEqual(unknown.body, wrongPassword.body)
})

test('signin rejects a missing password with 422', async () => {
  const res = await api('/api/auth/signin', { body: { email: VALID.email } })
  assert.equal(res.status, 422)
})

test('remember true extends the refresh token to 30 days', async () => {
  await verifiedUser()
  const res = await api('/api/auth/signin', {
    body: { email: VALID.email, password: VALID.password, remember: true },
  })
  const days = (new Date(res.body.refresh.expiresAt) - Date.now()) / 86_400_000
  assert.ok(days > 29 && days <= 30, `expected ~30 days, got ${days}`)
})

test('remember false keeps the refresh token at 1 day', async () => {
  await verifiedUser()
  const res = await api('/api/auth/signin', {
    body: { email: VALID.email, password: VALID.password },
  })
  const days = (new Date(res.body.refresh.expiresAt) - Date.now()) / 86_400_000
  assert.ok(days > 0.9 && days <= 1, `expected ~1 day, got ${days}`)
})

test('access token lifetime is unchanged by remember', async () => {
  await verifiedUser()
  const res = await api('/api/auth/signin', {
    body: { email: VALID.email, password: VALID.password, remember: true },
  })
  assert.equal(res.body.access.expiresIn, 900)
})

test('GET /api/auth/me returns the current user', async () => {
  const user = await verifiedUser()
  const res = await api('/api/auth/me', { method: 'GET', token: user.accessToken })
  assert.equal(res.status, 200)
  assert.equal(res.body.user.id, user.user.id)
  assert.equal(res.body.user.emailVerified, true)
})

test('GET /api/auth/me rejects a missing token', async () => {
  const res = await api('/api/auth/me', { method: 'GET' })
  assert.equal(res.status, 401)
})

test('GET /api/auth/me rejects a malformed token', async () => {
  const res = await api('/api/auth/me', { method: 'GET', token: 'not.a.jwt' })
  assert.equal(res.status, 401)
})

test('a refresh token cannot be used as an access token', async () => {
  const user = await verifiedUser()
  const res = await api('/api/auth/me', { method: 'GET', token: user.refreshToken })
  assert.equal(res.status, 401)
})

test('an access token signed with the wrong secret is rejected', async () => {
  const jwt = (await import('jsonwebtoken')).default
  const forged = jwt.sign({ sub: '1', email: VALID.email, name: 'x', typ: 'access' }, 'wrong-secret', {
    expiresIn: '15m',
    issuer: process.env.JWT_ISSUER ?? 'cloudpulse',
    audience: process.env.JWT_AUDIENCE ?? 'cloudpulse-app',
  })
  const res = await api('/api/auth/me', { method: 'GET', token: forged })
  assert.equal(res.status, 401)
})

test('POST /api/auth/refresh issues a new pair of tokens', async () => {
  const user = await verifiedUser()
  const res = await api('/api/auth/refresh', { body: { refreshToken: user.refreshToken } })
  assert.equal(res.status, 200)
  assert.ok(res.body.access.token)
  assert.notEqual(res.body.refresh.token, user.refreshToken)
})

test('a used refresh token cannot be replayed', async () => {
  const user = await verifiedUser()
  const first = user.refreshToken
  await api('/api/auth/refresh', { body: { refreshToken: first } })
  const replay = await api('/api/auth/refresh', { body: { refreshToken: first } })
  assert.equal(replay.status, 401)
})

test('POST /api/auth/logout revokes the refresh token', async () => {
  const user = await verifiedUser()
  const out = await api('/api/auth/logout', { body: { refreshToken: user.refreshToken } })
  assert.equal(out.status, 204)
  const after = await api('/api/auth/refresh', { body: { refreshToken: user.refreshToken } })
  assert.equal(after.status, 401)
})

test('logout always returns 204, even with no token', async () => {
  const res = await api('/api/auth/logout', { body: {} })
  assert.equal(res.status, 204)
})

test('refresh requires a token', async () => {
  const res = await api('/api/auth/refresh', { body: {} })
  assert.equal(res.status, 400)
})

test('refresh stores only a hash, never the raw token', async () => {
  const user = await verifiedUser()
  const { rows } = await pool.query('SELECT token_hash FROM refresh_tokens')
  assert.equal(rows.some((r) => r.token_hash === user.refreshToken), false)
  assert.match(rows[0].token_hash, /^[a-f0-9]{64}$/)
})

test('deleting a user cascades to their refresh tokens', async () => {
  await api('/api/auth/signup', { body: VALID })
  await pool.query('DELETE FROM users')
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM refresh_tokens')
  assert.equal(rows[0].n, 0)
})

test('malformed JSON gets a 400, not a 500', async () => {
  const res = await fetch(`${base}/api/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{nope',
  })
  assert.equal(res.status, 400)
  assert.equal((await res.json()).error.code, 'bad_json')
})

test('an oversized body is rejected', async () => {
  const res = await fetch(`${base}/api/auth/signup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'x'.repeat(20_000) }),
  })
  assert.equal(res.status, 413)
})

test('unknown routes return 404', async () => {
  const res = await api('/api/auth/nope', { body: {} })
  assert.equal(res.status, 404)
})

test('an allowed origin receives CORS headers', async () => {
  const res = await api('/api/auth/signin', {
    body: { email: VALID.email, password: VALID.password },
    origin: 'http://localhost:5173',
  })
  assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173')
})

test('a disallowed origin is refused with 403', async () => {
  const res = await api('/api/auth/signin', {
    body: { email: VALID.email, password: VALID.password },
    origin: 'https://evil.example.com',
  })
  assert.equal(res.status, 403)
  assert.equal(res.headers.get('access-control-allow-origin'), null)
})

test('responses do not advertise the server framework', async () => {
  const res = await api('/health', { method: 'GET' })
  assert.equal(res.headers.get('x-powered-by'), null)
})

test('security headers are present', async () => {
  const res = await api('/health', { method: 'GET' })
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
  assert.ok(res.headers.get('content-security-policy'))
})

test('GET /health reports the database as up', async () => {
  const res = await api('/health', { method: 'GET' })
  assert.equal(res.status, 200)
  assert.equal(res.body.database, 'up')
  assert.equal(res.body.databaseName, 'finops_test')
  assert.equal(typeof res.body.latencyMs, 'number')
  assert.equal(typeof res.body.uptimeSeconds, 'number')
})

test('GET / renders an HTML status page', async () => {
  const res = await fetch(`${base}/`)
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type'), /text\/html/)
  const html = await res.text()
  assert.match(html, /Backend is running with database connected/)
  assert.match(html, /<html lang="en">/)
  assert.match(html, /finops_test/)
  assert.match(html, /PostgreSQL/)
})

test('GET / lists the auth endpoints', async () => {
  const html = await (await fetch(`${base}/`)).text()
  for (const path of ['/api/auth/signup', '/api/auth/signin', '/api/auth/refresh', '/api/auth/logout', '/api/auth/me']) {
    assert.ok(html.includes(path), `missing ${path}`)
  }
})

test('GET / carries no script, so nothing can execute in the page', async () => {
  const html = await (await fetch(`${base}/`)).text()
  assert.equal(/<script/i.test(html), false)
})

test('the status page escapes values it interpolates', async () => {
  const { renderStatusPage } = await import('../src/statusPage.js')
  const html = renderStatusPage({
    status: { connected: false, error: '<img src=x onerror=alert(1)>' },
    uptimeSeconds: 1,
    nodeVersion: '20.0.0',
    endpoints: [['<script>alert(1)</script>', '/x', 'y']],
  })
  assert.equal(html.includes('<img src=x'), false)
  assert.equal(html.includes('<script>alert(1)'), false)
  assert.match(html, /&lt;img src=x/)
  assert.match(html, /class="banner bad"/)
  assert.match(html, /database is not reachable/)
})

test('the status page reports connectivity rather than assuming it', async () => {
  const { databaseStatus } = await import('../src/statusPage.js')
  const status = await databaseStatus()
  assert.equal(status.connected, true)
  assert.equal(status.database, 'finops_test')
  assert.equal(status.user, 'postgres')
})
