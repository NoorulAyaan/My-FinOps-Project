import nodemailer from 'nodemailer'
import { config } from './config.js'

/**
 * Verification mail. With SMTP_HOST set, mail goes out for real; without it the
 * code is printed to the server console so the signup flow is fully testable
 * before any provider account exists.
 *
 * The plaintext code only ever exists in this function's scope. It is written to
 * the console in dev because that is the only way to complete a local test, and
 * is never returned by an API endpoint.
 */
async function deliver({ to, code }) {
  if (!config.mail.smtpHost) {
    console.log(
      [
        '',
        '┌──────────────────────────────────────────────────────────────┐',
        '│  EMAIL VERIFICATION (console fallback — no SMTP configured)  │',
        '├──────────────────────────────────────────────────────────────┤',
        `│  to:   ${to.padEnd(56)}│`,
        `│  code: ${code.padEnd(56)}│`,
        `│  expires in: ${`${config.mail.codeTtlMinutes} minutes`.padEnd(49)}│`,
        '└──────────────────────────────────────────────────────────────┘',
        '',
      ].join('\n'),
    )
    return { delivered: false, transport: 'console' }
  }

  const transporter = nodemailer.createTransport({
    host: config.mail.smtpHost,
    port: config.mail.smtpPort,
    secure: config.mail.smtpSecure,
    auth: config.mail.smtpUser
      ? { user: config.mail.smtpUser, pass: config.mail.smtpPassword }
      : undefined,
  })

  await transporter.sendMail({
    from: config.mail.from,
    to,
    subject: 'Verify your CloudPulse email',
    text: [
      'Welcome to CloudPulse FinOps.',
      '',
      `Your verification code is: ${code}`,
      '',
      `It expires in ${config.mail.codeTtlMinutes} minutes.`,
      'If you did not create this account you can ignore this email.',
    ].join('\n'),
  })

  return { delivered: true, transport: 'smtp' }
}

export async function sendVerificationCode({ to, code }) {
  try {
    return await deliver({ to, code })
  } catch (err) {
    // A mail outage must not read as "your account is broken" — the account
    // still exists and the code can be resent.
    console.error(`[mail] failed to send verification to ${to}: ${err.message}`)
    return { delivered: false, transport: 'error', error: err.message }
  }
}
