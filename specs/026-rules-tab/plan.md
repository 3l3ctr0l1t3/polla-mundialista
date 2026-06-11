# 026 — Plan

> Generated from spec.md. Technical design only — no behavior the spec doesn't call for.

## Approach
UI-only. Extract the rules content out of the `ScoringExplainer` dialog into one reusable
presentational component, build a `RulesPage` that pairs it with a prediction-mode/lock section, wire a
`rules` nav tab + route, and remove the leaderboard help-dialog entry point.

1. **`src/components/ScoringRules.tsx` (new).** Move the dialog BODY of `ScoringExplainer` verbatim — base
   tiers (exact/outcome/GD, exact-totals note), the `STAGE_ROWS` round-bonus table, the `scoring.tieBreak*`
   list — into a presentational component that reads `effectiveScoring(group)` via `useGroup()`. No dialog
   chrome; just the sections. This is the single source of the rules markup.
2. **Delete `src/components/ScoringExplainer.tsx` + `ScoringExplainer.test.tsx`.** Nothing else uses the
   dialog once the leaderboard entry point is gone; its content now lives in `ScoringRules`. Its render
   test is replaced by `ScoringRules.test.tsx` (same assertions, minus the open/close dialog cases).
3. **`src/components/LockModeSection.tsx` (new, or inline in RulesPage).** Reads `effectiveMode(group)` and
   renders the matching lock explanation: lazy ⇒ per-match −10 min copy; strict ⇒ the two batch-window
   explanations. Time-agnostic explanatory copy (not a live countdown); reuses `admin.modeLazy`/
   `admin.modeStrict` for the mode name. Planner keeps it inline in `RulesPage` if small.
4. **`src/pages/RulesPage.tsx` (new).** A read-only page: a heading, `<ScoringRules />`, and the lock-mode
   section. Reads `useGroup()`. Writes nothing.
5. **`src/components/navItems.tsx`.** Add a `rules` item to `defaultNavItems` right after `leaderboard`
   (`key:'rules'`, `label:t('nav.rules')`, icon `<MenuBookIcon />`).
6. **`src/group/GroupApp.tsx`.** Import `RulesPage`; add `<Route path="rules" element={<RulesPage />} />`
   beside the other tabs.
7. **`src/pages/LeaderboardPage.tsx`.** Remove the `HelpOutlineRounded` `IconButton`, the
   `ScoringExplainer` import + mount, and the `explainerOpen` state; collapse the header back to just the
   title (drop the now-unneeded space-between row). Update `LeaderboardPage.test.tsx` if it asserts the
   help button / dialog.
8. **i18n.** Add `nav.rules` + a small `rules.*` block (page title, section headings, the lock
   explanations) to BOTH `en.json` and `es.json`. Reuse existing `scoring.*` (via ScoringRules),
   `admin.modeLazy`/`admin.modeStrict` for mode names.

### Key decisions (resolving spec open questions)
- **Dialog removed, not kept.** `ScoringExplainer` is deleted; `ScoringRules` is the one shared content
  component. Simpler than a thin wrapper and the leaderboard is its only consumer today.
- **Lock copy is time-agnostic** (new `rules.*` keys), not date-interpolated — avoids depending on
  `cutoffs` being resolved and keeps it a stable explanation. `useTournamentConfig` is therefore not
  required by the page (concrete dates can be a later follow-up).
- **Only the active mode** is explained (lazy OR strict), per the group's `effectiveMode`.
- **Nav placement:** right after Leaderboard, in `defaultNavItems` (visible to every member).

