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

async function send(path, { method = 'GET', body, form, auth = true, retry = true } = {}) {
  const headers = {}
  // FormData needs the browser to set a multipart boundary, so the content type
  // is deliberately left unset for it.
  if (form === undefined && body !== undefined) {
    headers['content-type'] = 'application/json'
  }
  if (auth) {
    const accessToken = tokens.access()
    if (accessToken) headers.authorization = `Bearer ${accessToken}`
  }

  const res = await fetch(path, {
    method,
    headers,
    body: form !== undefined ? form : body === undefined ? undefined : JSON.stringify(body),
  })

  if (res.status === 401 && auth && retry && tokens.refresh()) {
    if (await refreshSession()) {
      return send(path, { method, body, form, auth, retry: false })
    }
  }

  if (res.status === 204) return null

  const text = await res.text()
  const payload = text ? JSON.parse(text) : null
  if (!res.ok) throw new ApiError(res.status, payload)
  return payload
}

/**
 * Fetches a file endpoint with the same auth/refresh handling as send(),
 * then saves the response to disk under the server-provided filename.
 */
async function download(path) {
  const headers = {}
  const accessToken = tokens.access()
  if (accessToken) headers.authorization = `Bearer ${accessToken}`

  let res = await fetch(path, { headers })
  if (res.status === 401 && tokens.refresh()) {
    if (await refreshSession()) {
      res = await fetch(path, {
        headers: { authorization: `Bearer ${tokens.access()}` },
      })
    }
  }

  if (!res.ok) {
    const text = await res.text()
    throw new ApiError(res.status, text ? JSON.parse(text) : null)
  }

  const disposition = res.headers.get('content-disposition') ?? ''
  const filename =
    disposition.match(/filename="([^"]+)"/)?.[1] ?? path.split('/').pop() ?? 'download'

  const url = URL.createObjectURL(await res.blob())
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export const api = {
  signup: (input) => send('/api/auth/signup', { method: 'POST', body: input, auth: false }),
  signin: (input) => send('/api/auth/signin', { method: 'POST', body: input, auth: false }),
  verifyEmail: (userId, code) =>
    send('/api/auth/verify-email', { method: 'POST', body: { userId, code }, auth: false }),
  resendVerification: (email) =>
    send('/api/auth/resend-verification', { method: 'POST', body: { email }, auth: false }),
  forgotPassword: (email) =>
    send('/api/auth/forgot-password', { method: 'POST', body: { email }, auth: false }),
  resetPassword: ({ email, code, password, confirm }) =>
    send('/api/auth/reset-password', {
      method: 'POST',
      body: { email, code, password, confirm },
      auth: false,
    }),
  me: () => send('/api/auth/me'),
  updateProfile: (input) => send('/api/auth/me', { method: 'PATCH', body: input }),
  uploadAvatar: (file) => {
    const form = new FormData()
    form.append('avatar', file)
    return send('/api/auth/me/avatar', { method: 'POST', form })
  },
  removeAvatar: () => send('/api/auth/me/avatar', { method: 'DELETE' }),
  changePassword: ({ currentPassword, newPassword }) =>
    send('/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    }),
  logout: () => send('/api/auth/logout', { method: 'POST', body: { refreshToken: tokens.refresh() } }),

  listSessions: () => send('/api/account/sessions'),
  revokeSession: (id) => send(`/api/account/sessions/${id}`, { method: 'DELETE' }),
  revokeOtherSessions: () => send('/api/account/sessions/revoke-others', { method: 'POST' }),

  listCloudProviders: () => send('/api/cloud-accounts/providers'),
  listCloudAccounts: () => send('/api/cloud-accounts'),
  addCloudAccount: (input) => send('/api/cloud-accounts', { method: 'POST', body: input }),
  deleteCloudAccount: (id) => send(`/api/cloud-accounts/${id}`, { method: 'DELETE' }),
  syncCloudAccount: (id) => send(`/api/cloud-accounts/${id}/sync`, { method: 'POST' }),
  getCostOverview: () => send('/api/costs/overview'),
  downloadCostReport: () => download('/api/costs/export'),
  getResources: () => send('/api/resources'),
}
