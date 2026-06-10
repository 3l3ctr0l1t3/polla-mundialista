# 025 — Plan

> Generated from spec.md. Technical design only — no behavior the spec doesn't call for.

## Approach
Five coordinated slices, built in dependency order so each layer can be tested before the next:

1. **Engine (pure).** Add a flat, integer, additive `roundBonus` to `ScoringConfig` and apply it in
   `scorePrediction` when the prediction earned base points. Add `effectiveScoring(group)` (merge group
   override over defaults). Stays dependency-free (the stage is a plain `string` input — no import of
   `Match`). This is the single source of truth; the ingestion job imports it.
2. **Rules (firestore-rules-engineer).** Gate + shape-validate a new `groups/{gid}.scoring` field on the
   group update rule, reusing the ticket-019 freeze (`modeChangeable()` = before `firstCupMatchKickoff −
   10min`). Emulator tests. **No leaderboard-doc rule change needed** — the ingestion job writes via the
   admin SDK, which bypasses rules; new leaderboard fields need no rule edit.
3. **Ingestion (ingestion-engineer).** Thread each match's `stage` into the `finished` map; grade each
   group with its **effective** config (`group.scoring` merged over defaults); bump `SCORING_VERSION`;
   capture each participant's join time and persist it on the leaderboard row so the client can sort
   identically. `buildLeaderboard` already tracks exact/outcome counts — only its final tie-break key
   changes from `displayName` to join time.
4. **Leaderboard client (react-mui-builder).** `useGroupRoster`/leaderboard sort uses the persisted
   `joinedAt` as the final tie-break (not name), matching the server exactly.
5. **Admin editor + explainer (react-mui-builder).** A scoring editor in `AdminPage` (mirrors the `mode`
   toggle: prefilled effective config, `updateDoc(groupDoc(gid), { scoring })`, disabled after freeze) and
   a localized "How points work" view reachable from the leaderboard. All new copy in en + es.

### Key design decisions (resolving the spec's open questions)
- **Engine API:** extend `scorePrediction(pred, actual, cfg?, stage?)`. When `stage` is given and the
  **base** points (`exact + outcome + goalDiff`) are `> 0`, add `cfg.roundBonus[stage] ?? 0`. Round bonus
  is recorded in `ScoreBreakdown.roundBonus` so the invariant `points === exact + outcome + goalDiff +
  roundBonus` holds; the exact/outcome **counts** still read `breakdown.exact > 0` / `breakdown.outcome >
  0`, which are unaffected by the new field (counts stay base-only, stage-independent). ✅ chosen over a
  separate helper for one call site and one obvious invariant.
- **`roundBonus` keying:** `Record<string, number>` keyed by stage string (`GROUP_STAGE`…`FINAL`), so
  `scoring.ts` imports no `Match` type and stays standalone-pure; an unknown stage ⇒ `0`.
- **Storage shape:** `scoring` as a **field on the group doc** (mirrors `mode`); the admin editor always
  writes the **complete** effective config object (all base tiers + the full 7-key `roundBonus` map), so
  the rule validates one fixed shape (no partial-merge ambiguity).
- **Defaults shipped (admin-overridable):** base `5 / 3 / 1 / true / 'fullTime90'`; `roundBonus =
  { GROUP_STAGE 0, LAST_32 0, LAST_16 1, QUARTER_FINALS 2, SEMI_FINALS 3, FINAL 4, THIRD_PLACE 3 }`.
- **Gating:** round bonus only when base `> 0` (any scoring prediction). A wrong prediction stays `0`.
- **Join time:** member `requestedAt` (Timestamp→ms); the implicit owner (no member doc) uses the group's
  `createdAt`. Persisted as `joinedAt` on the leaderboard row so server + client rank identically.

