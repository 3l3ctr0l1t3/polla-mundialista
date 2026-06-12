// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  buildLeaderboard,
  type GradedPrediction,
  type ParticipantProfile,
} from './buildLeaderboard.ts'
import { mapMatch } from './mapMatch.ts'
import { scorePrediction, mergeScoring, DEFAULT_SCORING, type Scoreline } from './scoring.ts'
import type { FdMatchesResponse, FdMatch } from './types.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sample = JSON.parse(
  readFileSync(resolve(__dirname, 'sample/matches.json'), 'utf8'),
) as FdMatchesResponse

const matchById = (id: number): FdMatch => {
  const m = sample.matches.find((x) => x.id === id)
  if (!m) throw new Error(`fixture missing match ${id}`)
  return m
}

/** Actual full-time scoreline for a FINISHED fixture (via the mapper). */
function actualOf(id: number): Scoreline {
  const doc = mapMatch(matchById(id))
  return { home: doc.score.home as number, away: doc.score.away as number }
}

/** Grade a raw prediction with the REAL shared engine and shape it for the board. */
function graded(uid: string, matchId: number, pred: Scoreline): GradedPrediction {
  const { points, breakdown } = scorePrediction(pred, actualOf(matchId))
  return { uid, matchId: String(matchId), points, breakdown }
}

// Finished fixtures: 500001 = 2-1 (home), 500002 = 1-1 (draw), 500003 = 0-2 (away).
// The shared denominator for the main dataset below: these three finished matches.
const FINISHED_IDS: ReadonlySet<string> = new Set(['500001', '500002', '500003'])

const users: ParticipantProfile[] = [
  { uid: 'u_ana', displayName: 'Ana', photoURL: null, joinedAtMs: 1000 },
  { uid: 'u_beto', displayName: 'Beto', photoURL: 'https://x/b.png', joinedAtMs: 2000 },
  { uid: 'u_caro', displayName: 'Caro', photoURL: null, joinedAtMs: 3000 },
  { uid: 'u_dani', displayName: 'Dani', photoURL: null, joinedAtMs: 4000 },
  { uid: 'u_zoe', displayName: 'Zoe', photoURL: null, joinedAtMs: 5000 }, // no predictions
]

