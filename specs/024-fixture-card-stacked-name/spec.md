# 024 — Fixture card: stack team name above flag on all breakpoints (+ Canvas cleanup)

> Status: 🟦 spec ready · Depends on: 018 · Specialist: react-mui-builder

## Why
On the unified `FixtureCard` (ticket 018) each team renders as a centered column — name above flag — only on
mobile; at the `sm` breakpoint and up it flips to an inline row (name beside flag). The owner prefers the
mobile stacked look and wants it **everywhere**. This is a presentational, layout-only change: always stack
the name above the flag, on every breakpoint. The superadmin Canvas — which currently compares 7 obsolete
score-input options (the production card already settled on the vertical Spinner) — is repurposed to preview
this layout at a phone width and a desktop width before/while it ships.

## User story
As the **group owner**, I want **each team's name to always sit above its flag (centered column) on phone and
desktop alike**, so that **the fixture card reads consistently and the way I prefer at every screen size**.

## Scope
- **Production `src/components/FixtureCard.tsx`:** render each team as a **centered column with the NAME above
  the FLAG at all breakpoints**. Remove the `sm` direction flip — the two team `Stack`s no longer switch to
  `row` (home) / `row-reverse` (away) at `sm`; they stay column. The inner `TeamName` component's responsive
  `sm` overrides that exist only to support the inline-row layout (width `auto`, side `textAlign`, `nowrap`
  whitespace, overflow/ellipsis) are simplified to the centered/wrapping behavior that mobile already uses
  (full-width, centered, wrapping). Planner finalizes the exact `sx`.
- **Replica `src/dev/FixtureCardPreview.tsx`:** apply the **same** stacked-column structure so it stays a
  faithful presentational replica of the real card (its `TeamName`/`TeamFlag` and the two team `Stack`s mirror
  FixtureCard).
- **Canvas `src/pages/CanvasPage.tsx`:** **remove the 7-option score-input comparison grid**
  (`SCORE_INPUT_OPTIONS.map(...)`). Instead render the `FixtureCardPreview` (with the production Spinner-style
  center) in the new stacked layout inside **two fixed-width containers** — a narrow **mobile** container
  (≈400px) and a **wide desktop** container — so both widths can be eyeballed side by side. The Canvas stays
  superadmin / local-dev only (mounted in `GroupApp` when `isSuperAdmin || import.meta.env.DEV`).
- Keep existing card behavior intact: the center slot (Spinner steppers when upcoming · result score when
  live/finished · kickoff time otherwise), the caption, the countdown/status chip, the Save/Update button, the
  own-prediction line, and the reveal entry point — **only** the team name-vs-flag stacking changes.
- Preserve accessibility: the Card `aria-label` ("X versus Y" via `match.versus`), the team name `title`
  attributes, and the Spinner/score `aria-label`s stay exactly as they are.

## Non-goals
- **No** change to the prediction save path (`useSavePrediction`/`toGoals`), the kickoff lock, scoring
  (`src/shared/scoring.ts`), `firestore.rules`, ingestion (`scripts/ingest/*`), the reveal dialog/gating
  (`MatchPredictionsDialog`/`useMatchPredictions`), or any i18n keys/copy. No data-model change.
- **No** change to the center slot rendering (Spinner steppers / result score / kickoff time), the caption,
  the countdown/status chip, the Save/Update button, or the own-prediction line.
- **No** change to `src/components/MatchTeams.tsx` (a separate shared header used by other surfaces;
  FixtureCard does not depend on it).
- Making the Canvas user-facing, or adding a viewport/breakpoint-toggle framework beyond the two fixed-width
  containers.
- Redesigning Fixtures/Leaderboard/Standings, theming, or PWA behavior.

## Acceptance rules (definition of done)
Each rule is verifiable. These are what `/spec-verify` checks.
1. In `FixtureCard`, each team renders as a **centered column with the name element ABOVE the flag element at
   all breakpoints** — there is **no `sm` `row`/`row-reverse` direction switch** on the team `Stack`s (the
   responsive `direction={{ xs: 'column', sm: 'row' | 'row-reverse' }}` is gone). Verified by a component test
   asserting DOM order (name precedes flag for both teams) and that the team `Stack` direction no longer flips
   to a row at `sm`.
2. `FixtureCardPreview` mirrors the same stacked-column structure (kept in sync with FixtureCard) — its team
   `Stack`s are column at all breakpoints with name above flag. Verified by inspection/diff and, if a preview
   test exists, by the same DOM-order assertion.
3. `CanvasPage` **no longer renders the 7-option score-input comparison** (no `SCORE_INPUT_OPTIONS.map`); it
   renders the fixture-card preview in a **mobile-width** container (≈400px) and a **desktop-width** container.
   Verified by a Canvas render test (or grep/diff) showing the score-input grid removed and two width-bounded
   previews present.
4. **No change** to `useSavePrediction`, the kickoff lock, `src/shared/scoring.ts`, `firestore.rules`,
   `scripts/ingest/*`, the reveal dialog/gating (`MatchPredictionsDialog`/`useMatchPredictions`), or any i18n
   keys/copy (`en.json`/`es.json`) — verified by diff (those files untouched) and the existing rules/ingest/
   i18n-parity tests staying green.
5. Accessibility preserved: the Card `aria-label` ("X versus Y" via `match.versus`) and the team name `title`
   attributes are unchanged — verified by a component test asserting the versus label and team `title`s.
6. Quality gates green: `npm run build`, `npm test`, `npm run lint`, `npx prettier --check .`. `npm run
   test:rules` and `npm run test:ingest` are **unchanged** and still green.

## Constitution links
- **Spec-first (1):** the layout change is specified here before any implementation.
- **Shared scoring engine untouched (2):** `src/shared/scoring.ts` is not touched (Non-goals, AC4).
- **Two-writers rule (3):** unchanged — the browser still writes only its own per-group prediction; this
  ticket alters presentation only, not the write path.
- **Authoritative kickoff lock (4):** unchanged — the lock and `firestore.rules` are untouched (AC4).
- **Done = tested + meets acceptance rules (7):** the gates in AC6 (plus unchanged rules/ingest suites) close
  the ticket.

## Notes / open questions
- **Assumption:** the change is purely the team name/flag stacking; the center slot, chrome, and all wiring
  stay byte-for-byte except where the `sm` direction/`TeamName` `sx` overrides are removed. The planner picks
  the exact final `sx` for `TeamName` (e.g. whether to keep the title-attribute ellipsis safeguards) but the
  visible result is name-above-flag, centered, wrapping at every width.
- **Open question — remove `scoreInputs.tsx`?** Grep shows `src/dev/scoreInputs.tsx` (and its
  `SCORE_INPUT_OPTIONS`) is imported **only** by `CanvasPage.tsx`. Once the Canvas drops the comparison grid,
  `scoreInputs.tsx` becomes unused and MAY be deleted. The planner re-verifies usages at implement time and
  decides whether to delete it or leave it dormant; deletion is not mandated here.
- **Assumption:** `FixtureCardPreview` keeps using the production-style Spinner center in its preview (the
  obsolete pluggable `children` comparison is no longer needed); the planner decides whether the preview
  hardcodes a Spinner-like center or keeps a single passed-in widget.
- **Assumption:** the Canvas's two containers are fixed-width `Box`es (mobile ≈400px, desktop wider) rendered
  on the page so both can be compared at once; no real device-frame/responsive harness is in scope.
