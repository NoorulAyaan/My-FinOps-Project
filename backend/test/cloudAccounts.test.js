import { readdir, readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { after, before, beforeEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET ??= 'test-only-access-secret-not-for-production-use'
process.env.JWT_REFRESH_SECRET ??= 'test-only-refresh-secret-not-for-production-us'
// A separate database from auth.test.js: node --test runs files in parallel
// processes, and both suites TRUNCATE between tests.
process.env.DATABASE_URL ??= 'postgresql://postgres:finops_dev_pw@localhost:5432/finops_test_cloud'
process.env.ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString('base64')
process.env.BCRYPT_ROUNDS = '4'
// Without this the suite inherits the real SMTP host from backend/.env, which
// suppresses the devCode these tests use to verify an address and would send
// real mail to fake addresses.
process.env.SMTP_HOST ??= ''

const { pool } = await import('../src/db.js')
const { createApp } = await import('../src/app.js')
const { decryptSecret, encryptSecret, safeEqual } = await import('../src/crypto.js')
const { parseCloudAccount } = await import('../src/cloud.service.js')
const { syncCloudAccount } = await import('../src/cost.service.js')

const dbDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'db')

const app = createApp()
const server = app.listen(0)
await new Promise((resolve) => server.once('listening', resolve))
const base = `http://127.0.0.1:${server.address().port}`

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
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null }
}

const VALID = {
  name: 'Devin Patel',
  email: 'devin@acme.corp',
  password: 'correct-horse-9',
  confirm: 'correct-horse-9',
}

const AWS_KEY = {
  provider: 'aws',
  label: 'Prod AWS',
  accountRef: '123456789012',
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  accessKeySecret: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  region: 'us-east-1',
}

