# 019 — Group prediction modes (Lazy vs Strict)

> Status: ⬜ not started · Depends on: 012, 013, 018 · Specialist: firestore-rules-engineer + react-mui-builder

## Why
Different pools want different rules for *when* members can predict: some prefer the relaxed
"predict each match until just before it starts" cadence, others want a competition where everyone
locks in their whole bracket up front. Today the app supports only the former and the lock fires
exactly at kickoff. This ticket gives each group an owner-chosen **prediction mode** (Lazy or
Strict) and adds a uniform **10-minute pre-kickoff buffer**, both enforced authoritatively in
security rules.

## User story
As a **group admin**, I want to choose whether my pool predicts match-by-match (Lazy) or in two
locked batch windows (Strict), so that **my group competes under the rhythm we agreed on and nobody
can edit predictions after the cutoff that applies to them**.

## Scope
- **Data model.** Add an optional `mode: PredictionMode` field to the `Group` interface in
  `src/shared/types.ts`, where `type PredictionMode = 'lazy' | 'strict'`. **Absent ⇒ `'lazy'`**
  (back-compat for all existing groups; no backfill). Update the typed Firestore converter in
  `src/firebase/db.ts` so reads default a missing `mode` to `'lazy'` and writes round-trip it.
- **Global tournament config.** Introduce a global top-level doc **`config/tournament`** holding the
  two cutoff timestamps the rules need:
  - `firstCupMatchKickoff` — kickoff of the first `GROUP_STAGE` match of the cup.
  - `firstKnockoutKickoff` — kickoff of the first `LAST_32` match.
  This doc is written **only** by the ingestion service account / admin SDK (two-writers rule) and is
  **read-only** for the browser. Add it to the ingestion seed/maintenance path so the values exist.
- **Mode-aware security rules** (`firestore.rules`) for `groups/{gid}/predictions/{uid}_{matchId}`
  create/update, using SERVER time only:
  - **Lazy** (or absent mode): allowed while `request.time < match.kickoff − 10min`.
  - **Strict, `GROUP_STAGE` prediction:** allowed while
    `request.time < config/tournament.firstCupMatchKickoff − 10min`.
  - **Strict, knockout prediction** (`LAST_32 … FINAL`, incl. third-place): allowed while
    `request.time < config/tournament.firstKnockoutKickoff − 10min` — independent of that match's
    own kickoff.
- **Group `mode` write rule** (`firestore.rules`): only a group admin (`isGroupAdmin(gid)` — owner or
  approved member with `role:'admin'`) may set/change `mode`; any write that changes `mode` is denied
  once `request.time ≥ config/tournament.firstCupMatchKickoff − 10min` (immutability / **freeze
  instant**), for admins and owner alike.
- **Firestore emulator rules tests** (REQUIRED by constitution §7) covering every acceptance rule below
  that names a rule behavior, using mocked server time around the relevant cutoffs.
- **Admin UI** (group Admin page): show the current mode, let an admin switch Lazy↔Strict, and disable
  the control showing a "locked" state once past the freeze instant.
- **Predictions UI copy via i18n** (Spanish + English, building on ticket 017): the predictions surface
  explains the active mode and the **next lock time** — per-match in Lazy, per-window in Strict.
- **Constitution amendment.** Update `specs/constitution.md` §4 to state the lock is
  `request.time < match.kickoff − 10min` (server-time enforced), generalizing for the two strict windows.

## Non-goals
- No change to the scoring engine (`src/shared/scoring.ts`), grading, or leaderboard math.
- No change to how matches/stages are ingested — `stage` and `group` already exist on `Match`.
- No per-match override inside a Strict group; no third "hybrid" mode.
- No global tournament-config **editor UI** — the cutoffs come from ingestion/seed, not a screen.
- No retroactive backfill of `mode` onto existing groups (absent ⇒ lazy is sufficient).

## Acceptance rules (definition of done)
Each rule is verifiable. These are what `/spec-verify` checks.

1. **Legacy default.** A group document with no `mode` field behaves exactly as Lazy in both the
   security rules and the converter (converter read yields `'lazy'`; rules apply the lazy branch).
   Covered by an emulator test on a mode-less group.
2. **Lazy buffer — allowed.** In a Lazy (or mode-less) group, a prediction create/update for a match
   is **allowed** when mocked server time is `kickoff − 11min`. (emulator test)
