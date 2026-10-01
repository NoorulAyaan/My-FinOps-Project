import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'
import { config } from './config.js'

const ALGO = 'aes-256-gcm'
const IV_BYTES = 12
const TAG_BYTES = 16

const key = Buffer.from(config.encryption.key, 'base64')
if (key.length !== 32) {
  throw new Error(
    `ENCRYPTION_KEY must decode to exactly 32 bytes (got ${key.length}). ` +
      'Generate one with: openssl rand -base64 32',
  )
}

/**
 * Encrypts a cloud access key for storage. Returns
 * `v1:<iv>:<authTag>:<ciphertext>`, all base64url. The auth tag is stored
 * alongside the ciphertext (rather than appended) so a truncated or tampered
 * row fails loudly on decrypt instead of yielding garbage.
 */
export function encryptSecret(plaintext) {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('Nothing to encrypt.')
  }
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return ['v1', iv.toString('base64url'), authTag.toString('base64url'), ciphertext.toString('base64url')].join(':')
}

export function decryptSecret(payload) {
  const [version, ivB64, tagB64, dataB64] = String(payload).split(':')
  if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) {
    throw new Error('Unrecognised ciphertext format.')
  }
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

/**
 * Constant-time comparison for the verification code. A plain `===` on a hash
 * leaks how many leading characters were right through response timing.
 */
export function safeEqual(a, b) {
  const bufA = Buffer.from(String(a))
  const bufB = Buffer.from(String(b))
  if (bufA.length !== bufB.length) {
    // Still burn a comparison so a length mismatch is not measurably faster.
    timingSafeEqual(bufA, bufA)
    return false
  }
  return timingSafeEqual(bufA, bufB)
}
