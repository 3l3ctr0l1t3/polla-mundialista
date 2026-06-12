# 033 — Tasks

> Generated from plan.md. Ordered, atomic, checkboxed. Check off as you implement.

- [x] 1. Create `scripts/ingest/changeDetect.ts` — pure `matchSignature`, `finishedSignature`, and `decidePasses(current, prev, force)` → `{ writeGlobals, gradeAndBoard }`. No I/O.
- [x] 2. Create `scripts/ingest/changeDetect.test.ts` — signature determinism/order-independence/sensitivity + `decidePasses` truth table (no-op, new finish, score correction, status-only change, force, version bump, absent prev ⇒ full pass).
- [x] 3. Edit `scripts/ingest/index.ts`: read `config/meta` once; compute `matchSig`/`finishedSig`; gate `upsertMatches`+cutoffs+`upsertStandings` on `writeGlobals`; gate the per-group loop on `gradeAndBoard`; persist `meta.sig` only when the pass runs.
- [x] 4. Edit `scripts/ingest/index.ts`: refactor the per-group pass to **one** `predictions` read feeding both grading (in memory) and `buildLeaderboard` (stored points ∪ fresh grades) — eliminate the second read.
- [x] 5. Edit `.github/workflows/ingest.yml`: dense windows `*/10` → `*/20` (15-23 and 0-4 UTC); leave sparse hourly + window early-exit.
- [x] 6. Create `scripts/ingest/gradeAndBoard.test.ts` — fake Firestore w/ read/write counters: rule 1 (no-op ⇒ 0 pred reads/writes), rule 2 (working tick ⇒ 1 pred read/group), rule 4 (force + version bump ⇒ full pass), rule 5 (grading/board byte-identical to baseline on sample fixtures).
- [x] 7. Edit `specs/033-ingest-cost-optimization/spec.md` rule 2 — reconcile to the single-read design (DONE during planning; verify wording — confirmed: rule 2 already reads "At-most-one predictions read per working tick").
- [ ] 8. Run `/spec-verify 033` and confirm all acceptance rules pass.
- [ ] 9. Update `specs/backlog.md` status to ✅ (or 🟨 pending live cron smoke-run).

## Verification command(s)
```
npm run test:ingest
npm run lint
npx prettier --check scripts/ingest/changeDetect.ts scripts/ingest/index.ts .github/workflows/ingest.yml
# optional live smoke (writes prod via service account): INGEST_FORCE=1 npm run ingest
```
