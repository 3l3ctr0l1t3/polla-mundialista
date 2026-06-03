/**
 * useMatches — live World Cup fixtures from Firestore.
 *
 * Subscribes to the `matches` collection via `onSnapshot` (ticket 004) and returns
 * the matches sorted ascending by kickoff. The listener is cleaned up on unmount.
 *
 * Live data only: until the ingestion job (ticket 008) seeds Firestore, this resolves
 * to an empty array (the page then shows its Empty state). Sample data is never wired
 * in here — see `src/dev/sampleData.ts`, used only by tests.
 */
import { useEffect, useState } from 'react'
import { onSnapshot, orderBy, query } from 'firebase/firestore'
import { matchesCol } from '../firebase/db'
import type { Match } from '../shared/types'

export interface UseMatchesResult {
  /** Matches sorted ascending by kickoff. Empty until seeding (ticket 008). */
  matches: Match[]
  loading: boolean
  error: Error | null
}

/**
 * A `dayjs`-free, stable kickoff comparator. Firestore `Timestamp` exposes
 * `toMillis()`; we sort on that to avoid trusting document order.
 */
function byKickoff(a: Match, b: Match): number {
  return a.kickoff.toMillis() - b.kickoff.toMillis()
}

export function useMatches(): UseMatchesResult {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // Order server-side by kickoff; re-sort client-side defensively too.
    const q = query(matchesCol, orderBy('kickoff', 'asc'))
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((d) => d.data()).sort(byKickoff)
        setMatches(next)
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

  return { matches, loading, error }
}

export default useMatches
