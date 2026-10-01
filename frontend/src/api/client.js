/**
 * Talks to the CloudPulse auth API. Vite proxies /api to the backend in dev, so
 * requests are same-origin and no CORS preflight is involved.
 */

const ACCESS_KEY = 'cloudpulse.accessToken'
const REFRESH_KEY = 'cloudpulse.refreshToken'

export const tokens = {
  access: () => localStorage.getItem(ACCESS_KEY),
  refresh: () => localStorage.getItem(REFRESH_KEY),
  set({ access, refresh }) {
    if (access?.token) localStorage.setItem(ACCESS_KEY, access.token)
    if (refresh?.token) localStorage.setItem(REFRESH_KEY, refresh.token)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

/** Thrown for any non-2xx response, carrying the API's structured error. */
export class ApiError extends Error {
  constructor(status, payload) {
    super(payload?.error?.message ?? 'Something went wrong.')
    this.name = 'ApiError'
    this.status = status
    this.code = payload?.error?.code
    this.details = payload?.error?.details
  }
}

/**
 * Single-flight refresh. When the 15-minute access token expires, several
 * requests can fail at once; without this they would each burn the single-use
 * refresh token, and all but one would be rejected as a replay.
 */
let refreshInFlight = null

async function refreshSession() {
  refreshInFlight ??= (async () => {
    const refreshToken = tokens.refresh()
    if (!refreshToken) return false
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      if (!res.ok) {
        tokens.clear()
        return false
      }
      tokens.set(await res.json())
      return true
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

async function send(path, { method = 'GET', body, auth = true, retry = true } = {}) {
  const headers = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (auth) {
    const accessToken = tokens.access()
    if (accessToken) headers.authorization = `Bearer ${accessToken}`
  }

  const res = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (res.status === 401 && auth && retry && tokens.refresh()) {
    if (await refreshSession()) {
      return send(path, { method, body, auth, retry: false })
    }
  }

  if (res.status === 204) return null

  const text = await res.text()
  const payload = text ? JSON.parse(text) : null
  if (!res.ok) throw new ApiError(res.status, payload)
  return payload
}

export const api = {
  signup: (input) => send('/api/auth/signup', { method: 'POST', body: input, auth: false }),
  signin: (input) => send('/api/auth/signin', { method: 'POST', body: input, auth: false }),
  verifyEmail: (userId, code) =>
    send('/api/auth/verify-email', { method: 'POST', body: { userId, code }, auth: false }),
  resendVerification: (email) =>
    send('/api/auth/resend-verification', { method: 'POST', body: { email }, auth: false }),
  me: () => send('/api/auth/me'),
  logout: () => send('/api/auth/logout', { method: 'POST', body: { refreshToken: tokens.refresh() } }),

  listCloudProviders: () => send('/api/cloud-accounts/providers'),
  listCloudAccounts: () => send('/api/cloud-accounts'),
  addCloudAccount: (input) => send('/api/cloud-accounts', { method: 'POST', body: input }),
  deleteCloudAccount: (id) => send(`/api/cloud-accounts/${id}`, { method: 'DELETE' }),
}
