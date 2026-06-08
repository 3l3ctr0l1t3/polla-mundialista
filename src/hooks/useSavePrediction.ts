/**
 * useSavePrediction — the ONE per-group prediction write path (extracted from the old
 * `PredictionInput`, ticket 018).
 *
 * Owns the home/away goal state (synced to the user's saved `existing` prediction), the
 * server-corrected kickoff `locked` flag, and `save()`, which writes ONLY the signed-in
 * user's own per-group prediction via
 * `setDoc(groupPredictionDoc(gid, uid, matchId), {...}, { merge: true })`:
 *   - `uid`, `matchId`, `homeGoals`, `awayGoals` always,
 *   - `updatedAt: serverTimestamp()` always,
 *   - `createdAt: serverTimestamp()` ONLY when the prediction is new.
 * It never writes `points`/`breakdown` (ingestion-only — two-writers rule).
 *
 * Inputs are disabled at/after kickoff using the server-corrected clock (`now()`); the
 * authoritative gate is `firestore.rules`. A rules-rejected late write (`permission-denied`)
 * surfaces a "match already started" snackbar so the UI degrades honestly when the device
 * clock disagreed with the server.
 */
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { setDoc, serverTimestamp } from 'firebase/firestore'
import { groupPredictionDoc } from '../firebase/db'
import { useAuth } from '../auth/useAuth'
import { lockTimeMs, type TournamentCutoffsMs } from '../shared/predictionLock'
import type { Match, Prediction, PredictionMode } from '../shared/types'

export interface SaveSnack {
  message: string
  severity: 'success' | 'error'
}

export interface UseSavePrediction {
  homeGoals: number
  awayGoals: number
  setHomeGoals: (n: number) => void
  setAwayGoals: (n: number) => void
  /**
   * True once `now() >= lockTimeMs(match, mode, cutoffs)` (server-corrected) — i.e. the
   * mode-aware lock instant (10 min before kickoff/window). The rule is the real gate.
   */
  locked: boolean
  /** True when there's no saved prediction yet, or the values differ from the saved one. */
  dirty: boolean
  saving: boolean
  snack: SaveSnack | null
  dismissSnack: () => void
  save: () => Promise<void>
}

/** Clamp arbitrary input to a non-negative integer. */
export function toGoals(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

export function useSavePrediction(
  gid: string,
  match: Match,
  existing: Prediction | undefined,
  now: () => number,
  mode: PredictionMode = 'lazy',
  cutoffs?: TournamentCutoffsMs,
): UseSavePrediction {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [homeGoals, setHomeGoals] = useState<number>(existing?.homeGoals ?? 0)
  const [awayGoals, setAwayGoals] = useState<number>(existing?.awayGoals ?? 0)
  const [saving, setSaving] = useState(false)
  const [snack, setSnack] = useState<SaveSnack | null>(null)

  // Keep local state in sync when a prediction arrives/changes from the snapshot.
  useEffect(() => {
    setHomeGoals(existing?.homeGoals ?? 0)
    setAwayGoals(existing?.awayGoals ?? 0)
  }, [existing?.homeGoals, existing?.awayGoals])

  const locked = now() >= lockTimeMs(match, mode, cutoffs)

  // Saveable only when there's a real change: no saved prediction yet (a first save —
  // including a deliberate 0–0 — is allowed) or the values differ from what's saved.
  const dirty =
    !existing ||
    toGoals(homeGoals) !== existing.homeGoals ||
    toGoals(awayGoals) !== existing.awayGoals

  const dismissSnack = useCallback(() => setSnack(null), [])

  const save = useCallback(async () => {
    if (!user || locked) return
    setSaving(true)
    try {
      const ref = groupPredictionDoc(gid, user.uid, match.matchId)
      // `createdAt` only on first write; `updatedAt` always. Never points/breakdown.
      const payload: Partial<Prediction> = {
        uid: user.uid,
        matchId: match.matchId,
        homeGoals: toGoals(homeGoals),
        awayGoals: toGoals(awayGoals),
        updatedAt: serverTimestamp() as unknown as Prediction['updatedAt'],
      }
      if (!existing) {
        payload.createdAt = serverTimestamp() as unknown as Prediction['createdAt']
      }
      await setDoc(ref, payload, { merge: true })
      setSnack({ message: t('predictions.saved'), severity: 'success' })
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'permission-denied') {
        setSnack({ message: t('predictions.lockedError'), severity: 'error' })
      } else {
        setSnack({ message: t('predictions.saveError'), severity: 'error' })
      }
    } finally {
      setSaving(false)
    }
  }, [user, locked, gid, match.matchId, homeGoals, awayGoals, existing, t])

  return {
    homeGoals,
    awayGoals,
    setHomeGoals,
    setAwayGoals,
    locked,
    dirty,
    saving,
    snack,
    dismissSnack,
    save,
  }
}

export default useSavePrediction
