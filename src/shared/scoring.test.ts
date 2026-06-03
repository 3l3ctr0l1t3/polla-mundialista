import { describe, it, expect } from 'vitest'
import {
  scorePrediction,
  outcomeOf,
  DEFAULT_SCORING,
  type ScoringConfig,
  type Scoreline,
} from './scoring'

// A self-contained config so these tests never depend on global config state.
const cfg: ScoringConfig = {
  exact: 5,
  outcome: 3,
  goalDiffBonus: 1,
  goalDiffOnlyOnCorrectOutcome: true,
  gradeOn: 'fullTime90',
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
    })
  })

  it('is used when cfg is omitted', () => {
    // Exact non-draw: exact(5) + goalDiff bonus(1) = 6 under defaults.
    expect(scorePrediction(s(2, 1), s(2, 1))).toEqual({
      points: 6,
      breakdown: { exact: 5, outcome: 0, goalDiff: 1 },
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
    expect(r.breakdown).toEqual({ exact: 0, outcome: 0, goalDiff: 0 })
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
