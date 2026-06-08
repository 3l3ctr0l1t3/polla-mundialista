# 020 — Localized (Spanish) country / team names

> Status: ✅ verified (offline) · Depends on: 017, 018 · Specialist: react-mui-builder

## Why
Team names arrive from football-data.org in English only (e.g. "Brazil", "Germany", "South Korea") and are
rendered raw, so a Spanish-language user still sees English country names despite the app's en/es i18n
(ticket 017). This ticket makes the displayed country name **locale-aware** — Spanish when the app language
is `es`, the original English football-data name when `en` — without touching the stored data.

## User story
As a **Spanish-speaking participant**, I want **team/country names to appear in Spanish when my app
language is Spanish** so that **fixtures, predictions, and standings read naturally in my language**.

## Scope
- A static, hand-maintained **Spanish country-name map** (e.g. `src/i18n/countryNamesEs.ts`) keyed by a
  stable team key (recommended: `tla`, the FIFA 3-letter code; numeric football-data `id` as possible
  secondary key — planner confirms). Covers every team present in the seeded WC 2026 data (48 nations).
- A **single centralized rule** — a `useTeamName()` hook or `localizeTeamName(team, lang)` helper — that
  resolves the display name: undecided team → localized placeholder; else `lang === 'es'` and a Spanish
  entry exists → Spanish name; else → original `team.name`.
- Wire that rule into every render site of a team's display name so the logic lives in **one place**:
  - `src/components/MatchTeams.tsx` `TeamRow` (covers MatchCard / FixtureCard / unified prediction card).
  - `src/components/StandingsTable.tsx` — and **fix its hardcoded `'TBD'`** to use the localized placeholder
    (`useTbdLabel()` / key `match.tbd`) like `MatchTeams` already does.
  - Any other direct `team.name` render site found in the audit (check
    `src/components/MatchPredictionsDialog.tsx` and `src/components/MatchCard.tsx`).
- Reuse `isTbdTeam(team)` (`src/hooks/matchGrouping.ts`) to detect undecided slots.
- Live reaction to the existing language selector (re-renders via `react-i18next`, no reload).

## Non-goals
- No change to stored Firestore data, the `Team` shape, or the ingestion job — names stay English at rest
  (display-only localization).
- No translation of player names, city/venue names, or competition/stage labels (stage labels are already
  UI i18n strings).
- No new dependency or translation service — the Spanish map is hand-maintained in-repo.
- No additional languages beyond the existing en/es.
- No "always Spanish regardless of selected language" mode.

## Acceptance rules (definition of done)
Each rule is verifiable. These are what `/spec-verify` checks.
1. With app language `es`, a known country (e.g. the seeded entry for Brazil) renders its Spanish name
   ("Brasil") in a match card (via `MatchTeams`) **and** in the standings table (`StandingsTable`).
2. With app language `en`, the same team renders the original football-data name ("Brazil") in both sites.
3. Switching the app language live (via the existing selector) updates the rendered country names without a
   page reload — verifiable by a component test that re-renders on `i18n.language` change.
4. An undecided team renders the localized placeholder — "Por definir" in `es`, "TBD" in `en` — in **both**
   `MatchTeams` and `StandingsTable`; i.e. `StandingsTable` no longer hardcodes `'TBD'` and instead uses the
   shared localized label.
5. A country with **no** Spanish-map entry falls back to its original `team.name` under `es` — never blank,
   never a crash (verifiable by a test passing a team whose key is absent from the map).
6. The Spanish map covers every distinct (non-TBD) team key present in the seeded matches/standings data —
   verifiable by a test that asserts each distinct team key in the sample/seed data has a Spanish entry (or
   an explicitly documented allow-list), so no qualified WC 2026 nation is left untranslated.
7. The en/es locale JSON parity test (`src/i18n/locales.test.ts`) still passes, and `npm run build`,
   `npm run lint`, and `npm test` are all green.

## Constitution links
- **Free-tier only (§6):** the Spanish map is a hand-maintained in-repo TS module — no paid translation API,
  no new dependency.
- **Two-writers rule (§3):** display-only; stored team data (written solely by the ingestion service
  account) is untouched.
- **Done = tested (§7):** component/unit tests cover locale-aware rendering, the live language switch, the
  TBD placeholder in both sites, the missing-entry fallback, and seed-data coverage.

## Notes / open questions
- **Map key:** confirm `tla` vs numeric `id`. `tla` is human-readable but verify every seeded team has a
  unique, present `tla`; placeholder rows may carry an empty/"TBD" `tla` — those are handled by the
  `isTbdTeam` branch before the map lookup, so they should not collide.
- **Map location & parity test:** decide whether the map lives as a TS module under `src/i18n/` (recommended,
  keeps it out of the locale JSON so the en/es parity test is unaffected) or in locale JSON. Whichever is
  chosen, the parity test must still pass.
- **`shortName`:** audit whether `shortName` is displayed anywhere and needs localizing; `name` is the
  primary display string and the focus of this ticket.
- **Coverage test source:** derive the canonical team list from `src/dev/sampleData.ts` if it enumerates
  teams, otherwise from the canonical 48-nation WC 2026 list, to drive the "covers all seeded teams" test.
