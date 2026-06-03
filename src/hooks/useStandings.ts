/**
 * useStandings — live group tables from Firestore.
 *
 * Subscribes to the `standings` collection via `onSnapshot` (ticket 004) and returns
 * the group documents sorted by `groupId` (A–L). The listener is cleaned up on unmount.
 *
 * Live data only: empty until ingestion (ticket 008) seeds Firestore.
 */
import { useEffect, useState } from 'react'
import { onSnapshot, orderBy, query } from 'firebase/firestore'
import { standingsCol } from '../firebase/db'
import type { Standing } from '../shared/types'

export interface UseStandingsResult {
  /** Group tables sorted by groupId (A–L). Empty until seeding (ticket 008). */
  standings: Standing[]
  loading: boolean
  error: Error | null
}

export function useStandings(): UseStandingsResult {
  const [standings, setStandings] = useState<Standing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const q = query(standingsCol, orderBy('groupId', 'asc'))
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs
          .map((d) => d.data())
          .sort((a, b) => a.groupId.localeCompare(b.groupId))
        setStandings(next)
        setError(null)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
    return unsubscribe
  }, [])

  return { standings, loading, error }
}

export default useStandings
