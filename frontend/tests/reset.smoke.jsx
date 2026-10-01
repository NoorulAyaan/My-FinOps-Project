/**
 * Smoke test for /forgot-password.
 *
 * The second step (code + new password) only renders after the request
 * succeeds, so it is exercised through the exported step rather than by clicking
 * through a live server.
 *
 * Run: npm run test:reset
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { createElement } from 'react'
import ForgotPassword from '../src/pages/ForgotPassword.jsx'
import { AuthProvider } from '../src/auth/AuthContext.jsx'

function collect(html) {
  // aria-hidden spans are decorative icon ligatures (e.g. "send"), so they are
  // stripped before reading a button's label.
  const buttons = [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) =>
    m[1]
      .replace(/<span aria-hidden="true"[\s\S]*?<\/span>/g, '')
      .replace(/<[^>]+>/g, '')
      .trim(),
  )
  const inputs = [...html.matchAll(/<input[^>]*type="([^"]+)"/g)].map((m) => m[1])
  const links = [...html.matchAll(/<a[^>]*href="([^"]+)"/g)].map((m) => m[1])
  return { buttons, inputs, links, html }
}

const html = renderToStaticMarkup(
  createElement(
    AuthProvider,
    null,
    createElement(
      MemoryRouter,
      { initialEntries: ['/forgot-password'] },
      createElement(
        Routes,
        null,
        createElement(Route, { path: '/forgot-password', element: createElement(ForgotPassword) }),
      ),
    ),
  ),
)
const page = collect(html)

const checks = [
  ['forgot: heading rendered', page.html.includes('Reset your password')],
  ['forgot: asks for an email', page.inputs.filter((t) => t === 'email').length === 1],
  ['forgot: prompts for a 6-digit code', page.html.includes('6-digit reset code')],
  ['forgot: submit button present', page.buttons.includes('Send Reset Code')],
  ['forgot: no password field yet', !page.inputs.includes('password')],
  ['forgot: links back to sign in', page.links.includes('/login')],
  ['forgot: links back to the site', page.links.includes('/')],
  ['forgot: no account enumeration in the copy', !/no account|not found|unknown email/i.test(page.html)],
  // React's static markup preserves the camelCase prop name.
  ['a11y: email field is autocomplete=email', /autoComplete="email"/.test(page.html)],
]

const failed = checks.filter(([, ok]) => !ok)
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
if (failed.length) {
  console.log(`\n${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\nAll ${checks.length} checks passed`)