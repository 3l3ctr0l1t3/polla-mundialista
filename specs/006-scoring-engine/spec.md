# 006 — Scoring engine

> Status: 🟦 spec ready · Depends on: 001 · Specialist: ingestion-engineer

## Why
Points are the heart of the polla. The grading logic must be a single, pure, well-tested function shared by
the ingestion job (authoritative) and the UI (preview), so results are deterministic and consistent.

## User story
As a **participant**, I want **my prediction graded fairly and transparently** so that **I trust the
leaderboard**.

## Scope
- `src/shared/scoring.ts` exporting a pure `scorePrediction(pred, actual, cfg)` and `DEFAULT_SCORING`.
- Config shape `ScoringConfig` (weights + policy flags); loaded at runtime from `config/scoring` by callers.
- Vitest unit tests covering all tiers and edge cases.

## Data shapes
```ts
interface ScoringConfig { exact:number; outcome:number; goalDiffBonus:number;
  goalDiffOnlyOnCorrectOutcome:boolean; gradeOn:'fullTime90' }
const DEFAULT_SCORING = { exact:5, outcome:3, goalDiffBonus:1,
  goalDiffOnlyOnCorrectOutcome:true, gradeOn:'fullTime90' };
function scorePrediction(pred:{home:number;away:number}, actual:{home:number;away:number},
  cfg?:ScoringConfig): { points:number; breakdown:{exact:number;outcome:number;goalDiff:number} };
```

## Non-goals
- No Firestore I/O here (the function is pure); aggregation is ticket 007.

## Acceptance rules (definition of done)
1. Exact scoreline → `exact` points (max tier, not stacked with outcome).
2. Correct outcome (W/D/L) but wrong score → `outcome` points.
3. Goal-difference bonus added per config; wrong outcome and wrong score → 0.
4. Pure & deterministic (no side effects, no clock/random).
5. Unit tests cover: exact, outcome-only, miss, draw, missing-prediction (=0), knockout 90-min grading — all pass.

## Constitution links
- TypeScript everywhere; single shared scoring engine. Done = unit tests pass.

## Notes / open questions
- Penalty/advancement bonus deferred to a later config tier (reads `match.score.winner`).
