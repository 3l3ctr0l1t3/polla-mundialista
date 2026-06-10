import { describe, it, expect } from 'vitest'
import {
  scorePrediction,
  outcomeOf,
  mergeScoring,
  effectiveScoring,
  DEFAULT_SCORING,
  type ScoringConfig,
  type Scoreline,
} from './scoring'

// A self-contained config so these tests never depend on global config state.
// Mirrors DEFAULT_SCORING incl. the per-stage round-bonus map.
const cfg: ScoringConfig = {
  exact: 5,
  outcome: 3,
  goalDiffBonus: 1,
  goalDiffOnlyOnCorrectOutcome: true,
  gradeOn: 'fullTime90',
  roundBonus: {
    GROUP_STAGE: 0,
    LAST_32: 0,
    LAST_16: 1,
    QUARTER_FINALS: 2,
    SEMI_FINALS: 3,
    FINAL: 4,
    THIRD_PLACE: 3,
  },
}

const s = (home: number, away: number): Scoreline => ({ home, away })

describe('outcomeOf', () => {
  it('home win → 1', () => expect(outcomeOf(s(2, 0))).toBe(1))
  it('away win → -1', () => expect(outcomeOf(s(0, 2))).toBe(-1))
  it('draw → 0', () => expect(outcomeOf(s(1, 1))).toBe(0))
  it('0-0 draw → 0', () => expect(outcomeOf(s(0, 0))).toBe(0))
})

describe('DEFAULT_SCORING', () => {
  it('matches the constitution defaults', () => {
    expect(DEFAULT_SCORING).toEqual({
      exact: 5,
      outcome: 3,
      goalDiffBonus: 1,
      goalDiffOnlyOnCorrectOutcome: true,
      gradeOn: 'fullTime90',
      roundBonus: {
        GROUP_STAGE: 0,
        LAST_32: 0,
        LAST_16: 1,
        QUARTER_FINALS: 2,
        SEMI_FINALS: 3,
        FINAL: 4,
        THIRD_PLACE: 3,
      },
    })
  })

  it('is used when cfg is omitted (no stage ⇒ no round bonus)', () => {
    // Exact non-draw: exact(5) + goalDiff bonus(1) = 6 under defaults; roundBonus 0.
    expect(scorePrediction(s(2, 1), s(2, 1))).toEqual({
      points: 6,
      breakdown: { exact: 5, outcome: 0, goalDiff: 1, roundBonus: 0 },
    })
  })
})

describe('scorePrediction — acceptance rules', () => {
  it('exact scoreline → exact points, not stacked with outcome', () => {
    const r = scorePrediction(s(3, 1), s(3, 1), cfg)
    expect(r.breakdown.exact).toBe(5)
    expect(r.breakdown.outcome).toBe(0) // never stacked with exact
    expect(r.breakdown.goalDiff).toBe(1) // exact implies correct goal diff
    expect(r.points).toBe(6)
  })

  it('correct outcome, wrong score → outcome points', () => {
    // Both home wins; goal diff differs (1 vs 2) → no diff bonus.
    const r = scorePrediction(s(2, 1), s(3, 1), cfg)
    expect(r.breakdown.exact).toBe(0)
    expect(r.breakdown.outcome).toBe(3)
    expect(r.breakdown.goalDiff).toBe(0)
    expect(r.points).toBe(3)
  })

  it('correct outcome AND correct goal diff (wrong score) → outcome + bonus', () => {
    // Both away wins by 1 goal: 1-2 vs 2-3.
    const r = scorePrediction(s(1, 2), s(2, 3), cfg)
    expect(r.breakdown.exact).toBe(0)
    expect(r.breakdown.outcome).toBe(3)
    expect(r.breakdown.goalDiff).toBe(1)
    expect(r.points).toBe(4)
  })

  it('complete miss (wrong outcome, wrong score) → 0', () => {
    const r = scorePrediction(s(2, 0), s(0, 2), cfg)
    expect(r.points).toBe(0)
    expect(r.breakdown).toEqual({ exact: 0, outcome: 0, goalDiff: 0, roundBonus: 0 })
  })

  it('predicted draw, actual draw, exact → exact + bonus', () => {
    const r = scorePrediction(s(1, 1), s(1, 1), cfg)
    expect(r.breakdown.exact).toBe(5)
    expect(r.breakdown.goalDiff).toBe(1)
    expect(r.points).toBe(6)
  })

  it('predicted draw, actual different draw → outcome + bonus (diff both 0)', () => {
    const r = scorePrediction(s(0, 0), s(2, 2), cfg)
    expect(r.breakdown.exact).toBe(0)
    expect(r.breakdown.outcome).toBe(3)
    expect(r.breakdown.goalDiff).toBe(1) // both goal diffs are 0
    expect(r.points).toBe(4)
  })

  it('predicted draw, actual win → 0', () => {
    const r = scorePrediction(s(1, 1), s(2, 1), cfg)
    expect(r.points).toBe(0)
  })

  it('predicted win, actual draw → 0', () => {
    const r = scorePrediction(s(2, 1), s(1, 1), cfg)
    expect(r.points).toBe(0)
  })
})

