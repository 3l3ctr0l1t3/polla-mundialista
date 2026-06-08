# 019 — Plan

> Generated from spec.md. Technical design only — no behavior the spec doesn't call for.

## Approach

Add a per-group `mode: 'lazy' | 'strict'` (absent ⇒ `lazy`) and a uniform **10-minute pre-kickoff
buffer**, enforced authoritatively in `firestore.rules` and mirrored as UI convenience.

Three layers, in dependency order:

1. **Data model + shared lock util** (`src/shared`). Add `PredictionMode`, a `mode?` field on `Group`,
   a `TournamentConfig` doc type, and ONE pure `lockTimeMs(match, mode, cutoffs)` helper that both the
   client lock and the countdown consume. No duplicated lock math — the rules and this helper express
   the same formula (`kickoff − 10min`, or the strict window cutoff − 10min).

2. **Security rules + tournament config** (`firestore.rules`, `scripts/ingest`). The prediction
   create/update lock becomes **mode-aware**: lazy → `request.time < match.kickoff − 10min`; strict →
   `request.time < cutoff − 10min` where the cutoff is read from a new global `config/tournament` doc
   (`firstCupMatchKickoff` for `GROUP_STAGE`, `firstKnockoutKickoff` for knockout). The group `mode`
   becomes admin-writable but **frozen** at `firstCupMatchKickoff − 10min`. The ingestion job seeds/refreshes
   `config/tournament` (computed `min(kickoff)` per stage) — the two-writers rule keeps it admin-SDK-only,
   which the existing `match /config/{docId}` rule already enforces (read: signed-in; write: false).

3. **UI** (`AdminPage`, the fixture card, i18n). A mode toggle on the group Admin page (disabled +
   "frozen" once past the freeze instant), and the fixture card's countdown/lock driven by `lockTimeMs`
   instead of raw `match.kickoff`, plus copy explaining the active mode and next lock time.

**Back-compat is load-bearing:** the rules read `mode` with a default of `'lazy'` and only `get()`
`config/tournament` on the **strict** branch — so every existing (mode-less) group keeps working exactly
as today, and a missing `config/tournament` never breaks lazy groups.

## Files to create / change

