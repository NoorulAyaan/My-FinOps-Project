/**
 * Header renders the signed-in account instead of the auth pitch, and the
 * account-label helpers behave.
 *
 * The header's signed-in branch cannot be reached via renderToStaticMarkup:
 * AuthProvider only learns the session inside an effect, which does not run on
 * the server. So the wiring is asserted against the source, and the label logic
 * is unit-tested directly.
 *
 * Run: npm run test:header
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { createElement } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { displayName, initials } from '../src/components/auth/accountName.js'
import { AuthProvider } from '../src/auth/AuthContext.jsx'
import Header from '../src/components/Header.jsx'

// Bundled to CJS, so import.meta.url is unavailable; resolve from the package root.
const read = (rel) => readFileSync(resolve(process.cwd(), 'tests', rel), 'utf8')
const headerSrc = read('../src/components/Header.jsx')
const menuSrc = read('../src/components/AccountMenu.jsx')
const shellSrc = read('../src/components/auth/AuthShell.jsx')
const heroSrc = read('../src/components/Hero.jsx')
const finalCtaSrc = read('../src/components/FinalCta.jsx')

// Every marketing CTA that leads to a protected page must be session-aware, or a
// signed-in visitor gets bounced to /login mid-session.
const ctaFiles = { Hero: heroSrc, FinalCta: finalCtaSrc }

function renderHeader() {
  return renderToStaticMarkup(
    createElement(
      AuthProvider,
      null,
      createElement(MemoryRouter, { initialEntries: ['/'] }, createElement(Header)),
    ),
  )
}

const signedOut = renderHeader()

const checks = [
  // --- signed-out render ---
  ['header: brand rendered', signedOut.includes('CloudPulse')],
  ['header: auth pitch when signed out', signedOut.includes('Sign in to console')],
  ['header: no account chip when signed out', !signedOut.includes('@')],
  ['header: dashboard link always present', signedOut.includes('Cost Dashboard')],
  // Signed out: no dashboard shortcut, since there is no dashboard to go to.
  ['auth pages: no dashboard shortcut when signed out', !signedOut.includes('Back to Dashboard')],

  // --- signed-in wiring (asserted on source, see note above) ---
  ['source: reads the session from AuthContext', headerSrc.includes('useAuth()')],
  ['source: signed in means authenticated + user', /status === 'authenticated' && user/.test(headerSrc)],
  // The chip itself moved into AccountMenu so it could become a dropdown; the
  // header only decides to render it.
  ['source: header renders AccountMenu', headerSrc.includes('<AccountMenu')],
  ['source: menu renders the account name', menuSrc.includes('{displayName(user)}')],
  ['source: menu renders the email', menuSrc.includes('{user.email}')],
  ['source: menu renders the initials avatar', menuSrc.includes('{initials(user)}')],
  ['source: menu falls back to the initials when no avatar', /user\.avatarUrl[\s\S]{0,400}initials\(user\)/.test(menuSrc)],

  // --- account menu behaviour ---
  ['source: menu exposes menu semantics', menuSrc.includes('aria-haspopup="menu"') && menuSrc.includes('role="menu"')],
  ['source: menu reports its open state', menuSrc.includes('aria-expanded={open}')],
  ['source: menu closes on an outside click', menuSrc.includes("addEventListener('mousedown'") && menuSrc.includes('rootRef.current?.contains')],
  ['source: menu closes on Escape', /event\.key === 'Escape'/.test(menuSrc)],
  ['source: menu items carry menuitem role', menuSrc.includes('role="menuitem"')],
  ['source: menu links to the settings page', menuSrc.includes("go('/settings')")],
  ['source: menu can sign out', menuSrc.includes('handleSignOut') && menuSrc.includes('signOut()')],

  // --- header still gates the chip on a session ---
  ['source: header gates AccountMenu on a session', /signedIn[\s\S]{0,80}<AccountMenu/.test(headerSrc)],
  ['source: login link sits in the signed-out branch', /\) : \(\s*<Link[\s\S]{0,200}to="\/login"/.test(headerSrc)],

  // --- session-aware CTAs (regression: hardcoded to="/login" bounced a signed-in user) ---
  [
    'source: Hero CTA uses AuthLink, not a hardcoded /login',
    /AuthLink[\s\S]{0,60}signedInTo="\/connect"/.test(ctaFiles.Hero) &&
      !/<Link\s+to="\/login"/.test(heroSrc),
  ],
  [
    'source: FinalCta CTA uses AuthLink, not a hardcoded /login',
    /AuthLink[\s\S]{0,60}signedInTo="\/connect"/.test(ctaFiles.FinalCta) &&
      !/<Link\s+[\s\S]{0,80}to="\/login"/.test(finalCtaSrc),
  ],
  [
    'source: no component still hardcodes /login for a connect CTA',
    ![...read('../src/components/Header.jsx'), ...Object.values(ctaFiles)]
      .join('')
      .match(/to="\/login"[\s\S]{0,60}Connect/),
  ],

  // --- back-to-dashboard on the auth screens ---
  ['source: AuthShell reads the session', shellSrc.includes('useAuth()')],
  [
    'source: back-to-dashboard is gated on a session',
    shellSrc.indexOf('signedIn &&') !== -1 &&
      shellSrc.indexOf('signedIn &&') < shellSrc.indexOf('Back to Dashboard'),
  ],
  [
    'source: back-to-dashboard points at /dashboard',
    /Back to Dashboard/.test(shellSrc) && shellSrc.includes('to="/dashboard"'),
  ],
  [
    'source: back-to-site is kept for signed-out visitors',
    /Back to site/.test(shellSrc),
  ],
  [
    'source: auth card has an explicit back-to-home button',
    /Back to home/.test(shellSrc) && /to="\/"/.test(shellSrc),
  ],
  [
    'source: back-to-home sits above the brand header',
    shellSrc.indexOf('Back to home') < shellSrc.indexOf('Brand header'),
  ],

  // --- label helpers ---
  ['name: full name becomes "First L."', displayName({ name: 'Noorul Ayaan Siddiqui', email: 'n@x.io' }) === 'Noorul S.'],
  ['name: two words keep both initials', displayName({ name: 'Devin Patel' }) === 'Devin P.'],
  ['name: single word is left alone', displayName({ name: 'Cher' }) === 'Cher'],
  ['name: missing name falls back to email', displayName({ name: '', email: 'anon@x.io' }) === 'anon@x.io'],
  ['name: no name and no email falls back to Account', displayName({}) === 'Account'],
  ['name: extra whitespace collapses', displayName({ name: '  Ayaan   Noor  ' }) === 'Ayaan N.'],
  ['initials: first and last letter', initials({ name: 'Noorul Ayaan Siddiqui' }) === 'NS'],
  ['initials: single word takes two letters', initials({ name: 'Cher' }) === 'CH'],
  ['initials: no name is a placeholder', initials({ name: '' }) === '?'],
]

const failed = checks.filter(([, ok]) => !ok)
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)

if (failed.length) {
  console.log(`\n${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\nAll ${checks.length} checks passed`)