/**
 * Account-label helpers for the header.
 *
 * Kept out of Header.jsx so they can be unit-tested directly: the header's
 * signed-in branch cannot be reached through a server render, because
 * AuthProvider only learns the session inside an effect.
 */

/** "Noorul Ayaan S" from "noorul@acme.corp". */
export function displayName(user) {
  const full = (user?.name ?? '').trim()
  if (!full) return user?.email ?? 'Account'
  const parts = full.split(/\s+/)
  if (parts.length === 1) return full
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

/** "NA" for "Noorul Ayaan Siddiqui". */
export function initials(user) {
  const full = (user?.name ?? '').trim()
  if (!full) return '?'
  const parts = full.split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}