/**
 * predictionLock — the SINGLE client-side mirror of the `firestore.rules` prediction lock
 * formula (ticket 019). Pure: no React, no Firebase SDK — it only depends on the
 * `Match`/`Group`/`PredictionMode` types.
 *
 * The lock is authoritatively enforced server-side in `firestore.rules`; this module exists
 * so the UI (countdown chip + `useSavePrediction`'s `locked` flag) computes the SAME instant
 * the rules do, without duplicating the −10min math anywhere else. Whenever the lock formula
 * changes, change it here AND in the rules in lockstep.
 *
 *   - **Lazy** (or absent mode): a prediction locks 10 min before THAT match's kickoff.
 *   - **Strict**: all group-stage picks lock 10 min before the first cup match; all knockout
 *     picks lock 10 min before the first knockout match (independent of the match's own kickoff).
 *     If the strict cutoffs aren't known yet, we fall back to the lazy formula.
 */
import type { Match, Group, PredictionMode } from './types'

/** Uniform pre-kickoff buffer (10 minutes) applied in BOTH modes — matches the rules. */
export const LOCK_BUFFER_MS = 10 * 60 * 1000

/** The two tournament cutoffs (ms epoch) that drive the strict windows. */
export interface TournamentCutoffsMs {
  firstCupMatchKickoffMs: number
  firstKnockoutKickoffMs: number
}

/** The group's effective mode — absent ⇒ `'lazy'` (back-compat; no backfill). */
export function effectiveMode(group: Pick<Group, 'mode'>): PredictionMode {
  return group.mode ?? 'lazy'
}

/**
 * The instant (ms epoch) a prediction for `match` locks, given the group's mode + cutoffs.
 * Strict without known cutoffs falls back to the lazy formula (`kickoff − buffer`).
 */
export function lockTimeMs(
  match: Pick<Match, 'kickoff' | 'stage'>,
  mode: PredictionMode,
  cutoffs?: TournamentCutoffsMs,
): number {
  if (mode === 'strict' && cutoffs) {
    const base =
      match.stage === 'GROUP_STAGE'
        ? cutoffs.firstCupMatchKickoffMs
        : cutoffs.firstKnockoutKickoffMs
    return base - LOCK_BUFFER_MS
  }
  return match.kickoff.toMillis() - LOCK_BUFFER_MS
}
