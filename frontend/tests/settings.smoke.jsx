/**
 * Account settings: the API surface the settings page depends on, the device
 * label fallback, and the wiring of the four sections.
 *
 * The section components need a live authenticated fetch, which is covered by
 * the backend suite, so this asserts the client methods, the pure helper, and
 * the section wiring against source.
 *
 * Run: npm run test:settings
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describeDevice } from '../src/components/settings/SessionsSection.jsx'

const read = (rel) => readFileSync(resolve(process.cwd(), rel), 'utf8')
const clientSrc = read('src/api/client.js')
const authCtxSrc = read('src/auth/AuthContext.jsx')
const appSrc = read('src/App.jsx')
const settingsSrc = read('src/pages/Settings.jsx')
const navSrc = read('src/components/settings/SettingsNav.jsx')
const profileSrc = read('src/components/settings/ProfileSection.jsx')
const securitySrc = read('src/components/settings/SecuritySection.jsx')
const connectionsSrc = read('src/components/settings/ConnectionsSection.jsx')
const sessionsSrc = read('src/components/settings/SessionsSection.jsx')
const viteSrc = read('vite.config.js')
const connectSrc = read('src/pages/ConnectCloud.jsx')

const checks = [
  // --- profile ---
  ['client: PATCH /api/auth/me', /updateProfile[\s\S]{0,120}send\('\/api\/auth\/me', \{ method: 'PATCH'/.test(clientSrc)],
  ['client: avatar upload posts multipart', clientSrc.includes("send('/api/auth/me/avatar', { method: 'POST', form })")],
  ['client: avatar removal', /removeAvatar[\s\S]{0,80}'DELETE'/.test(clientSrc)],
  ['client: FormData is not given a content type', /if \(form === undefined && body !== undefined\)/.test(clientSrc)],
  ['profile: saves through updateProfile', profileSrc.includes('api.updateProfile(')],
  ['profile: pushes the new user into the context', profileSrc.includes('updateUser(res.user)')],
  ['profile: uploads an avatar', profileSrc.includes('api.uploadAvatar(file)')],
  ['profile: removes an avatar', profileSrc.includes('api.removeAvatar()')],
  ['profile: enforces the 2 MB client-side limit', profileSrc.includes('MAX_AVATAR_BYTES = 2 * 1024 * 1024')],
  ['profile: rejects oversized files before upload', /file\.size > MAX_AVATAR_BYTES/.test(profileSrc)],
  ['profile: constrains the file picker to image types', /ACCEPTED_AVATAR_TYPES = \['image\/png', 'image\/jpeg', 'image\/webp', 'image\/gif'\]/.test(profileSrc)],
  ['profile: email field is read-only', profileSrc.includes('readOnly')],
  ['profile: name is trimmed before submit', profileSrc.includes('name.trim()')],
  ['profile: avatar URL falls back to initials', /user\.avatarUrl/.test(profileSrc)],

  // --- security ---
  ['client: change-password call', /changePassword[\s\S]{0,160}send\('\/api\/auth\/change-password'/.test(clientSrc)],
  ['security: sends the current password', securitySrc.includes('currentPassword, newPassword')],
  ['security: asks for the current password', securitySrc.includes('autoComplete="current-password"')],
  ['security: requires the confirmation to match', securitySrc.includes('newPassword !== confirm')],
  ['security: shows a strength meter', securitySrc.includes('<PasswordStrength')],
  ['security: clears the fields after success', /setCurrentPassword\(''\)/.test(securitySrc)],

  // --- connections ---
  ['client: lists sessions', clientSrc.includes("listSessions: () => send('/api/account/sessions')")],
  ['client: revokes one session', clientSrc.includes('send(`/api/account/sessions/${id}`, { method: \'DELETE\' })')],
  ['client: revokes other sessions', clientSrc.includes("send('/api/account/sessions/revoke-others', { method: 'POST' })")],
  ['connections: removal is confirmed before it runs', /setConfirmingId\(account\.id\)/.test(connectionsSrc) && /handleRemove\(account\.id\)/.test(connectionsSrc)],
  ['connections: never shows a stored secret', !/accessKeySecret/.test(connectionsSrc)],
  ['connections: links out to add another account', connectionsSrc.includes('to="/connect"')],

  // --- sessions ---
  ['sessions: marks the caller as this device', sessionsSrc.includes('session.id === currentSessionId')],
  ['sessions: reloads after a revocation instead of guessing', /await load\(\)/.test(sessionsSrc)],
  ['sessions: shows the sign-in IP', sessionsSrc.includes('session.ipAddress')],
  ['sessions: shows when the session was last active', sessionsSrc.includes('session.lastSeenAt')],
  ['sessions: signs-out-others is disabled with nothing to revoke', /otherCount === 0/.test(sessionsSrc)],

  // --- device label fallback ---
  ['device: Windows', describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)') === 'Windows'],
  ['device: macOS', describeDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)') === 'Mac'],
  ['device: iPhone', describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)') === 'iOS device'],
  ['device: Android', describeDevice('Mozilla/5.0 (Linux; Android 14)') === 'Android device'],
  ['device: Linux', describeDevice('Mozilla/5.0 (X11; Linux x86_64)') === 'Linux'],
  ['device: unknown', describeDevice('curl/8.4.0') === 'Unknown device'],
  ['device: absent user-agent', describeDevice(undefined) === 'Unknown device'],

  // --- context + routing ---
  ['context: exposes updateUser', authCtxSrc.includes('const updateUser = useCallback') && /adoptSession, updateUser, signOut/.test(authCtxSrc)],
  ['routes: /settings is protected', /path="\/settings"[\s\S]{0,160}<RequireAuth>/.test(appSrc)],
  ['settings: renders all four sections', ['profile', 'security', 'connections', 'sessions'].every((id) => settingsSrc.includes(`<${id === 'profile' ? 'ProfileSection' : id === 'security' ? 'SecuritySection' : id === 'connections' ? 'ConnectionsSection' : 'SessionsSection'} />`))],
  ['settings: nav covers the same four sections', navSrc.includes("id: 'profile'") && navSrc.includes("id: 'security'") && navSrc.includes("id: 'connections'") && navSrc.includes("id: 'sessions'")],

  // --- way back home ---
  ['settings: has an explicit back-to-home control', /Back to home/.test(settingsSrc) && /to="\/"/.test(settingsSrc)],
  ['connect: has an explicit back-to-home control', /Back to home/.test(connectSrc) && /to="\/"/.test(connectSrc)],
  ['connect: logo is a link home', /<Link to="\/"[\s\S]{0,200}<BrandLogo/.test(connectSrc)],

  // --- avatar delivery in dev ---
  ['vite: /uploads is proxied so avatar URLs resolve', viteSrc.includes("'/uploads'")],
]

const failed = checks.filter(([, ok]) => !ok)
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)

if (failed.length) {
  console.log(`\n${failed.length} check(s) failed`)
  process.exit(1)
}
console.log(`\nAll ${checks.length} checks passed`)