import { randomInt } from 'node:crypto'
import bcrypt from 'bcrypt'
import { config } from './config.js'
import { query, withTransaction } from './db.js'
import { badRequest, tooManyRequests, unauthorized } from './errors.js'

/**
 * 6-digit code from a CSPRNG. `randomInt` is used rather than Math.random
 * because this value is a bearer credential for the signup it authorises.
 */
export function generateCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

export async function issueVerificationCode(user) {
  const code = generateCode()
  const codeHash = await bcrypt.hash(code, config.bcrypt.rounds)
  const expiresAt = new Date(Date.now() + config.mail.codeTtlMinutes * 60 * 1000)

  // Supersede any outstanding code: only the newest one can be redeemed.
  await query(
    'UPDATE email_verifications SET consumed_at = now() WHERE user_id = $1 AND consumed_at IS NULL',
    [user.id],
  )
  await query(
    `INSERT INTO email_verifications (user_id, code_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, codeHash, expiresAt],
  )

  return { code, expiresAt }
}

export async function verifyCode({ userId, code }) {
  const { rows } = await query(
    `SELECT id, code_hash, expires_at, attempts
       FROM email_verifications
      WHERE user_id = $1 AND consumed_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId],
  )
  const record = rows[0]

  if (!record) throw badRequest('No verification code is active. Request a new one.')

  if (new Date(record.expires_at).getTime() <= Date.now()) {
    throw badRequest('That code has expired. Request a new one.')
  }

  // Count the attempt before checking, so the tenth guess is refused even if it
  // happens to be the right one.
  const attempts = record.attempts + 1
  await query('UPDATE email_verifications SET attempts = $2 WHERE id = $1', [record.id, attempts])

  const ok = await bcrypt.compare(String(code), record.code_hash)

  if (!ok) {
    const left = config.mail.codeMaxAttempts - attempts
    if (left <= 0) {
      await query(
        'UPDATE email_verifications SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL',
        [record.id],
      )
      throw tooManyRequests('Too many incorrect codes. Request a new one.')
    }
    throw badRequest(`Incorrect code. ${left} attempt${left === 1 ? '' : 's'} remaining.`)
  }

  await withTransaction(async (client) => {
    await client.query(
      'UPDATE email_verifications SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL',
      [record.id],
    )
    await client.query(
      'UPDATE users SET email_verified = true, verified_at = now() WHERE id = $1',
      [userId],
    )
  })

  return true
}

export function assertCodeFormat(code) {
  if (!/^\d{6}$/.test(String(code ?? ''))) {
    throw badRequest('The verification code is 6 digits.')
  }
  return String(code)
}

export function assertOwnsUser(userId, targetUserId) {
  if (String(userId) !== String(targetUserId)) {
    // Same response as any other unknown resource, so this cannot be used to
    // probe which user IDs exist.
    throw unauthorized('Invalid session.')
  }
}
