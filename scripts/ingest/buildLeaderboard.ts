// Pure leaderboard aggregation — operates on a SINGLE group's data.
//
// Takes every GRADED prediction for one group plus that group's participant set
// (the uid→displayName profiles of its approved members + implicit owner) and
// produces a dense-ranked array of leaderboard rows. No I/O — fully
// unit-testable offline. The orchestrator calls this once per `groups/{gid}`.
//
// Tiebreakers (in order): totalPoints DESC → exactCount DESC → outcomeCount DESC
// → joinedAtMs ASC (earliest participant first, stable). Ranking is DENSE: equal
// rows share a rank and the next distinct row increments by one (1,1,2 — not 1,1,3).

import type { ScoreBreakdown } from '../../src/shared/scoring.ts'

/** Minimal slice of a prediction needed to aggregate the board. */
export interface GradedPrediction {
  uid: string
  /** Total awarded points; undefined/null means not yet graded → ignored. */
  points?: number | null
  breakdown?: ScoreBreakdown | null
}

/**
 * Minimal participant profile slice. The participant set for a group is its
 * approved members (`groups/{gid}/members` where status==='approved') UNION the
 * implicit owner (`groups/{gid}.ownerUid`, who has no member doc).
 */
export interface ParticipantProfile {
  uid: string
  displayName: string
  photoURL?: string | null
  /** When this participant joined (ms since epoch) — final leaderboard tie-break. */
  joinedAtMs: number
}

/** A computed leaderboard row (mirrors `LeaderboardEntry`, minus `updatedAt`). */
export interface LeaderboardRow {
  uid: string
  displayName: string
  photoURL: string | null
  totalPoints: number
  exactCount: number
  outcomeCount: number
  predictionsGraded: number
  rank: number
  /** When this participant joined (ms since epoch) — final tie-break key. */
  joinedAtMs: number
}

function isGraded(p: GradedPrediction): boolean {
  return typeof p.points === 'number'
}

/**
 * Aggregate one group's graded predictions into dense-ranked leaderboard rows.
 *
 * Every participant in `participants` gets a row (even with zero graded
 * predictions), so the board is complete. Predictions whose uid is not in the
 * participant set are skipped — e.g. an ex-member whose predictions linger, or a
 * uid that belongs only to a DIFFERENT group, guaranteeing cross-group isolation.
 */
export function buildLeaderboard(
  predictions: GradedPrediction[],
  participants: ParticipantProfile[],
): LeaderboardRow[] {
  const byUid = new Map<string, LeaderboardRow>()

  for (const u of participants) {
    byUid.set(u.uid, {
      uid: u.uid,
      displayName: u.displayName,
      photoURL: u.photoURL ?? null,
      totalPoints: 0,
      exactCount: 0,
      outcomeCount: 0,
      predictionsGraded: 0,
      rank: 0,
      joinedAtMs: u.joinedAtMs,
    })
  }

  for (const p of predictions) {
    if (!isGraded(p)) continue
    const row = byUid.get(p.uid)
    if (!row) continue // prediction for an unknown/removed user — skip.

    row.totalPoints += p.points ?? 0
    row.predictionsGraded += 1
    if (p.breakdown) {
      if (p.breakdown.exact > 0) row.exactCount += 1
      else if (p.breakdown.outcome > 0) row.outcomeCount += 1
    }
  }

  const rows = [...byUid.values()].sort(compareRows)

  // Dense ranking.
  let rank = 0
  let prev: LeaderboardRow | undefined
  for (const row of rows) {
    if (!prev || !tied(prev, row)) rank += 1
    row.rank = rank
    prev = row
  }

  return rows
}

/** Two rows are tied iff their ranking keys (excluding name) are equal. */
function tied(a: LeaderboardRow, b: LeaderboardRow): boolean {
  return (
    a.totalPoints === b.totalPoints &&
    a.exactCount === b.exactCount &&
    a.outcomeCount === b.outcomeCount
  )
}

function compareRows(a: LeaderboardRow, b: LeaderboardRow): number {
  if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
  if (b.exactCount !== a.exactCount) return b.exactCount - a.exactCount
  if (b.outcomeCount !== a.outcomeCount) return b.outcomeCount - a.outcomeCount
  // Final tie-break: earliest joiner first.
  return a.joinedAtMs - b.joinedAtMs
}
