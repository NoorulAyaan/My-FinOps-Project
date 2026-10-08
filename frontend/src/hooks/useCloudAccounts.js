import { useCallback, useEffect, useState } from 'react'
import { api } from '@/api/client'

/**
 * Loads the signed-in user's cloud connections and exposes syncAccount, which
 * triggers a cost ingestion run for one account and returns its updated state.
 */
export function useCloudAccounts() {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.listCloudAccounts()
      setAccounts(res.accounts)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const addAccount = useCallback(async (input) => {
    const { account } = await api.addCloudAccount(input)
    setAccounts((list) => [account, ...list])
    return account
  }, [])

  const removeAccount = useCallback(async (id) => {
    await api.deleteCloudAccount(id)
    setAccounts((list) => list.filter((a) => a.id !== id))
  }, [])

  // Returns the full sync payload ({ account, records, cached, error, ... })
  // so callers can distinguish a fresh pull, a cooldown-served cached response
  // and an ingestion failure — the API reports failures as 200 + { error }.
  const syncAccount = useCallback(async (id, opts) => {
    const payload = await api.syncCloudAccount(id, opts)
    if (payload.account) {
      setAccounts((list) => list.map((a) => (a.id === id ? payload.account : a)))
    }
    return payload
  }, [])

  return { accounts, loading, error, reload, addAccount, removeAccount, syncAccount }
}
