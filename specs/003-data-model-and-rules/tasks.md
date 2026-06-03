# 003 — Tasks

> Generated from plan.md. Ordered, atomic, checkboxed. Check off as you implement.

- [x] 1. Define Firestore document interfaces in `src/shared/types.ts` (import `ScoringConfig` from `./scoring`).
- [x] 2. Build typed converters + collection refs + doc helpers in `src/firebase/db.ts`.
- [x] 3. Replace deny-all `firestore.rules` with real rules: read-only public collections, owner users
  (no `isAdmin`), kickoff-locked owner-only predictions, no `points`/`breakdown` tampering, `isMember()` allowlist.
- [x] 4. Add composite indexes to `firestore.indexes.json` (matches status+kickoff, matches group+kickoff,
  predictions uid+matchId).
- [x] 5. Add the Firestore emulator block to `firebase.json`.
- [x] 6. Wire the rules-test run: exclude `test/rules/**` from default `npm test`; add `test:rules` script +
  `vitest.rules.config.ts`.
- [x] 7. Write emulator rules-unit-tests under `test/rules/` (predictions, results, users).
- [x] 8. Run `npm run test:rules` and make them green.
- [x] 9. Run `npm run build` to confirm types compile.
- [ ] 10. `/spec-verify 003` and confirm all acceptance rules pass (parent runs this).
- [ ] 11. Update `specs/backlog.md` status to ✅ (owned by parent — not edited by this agent).

## Verification command(s)
```
npm run test:rules
npm run build
```
