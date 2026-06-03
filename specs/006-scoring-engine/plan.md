# 006 — Plan

> Generated from spec.md. Technical design only — no behavior the spec doesn't call for.

## Approach
Implement the grading logic as a single pure module `src/shared/scoring.ts` — the one source of
truth imported by both the authoritative ingestion job and the UI preview (constitution principle 2).
The core `scorePrediction(pred, actual, cfg)` computes a per-tier breakdown and total:

1. **Exact** scoreline (`pred.home===actual.home && pred.away===actual.away`) → `cfg.exact`. Max tier;
   the outcome tier is NOT added on top.
2. Else **correct outcome** (`sign(home-away)` equal via `outcomeOf`) → `cfg.outcome`.
3. Else 0.
4. **Goal-diff bonus**: additive on top, awarded when signed `home-away` is equal. Gated by
   `cfg.goalDiffOnlyOnCorrectOutcome` — when true, only when the outcome is correct. (An exact
   scoreline inherently has the correct goal diff, so the bonus applies there too.)

No Firebase or other dependencies; no clock, no randomness, no mutation of inputs. Config is passed
in by callers (defaulting to `DEFAULT_SCORING`), keeping the function pure and config-driven.

## Files to create / change
| Path | Change | Notes |
|------|--------|-------|
| `src/shared/scoring.ts` | new | The pure engine: types, `DEFAULT_SCORING`, `outcomeOf`, `scorePrediction`. |
| `src/shared/scoring.test.ts` | new | Vitest unit tests for all tiers, edge cases, purity, config flags. |

## Data shapes / interfaces
```ts
export interface ScoringConfig {
  exact: number;
  outcome: number;
  goalDiffBonus: number;
  goalDiffOnlyOnCorrectOutcome: boolean;
  gradeOn: 'fullTime90';
}
export const DEFAULT_SCORING: ScoringConfig =
  { exact: 5, outcome: 3, goalDiffBonus: 1, goalDiffOnlyOnCorrectOutcome: true, gradeOn: 'fullTime90' };

export interface Scoreline { home: number; away: number }
export interface ScoreBreakdown { exact: number; outcome: number; goalDiff: number }
export interface ScoreResult { points: number; breakdown: ScoreBreakdown }

export function outcomeOf(s: Scoreline): -1 | 0 | 1;
export function scorePrediction(
  pred: Scoreline, actual: Scoreline, cfg?: ScoringConfig,
): ScoreResult;
```

## Reused utilities
- None — this module is intentionally dependency-free so both the browser bundle and the Node
  ingestion job can import it without pulling in extra runtime. A private `outcomeOf` helper is the
  only internal abstraction.

## Test strategy
Vitest unit tests in `src/shared/scoring.test.ts`, run in isolation
(`npx vitest run src/shared/scoring.test.ts`) so they never depend on global config state — every
test passes an explicit `ScoringConfig`. Coverage:
- Exact match (incl. exact 0-0 / exact draw → exact + diff bonus).
- Correct outcome, wrong score (with and without matching goal diff).
- Complete miss → 0; predicted-draw-vs-win and predicted-win-vs-draw → 0.
- Goal-diff bonus policy flag both true and false.
- Config-driven custom weights respected.
- Knockout 90-minute cases (tie graded on full-time score).
- Purity: deterministic output, no input mutation, fresh breakdown object per call.
- `outcomeOf` and `DEFAULT_SCORING` sanity.

## Risks
- **Bonus stacking ambiguity** → spec says exact is max tier "not stacked with outcome"; the goal-diff
  bonus is separate and additive. Mitigated by explicit breakdown fields and dedicated tests.
- **Goal-diff sign for draws** → both diffs are 0, so the bonus applies to any draw-vs-draw; covered by
  test. Note a wrong outcome can never share the same *signed* goal diff, so the policy flag is only
  observable on draws — documented in code/tests.
- **ET/penalties in knockouts** → out of scope; `gradeOn:'fullTime90'` documents that callers feed the
  90' score. Engine stays pure and agnostic.
