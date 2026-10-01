/**
 * User-scoped data for the account settings page: the profile itself and the
 * live sessions. Connected cloud accounts are served by cloud.service.js, which
 * owns the credential shapes.
 *
 * Kept out of auth.service.js because none of it participates in
 * authentication, and mixing it there would pull avatar parsing into the
 * sign-in path.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { config } from './config.js'
import { query } from './db.js'

export const publicUser = (row) => ({
  id: String(row.id),
  name: row.name,
  email: row.email,
  emailVerified: row.email_verified ?? true,
  createdAt: row.created_at,
  // A filename, resolved to a URL by the caller-facing helper below.
  avatarUrl: row.avatar_path ? `/uploads/avatars/${row.avatar_path}` : null,
  timezone: row.timezone ?? null,
})

/** Turns a bare filename into a URL, rejecting anything that escapes the dir. */
export function avatarUrlFor(filename) {
  if (!filename) return null
  const name = path.basename(filename)
  if (!name || name === '.' || name === '..') return null
  return `/uploads/avatars/${encodeURIComponent(name)}`
}

/** Absolute path for a stored avatar, or null if the name is unsafe. */
export function avatarPathFor(filename) {
  const name = path.basename(filename ?? '')
  if (!name || name === '.' || name === '..') return null
  return path.join(config.uploads.avatarDir, name)
}

export async function updateProfile(userId, { name, timezone }) {
  const sets = []
  // Only the SET clause's placeholders are numbered; userId is appended last so
  // the numbering stays correct no matter which fields are present.
  const params = []
  if (name !== undefined) {
    params.push(name)
    sets.push(`name = $${params.length}`)
  }
  if (timezone !== undefined) {
    params.push(timezone)
    sets.push(`timezone = $${params.length}`)
  }
  if (!sets.length) return null

  params.push(userId)
  const { rows } = await query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length}
     RETURNING id, name, email, email_verified, created_at, avatar_path, timezone`,
    params,
  )
  return rows[0] ?? null
}

export async function setAvatarPath(userId, filename) {
  const { rows } = await query(
    'UPDATE users SET avatar_path = $1 WHERE id = $2 RETURNING id, name, email, email_verified, created_at, avatar_path, timezone',
    [filename, userId],
  )
  return rows[0] ?? null
}

export async function deleteAvatar(userId) {
  const { rows } = await query(
    'UPDATE users SET avatar_path = NULL WHERE id = $1 RETURNING id, name, email, email_verified, created_at, avatar_path, timezone',
    [userId],
  )
  return rows[0] ?? null
}

/**
 * Live sessions, newest first. Each row is one refresh token; the plaintext
 * token is never available, so the settings page identifies sessions by the
 * device label captured at sign-in.
 */
export async function listSessions(userId) {
  const { rows } = await query(
    `SELECT id, label, user_agent, ip_address, created_at, last_seen_at, expires_at
       FROM refresh_tokens
      WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
      ORDER BY last_seen_at DESC`,
    [userId],
  )
  return rows.map((r) => ({
    id: String(r.id),
    label: r.label ?? 'Unknown device',
    userAgent: r.user_agent,
    ipAddress: r.ip_address,
    createdAt: r.created_at,
    lastSeenAt: r.last_seen_at,
    expiresAt: r.expires_at,
  }))
}

/**
 * Revokes a single session by row id. Scoped to the user, so a guessed id
 * cannot revoke somebody else's session.
 */
export async function revokeSession(userId, sessionId) {
  const { rowCount } = await query(
    'UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL',
    [sessionId, userId],
  )
  if (!rowCount) return false
  return true
}

/** Revokes every session except the one the request authenticated with. */
export async function revokeOtherSessions(userId, keepSessionId) {
  const { rowCount } = await query(
    `UPDATE refresh_tokens SET revoked_at = now()
      WHERE user_id = $1 AND revoked_at IS NULL
        AND ($2::bigint IS NULL OR id <> $2::bigint)`,
    [userId, keepSessionId ?? null],
  )
  return rowCount ?? 0
}

/** Best-effort cleanup of an avatar that is no longer referenced. */
export async function removeAvatarFile(filename) {
  const target = avatarPathFor(filename)
  if (!target) return
  try {
    await fs.unlink(target)
  } catch (err) {
    // ENOENT is fine; anything else is worth knowing about but not failing on.
    if (err.code !== 'ENOENT') console.error(`[avatar] could not delete ${filename}: ${err.message}`)
  }
}
/** The stored avatar filename, needed to unlink it after a replace or delete. */
export async function findAvatarPath(userId) {
  const { rows } = await query('SELECT avatar_path FROM users WHERE id = $1', [userId])
  return rows[0]?.avatar_path ?? null
}
