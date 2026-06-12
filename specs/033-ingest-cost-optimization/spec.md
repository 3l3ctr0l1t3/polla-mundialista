# 033 — Ingestion read/write cost optimization (stay within Firebase Spark free tier)

> Status: 🟦 spec ready · Depends on: 008, 012, 025 · Specialist: ingestion-engineer

## Why
On **2026-06-11**, the very first World Cup match (Mexico 2–0 South Africa) finished but **no predictions
were graded**. The investigation surfaced two faults; this ticket addresses the second. **(1, context only —
already fixed in a separate change, not a goal here)** football-data.org's free tier exposed the FINISHED
score on `?status=FINISHED` before it propagated to the unfiltered `/matches` list the ingest reads, so a
score-overlay (`getFinishedMatches()` + merge) was added. **(2, the subject of THIS ticket)** the ingestion
job **exhausted the Firestore Spark free-tier daily quota** (50K reads/day, 20K writes/day) because it is
wasteful: every cron tick it **re-reads all predictions across every group** (~567 prediction docs today,
plus members, groups, and leaderboards ≈ 600+ reads/run) **even when nothing finished**, and it **rewrites
all 104 match docs every run** even when unchanged. At ~88 runs/day (every 10 min) that is ~53K reads/day —
over the 50K read cap — and ~13.6K writes/day, uncomfortably close to the 20K write cap. The intended
outcome: make the job comfortably free-tier-viable for the whole tournament by reading and writing only what
changed, **without altering any scoring result** (identical points and leaderboards).

## User story
As a **participant**, I want **results to keep grading reliably for the whole tournament** so that **the
ingestion job never silently dies from hitting the free-tier quota and the leaderboard stays correct and
current**.

## Scope
- **Change-detection guard (skip the no-op run).** Persist a watermark in `config/meta` (e.g. a set/count of
  FINISHED `matchId`s, or a per-match `status+score` hash) recording the graded state of the last run. On a
  run where **no match newly finished or changed score/status** since that watermark, **SKIP the entire
  per-group pass**: no prediction reads, no grading, no leaderboard reads/writes. The watermark is updated
  whenever the per-group pass runs.
- **Single predictions read per working tick (kill the double read).** Today the per-group pass reads the
  whole `groups/{gid}/predictions` collection **twice** (once to grade, once to rebuild the board). Because
  the leaderboard must aggregate *all* graded predictions to recompute totals, a targeted
  `where('matchId','in',…)` grading read would be *additional to* an unavoidable full board read — a net
  pessimization. Instead, read each group's predictions **at most once** per working tick, grade the newly
  FINISHED ones in memory, and build the board from that same in-memory set (stored points ∪ this run's fresh
  grades). Combined with the guard above: **0 prediction reads on a no-op tick, ≤1 per group on a working
  tick** (down from 2 per group on *every* tick). *(Refined from the original "targeted reads" wording during
  planning — see plan.md.)*
- **Write only changed match docs (diff-before-write).** Before upserting a `matches/{fdId}` doc, compare the
  incoming `status + score + kickoff` to what is already stored; **skip the write** when unchanged. Only
  changed match docs are written, replacing the current "rewrite all 104 every run" behavior.
- **Relax the cron cadence.** Change `.github/workflows/ingest.yml` from every 10 min to **~every 20–30 min**
  during match windows (still within the ~15–30 min result-freshness expectation). Off-hours sparsity and the
  June 11 – July 19 early-exit guard remain.
- **Preserve `scoringVersion` re-grade.** A `SCORING_VERSION` bump must still force a **full** read+grade pass;
  the change-detection guard must **not** suppress an intentional version-driven regrade.
- **Preserve the manual force path.** A `workflow_dispatch` / `INGEST_FORCE` run must **bypass** the
  change-detection guard and perform a full read+grade pass.
- **Node-env tests** under `scripts/ingest/` (injected/fake Firestore) covering the guard, targeted reads,
  diff-before-write, the force bypass, and the version-bump regrade; plus a regression test asserting grading
  output is unchanged.

