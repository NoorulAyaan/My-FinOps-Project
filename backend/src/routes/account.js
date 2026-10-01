import { Router } from 'express'
import * as account from '../account.service.js'
import { notFound } from '../errors.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { requireAuth } from '../middleware/requireAuth.js'

/**
 * Account settings reads that the settings page needs in one go: connected
 * cloud accounts and live sessions. Mutations live in their own routes (profile
 * and avatar under /api/auth/me, account removal under /api/cloud-accounts).
 */
const router = Router()

router.get(
  '/sessions',
  requireAuth,
  asyncHandler(async (req, res) => {
    const sessions = await account.listSessions(req.user.sub)
    // `sid` comes from the access token, so the caller can mark its own device
    // without the client having to guess which row it is.
    res.json({ sessions, currentSessionId: req.user.sid ?? null })
  }),
)

router.delete(
  '/sessions/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    // Scoped to the requesting user, so a guessed id cannot revoke another
    // account's session.
    const revoked = await account.revokeSession(req.user.sub, req.params.id)
    if (!revoked) throw notFound('That session is no longer active.')
    res.status(204).end()
  }),
)

router.post(
  '/sessions/revoke-others',
  requireAuth,
  asyncHandler(async (req, res) => {
    const count = await account.revokeOtherSessions(req.user.sub, req.user.sid ?? null)
    res.json({ message: 'Other devices have been signed out.', revokedSessions: count })
  }),
)

export default router