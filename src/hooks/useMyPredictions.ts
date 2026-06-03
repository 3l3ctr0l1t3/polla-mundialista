/**
 * useMyPredictions — a real-time map of the signed-in participant's predictions.
 *
 * Subscribes via `onSnapshot` to `predictions where uid == me` and returns a
 * `Record<matchId, Prediction>` so a page can prefill each match's input in O(1).
 * The listener is cleaned up on unmount and whenever the signed-in uid changes.
 *
 * Read-only: this hook never writes. Writes happen in `PredictionInput` (the owning
 * client writes only its own prediction, pre-kickoff — two-writers rule).
 */
import { useEffect, useState } from 'react'
import { onSnapshot, query, where } from 'firebase/firestore'
import { predictionsCol } from '../firebase/db'
import { useAuth } from '../auth/useAuth'
import type { Prediction } from '../shared/types'

export interface MyPredictions {
  /** Predictions keyed by `matchId`. */
  predictions: Record<string, Prediction>
  loading: boolean
  error: Error | null
}

export function useMyPredictions(): MyPredictions {
  const { user } = useAuth()
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!user) {
      setPredictions({})
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    const q = query(predictionsCol, where('uid', '==', user.uid))
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
  }, [user])

  return { predictions, loading, error }
}

export default useMyPredictions
