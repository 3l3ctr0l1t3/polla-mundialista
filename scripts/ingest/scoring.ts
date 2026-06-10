// Single source of truth for grading.
//
// The ingestion job MUST NOT reimplement scoring (constitution principle 2).
// This module is a thin re-export of the ONE shared engine used by the UI too.
export {
  scorePrediction,
  outcomeOf,
  DEFAULT_SCORING,
  effectiveScoring,
  mergeScoring,
} from '../../src/shared/scoring.ts'

export type {
  ScoringConfig,
  Scoreline,
  ScoreBreakdown,
  ScoreResult,
} from '../../src/shared/scoring.ts'