## Files to create / change
| Path | Change | Notes |
|------|--------|-------|
| `src/shared/scoring.ts` | edit | Add `roundBonus: Record<string, number>` to `ScoringConfig`; add `roundBonus: number` to `ScoreBreakdown`; default map in `DEFAULT_SCORING`; `scorePrediction(..., stage?)` adds the gated bonus; export `effectiveScoring(group)` + `mergeScoring(base, override)` (pure, nested-merge `roundBonus`). |
| `src/shared/scoring.test.ts` | edit | New cases: exact FINAL=10, exact GROUP=6, outcome-only LAST_16=4, QF outcome+GD=6, LAST_32=base, wrong=0; override (FINAL bonus 10) changes result; `breakdown` sums to `points`; purity intact. |
| `src/shared/types.ts` | edit | `Group` gains optional `scoring?: ScoringConfig` (or a `ScoringConfigDoc`-compatible shape); `LeaderboardEntry` gains `joinedAt` (Timestamp) for the persisted tie-break key. Confirm `MatchStage` union exists for the editor's round keys. |
| `firestore.rules` | edit | Tighten `match /groups/{gid}` update: add `scoringChanged()`, `validScoring()` (keys present; base tiers + every `roundBonus[stage]` are **non-negative integers**; `goalDiffOnlyOnCorrectOutcome` bool; `gradeOn=='fullTime90'`), `onlyModeOrScoringChanged()`. Owner/admin may set `scoring` ONLY before the freeze (`modeChangeable()`) and ONLY with a valid shape; denied at/after freeze, denied bad shape, denied non-admin. `mode` rules unchanged. |
| `test/rules/*.spec.ts` | edit/new | Emulator tests: admin write valid scoring pre-freeze ✓; at/after freeze ✗; malformed shape ✗; non-admin ✗; existing `mode`/membership invariants still pass. |
| `scripts/ingest/scoring.ts` | edit | Re-export the new `effectiveScoring`/`mergeScoring` + `ScoringConfig` (thin re-export of the shared engine — still single source). |
| `scripts/ingest/index.ts` | edit | `finished` map value gains `stage`; per-group effective config = `mergeScoring(globalBase, group.scoring)`; pass `stage` into `scorePrediction`; bump `SCORING_VERSION` 1→2; `resolveGroupContext` reads member `requestedAt` + owner `createdAt` → `ParticipantProfile.joinedAtMs`; pass through to the board write. |
| `scripts/ingest/buildLeaderboard.ts` | edit | `ParticipantProfile` + `LeaderboardRow` gain `joinedAtMs`; `compareRows` final key becomes `joinedAtMs ASC` (replacing `displayName`); `tied()` unchanged (already excludes name). Persist `joinedAt` on the row. |
| `scripts/ingest/buildLeaderboard.test.ts` | edit | Crafted-tie test proving `points → exact → outcome → earliest joinedAt`; equal-name no longer affects order. |
| `src/hooks/useGroupRoster.ts` (+ its test) | edit | Final tie-break uses the entry's `joinedAt` (not `displayName`), matching the server. |
| `src/pages/AdminPage.tsx` (+ test) | edit | Add an admin-only **Scoring** section: number inputs for base tiers + the 7 round bonuses, prefilled via `effectiveScoring(group)`, saved with `updateDoc(groupDoc(gid), { scoring })` (full object), `disabled` when `frozen` (reuse existing `frozen`), localized, with the same frozen hint as `mode`. |
| `src/components/ScoringExplainer.tsx` (new) + test | new | Localized "How points work" dialog/section reading `effectiveScoring(group)`; lists base tiers, per-round bonuses, tie-break order. |
| `src/pages/LeaderboardPage.tsx` | edit | Add the entry point (button/icon) that opens `ScoringExplainer`. |
| `src/i18n/locales/en.json` / `es.json` | edit | New `admin.scoring*` + `scoring.*` (explainer) keys in BOTH (key-parity). |
| `src/firebase/db.ts` | edit (maybe) | If `Group`/`LeaderboardEntry` converters need the new fields acknowledged; verify converters pass through unknown fields (they likely do). |

