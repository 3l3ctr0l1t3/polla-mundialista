# 020 — Tasks

> Generated from plan.md. Ordered, atomic, checkboxed.

- [x] 1. Create `src/i18n/countryNamesEs.ts` — Spanish name map keyed by FIFA `tla` (broad WC-2026 coverage + code aliases).
- [x] 2. Create `src/i18n/useTeamName.ts` — pure `localizeTeamName(team, lang, tbdLabel)` + `useTeamName()` hook.
- [x] 3. Wire `useTeamName()` into `MatchTeams.tsx` `TeamRow` (covers MatchCard + FixtureCard headers).
- [x] 4. Localize `StandingsTable.tsx` row names and replace hardcoded `'TBD'` with the shared localized label.
- [x] 5. Localize `FixtureCard.tsx` (`TeamName`/`TeamFlag` + card aria-label); drop unused `useTbdLabel`.
- [x] 6. Localize `MatchCard.tsx` card aria-label; drop unused `isTbdTeam`/`useTbdLabel`.
- [x] 7. Localize `MatchPredictionsDialog.tsx` title `matchVs`.
- [x] 8. Write tests: pure resolver, hook live-switch, MatchTeams/StandingsTable en/es + TBD, seed coverage.
- [x] 9. Run gates (`npm run build`, `npm run lint`, `npm test`, `prettier --check`) — all green.
- [x] 10. Update `specs/backlog.md` status.

## Verification command(s)
```
npm test
npm run build
npm run lint
npx prettier --check "src/**/*.{ts,tsx}"
```
