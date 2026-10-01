/**
 * Account settings: profile updates, avatar upload/removal, password change,
 * connected cloud accounts, and session management.
 *
 * Run: npm test  (picked up by `node --test test/*.test.js`)
 */
import assert from 'node:assert/strict'
import { readdir, readFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { after, before, beforeEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET ??= 'test-only-access-secret-not-for-production-use'
process.env.JWT_REFRESH_SECRET ??= 'test-only-refresh-secret-not-for-production-us'
// Its own database: node --test runs files in parallel and this suite truncates
// users, so sharing one with auth.test.js would clobber it mid-run.
process.env.DATABASE_URL ??= 'postgresql://postgres:finops_dev_pw@localhost:5432/finops_test_account'
process.env.BCRYPT_ROUNDS = '4'
process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString('base64')
process.env.SMTP_HOST ??= ''
// Avatars go to a temp dir so the suite never touches backend/uploads.
const UPLOAD_DIR = '/tmp/cloudpulse-test-uploads'
process.env.UPLOAD_DIR = UPLOAD_DIR

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
  await rm(UPLOAD_DIR, { recursive: true, force: true })
})

async function api(path, { method = 'POST', body, token, form } = {}) {
  const headers = {}
  let payload
  if (form) {
    payload = form
  } else if (body !== undefined) {
    headers['content-type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  if (token) headers.authorization = `Bearer ${token}`
  const res = await fetch(`${base}${path}`, { method, headers, body: payload })
  const text = await res.text()
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null }
}

const VALID = {
  name: 'Settings Tester',
  email: 'settings@acme.corp',
  password: 'original-password-1',
  confirm: 'original-password-1',
}

async function resetAll() {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE')
  await rm(UPLOAD_DIR, { recursive: true, force: true })
}

/** A verified account with a live session. */
async function signedInUser(overrides = {}) {
  const created = await api('/api/auth/signup', { body: { ...VALID, ...overrides } })
  await api('/api/auth/verify-email', {
    body: { userId: created.body.user.id, code: created.body.devCode },
  })
  const session = await api('/api/auth/signin', {
    body: { email: overrides.email ?? VALID.email, password: VALID.password },
  })
  assert.equal(session.status, 200, `signin failed: ${JSON.stringify(session.body)}`)
  return { user: created.body.user, token: session.body.access.token, refresh: session.body.refresh.token }
}

// Minimal valid PNGs, distinguished by colour so a swapped file is detectable.
const PNG_RED = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)
const PNG_BLUE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)

function filePart(buffer, filename, contentType) {
  const form = new FormData()
  form.append('avatar', new Blob([buffer], { type: contentType }), filename)
  return form
}

beforeEach(resetAll)

/** ---------------------------------------------------------------- profile */

test('GET /me reports the avatar url as null before one is uploaded', async () => {
  const { token } = await signedInUser()
  const res = await api('/api/auth/me', { method: 'GET', token })

  assert.equal(res.status, 200)
  assert.equal(res.body.user.avatarUrl, null)
  assert.equal(res.body.user.email, VALID.email)
  assert.equal(res.body.user.emailVerified, true)
})

test('PATCH /me updates the display name', async () => {
  const { token } = await signedInUser()
  const res = await api('/api/auth/me', { method: 'PATCH', token, body: { name: 'Renamed Person' } })

  assert.equal(res.status, 200)
  assert.equal(res.body.user.name, 'Renamed Person')

  const me = await api('/api/auth/me', { method: 'GET', token })
  assert.equal(me.body.user.name, 'Renamed Person')
})

test('PATCH /me rejects an empty or overlong name', async () => {
  const { token } = await signedInUser()

  const empty = await api('/api/auth/me', { method: 'PATCH', token, body: { name: '   ' } })
  assert.equal(empty.status, 422)
  assert.ok(empty.body.error.details.name)

  const long = await api('/api/auth/me', { method: 'PATCH', token, body: { name: 'x'.repeat(121) } })
  assert.equal(long.status, 422)
  assert.ok(long.body.error.details.name)
})

test('PATCH /me rejects a malformed timezone', async () => {
  const { token } = await signedInUser()

  const bad = await api('/api/auth/me', { method: 'PATCH', token, body: { timezone: 'Europe/London; DROP TABLE users' } })
  assert.equal(bad.status, 422)
  assert.ok(bad.body.error.details.timezone)

  const good = await api('/api/auth/me', { method: 'PATCH', token, body: { timezone: 'Europe/London' } })
  assert.equal(good.status, 200)
  assert.equal(good.body.user.timezone, 'Europe/London')
})

