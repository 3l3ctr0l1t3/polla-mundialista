/**
 * useLeaderboard — live read of the `leaderboard/{uid}` collection (ticket 007).
 *
 * Subscribes to the typed `leaderboardCol` ordered by `totalPoints` descending via
 * an `onSnapshot` real-time listener, so the page re-ranks automatically after each
 * ingestion run writes fresh aggregates. The listener is torn down on unmount.
 *
 * This hook is READ-ONLY: the leaderboard documents are produced solely by the
 * ingestion service account (`buildLeaderboard`, ticket 008) per the two-writers rule.
 * Raw predictions are never read here — only the public aggregate.
 */
import { useEffect, useState } from 'react'
import { onSnapshot, orderBy, query } from 'firebase/firestore'
import { leaderboardCol } from '../firebase/db'
import type { LeaderboardEntry } from '../shared/types'

export interface UseLeaderboardResult {
  /** Entries ordered by totalPoints desc. Empty until ingestion writes aggregates. */
  entries: LeaderboardEntry[]
  /** True until the first snapshot (success or error) resolves. */
  loading: boolean
  /** Set when the listener errors (e.g. permission denied); null otherwise. */
  error: Error | null
}

/**
 * Live leaderboard ordered by total points (desc). Ties are resolved for display
 * by the consuming UI using the persisted `rank` field. Returns loading/error flags.
 */
export function useLeaderboard(): UseLeaderboardResult {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const q = query(leaderboardCol, orderBy('totalPoints', 'desc'))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setEntries(snapshot.docs.map((d) => d.data()))
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

  return { entries, loading, error }
}

export default useLeaderboard