## Non-goals
- The football-data score-overlay fix (already done — fault #1 above).
- Migrating off Spark / enabling Blaze. This ticket must keep the job free-tier-viable **regardless** of any
  later ops decision on billing.
- Any client-side caching or persistent local cache (separate concern).
- Changing scoring math, tiers, round bonuses, leaderboard ranking, or tie-breakers (those are tickets 006 /
  025). Output must be byte-for-byte identical for the same inputs.
- CDN / static leaderboard snapshots — over-engineering at current scale.
- New UI; no Cloud Functions (forbidden on Spark).

## Acceptance rules (definition of done)
Each rule is verifiable. These are what `/spec-verify` checks.
1. **No-op run does zero prediction work.** A node-env test with a fake/injected Firestore proves a run where
   **nothing newly finished or changed** performs **zero** prediction-document reads and writes **zero**
   prediction/leaderboard docs (asserted via read/write counters on the fake Firestore).
2. **At-most-one predictions read per working tick.** A test where one or more matches newly finish proves the
   job reads each group's `predictions` collection **exactly once** (not the previous twice), feeding both
   grading and the leaderboard from that single snapshot (asserted via the read counter == group count).
3. **Diff-before-write on match docs.** A test proves `matches/{fdId}` upserts are **skipped** for matches
   whose stored `status + score + kickoff` are unchanged, and **performed** only for changed ones (asserted
   via the write counter).
4. **Force and version bump force a full pass.** A `workflow_dispatch` / `INGEST_FORCE` run **and** a
   `SCORING_VERSION` bump each **bypass** the change-detection guard and trigger a **full** read+grade pass
   (two tests, each asserting the per-group pass ran despite no fresh finish).
5. **Grading output is unchanged (regression).** For the same inputs, the points / `breakdown` / leaderboard
   produced after optimization are **byte-for-byte identical** to the pre-optimization behavior (regression
   test over a fixture set).
6. **Quota budget documented and under the caps.** `plan.md` (or a `config/meta`-adjacent doc) records the
   estimated **daily reads and writes** under the new cadence and shows both are **< the Spark caps**
   (50K reads/day, 20K writes/day) with comfortable headroom.
7. **Suite green.** `npm run test:ingest` stays GREEN with the new guard/targeted-read/diff/force/regression
   tests added; `npm run lint` and `npx prettier --check` on the touched files pass.

## Constitution links
- **Free-tier only (principle 6).** The core driver: the job must run within Firebase **Spark** quotas
  (50K reads / 20K writes per day) for the whole tournament, no Cloud Functions, public-repo Actions.
- **Single shared scoring engine (principle 2).** Optimization touches *when/what* is read and graded, never
  *how* — `src/shared/scoring.ts` and grading semantics are unchanged and not duplicated.
- **Two-writers rule (principle 3).** The **ingestion service account** remains the only writer of match
  results, leaderboard, and standings; this ticket only reduces how often/much it writes.
- **Done = tested + meets acceptance rules (principle 7).** Node-env ingestion unit tests are required and
  must stay green.

## Notes / open questions
- **Assumption — watermark location.** The watermark lives in the existing `config/meta` doc (alongside
  `lastIngestRun`); planner picks the exact shape (set of FINISHED ids vs per-match `status+score` hash). A
  hash detects **score corrections** to an already-FINISHED match, not just new finishes — recommended so a
  late score fix still triggers a regrade.
- **Assumption — cadence.** Specced at ~every 20 min in match windows (within the ~15–30 min freshness
  expectation); planner may pick 25–30 min if the read/write budget needs more headroom. Re-derive the
  reads/writes-per-day estimate (acceptance rule 6) from the chosen cadence.
- **Assumption — `in`-clause batching.** Firestore limits `where(field,'in',[…])` to a bounded array; when
  more matches finish in one window than the limit, the targeted-read query is **batched**. Planner confirms
  the current limit and batching strategy.
- **Standings/match upserts vs the guard.** Match-doc upserts use diff-before-write and may still run on a
  guarded (no-newly-finished) tick; the guard skips only the **per-group prediction + grading + leaderboard**
  pass. Planner confirms whether standings upserts also diff-before-write or run every tick (low row count).
- **Regression baseline.** Capture the pre-optimization grading output for a fixture set first, so rule 5 can
  assert byte-for-byte equality after the change.
