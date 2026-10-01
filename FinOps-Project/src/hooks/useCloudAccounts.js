import { useCallback, useEffect, useState } from 'react'
import { api } from '@/api/client'

/**
 * Loads the signed-in user's cloud connections. Cost figures are not fetched
 * yet — there is no cost puller in this stage, so `accounts` is the only real
 * data the dashboard has and every panel stays in its empty state until one
 * exists.
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

  return { accounts, loading, error, reload, addAccount, removeAccount }
}