| Path | Change | Notes |
|------|--------|-------|
| `src/shared/types.ts` | edit | `export type PredictionMode = 'lazy' \| 'strict'`; add `mode?: PredictionMode` to `Group`; add `TournamentConfig` doc interface (`firstCupMatchKickoff`/`firstKnockoutKickoff: Timestamp`). |
| `src/shared/predictionLock.ts` | **new** | Pure helpers: `LOCK_BUFFER_MS = 10*60*1000`, `effectiveMode(group)`, `lockTimeMs(match, mode, cutoffs?)`. The single client-side source of the lock formula. |
| `src/shared/predictionLock.test.ts` | **new** | Unit tests: lazy = kickoff−10min; strict group/knockout = cutoff−10min; mode-less ⇒ lazy; strict w/o cutoffs falls back to kickoff−10min. |
| `firestore.rules` | edit | Add `tournamentCfg()`/`matchStage()`/`groupMode()`/`predictionWindowOpen()`/`strictWindowOpen()`/`modeChanged()`/`modeChangeable()`/`onlyModeFieldChanged()` helpers; repoint prediction create/update from `beforeKickoff(...)` to `predictionWindowOpen(gid, ...)`; widen `groups/{gid}` update to allow an admin mode change before freeze (owner keeps full update of non-mode fields). Update the §4 comment block (lines 12–15). |
| `src/firebase/db.ts` | edit | Add `tournamentConfigConverter` + `tournamentConfigDoc` ref (`config/tournament`). `groupConverter` stays pass-through (default handled by `effectiveMode`). |
| `scripts/ingest/tournamentConfig.ts` | **new** | Pure `computeTournamentCutoffs(matches: MatchDoc[])` → `{ firstCupMatchKickoff, firstKnockoutKickoff }` (admin `Timestamp`, `min(kickoff)` per stage). |
| `scripts/ingest/tournamentConfig.test.ts` | **new** | Offline unit test (`test:ingest`): picks the earliest `GROUP_STAGE` and earliest `LAST_32` kickoff; tolerates a missing stage / out-of-order input. |
| `scripts/ingest/index.ts` | edit | After `upsertMatches`, write `config/tournament` via `computeTournamentCutoffs(matches)` (`merge:true`). |
| `src/hooks/useTournamentConfig.ts` | **new** | Live read of `config/tournament` → `{ cutoffs?, loading }` (ms numbers for the UI). |
| `src/hooks/useSavePrediction.ts` | edit | `locked` uses `lockTimeMs(match, mode, cutoffs)` instead of `match.kickoff.toMillis()`. Accept `mode`/`cutoffs` (threaded from the card). |
| `src/components/FixtureCard.tsx` | edit | Pass the effective lock ms (`lockTimeMs(...)`) to `CountdownToKickoff` and `useSavePrediction`; render the active-mode hint. |
| `src/pages/AdminPage.tsx` | edit | New "Prediction mode" section: `ToggleButtonGroup` (lazy/strict) writing `updateDoc(groupDoc(gid), { mode })`; disabled with a "frozen" note once `serverNow ≥ firstCupMatchKickoff − 10min`. |
| `src/i18n/locales/en.json`, `es.json` | edit | Keys for mode names, the Admin section, frozen state, and the strict-window lock copy. |
| `test/rules/predictionModes.test.ts` | **new** | Emulator tests for acceptance rules 1–10 (lazy buffer, strict windows, mode write/immutability, config access). |
| `test/rules/helpers.ts` | edit | Add relative-time kickoff/cutoff helpers (`now ± N min`) + a `seedTournamentConfig` helper. |
| `specs/constitution.md` | edit | §4 wording → `request.time < match.kickoff − 10min` (server-time enforced; same buffer on the two strict windows). |

## Data shapes / interfaces

```ts
// src/shared/types.ts
export type PredictionMode = 'lazy' | 'strict'

export interface Group {
  // …existing fields…
  /** When/how members may predict. Absent ⇒ 'lazy' (back-compat; no backfill). */
  mode?: PredictionMode
}

/** `config/tournament` — global, admin-SDK-written cutoffs the rules read for strict groups. */
export interface TournamentConfig {
  /** Kickoff of the first GROUP_STAGE match (the cup's first match). */
  firstCupMatchKickoff: Timestamp
  /** Kickoff of the first LAST_32 (knockout) match. */
  firstKnockoutKickoff: Timestamp
}

// src/shared/predictionLock.ts
export const LOCK_BUFFER_MS = 10 * 60 * 1000
export interface TournamentCutoffsMs {
  firstCupMatchKickoffMs: number
  firstKnockoutKickoffMs: number
}
export function effectiveMode(group: Pick<Group, 'mode'>): PredictionMode {
  return group.mode ?? 'lazy'
}
/** The instant (ms) a prediction for `match` locks, given the group's mode + cutoffs. */
export function lockTimeMs(
  match: Pick<Match, 'kickoff' | 'stage'>,
  mode: PredictionMode,
  cutoffs?: TournamentCutoffsMs,
): number {
  if (mode === 'strict' && cutoffs) {
    const base =
      match.stage === 'GROUP_STAGE'
        ? cutoffs.firstCupMatchKickoffMs
        : cutoffs.firstKnockoutKickoffMs
    return base - LOCK_BUFFER_MS
  }
  return match.kickoff.toMillis() - LOCK_BUFFER_MS
}
```