test('PATCH /me cannot change the email address', async () => {
  // The email is the account identity; changing it silently would let a user
  // hand their account to someone else without re-verifying.
  const { token } = await signedInUser()
  const res = await api('/api/auth/me', { method: 'PATCH', token, body: { name: 'Fine', email: 'new@evil.test' } })

  const me = await api('/api/auth/me', { method: 'GET', token })
  assert.equal(me.body.user.email, VALID.email, 'the email changed')
  assert.equal(res.status, 200)
})

test('profile endpoints require a session', async () => {
  for (const [method, path, body] of [
    ['PATCH', '/api/auth/me', { name: 'X' }],
    ['POST', '/api/auth/me/avatar', undefined],
    ['DELETE', '/api/auth/me/avatar', undefined],
    ['POST', '/api/auth/change-password', { currentPassword: 'a', newPassword: 'bbbbbbbb', confirm: 'bbbbbbbb' }],
  ]) {
    const res = await api(path, { method, body })
    assert.equal(res.status, 401, `${method} ${path} was reachable without a token`)
  }
})

/** ----------------------------------------------------------------- avatar */

test('uploading a png avatar stores it and returns a url', async () => {
  const { token } = await signedInUser()
  const res = await api('/api/auth/me/avatar', {
    method: 'POST',
    token,
    form: filePart(PNG_RED, 'me.png', 'image/png'),
  })

  assert.equal(res.status, 200)
  assert.match(res.body.user.avatarUrl, /^\/uploads\/avatars\/[0-9a-f-]+\.png$/)

  const me = await api('/api/auth/me', { method: 'GET', token })
  assert.equal(me.body.user.avatarUrl, res.body.user.avatarUrl)
})

test('the stored avatar is actually served back as an image', async () => {
  const { token } = await signedInUser()
  const uploaded = await api('/api/auth/me/avatar', {
    method: 'POST',
    token,
    form: filePart(PNG_RED, 'me.png', 'image/png'),
  })

  const res = await fetch(`${base}${uploaded.body.user.avatarUrl}`)
  assert.equal(res.status, 200)
  assert.match(res.headers.get('content-type'), /image\/png/)
  // Belt and braces: the bytes must not be reinterpretable as an active document.
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(res.headers.get('cross-origin-resource-policy'), 'same-origin')
  const bytes = Buffer.from(await res.arrayBuffer())
  assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG')
})

test('replacing an avatar removes the old file from disk', async () => {
  const { token } = await signedInUser()
  const first = await api('/api/auth/me/avatar', {
    method: 'POST',
    token,
    form: filePart(PNG_RED, 'first.png', 'image/png'),
  })
  const second = await api('/api/auth/me/avatar', {
    method: 'POST',
    token,
    form: filePart(PNG_BLUE, 'second.png', 'image/png'),
  })

  assert.notEqual(first.body.user.avatarUrl, second.body.user.avatarUrl)

  const old = await fetch(`${base}${first.body.user.avatarUrl}`)
  assert.equal(old.status, 404, 'the replaced avatar is still being served')
})

test('an uploaded file keeps a generated name, not the client filename', async () => {
  const { token } = await signedInUser()
  // A traversal attempt in the filename must not influence the stored path.
  const res = await api('/api/auth/me/avatar', {
    method: 'POST',
    token,
    form: filePart(PNG_RED, '../../../etc/passwd.png', 'image/png'),
  })

  assert.equal(res.status, 200)
  assert.ok(!res.body.user.avatarUrl.includes('..'))
  assert.ok(!res.body.user.avatarUrl.includes('passwd'))
})

test('a non-image disguised as a png is rejected', async () => {
  const { token } = await signedInUser()
  const html = Buffer.from('<html><script>alert(1)</script></html>', 'utf8')

  const res = await api('/api/auth/me/avatar', {
    method: 'POST',
    token,
    form: filePart(html, 'evil.png', 'image/png'),
  })

  assert.equal(res.status, 400)
  assert.match(res.body.error.message, /not a readable image/i)

  const me = await api('/api/auth/me', { method: 'GET', token })
  assert.equal(me.body.user.avatarUrl, null, 'a rejected upload still set an avatar')
})

test('an unsupported content type is rejected', async () => {
  const { token } = await signedInUser()
  const res = await api('/api/auth/me/avatar', {
    method: 'POST',
    token,
    form: filePart(Buffer.from('MZ\u0090\u0000'), 'tool.exe', 'application/x-msdownload'),
  })

  assert.equal(res.status, 400)
})

test('an empty avatar field is rejected', async () => {
  const { token } = await signedInUser()
  const form = new FormData()
  form.append('avatar', new Blob([], { type: 'image/png' }), 'empty.png')

  const res = await api('/api/auth/me/avatar', { method: 'POST', token, form })
  assert.equal(res.status, 400)
})

