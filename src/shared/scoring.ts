// Polla Mundialista — the ONE scoring engine.
//
// Pure, deterministic grading logic shared by BOTH the authoritative ingestion
// job and the UI preview. There must be exactly one copy of this logic in the
// codebase (see specs/constitution.md, principle 2).
//
// Scoring tiers:
//   - Exact scoreline      → cfg.exact (max tier, not stacked with outcome).
//   - Correct outcome only → cfg.outcome.
//   - Goal-diff bonus      → cfg.goalDiffBonus, additive (gated by policy flag).
//   - Round bonus          → cfg.roundBonus[stage], a flat integer ADDED per match
//                            stage (GROUP_STAGE…FINAL) on top of the base tiers, but
//                            ONLY when the prediction already earned base points.
//
// Hard rules for this module:
//   - No I/O, no Date, no Math.random, no side effects.
//   - No external dependencies (NOT even firebase) — imported by app + job.
//   - The `stage` is a plain string INPUT passed by the caller, never looked up.
//   - Integer goals assumed (football-data.org full-time 90' score).

/** Tiered, configurable scoring policy. Loaded at runtime from `config/scoring`. */
export interface ScoringConfig {
  /** Points for an exact scoreline match (the max tier). */
  exact: number
  /** Points for predicting the correct outcome (W/D/L) with a wrong score. */
  outcome: number
  /** Bonus points for predicting the correct goal difference. */
  goalDiffBonus: number
  /** If true, the goal-diff bonus only applies when the outcome is also correct. */
  goalDiffOnlyOnCorrectOutcome: boolean
  /** Which match score is graded. Full-time 90' (incl. knockout, before ET/penalties). */
  gradeOn: 'fullTime90'
  /**
   * Flat integer ADDED to a SCORING prediction's points, keyed by match stage
   * (`GROUP_STAGE`…`FINAL`). Additive (never a multiplier); applied only when the
   * prediction earned base points. An unknown stage contributes `0`.
   */
  roundBonus: Record<string, number>
}

/** Project default policy: exact=5, outcome=3, goal-diff bonus=+1, escalating round bonuses. */
export const DEFAULT_SCORING: ScoringConfig = {
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

/** A scoreline of integer goals. */
export interface Scoreline {
  home: number
  away: number
}

/** Per-tier point contributions, for transparent display + auditing. */
export interface ScoreBreakdown {
  exact: number
  outcome: number
  goalDiff: number
  /** Per-stage flat bonus, additive on top of the base tiers (0 unless a stage was given). */
  roundBonus: number
}

/** Result of grading a single prediction against a single actual result. */
export interface ScoreResult {
  points: number
  breakdown: ScoreBreakdown
}

/** Match outcome from the home team's perspective: 1=win, 0=draw, -1=loss. */
export function outcomeOf(s: Scoreline): -1 | 0 | 1 {
  if (s.home > s.away) return 1
  if (s.home < s.away) return -1
  return 0
}

/** Signed goal difference (home - away). */
function goalDiffOf(s: Scoreline): number {
  return s.home - s.away
}

/**
 * Grade a prediction against an actual result under the given policy.
 *
 * Tiers (mutually exclusive for exact vs. outcome — they do NOT stack):
 *   - Exact scoreline           → cfg.exact points.
 *   - Correct outcome only      → cfg.outcome points.
 *   - Otherwise                 → 0.
 *
 * Goal-difference bonus is additive on top, gated by
 * cfg.goalDiffOnlyOnCorrectOutcome. (Note: an exact scoreline always has the
 * correct goal difference, so the bonus naturally applies there too.)
 *
 * Per-stage round bonus (additive): when a `stage` is supplied AND the prediction
 * earned base points (exact + outcome + goalDiff > 0), a flat integer
 * `cfg.roundBonus[stage] ?? 0` is added on top. A wrong prediction (base 0) earns
 * NO round bonus; calling without a `stage` leaves the bonus at 0 (back-compat).
 *
 * Pure: identical inputs always yield identical outputs.
 */
export function scorePrediction(
  pred: Scoreline,
  actual: Scoreline,
  cfg: ScoringConfig = DEFAULT_SCORING,
  stage?: string,
): ScoreResult {
  const breakdown: ScoreBreakdown = { exact: 0, outcome: 0, goalDiff: 0, roundBonus: 0 }

  const isExact = pred.home === actual.home && pred.away === actual.away
  const outcomeCorrect = outcomeOf(pred) === outcomeOf(actual)

  if (isExact) {
    // Max tier — not stacked with the outcome tier.
    breakdown.exact = cfg.exact
  } else if (outcomeCorrect) {
    breakdown.outcome = cfg.outcome
  }

  // Goal-difference bonus (additive). Gated by policy flag.
  const diffMatches = goalDiffOf(pred) === goalDiffOf(actual)
  const bonusAllowed = cfg.goalDiffOnlyOnCorrectOutcome ? outcomeCorrect : true
  if (diffMatches && bonusAllowed) {
    breakdown.goalDiff = cfg.goalDiffBonus
  }

  // Per-stage round bonus (additive). Only when the prediction earned base points.
  const base = breakdown.exact + breakdown.outcome + breakdown.goalDiff
  if (base > 0 && stage !== undefined) {
    breakdown.roundBonus = cfg.roundBonus[stage] ?? 0
  }

  const points = breakdown.exact + breakdown.outcome + breakdown.goalDiff + breakdown.roundBonus
  return { points, breakdown }
}

/**
 * Shallow-merge an override over a base config, BUT deep-merge `roundBonus` so a
 * partial override map keeps the other stages from the base. Pure — returns a fresh
 * config and never mutates its inputs.
 */
export function mergeScoring(
  base: ScoringConfig,
  override?: Partial<ScoringConfig>,
): ScoringConfig {
  if (!override) return { ...base, roundBonus: { ...base.roundBonus } }
  return {
    ...base,
    ...override,
    roundBonus: { ...base.roundBonus, ...(override.roundBonus ?? {}) },
  }
}

/**
 * A group's EFFECTIVE scoring config = `DEFAULT_SCORING` with the group's optional
 * `scoring` override deep-merged on top. Absent override ⇒ the shipped defaults.
 */
export function effectiveScoring(group: { scoring?: Partial<ScoringConfig> }): ScoringConfig {
  return mergeScoring(DEFAULT_SCORING, group.scoring)
}
