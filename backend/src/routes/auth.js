import { Router } from 'express'
import * as service from '../auth.service.js'
import { badRequest, emailNotVerified } from '../errors.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { parseSignIn, parseSignUp } from '../validate.js'
import { sendVerificationCode } from '../mailer.js'
import {
  assertCodeFormat,
  issueVerificationCode,
  verifyCode,
} from '../verification.service.js'

const router = Router()

function readRefreshToken(req) {
  const body = req.body ?? {}
  return body.refreshToken ?? req.get('x-refresh-token') ?? undefined
}

router.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const input = parseSignUp(req.body)
    const user = await service.createUser(input)

    // Signup deliberately issues no session. Until the address is proven, the
    // account cannot sign in, so handing out tokens here would be pointless.
    const { code, expiresAt } = await issueVerificationCode(user)
    const delivery = await sendVerificationCode({ to: user.email, code })

    res.status(201).json({
      user: service.publicUser(user),
      emailSent: delivery.delivered,
      // Without SMTP there is no inbox to check, so the code is returned for
      // local development only.
      ...(delivery.transport === 'console' ? { devCode: code } : {}),
      verificationExpiresAt: expiresAt.toISOString(),
    })
  }),
)

router.post(
  '/verify-email',
  asyncHandler(async (req, res) => {
    const { userId, code } = req.body ?? {}
    if (!userId) throw badRequest('userId is required.')
    assertCodeFormat(code)
    await verifyCode({ userId, code })

    const user = await service.findUserById(userId)
    if (!user) throw badRequest('No such user.')
    const session = await service.issueSession(user, { remember: false })
    res.json({ ...session, message: 'Email verified.' })
  }),
)

router.post(
  '/resend-verification',
  asyncHandler(async (req, res) => {
    const { email } = req.body ?? {}
    if (!email || typeof email !== 'string') throw badRequest('email is required.')

    const user = await service.findUserByEmail(email.trim().toLowerCase())

    // Always the same response, so this cannot be used to find out which
    // addresses are registered or already verified.
    const response = {
      message: 'If that address needs verifying, a new code is on its way.',
    }

    // An unknown or already-verified address gets exactly the same body as the
    // real case below. `verificationExpiresAt` is deliberately omitted: it was
    // the one field that made production responses distinguishable, letting an
    // attacker probe which addresses are registered but unverified.
    if (!user || user.email_verified) return res.json(response)

    const { code } = await issueVerificationCode(user)
    const delivery = await sendVerificationCode({ to: user.email, code })
    // devCode exists only when mail falls back to the console transport, i.e.
    // local development. With SMTP configured the response is just `message`.
    return res.json({
      ...response,
      ...(delivery.transport === 'console' ? { devCode: code } : {}),
    })
  }),
)

router.post(
  '/signin',
  asyncHandler(async (req, res) => {
    const { email, password, remember } = parseSignIn(req.body)
    const user = await service.authenticate({ email, password })

    if (!user.email_verified) throw emailNotVerified()

    const session = await service.issueSession(user, { remember })
    res.json(session)
  }),
)

router.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const presented = readRefreshToken(req)
    if (!presented) throw badRequest('A refreshToken is required.')
    res.json(await service.rotateRefreshToken(presented))
  }),
)

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await service.revokeRefreshToken(readRefreshToken(req))
    // Always 204 whether or not a token was supplied, so this endpoint cannot be
    // used to probe which tokens are live.
    res.status(204).end()
  }),
)

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await service.findUserById(req.user.sub)
    if (!user) throw badRequest('User no longer exists.')
    res.json({ user: service.publicUser(user) })
  }),
)

export default router
