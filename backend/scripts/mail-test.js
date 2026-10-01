/**
 * Checks that the SMTP settings in .env can actually send mail.
 *
 * Run: npm run mail:test            verifies the connection only
 *      npm run mail:test you@x.com  also sends a real test message
 */
import { verifySmtp, sendVerificationCode } from '../src/mailer.js'
import { config } from '../src/config.js'

const to = process.argv[2] ?? config.mail.smtpUser

console.log(`host:   ${config.mail.smtpHost ?? '(unset — console fallback)'}`)
console.log(`port:   ${config.mail.smtpPort}`)
console.log(`secure: ${config.mail.smtpSecure}`)
console.log(`auth:   ${config.mail.smtpUser ? config.mail.smtpUser : '(none)'}`)
console.log(`from:   ${config.mail.from}`)

const check = await verifySmtp()

if (!check.ok) {
  console.error(`\nFAILED: ${check.reason}`)
  process.exit(1)
}

console.log(`\nOK: ${check.reason}`)

if (!to) {
  console.log('\nPass an address to also send a real message: npm run mail:test you@example.com')
  process.exit(0)
}

const result = await sendVerificationCode({ to, code: '123456' })
console.log(`sent to ${to} — transport=${result.transport} messageId=${result.messageId ?? 'n/a'}`)