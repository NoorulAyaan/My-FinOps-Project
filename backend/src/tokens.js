import { createHash, randomBytes } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { config } from './config.js'
import { unauthorized } from './errors.js'

const ACCESS_TYP = 'access'
const REFRESH_TYP = 'refresh'

function sign(user, typ, ttl, secret, sessionId) {
  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      name: user.name,
      typ,
      // The refresh-token row this access token descends from. It lets the
      // settings page mark the current device and lets a password change revoke
      // every session except the one making the request.
      ...(sessionId ? { sid: String(sessionId) } : {}),
    },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: ttl,
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    },
  )
}

export function signAccessToken(user, sessionId) {
  return sign(user, ACCESS_TYP, config.jwt.accessTtl, config.jwt.secret, sessionId)
}

/**
 * Refresh tokens are opaque random strings rather than JWTs. The database
 * stores only a SHA-256 digest, so a leaked table dump cannot be replayed as a
 * live session, and any row can be revoked per device.
 */
export function generateRefreshToken() {
  return randomBytes(48).toString('base64url')
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

export function refreshTtlFor(remember) {
  return remember ? config.jwt.refreshTtlRemember : config.jwt.refreshTtlDefault
}

export function toSeconds(ttl) {
  const m = /^(\d+)([smhd])$/.exec(String(ttl).trim())
  if (!m) throw new Error(`Unsupported TTL: ${ttl}`)
  const n = Number(m[1])
  return n * { s: 1, m: 60, h: 3600, d: 86400 }[m[2]]
}

export function accessTokenResponse(user, sessionId) {
  const token = signAccessToken(user, sessionId)
  const { iat, exp } = jwt.decode(token)
  return { token, tokenType: 'Bearer', expiresIn: exp - iat, expiresAt: new Date(exp * 1000).toISOString() }
}

export function verifyAccessToken(token) {
  let payload
  try {
    payload = jwt.verify(token, config.jwt.secret, {
      algorithms: ['HS256'],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    })
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw unauthorized('Session expired.')
    throw unauthorized('Invalid token.')
  }
  // Without this check a valid refresh token (verified with a different
  // secret, so unlikely) or a misissued token could be replayed as an access
  // token for a longer window than intended.
  if (payload.typ !== ACCESS_TYP) throw unauthorized('Invalid token.')
  return payload
}
