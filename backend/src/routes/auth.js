import { Router } from 'express'
import * as service from '../auth.service.js'
import { badRequest, emailNotVerified } from '../errors.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { requireAuth } from '../middleware/requireAuth.js'
import {
  parseForgotPassword,
  parsePasswordChange,
  parseProfileUpdate,
  parseResetPassword,
  parseSignIn,
  parseSignUp,
} from '../validate.js'
import * as account from '../account.service.js'
import { avatarUpload, storeAvatar } from '../middleware/upload.js'
import { notFound, unauthorized, wrongPassword } from '../errors.js'
import { sendPasswordResetCode, sendVerificationCode } from '../mailer.js'
import * as reset from '../reset.service.js'
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

/**
 * Descriptive session metadata for the settings page. None of it is used for an
 * access decision — the user agent in particular is attacker-controlled, so it
 * must never influence authorisation.
 */
function deviceFrom(req) {
  const ua = req.get('user-agent') ?? null
  return {
    label: describeDevice(ua),
    userAgent: ua,
    ip: req.ip ?? null,
  }
}

/** "Chrome on macOS" — enough to recognise a session, no more. */
function describeDevice(ua) {
  if (!ua) return 'Unknown device'

  const browser = [
    [/Edg\//, 'Edge'],
    [/OPR\//, 'Opera'],
    [/Firefox\//, 'Firefox'],
    [/Chrome\//, 'Chrome'],
    [/Safari\//, 'Safari'],
  ].find(([re]) => re.test(ua))?.[1]

  const platform = [
    [/Windows/, 'Windows'],
    [/iPhone|iPad|iPod/, 'iOS'],
    [/Mac OS X|Macintosh/, 'macOS'],
    [/Android/, 'Android'],
    [/Linux/, 'Linux'],
  ].find(([re]) => re.test(ua))?.[1]

  if (browser && platform) return `${browser} on ${platform}`
  return platform ?? browser ?? 'Unknown device'
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
    const session = await service.issueSession(user, { remember: false, device: deviceFrom(req) })
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

    const session = await service.issueSession(user, { remember, device: deviceFrom(req) })
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
    res.json({ user: account.publicUser(user) })
  }),
)

// Display name and timezone. The email is deliberately not editable here: it is
// the account identity, and changing it would mean re-verifying a new address.
router.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { name, timezone } = parseProfileUpdate(req.body)
    const updated = await account.updateProfile(req.user.sub, { name, timezone })
    if (!updated) throw notFound('User no longer exists.')
    res.json({ user: account.publicUser(updated) })
  }),
)

router.post(
  '/me/avatar',
  requireAuth,
  avatarUpload,
  asyncHandler(async (req, res) => {
    const previous = await account.findAvatarPath(req.user.sub)
    const filename = await storeAvatar(req.file)
    const updated = await account.setAvatarPath(req.user.sub, filename)

    // Only unlink once the new row points at the new file, so a database error
    // cannot leave the account with no avatar.
    await account.removeAvatarFile(previous)
    res.json({ user: account.publicUser(updated) })
  }),
)

router.delete(
  '/me/avatar',
  requireAuth,
  asyncHandler(async (req, res) => {
    const previous = await account.findAvatarPath(req.user.sub)
    const updated = await account.deleteAvatar(req.user.sub)
    await account.removeAvatarFile(previous)
    res.json({ user: account.publicUser(updated) })
  }),
)

// Password change. The current password is required so a stolen session cannot
// lock the owner out, and every other session is revoked on success.
router.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = parsePasswordChange(req.body)
    const user = await service.findUserCredentialsById(req.user.sub)
    if (!user) throw unauthorized('Session is no longer valid.')

    const ok = await service.verifyPassword(currentPassword, user)
    if (!ok) throw wrongPassword()

    await service.changePassword(user.id, newPassword)
    // `sid` identifies the session making this request, so it survives while the
    // user's other devices are signed out.
    const revoked = await account.revokeOtherSessions(user.id, req.user.sid ?? null)

    res.json({ message: 'Password updated. Other devices have been signed out.', revokedSessions: revoked })
  }),
)

// Password reset, step 1: mail a code to the address on the account.
//
// The response is deliberately the same for a registered address and an unknown
// one, so this cannot be used to discover which emails have accounts.
router.post(
  '/forgot-password',
  asyncHandler(async (req, res) => {
    const { email } = parseForgotPassword(req.body)
    const user = await service.findUserByEmail(email)

    const response = {
      message: 'If that address has an account, a reset code is on its way.',
    }

    if (!user) return res.json(response)

    const { code } = await reset.requestReset(user)
    const delivery = await sendPasswordResetCode({ to: user.email, code })

    return res.json({
      ...response,
      // devCode only exists on the console transport, i.e. local development.
      ...(delivery.transport === 'console' ? { devCode: code } : {}),
    })
  }),
)

// Password reset, step 2: exchange the code for a new password.
//
// No session is returned. Every existing session was revoked by the redeem, so
// the user signs in again with the new password — and any session an attacker
// was holding is dead.
router.post(
  '/reset-password',
  asyncHandler(async (req, res) => {
    const { email, password } = parseResetPassword(req.body)
    assertCodeFormat(req.body?.code)

    const user = await service.findUserByEmail(email)
    // Same message as a spent or unknown code, so the code stays the only thing
    // an attacker can brute-force.
    if (!user) throw badRequest('No reset code is active. Request a new one.')

    await reset.redeemReset({ userId: user.id, code: req.body.code, newPassword: password })

    res.json({ message: 'Password updated. Sign in with your new password.' })
  }),
)

export default router