describe('buildLeaderboard (real scoring engine + sample)', () => {
  it('aggregates totals, exact/outcome counts, and dense-ranks with tiebreakers', () => {
    // NOTE: with DEFAULT_SCORING the goal-diff bonus is additive and an exact
    // scoreline always has the correct gd, so an EXACT hit is 5 + 1 = 6 points.
    const predictions: GradedPrediction[] = [
      // Ana: two exact (6+6) + outcome-only (3).
      graded('u_ana', 500001, { home: 2, away: 1 }), // exact → 6
      graded('u_ana', 500002, { home: 1, away: 1 }), // exact → 6
      graded('u_ana', 500003, { home: 1, away: 2 }), // away win, gd -1 ≠ -2 → outcome 3
      // Beto: 1 exact + outcome+bonus + outcome-only.
      graded('u_beto', 500001, { home: 3, away: 2 }), // home win, gd +1 == +1 → 3 + 1 = 4
      graded('u_beto', 500002, { home: 1, away: 1 }), // exact → 6
      graded('u_beto', 500003, { home: 0, away: 1 }), // away win, gd -1 ≠ -2 → outcome 3
      // Caro: one outcome+bonus.
      graded('u_caro', 500001, { home: 1, away: 0 }), // home win, gd +1 == +1 → 3 + 1 = 4
      // Dani: a clean miss → 0 points.
      graded('u_dani', 500003, { home: 3, away: 0 }), // home win vs away win → 0
    ]

    const board = buildLeaderboard(predictions, users, FINISHED_IDS)

    const get = (uid: string) => board.find((r) => r.uid === uid)!

    // --- Totals via the real engine (unchanged by ticket 034 — missing picks add 0) ---
    expect(get('u_ana').totalPoints).toBe(15) // 6 + 6 + 3
    expect(get('u_beto').totalPoints).toBe(13) // 4 + 6 + 3
    expect(get('u_caro').totalPoints).toBe(4) // outcome 3 + gd 1
    expect(get('u_dani').totalPoints).toBe(0)
    expect(get('u_zoe').totalPoints).toBe(0)

    // --- Counts: exact/outcome come from real picks; predictionsGraded is the
    //     SHARED denominator (3 finished matches) for EVERYONE (ticket 034). ---
    expect(get('u_ana')).toMatchObject({ exactCount: 2, outcomeCount: 1, predictionsGraded: 3 })
    expect(get('u_beto')).toMatchObject({ exactCount: 1, outcomeCount: 2, predictionsGraded: 3 })
    expect(get('u_caro')).toMatchObject({ exactCount: 0, outcomeCount: 1, predictionsGraded: 3 })
    expect(get('u_dani')).toMatchObject({ exactCount: 0, outcomeCount: 0, predictionsGraded: 3 })
    expect(get('u_zoe')).toMatchObject({ exactCount: 0, outcomeCount: 0, predictionsGraded: 3 })

    // --- Dense ranks (1,2,3,4,4) ---
    expect(get('u_ana').rank).toBe(1) // 13
    expect(get('u_beto').rank).toBe(2) // 12
    expect(get('u_caro').rank).toBe(3) // 4
    expect(get('u_dani').rank).toBe(4) // 0, tie with Zoe
    expect(get('u_zoe').rank).toBe(4) // 0, tie with Dani

    // --- Order matches rank, then name for ties ---
    expect(board.map((r) => r.uid)).toEqual(['u_ana', 'u_beto', 'u_caro', 'u_dani', 'u_zoe'])
  })

  it('breaks points ties by exactCount, then outcomeCount, then joinedAt', () => {
    // Two users, identical 12 points, differ on exactCount.
    const predictions: GradedPrediction[] = [
      // Higher: two exact (6 + 6) = 12, exactCount 2.
      graded('u_high', 500001, { home: 2, away: 1 }), // exact → 6
      graded('u_high', 500002, { home: 1, away: 1 }), // exact → 6
      // Lower: three outcome+bonus (4 + 4 + 4) = 12, exactCount 0.
      graded('u_low', 500001, { home: 3, away: 2 }), // home win, gd +1 == +1 → 4
      graded('u_low', 500002, { home: 2, away: 2 }), // draw, gd 0 == 0 → 4
      graded('u_low', 500003, { home: 1, away: 3 }), // away win, gd -2 == -2 → 4
    ]
    const board = buildLeaderboard(
      predictions,
      [
        { uid: 'u_low', displayName: 'Aaron', photoURL: null, joinedAtMs: 100 }, // earliest, but loses on exact
        { uid: 'u_high', displayName: 'Zane', photoURL: null, joinedAtMs: 999 },
      ],
      FINISHED_IDS,
    )
    expect(board.find((r) => r.uid === 'u_high')!.totalPoints).toBe(12)
    expect(board.find((r) => r.uid === 'u_low')!.totalPoints).toBe(12)
    // Exact-count tiebreaker wins over the join-time tiebreaker.
    expect(board.map((r) => r.uid)).toEqual(['u_high', 'u_low'])
    expect(board.find((r) => r.uid === 'u_high')!.rank).toBe(1)
    expect(board.find((r) => r.uid === 'u_low')!.rank).toBe(2)
  })

  it('breaks a full points/exact/outcome tie by earliest joinedAt (not name)', () => {
    // Two users with identical scoring keys AND identical display names: the only
    // distinguishing key is join time. The earliest joiner must rank first.
    const predictions: GradedPrediction[] = [
      graded('u_late', 500001, { home: 2, away: 1 }), // exact → 6
      graded('u_early', 500001, { home: 2, away: 1 }), // exact → 6
    ]
    const board = buildLeaderboard(
      predictions,
      [
        // Same name on purpose; u_late joined later despite sorting first by uid.
        { uid: 'u_late', displayName: 'Sam', photoURL: null, joinedAtMs: 5000 },
        { uid: 'u_early', displayName: 'Sam', photoURL: null, joinedAtMs: 1000 },
      ],
      new Set(['500001']),
    )
    expect(board.find((r) => r.uid === 'u_early')!.totalPoints).toBe(6)
    expect(board.find((r) => r.uid === 'u_late')!.totalPoints).toBe(6)
    // Earliest join wins; both share the dense rank (tie excludes join time).
    expect(board.map((r) => r.uid)).toEqual(['u_early', 'u_late'])
    expect(board.find((r) => r.uid === 'u_early')!.rank).toBe(1)
    expect(board.find((r) => r.uid === 'u_late')!.rank).toBe(1)
  })

  it('ignores ungraded predictions and predictions for unknown users', () => {
    const predictions: GradedPrediction[] = [
      { uid: 'u_ana', matchId: '500002', points: undefined }, // not graded yet
      { uid: 'u_ana', matchId: '500003', points: null }, // not graded yet
      graded('u_ghost', 500001, { home: 2, away: 1 }), // unknown user → skipped
      graded('u_ana', 500001, { home: 2, away: 1 }), // exact → 6 (5 + gd bonus 1)
    ]
    const board = buildLeaderboard(
      predictions,
      [{ uid: 'u_ana', displayName: 'Ana', photoURL: null, joinedAtMs: 1000 }],
      new Set(['500001']),
    )
    expect(board).toHaveLength(1)
    expect(board[0]).toMatchObject({ uid: 'u_ana', totalPoints: 6, predictionsGraded: 1, rank: 1 })
  })

  it('applies a per-group scoring override (round bonus) at grading time', () => {
    // 500005 is a FINISHED LAST_32 knockout fixture (1-1 draw). A group sets a
    // FINAL bonus of 10 — but LAST_32 also carries a (default 0) round bonus, so
    // override the LAST_32 bonus to prove the per-group config reaches grading.
    const SCORING_VERSION = 2 // mirrors scripts/ingest/index.ts after the 1→2 bump
    const groupCfg = mergeScoring(DEFAULT_SCORING, {
      roundBonus: { FINAL: 10, LAST_32: 7 },
    })
    const actual = actualOf(500005) // 1-1
    const stage = mapMatch(matchById(500005)).stage // 'LAST_32'

    // Exact 1-1 prediction under the override: exact 5 + gd 1 + LAST_32 bonus 7 = 13.
    const exact = scorePrediction({ home: 1, away: 1 }, actual, groupCfg, stage)
    expect(exact.points).toBe(13)
    expect(Number.isInteger(exact.points)).toBe(true)
    expect(exact.breakdown).toMatchObject({ exact: 5, outcome: 0, goalDiff: 1, roundBonus: 7 })

    // Outcome-only draw (0-0) vs 1-1: outcome 3 + gd 0==0 bonus 1 + LAST_32 bonus 7 = 11.
    const outcomeOnly = scorePrediction({ home: 0, away: 0 }, actual, groupCfg, stage)
    expect(outcomeOnly.points).toBe(11)
    expect(outcomeOnly.breakdown).toMatchObject({
      exact: 0,
      outcome: 3,
      goalDiff: 1,
      roundBonus: 7,
    })

    // A clean miss earns NO round bonus.
    const miss = scorePrediction({ home: 2, away: 0 }, actual, groupCfg, stage)
    expect(miss.points).toBe(0)
    expect(miss.breakdown.roundBonus).toBe(0)

    // The override aggregates into a leaderboard with the correct counts.
    const board = buildLeaderboard(
      [
        { uid: 'u_exact', matchId: '500005', points: exact.points, breakdown: exact.breakdown },
        {
          uid: 'u_out',
          matchId: '500005',
          points: outcomeOnly.points,
          breakdown: outcomeOnly.breakdown,
        },
      ],
      [
        { uid: 'u_exact', displayName: 'Exa', photoURL: null, joinedAtMs: 1 },
        { uid: 'u_out', displayName: 'Out', photoURL: null, joinedAtMs: 2 },
      ],
      new Set(['500005']),
    )
    expect(board.find((r) => r.uid === 'u_exact')).toMatchObject({
      totalPoints: 13,
      exactCount: 1,
      outcomeCount: 0,
    })
    expect(board.find((r) => r.uid === 'u_out')).toMatchObject({
      totalPoints: 11,
      exactCount: 0,
      outcomeCount: 1,
    })

    // The grading-version guard this path re-grades under.
    expect(SCORING_VERSION).toBe(2)
  })
})

