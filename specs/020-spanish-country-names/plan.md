# 020 — Plan

> Generated from spec.md. Technical design only — no behavior the spec doesn't call for.

## Approach
Add a single, display-only localization rule for team/country names. Stored data stays
English (two-writers rule untouched); the UI maps an English football-data team to its
Spanish name **only when the app language is `es`**, keyed by the stable FIFA three-letter
code (`Team.tla`). One pure resolver + one hook own the logic; every render site of a team
name funnels through the hook so the rule lives in exactly one place. Falls back to the
original `team.name` for any unmapped code (never blank, never a crash). The existing
`isTbdTeam` branch + the shared `useTbdLabel` placeholder are reused for undecided slots, and
`StandingsTable`'s hardcoded `'TBD'` is replaced with that shared localized label.

## Files to create / change
| Path | Change | Notes |
|------|--------|-------|
| `src/i18n/countryNamesEs.ts` | new | `Record<tla, string>` Spanish map; broad WC-2026 coverage + a few code aliases (ALG/DZA, KSA/SAU, PRK/NKO, GUA/GTM, EQG/GNQ) |
| `src/i18n/useTeamName.ts` | new | pure `localizeTeamName(team, lang, tbdLabel)` + `useTeamName()` hook (binds current lang + localized TBD) |
| `src/components/MatchTeams.tsx` | edit | `TeamRow` resolves the name via `useTeamName()` (covers MatchCard/FixtureCard headers) |
| `src/components/StandingsTable.tsx` | edit | localize the row name **and** replace hardcoded `'TBD'` with the shared localized label |
| `src/components/FixtureCard.tsx` | edit | `TeamName`/`TeamFlag` + card aria-label use `useTeamName()`; drop now-unused `useTbdLabel` |
| `src/components/MatchCard.tsx` | edit | card aria-label uses `useTeamName()`; drop now-unused `isTbdTeam`/`useTbdLabel` |
| `src/components/MatchPredictionsDialog.tsx` | edit | dialog title `matchVs` localizes the team name (was raw `shortName`) |
| `src/i18n/useTeamName.test.tsx` | new | pure resolver + hook live-switch + seed-coverage tests |
| `src/components/StandingsTable.test.tsx` | new | en/es names + localized TBD in the standings table |

## Data shapes / interfaces
```ts
export const countryNamesEs: Record<string, string> // key: uppercased Team.tla

// undecided → tbdLabel; es + mapped → Spanish; else → team.name
export function localizeTeamName(team: Team, lang: string | undefined, tbdLabel: string): string

// stable (team) => string resolver bound to current language + localized placeholder
export function useTeamName(): (team: Team) => string
```

## Reused utilities
- `isTbdTeam(team)` — `src/hooks/matchGrouping.ts` (undecided-slot detection, before map lookup).
- `useTbdLabel()` / `match.tbd` key — `src/components/useTbdLabel.ts` (shared localized placeholder).
- `react-i18next` `useTranslation().i18n` for the live language (`resolvedLanguage`).

## Test strategy
- Unit (pure): es→Spanish, en→English, es-CO→Spanish, TBD→placeholder, unmapped→fallback.
- Component (hook): MatchTeams + a tiny harness render English then Spanish across a live
  `i18n.changeLanguage` switch (no reload). StandingsTable renders en/es names + localized TBD.
- Coverage: every distinct non-TBD `tla` in `src/dev/sampleData.ts` has a non-empty Spanish entry.
- Gates: `npm run build`, `npm run lint`, `npm test`, `prettier --check`, and the en/es parity test.

## Risks
- A football-data `tla` differs from the assumed FIFA code → name shows in English (graceful
  fallback, never a crash). Mitigated by broad coverage + aliases for the ambiguous codes.
- Map drift as the bracket resolves → coverage test guards the seeded set; unmapped nations
  fall back to English rather than break.
