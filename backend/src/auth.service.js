import bcrypt from 'bcrypt'
import { config } from './config.js'
import { query, withTransaction } from './db.js'
import { emailTaken, invalidCredentials, unauthorized } from './errors.js'
import {
  accessTokenResponse,
  generateRefreshToken,
  hashToken,
  refreshTtlFor,
  toSeconds,
} from './tokens.js'

const UNIQUE_VIOLATION = '23505'

// A real bcrypt hash of a value nobody knows. Compared against when the email
// is unknown, so a missing account costs the same time as a wrong password and
// the response time stops revealing which emails are registered.
let decoyHash = null
async function getDecoyHash() {
  if (!decoyHash) decoyHash = await bcrypt.hash('decoy-password-never-matches', config.bcrypt.rounds)
  return decoyHash
}

export const publicUser = (row) => ({
  id: String(row.id),
  name: row.name,
  email: row.email,
  emailVerified: row.email_verified ?? true,
  createdAt: row.created_at,
})

export async function findUserByEmail(email) {
  const { rows } = await query(
    'SELECT id, name, email, password_hash, email_verified, created_at FROM users WHERE email = $1',
    [email],
  )
  return rows[0] ?? null
}

export async function findUserById(id) {
  const { rows } = await query(
    'SELECT id, name, email, email_verified, created_at FROM users WHERE id = $1',
    [id],
  )
  return rows[0] ?? null
}

export async function createUser({ name, email, password }) {
  const passwordHash = await bcrypt.hash(password, config.bcrypt.rounds)
  try {
    const { rows } = await query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, email_verified, created_at',
      [name, email, passwordHash],
    )
    return rows[0]
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) throw emailTaken()
    throw err
  }
}

export async function verifyPassword(password, user) {
  if (!user) {
    await bcrypt.compare(password, await getDecoyHash())
    return false
  }
  return bcrypt.compare(password, user.password_hash)
}

export async function issueSession(user, { remember = false, client = null } = {}) {
  const refreshToken = generateRefreshToken()
  const ttl = refreshTtlFor(remember)

  const expiresAt = new Date(Date.now() + toSeconds(ttl) * 1000)

  const insert = client
    ? (text, params) => client.query(text, params)
    : (text, params) => query(text, params)

  await insert(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, hashToken(refreshToken), expiresAt],
  )

  return {
    user: publicUser(user),
    access: accessTokenResponse(user),
    refresh: { token: refreshToken, expiresAt: expiresAt.toISOString() },
    remember,
  }
}

export async function authenticate({ email, password }) {
  const user = await findUserByEmail(email)
  const ok = await verifyPassword(password, user)
  if (!ok || !user) throw invalidCredentials()
  return user
}

export async function rotateRefreshToken(presented) {
  const { rows } = await query(
    `SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked_at,
            u.id, u.name, u.email, u.email_verified, u.created_at
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
      WHERE rt.token_hash = $1`,
    [hashToken(presented)],
  )
  const record = rows[0]

  if (!record || record.revoked_at) throw unauthorized('Invalid session.')
  if (new Date(record.expires_at).getTime() <= Date.now()) {
    throw unauthorized('Session expired.')
  }

  const user = {
    id: record.user_id,
    name: record.name,
    email: record.email,
    email_verified: record.email_verified,
    created_at: record.created_at,
  }

  // Revoke the presented token and mint a replacement in one transaction, so a
  // stolen refresh token is single-use: whichever copy the attacker loses the
  // race, the legitimate client's next rotation invalidates it.
  const replacement = generateRefreshToken()
  const ttl = Math.max(
    1000,
    new Date(record.expires_at).getTime() - Date.now(),
  )
  const expiresAt = new Date(Date.now() + ttl)

  await withTransaction(async (client) => {
    const updated = await client.query(
      `UPDATE refresh_tokens SET revoked_at = now()
        WHERE id = $1 AND revoked_at IS NULL`,
      [record.id],
    )
    if (updated.rowCount === 0) throw unauthorized('Invalid session.')
    await client.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [record.user_id, hashToken(replacement), expiresAt],
    )
  })

  return {
    user: publicUser(user),
    access: accessTokenResponse(user),
    refresh: { token: replacement, expiresAt: expiresAt.toISOString() },
  }
}

export async function revokeRefreshToken(presented) {
  if (!presented) return
  await query(
    'UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL',
    [hashToken(presented)],
  )
}
