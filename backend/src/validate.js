import { validationFailed } from './errors.js'

// Deliberately conservative: one @, no spaces, a dotted domain. Anything more
// elaborate rejects valid addresses, and the authoritative check is whether a
// confirmation mail arrives.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/

// bcrypt only reads the first 72 bytes of a password and silently discards the
// rest, so two passwords sharing a 72-byte prefix would both authenticate. We
// reject anything longer rather than pretending the tail is checked.
export const PASSWORD_MIN = 8
export const PASSWORD_MAX_BYTES = 72

const asString = (v) => (typeof v === 'string' ? v : '')

function byteLength(s) {
  return Buffer.byteLength(s, 'utf8')
}

export function validateEmail(raw) {
  const email = asString(raw).trim().toLowerCase()
  if (!email) return { value: email, error: 'Email is required.' }
  if (email.length > 254) return { value: email, error: 'Email is too long.' }
  if (!EMAIL_RE.test(email)) return { value: email, error: 'Enter a valid email address.' }
  return { value: email, error: null }
}

export function validatePassword(raw) {
  const password = asString(raw)
  if (!password) return { value: password, error: 'Password is required.' }
  if (password.length < PASSWORD_MIN) {
    return { value: password, error: `Password must be at least ${PASSWORD_MIN} characters.` }
  }
  if (byteLength(password) > PASSWORD_MAX_BYTES) {
    return { value: password, error: `Password must be at most ${PASSWORD_MAX_BYTES} bytes.` }
  }
  return { value: password, error: null }
}

export function parseSignUp(body = {}) {
  const name = asString(body.name).trim().replace(/\s+/g, ' ')
  const email = validateEmail(body.email)
  const password = validatePassword(body.password)

  const confirm = asString(body.confirm)
  const errors = {}
  if (!name) errors.name = 'Name is required.'
  else if (name.length > 120) errors.name = 'Name must be at most 120 characters.'
  if (email.error) errors.email = email.error
  if (password.error) errors.password = password.error
  if (!confirm) errors.confirm = 'Please confirm your password.'
  else if (confirm !== password.value) errors.confirm = 'Passwords do not match.'

  if (Object.keys(errors).length) {
    throw validationFailed('Please correct the highlighted fields.', errors)
  }

  return { name, email: email.value, password: password.value }
}

export function parseSignIn(body = {}) {
  const email = validateEmail(body.email)
  const password = asString(body.password)
  const errors = {}
  if (email.error) errors.email = email.error
  if (!password) errors.password = 'Password is required.'
  if (Object.keys(errors).length) {
    throw validationFailed('Please correct the highlighted fields.', errors)
  }

  // "Remember me" only extends the refresh token lifetime. The access token
  // window stays short either way, so revoking a session is always cheap.
  const remember = body.remember === true || body.remember === 'true'

  return { email: email.value, password, remember }
}
