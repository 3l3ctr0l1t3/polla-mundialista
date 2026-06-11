# 026 — Rules tab: how this group works (scoring + lock mode)

> Status: 🟦 spec ready · Depends on: 012, 019, 025 · Specialist: react-mui-builder

## Why
Each group now competes under its own scoring config (round bonuses + tie-breakers, ticket 025) and its own
prediction mode (lazy vs strict, ticket 019), but the rules that explain all that are buried behind a
help-icon **dialog** on the Leaderboard — easy to miss and conflated with the standings. The owner wants a
first-class **"Rules" / "Reglas" group tab** where every participant can read, in one place, exactly how
THEIR group works: how points are earned and how predictions lock.

## User story
As a **group member**, I want **a dedicated Rules tab that explains my group's scoring and when my
predictions lock**, so that **I understand how this specific pool works without digging through a dialog or
asking the owner**.

## Scope
- **New RulesPage** (`src/pages/RulesPage.tsx`) rendered for the `rules` route under a group. It is
  **read-only and presentational**: it reads the group's **effective** scoring config and effective mode from
  `useGroup()` (+ the strict cutoffs from `useTournamentConfig()`) and **writes nothing**. Two sections:
  - **Scoring rules** — the base tiers (exact / outcome / goal-diff bonus, noting an exact totals 6), the
    per-stage **round-bonus** table, and the leaderboard **tie-break** order. This is exactly the content the
    `ScoringExplainer` dialog renders today (`effectiveScoring(group)`, the `STAGE_ROWS` table, the
    `scoring.tieBreak*` list), reused verbatim — not re-derived.
  - **Prediction mode + lock timing** — the group's mode via `effectiveMode(group)` (absent ⇒ lazy) and the
    matching lock explanation: **lazy** ⇒ each match locks 10 min before its own kickoff; **strict** ⇒ all
    group-stage picks lock 10 min before the first cup match, all knockout picks 10 min before the first
    knockout match. Reuse the existing copy (`admin.predictionModeDescription`, `admin.modeLazy`,
    `admin.modeStrict`, `predictions.lazyLockHint`, `predictions.strictGroupLock`,
    `predictions.strictKnockoutLock`).
- **Refactor `ScoringExplainer` body into a reusable presentational component** (the planner names it, e.g.
  `ScoringRules`) so the page and any remaining dialog share **ONE** source of the tier / round-bonus /
  tie-break markup. The tier/round-bonus/tie-break content MUST NOT be duplicated across the page and the
  dialog.
- **Add the nav tab** in `src/components/navItems.tsx` (a `rules` item with `key: 'rules'`, a localized
  `nav.rules` label, and an icon), placed sensibly in the nav order (planner decides — e.g. next to
  Leaderboard).
- **Add the route** `rules` in `src/group/GroupApp.tsx` (`<Route path="rules" element={<RulesPage />} />`),
  consistent with the other group tabs.
- **Remove the Leaderboard help-icon entry point.** `src/pages/LeaderboardPage.tsx` no longer renders the
  `HelpOutlineRounded` `IconButton` nor mounts the rules dialog — the rules now live in the tab. The planner
  decides whether to delete `ScoringExplainer` entirely or keep a thin dialog wrapper around the shared
  component; either way the Leaderboard does not open it.
- **Localization:** the new `nav.rules` label and any new section/heading copy are added to **both**
  `src/i18n/locales/en.json` and `es.json`; the existing `scoring.*`, `admin.*`, and `predictions.*` keys are
  reused as-is. The i18n key-parity test stays green.

## Non-goals
- **No personal scorecard / per-participant points** on this tab — points and rankings stay on the
  Leaderboard. This tab explains the rules only.
- **No** change to the scoring engine (`src/shared/scoring.ts`), `firestore.rules`, ingestion
  (`scripts/ingest/*`), the prediction write path, or the actual lock enforcement — this tab only **explains**
  rules that already exist; it does not compute, grade, or lock anything.
