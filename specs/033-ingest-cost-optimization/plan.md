# 033 — Plan

> Generated from spec.md. Technical design only — no behavior the spec doesn't call for.

## Approach

The quota blowout is caused by the cron doing a **full per-group prediction pass on every one of
~88 ticks/day**, almost all of which are no-ops (no match finished since last tick). The fix is a
**change-detection guard** keyed off a watermark in `config/meta`, plus three smaller wins:

1. **Guard the per-group pass.** Compute a `finishedSig` = order-independent hash of all FINISHED
   matches' `matchId:home-away` (so a *score correction* to an already-finished match also trips it).
   Read `config/meta` once at the top of the run. If `finishedSig === meta.sig.finished` **and**
   `SCORING_VERSION === meta.sig.scoringVersion` **and** not `force` → **skip the entire per-group
   loop** (zero prediction reads, zero leaderboard reads/writes). Update the watermark only when the
   pass actually runs.
2. **Single read per working tick (kill the double read).** Today `gradeGroupPredictions` and
   `rebuildGroupLeaderboard` *each* read the whole `groups/{gid}/predictions` collection — two full
   reads per group per tick. Merge them: read the collection **once**, grade the FINISHED ones in
   memory, write back only the newly-graded docs, then build the leaderboard from the **in-memory**
   set (pre-existing stored points + this run's fresh points). One read per group per working tick.
3. **Diff/sig-gate the global writes.** Compute `matchSig` = hash of every match's
   `status+score+kickoff`. If unchanged vs `meta.sig.matches` and not `force`, skip `upsertMatches`,
   the cutoffs write, and `upsertStandings` (standings only change when matches do). When changed,
   keep the current full upsert (cheap relative to the read savings, and simplest/safest).
4. **Relax cadence.** `ingest.yml` dense windows `*/10` → `*/20`.

Force (`INGEST_FORCE=1`) and a `SCORING_VERSION` bump both bypass every guard → full pass.

**Spec reconciliation (rule 2).** The spec's "read only that match's predictions" is superseded by
win #2: because the leaderboard must aggregate *all* graded predictions to recompute totals, a
targeted `where('matchId','in',…)` grading read would be read *in addition to* the full board read —
a net pessimization. The achievable, strictly-better optimum is **≤1 full predictions read per group
per working tick, 0 on no-op ticks**. Spec acceptance rule 2 is updated to assert exactly that.

## Files to create / change
| Path | Change | Notes |
|------|--------|-------|
| `scripts/ingest/changeDetect.ts` | new | Pure helpers: `finishedSignature(matches)`, `matchSignature(matches)`, and `decidePasses({matchSig,finishedSig,scoringVersion}, prev, force)` → `{ writeGlobals, gradeAndBoard }`. No I/O — fully unit-testable. |
| `scripts/ingest/changeDetect.test.ts` | new | Signature determinism/order-independence/sensitivity; `decidePasses` truth table (no-op, new finish, score correction, status-only change, force, version bump, missing/empty prev → full pass). |
| `scripts/ingest/index.ts` | edit | Read `config/meta` once; gate globals (win #3) and per-group pass (win #1); refactor per-group to a **single** predictions read feeding both grading and the board (win #2); persist `meta.sig`. |
| `scripts/ingest/gradeAndBoard.test.ts` | new | Node-env test with a fake Firestore (read/write counters) proving rules 1, 2(reconciled), 4; regression equality (rule 5) against current behavior on the existing sample fixtures. |
| `.github/workflows/ingest.yml` | edit | Dense windows `*/10` → `*/20` (15-23 and 0-4 UTC); sparse hourly + window early-exit unchanged. |
| `specs/033-ingest-cost-optimization/spec.md` | edit | Reconcile acceptance rule 2 to the single-read design (see above). |

## Data shapes / interfaces
```ts
// config/meta gains a `sig` block (written only by the ingestion service account):
interface IngestSig {
  matches: string        // hash of every match's status+score+kickoff
  finished: string       // hash of FINISHED matches' matchId:home-away
  scoringVersion: number // SCORING_VERSION the per-group pass last ran at
}
// (stored at config/meta.sig; absent on first run after deploy ⇒ treated as a full pass.)

// scripts/ingest/changeDetect.ts (pure)
export function matchSignature(matches: MatchDoc[]): string
export function finishedSignature(matches: MatchDoc[]): string  // FINISHED + non-null score only
export interface PassDecision { writeGlobals: boolean; gradeAndBoard: boolean }
export function decidePasses(
  current: { matchSig: string; finishedSig: string; scoringVersion: number },
  prev: Partial<IngestSig> | undefined,
  force: boolean,
): PassDecision
```

## Reused utilities
- `buildLeaderboard()` (`scripts/ingest/buildLeaderboard.ts`) — unchanged; now fed an in-memory
  prediction set (stored points + this run's fresh grades) instead of a re-read snapshot.
- `scorePrediction()` / `mergeScoring()` (`src/shared/scoring.ts`) — grading semantics untouched.
- `commitInBatches()`, `resolveGroupContext()`, `upsertMatches/Standings()` (`index.ts`) — reused;
  the global upserts are now called conditionally on `writeGlobals`.
- Sample fixtures under `scripts/ingest/sample/` — drive the regression baseline.

## Test strategy
- **changeDetect.test.ts (pure):** signatures are order-independent and stable; flip a score/status →
  signature changes; `decidePasses` truth table covers no-op, new finish, score correction,
  status-only change (globals yes / grade no), `force`, version bump, and empty/absent `prev`.
- **gradeAndBoard.test.ts (fake Firestore):** inject a Firestore double with read/write counters.
  - Rule 1: no-op tick ⇒ 0 prediction reads, 0 prediction/leaderboard writes.
  - Rule 2 (reconciled): a tick with a new finish ⇒ each group's predictions read **once** (counter
    == groups), never twice.
  - Rule 4: `force` and a bumped `SCORING_VERSION` each run the full pass despite an unchanged
    `finishedSig`.
  - Rule 5: leaderboard rows + per-prediction points/breakdown are **identical** to the pre-change
    code path on the sample fixtures (snapshot/byte equality).
- **Suite:** `npm run test:ingest`, `npm run lint`, `npx prettier --check` on touched files (rule 7).
- **Budget (rule 6):** documented below.

### Quota budget (rule 6) — at `*/20` dense cadence
Dense windows 15:00–04:59 UTC = 14h × 3/h = **42 ticks** + sparse 10/h-window ≈ **10 ticks** ≈
**~52 ticks/day**. World Cup days finish ≈ 4–12 matches ⇒ ≤ ~12 **working** ticks/day; the rest are
no-ops.
- **Reads/day:** no-op tick ≈ `config/meta` + `groups` list ≈ ~7 reads × ~52 = **~365**; working
  tick ≈ members + one full predictions read per group ≈ (6 groups × ~100) ≈ ~640 × ≤12 = **~7.7K**.
  Total ≈ **~8K reads/day** ≪ 50K.
- **Writes/day:** only on a global change (≤ ~12 working ticks) — ≤104 matches + 12 standings +
  changed leaderboard rows + newly-graded predictions ≈ ≤ ~250 × ≤12 = **~3K writes/day** ≪ 20K.
Comfortable headroom; well within Spark even before Blaze.

## Risks
- **Guard skips a real finish → no grading.** Mitigation: `finishedSig` keys on `matchId:score` so any
  new finish *or score correction* trips it; absent/empty `meta.sig` ⇒ full pass (safe on first deploy);
  `force` + version bump always bypass. The signature is conservative (any change ⇒ run).
- **In-memory board drift.** Building the board from `stored points ∪ fresh grades` must not double-count
  a prediction graded this run. Mitigation: index by `{uid}_{matchId}`; fresh grade overwrites the stored
  entry before aggregation; covered by the rule-5 regression test.
- **Standings staleness when matches unchanged.** Acceptable — standings only change when matches change,
  so sig-gating them on `matchSig` cannot stale them relative to the data.
- **Mid-tournament behavior change.** Land behind the full test suite + a `force` smoke-run before relying
  on the cron; the regression test guarantees identical scoring output.
