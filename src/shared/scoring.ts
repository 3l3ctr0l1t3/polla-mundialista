// Polla Mundialista — the ONE scoring engine.
//
// Pure, deterministic grading logic shared by BOTH the authoritative ingestion
// job and the UI preview. There must be exactly one copy of this logic in the
// codebase (see specs/constitution.md, principle 2).
//
// Hard rules for this module:
//   - No I/O, no Date, no Math.random, no side effects.
//   - No external dependencies (NOT even firebase) — imported by app + job.
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
}

/** Project default policy: exact=5, outcome=3, goal-diff bonus=+1. */
export const DEFAULT_SCORING: ScoringConfig = {
  exact: 5,
  outcome: 3,
  goalDiffBonus: 1,
  goalDiffOnlyOnCorrectOutcome: true,
  gradeOn: 'fullTime90',
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
 * Pure: identical inputs always yield identical outputs.
 */
export function scorePrediction(
  pred: Scoreline,
  actual: Scoreline,
  cfg: ScoringConfig = DEFAULT_SCORING,
): ScoreResult {
  const breakdown: ScoreBreakdown = { exact: 0, outcome: 0, goalDiff: 0 }

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

  const points = breakdown.exact + breakdown.outcome + breakdown.goalDiff
  return { points, breakdown }
}
