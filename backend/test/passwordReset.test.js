/**
 * Password reset: request a code by email, then redeem it for a new password.
 *
 * Run: npm test  (picked up by `node --test test/*.test.js`)
 */
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { after, before, beforeEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET ??= 'test-only-access-secret-not-for-production-use'
process.env.JWT_REFRESH_SECRET ??= 'test-only-refresh-secret-not-for-production-us'
// Its own database: `node --test` runs files in parallel, and this suite
// truncates users, so sharing one with auth.test.js would clobber it mid-run.
process.env.DATABASE_URL ??= 'postgresql://postgres:finops_dev_pw@localhost:5432/finops_test_reset'
// Cost 4 keeps the suite fast; production uses 12.
process.env.BCRYPT_ROUNDS = '4'
process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString('base64')
// Left empty so the console fallback returns devCode, which is how these tests
// get the plaintext code without running an SMTP server.
process.env.SMTP_HOST ??= ''
process.env.RESET_CODE_MAX_ATTEMPTS ??= '5'

const { pool } = await import('../src/db.js')
const { createApp } = await import('../src/app.js')

const dbDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'db')

const app = createApp()
const server = app.listen(0)
await new Promise((resolve) => server.once('listening', resolve))
const base = `http://127.0.0.1:${server.address().port}`

before(async () => {
  for (const file of (await readdir(dbDir)).filter((f) => f.endsWith('.sql')).sort()) {
    await pool.query(await readFile(join(dbDir, file), 'utf8'))
  }
})

after(async () => {
  await new Promise((resolve) => server.close(resolve))
  await pool.end()
})

