import nodemailer from 'nodemailer'
import { config } from './config.js'

/**
 * Verification mail. With SMTP_HOST set the code goes out over real SMTP;
 * without it the code is printed to the server console so the signup flow stays
 * testable before any provider account exists.
 *
 * The plaintext code only ever exists in this module's scope. It is written to
 * the console in dev because that is the only way to complete a local test, and
 * is never returned by an API endpoint.
 */

// Reused across sends: Nodemailer keeps the connection pooled, so every
// verification does not pay a fresh TCP + TLS handshake.
let transporter = null

function getTransporter() {
  transporter ??= nodemailer.createTransport({
    host: config.mail.smtpHost,
    port: config.mail.smtpPort,
    secure: config.mail.smtpSecure,
    auth: config.mail.smtpUser
      ? { user: config.mail.smtpUser, pass: config.mail.smtpPassword }
      : undefined,
    // Fail a hanging provider instead of stalling the signup request.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  })
  return transporter
}

/** Escapes text before it goes into the HTML body. */
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** Shared HTML frame for every one-time-code email. */
function codeEmail({ code, minutes, heading, intro, footnote }) {
  const safeCode = escapeHtml(code)
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e6edf3;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#161b22;border:1px solid #30363d;border-radius:12px;">
      <tr>
        <td style="padding:28px 28px 8px;">
          <p style="margin:0;font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#7d8590;">CloudPulse FinOps</p>
          <h1 style="margin:8px 0 0;font-size:20px;line-height:1.4;color:#e6edf3;">${escapeHtml(heading)}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:8px 28px 0;font-size:14px;line-height:1.6;color:#9198a1;">
          ${escapeHtml(intro)}
        </td>
      </tr>
      <tr>
        <td style="padding:20px 28px;">
          <div style="background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:18px;text-align:center;">
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:32px;letter-spacing:.32em;font-weight:600;color:#e6edf3;">${safeCode}</span>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:0 28px 8px;font-size:13px;line-height:1.6;color:#7d8590;">
          The code expires in ${minutes} minutes and can be used once.
        </td>
      </tr>
      <tr>
        <td style="padding:16px 28px 28px;border-top:1px solid #21262d;font-size:12px;line-height:1.6;color:#6e7681;">
          ${escapeHtml(footnote)}
        </td>
      </tr>
    </table>
  </body>
</html>`
}

/** Console banner for the no-SMTP fallback. Shared shape, distinct label. */
function logCode({ label, to, code, minutes }) {
  const bar = '─'.repeat(62)
  console.log(
    [
      '',
      `┌${bar}┐`,
      `│  ${label.padEnd(60)}│`,
      `├${bar}┤`,
      `│  to:   ${to.padEnd(56)}│`,
      `│  code: ${code.padEnd(56)}│`,
      `│  expires in: ${`${minutes} minutes`.padEnd(49)}│`,
      `└${bar}┘`,
      '',
    ].join('\n'),
  )
}

function buildVerificationMail({ code, minutes }) {
  return {
    subject: `${code} is your CloudPulse verification code`,
    text: [
      'Welcome to CloudPulse FinOps.',
      '',
      `Your verification code is: ${code}`,
      '',
      `It expires in ${minutes} minutes and can be used once.`,
      '',
      'If you did not create this account you can ignore this email.',
    ].join('\n'),
    html: codeEmail({
      code,
      minutes,
      heading: 'Verify your email',
      intro: 'Enter this code to finish creating your account.',
      footnote:
        'If you did not create a CloudPulse account, you can ignore this email — no action is needed.',
    }),
  }
}

function buildPasswordResetMail({ code, minutes }) {
  return {
    subject: `${code} is your CloudPulse password reset code`,
    text: [
      'Reset your CloudPulse FinOps password.',
      '',
      `Your password reset code is: ${code}`,
      '',
      `It expires in ${minutes} minutes and can be used once.`,
      '',
      'If you did not request a password reset, you can ignore this email —',
      'your password will not change unless someone completes the reset.',
    ].join('\n'),
    html: codeEmail({
      code,
      minutes,
      heading: 'Reset your password',
      intro: 'Enter this code to choose a new CloudPulse password.',
      footnote:
        'If you did not request a password reset, ignore this email. Your password will not change.',
    }),
  }
}

async function deliver({ to, code, label, build, ttlMinutes }) {
  if (!config.mail.smtpHost) {
    logCode({ label, to, code, minutes: ttlMinutes })
    return { delivered: false, transport: 'console' }
  }

  const mail = build({ code, minutes: ttlMinutes })
  const info = await getTransporter().sendMail({
    from: config.mail.from,
    to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  })

  return { delivered: true, transport: 'smtp', messageId: info.messageId }
}

export async function sendVerificationCode({ to, code }) {
  try {
    return await deliver({
      to,
      code,
      label: 'EMAIL VERIFICATION (console fallback — no SMTP configured)',
      build: buildVerificationMail,
      ttlMinutes: config.mail.codeTtlMinutes,
    })
  } catch (err) {
    // A mail outage must not read as "your account is broken" — the account
    // still exists and the code can be resent.
    console.error(`[mail] failed to send verification to ${to}: ${err.message}`)
    return { delivered: false, transport: 'error', error: err.message }
  }
}

export async function sendPasswordResetCode({ to, code }) {
  try {
    return await deliver({
      to,
      code,
      label: 'PASSWORD RESET (console fallback — no SMTP configured)',
      build: buildPasswordResetMail,
      ttlMinutes: config.mail.resetCodeTtlMinutes,
    })
  } catch (err) {
    console.error(`[mail] failed to send password reset to ${to}: ${err.message}`)
    return { delivered: false, transport: 'error', error: err.message }
  }
}

/**
 * Checks the SMTP credentials without creating an account. Used by
 * `npm run mail:test`, so a misconfigured host is caught here rather than on a
 * real signup attempt.
 */
export async function verifySmtp() {
  if (!config.mail.smtpHost) {
    return { ok: false, reason: 'SMTP_HOST is not set — mail would fall back to the console.' }
  }
  try {
    await getTransporter().verify()
    return { ok: true, reason: `Connected to ${config.mail.smtpHost}:${config.mail.smtpPort}` }
  } catch (err) {
    return { ok: false, reason: err.message }
  }
}