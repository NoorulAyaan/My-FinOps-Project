import { useCallback, useEffect, useState } from 'react'
import { api } from '@/api/client'

/**
 * Loads the aggregated cost overview (KPIs, 30-day series, per-service
 * breakdown) from /api/costs/overview. Refetch after every sync so the
 * dashboard reflects the latest ingestion run.
 */
export function useCostOverview() {
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.getCostOverview()
      setOverview(res.overview)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { overview, loading, error, reload }
}
