# 017 — Tasks

> Generated from plan.md. Ordered, atomic, checkboxed.

- [x] 1. Add deps `i18next`, `react-i18next`, `i18next-browser-languagedetector` to `package.json`.
- [x] 2. Create `src/i18n/index.ts` — init i18next (bundled `en`/`es` resources, detection
  `['localStorage','navigator']` + `caches:['localStorage']`, `supportedLngs:['en','es']`,
  `fallbackLng:'en'`, `load:'languageOnly'`, `react.useSuspense:false`), and sync
  `document.documentElement.lang` on init + `languageChanged` (guarded for non-DOM/Node test env).
- [x] 3. Create `src/i18n/locales/en.json` and `src/i18n/locales/es.json` with namespaced keys
  (common, nav, auth, groups, fixtures, predictions, leaderboard, standings, admin, members, errors,
  states). Spanish must be natural fútbol Spanish, not literal.
- [x] 4. `import './i18n'` in `src/main.tsx` (before render). Initialize i18n with `lng:'en'` in
  `src/test/setup.ts` so component tests render deterministic English.
- [x] 5. Create `src/components/LanguageSwitcher.tsx` (compact EN/ES toggle → `i18n.changeLanguage`,
  persists via the detector's localStorage cache). Add it to the AppShell toolbar and the Login page.
- [x] 6. Refactor `navItems` so labels come from `t('nav.*')` (a `navItems(t)` factory or `useNavItems()`),
  consumed in `GroupApp`. Icons stay static.
- [x] 7. Replace hard-coded strings with `t()`/`<Trans>` across pages: Login, MyGroups, CreateGroup,
  JoinGroup, MembershipGate, Fixtures, Predictions, Leaderboard, Standings, Admin, Superadmin.
- [x] 8. Replace hard-coded strings across shared components: AppShell, MatchCard, PredictionCard,
  PredictionInput, MatchTeams (TBD → `match.tbd` key + `useTbdLabel` hook), MatchPredictionsDialog,
  CountdownToKickoff, LeaderboardRow, states/{Empty,Error,Loading}. (EmptyState is purely prop-driven
  so it stays as-is.) Use `count` plurals for "{n} members", "N min ago", day/days, etc.
- [x] 9. Create `src/i18n/locales.test.ts` — key-parity test (flatten en & es; assert identical key sets).
- [x] 10. Add a `LanguageSwitcher` test (changes language + persists) and an i18n-config test
  (`es-CO`→`es`, unsupported→`en`; `languageChanged` sets `<html lang>`).
- [x] 11. Update existing tests that asserted moved/renamed literals so all suites stay green.
  (No existing literals changed — the test setup pins `en`, so all prior assertions kept passing.)
- [x] 12. Run gates: `npm run build`, `npm test`, `npm run lint`, `npx prettier --check .`. Add a grep
  check that the wrapped files contain no stray user-facing literals (AC2).
- [ ] 13. Run `/spec-verify 017`; update `specs/backlog.md` status.

## Verification command(s)
```
npm run build
npm test -- --run
npm run lint
npx prettier --check .
```
