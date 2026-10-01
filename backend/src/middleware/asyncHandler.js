/**
 * Express 4 does not catch rejected promises, so an async handler that throws
 * would leave the request hanging until the client times out. Every async route
 * handler is wrapped in this to forward failures to the error middleware.
 */
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)
}