3. **Lazy buffer — denied.** Same prediction is **denied** when server time is `kickoff − 9min`, and
   denied at any time after. (emulator test)
4. **Strict group window — allowed.** In a Strict group, a `GROUP_STAGE` prediction is **allowed**
   when server time `< config/tournament.firstCupMatchKickoff − 10min`. (emulator test)
5. **Strict group window — denied.** The same `GROUP_STAGE` prediction is **denied** when server time
   `≥ firstCupMatchKickoff − 10min`, regardless of that individual match's own kickoff. (emulator test)
6. **Strict knockout window — allowed independent of match kickoff.** In a Strict group, a knockout
   prediction (e.g. the FINAL) is **allowed** when server time `< firstKnockoutKickoff − 10min` even if
   that is days/weeks before the match's own kickoff. (emulator test)
7. **Strict knockout window — denied after close.** The same knockout prediction is **denied** when
   server time `≥ firstKnockoutKickoff − 10min`, even though the match itself has not yet kicked off.
   (emulator test)
8. **Mode write — admin only.** A group admin (owner or `role:'admin'` member) may set/change `mode`
   while before the freeze instant; a non-admin member's write to `mode` is **denied**. (emulator test)
9. **Mode immutability after freeze.** Any write that changes `mode` is **denied** once server time
   `≥ firstCupMatchKickoff − 10min`, for admin and owner alike. (emulator test)
10. **Tournament config access.** `config/tournament` is **readable** by any signed-in client and
    **writable by no client** (admin-SDK only). Both branches covered by emulator tests.
11. **Admin UI state.** The group Admin page shows the active mode and offers a Lazy↔Strict switch
    before the freeze instant; after the freeze instant the switch is disabled and shows a frozen/locked
    state. (verifiable in the running app / component test)
12. **i18n copy.** The predictions UI surfaces the active mode and the next lock time, with both Spanish
    and English strings present (no missing-key fallbacks).
13. **Constitution updated.** `specs/constitution.md` §4 text reads `request.time < match.kickoff − 10min`
    (server-time enforced), consistent with this ticket.
14. **Green gates.** `npm run build`, `npm run lint`, and `npm run test:rules` all pass.

## Constitution links
- **§3 Two-writers rule** — the browser writes only its own per-group prediction (pre-cutoff);
  `config/tournament` and leaderboard remain admin-SDK-only.
- **§4 Authoritative kickoff lock** — **AMENDED by this ticket** from `request.time < match.kickoff`
  to `request.time < match.kickoff − 10min`, still server-time enforced; the strict windows apply the
  same −10min buffer to the two batch cutoffs.
- **§7 Done = tested** — security-rule changes ship with Firestore emulator tests.

## Notes / open questions
- **Decisions already made (do not re-ask):** 10-minute buffer in BOTH modes; default/absent ⇒ lazy
  with no backfill; admin-switchable Lazy↔strict until the freeze instant
  `firstCupMatchKickoff − 10min`, immutable thereafter; the two cutoffs live in `config/tournament`,
  browser read-only. The constitution §4 edit is in scope for this ticket.
- **Field type:** recommend a string enum `type PredictionMode = 'lazy' | 'strict'` on `Group.mode?`,
  absent treated as `'lazy'` in both the converter and the rules. Planner to confirm exact naming.
- **Cutoff provenance:** open — are `firstCupMatchKickoff` / `firstKnockoutKickoff` computed at
  ingestion time as `min(kickoff)` per stage (`GROUP_STAGE`, `LAST_32`), or seeded manually? Computed
  is preferred so they self-correct if fixtures shift; planner to decide how/when the ingestion job
  refreshes them.
- **Freeze instant choice:** the spec uses `firstCupMatchKickoff − 10min` (not exactly first kickoff)
  so a group can never switch INTO strict after the strict group-stage window has already closed,
  avoiding retroactively locking members out. Planner to confirm.
- **Rules cost:** the prediction rule must `get()` the group doc (for `mode`), the match doc (for
  `stage`/`kickoff`), and `config/tournament` (for the two cutoffs) in a single evaluation — confirm
  this stays within the document-read limits for a rules evaluation.
- **UI "next lock" presentation:** Lazy shows a per-match countdown (as ticket 018 already does);
  Strict shows a single per-window lock time. Planner to decide the exact placement/wording.
