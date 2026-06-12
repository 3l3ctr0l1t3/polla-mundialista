# 034 — Missed prediction counts as 0 (universal accountability + late joiners)

> Status: 🟦 spec ready · Depends on: 006, 007, 012, 018, 025, 032 (coordinate with 033) · Specialist: ingestion-engineer (leaderboard aggregation) + react-mui-builder (card 0-pts state)

## Why
After the first World Cup match graded (2026-06-11), we confirmed the leaderboard only scores
predictions that actually exist, so a member who joins after a match finished — or who simply forgot
to predict — is silently not accountable for it and ends up with fewer graded matches than everyone
else, which is unfair. The owner wants every current participant scored on every finished match: a
missing prediction = **0 points** and still **counts as a graded match**, so the leaderboard has the
same denominator for everyone and late joiners cannot skip past matches.

## User story
As a **group participant**, I want **every finished match to count for everyone — a missed pick
scoring 0 against the same denominator as everyone else** so that **the standings are fair regardless
of when someone joined or whether they forgot to predict**.

## Scope
- **Ingestion leaderboard aggregation** (`scripts/ingest/buildLeaderboard.ts` + `scripts/ingest/index.ts`):
  for each group, iterate over **every current participant** (group owner + approved members) crossed
  with **every FINISHED match**. When that participant has a prediction doc for the match, score it via
  the existing shared engine; when they have **none**, contribute **+0 points** and **+1 to
  `predictionsGraded`** (and **+0** to `exactCount` / `outcomeCount`). Result: `totalPoints` identical
  to today, a corrected `predictionsGraded`, and a single shared denominator across all participants of
  the group.
- **Derived-only 0s:** the missing-pick 0 is computed during aggregation and **derived on the client
  for display** — no phantom prediction document is ever created or written (two-writers rule).
- **Frontend (FixtureCard):** a **FINISHED** match for which the viewer has **no prediction of their
  own** renders an explicit locked **"0 pts — no prediction"** state, reusing ticket 032's points-pill
  / constant-size card structure (tinted as a miss). This amends ticket 032's "no pill when no
  prediction" rule **for finished cards only**: finished + no prediction now shows the explicit 0-pts
  state instead of an empty footer.
- **Tie-breakers preserved:** existing ranking keys (totalPoints, then exactCount, outcomeCount,
  joinedAt) continue to apply unchanged against the new denominator.
- **Tests:** node-env `buildLeaderboard` cases for (a) a late joiner getting 0s for matches finished
  before they joined, (b) an existing member who skipped a match getting 0 with the graded count
  incremented, (c) `totalPoints` unchanged vs prior behavior, (d) `predictionsGraded` equal to the
  finished-match count for every participant.

## Non-goals
- Creating or storing phantom 0-point prediction docs (forbidden by the two-writers rule).
- Changing scoring tiers or editing `src/shared/scoring.ts` (missed = not passed to `scorePrediction`).
- Letting late joiners predict already-locked matches (the kickoff lock already prevents this).
- Retroactive / make-up points for missed matches (missed is 0, period).
- Assigning 0s to non-participants — removed members / orphans (no member doc, not owner) stay off the
  board entirely, consistent with ticket 015 and the 2026-06-11 orphan cleanup.
- Ranking / tie-breaker redesign beyond keeping the existing keys working with the new denominator.
- Counting locked-but-not-yet-FINISHED matches; only FINISHED matches are graded.

## Acceptance rules (definition of done)
Each rule is verifiable. These are what `/spec-verify` checks.
1. **Late joiner is accountable:** in a node-env `buildLeaderboard` test with a fixed dataset, a
   participant whose `joinedAt` is after match M finished has a `LeaderboardEntry.predictionsGraded`
   that **includes M**, with M contributing **0 points** (and 0 to exact/outcome counts).
2. **Same denominator:** for every current participant of a group, `predictionsGraded` equals the
   **number of FINISHED matches**, regardless of join time or skipped picks — asserted across a
   dataset mixing early joiners, late joiners, and members who skipped picks.
3. **Skipped existing member:** an existing member who has no prediction doc for a finished match gets
   **+0 points and +1 graded** for that match (asserted in a node-env test).
4. **`totalPoints` regression-identical:** for every participant, `totalPoints` is byte-for-byte
   identical to the pre-ticket aggregation output (missed picks add 0) — asserted by comparing against
   the prior behavior on the same dataset.
5. **No phantom docs:** the aggregation does **not** create or write any prediction document for a
   missing pick; it only reads predictions and writes `leaderboard/{uid}` — asserted in the node-env
   test (no prediction-collection writes from `buildLeaderboard`).
6. **Non-participants excluded:** a uid with no member doc and not the owner receives **no**
   `LeaderboardEntry` and is **not** assigned 0s — asserted in a node-env test.
7. **FINISHED-only gating:** a match that is locked (kickoff −10min passed) but **not** yet
   `status === 'FINISHED'` is **not** counted toward `predictionsGraded` and does **not** produce a
   "0 pts" state; once it becomes FINISHED with no prediction it does — asserted in the node-env test
   (aggregation) and a component test (card).
8. **Explicit card state:** a FINISHED match with no viewer prediction renders the explicit
   **"0 pts — no prediction"** locked card state (ticket-032 pill, miss tint, constant card size); a
   not-yet-finished locked card does **not** show it — asserted in a component test. New copy added to
   both `en.json` and `es.json` with key parity; colors via theme tokens only.
9. **Gates green:** `npm run test:ingest` passes with the new cases; full gates on touched code
   (`npm test`, `npm run build`, `npm run lint`, prettier on touched files) pass.

## Constitution links
- **§3 Two-writers rule** — the 0-for-a-missed-match is computed by the ingestion aggregation and
  derived on the client; the browser never writes points and no phantom prediction docs are created.
- **§2 Single shared scoring engine** — a missing prediction simply isn't passed to `scorePrediction`;
  no new or duplicated scoring math, and `src/shared/scoring.ts` is untouched.
- **§7 Done = tested** — the aggregation change ships with node-env ingestion tests.
- **§6 Free-tier only** — the aggregation stays cheap and reuses the existing grading read pass; it
  must not read prediction collections more than the current grading pass already does (coordinate with
  ticket 033 ingest cost optimization).

## Notes / open questions
- Assumption: "current participants" = the set the aggregation already enumerates for a group's
  leaderboard (group owner via `groups/{gid}.ownerUid` plus approved `members/{uid}` docs); this ticket
  reuses that set as the cross-product axis against FINISHED matches rather than driving the board from
  existing prediction docs.
- Assumption: the canonical "FINISHED matches" set is the same `matches/{fdId}` where
  `status === 'FINISHED'` already used by the grading pass; `predictionsGraded` is redefined to mean
  "number of finished matches for this group's tournament," which is identical for every participant.
- This ticket intentionally amends ticket 032's "no pill when the viewer has no prediction" rule **for
  FINISHED cards only** — they now show an explicit "0 pts — no prediction" miss state. Live, locked,
  editable, and TBD cards are unchanged.
- The planner should confirm whether the existing aggregation already loads all FINISHED matches and
  the participant set in one pass (so the cross-product adds no new collection-wide reads), and how the
  client derives the displayed denominator/0-pts state without an extra Firestore read.