- **No** new scoring config and **no** admin editing here — configuring scoring/mode is ticket 025's Admin
  editor (and 019's mode toggle). The Rules tab is read-only.
- Free-tier only; no new dependency.

## Acceptance rules (definition of done)
Each rule is verifiable. These are what `/spec-verify` checks.
1. **The tab exists and routes.** A `rules` nav item appears in the in-group navigation, and navigating to
   `/g/:gid/rules` renders the `RulesPage` — verified by a routing/nav test asserting the nav item and that
   the route mounts the page.
2. **Scoring section renders the group's EFFECTIVE config from the shared component.** The page renders the
   base tiers, the per-stage round-bonus table, and the tie-break order, sourced from the shared rules
   component reading `effectiveScoring(group)` — a test asserts representative values render (e.g. the exact
   tier, at least one stage's round-bonus value, and the ordered tie-break list).
3. **Lock section reflects the group's mode.** With a **lazy** group the page shows the per-match
   lock-10-min-before-kickoff explanation; with a **strict** group it shows the two batch-window
   explanations — a test with one group of each mode asserts the correct copy renders for each.
4. **Leaderboard no longer hosts the rules.** `LeaderboardPage` renders neither the `HelpOutlineRounded`
   help-icon button nor the rules dialog — a test asserts the old entry point is gone. The tier /
   round-bonus / tie-break markup exists in exactly one shared component (no duplicated rules content).
5. **Localized + key-parity.** All new copy (`nav.rules` and any new headings) exists in **both** `en.json`
   and `es.json`, and the i18n key-parity test is green.
6. **Quality gates green & engine/rules untouched:** `npm run build`, `npm test` (incl. the new RulesPage /
   nav / Leaderboard tests), `npm run lint`, and `npx prettier --check` on the touched files all pass. There
   is **no** change to `src/shared/scoring.ts`, `firestore.rules`, or `scripts/ingest/*` — verified by diff;
   their suites are unchanged and still green (no `npm run test:rules` / `test:ingest` regressions).

## Constitution links
- **Spec-first (1):** this read-only surface is specified before implementation.
- **Single shared scoring engine (2):** the tab only **reads** `effectiveScoring`/`effectiveMode`; no grading
  or lock logic is duplicated, and the rules content lives in one shared component.
- **Two-writers rule (3):** the page **writes nothing** — the browser still writes only its own per-group
  prediction (elsewhere); results/leaderboard/standings stay ingestion-only.
- **Authoritative kickoff lock (4):** the tab merely **describes** the −10 min lock windows; enforcement
  remains server-side in `firestore.rules`, unchanged here.
- **Free-tier only (6):** no new dependency, no backend change.
- **Done = tested + meets acceptance rules (7):** the gates in AC6 close the ticket.

## Notes / open questions
- **Assumption:** the `ScoringExplainer` dialog body is the source of truth for the scoring section; the
  planner refactors it into a reusable presentational component (suggested name `ScoringRules`) consumed by
  the page, rather than copying its markup. The dialog is then either deleted or kept as a thin wrapper — the
  Leaderboard stops opening it regardless.
- **Assumption:** the existing `scoring.*`, `admin.predictionModeDescription` / `admin.modeLazy` /
  `admin.modeStrict`, and `predictions.lazyLockHint` / `predictions.strictGroupLock` /
  `predictions.strictKnockoutLock` keys are reused as-is for the two sections; only `nav.rules` and any new
  section headings are net-new copy.
- **Nav placement + icon** are the planner's call (e.g. a `RuleRounded`/`GavelRounded` icon next to
  Leaderboard); the requirement is only that the item is consistent with the other group tabs and sensibly
  ordered.
- **Strict cutoffs unknown:** when `useTournamentConfig()` has not yet resolved `cutoffs` for a strict group,
  the lock section should still explain the strict windows in human terms (it is explanatory copy, not a live
  countdown) — the planner decides whether to interpolate concrete cutoff times when known or keep the copy
  time-agnostic.
- **Open question:** whether the lock section should always be shown (both modes) or only the active mode's
  explanation. The spec assumes **only the group's effective mode** is explained (lazy OR strict), matching
  what actually governs this group.
