# 026 — Tasks

> Generated from plan.md. Ordered, atomic, checkboxed. Check off as you implement.

- [x] 1. **Extract `ScoringRules`.** Create `src/components/ScoringRules.tsx`: move the body of
      `ScoringExplainer` (base tiers + exact-totals note, the `STAGE_ROWS` round-bonus table, the
      `scoring.tieBreak*` list) into a presentational component that reads `effectiveScoring(group)` via
      `useGroup()`. No dialog chrome.
- [x] 2. **Build `RulesPage`.** Create `src/pages/RulesPage.tsx`: a read-only page with a heading,
      `<ScoringRules />`, and a **lock-mode section** driven by `effectiveMode(group)` — lazy ⇒ per-match
      −10 min copy; strict ⇒ the two batch-window explanations (time-agnostic). Mode name via
      `admin.modeLazy`/`admin.modeStrict`. Writes nothing.
- [x] 3. **Nav tab.** In `src/components/navItems.tsx`, add a `rules` item (`key:'rules'`,
      `label:t('nav.rules')`, icon `<MenuBookIcon />`) to `defaultNavItems`, right after `leaderboard`.
- [x] 4. **Route.** In `src/group/GroupApp.tsx`, import `RulesPage` and add
      `<Route path="rules" element={<RulesPage />} />` beside the other tabs.
- [x] 5. **Remove the leaderboard dialog entry point.** In `src/pages/LeaderboardPage.tsx`, delete the
      `HelpOutlineRounded` `IconButton`, the `ScoringExplainer` import + mount, and the `explainerOpen`
      state; collapse the header to just the title.
- [x] 6. **Delete the old dialog.** Remove `src/components/ScoringExplainer.tsx` and
      `src/components/ScoringExplainer.test.tsx` (grep first to confirm `LeaderboardPage` was its only
      importer).
- [x] 7. **i18n.** Add `nav.rules` + a `rules.*` block (page title, section headings, lazy/strict lock
      explanations) to BOTH `src/i18n/locales/en.json` and `es.json`. Keep key-parity green.
- [x] 8. **Tests.** Add `src/components/ScoringRules.test.tsx` (tiers, a round-bonus value, tie-break list,
      override-merge) and `src/pages/RulesPage.test.tsx` (scoring content renders; lazy-vs-strict lock
      copy). Update `LeaderboardPage.test.tsx` to drop any help-button/dialog assertion. Add a nav/route
      assertion (in the nav or GroupApp test) for the `rules` tab.
- [x] 9. **Run the gates:** `npm run build`, `npm test`, `npm run lint`, `npx prettier --check` (touched
      files). Confirm `git diff --name-only` shows no change to `src/shared/scoring.ts`, `firestore.rules`,
      or `scripts/ingest/*`.
- [x] 10. Run `/spec-verify 026` and confirm all acceptance rules pass.
- [x] 11. Update `specs/backlog.md` status to ✅.

## Verification command(s)
```
npm run build
npm test            # RulesPage + ScoringRules + nav/route + Leaderboard + i18n parity
npm run lint
npx prettier --check src/components/ScoringRules.tsx src/pages/RulesPage.tsx src/components/navItems.tsx src/group/GroupApp.tsx src/pages/LeaderboardPage.tsx src/i18n/locales/en.json src/i18n/locales/es.json
# Unchanged & still green (no engine/rules/ingest change):
npm run test:rules
npm run test:ingest
```