```js
// firestore.rules — new helpers (timestamp arithmetic + duration)
function tournamentCfg() {
  return get(/databases/$(database)/documents/config/tournament).data;
}
function matchStage(matchId) {
  return get(/databases/$(database)/documents/matches/$(matchId)).data.stage;
}
function groupMode(gid) {
  return groupData(gid).get('mode', 'lazy');           // absent ⇒ 'lazy'
}
function strictWindowOpen(matchId) {
  return matchStage(matchId) == 'GROUP_STAGE'
    ? request.time < tournamentCfg().firstCupMatchKickoff - duration.value(10, 'm')
    : request.time < tournamentCfg().firstKnockoutKickoff - duration.value(10, 'm');
}
function predictionWindowOpen(gid, matchId) {
  return exists(/databases/$(database)/documents/matches/$(matchId))
    && (groupMode(gid) == 'strict'
        ? strictWindowOpen(matchId)
        : request.time < matchKickoff(matchId) - duration.value(10, 'm'));
}
// group-mode write gating
function modeChanged() {
  return resource.data.get('mode', 'lazy') != request.resource.data.get('mode', 'lazy');
}
function modeChangeable() {
  // Open until the freeze instant; if config/tournament not yet seeded, treat as open
  // (the tournament hasn't been configured, so it's necessarily before the first match).
  return !exists(/databases/$(database)/documents/config/tournament)
    || request.time < tournamentCfg().firstCupMatchKickoff - duration.value(10, 'm');
}
function onlyModeFieldChanged() {
  return request.resource.data.diff(resource.data).affectedKeys().hasOnly(['mode']);
}
```

```js
// firestore.rules — predictions create/update (replace beforeKickoff(...) call)
allow create: if isGroupMember(gid)
  && request.auth.uid == request.resource.data.uid
  && predId == request.auth.uid + '_' + request.resource.data.matchId
  && predictionShapeValid()
  && predictionWindowOpen(gid, request.resource.data.matchId);
// update: identical swap of beforeKickoff(...) → predictionWindowOpen(gid, ...)

// firestore.rules — groups/{gid} update (was: allow update, delete: if isOwner(gid))
allow update: if
  (isOwner(gid) && (!modeChanged() || modeChangeable()))
  || (!isOwner(gid) && isGroupAdmin(gid) && modeChanged() && modeChangeable() && onlyModeFieldChanged());
allow delete: if isOwner(gid);
```

```ts
// scripts/ingest/tournamentConfig.ts
export function computeTournamentCutoffs(matches: MatchDoc[]): {
  firstCupMatchKickoff: Timestamp
  firstKnockoutKickoff: Timestamp
} {
  // firstCupMatchKickoff = min kickoff where stage === 'GROUP_STAGE'
  // firstKnockoutKickoff = min kickoff where stage === 'LAST_32'
  // (min over matches[].kickoff.toMillis(); return the admin Timestamp of the earliest.)
}
```

## Reused utilities

- **`groupData(gid)` / `matchKickoff(matchId)`** in `firestore.rules` — reused for `groupMode`/lock;
  identical `get()`s are cached within one rule evaluation, so the added reads collapse.
- **`isOwner`/`isGroupAdmin`** (`firestore.rules`) — the mode-write authority; no new membership logic.
- **Existing `match /config/{docId}`** rule already makes `config/tournament` read-only to clients →
  **acceptance rule 10 needs no new rule**, just tests.
- **`CountdownToKickoff` + `useServerTime` `now()`** — the countdown/lock already run on server-corrected
  time; we only swap the **target instant** to `lockTimeMs(...)`. No new clock code.
- **`commitInBatches` / `mapMatch` `MatchDoc`** (`scripts/ingest`) — the cutoff doc is one more
  `db.doc('config/tournament').set(..., {merge:true})` alongside the existing `config/meta` write.
- **`useGroup()`** already exposes the current `group` (with `mode`) to the card/Admin page.

## Test strategy

Each acceptance rule → a concrete check:

- **Emulator (`test/rules/predictionModes.test.ts`, `npm run test:rules`)** — seed groups, matches, and
  `config/tournament` with rules disabled; assert with relative kickoffs/cutoffs (real `request.time`,
  the established pattern). Offsets use minutes so the seed↔assert latency (ms) is negligible:
  - **AR1** mode-less group → create allowed at `kickoff = now+11m`, denied at `now+9m` (lazy branch).
  - **AR2/AR3** lazy group → allowed at `now+11m`, denied at `now+9m` and `now−1m`.
  - **AR4/AR5** strict group, `GROUP_STAGE` pred → allowed when `firstCupMatchKickoff = now+11m`;
    denied when `now+9m`, **even though that match's own kickoff is far future**.
  - **AR6/AR7** strict group, knockout (`LAST_32`) pred → allowed when `firstKnockoutKickoff = now+11m`
    with the match's own kickoff weeks out; denied when `firstKnockoutKickoff = now+9m`, match unkicked.
  - **AR8** non-admin member write to `mode` denied; admin (and owner) allowed before freeze.
  - **AR9** any `mode` change denied when `firstCupMatchKickoff = now+9m` (≥ freeze), owner & admin.
  - **AR10** any signed-in client reads `config/tournament` (succeeds); any client write fails.
  - Plus: a non-owner admin attempting to change a NON-mode field (e.g. `name`) is denied
    (`onlyModeFieldChanged` guard).
- **Unit (`src/shared/predictionLock.test.ts`, `npm test`)** — `lockTimeMs`/`effectiveMode` formula:
  lazy, strict-group, strict-knockout, mode-less default, strict-without-cutoffs fallback. Proves the
  client mirror matches the rule formula (AR2–AR7 convenience side).
- **Unit (`scripts/ingest/tournamentConfig.test.ts`, `npm run test:ingest`)** — earliest `GROUP_STAGE`
  and earliest `LAST_32` selected; out-of-order input; missing knockout stage tolerated.
- **Component (`AdminPage.test.tsx`, `npm test`)** — renders the toggle; reflects current `mode`;
  disabled/“frozen” when server time ≥ freeze instant (AR11). Mode write calls `updateDoc(groupDoc,…)`.
- **i18n (`src/i18n/locales.test.ts`)** — the existing parity test catches any en/es key gap (AR12).
- **Gates (AR14):** `npm run build`, `npm run lint`, `npm run test:rules` (also `npm test`,
  `npm run test:ingest`). **AR13** verified by reading the amended constitution §4.

## Risks

- **Rules read budget.** A strict prediction write now does: `isGroupMember` (1–2), `groupMode` (group
  doc, **cached** with `isOwner`), `exists(match)`+`matchStage`+(lazy)`matchKickoff` (match doc, cached),
  and on the strict branch `config/tournament` (1) → ~3–4 distinct documents, within the per-eval `get()`
  limit. *Mitigation:* lazy branch never touches `config/tournament`; identical `get()`s are de-duped.
- **Missing `config/tournament` before seeding.** Strict groups would have their writes denied (get on a
  non-existent doc errors). *Mitigation:* `modeChangeable()` treats a missing config as **open** so setup
  isn't bricked; lazy is unaffected; **seed `config/tournament` before any group goes strict** — fold the
  write into ingestion and run `INGEST_FORCE=1 npm run ingest` once (matches are already seeded, so this
  is the documented seed path). Tasks must call this out.
- **Cutoff drift if fixtures move.** `firstKnockoutKickoff` is computed each ingest from current matches,
  so it self-corrects on the next run — but a shift *inside* an open window could move a deadline.
  Acceptable for this tournament; documented, not engineered around.
- **Freeze vs strict-group-window coincidence.** Both are `firstCupMatchKickoff − 10min` by design, so a
  group can never flip *into* strict after its group window closed. The knockout window can still be open
  after the freeze (intended) — the freeze only governs the **type**, not the knockout deadline.
- **Constitution amendment.** §4 is a deliberate, spec-approved change. The rules comment block
  (lines 12–15) must be updated in lockstep to avoid a stale invariant in the integrity backbone.