describe('buildLeaderboard — missed prediction counts as 0 (ticket 034)', () => {
  // Three FINISHED matches form the shared denominator for the group.
  const FINISHED: ReadonlySet<string> = new Set(['500001', '500002', '500003'])

  it('rule 1 — a late joiner with no pick for a finished match counts it as 0', () => {
    // u_late joined after every match finished and has NO predictions at all.
    const participants: ParticipantProfile[] = [
      { uid: 'u_early', displayName: 'Early', photoURL: null, joinedAtMs: 1000 },
      { uid: 'u_late', displayName: 'Late', photoURL: null, joinedAtMs: 9_999_999 },
    ]
    const predictions: GradedPrediction[] = [
      graded('u_early', 500001, { home: 2, away: 1 }), // exact → 6
    ]
    const board = buildLeaderboard(predictions, participants, FINISHED)
    const late = board.find((r) => r.uid === 'u_late')!

    // The late joiner is accountable for all three finished matches at 0 points.
    expect(late.totalPoints).toBe(0)
    expect(late.exactCount).toBe(0)
    expect(late.outcomeCount).toBe(0)
    expect(late.predictionsGraded).toBe(FINISHED.size) // 3 — includes matches finished before they joined
  })

  it('rule 3 — an existing member who skipped a finished match gets +0 points and +1 graded', () => {
    // u_skip predicted only 500001 and 500002 — they SKIPPED 500003.
    const participants: ParticipantProfile[] = [
      { uid: 'u_skip', displayName: 'Skip', photoURL: null, joinedAtMs: 1000 },
    ]
    const withSkip: GradedPrediction[] = [
      graded('u_skip', 500001, { home: 2, away: 1 }), // exact → 6
      graded('u_skip', 500002, { home: 1, away: 1 }), // exact → 6
    ]
    // Baseline: the SAME member having also (hypothetically) predicted 500003 as a
    // clean miss would add 0 points — proving the skip contributes the same 0.
    const withMiss: GradedPrediction[] = [
      ...withSkip,
      graded('u_skip', 500003, { home: 3, away: 0 }), // home win vs 0-2 away win → 0
    ]

    const skipBoard = buildLeaderboard(withSkip, participants, FINISHED)
    const missBoard = buildLeaderboard(withMiss, participants, FINISHED)
    const skip = skipBoard.find((r) => r.uid === 'u_skip')!
    const miss = missBoard.find((r) => r.uid === 'u_skip')!

    // Skipping 500003 yields the same points (12) and same denominator (3) as
    // predicting it for 0 — the +1 graded comes from the finished-match count.
    expect(skip.totalPoints).toBe(12) // 6 + 6, the skipped match adds 0
    expect(skip.predictionsGraded).toBe(3)
    expect(skip.totalPoints).toBe(miss.totalPoints)
    expect(skip.predictionsGraded).toBe(miss.predictionsGraded)
  })

  it('rule 2 — predictionsGraded equals finishedMatchIds.size for every participant in a mixed dataset', () => {
    // Mix: an early full-predictor, a partial predictor, and a no-show late joiner.
    const participants: ParticipantProfile[] = [
      { uid: 'u_full', displayName: 'Full', photoURL: null, joinedAtMs: 1000 },
      { uid: 'u_partial', displayName: 'Partial', photoURL: null, joinedAtMs: 2000 },
      { uid: 'u_late', displayName: 'Late', photoURL: null, joinedAtMs: 9_999_999 },
    ]
    const predictions: GradedPrediction[] = [
      graded('u_full', 500001, { home: 2, away: 1 }),
      graded('u_full', 500002, { home: 1, away: 1 }),
      graded('u_full', 500003, { home: 0, away: 2 }),
      graded('u_partial', 500001, { home: 1, away: 0 }), // only one pick
    ]
    const board = buildLeaderboard(predictions, participants, FINISHED)

    expect(board).toHaveLength(3)
    for (const row of board) {
      expect(row.predictionsGraded).toBe(FINISHED.size)
    }
  })

  it('rule 4 — totalPoints is byte-identical to the pre-ticket aggregation on the same data', () => {
    // Same dataset as the main suite's first test. Pre-ticket, totalPoints summed
    // only real graded picks; ticket 034 adds 0 for missing picks, so the exact
    // numbers below are unchanged.
    const predictions: GradedPrediction[] = [
      graded('u_ana', 500001, { home: 2, away: 1 }), // exact → 6
      graded('u_ana', 500002, { home: 1, away: 1 }), // exact → 6
      graded('u_ana', 500003, { home: 1, away: 2 }), // outcome → 3
      graded('u_beto', 500001, { home: 3, away: 2 }), // outcome + gd → 4
      graded('u_beto', 500002, { home: 1, away: 1 }), // exact → 6
      graded('u_beto', 500003, { home: 0, away: 1 }), // outcome → 3
      graded('u_caro', 500001, { home: 1, away: 0 }), // outcome + gd → 4
      graded('u_dani', 500003, { home: 3, away: 0 }), // miss → 0
    ]
    const board = buildLeaderboard(predictions, users, FINISHED)
    const total = (uid: string) => board.find((r) => r.uid === uid)!.totalPoints

    expect(total('u_ana')).toBe(15)
    expect(total('u_beto')).toBe(13)
    expect(total('u_caro')).toBe(4)
    expect(total('u_dani')).toBe(0)
    expect(total('u_zoe')).toBe(0) // no predictions → still 0, not negative
  })

  it('rule 6 — a non-participant prediction is excluded entirely (no row, no 0s)', () => {
    const participants: ParticipantProfile[] = [
      { uid: 'u_member', displayName: 'Member', photoURL: null, joinedAtMs: 1000 },
    ]
    const predictions: GradedPrediction[] = [
      graded('u_member', 500001, { home: 2, away: 1 }), // exact → 6
      graded('u_orphan', 500001, { home: 2, away: 1 }), // not a participant → excluded
    ]
    const board = buildLeaderboard(predictions, participants, FINISHED)

    expect(board).toHaveLength(1)
    expect(board.find((r) => r.uid === 'u_orphan')).toBeUndefined()
    expect(board[0].uid).toBe('u_member')
    expect(board[0].predictionsGraded).toBe(FINISHED.size)
  })

  it('rule 7 — a not-yet-finished match is NOT counted toward the denominator or points', () => {
    // Only 500001 and 500002 are finished; 500003 is still in play (not in the set).
    const partialFinished: ReadonlySet<string> = new Set(['500001', '500002'])
    const participants: ParticipantProfile[] = [
      { uid: 'u_x', displayName: 'X', photoURL: null, joinedAtMs: 1000 },
    ]
    const predictions: GradedPrediction[] = [
      graded('u_x', 500001, { home: 2, away: 1 }), // exact → 6 (counted)
      graded('u_x', 500003, { home: 0, away: 2 }), // exact, but 500003 NOT finished → ignored
    ]
    const board = buildLeaderboard(predictions, participants, partialFinished)
    const x = board.find((r) => r.uid === 'u_x')!

    // Denominator is 2 (the finished set), and the 500003 pick is not scored.
    expect(x.predictionsGraded).toBe(2)
    expect(x.totalPoints).toBe(6)
    expect(x.exactCount).toBe(1) // only the finished-match exact counts
  })
})
