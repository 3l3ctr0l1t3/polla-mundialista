# 019 — Tasks

> Generated from plan.md. Ordered, atomic, checkboxed. Check off as you implement.

### Layer 1 — data model + shared lock util (no behavior change yet)
- [x] 1. `src/shared/types.ts`: add `export type PredictionMode = 'lazy' | 'strict'`, add optional
  `mode?: PredictionMode` to `Group` (doc-comment: absent ⇒ `'lazy'`, no backfill), and add the
  `TournamentConfig` interface (`firstCupMatchKickoff` / `firstKnockoutKickoff: Timestamp`).
- [x] 2. `src/shared/predictionLock.ts` (new): `LOCK_BUFFER_MS = 10*60*1000`, `TournamentCutoffsMs`,
  `effectiveMode(group)`, and `lockTimeMs(match, mode, cutoffs?)` per plan (strict→cutoff−buffer by
  stage; lazy/no-cutoffs→`match.kickoff − buffer`).
- [x] 3. `src/shared/predictionLock.test.ts` (new): cover lazy, strict-group, strict-knockout,
  mode-less default, and strict-without-cutoffs fallback. `npm test` green.

### Layer 2 — security rules + tournament config (the integrity backbone)
- [x] 4. `firestore.rules`: add helpers `tournamentCfg()`, `matchStage()`, `groupMode()`,
  `strictWindowOpen()`, `predictionWindowOpen()`, `modeChanged()`, `modeChangeable()`,
  `onlyModeFieldChanged()` (timestamp − `duration.value(10,'m')`).
- [x] 5. `firestore.rules`: repoint predictions **create** and **update** from `beforeKickoff(...)` to
  `predictionWindowOpen(gid, request.resource.data.matchId)` (keep all other create/update clauses).
- [x] 6. `firestore.rules`: replace `groups/{gid}` `allow update, delete: if isOwner(gid)` with the
  mode-aware update (owner: any non-mode change, or a mode change before freeze; non-owner admin:
  **only** a mode change, before freeze, via `onlyModeFieldChanged()`) + keep `allow delete: if isOwner(gid)`.
- [x] 7. `firestore.rules`: update the header comment block (the §4 "AUTHORITATIVE KICKOFF LOCK" lines)
  to state the `request.time < match.kickoff − 10min` buffer and the two strict windows.
- [x] 8. `src/firebase/db.ts`: add `tournamentConfigConverter` + `tournamentConfigDoc` ref for
  `config/tournament` (`groupConverter` stays pass-through).
- [x] 9. `scripts/ingest/tournamentConfig.ts` (new): pure `computeTournamentCutoffs(matches: MatchDoc[])`
  → earliest `GROUP_STAGE` kickoff + earliest `LAST_32` kickoff (admin `Timestamp`).
- [x] 10. `scripts/ingest/tournamentConfig.test.ts` (new): earliest-per-stage, out-of-order input,
  missing-knockout tolerance. `npm run test:ingest` green.
- [x] 11. `scripts/ingest/index.ts`: after `upsertMatches`, write `config/tournament` via
  `computeTournamentCutoffs(matches)` with `{ merge: true }` (alongside the `config/meta` write).

### Layer 3 — UI + i18n
- [x] 12. `src/hooks/useTournamentConfig.ts` (new): live read of `config/tournament` →
  `{ cutoffs?: TournamentCutoffsMs, loading }` (ms numbers).
- [x] 13. `src/hooks/useSavePrediction.ts`: accept `mode` + `cutoffs`; compute `locked` from
  `lockTimeMs(match, mode, cutoffs)` instead of `match.kickoff.toMillis()`.
- [x] 14. `src/components/FixtureCard.tsx`: thread `effectiveMode(group)` + `useTournamentConfig`
  cutoffs into `useSavePrediction` and pass the effective lock ms to `CountdownToKickoff`; render the
  active-mode hint (per-match vs per-window lock copy).
- [x] 15. `src/pages/AdminPage.tsx`: add a "Prediction mode" section — `ToggleButtonGroup` (lazy/strict)
  writing `updateDoc(groupDoc(gid), { mode })`; disabled with a "frozen" note once
  `serverNow ≥ firstCupMatchKickoff − 10min` (reuse `useServerTime` + `useTournamentConfig`); error snackbar
  on a rejected write.
- [x] 16. `src/i18n/locales/en.json` + `es.json`: add keys for mode names, the Admin mode section,
  frozen state, and the strict-window lock copy (parity in both files).

### Tests for the acceptance rules
- [x] 17. `test/rules/helpers.ts`: add relative-time helpers (`now ± N minutes`) and a
  `seedTournamentConfig(env, cutoffs)` helper (rules disabled).
- [x] 18. `test/rules/predictionModes.test.ts` (new): cover AR1–AR10 + the non-owner-admin non-mode-field
  denial (see plan Test strategy). `npm run test:rules` green.
- [x] 19. `src/pages/AdminPage.test.tsx`: assert the toggle renders, reflects current `mode`, and is
  disabled/“frozen” past the freeze instant (AR11). `npm test` green.

### Seed prerequisite, constitution, verify, backlog
- [x] 20. `specs/constitution.md`: amend §4 to the `request.time < match.kickoff − 10min` buffer
  (server-time enforced; same buffer on the two strict windows) — AR13.
- [ ] 21. **Seed prerequisite (runtime, not code):** run `INGEST_FORCE=1 npm run ingest` once so
  `config/tournament` exists in Firestore before any group is switched to strict. Note this in the
  backlog "PENDING" list. (Cannot be verified offline — record as a deploy step.)
- [x] 22. Run gates: `npm run build`, `npm run lint`, `npx prettier --check .`, `npm test`,
  `npm run test:ingest`, `npm run test:rules` — all green (AR14).
- [ ] 23. Run `/spec-verify 019` and confirm all acceptance rules pass.
- [x] 24. Update `specs/backlog.md` status `🟦 → 🟨` (code complete; AR21 seeding pending runtime) and
  add the `config/tournament` seed step to the PENDING follow-ups.

## Verification command(s)
```
npm run build
npm run lint
npx prettier --check .
npm test
npm run test:ingest
npm run test:rules
```
