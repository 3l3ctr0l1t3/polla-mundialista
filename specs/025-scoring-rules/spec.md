# 025 — Per-group, admin-configurable scoring: round bonuses, tie-breakers, and an in-app explainer

> Status: 🟦 spec ready · Depends on: 006, 007, 012, 019 · Specialist: ingestion-engineer + react-mui-builder + firestore-rules-engineer

## Why
A flat per-match score makes the late, high-stakes knockout rounds feel no more valuable than a group game,
and equal-point ties resolve only by name (alphabetical), which feels arbitrary. Different pools also want
different stakes: some want the FINAL to count for a lot, others want every round equal. This ticket lets
each group's **owner/admin configure that group's scoring** — additive flat **round bonuses** plus the base
tiers — with sensible built-in defaults; settles ties on merit (most exact scores, then most correct
outcomes, then who joined first); and adds an in-app explainer so the rules are transparent — all without
touching the base tier logic that participants already trust.

## User story
As a **group admin**, I want **to set my pool's scoring rules — including how much extra each knockout round
is worth — with fair tie-breaking and a clear explanation of how points work**, so that **my group competes
under the stakes we agreed on, the leaderboard rewards bold late-stage calls, and everyone trusts their
ranking**.

## Scope
- **Round bonus (engine).** Extend `ScoringConfig` (`src/shared/scoring.ts`) with
  `roundBonus: Record<MatchStage, number>` — a flat **integer** added to a match's earned points based on its
  `stage`. The bonus is **additive**, never a multiplier: no multiplying, no fractional points, no rounding
  policy. The stage is an **input** passed by the caller, never looked up — the engine stays pure (no I/O, no
  `Date`, no deps). Default gating: the round bonus is added **only when the prediction earned base points**
  (correct outcome or exact); a wrong prediction stays `0` and earns no bonus. The base per-tier `breakdown`
  stays base-only so the exact/outcome **counts** remain stage-independent (planner may add a separate
  `roundBonus` line to `ScoreBreakdown` for transparent display, but classification must read base-only).
  Planner picks the API shape: extend `scorePrediction(pred, actual, cfg, stage?)` or a thin pure helper
  `applyRoundBonus(base, stage, cfg)` — both pure.
- **Defaults (the values we ship).** Base tiers unchanged: `exact 5, outcome 3, goalDiffBonus 1,
  goalDiffOnlyOnCorrectOutcome true, gradeOn 'fullTime90'`. Default round-bonus map (modest, escalating,
  fully admin-overridable): `GROUP_STAGE 0, LAST_32 0, LAST_16 1, QUARTER_FINALS 2, SEMI_FINALS 3, FINAL 4,
  THIRD_PLACE 3`. These are **defaults only** — the admin can change every value (see open questions).
- **Per-group config + freeze (mirrors `mode`, ticket 019).** Add an optional `scoring` config field to the
  `Group` interface in `src/shared/types.ts`, stored at `groups/{gid}.scoring` and **merged over
  `DEFAULT_SCORING`** to yield the group's **effective** config. Add an `effectiveScoring(group)` helper
  concept alongside `effectiveMode(group)` (planner finalizes location, e.g. `src/shared/predictionLock.ts`
  or `scoring.ts`). The config is editable by the group **owner/admin** and **frozen** once
  `request.time ≥ firstCupMatchKickoff − 10min` — the **identical** freeze instant the `mode` field already
  uses (the global `config/tournament` cutoff). Absent `scoring` ⇒ defaults; no backfill.
- **Mode-aware security rules** (`firestore.rules`) for the `groups/{gid}` update, following the
  ticket-019 `mode` precedent (`isOwner`, `isGroupAdmin`, `modeChangeable()`, `onlyModeFieldChanged()`):
  - A group **owner/admin** may set/update `scoring` only **before** the freeze instant
    (`firstCupMatchKickoff − 10min`); the write is **denied** at/after the freeze, for admin and owner alike.
  - The rule must **validate the shape** of `scoring` (the expected keys present; all values **non-negative
    integers**) so a client can't write garbage — tightening today's "owner may update any non-mode field
    freely" so `scoring` is validated and frozen, not free.
  - Every other group invariant (the `mode` rules, membership/approval, ownership) still holds.
  - **Firestore emulator rules tests** (REQUIRED by constitution §7) covering each rule behavior named below,
    using mocked server time around the freeze.