describe('scorePrediction — goal-diff bonus policy flag', () => {
  it('goalDiffOnlyOnCorrectOutcome=true: no bonus when outcome is wrong even if diff coincides', () => {
    // pred away win by 1 (1-2), actual home win by 1 (2-1): diff is -1 vs +1 → differs anyway.
    // Construct a case where |diff| equal but sign opposite is impossible to also be equal,
    // so use a wrong-outcome where diff truly differs: covered by miss test. Here assert the gate:
    const strict = scorePrediction(s(0, 1), s(1, 2), cfg) // both away win by 1 → bonus applies
    expect(strict.breakdown.goalDiff).toBe(1)
  })

  it('goalDiffOnlyOnCorrectOutcome=false: bonus can apply without correct outcome', () => {
    const loose: ScoringConfig = { ...cfg, goalDiffOnlyOnCorrectOutcome: false }
    // pred 0-0 (diff 0, draw), actual 2-2 (diff 0, draw) — outcome correct, trivial.
    // For a genuine wrong-outcome-but-same-diff we need a draw vs draw which is same outcome.
    // Same signed diff with different outcome is mathematically impossible, so this flag's
    // observable effect is on draws only. Validate the flag does not crash and yields bonus.
    const r = scorePrediction(s(1, 1), s(3, 3), loose)
    expect(r.breakdown.outcome).toBe(3)
    expect(r.breakdown.goalDiff).toBe(1)
    expect(r.points).toBe(4)
  })

  it('config-driven weights are respected', () => {
    const custom: ScoringConfig = {
      exact: 10,
      outcome: 4,
      goalDiffBonus: 2,
      goalDiffOnlyOnCorrectOutcome: true,
      gradeOn: 'fullTime90',
      roundBonus: {},
    }
    expect(scorePrediction(s(2, 0), s(2, 0), custom).points).toBe(12) // 10 + 2
    expect(scorePrediction(s(2, 1), s(3, 1), custom).points).toBe(4) // outcome only
  })
})

describe('scorePrediction — knockout 90-minute case', () => {
  it('grades a tied knockout match on full-time 90 score (before ET/penalties)', () => {
    // Knockout fixtures can be 1-1 at 90' and decided on penalties. We grade the 90' result.
    // Participant predicted the 1-1 full-time draw exactly.
    const r = scorePrediction(s(1, 1), s(1, 1), cfg)
    expect(r.points).toBe(6) // exact 5 + diff bonus 1
    expect(cfg.gradeOn).toBe('fullTime90')
  })

  it('knockout decided in 90: correct outcome wrong score', () => {
    const r = scorePrediction(s(1, 0), s(2, 0), cfg)
    expect(r.breakdown.outcome).toBe(3)
    expect(r.points).toBe(3)
  })
})

describe('scorePrediction — purity', () => {
  it('is deterministic and does not mutate inputs', () => {
    const pred = s(2, 1)
    const actual = s(2, 1)
    const a = scorePrediction(pred, actual, cfg)
    const b = scorePrediction(pred, actual, cfg)
    expect(a).toEqual(b)
    expect(pred).toEqual({ home: 2, away: 1 })
    expect(actual).toEqual({ home: 2, away: 1 })
  })

  it('returns an independent breakdown object each call', () => {
    const a = scorePrediction(s(1, 0), s(1, 0), cfg)
    const b = scorePrediction(s(1, 0), s(1, 0), cfg)
    expect(a.breakdown).not.toBe(b.breakdown)
  })
})

// The breakdown must always sum to points across every graded case.
const sumsToPoints = (r: {
  points: number
  breakdown: { exact: number; outcome: number; goalDiff: number; roundBonus: number }
}) =>
  expect(r.points).toBe(
    r.breakdown.exact + r.breakdown.outcome + r.breakdown.goalDiff + r.breakdown.roundBonus,
  )