## Data shapes / interfaces
```ts
// src/shared/scoring.ts
export interface ScoringConfig {
  exact: number
  outcome: number
  goalDiffBonus: number
  goalDiffOnlyOnCorrectOutcome: boolean
  gradeOn: 'fullTime90'
  /** Flat integer added to a SCORING prediction's points, keyed by match stage. */
  roundBonus: Record<string, number>
}
export interface ScoreBreakdown { exact: number; outcome: number; goalDiff: number; roundBonus: number }

export const DEFAULT_SCORING: ScoringConfig = {
  exact: 5, outcome: 3, goalDiffBonus: 1, goalDiffOnlyOnCorrectOutcome: true, gradeOn: 'fullTime90',
  roundBonus: { GROUP_STAGE: 0, LAST_32: 0, LAST_16: 1, QUARTER_FINALS: 2, SEMI_FINALS: 3, FINAL: 4, THIRD_PLACE: 3 },
}

export function scorePrediction(
  pred: Scoreline, actual: Scoreline, cfg: ScoringConfig = DEFAULT_SCORING, stage?: string,
): ScoreResult // base computed as today; if base>0 && stage → breakdown.roundBonus = cfg.roundBonus[stage] ?? 0

export function mergeScoring(base: ScoringConfig, override?: Partial<ScoringConfig>): ScoringConfig
export function effectiveScoring(group: { scoring?: Partial<ScoringConfig> }): ScoringConfig // mergeScoring(DEFAULT_SCORING, group.scoring)
```
```ts
// scripts/ingest/buildLeaderboard.ts
export interface ParticipantProfile { uid: string; displayName: string; photoURL?: string|null; joinedAtMs: number }
export interface LeaderboardRow { /* …existing… */ joinedAtMs: number }
// compareRows: totalPoints↓ → exactCount↓ → outcomeCount↓ → joinedAtMs↑
```

## Reused utilities
- `scorePrediction`, `DEFAULT_SCORING`, `ScoreBreakdown` (`src/shared/scoring.ts`) — extended, not duplicated.
- Freeze plumbing: `effectiveMode`, `LOCK_BUFFER_MS` (`src/shared/predictionLock.ts`), `useTournamentConfig`,
  `useServerTime`, and the `frozen` calc already in `AdminPage` — reuse verbatim for the scoring editor.
- Rules helpers `isOwner`, `isGroupAdmin`, `modeChangeable()` (`firestore.rules`) — reuse for the new
  `scoring` gating; add `scoringChanged()`/`validScoring()`/`onlyModeOrScoringChanged()` alongside them.
- `buildLeaderboard` already aggregates `exactCount`/`outcomeCount` and dense-ranks — only the tie-break
  key + the new `joinedAtMs` field are added.
- `updateDoc(groupDoc(gid), …)` (the existing `mode` write path) — reused for `{ scoring }`.

## Test strategy
- **AC1/AC2 (engine):** extend `src/shared/scoring.test.ts` with the named cases + override + breakdown-sum
  + purity. `npm test`.
- **AC3 (rules):** `npm run test:rules` — new specs for pre-/post-freeze, bad shape, non-admin; mock server
  time around the freeze (as the existing mode/strict specs do).
- **AC4 (ingestion):** `npm run test:ingest` — grade a FINISHED knockout under a per-group `scoring`
  override using the match `stage`; assert integer points incl. bonus, `SCORING_VERSION` bumped, exact/
  outcome counts recorded.
- **AC5 (tie-break both sides):** `buildLeaderboard.test.ts` crafted-tie (server) + `useGroupRoster` test
  (client) both proving join-time order, not name.
- **AC6 (admin editor):** component test — prefilled effective config, `updateDoc` ref/shape `{ scoring }`,
  disabled when frozen.
- **AC7 (explainer + i18n):** render test + the i18n key-parity test (`npm test`).
- **AC8 (gates):** `npm run build`, `npm test`, `npm run lint`, `npx prettier --check` (touched files),
  `npm run test:rules`.

## Risks
- **Rules shape-validation gaps** → a too-loose `validScoring()` lets a client write junk, or a too-strict
  one rejects the editor's own payload. Mitigation: the editor writes the COMPLETE fixed-shape object; the
  rules test asserts that exact payload passes and mutations of it (negative, non-int, missing key, extra
  key) fail.
- **`SCORING_VERSION` bump re-grades everything** on the next ingest — intended (so bonuses apply), but
  note it in the run log. No data migration needed (idempotent).
- **`breakdown` shape change** (`+roundBonus`) → any consumer destructuring `ScoreBreakdown` must tolerate
  the new field. Mitigation: grep consumers (`buildLeaderboard`, any UI showing breakdown); counts read
  `.exact`/`.outcome` only, so they're safe; update the leaderboard breakdown display if it sums fields.
- **Owner "free update" loophole** → today an owner can write `scoring` unvalidated/unfrozen. The rule MUST
  tighten so `scoringChanged()` is always gated; the test explicitly tries an owner post-freeze write and
  expects denial.
- **Client/server sort divergence** → if the client used member `requestedAt` while the server used the
  persisted `joinedAt`, ranks could differ. Mitigation: the client sorts on the SAME persisted `joinedAt`
  field from the leaderboard doc.