async function api(path, { method = 'POST', body, token } = {}) {
  const headers = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (token) headers.authorization = `Bearer ${token}`
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

const VALID = {
  name: 'Reset Tester',
  email: 'reset@acme.corp',
  password: 'original-password-1',
  confirm: 'original-password-1',
}

const NEW_PASSWORD = 'brand-new-password-9'

async function resetUsers() {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE')
}

/** A verified account plus a live session, so revocation can be asserted. */
async function verifiedUser() {
  const created = await api('/api/auth/signup', { body: VALID })
  await api('/api/auth/verify-email', {
    body: { userId: created.body.user.id, code: created.body.devCode },
  })
  const session = await api('/api/auth/signin', {
    body: { email: VALID.email, password: VALID.password },
  })
  assert.equal(session.status, 200, `signin failed: ${JSON.stringify(session.body)}`)
  return { userId: created.body.user.id, session: session.body }
}

/** Runs the forgot-password request and returns the issued code. */
async function requestCode(email = VALID.email) {
  const res = await api('/api/auth/forgot-password', { body: { email } })
  assert.equal(res.status, 200, `forgot-password failed: ${JSON.stringify(res.body)}`)
  return res
}

beforeEach(resetUsers)

test('forgot-password emails a code to a registered address', async () => {
  const { userId } = await verifiedUser()
  const res = await requestCode()

  assert.match(res.body.message, /reset code is on its way/i)
  // Console transport only; with SMTP configured this field is absent.
  assert.match(res.body.devCode, /^\d{6}$/)
  assert.ok(userId)
})

test('forgot-password does not reveal whether an address is registered', async () => {
  await verifiedUser()
  const unknown = await requestCode('ghost@nowhere.io')
  const known = await requestCode()

  assert.equal(unknown.status, known.status)
  assert.equal(unknown.body.message, known.body.message)
})

test('forgot-password rejects a malformed email', async () => {
  const res = await api('/api/auth/forgot-password', { body: { email: 'not-an-email' } })
  assert.equal(res.status, 422)
  assert.ok(res.body.error.details.email)
})

test('forgot-password requires an email', async () => {
  const res = await api('/api/auth/forgot-password', { body: {} })
  assert.equal(res.status, 422)
})

test('an incorrect reset code is rejected and counted down', async () => {
  await verifiedUser()
  await requestCode()

  const res = await api('/api/auth/reset-password', {
    body: { email: VALID.email, code: '000000', password: NEW_PASSWORD, confirm: NEW_PASSWORD },
  })
  assert.equal(res.status, 400)
  assert.match(res.body.error.message, /Incorrect code\. 4 attempt/)
})

test('a correct reset code changes the password', async () => {
  await verifiedUser()
  const { body } = await requestCode()

  const res = await api('/api/auth/reset-password', {
    body: { email: VALID.email, code: body.devCode, password: NEW_PASSWORD, confirm: NEW_PASSWORD },
  })
  assert.equal(res.status, 200)
  assert.match(res.body.message, /sign in with your new password/i)

  const oldPassword = await api('/api/auth/signin', {
    body: { email: VALID.email, password: VALID.password },
  })
  assert.equal(oldPassword.status, 401)

  const newPassword = await api('/api/auth/signin', {
    body: { email: VALID.email, password: NEW_PASSWORD },
  })
  assert.equal(newPassword.status, 200)
})

test('resetting the password revokes every existing session', async () => {
  // The whole point of a reset: if an attacker holds a session, it must not
  // survive the user changing the password.
  const { userId, session } = await verifiedUser()
  const { body } = await requestCode()

  await api('/api/auth/reset-password', {
    body: { email: VALID.email, code: body.devCode, password: NEW_PASSWORD, confirm: NEW_PASSWORD },
  })

  const refreshed = await api('/api/auth/refresh', {
    body: { refreshToken: session.refresh.token },
  })
  assert.equal(refreshed.status, 401, 'a refresh token from before the reset still worked')

  // The access token is a stateless JWT, so it is only caught by the user being
  // signed out of the new session; what matters here is that no refresh token
  // survives to mint another one.
  const afterReset = await api('/api/auth/signin', {
    body: { email: VALID.email, password: NEW_PASSWORD },
  })
  assert.equal(afterReset.status, 200)
})

test('a reset code cannot be redeemed twice', async () => {
  await verifiedUser()
  const { body } = await requestCode()

  const first = await api('/api/auth/reset-password', {
    body: { email: VALID.email, code: body.devCode, password: NEW_PASSWORD, confirm: NEW_PASSWORD },
  })
  assert.equal(first.status, 200)

  const second = await api('/api/auth/reset-password', {
    body: { email: VALID.email, code: body.devCode, password: 'another-pass-123', confirm: 'another-pass-123' },
  })
  assert.equal(second.status, 400)
  assert.match(second.body.error.message, /No reset code is active/)
})

test('requesting a new code supersedes the previous one', async () => {
  await verifiedUser()
  const first = await requestCode()
  const second = await requestCode()

  const stale = await api('/api/auth/reset-password', {
    body: { email: VALID.email, code: first.body.devCode, password: NEW_PASSWORD, confirm: NEW_PASSWORD },
  })
  assert.equal(stale.status, 400, 'the superseded code was still accepted')

  const fresh = await api('/api/auth/reset-password', {
    body: { email: VALID.email, code: second.body.devCode, password: NEW_PASSWORD, confirm: NEW_PASSWORD },
  })
  assert.equal(fresh.status, 200)
})

test('too many wrong codes locks the reset out until a new one is requested', async () => {
  await verifiedUser()
  const { body } = await requestCode()

  for (let i = 0; i < 4; i++) {
    const res = await api('/api/auth/reset-password', {
      body: { email: VALID.email, code: '000000', password: NEW_PASSWORD, confirm: NEW_PASSWORD },
    })
    assert.equal(res.status, 400)
  }

  const locked = await api('/api/auth/reset-password', {
    body: { email: VALID.email, code: '000000', password: NEW_PASSWORD, confirm: NEW_PASSWORD },
  })
  assert.equal(locked.status, 429)

  // Even the correct code is refused once the attempt cap consumed it.
  const afterLockout = await api('/api/auth/reset-password', {
    body: { email: VALID.email, code: body.devCode, password: NEW_PASSWORD, confirm: NEW_PASSWORD },
  })
  assert.equal(afterLockout.status, 400)

  const fresh = await requestCode()
  const recovered = await api('/api/auth/reset-password', {
    body: { email: VALID.email, code: fresh.body.devCode, password: NEW_PASSWORD, confirm: NEW_PASSWORD },
  })
  assert.equal(recovered.status, 200)
})

test('reset-password validates the new password and its confirmation', async () => {
  await verifiedUser()
  const { body } = await requestCode()

  const tooShort = await api('/api/auth/reset-password', {
    body: { email: VALID.email, code: body.devCode, password: 'short', confirm: 'short' },
  })
  assert.equal(tooShort.status, 422)
  assert.ok(tooShort.body.error.details.password)

  const mismatch = await api('/api/auth/reset-password', {
    body: { email: VALID.email, code: body.devCode, password: NEW_PASSWORD, confirm: 'something-else-1' },
  })
  assert.equal(mismatch.status, 422)
  assert.ok(mismatch.body.error.details.confirm)
})

test('reset-password requires a six-digit code', async () => {
  await verifiedUser()
  await requestCode()

  const res = await api('/api/auth/reset-password', {
    body: { email: VALID.email, code: '12345', password: NEW_PASSWORD, confirm: NEW_PASSWORD },
  })
  assert.equal(res.status, 400)
  assert.match(res.body.error.message, /6 digits/)
})

test('reset-password rejects a malformed email', async () => {
  await verifiedUser()
  await requestCode()

  const res = await api('/api/auth/reset-password', {
    body: { email: 'not-an-email', code: '123456', password: NEW_PASSWORD, confirm: NEW_PASSWORD },
  })
  assert.equal(res.status, 422)
  assert.ok(res.body.error.details.email)
})

test('reset-password requires an email', async () => {
  await verifiedUser()
  await requestCode()

  const res = await api('/api/auth/reset-password', {
    body: { code: '123456', password: NEW_PASSWORD, confirm: NEW_PASSWORD },
  })
  assert.equal(res.status, 422)
  assert.ok(res.body.error.details.email)
})

test('an unverified account can still reset its password', async () => {
  // Someone who never finished signup is locked out of sign-in; the reset flow
  // must not depend on being verified, or they could never get back in.
  await api('/api/auth/signup', { body: VALID })
  const res = await requestCode()

  const reset = await api('/api/auth/reset-password', {
    body: {
      email: VALID.email,
      code: res.body.devCode,
      password: NEW_PASSWORD,
      confirm: NEW_PASSWORD,
    },
  })
  assert.equal(reset.status, 200)

  const signin = await api('/api/auth/signin', {
    body: { email: VALID.email, password: NEW_PASSWORD },
  })
  // Still refused, and correctly so: the reset does not verify the address.
  assert.equal(signin.status, 403)
  assert.equal(signin.body.error.code, 'email_not_verified')
})

test('a reset code issued for one account cannot reset another', async () => {
  await verifiedUser()
  await api('/api/auth/signup', { body: { ...VALID, email: 'other@acme.corp' } })

  // A code mailed to reset@acme.corp, redeemed against other@acme.corp.
  const { body } = await requestCode()

  const res = await api('/api/auth/reset-password', {
    body: {
      email: 'other@acme.corp',
      code: body.devCode,
      password: NEW_PASSWORD,
      confirm: NEW_PASSWORD,
    },
  })
  assert.equal(res.status, 400)
  assert.match(res.body.error.message, /No reset code is active/)

  // And the account the code was actually issued for still works.
  const owner = await api('/api/auth/reset-password', {
    body: { email: VALID.email, code: body.devCode, password: NEW_PASSWORD, confirm: NEW_PASSWORD },
  })
  assert.equal(owner.status, 200)
})

test('an unknown address is indistinguishable from a spent code', async () => {
  await verifiedUser()
  const { body } = await requestCode()

  // Redeem it, so the code is now spent.
  const ok = await api('/api/auth/reset-password', {
    body: { email: VALID.email, code: body.devCode, password: NEW_PASSWORD, confirm: NEW_PASSWORD },
  })
  assert.equal(ok.status, 200)

  const spent = await api('/api/auth/reset-password', {
    body: { email: VALID.email, code: body.devCode, password: NEW_PASSWORD, confirm: NEW_PASSWORD },
  })
  const unknown = await api('/api/auth/reset-password', {
    body: { email: 'ghost@nowhere.io', code: '123456', password: NEW_PASSWORD, confirm: NEW_PASSWORD },
  })

  assert.equal(unknown.status, spent.status)
  assert.equal(unknown.body.error.message, spent.body.error.message)
})

test('the reset code is stored hashed, never in plaintext', async () => {
  const { userId } = await verifiedUser()
  const { body } = await requestCode()

  const { rows } = await pool.query(
    'SELECT code_hash FROM password_reset_codes WHERE user_id = $1',
    [userId],
  )
  assert.equal(rows.length, 1)
  assert.notEqual(rows[0].code_hash, body.devCode)
  assert.match(rows[0].code_hash, /^\$2[aby]\$/)
})

test('only the newest reset code stays live', async () => {
  const { userId } = await verifiedUser()
  await requestCode()
  await requestCode()

  const { rows } = await pool.query(
    `SELECT consumed_at, created_at FROM password_reset_codes
      WHERE user_id = $1 ORDER BY created_at ASC`,
    [userId],
  )
  assert.equal(rows.length, 2, 'both requests should be recorded')
  // The superseded code is retired; the newest is the one that can be redeemed.
  assert.ok(rows[0].consumed_at !== null, 'the superseded code should be consumed')
  assert.equal(rows[1].consumed_at, null, 'the newest code should be the live one')

  // The partial unique index is what guarantees this at the database level.
  const live = await pool.query(
    'SELECT count(*)::int AS n FROM password_reset_codes WHERE user_id = $1 AND consumed_at IS NULL',
    [userId],
  )
  assert.equal(live.rows[0].n, 1)
})

test('the status page lists the reset endpoints', async () => {
  const res = await fetch(base)
  const html = await res.text()
  assert.match(html, /\/api\/auth\/forgot-password/)
  assert.match(html, /\/api\/auth\/reset-password/)
})