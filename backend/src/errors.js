export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.expected = true
  }
}

export const badRequest = (message, details) =>
  new ApiError(400, 'bad_request', message, details)

export const validationFailed = (message, details) =>
  new ApiError(422, 'validation_failed', message, details)

export const unauthorized = (message = 'Authentication required.') =>
  new ApiError(401, 'unauthorized', message)

export const emailNotVerified = () =>
  new ApiError(403, 'email_not_verified', 'Verify your email address to continue.')

export const conflict = (message) => new ApiError(409, 'conflict', message)

export const notFound = (message = 'Not found.') => new ApiError(404, 'not_found', message)

export const invalidCredentials = () =>
  // Deliberately vague: confirming which half was wrong tells an attacker
  // whether an email address is registered.
  new ApiError(401, 'invalid_credentials', 'Invalid email or password.')

// Only used where the caller is already authenticated, so there is no address to
// enumerate — being vague here would just confuse someone changing their
// password.
export const wrongPassword = () =>
  new ApiError(401, 'invalid_credentials', 'Your current password is not correct.')

export const emailTaken = () =>
  new ApiError(409, 'email_taken', 'An account with that email already exists.')

export const tooManyRequests = (message = 'Too many attempts. Try again later.') =>
  new ApiError(429, 'rate_limited', message)