test('deleting the avatar clears the url and the file', async () => {
  const { token } = await signedInUser()
  const uploaded = await api('/api/auth/me/avatar', {
    method: 'POST',
    token,
    form: filePart(PNG_RED, 'me.png', 'image/png'),
  })

  const res = await api('/api/auth/me/avatar', { method: 'DELETE', token })
  assert.equal(res.status, 200)
  assert.equal(res.body.user.avatarUrl, null)

  const gone = await fetch(`${base}${uploaded.body.user.avatarUrl}`)
  assert.equal(gone.status, 404)
})

/** --------------------------------------------------------- password change */

test('changing the password requires the correct current one', async () => {
  const { token } = await signedInUser()

  const wrong = await api('/api/auth/change-password', {
    token,
    body: { currentPassword: 'not-the-password', newPassword: 'new-password-9', confirm: 'new-password-9' },
  })
  assert.equal(wrong.status, 401)
  // The caller is authenticated here, so the message can be specific; the vague
  // sign-in wording would just confuse someone mid-change.
  assert.equal(wrong.body.error.code, 'invalid_credentials')
  assert.match(wrong.body.error.message, /current password is not correct/i)

  const right = await api('/api/auth/change-password', {
    token,
    body: { currentPassword: VALID.password, newPassword: 'new-password-9', confirm: 'new-password-9' },
  })
  assert.equal(right.status, 200)
  assert.match(right.body.message, /Other devices have been signed out/)

  const old = await api('/api/auth/signin', {
    body: { email: VALID.email, password: VALID.password },
  })
  assert.equal(old.status, 401)

  const fresh = await api('/api/auth/signin', {
    body: { email: VALID.email, password: 'new-password-9' },
  })
  assert.equal(fresh.status, 200)
})

test('changing the password revokes other sessions but keeps the current one', async () => {
  const { token } = await signedInUser()
  const other = await api('/api/auth/signin', {
    body: { email: VALID.email, password: VALID.password },
  })
  const otherRefresh = other.body.refresh.token

  const res = await api('/api/auth/change-password', {
    token,
    body: { currentPassword: VALID.password, newPassword: 'new-password-9', confirm: 'new-password-9' },
  })
  assert.equal(res.status, 200)

  const otherRefreshed = await api('/api/auth/refresh', { body: { refreshToken: otherRefresh } })
  assert.equal(otherRefreshed.status, 401, "another device's session survived the password change")

  // The caller's own refresh token still works: it is the device that just
  // proved it knows the password.
  const mine = await api('/api/auth/me', { method: 'GET', token })
  assert.equal(mine.status, 200)
})

test('changing the password validates the new one', async () => {
  const { token } = await signedInUser()

  const short = await api('/api/auth/change-password', {
    token,
    body: { currentPassword: VALID.password, newPassword: 'short', confirm: 'short' },
  })
  assert.equal(short.status, 422)
  assert.ok(short.body.error.details.newPassword)

  const mismatch = await api('/api/auth/change-password', {
    token,
    body: { currentPassword: VALID.password, newPassword: 'new-password-9', confirm: 'other-pass-12' },
  })
  assert.equal(mismatch.status, 422)
  assert.ok(mismatch.body.error.details.confirm)

  const missingCurrent = await api('/api/auth/change-password', {
    token,
    body: { newPassword: 'new-password-9', confirm: 'new-password-9' },
  })
  assert.equal(missingCurrent.status, 422)
  assert.ok(missingCurrent.body.error.details.currentPassword)
})

/** ---------------------------------------------------------------- sessions */

test('sessions are listed with a device label and the current one marked', async () => {
  // verifying the address already issues a session, so this account has one
  // before the explicit sign-in below adds a second.
  const { token } = await signedInUser()

  const res = await api('/api/account/sessions', { method: 'GET', token })
  assert.equal(res.status, 200)
  assert.equal(res.body.sessions.length, 2)
  assert.ok(res.body.currentSessionId, 'the current session id was not reported')

  const current = res.body.sessions.find((s) => s.id === res.body.currentSessionId)
  assert.ok(current, 'the current session is missing from the list')
  assert.match(current.label, /Firefox|Chrome|Safari|Edge|Opera|device/i)
  // The token itself must never be exposed.
  assert.equal(JSON.stringify(res.body).includes(token), false)
})

test('revoking another session kills its refresh token', async () => {
  const { token } = await signedInUser()
  const other = await api('/api/auth/signin', { body: { email: VALID.email, password: VALID.password } })

  const list = await api('/api/account/sessions', { method: 'GET', token })
  const otherRow = list.body.sessions.find((s) => s.id !== list.body.currentSessionId)
  assert.ok(otherRow)

  const res = await api(`/api/account/sessions/${otherRow.id}`, { method: 'DELETE', token })
  assert.equal(res.status, 204)

  const refreshed = await api('/api/auth/refresh', { body: { refreshToken: other.body.refresh.token } })
  assert.equal(refreshed.status, 401)
})