- **Ingestion grades per-group with each group's effective config.** `scripts/ingest/index.ts`
  (`loadScoringConfig`, or a new per-group loader) reads `groups/{gid}.scoring` merged over `DEFAULT_SCORING`;
  grading of **FINISHED** matches uses that group's effective config and the match `stage`, writing the
  integer `points` (and the base `breakdown`). Bump `SCORING_VERSION` so existing predictions re-grade under
  the new engine shape. (Grading is already per-group since predictions are per-group.)
- **Tie-break aggregation.** `scripts/ingest/buildLeaderboard.ts` accumulates `exactCount` and `outcomeCount`
  per member, and the leaderboard sort chain becomes
  `totalPoints DESC → exactCount DESC → outcomeCount DESC → earliest group-join time ASC`, **replacing** the
  current `displayName` tie-break. Join time = member `requestedAt`; the implicit owner (no member doc) uses
  the group's `createdAt` — passed into the aggregation, not invented.
- **Leaderboard UI tie-break.** The client roster/leaderboard sort
  (`useGroupRoster` / `LeaderboardPage` / `LeaderboardRow`) applies the same join-time tie-break (not name),
  keeping client ranking **identical** to the server.
- **Admin scoring editor (UI).** In the group Admin page (`src/pages/AdminPage.tsx`, beside the `mode`
  ToggleButton), an **admin-only** scoring editor: number inputs for the base tiers and the per-round
  bonuses, **prefilled with the group's effective config** (defaults if unset), saved via
  `updateDoc(groupDoc(gid), { scoring })`, and **disabled after the freeze** (like the mode toggle, with a
  frozen hint). Localized en + es.
- **In-app explainer.** A localized "How points work" view (dialog or section reachable from the leaderboard)
  that reads the group's **effective** scoring config and explains the base tiers, the per-round bonuses, and
  the tie-break order. All copy added to BOTH `src/i18n/locales/en.json` and `es.json` so i18n key-parity
  stays green.

## Non-goals
- **No change to the base tier logic/values** — exact = 5, correct outcome = 3, goal-diff bonus = +1, the
  bonus stacks (gated on a correct outcome). Net base totals stay exact = 6, outcome+GD = 4, outcome-only = 3,
  else 0. This ticket only **adds** round bonuses + per-group config + tie-breakers + admin editor + explainer.
