/**
 * useGroupPredictions — the signed-in participant's predictions WITHIN a group (ticket 012).
 *
 * Subscribes via `onSnapshot` to `groups/{gid}/predictions where uid == me` and returns a
 * `Record<matchId, Prediction>` so a page can prefill each match's input in O(1). The
 * listener is cleaned up on unmount and whenever the gid or signed-in uid changes.
 *
 * Read-only: this hook never writes. Writes happen in `PredictionInput` (the owning client
 * writes only its own prediction, pre-kickoff — two-writers rule).
 */
import { useEffect, useState } from 'react'
import { onSnapshot, query, where } from 'firebase/firestore'
import { groupPredictionsCol } from '../firebase/db'
import { useAuth } from '../auth/useAuth'
import type { Prediction } from '../shared/types'

export interface GroupPredictions {
  /** Predictions keyed by `matchId`. */
  predictions: Record<string, Prediction>
  loading: boolean
  error: Error | null
}

export function useGroupPredictions(gid: string): GroupPredictions {
  const { user } = useAuth()
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!user || !gid) {
      setPredictions({})
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    const q = query(groupPredictionsCol(gid), where('uid', '==', user.uid))
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const next: Record<string, Prediction> = {}
        snap.forEach((d) => {
          const p = d.data()
          next[p.matchId] = p
        })
        setPredictions(next)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )

    return unsubscribe
  }, [gid, user])

  return { predictions, loading, error }
}

export default useGroupPredictions
