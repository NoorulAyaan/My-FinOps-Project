import bcrypt from 'bcrypt'
import { config } from './config.js'
import { query, withTransaction } from './db.js'
import { emailTaken, invalidCredentials, unauthorized } from './errors.js'
import { publicUser } from './account.service.js'
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

// Single definition, so a session payload and a settings response can never
// drift apart in shape.
export { publicUser } from './account.service.js'

export async function findUserByEmail(email) {
  const { rows } = await query(
    'SELECT id, name, email, password_hash, email_verified, created_at FROM users WHERE email = $1',
    [email],
  )
  return rows[0] ?? null
}

export async function findUserById(id) {
  const { rows } = await query(
    'SELECT id, name, email, email_verified, created_at, avatar_path, timezone FROM users WHERE id = $1',
    [id],
  )
  return rows[0] ?? null
}

/** Same row, with the password hash — only for verifying a current password. */
export async function findUserCredentialsById(id) {
  const { rows } = await query(
    'SELECT id, name, email, password_hash, email_verified, created_at FROM users WHERE id = $1',
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

export async function issueSession(user, { remember = false, client = null, device = null } = {}) {
  const refreshToken = generateRefreshToken()
  const ttl = refreshTtlFor(remember)

  const expiresAt = new Date(Date.now() + toSeconds(ttl) * 1000)

  const insert = client
    ? (text, params) => client.query(text, params)
    : (text, params) => query(text, params)

  // label/user_agent/ip_address make the session listable by device. They are
  // descriptive only and never used for access decisions.
  const { rows } = await insert(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, label, user_agent, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      user.id,
      hashToken(refreshToken),
      expiresAt,
      device?.label ?? null,
      device?.userAgent ?? null,
      device?.ip ?? null,
    ],
  )

  return {
    user: publicUser(user),
    access: accessTokenResponse(user, rows[0].id),
    refresh: { token: refreshToken, expiresAt: expiresAt.toISOString() },
    remember,
  }
}

/** Replaces a user's password hash. Sessions are revoked separately. */
export async function changePassword(userId, newPassword) {
  const passwordHash = await bcrypt.hash(newPassword, config.bcrypt.rounds)
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId])
}

export async function authenticate({ email, password }) {
  const user = await findUserByEmail(email)
  const ok = await verifyPassword(password, user)
  if (!ok || !user) throw invalidCredentials()
  return user
}

export async function rotateRefreshToken(presented) {
  const { rows } = await query(
    // Both tables have an `id`, and a duplicate output column name resolves to
    // the last one selected — so every column is aliased explicitly. Selecting
    // `rt.id` unaliased made `record.id` the *user* id, and rotation revoked the
    // wrong refresh-token row.
    `SELECT rt.id       AS session_id,
            rt.user_id  AS user_id,
            rt.expires_at, rt.revoked_at,
            rt.label, rt.user_agent, rt.ip_address,
            u.name, u.email, u.email_verified, u.created_at, u.avatar_path, u.timezone
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
    avatar_path: record.avatar_path,
    timezone: record.timezone,
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
  let sessionId = null

  await withTransaction(async (client) => {
    const updated = await client.query(
      `UPDATE refresh_tokens SET revoked_at = now()
        WHERE id = $1 AND revoked_at IS NULL`,
      [record.session_id],
    )
    if (updated.rowCount === 0) throw unauthorized('Invalid session.')
    // The replacement inherits the device label so a rotated session does not
    // reappear in the settings list as "Unknown device". last_seen_at defaults to
    // now(), so the settings list reflects the most recent use of the session
    // rather than when it was first created.
    const { rows: inserted } = await client.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, label, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        record.user_id,
        hashToken(replacement),
        expiresAt,
        record.label,
        record.user_agent,
        record.ip_address,
      ],
    )
    sessionId = inserted[0].id
  })

  return {
    user: publicUser(user),
    access: accessTokenResponse(user, sessionId),
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
