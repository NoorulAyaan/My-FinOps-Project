import { unauthorized } from '../errors.js'
import { verifyAccessToken } from '../tokens.js'

export function requireAuth(req, _res, next) {
  const header = req.get('authorization') ?? ''
  const [scheme, token] = header.split(' ')

  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return next(unauthorized())
  }

  try {
    req.user = verifyAccessToken(token)
    return next()
  } catch (err) {
    return next(err)
  }
}
