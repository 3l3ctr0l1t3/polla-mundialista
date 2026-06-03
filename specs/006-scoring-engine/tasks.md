# 006 — Tasks

> Generated from plan.md. Ordered, atomic, checkboxed. Check off as you implement.

- [x] 1. Create `src/shared/scoring.ts` with `ScoringConfig`, `DEFAULT_SCORING`, `Scoreline`, `ScoreBreakdown`, `ScoreResult` types.
- [x] 2. Implement `outcomeOf(s)` helper and the pure `scorePrediction(pred, actual, cfg?)` engine (exact / outcome / goal-diff-bonus tiers, no I/O, no clock, no mutation).
- [x] 3. Write Vitest tests in `src/shared/scoring.test.ts` for the acceptance rules (exact, outcome-only, miss, draws, goal-diff bonus apply/not, config flags, knockout 90-min, purity).
- [x] 4. Run `npx vitest run src/shared/scoring.test.ts` and confirm all tests pass.
- [ ] 5. Update `specs/backlog.md` status to ✅ (deferred — parent owns backlog/commit).

## Verification command(s)
```
npx vitest run src/shared/scoring.test.ts
```
