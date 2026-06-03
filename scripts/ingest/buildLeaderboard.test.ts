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
import { scorePrediction, type Scoreline } from './scoring.ts'
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
  return { uid, points, breakdown }
}

// Finished fixtures: 500001 = 2-1 (home), 500002 = 1-1 (draw), 500003 = 0-2 (away).
const users: ParticipantProfile[] = [
  { uid: 'u_ana', displayName: 'Ana', photoURL: null },
  { uid: 'u_beto', displayName: 'Beto', photoURL: 'https://x/b.png' },
  { uid: 'u_caro', displayName: 'Caro', photoURL: null },
  { uid: 'u_dani', displayName: 'Dani', photoURL: null },
  { uid: 'u_zoe', displayName: 'Zoe', photoURL: null }, // no predictions
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

    const board = buildLeaderboard(predictions, users)

    const get = (uid: string) => board.find((r) => r.uid === uid)!

    // --- Totals via the real engine ---
    expect(get('u_ana').totalPoints).toBe(15) // 6 + 6 + 3
    expect(get('u_beto').totalPoints).toBe(13) // 4 + 6 + 3
    expect(get('u_caro').totalPoints).toBe(4) // outcome 3 + gd 1
    expect(get('u_dani').totalPoints).toBe(0)
    expect(get('u_zoe').totalPoints).toBe(0)

    // --- Counts ---
    expect(get('u_ana')).toMatchObject({ exactCount: 2, outcomeCount: 1, predictionsGraded: 3 })
    expect(get('u_beto')).toMatchObject({ exactCount: 1, outcomeCount: 2, predictionsGraded: 3 })
    expect(get('u_caro')).toMatchObject({ exactCount: 0, outcomeCount: 1, predictionsGraded: 1 })
    expect(get('u_dani')).toMatchObject({ exactCount: 0, outcomeCount: 0, predictionsGraded: 1 })
    expect(get('u_zoe')).toMatchObject({ exactCount: 0, outcomeCount: 0, predictionsGraded: 0 })

    // --- Dense ranks (1,2,3,4,4) ---
    expect(get('u_ana').rank).toBe(1) // 13
    expect(get('u_beto').rank).toBe(2) // 12
    expect(get('u_caro').rank).toBe(3) // 4
    expect(get('u_dani').rank).toBe(4) // 0, tie with Zoe
    expect(get('u_zoe').rank).toBe(4) // 0, tie with Dani

    // --- Order matches rank, then name for ties ---
    expect(board.map((r) => r.uid)).toEqual(['u_ana', 'u_beto', 'u_caro', 'u_dani', 'u_zoe'])
  })

  it('breaks points ties by exactCount, then outcomeCount, then displayName', () => {
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
    const board = buildLeaderboard(predictions, [
      { uid: 'u_low', displayName: 'Aaron', photoURL: null }, // earlier name, but loses on exact
      { uid: 'u_high', displayName: 'Zane', photoURL: null },
    ])
    expect(board.find((r) => r.uid === 'u_high')!.totalPoints).toBe(12)
    expect(board.find((r) => r.uid === 'u_low')!.totalPoints).toBe(12)
    // Exact-count tiebreaker wins over displayName.
    expect(board.map((r) => r.uid)).toEqual(['u_high', 'u_low'])
    expect(board.find((r) => r.uid === 'u_high')!.rank).toBe(1)
    expect(board.find((r) => r.uid === 'u_low')!.rank).toBe(2)
  })

  it('ignores ungraded predictions and predictions for unknown users', () => {
    const predictions: GradedPrediction[] = [
      { uid: 'u_ana', points: undefined }, // not graded yet
      { uid: 'u_ana', points: null }, // not graded yet
      graded('u_ghost', 500001, { home: 2, away: 1 }), // unknown user → skipped
      graded('u_ana', 500001, { home: 2, away: 1 }), // exact → 6 (5 + gd bonus 1)
    ]
    const board = buildLeaderboard(predictions, [
      { uid: 'u_ana', displayName: 'Ana', photoURL: null },
    ])
    expect(board).toHaveLength(1)
    expect(board[0]).toMatchObject({ uid: 'u_ana', totalPoints: 6, predictionsGraded: 1, rank: 1 })
  })
})
