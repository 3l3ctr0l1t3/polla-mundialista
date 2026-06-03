# 004 — Plan

> Generated from spec.md. Technical design only — no behavior the spec doesn't call for.

## Approach
Build the read-only fixtures/results/standings UI on top of the existing typed Firestore refs
(`src/firebase/db.ts`) and shared types (`src/shared/types.ts`). Two `onSnapshot` hooks expose live
data; presentational components render it; pages compose hooks + Loading/Empty/Error states.

This ticket delivers the **UI only**. Real fixtures require the ingestion job (ticket 008) plus a
football-data.org key and a Firebase service-account key to seed Firestore. Until seeding runs, the
`matches`/`standings` collections are empty, so both pages render their live **Empty** state. A small
`src/dev/sampleData.ts` set drives component/page tests so rendering is provable now. Sample data is
NOT wired into production hooks.

Field note: the spec text says "config/meta.lastIngestRun", but the canonical model
(`MetaConfig`, `src/shared/types.ts`) names the field `lastIngestAt: Timestamp | null`. We read the
real field and show nothing when it is absent/null.

## Files to create / change
| Path | Change | Notes |
|------|--------|-------|
| `src/hooks/useMatches.ts` | new | `onSnapshot` over `matchesCol`, ordered by kickoff; `{ matches, loading, error }`; cleanup on unmount |
| `src/hooks/useStandings.ts` | new | `onSnapshot` over `standingsCol`; `{ standings, loading, error }`; cleanup on unmount |
| `src/hooks/useMeta.ts` | new | `onSnapshot` over `config/meta`; exposes `lastIngestAt` for the freshness badge |
| `src/components/MatchCard.tsx` | new | Teams + crests, local kickoff (dayjs), status chip, score, TBD-safe |
| `src/components/StandingsTable.tsx` | new | Group table: P/W/D/L/GF/GA/GD/Pts |
| `src/pages/FixturesPage.tsx` | overwrite stub | Matches grouped by day; Loading/Empty/Error; freshness badge |
| `src/pages/StandingsPage.tsx` | overwrite stub | 12 group tables A–L |
| `src/dev/sampleData.ts` | new | Realistic sample (scheduled, finished, TBD knockout, one group table) for tests |
| `src/components/MatchCard.test.tsx` | new | Scheduled / finished / TBD rendering |
| `src/pages/FixturesPage.test.tsx` | new | Page renders sample matches grouped + freshness badge |

## Data shapes / interfaces
```ts
// src/hooks/useMatches.ts
export interface UseMatchesResult {
  matches: Match[]      // sorted ascending by kickoff
  loading: boolean
  error: Error | null
}
export function useMatches(): UseMatchesResult

// src/hooks/useStandings.ts
export interface UseStandingsResult {
  standings: Standing[] // sorted by groupId A–L
  loading: boolean
  error: Error | null
}
export function useStandings(): UseStandingsResult

// src/hooks/useMeta.ts
export interface UseMetaResult {
  meta: MetaConfig | null
  loading: boolean
  error: Error | null
}

// Grouping helpers (exported for pages + tests)
export function groupMatchesByDay(matches: Match[]): { dayKey: string; label: string; matches: Match[] }[]

// src/components/MatchCard.tsx
export interface MatchCardProps { match: Match }
// A team is rendered as "TBD" when its id <= 0 or name is empty (knockout placeholder).
```

## Reused utilities
- `db`, `matchesCol`, `standingsCol`, `metaConfigDoc` — `src/firebase/db.ts`.
- `Match`, `Team`, `Score`, `Standing`, `MetaConfig`, `MatchStatus` — `src/shared/types.ts`.
- `LoadingState`, `EmptyState`, `ErrorState` — `src/components/states`.
- `dayjs` for local-time formatting + day grouping.
- MUI theme tokens only (no hard-coded colors); status chip uses palette `color` props.

## Test strategy
- `MatchCard.test.tsx`: renders a SCHEDULED match (kickoff time, status chip, no score); a FINISHED
  match (score shown); a TBD knockout match (placeholder names, no crash). Sample data from
  `src/dev/sampleData.ts`.
- `FixturesPage.test.tsx`: with hooks mocked to return sample data, asserts matches appear grouped by
  day and the freshness badge renders from `lastIngestAt`; also asserts the live Empty state when the
  matches array is empty.
- Verify (scoped, to avoid colliding with parallel agents):
  `npx vitest run src/components/MatchCard.test.tsx src/pages/FixturesPage.test.tsx`.

## Risks
- **Empty Firestore until seeding (PENDING).** Pages legitimately show Empty with live data; covered by
  a sample-data path in tests. → Documented; not a defect.
- **Spec field-name drift** (`lastIngestRun` vs `lastIngestAt`). → Use the canonical type field; note it here.
- **TBD detection heuristic.** football-data placeholder teams have non-positive ids / blank names. →
  Centralize in a single `isTbdTeam` helper so seeding can later confirm the shape.

## PENDING (out of this ticket)
- Real 104-match seeding via the ingestion job (ticket 008) + football-data key + service-account key.
- `IN_PLAY` live behavior is rendered but unverifiable without live data.
