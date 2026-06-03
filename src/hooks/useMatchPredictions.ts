/**
 * useMatchPredictions — everyone's predictions for ONE match, revealed at kickoff (ticket 013).
 *
 * The classic polla "reveal at kickoff": before a match starts, a member may read only
 * their OWN prediction; once `request.time >= match.kickoff` the group may read everyone's.
 * That gate is authoritative in `firestore.rules` — so a query for ALL members' predictions
 * is rules-legal ONLY after kickoff. Accordingly this hook subscribes only when the caller
 * passes `enabled === true` (the caller compares `match.kickoff` to server time). Before
 * kickoff it stays idle and returns an empty list (the UI shows a "reveals at kickoff"
 * placeholder instead).
 *
 * The query is equality-only (`where matchId == <id>`) so it needs NO composite index;
 * results are sorted client-side. READ-ONLY via `onSnapshot`; torn down on unmount /
 * gid / matchId / enabled change.
 */
import { useEffect, useState } from 'react'
import { onSnapshot, query, where } from 'firebase/firestore'
import { groupPredictionsCol } from '../firebase/db'
import type { Prediction } from '../shared/types'

export interface UseMatchPredictionsResult {
  /** All members' predictions for the match, sorted client-side. Empty until enabled. */
  predictions: Prediction[]
  /** True while the first post-kickoff snapshot resolves; false when disabled. */
  loading: boolean
  error: Error | null
}

export function useMatchPredictions(
  gid: string,
  matchId: string,
  enabled: boolean,
): UseMatchPredictionsResult {
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // Do NOT query others' predictions before kickoff — the rules would deny it.
    if (!gid || !matchId || !enabled) {
      setPredictions([])
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    // Equality-only filter -> no composite index needed; sort client-side.
    const q = query(groupPredictionsCol(gid), where('matchId', '==', matchId))
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((d) => d.data())
        next.sort((a, b) => {
          if (b.homeGoals !== a.homeGoals) return b.homeGoals - a.homeGoals
          return b.awayGoals - a.awayGoals
        })
        setPredictions(next)
        setError(null)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
    return unsubscribe
  }, [gid, matchId, enabled])

  return { predictions, loading, error }
}

export default useMatchPredictions
