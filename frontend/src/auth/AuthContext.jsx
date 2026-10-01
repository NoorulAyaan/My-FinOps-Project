import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, tokens } from '@/api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // 'loading' until the stored token has been checked, so a protected route
  // does not bounce a signed-in user to /login on the first render.
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    let cancelled = false

    async function restore() {
      if (!tokens.access()) {
        setStatus('anonymous')
        return
      }
      try {
        const { user: me } = await api.me()
        if (!cancelled) {
          setUser(me)
          setStatus('authenticated')
        }
      } catch {
        if (!cancelled) {
          tokens.clear()
          setStatus('anonymous')
        }
      }
    }

    restore()
    return () => {
      cancelled = true
    }
  }, [])

  const adoptSession = useCallback((session) => {
    tokens.set(session)
    setUser(session.user)
    setStatus('authenticated')
  }, [])

  // Lets the settings page push a fresh profile (name, avatar, timezone) back
  // into the header without a full re-authentication.
  const updateUser = useCallback((next) => {
    setUser((current) => ({ ...current, ...next }))
  }, [])

  const signOut = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      // Revoking server-side is best effort; the local session goes either way.
    }
    tokens.clear()
    setUser(null)
    setStatus('anonymous')
  }, [])

  const value = useMemo(
    () => ({ user, status, adoptSession, updateUser, signOut }),
    [user, status, adoptSession, updateUser, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.')
  return context
}
