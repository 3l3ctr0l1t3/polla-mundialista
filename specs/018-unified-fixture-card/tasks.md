# 018 — Tasks

> Generated from plan.md. Ordered, atomic, checkboxed.

- [x] 1. Create `src/hooks/useSavePrediction.ts` — extract PredictionInput's state + `locked`
  (server-time) + `save()` (setDoc merge, createdAt-on-first-write, never points/breakdown) + snack.
- [x] 2. Create `src/hooks/useSavePrediction.test.ts` — save ref/shape, locked-past-kickoff blocks save,
  permission-denied → locked snackbar (port the old PredictionInput test assertions).
- [x] 3. Create `src/components/FixtureCard.tsx` — centered layout (name→flag→steppers/score) per
  `MatchLabCard`; upcoming = steppers + Save/Update (from the hook) + `CountdownToKickoff`; live/finished =
  score + own prediction (subtle) + button opening `MatchPredictionsDialog`. Localized with `t()`.
- [x] 4. Add i18n key `predictions.yourPrediction` to BOTH en.json + es.json; remove `nav.predictions`
  from BOTH (key parity).
- [x] 5. Create `src/components/FixtureCard.test.tsx` — steppers pre-kickoff, score+own-prediction post,
  save calls correct ref, reveal opens only after kickoff.
- [x] 6. Edit `src/pages/FixturesPage.tsx` — render `FixtureCard` per match; add `useGroupPredictions(gid)`
  + `useServerTime`; pass `gid`, `existing`, `now`. Update `FixturesPage.test.tsx`.
- [x] 7. Edit `src/group/GroupApp.tsx` — remove the `predictions` route + `PredictionsPage` import; add a
  redirect `predictions` → `fixtures`. Edit `navItems.tsx` — drop the `predictions` nav entry. (Keep Canvas.)
- [x] 8. Delete `src/pages/PredictionsPage.tsx` + test, `src/components/PredictionCard.tsx`,
  `src/components/PredictionInput.tsx` + test — after grepping that nothing else imports them.
- [x] 9. Gates: `npm run build`, `npm test -- --run`, `npm run test:rules` (unchanged, still green),
  `npm run lint`, `npx prettier --check .` — all green. Confirm no diff to scoring/ingest/firestore.rules.
- [ ] 10. Run `/spec-verify 018`; update `specs/backlog.md` status.

## Verification command(s)
```
npm run build
npm test -- --run
npm run test:rules
npm run lint
npx prettier --check .
```