- **No multipliers, no fractional points, no rounding policy.** Round bonuses are flat integers.
- No change to the kickoff lock for **predictions**, the prediction write path, the grading trigger (still
  only `status === 'FINISHED'`), or `gradeOn` (full-time 90', before extra time / penalties).
- No change to how `mode` works — the scoring config simply **reuses** the same freeze instant.
- No retroactive backfill of `scoring` onto existing groups (absent ⇒ defaults is sufficient).
- No paid dependency; Firebase **Spark / free-tier** only.

## Acceptance rules (definition of done)
Each rule is verifiable. These are what `/spec-verify` checks.
1. **Engine adds the per-stage integer round bonus, purely.** New Vitest cases prove: exact `FINAL` =
   6 + 4 = **10**; exact `GROUP_STAGE` = 6 (+0); outcome-only `LAST_16` = 3 + 1 = **4**; `QUARTER_FINALS`
   outcome+GD = 4 + 2 = **6**; `LAST_32` = base (+0); and a **wrong** prediction = **0** (no bonus). The
   engine stays pure — no `Date`, `Math.random`, I/O, or new dependency; `stage` and `cfg` are inputs.
2. **Defaults carry the round-bonus map; overrides work.** `DEFAULT_SCORING` yields the default round-bonus
   values; a unit test supplying a `scoring`-style override (e.g. `FINAL` bonus `10`) changes the graded
   result, proving the map is config-driven.
3. **Per-group config + freeze (Firestore emulator tests).** A group owner/admin **can** write a valid
   `groups/{gid}.scoring` when server time `< firstCupMatchKickoff − 10min`; the write is **denied** at/after
   the freeze; a **malformed** shape (missing key, negative, or non-integer value) is **denied**; and a
   **non-admin** member's write to `scoring` is **denied**. The existing `mode` rules and all other group
   invariants still pass.
4. **Ingestion grades each group with its own effective config.** Extended `npm run test:ingest` proves a
   FINISHED match is graded under `group.scoring` merged over defaults, using the match `stage`, writing
   integer `points`; `SCORING_VERSION` is bumped so prior predictions re-grade; and `buildLeaderboard`
   records `exactCount` + `outcomeCount` per member.
5. **Leaderboard ranks by the new chain on BOTH server and client.** A `buildLeaderboard` unit test on a
   crafted tie proves ordering `totalPoints → exactCount → outcomeCount → earliest join time`, and a
   client-side unit test proves the roster/leaderboard sort ranks identically (join-time tie-break, not name).
6. **Admin editor.** An admin sees and edits the group's effective scoring (defaults prefilled) and saves to
   `groups/{gid}.scoring`; the editor is **disabled after the freeze**. A component test asserts the write
   ref/shape (`updateDoc(groupDoc(gid), { scoring })`) and the frozen-disabled state.
7. **Explainer renders and is localized.** The "How points work" view renders the effective tiers, the
   per-round bonuses, and the tie-break order; every new copy key exists in BOTH `en.json` and `es.json` and
   the i18n key-parity test passes.
8. **Quality gates green:** `npm run build`, `npm test`, `npm run lint`, and `npx prettier --check` on the
   touched files all pass; `npm run test:rules` is GREEN, including the new scoring-config rules tests.

## Constitution links
- **Single shared scoring engine** (principle 2): the round bonus lives in the ONE `src/shared/scoring.ts`,
  imported by both app and ingestion — no duplicated grading logic.
- **Two-writers rule** (principle 3): `scoring` is **admin-managed group settings** (exactly like `mode`,
  ticket 019). The browser still **never** writes predictions-results, match `points`, leaderboard docs, or
  standings — those stay **ingestion-only**. This addition does not breach the two-writers rule.
- **Authoritative kickoff lock** (principle 4): the scoring-config freeze is enforced **server-side** in
  `firestore.rules` at `firstCupMatchKickoff − 10min` (the same buffer as the prediction/mode locks); the
  client clock is never trusted.
- **Free-tier only** (principle 6): no paid dependency.
- **Done = tested + meets acceptance rules** (principle 7): the scoring change ships unit tests; the rules
  change ships Firestore emulator tests.

## Notes / open questions
- **Decisions already made (do not re-ask):** additive flat **integer** round bonus (no multipliers, no
  fractions, no rounding); per-group `scoring` config merged over `DEFAULT_SCORING`; admin/owner-editable
  until the **same** freeze instant as `mode` (`firstCupMatchKickoff − 10min`), immutable thereafter;
  ingestion grades each group with its own effective config; tie-break chain
  `points → exactCount → outcomeCount → earliest join time` on server and client.
- **Default round-bonus values + the `THIRD_PLACE` bonus (3)** are owner-confirmable one-line edits in the
  default map. Specced default is the modest escalation
  (`0/0/1/2/3/4` for group→final, `THIRD_PLACE 3`).
- **Default ON vs all-zero.** Whether the shipped default has round bonuses **on** (modest escalation, as
  specced) or **all-zero** (knockouts equal to group stage, admin opts in) — flag for owner; the specced
  default is the modest escalation.
- **Storage shape.** `scoring` as a **field on the group doc** (mirrors `mode`) vs a
  `groups/{gid}/config/scoring` subdoc — planner picks. Field-on-group matches the `mode` precedent and the
  existing "owner may update non-mode fields" rule, which the new shape-validation must **tighten** so
  `scoring` is validated + frozen, not free.
- **Round-bonus gating.** Only on a correct prediction (`base > 0`) vs always added — default is "only when
  base > 0"; planner may expose a flag.
- **`ScoreBreakdown` shape.** Whether it gains a `roundBonus` line for display vs staying base-only — planner
  decides; the exact/outcome **counts** must stay base-only.
- **Engine API.** `scorePrediction(pred, actual, cfg, stage?)` vs a thin `applyRoundBonus(base, stage, cfg)` —
  planner picks; both pure.
- **`SCORING_VERSION` bump** is required so already-graded predictions re-grade under the new engine shape on
  the next ingest run; without it, old `points` linger at the bonus-free value.