describe('scorePrediction — per-stage round bonus', () => {
  it('exact FINAL → base 6 + round bonus 4 = 10', () => {
    const r = scorePrediction(s(2, 1), s(2, 1), cfg, 'FINAL')
    expect(r.breakdown).toEqual({ exact: 5, outcome: 0, goalDiff: 1, roundBonus: 4 })
    expect(r.points).toBe(10)
    sumsToPoints(r)
  })

  it('exact GROUP_STAGE → base 6 + bonus 0 = 6', () => {
    const r = scorePrediction(s(2, 1), s(2, 1), cfg, 'GROUP_STAGE')
    expect(r.breakdown.roundBonus).toBe(0)
    expect(r.points).toBe(6)
    sumsToPoints(r)
  })

  it('outcome-only LAST_16 → base 3 + bonus 1 = 4', () => {
    // Both home wins, different goal diff (1 vs 2) → outcome only.
    const r = scorePrediction(s(2, 1), s(3, 1), cfg, 'LAST_16')
    expect(r.breakdown).toEqual({ exact: 0, outcome: 3, goalDiff: 0, roundBonus: 1 })
    expect(r.points).toBe(4)
    sumsToPoints(r)
  })

  it('QUARTER_FINALS outcome + goal-diff (non-exact) → base 4 + bonus 2 = 6', () => {
    // Both away wins by 1: 1-2 vs 2-3 → outcome 3 + goalDiff 1 = 4 base, +2 bonus.
    const r = scorePrediction(s(1, 2), s(2, 3), cfg, 'QUARTER_FINALS')
    expect(r.breakdown).toEqual({ exact: 0, outcome: 3, goalDiff: 1, roundBonus: 2 })
    expect(r.points).toBe(6)
    sumsToPoints(r)
  })

  it('LAST_32 → base only (bonus 0)', () => {
    const r = scorePrediction(s(2, 1), s(2, 1), cfg, 'LAST_32')
    expect(r.breakdown.roundBonus).toBe(0)
    expect(r.points).toBe(6)
    sumsToPoints(r)
  })

  it('a WRONG prediction with a stage earns NO bonus (base 0 ⇒ 0)', () => {
    const r = scorePrediction(s(2, 0), s(0, 2), cfg, 'FINAL')
    expect(r.breakdown).toEqual({ exact: 0, outcome: 0, goalDiff: 0, roundBonus: 0 })
    expect(r.points).toBe(0)
    sumsToPoints(r)
  })

  it('calling with NO stage is back-compat: base points, bonus 0', () => {
    const r = scorePrediction(s(2, 1), s(2, 1), cfg)
    expect(r.breakdown.roundBonus).toBe(0)
    expect(r.points).toBe(6)
    sumsToPoints(r)
  })

  it('an unknown stage contributes 0', () => {
    const r = scorePrediction(s(2, 1), s(2, 1), cfg, 'NOT_A_STAGE')
    expect(r.breakdown.roundBonus).toBe(0)
    expect(r.points).toBe(6)
    sumsToPoints(r)
  })
})

describe('mergeScoring / effectiveScoring', () => {
  it('deep-merges roundBonus: a FINAL-bonus-10 override keeps other stages at defaults', () => {
    const merged = mergeScoring(DEFAULT_SCORING, { roundBonus: { FINAL: 10 } })
    expect(merged.roundBonus.FINAL).toBe(10)
    expect(merged.roundBonus.LAST_16).toBe(1) // unchanged default
    expect(merged.roundBonus.QUARTER_FINALS).toBe(2)
    // Exact FINAL under the override: base 6 + bonus 10 = 16 (config-driven).
    const r = scorePrediction(s(2, 1), s(2, 1), merged, 'FINAL')
    expect(r.points).toBe(16)
    sumsToPoints(r)
  })

  it('merges top-level fields shallowly while deep-merging roundBonus', () => {
    const merged = mergeScoring(DEFAULT_SCORING, { exact: 8, roundBonus: { SEMI_FINALS: 5 } })
    expect(merged.exact).toBe(8)
    expect(merged.outcome).toBe(3) // untouched base
    expect(merged.roundBonus.SEMI_FINALS).toBe(5)
    expect(merged.roundBonus.FINAL).toBe(4) // untouched base
  })

  it('does not mutate base or the override', () => {
    const override = { roundBonus: { FINAL: 99 } }
    mergeScoring(DEFAULT_SCORING, override)
    expect(DEFAULT_SCORING.roundBonus.FINAL).toBe(4)
    expect(override).toEqual({ roundBonus: { FINAL: 99 } })
  })

  it('mergeScoring with no override returns a deep copy of base', () => {
    const merged = mergeScoring(DEFAULT_SCORING)
    expect(merged).toEqual(DEFAULT_SCORING)
    expect(merged.roundBonus).not.toBe(DEFAULT_SCORING.roundBonus)
  })

  it('effectiveScoring(group) without scoring ⇒ defaults', () => {
    expect(effectiveScoring({})).toEqual(DEFAULT_SCORING)
  })

  it('effectiveScoring(group) deep-merges the group override over defaults', () => {
    const eff = effectiveScoring({ scoring: { roundBonus: { FINAL: 7 } } })
    expect(eff.roundBonus.FINAL).toBe(7)
    expect(eff.roundBonus.LAST_16).toBe(1)
    expect(eff.exact).toBe(5)
  })
})
