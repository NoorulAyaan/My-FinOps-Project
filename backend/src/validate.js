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

export function parseForgotPassword(body = {}) {
  const email = validateEmail(body.email)
  if (email.error) throw validationFailed('Please correct the highlighted fields.', { email: email.error })
  return { email: email.value }
}

export function parseResetPassword(body = {}) {
  const password = validatePassword(body.password)
  const confirm = asString(body.confirm)
  const email = validateEmail(body.email)
  const errors = {}

  if (password.error) errors.password = password.error
  if (!confirm) errors.confirm = 'Please confirm your new password.'
  else if (confirm !== password.value) errors.confirm = 'Passwords do not match.'
  if (email.error) errors.email = email.error

  if (Object.keys(errors).length) {
    throw validationFailed('Please correct the highlighted fields.', errors)
  }

  // The address is taken rather than an account id: the forgot-password
  // response must stay identical for registered and unknown addresses, so it
  // cannot hand back a userId. Resolving the user here keeps the code itself
  // the only secret.
  return { email: email.value, password: password.value }
}

/**
 * Partial profile update: either field may be omitted, but at least one must be
 * present, and an explicitly empty name is rejected rather than silently ignored
 * (otherwise clearing the field would look like it worked).
 */
export function parseProfileUpdate(body = {}) {
  const errors = {}
  const hasName = Object.prototype.hasOwnProperty.call(body, 'name')
  const hasTimezone = Object.prototype.hasOwnProperty.call(body, 'timezone')

  let name
  if (hasName) {
    // Trimmed so a whitespace-only value is caught rather than stored as the
    // user's display name.
    name = asString(body.name).trim()
    if (!name) {
      errors.name = 'Name cannot be empty.'
    } else if (name.length > 120) {
      // Mirrors users_name_length, so the API reports the same limit the DB would.
      errors.name = 'Name must be 120 characters or fewer.'
    }
  }

  let timezone
  if (hasTimezone && body.timezone !== null && body.timezone !== '') {
    const candidate = asString(body.timezone).trim()
    // IANA names only; a fixed shape check rejects script injection in the value.
    if (!/^[A-Za-z]+(?:\/[A-Za-z0-9_+-]+){1,2}$/.test(candidate)) {
      errors.timezone = 'Use a timezone like Europe/London.'
    } else {
      timezone = candidate
    }
  } else if (hasTimezone) {
    timezone = null
  }

  if (!hasName && !hasTimezone) {
    throw validationFailed('Please correct the highlighted fields.', {
      name: 'Provide a name or a timezone to update.',
    })
  }

  if (Object.keys(errors).length) {
    throw validationFailed('Please correct the highlighted fields.', errors)
  }

  return { name, timezone }
}

export function parsePasswordChange(body = {}) {
  const current = asString(body.currentPassword)
  const password = validatePassword(body.newPassword)
  const confirm = asString(body.confirm)
  const errors = {}

  if (!current) errors.currentPassword = 'Enter your current password.'
  if (password.error) errors.newPassword = password.error
  if (!confirm) errors.confirm = 'Confirm your new password.'
  else if (confirm !== password.value) errors.confirm = 'Passwords do not match.'

  if (Object.keys(errors).length) {
    throw validationFailed('Please correct the highlighted fields.', errors)
  }

  return { currentPassword: current, newPassword: password.value }
}
