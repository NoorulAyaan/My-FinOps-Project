import bcrypt from 'bcrypt'
import { config } from './config.js'
import { query, withTransaction } from './db.js'
import { badRequest, tooManyRequests } from './errors.js'
import { generateCode } from './verification.service.js'

/**
 * Password reset via emailed 6-digit code.
 *
 * Two properties matter more than the mechanics here:
 *
 *  1. `requestReset` never reveals whether an address is registered. The caller
 *     gets an identical body either way, so the endpoint cannot enumerate users.
 *  2. `redeemReset` revokes every refresh token for the account. A password reset
 *     is the user's way of saying "someone else has my password" — if the
 *     attacker's session survived it, the reset would have accomplished nothing.
 */
export async function requestReset(user) {
  const code = generateCode()
  const codeHash = await bcrypt.hash(code, config.bcrypt.rounds)
  const expiresAt = new Date(Date.now() + config.mail.resetCodeTtlMinutes * 60 * 1000)

  // Only the newest code can be redeemed. Doing this in a transaction keeps the
  // partial unique index from tripping when a user clicks "resend" quickly.
  await withTransaction(async (client) => {
    await client.query(
      'UPDATE password_reset_codes SET consumed_at = now() WHERE user_id = $1 AND consumed_at IS NULL',
      [user.id],
    )
    await client.query(
      `INSERT INTO password_reset_codes (user_id, code_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, codeHash, expiresAt],
    )
  })

  return { code, expiresAt }
}

/**
 * Verifies the code and swaps the password in one transaction. Returns the user
 * id so the caller can report which account changed.
 */
export async function redeemReset({ userId, code, newPassword }) {
  const { rows } = await query(
    `SELECT id, code_hash, expires_at, attempts
       FROM password_reset_codes
      WHERE user_id = $1 AND consumed_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId],
  )
  const record = rows[0]

  if (!record) throw badRequest('No reset code is active. Request a new one.')

  if (new Date(record.expires_at).getTime() <= Date.now()) {
    throw badRequest('That reset code has expired. Request a new one.')
  }

  // Count before comparing, so the last permitted guess is refused even if it
  // happens to be correct.
  const attempts = record.attempts + 1
  await query('UPDATE password_reset_codes SET attempts = $2 WHERE id = $1', [record.id, attempts])

  const ok = await bcrypt.compare(String(code), record.code_hash)

  if (!ok) {
    const left = config.mail.resetCodeMaxAttempts - attempts
    if (left <= 0) {
      await query(
        'UPDATE password_reset_codes SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL',
        [record.id],
      )
      throw tooManyRequests('Too many incorrect codes. Request a new one.')
    }
    throw badRequest(`Incorrect code. ${left} attempt${left === 1 ? '' : 's'} remaining.`)
  }

  const passwordHash = await bcrypt.hash(newPassword, config.bcrypt.rounds)

  await withTransaction(async (client) => {
    // Consume the code inside the same transaction as the password write, so a
    // crash cannot leave a used code able to authorise a second reset.
    const consumed = await client.query(
      'UPDATE password_reset_codes SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL',
      [record.id],
    )
    if (consumed.rowCount === 0) throw badRequest('That reset code has already been used.')

    await client.query('UPDATE users SET password_hash = $2 WHERE id = $1', [userId, passwordHash])

    // Kill every existing session. See the note at the top of the file.
    await client.query(
      'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
      [userId],
    )
  })

  return { userId: String(userId) }
}