async function verifiedUser(overrides = {}) {
  const created = await api('/api/auth/signup', { body: { ...VALID, ...overrides } })
  assert.equal(created.status, 201, `signup failed: ${JSON.stringify(created.body)}`)
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

before(async () => {
  for (const file of (await readdir(dbDir)).filter((f) => f.endsWith('.sql')).sort()) {
    await pool.query(await readFile(join(dbDir, file), 'utf8'))
  }
})

after(async () => {
  await new Promise((resolve) => server.close(resolve))
  await pool.end()
})

beforeEach(async () => {
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE')
})

// ---------------------------------------------------------------- encryption

test('encryptSecret round-trips the plaintext', () => {
  const plaintext = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
  assert.equal(decryptSecret(encryptSecret(plaintext)), plaintext)
})

test('ciphertext does not contain the plaintext', () => {
  const plaintext = 'super-secret-access-key'
  assert.equal(encryptSecret(plaintext).includes(plaintext), false)
})

test('encrypting the same value twice yields different ciphertext', () => {
  const a = encryptSecret('same-input')
  const b = encryptSecret('same-input')
  assert.notEqual(a, b, 'a random IV must make each ciphertext unique')
  assert.equal(decryptSecret(a), decryptSecret(b))
})

test('ciphertext is versioned and colon-delimited', () => {
  const [version, iv, tag, data] = encryptSecret('abc').split(':')
  assert.equal(version, 'v1')
  assert.ok(Buffer.from(iv, 'base64url').length === 12)
  assert.ok(Buffer.from(tag, 'base64url').length === 16)
  assert.ok(Buffer.from(data, 'base64url').length > 0)
})

test('a tampered auth tag is rejected, not silently decrypted', () => {
  const [version, iv, tag, data] = encryptSecret('abc').split(':')
  const flipped = Buffer.from(tag, 'base64url')
  flipped[0] ^= 0xff
  assert.throws(() => decryptSecret([version, iv, flipped.toString('base64url'), data].join(':')))
})

test('a tampered ciphertext is rejected', () => {
  const [version, iv, tag, data] = encryptSecret('a-fairly-long-secret-value').split(':')
  const bytes = Buffer.from(data, 'base64url')
  bytes[0] ^= 0xff
  assert.throws(() => decryptSecret([version, iv, tag, bytes.toString('base64url')].join(':')))
})

test('a malformed ciphertext payload is rejected', () => {
  assert.throws(() => decryptSecret('not-ciphertext'))
  assert.throws(() => decryptSecret('v9:a:b:c'))
  assert.throws(() => decryptSecret('v1:only:three'))
})

test('encryptSecret refuses empty input', () => {
  assert.throws(() => encryptSecret(''))
  assert.throws(() => encryptSecret(undefined))
})

test('safeEqual compares equal and unequal values correctly', () => {
  assert.equal(safeEqual('abc', 'abc'), true)
  assert.equal(safeEqual('abc', 'abd'), false)
  assert.equal(safeEqual('abc', 'abcd'), false)
  assert.equal(safeEqual('abc', ''), false)
})

// ------------------------------------------------------- cloud account input

test('parseCloudAccount accepts a well-formed AWS key', () => {
  const parsed = parseCloudAccount(AWS_KEY)
  assert.equal(parsed.provider, 'aws')
  assert.equal(parsed.accessKeyId, AWS_KEY.accessKeyId)
})

test('parseCloudAccount normalises the provider case', () => {
  assert.equal(parseCloudAccount({ ...AWS_KEY, provider: 'AWS' }).provider, 'aws')
})

test('parseCloudAccount rejects an unknown provider', () => {
  assert.throws(() => parseCloudAccount({ ...AWS_KEY, provider: 'dropbox' }), /Provider must be one of/)
})

test('parseCloudAccount rejects a malformed AWS access key id', () => {
  assert.throws(() => parseCloudAccount({ ...AWS_KEY, accessKeyId: 'nope' }))
})

test('parseCloudAccount rejects a malformed AWS account ref', () => {
  assert.throws(() => parseCloudAccount({ ...AWS_KEY, accountRef: '1234' }))
})

test('parseCloudAccount requires a label', () => {
  assert.throws(() => parseCloudAccount({ ...AWS_KEY, label: '  ' }))
})

test('parseCloudAccount requires a secret of sane length', () => {
  assert.throws(() => parseCloudAccount({ ...AWS_KEY, accessKeySecret: 'short' }))
  assert.throws(() => parseCloudAccount({ ...AWS_KEY, accessKeySecret: '' }))
})

test('parseCloudAccount accepts a valid Azure subscription UUID', () => {
  const parsed = parseCloudAccount({
    provider: 'azure',
    label: 'Azure Prod',
    accountRef: '550e8400-e29b-41d4-a716-446655440000',
    accessKeyId: '550e8400-e29b-41d4-a716-446655440000',
    accessKeySecret: 'azure-client-secret-value',
    region: 'eastus',
  })
  assert.equal(parsed.provider, 'azure')
})

test('parseCloudAccount accepts a valid GCP service account email', () => {
  const parsed = parseCloudAccount({
    provider: 'gcp',
    label: 'GCP Prod',
    accountRef: 'billing-project-01',
    accessKeyId: 'billing-sa@billing-project-01.iam.gserviceaccount.com',
    accessKeySecret: 'gcp-private-key-material',
  })
  assert.equal(parsed.provider, 'gcp')
})

test('parseCloudAccount rejects a GCP key that is not a service account', () => {
  assert.throws(
    () =>
      parseCloudAccount({
        provider: 'gcp',
        label: 'GCP',
        accessKeyId: 'someone@gmail.com',
        accessKeySecret: 'gcp-private-key-material',
      }),
  )
})

// ------------------------------------------------------------ cloud account API

test('GET /api/cloud-accounts requires a session', async () => {
  assert.equal((await api('/api/cloud-accounts')).status, 401)
})

test('POST /api/cloud-accounts requires a session', async () => {
  assert.equal((await api('/api/cloud-accounts', { body: AWS_KEY })).status, 401)
})

test('GET /api/cloud-accounts/providers requires a session', async () => {
  assert.equal((await api('/api/cloud-accounts/providers', { method: 'GET' })).status, 401)
})

test('GET /api/cloud-accounts/providers describes each provider', async () => {
  const user = await verifiedUser()
  const res = await api('/api/cloud-accounts/providers', { method: 'GET', token: user.accessToken })
  assert.equal(res.status, 200)
  const ids = res.body.providers.map((p) => p.id)
  assert.deepEqual(ids, ['aws', 'azure', 'gcp'])
  for (const p of res.body.providers) {
    assert.ok(p.label)
    assert.ok(p.accessKeyIdHint)
  }
})

test('a new user starts with no cloud accounts', async () => {
  const user = await verifiedUser()
  const res = await api('/api/cloud-accounts', { method: 'GET', token: user.accessToken })
  assert.equal(res.status, 200)
  assert.deepEqual(res.body.accounts, [])
  assert.equal(res.body.count, 0)
})

test('POST /api/cloud-accounts stores an account and returns 201', async () => {
  const user = await verifiedUser()
  const res = await api('/api/cloud-accounts', { body: AWS_KEY, token: user.accessToken })
  assert.equal(res.status, 201)
  assert.equal(res.body.account.provider, 'aws')
  assert.equal(res.body.account.label, 'Prod AWS')
  assert.equal(res.body.account.status, 'pending')
  assert.ok(res.body.account.id)
})

test('the stored secret is encrypted at rest', async () => {
  const user = await verifiedUser()
  await api('/api/cloud-accounts', { body: AWS_KEY, token: user.accessToken })
  const { rows } = await pool.query('SELECT access_key_secret FROM cloud_accounts')
  assert.equal(rows[0].access_key_secret.includes(AWS_KEY.accessKeySecret), false)
  assert.match(rows[0].access_key_secret, /^v1:/)
  assert.equal(decryptSecret(rows[0].access_key_secret), AWS_KEY.accessKeySecret)
})

test('no endpoint ever returns the secret', async () => {
  const user = await verifiedUser()
  const created = await api('/api/cloud-accounts', { body: AWS_KEY, token: user.accessToken })

  const list = await api('/api/cloud-accounts', { method: 'GET', token: user.accessToken })
  const one = await api(`/api/cloud-accounts/${created.body.account.id}`, {
    method: 'GET',
    token: user.accessToken,
  })
  const me = await api('/api/auth/me', { method: 'GET', token: user.accessToken })

  for (const res of [list, one, me]) {
    assert.equal(JSON.stringify(res.body).includes(AWS_KEY.accessKeySecret), false)
    assert.equal(JSON.stringify(res.body).includes('accessKeySecret'), false)
    assert.equal(JSON.stringify(res.body).includes('access_key_secret'), false)
  }
})

test('the response exposes the key id but not the secret', async () => {
  const user = await verifiedUser()
  const res = await api('/api/cloud-accounts', { body: AWS_KEY, token: user.accessToken })
  assert.equal(res.body.account.accessKeyId, AWS_KEY.accessKeyId)
  assert.equal(res.body.account.accessKeySecret, undefined)
})

test('adding the same account twice conflicts', async () => {
  const user = await verifiedUser()
  await api('/api/cloud-accounts', { body: AWS_KEY, token: user.accessToken })
  const again = await api('/api/cloud-accounts', {
    body: { ...AWS_KEY, label: 'Duplicate' },
    token: user.accessToken,
  })
  assert.equal(again.status, 409)
  assert.equal(again.body.error.code, 'conflict')
})

test('the same account id can be connected under a different provider', async () => {
  const user = await verifiedUser()
  await api('/api/cloud-accounts', { body: AWS_KEY, token: user.accessToken })
  const azure = await api('/api/cloud-accounts', {
    body: {
      provider: 'azure',
      label: 'Azure',
      // Same digits as the AWS account ref, but a valid Azure subscription UUID.
      accountRef: '550e8400-e29b-41d4-a716-446655440000',
      accessKeyId: '660e8400-e29b-41d4-a716-446655440000',
      accessKeySecret: 'azure-client-secret-value',
    },
    token: user.accessToken,
  })
  assert.equal(azure.status, 201)
})

test('two users can connect the same cloud account independently', async () => {
  const a = await verifiedUser()
  await api('/api/cloud-accounts', { body: AWS_KEY, token: a.accessToken })
  const b = await verifiedUser({ email: 'other@acme.corp' })
  const res = await api('/api/cloud-accounts', { body: AWS_KEY, token: b.accessToken })
  assert.equal(res.status, 201, 'the uniqueness constraint is per user, not global')
})

test('a malformed key is rejected without storing anything', async () => {
  const user = await verifiedUser()
  const res = await api('/api/cloud-accounts', {
    body: { ...AWS_KEY, accessKeyId: 'nope' },
    token: user.accessToken,
  })
  assert.equal(res.status, 400)
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM cloud_accounts')
  assert.equal(rows[0].n, 0)
})

test('list is scoped to the signed-in user', async () => {
  const a = await verifiedUser()
  await api('/api/cloud-accounts', { body: AWS_KEY, token: a.accessToken })
  const b = await verifiedUser({ email: 'other@acme.corp' })
  const res = await api('/api/cloud-accounts', { method: 'GET', token: b.accessToken })
  assert.equal(res.body.count, 0)
})

test('one user cannot read another user cloud account', async () => {
  const a = await verifiedUser()
  const created = await api('/api/cloud-accounts', { body: AWS_KEY, token: a.accessToken })
  const b = await verifiedUser({ email: 'other@acme.corp' })
  const res = await api(`/api/cloud-accounts/${created.body.account.id}`, {
    method: 'GET',
    token: b.accessToken,
  })
  assert.equal(res.status, 404, 'must be 404, not 403 — 403 would confirm the id exists')
})

test('one user cannot delete another user cloud account', async () => {
  const a = await verifiedUser()
  const created = await api('/api/cloud-accounts', { body: AWS_KEY, token: a.accessToken })
  const b = await verifiedUser({ email: 'other@acme.corp' })
  const res = await api(`/api/cloud-accounts/${created.body.account.id}`, {
    method: 'DELETE',
    token: b.accessToken,
  })
  assert.equal(res.status, 404)
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM cloud_accounts')
  assert.equal(rows[0].n, 1, 'the record must survive')
})

test('DELETE removes the account', async () => {
  const user = await verifiedUser()
  const created = await api('/api/cloud-accounts', { body: AWS_KEY, token: user.accessToken })
  const res = await api(`/api/cloud-accounts/${created.body.account.id}`, {
    method: 'DELETE',
    token: user.accessToken,
  })
  assert.equal(res.status, 204)
  const list = await api('/api/cloud-accounts', { method: 'GET', token: user.accessToken })
  assert.equal(list.body.count, 0)
})

test('deleting a missing account is a 404', async () => {
  const user = await verifiedUser()
  const res = await api('/api/cloud-accounts/999999', { method: 'DELETE', token: user.accessToken })
  assert.equal(res.status, 404)
})

test('deleting a user cascades to their cloud accounts', async () => {
  const user = await verifiedUser()
  await api('/api/cloud-accounts', { body: AWS_KEY, token: user.accessToken })
  await pool.query('DELETE FROM users')
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM cloud_accounts')
  assert.equal(rows[0].n, 0)
})

test('an invalid access token is rejected by the cloud routes', async () => {
  const res = await api('/api/cloud-accounts', { method: 'GET', token: 'not.a.jwt' })
  assert.equal(res.status, 401)
})

test('the status page lists the cloud account routes', async () => {
  const html = await (await fetch(`${base}/`)).text()
  assert.ok(html.includes('/api/auth/signin'))
})

// ------------------------------------------------------------- sync cooldown
//
// AWS bills $0.01 per Cost Explorer request, so every sync must be able to run
// without reaching AWS. The service takes an injectable fetchRows and the route
// takes force=1; together they cover the "viewing the dashboard costs nothing"
// guarantee end to end.

// An account that already synced (fresh last_synced_at) and holds one stored
// cost row, so a skipped sync can be shown to leave both untouched.
async function syncedAccount({ syncedAt = new Date(), secret } = {}) {
  const session = await verifiedUser()
  const created = await api('/api/cloud-accounts', { body: AWS_KEY, token: session.accessToken })
  const id = created.body.account.id
  await pool.query(`UPDATE cloud_accounts SET status = 'connected', last_synced_at = $2 WHERE id = $1`, [
    id,
    syncedAt,
  ])
  if (secret !== undefined) {
    await pool.query(`UPDATE cloud_accounts SET access_key_secret = $2 WHERE id = $1`, [id, secret])
  }
  await pool.query(
    `INSERT INTO cost_records (account_id, provider, service, category, date, amount, live)
     VALUES ($1, 'aws', 'Amazon Elastic Compute Cloud - Compute', 'Compute', '2026-10-01', 1.5, true)`,
    [id],
  )
  return { session, id }
}

const rowFor = (date = '2026-10-02') => [
  { date, service: 'Amazon Elastic Compute Cloud - Compute', amount: 2.5 },
]

test('a sync inside the billing cooldown serves stored rows without calling AWS', async () => {
  const { session, id } = await syncedAccount()
  let calls = 0

  const result = await syncCloudAccount(session.user.id, id, {
    fetchRows: async () => {
      calls++
      return rowFor()
    },
  })

  assert.equal(calls, 0, 'the paid Cost Explorer request must not happen')
  assert.equal(result.cached, true)
  assert.equal(result.records, 1, 'the stored rows are still reported')
  assert.ok(result.message, 'the UI is told why nothing refreshed')
  assert.equal(result.error, undefined)

  const { rows } = await pool.query(
    'SELECT status, last_synced_at FROM cloud_accounts WHERE id = $1',
    [id],
  )
  assert.equal(rows[0].status, 'connected')
  const cost = await pool.query(
    'SELECT amount FROM cost_records WHERE account_id = $1',
    [id],
  )
  assert.equal(Number(cost.rows[0].amount), 1.5, 'existing rows are left in place')
})

test('a skipped sync does not extend the cooldown', async () => {
  const { session, id } = await syncedAccount()
  const { rows: before } = await pool.query(
    'SELECT last_synced_at FROM cloud_accounts WHERE id = $1',
    [id],
  )
  await syncCloudAccount(session.user.id, id, { fetchRows: async () => rowFor() })
  const { rows: after } = await pool.query(
    'SELECT last_synced_at FROM cloud_accounts WHERE id = $1',
    [id],
  )
  assert.equal(
    new Date(after[0].last_synced_at).getTime(),
    new Date(before[0].last_synced_at).getTime(),
    'reading cached data must not push the next paid sync further out',
  )
})

test('force bypasses the cooldown and pulls fresh rows', async () => {
  const { session, id } = await syncedAccount()
  let calls = 0

  const result = await syncCloudAccount(session.user.id, id, {
    force: true,
    fetchRows: async () => {
      calls++
      return rowFor()
    },
  })

  assert.equal(calls, 1)
  assert.equal(result.cached, undefined)
  assert.equal(result.live, true)
  assert.equal(result.records, 1)
  const cost = await pool.query('SELECT amount FROM cost_records WHERE account_id = $1', [id])
  assert.equal(Number(cost.rows[0].amount), 2.5, 'the new pull replaced the stored rows')
})

test('an account whose last sync is outside the cooldown syncs without force', async () => {
  const { session, id } = await syncedAccount({
    syncedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  })
  let calls = 0
  const result = await syncCloudAccount(session.user.id, id, {
    cooldownMs: 60 * 60 * 1000,
    fetchRows: async () => {
      calls++
      return rowFor()
    },
  })
  assert.equal(calls, 1)
  assert.equal(result.cached, undefined)
  assert.equal(result.records, 1)
})

test('cooldownMs: 0 disables the cooldown entirely', async () => {
  const { session, id } = await syncedAccount()
  let calls = 0
  await syncCloudAccount(session.user.id, id, {
    cooldownMs: 0,
    fetchRows: async () => {
      calls++
      return rowFor()
    },
  })
  assert.equal(calls, 1)
})

test('an account that has never synced always gets its first pull', async () => {
  const session = await verifiedUser()
  const created = await api('/api/cloud-accounts', { body: AWS_KEY, token: session.accessToken })
  let calls = 0
  const result = await syncCloudAccount(session.user.id, created.body.account.id, {
    fetchRows: async () => {
      calls++
      return rowFor()
    },
  })
  assert.equal(calls, 1, 'a null last_synced_at is not inside any cooldown')
  assert.equal(result.records, 1)
  assert.equal(result.account.status, 'connected')
})

test('two concurrent syncs only pay for one Cost Explorer request', async () => {
  const { session, id } = await syncedAccount({ syncedAt: null })
  let calls = 0
  const slowFetch = async () => {
    calls++
    await new Promise((resolve) => setTimeout(resolve, 80))
    return rowFor()
  }

  const results = await Promise.all([
    syncCloudAccount(session.user.id, id, { fetchRows: slowFetch }),
    syncCloudAccount(session.user.id, id, { fetchRows: slowFetch }),
  ])

  assert.equal(calls, 1, 'the advisory-locked claim lets exactly one sync through')
  assert.equal(results.filter((r) => r.cached).length, 1, 'the other is told it is cached')
})

test('a failed sync still starts its own cooldown', async () => {
  const { session, id } = await syncedAccount({ syncedAt: null })

  const failed = await syncCloudAccount(session.user.id, id, {
    fetchRows: async () => {
      throw new Error('credentials rejected')
    },
  })
  assert.equal(failed.error, 'credentials rejected')

  let calls = 0
  const retry = await syncCloudAccount(session.user.id, id, {
    fetchRows: async () => {
      calls++
      return rowFor()
    },
  })
  assert.equal(calls, 0, 'a retry inside the cooldown must not re-bill the account')
  assert.equal(retry.cached, true)
})

test('POST /:id/sync inside the cooldown returns cached rows and never reaches AWS', async () => {
  // Corrupting the ciphertext proves the boundary: had the request passed the
  // cooldown gate it would have hit the secret read (and then AWS) and failed.
  const { session, id } = await syncedAccount({ secret: 'not-a-ciphertext' })
  const res = await api(`/api/cloud-accounts/${id}/sync`, {
    method: 'POST',
    token: session.accessToken,
  })
  assert.equal(res.status, 200)
  assert.equal(res.body.cached, true)
  assert.equal(res.body.error, undefined)
  assert.equal(res.body.records, 1)
})

test('POST /:id/sync?force=1 passes the cooldown gate', async () => {
  const { session, id } = await syncedAccount({ secret: 'not-a-ciphertext' })
  const res = await api(`/api/cloud-accounts/${id}/sync?force=1`, {
    method: 'POST',
    token: session.accessToken,
  })
  assert.equal(res.status, 200)
  assert.equal(res.body.cached, undefined, 'force must not be answered from cache')
  assert.match(res.body.error, /ciphertext/, 'force reached the provider-call path')
})

test('POST /:id/sync requires a session', async () => {
  const { id } = await syncedAccount()
  assert.equal((await api(`/api/cloud-accounts/${id}/sync`)).status, 401)
})
