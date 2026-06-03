# 005 — Tasks

> Generated from plan.md. Ordered, atomic, checkboxed. Check off as you implement.

- [x] 1. `useServerTime` — establish a server-time offset via `serverTimestamp()` round-trip; expose `now()`,
      `offsetMs`, `offsetKnown`; graceful `Date.now()` fallback.
- [x] 2. `useMyPredictions` — `onSnapshot` of `predictions where uid == me`; return map by matchId; clean up.
- [x] 3. `CountdownToKickoff` — live countdown on server time; "Locked" chip once kickoff passes.
- [x] 4. `PredictionInput` — integer goal steppers (≥0), disabled at/after kickoff; `setDoc(..., { merge })`
      with `updatedAt` always + `createdAt` only when new; never writes points/breakdown; snackbar on
      `permission-denied`.
- [x] 5. `PredictionsPage` — list upcoming matches (local matches subscription) with Loading/Empty/Error,
      each row = countdown + prediction input prefilled from `useMyPredictions`.
- [x] 6. Write/adjust tests for the acceptance rules (`PredictionInput.test.tsx`).
- [x] 7. Run `npx vitest run src/components/PredictionInput.test.tsx` and confirm pass.
- [ ] 8. Run `/spec-verify 005` and confirm all acceptance rules pass.
- [ ] 9. Update `specs/backlog.md` status to ✅

## Verification command(s)
```
npx vitest run src/components/PredictionInput.test.tsx
```
