/**
 * Smoke test for the /login and /signup routes.
 * Rendered with react-dom/server to assert both auth modes output correctly.
 *
 * Run: npm run test:auth
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { createElement } from 'react'
import Auth from '../src/pages/Auth.jsx'
import { AuthProvider } from '../src/auth/AuthContext.jsx'

function collect(html) {
  const buttons = [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, '').trim(),
  )
  const inputs = [...html.matchAll(/<input[^>]*type="([^"]+)"/g)].map((m) => m[1])
  return { buttons, inputs, html }
}

function renderAt(path, initialMode) {
  // The forms now read the session from AuthProvider, so the tree must be
  // wrapped in it the same way App.jsx does.
  const tree = createElement(
    AuthProvider,
    null,
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(
        Routes,
        null,
        createElement(Route, { path: '/login', element: createElement(Auth) }),
        createElement(Route, { path: '/signup', element: createElement(Auth, { initialMode }) }),
      ),
    ),
  )
  return collect(renderToStaticMarkup(tree))
}

// Bundled to CJS, so import.meta.url is unavailable; resolve from the package root.
const authSrc = readFileSync(resolve(process.cwd(), 'src/pages/Auth.jsx'), 'utf8')
const appSrc = readFileSync(resolve(process.cwd(), 'src/App.jsx'), 'utf8')

const signIn = renderAt('/login')
const signUp = renderAt('/signup', 'signup')

const checks = [
  ['signin: heading rendered', signIn.html.includes('Welcome Back')],
  ['signin: email + password fields', signIn.inputs.filter((t) => t === 'email' || t === 'password').length === 2],
  ['signin: google button removed', !signIn.buttons.includes('Continue with Google') && !signUp.buttons.includes('Continue with Google')],
  ['signin: remember-me checkbox', signIn.inputs.includes('checkbox')],
  ['signin: footer prompts "Sign Up"', signIn.buttons.includes('Sign Up')],
  ['signin: signup form hidden', !signIn.html.includes('Full Name')],
  ['signin: divider copy', signIn.html.includes('Use your registered email')],
  ['signup: heading rendered', signUp.html.includes('Start Your Free Cloud Observability Trial')],
  ['signup: two password fields', signUp.inputs.filter((t) => t === 'password').length === 2],
  ['signup: footer prompts "Sign In"', signUp.buttons.includes('Sign In')],
  ['signup: signin form hidden', !signUp.html.includes('Welcome Back')],
  ['signup: strength meter present', signUp.html.includes('Strength:')],
  ['signup: divider copy', signUp.html.includes('Or register with work email')],
  // The mode tabs were removed; the footer link is the only switcher now.
  ['a11y: no tablist remains', !signIn.html.includes('role="tablist"') && !signUp.html.includes('role="tablist"')],
  ['a11y: footer still switches modes', signIn.buttons.includes('Sign Up') && signUp.buttons.includes('Sign In')],
  ['a11y: back-to-site link', signIn.html.includes('Back to site')],
  ['a11y: back-to-home button', signIn.html.includes('Back to home') && signUp.html.includes('Back to home')],

  // --- auth mode routing ---
  [
    'source: Auth keeps the URL in step with the active tab',
    /navigate\(isSignIn \? '\/login' : '\/signup', \{ replace: true \}\)/.test(authSrc),
  ],
  [
    'source: /signup renders the signup form',
    /path="\/signup"[\s\S]{0,120}initialMode="signup"/.test(appSrc),
  ],
  [
    'source: /login renders the signin form',
    /path="\/login"[\s\S]{0,120}element=\{<Auth \/>\}/.test(appSrc),
  ],
  ['brand: CloudPulse + tagline', signIn.html.includes('Multi-Cloud FinOps')],

  // --- Centering regression -------------------------------------------------
  // The card and the assurance strip must be siblings in a COLUMN flex
  // container. If they become children of a row container they render
  // side-by-side and the card drifts off-centre.
  ['layout: main is a column flex', /<main class="my-auto flex w-full flex-col items-center/.test(signIn.html)],
  ['layout: card is max-w-xl', signIn.html.includes('max-w-xl')],
  [
    'layout: card and strip share the same column parent',
    (() => {
      // index of the card div, index of the assurance strip — both after
      // <main ...> and before its closing tag
      const mainStart = signIn.html.indexOf('<main')
      const cardIdx = signIn.html.indexOf('max-w-xl', mainStart)
      const stripIdx = signIn.html.indexOf('Back to site', mainStart)
      return cardIdx > mainStart && stripIdx > cardIdx
    })(),
  ],
  [
    'layout: safe centering (my-auto, not items-center on the shell)',
    /<div class="flex min-h-screen justify-center/.test(signIn.html) &&
      /<main class="my-auto flex w-full flex-col/.test(signIn.html),
  ],
  [
    'layout: glows are fixed so they cannot grow the page',
    (signIn.html.match(/class="pointer-events-none fixed/g) || []).length === 2,
  ],
]

let failed = 0
for (const [name, ok] of checks) {
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
}
console.log(failed ? `\n${failed} check(s) failed` : `\nAll ${checks.length} checks passed`)
process.exit(failed ? 1 : 0)