## Files to create / change
| Path | Change | Notes |
|------|--------|-------|
| `src/components/ScoringRules.tsx` | new | Presentational rules content (tiers + round-bonus table + tie-breaks), reads `effectiveScoring(group)`. Moved from the explainer body. |
| `src/components/ScoringRules.test.tsx` | new | Render test (tiers, a round-bonus value, tie-break list); override-merge case. Replaces ScoringExplainer.test. |
| `src/components/ScoringExplainer.tsx` | delete | Dialog removed; content lives in ScoringRules. |
| `src/components/ScoringExplainer.test.tsx` | delete | Replaced by ScoringRules.test.tsx. |
| `src/pages/RulesPage.tsx` | new | The tab page: heading + `<ScoringRules />` + lock-mode section. Read-only. |
| `src/pages/RulesPage.test.tsx` | new | Scoring content renders; lock copy for lazy vs strict groups. |
| `src/components/navItems.tsx` | edit | Add `rules` item (icon `MenuBookIcon`) after `leaderboard` in `defaultNavItems`. |
| `src/group/GroupApp.tsx` | edit | Import `RulesPage`; add `<Route path="rules" …>`. |
| `src/pages/LeaderboardPage.tsx` | edit | Remove help IconButton + `ScoringExplainer` mount + `explainerOpen` state; simplify header. |
| `src/pages/LeaderboardPage.test.tsx` | edit (if needed) | Drop any help-button/dialog assertion. |
| `src/i18n/locales/en.json` / `es.json` | edit | Add `nav.rules` + `rules.*` (title, section headings, lazy/strict lock explanations) in BOTH. |

## Data shapes / interfaces
No new types, no Firestore, no route-param changes. Component contracts:
```ts
// ScoringRules — presentational; reads the group's effective config itself (no required props).
export function ScoringRules(): JSX.Element
// RulesPage — route element; no props.
export function RulesPage(): JSX.Element
```
`NavItem` shape unchanged; a new `rules` entry is added to `defaultNavItems`.

## Reused utilities
- `effectiveScoring` (`src/shared/scoring.ts`), `effectiveMode` (`src/shared/predictionLock.ts`),
  `useGroup` (`src/group/useGroup`) — read-only, unchanged.
- Existing i18n keys: `scoring.*` (whole scoring section, via ScoringRules), `admin.modeLazy`/
  `admin.modeStrict` (mode names). New copy limited to `nav.rules` + `rules.*`.
- `AppShell` nav + `GroupApp` route wiring — same pattern as Fixtures/Leaderboard/Standings.

## Test strategy
- **AC1 (tab + route):** a `navItems`/`GroupApp` test asserts the `rules` item is present and that
  `/g/:gid/rules` mounts `RulesPage` (mirror an existing nav/route test).
- **AC2 (scoring content):** `ScoringRules.test.tsx` + `RulesPage.test.tsx` assert the exact tier value, at
  least one stage round-bonus, and the ordered tie-break list render from `effectiveScoring` (default + an
  override group).
- **AC3 (lock by mode):** `RulesPage.test.tsx` renders once with a lazy group (asserts per-match copy) and
  once with a strict group (asserts the two batch-window copies).
- **AC4 (leaderboard de-dup):** `LeaderboardPage.test.tsx` asserts no help button / no dialog; grep
  confirms the tier/round-bonus/tie-break markup exists only in `ScoringRules`.
- **AC5 (i18n parity):** the key-parity test stays green with the new `nav.rules` + `rules.*` in both files.
- **AC6 (gates):** `npm run build`, `npm test`, `npm run lint`, `npx prettier --check` (touched files);
  `git diff` shows no change to `src/shared/scoring.ts`, `firestore.rules`, or `scripts/ingest/*`
  (`test:rules`/`test:ingest` unchanged & green).

## Risks
- **Deleting `ScoringExplainer` breaks an unseen importer** → grep before delete; only `LeaderboardPage`
  imports it today. Mitigation: remove the import in the same change; build catches any straggler.
- **Leaderboard test references the help button** → update/remove that assertion so the suite stays green.
- **i18n parity break** from adding keys to only one locale → add `nav.rules` + every `rules.*` key to BOTH
  en and es in the same step; the parity test is the backstop.
- **Nav order/selection** — `GroupApp`'s `selectedKey` is path-based and generic, so adding `rules` needs no
  selection-logic change; verify the active-tab highlight in the nav test.
