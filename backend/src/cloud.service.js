import { query } from './db.js'
import { decryptSecret, encryptSecret } from './crypto.js'
import { badRequest, conflict, notFound } from './errors.js'

const PROVIDERS = {
  aws: {
    label: 'Amazon Web Services',
    accountRefHint: 'Account ID (12 digits)',
    accountRefPattern: /^\d{12}$/,
    accessKeyIdHint: 'Access key ID (AKIA…)',
    accessKeyIdPattern: /^(AKIA|ASIA|AGPA|AIDA|AROA|ANPA|ANVA|APKA)[A-Z0-9]{16}$/,
    regionHint: 'Default region, e.g. us-east-1',
  },
  azure: {
    label: 'Microsoft Azure',
    accountRefHint: 'Subscription ID (UUID)',
    accountRefPattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    accessKeyIdHint: 'Client ID (UUID)',
    accessKeyIdPattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    regionHint: 'Default location, e.g. eastus',
  },
  gcp: {
    label: 'Google Cloud Platform',
    accountRefHint: 'Project ID',
    accountRefPattern: /^[a-z0-9][a-z0-9-]{4,28}[a-z0-9]$/,
    accessKeyIdHint: 'Service account email',
    accessKeyIdPattern: /^[a-z0-9-]{6,30}@[a-z0-9-]{6,30}\.iam\.gserviceaccount\.com$/i,
    regionHint: 'Default region, e.g. us-central1',
  },
}

export const listProviders = () =>
  Object.entries(PROVIDERS).map(([id, p]) => ({
    id,
    label: p.label,
    accountRefHint: p.accountRefHint,
    accessKeyIdHint: p.accessKeyIdHint,
    regionHint: p.regionHint,
  }))

const str = (v) => (typeof v === 'string' ? v.trim() : '')

/**
 * Validates a credential submission against the provider's own shape rules.
 * These checks are a usability guard, not proof the key works — only a live API
 * call against the provider can confirm that.
 */
export function parseCloudAccount(body = {}) {
  const provider = str(body.provider).toLowerCase()
  const spec = PROVIDERS[provider]
  if (!spec) {
    throw badRequest(`Provider must be one of: ${Object.keys(PROVIDERS).join(', ')}.`)
  }

  const label = str(body.label)
  const accountRef = str(body.accountRef) || null
  const accessKeyId = str(body.accessKeyId)
  const accessKeySecret = typeof body.accessKeySecret === 'string' ? body.accessKeySecret.trim() : ''
  const region = str(body.region) || null

  const errors = {}
  if (!label) errors.label = 'Give this connection a name you will recognise.'
  else if (label.length > 80) errors.label = 'Name must be at most 80 characters.'

  if (accountRef && !spec.accountRefPattern.test(accountRef)) {
    errors.accountRef = `That does not look like a valid ${spec.accountRefHint}.`
  }
  if (!accessKeyId) errors.accessKeyId = spec.accessKeyIdHint + ' is required.'
  else if (!spec.accessKeyIdPattern.test(accessKeyId)) {
    errors.accessKeyId = `That does not look like a valid ${spec.accessKeyIdHint}.`
  }
  if (!accessKeySecret) errors.accessKeySecret = 'The access key secret is required.'
  else if (accessKeySecret.length < 8) errors.accessKeySecret = 'That secret looks too short.'

  if (Object.keys(errors).length) {
    throw badRequest('Please correct the highlighted fields.', errors)
  }

  return { provider, label, accountRef, accessKeyId, accessKeySecret, region }
}

export async function addCloudAccount(userId, input) {
  try {
    const { rows } = await query(
      `INSERT INTO cloud_accounts
         (user_id, provider, label, account_ref, access_key_id, access_key_secret, region)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, provider, label, account_ref, access_key_id, region, status, created_at`,
      [
        userId,
        input.provider,
        input.label,
        input.accountRef,
        input.accessKeyId,
        encryptSecret(input.accessKeySecret),
        input.region,
      ],
    )
    return publicAccount(rows[0])
  } catch (err) {
    if (err.code === '23505') {
      throw conflict('You have already connected that account.')
    }
    throw err
  }
}

/**
 * The shape returned to clients. Note the absence of any secret field: there is
 * no code path that selects access_key_secret into a response.
 */
const publicAccount = (row) => ({
  id: String(row.id),
  provider: row.provider,
  label: row.label,
  accountRef: row.account_ref,
  accessKeyId: row.access_key_id,
  region: row.region,
  status: row.status,
  lastSyncedAt: row.last_synced_at,
  createdAt: row.created_at,
})

export async function listCloudAccounts(userId) {
  const { rows } = await query(
    `SELECT id, provider, label, account_ref, access_key_id, region, status, last_synced_at, created_at
       FROM cloud_accounts
      WHERE user_id = $1
      ORDER BY created_at DESC`,
    [userId],
  )
  return rows.map(publicAccount)
}

export async function getCloudAccount(userId, id) {
  const { rows } = await query(
    `SELECT id, provider, label, account_ref, access_key_id, region, status, last_synced_at, created_at
       FROM cloud_accounts
      WHERE id = $1 AND user_id = $2`,
    [id, userId],
  )
  if (!rows[0]) throw notFound('No such cloud account.')
  return publicAccount(rows[0])
}

export async function deleteCloudAccount(userId, id) {
  const { rowCount } = await query('DELETE FROM cloud_accounts WHERE id = $1 AND user_id = $2', [
    id,
    userId,
  ])
  if (!rowCount) throw notFound('No such cloud account.')
}

/**
 * Decrypts a stored secret for a server-side provider call. Deliberately not
 * exposed over HTTP — the only current caller is a future cost puller, and
 * nothing in the route layer may call it.
 */
export async function readSecretForProvider(userId, id) {
  const { rows } = await query(
    'SELECT access_key_secret FROM cloud_accounts WHERE id = $1 AND user_id = $2',
    [id, userId],
  )
  if (!rows[0]) throw notFound('No such cloud account.')
  return decryptSecret(rows[0].access_key_secret)
}
