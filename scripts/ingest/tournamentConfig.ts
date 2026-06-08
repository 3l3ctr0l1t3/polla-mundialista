// Compute the global `config/tournament` cutoffs the strict-mode security rules
// depend on (ticket 019). PURE — no I/O, no clock, no randomness.
//
// The admin `Timestamp` class imports WITHOUT initializing an app or credentials
// (mapMatch.ts does the same), so this module is fully unit-testable offline.

import { Timestamp } from 'firebase-admin/firestore'
import type { MatchDoc } from './mapMatch.ts'

export interface TournamentCutoffs {
  /** Kickoff of the first GROUP_STAGE match (the cup's first match). */
  firstCupMatchKickoff: Timestamp
  /** Kickoff of the first LAST_32 (knockout) match. */
  firstKnockoutKickoff: Timestamp
}

/** The earliest match (by kickoff) for a given stage, or undefined if absent. */
function earliestKickoff(matches: MatchDoc[], stage: MatchDoc['stage']): Timestamp | undefined {
  let best: Timestamp | undefined
  for (const m of matches) {
    if (m.stage !== stage) continue
    if (best === undefined || m.kickoff.toMillis() < best.toMillis()) {
      best = m.kickoff
    }
  }
  return best
}

/**
 * Earliest GROUP_STAGE kickoff and earliest LAST_32 kickoff across the matches.
 * Returns the actual admin `Timestamp` objects of those earliest matches.
 * Omits a stage that has no matches yet (so callers can skip writing it).
 */
export function computeTournamentCutoffs(matches: MatchDoc[]): Partial<TournamentCutoffs> {
  const cutoffs: Partial<TournamentCutoffs> = {}

  const firstCupMatchKickoff = earliestKickoff(matches, 'GROUP_STAGE')
  if (firstCupMatchKickoff) cutoffs.firstCupMatchKickoff = firstCupMatchKickoff

  const firstKnockoutKickoff = earliestKickoff(matches, 'LAST_32')
  if (firstKnockoutKickoff) cutoffs.firstKnockoutKickoff = firstKnockoutKickoff

  return cutoffs
}
