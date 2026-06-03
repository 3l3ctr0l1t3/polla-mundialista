/**
 * useGroupLeaderboard — live read of a group's `leaderboard` collection (ticket 012).
 *
 * Subscribes to `groups/{gid}/leaderboard` ordered by `totalPoints` descending via an
 * `onSnapshot` real-time listener, so the page re-ranks automatically after each ingestion
 * run writes fresh per-group aggregates. The listener is torn down on unmount / gid change.
 *
 * This hook is READ-ONLY: the leaderboard documents are produced solely by the ingestion
 * service account per the two-writers rule. Raw predictions are never read here — only the
 * aggregate, which only that group's members may read.
 */
import { useEffect, useState } from 'react'
import { onSnapshot, orderBy, query } from 'firebase/firestore'
import { groupLeaderboardCol } from '../firebase/db'
import type { LeaderboardEntry } from '../shared/types'

export interface UseGroupLeaderboardResult {
  /** Entries ordered by totalPoints desc. Empty until ingestion writes aggregates. */
  entries: LeaderboardEntry[]
  /** True until the first snapshot (success or error) resolves. */
  loading: boolean
  /** Set when the listener errors (e.g. permission denied); null otherwise. */
  error: Error | null
}

export function useGroupLeaderboard(gid: string): UseGroupLeaderboardResult {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!gid) {
      setEntries([])
      setLoading(false)
      return
    }
    setLoading(true)
    const q = query(groupLeaderboardCol(gid), orderBy('totalPoints', 'desc'))
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
  }, [gid])

  return { entries, loading, error }
}

export default useGroupLeaderboard