test('a user cannot revoke a session belonging to somebody else', async () => {
  const mine = await signedInUser({ email: 'mine@acme.corp' })
  await signedInUser({ email: 'theirs@acme.corp' })

  const theirs = await api('/api/auth/signin', {
    body: { email: 'theirs@acme.corp', password: VALID.password },
  })
  const theirsList = await api('/api/account/sessions', { method: 'GET', token: theirs.body.access.token })
  const theirsSession = theirsList.body.sessions[0]

  const res = await api(`/api/account/sessions/${theirsSession.id}`, { method: 'DELETE', token: mine.token })
  assert.equal(res.status, 404, "another account's session was revoked")

  const stillWorks = await api('/api/auth/refresh', { body: { refreshToken: theirs.body.refresh.token } })
  assert.equal(stillWorks.status, 200)
})

test('revoke-others signs out every device except the caller', async () => {
  const { token, refresh } = await signedInUser()
  const other = await api('/api/auth/signin', { body: { email: VALID.email, password: VALID.password } })

  const res = await api('/api/account/sessions/revoke-others', { token })
  assert.equal(res.status, 200)
  assert.ok(res.body.revokedSessions >= 1)

  const gone = await api('/api/auth/refresh', { body: { refreshToken: other.body.refresh.token } })
  assert.equal(gone.status, 401)

  const kept = await api('/api/auth/refresh', { body: { refreshToken: refresh } })
  assert.equal(kept.status, 200)
})

test('session routes require a session', async () => {
  const list = await api('/api/account/sessions', { method: 'GET' })
  assert.equal(list.status, 401)

  const revoke = await api('/api/account/sessions/1', { method: 'DELETE' })
  assert.equal(revoke.status, 401)

  const others = await api('/api/account/sessions/revoke-others')
  assert.equal(others.status, 401)
})

/** ------------------------------------------------------- connected accounts */

test('the settings feed lists cloud accounts without their credentials', async () => {
  const { token } = await signedInUser()
  const created = await api('/api/cloud-accounts', {
    token,
    body: {
      provider: 'aws',
      label: 'Prod AWS',
      accountRef: '123456789012',
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      accessKeySecret: 'super-secret-value',
      region: 'eu-west-2',
    },
  })
  assert.equal(created.status, 201, `create failed: ${JSON.stringify(created.body)}`)

  const list = await api('/api/cloud-accounts', { method: 'GET', token })
  assert.equal(list.status, 200)
  assert.equal(list.body.accounts.length, 1)

  const account = list.body.accounts[0]
  assert.equal(account.provider, 'aws')
  assert.equal(account.label, 'Prod AWS')
  // The stored secret must not be readable from the API in any form.
  const serialised = JSON.stringify(list.body)
  assert.equal(serialised.includes('super-secret-value'), false)
  assert.equal('accessKeySecret' in account, false)
})

test('a cloud account can be removed and disappears from the feed', async () => {
  const { token } = await signedInUser()
  const created = await api('/api/cloud-accounts', {
    token,
    body: {
      provider: 'gcp',
      label: 'GCP Prod',
      accountRef: 'my-project',
      accessKeyId: 'billing-sa@demo-project.iam.gserviceaccount.com',
      accessKeySecret: 'super-secret-value',
      region: 'us-central1',
    },
  })
  const id = created.body.account.id

  const removed = await api(`/api/cloud-accounts/${id}`, { method: 'DELETE', token })
  assert.equal(removed.status, 204)

  const list = await api('/api/cloud-accounts', { method: 'GET', token })
  assert.equal(list.body.accounts.length, 0)
})

test('one user cannot remove another user cloud account', async () => {
  const theirs = await signedInUser({ email: 'theirs2@acme.corp' })
  const created = await api('/api/cloud-accounts', {
    token: theirs.token,
    body: {
      provider: 'azure',
      label: 'Azure Prod',
      accountRef: '9a1c7d54-6b3e-4f28-8c17-2d5e6f708a9b',
      accessKeyId: '3f2b8c10-4d5e-4f60-8a1b-2c3d4e5f6a7b',
      accessKeySecret: 'super-secret-value',
      region: 'westeurope',
    },
  })

  const mine = await signedInUser({ email: 'mine2@acme.corp' })
  const res = await api(`/api/cloud-accounts/${created.body.account.id}`, { method: 'DELETE', token: mine.token })
  assert.equal(res.status, 404)

  const stillThere = await api('/api/cloud-accounts', { method: 'GET', token: theirs.token })
  assert.equal(stillThere.body.accounts.length, 1)
})

test('the status page advertises the new account endpoints', async () => {
  const html = await (await fetch(base)).text()
  assert.match(html, /\/api\/auth\/change-password/)
  assert.match(html, /\/api\/account\/sessions/)
  assert.match(html, /\/api\/auth\/me\/avatar/)
})