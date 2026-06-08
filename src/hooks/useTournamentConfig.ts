/**
 * useTournamentConfig — a live read of the global `config/tournament` doc (ticket 019).
 *
 * Subscribes via `onSnapshot` and maps the two cutoff `Timestamp`s to ms-epoch numbers the
 * UI/lock math consume (`TournamentCutoffsMs`). The doc is admin-SDK-written (two-writers
 * rule) and read-only for the browser; until it exists, `cutoffs` is `undefined` (the lock
 * helper then falls back to the per-match kickoff). The listener is cleaned up on unmount.
 */
import { useEffect, useState } from 'react'
import { onSnapshot } from 'firebase/firestore'
import { tournamentConfigDoc } from '../firebase/db'
import type { TournamentCutoffsMs } from '../shared/predictionLock'

export interface UseTournamentConfigResult {
  /** The two strict-window cutoffs in ms; `undefined` until `config/tournament` exists. */
  cutoffs?: TournamentCutoffsMs
  /** True until the first snapshot (or error) resolves. */
  loading: boolean
}

export function useTournamentConfig(): UseTournamentConfigResult {
  const [cutoffs, setCutoffs] = useState<TournamentCutoffsMs | undefined>(undefined)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onSnapshot(
      tournamentConfigDoc(),
      (snap) => {
        const data = snap.data()
        if (data) {
          setCutoffs({
            firstCupMatchKickoffMs: data.firstCupMatchKickoff.toMillis(),
            firstKnockoutKickoffMs: data.firstKnockoutKickoff.toMillis(),
          })
        } else {
          setCutoffs(undefined)
        }
        setLoading(false)
      },
      () => {
        // Read failure (offline/rules) — treat as not-yet-known; lazy fallback applies.
        setCutoffs(undefined)
        setLoading(false)
      },
    )
    return unsubscribe
  }, [])

  return { cutoffs, loading }
}

export default useTournamentConfig
