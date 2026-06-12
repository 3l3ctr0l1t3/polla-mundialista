# 034 — Tasks

> Generated from plan.md. Ordered, atomic, checkboxed. Land AFTER 033 (shared `index.ts` aggregation).

- [x] 1. Edit `scripts/ingest/buildLeaderboard.ts`: add `matchId` to `GradedPrediction`; add `finishedMatchIds: ReadonlySet<string>` param; set `predictionsGraded = finishedMatchIds.size`; sum points over finished-match picks (missing ⇒ 0); keep exact/outcome counts from real picks only.
- [x] 2. Edit `scripts/ingest/index.ts`: derive `finishedMatchIds` from the FINISHED set and pass it + `matchId` into `buildLeaderboard` at the rebuild call site.
- [x] 3. Edit `scripts/ingest/buildLeaderboard.test.ts`: late joiner 0s for pre-join finished matches; skipper 0 + denominator bump; `predictionsGraded == finishedMatchIds.size` for all; `totalPoints` byte-identical to baseline; non-participant excluded; not-yet-finished match excluded.
- [x] 4. Edit `src/components/FixtureCard.tsx`: finished + real score + **no** `existing` ⇒ render `PointsPill(points=0, tier='miss')` with a "no prediction" label.
- [x] 5. Edit `src/i18n/en.json` + `src/i18n/es.json`: add `predictions.noPredictionZero` ("0 pts · no prediction" / "0 pts · sin pronóstico"); keep key parity.
- [x] 6. Edit `src/components/FixtureCard.test.tsx`: finished + no prediction ⇒ pill present; locked-but-not-finished + no prediction ⇒ pill absent.
- [ ] 7. Run `/spec-verify 034` and confirm all acceptance rules pass.
- [ ] 8. Update `specs/backlog.md` status to ✅ (or 🟨 pending live verification).

## Verification command(s)
```
npm run test:ingest
npm test
npm run build
npm run lint
npx prettier --check scripts/ingest/buildLeaderboard.ts scripts/ingest/index.ts src/components/FixtureCard.tsx src/i18n/en.json src/i18n/es.json
```
