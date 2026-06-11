# 027 — Tasks

> Generated from plan.md. Ordered, atomic, checkboxed. Check off as you implement.

- [x] 1. Create `src/hooks/useBoundaryTick.ts` — re-render-at-instant hook: single chained
       `setTimeout` armed for the next future boundary, ≤ 24 h chunks (overflow-safe), re-arms after
       each fire, no timer when all boundaries are past, cleanup on unmount / `boundaries` change.
- [x] 2. Create `src/hooks/useBoundaryTick.test.ts` (fake timers): fires exactly at a boundary;
       chains 24 h chunks for a far boundary (> 24.8 days); two boundaries fire in order; all-past
       boundaries arm no timer; unmount clears the pending timer.
- [x] 3. Add i18n keys to `src/i18n/locales/en.json` AND `es.json`:
       `predictions.noPredictionLocked` (neutral copy — must not imply the match is imminent).
- [x] 4. Edit `src/components/FixtureCard.tsx`:
       a. derive `upcoming` (the old `editable` predicate), `editable = upcoming && !locked`,
          `lockedUpcoming = upcoming && locked`;
       b. call `useBoundaryTick(now, [lockMs, kickoff.toMillis()])`;
       c. center slot in `lockedUpcoming`: own pick as read-only `tabular-nums` numerals in
          `text.secondary` (from the `existing` prop — no new reads), or "—" + the
          `predictions.noPredictionLocked` caption when there is no pick;
       d. render the reveal block (button + `MatchPredictionsDialog`, single instance) for
          `showResult || lockedUpcoming`; Save/steppers render ONLY in `editable`;
       e. keep `CountdownToKickoff` in the top-right for `lockedUpcoming` (shows its "Locked" chip).
- [x] 5. Extend `src/components/FixtureCard.test.tsx` — locked-window tests (lazy):
       no Save/Update button, no stepper buttons; reveal button present; click → dialog
       `{ open: true, kickedOff: false }`; own pick "2 – 1" visible with `existing`; localized
       no-pick caption without `existing`. (Spec rules 2 + 4.)
- [x] 6. Extend `FixtureCard.test.tsx` — strict mode: `mode:'strict'` + cutoffs with the group-stage
       window already closed while `now()` is days before kickoff → same rule-2/4 assertions.
       (Spec rule 5.)
- [x] 7. Extend `FixtureCard.test.tsx` — reactivity with fake timers (`vi.setSystemTime`,
       `now = () => Date.now()`): (a) render pre-lock, advance across `LOCK_MS` → Save gone, reveal
       button appears, no manual rerender; (b) dialog open pre-kickoff, advance across `KICKOFF_MS`
       → dialog last called with `kickedOff: true`. (Spec rule 9.)
- [x] 8. Confirm existing pre-lock and live/finished `FixtureCard` tests still pass unchanged
       (spec rules 1 + 3) and `git diff` shows zero changes to `firestore.rules` (spec rule 6).
- [x] 9. Run the full gates: `npm test`, `npm run build`, `npm run lint`, `npx prettier --check .`,
       `npm run test:rules` (unchanged-green). Fix anything red. (Spec rules 6–8.)
- [x] 10. Run `/spec-verify 027` and confirm all 9 acceptance rules pass.
- [x] 11. Update `specs/backlog.md` 027 row to ✅ (or 🟨 if a runtime check remains).

## Verification command(s)
```
npm test
npm run build
npm run lint
npx prettier --check .
npm run test:rules
git diff --stat -- firestore.rules   # must be empty
```
