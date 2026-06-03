# 007 — Plan (UI / reader side)

> Generated from spec.md. Technical design only — no behavior the spec doesn't call for.
> Scope here is the **live-reading UI**. The `buildLeaderboard` aggregation (the WRITER) is
> ticket 008 (ingestion) and is NOT implemented here.

## Approach
Build a thin, read-only UI over the public `leaderboard/{uid}` aggregate. A custom hook
(`useLeaderboard`) opens an `onSnapshot` real-time listener on the typed `leaderboardCol`
ordered by `totalPoints` desc, exposing `{ entries, loading, error }` and tearing the
listener down on unmount. `LeaderboardPage` computes which `rank` values are tied (more than
one entry sharing a rank) and renders one `LeaderboardRow` per entry — passing `isTie` and
`isCurrentUser`. The row shows rank (ties as "T-3"), avatar/name, total points, and the
tiebreaker stats (exact/outcome counts), highlighting the signed-in user. Predictions are
never read — only the aggregate — so picks stay private (acceptance rule 4).

The dense `rank` and tiebreaker chain (`totalPoints → exactCount → outcomeCount → displayName`)
are computed by ingestion and persisted on each entry; the UI simply renders `entry.rank`,
deriving the "T-" prefix from rank-collision detection across the loaded entries.

## Files to create / change
| Path | Change | Notes |
|------|--------|-------|
| `src/hooks/useLeaderboard.ts` | new | `onSnapshot` over `leaderboardCol`, `orderBy('totalPoints','desc')`; returns `{ entries, loading, error }`; cleans up on unmount. |
| `src/components/LeaderboardRow.tsx` | new | Presentational row: rank (ties → "T-3"), avatar/name, points, exact/outcome stats; highlights current user. |
| `src/pages/LeaderboardPage.tsx` | overwrite stub | Live ranked list with Loading/Empty/Error states + ingestion note; derives tie flags. |
| `src/components/LeaderboardRow.test.tsx` | new | Rank/tie/highlight rendering. |
| `src/pages/LeaderboardPage.test.tsx` | new | Ordering, tie display, states, highlight (mocks the hook + auth). |

## Data shapes / interfaces
```ts
// Consumed read-only from src/shared/types.ts (do not redefine):
// LeaderboardEntry { uid, displayName, photoURL, totalPoints,
//   exactCount, outcomeCount, predictionsGraded, rank, updatedAt }

export interface UseLeaderboardResult {
  entries: LeaderboardEntry[] // ordered by totalPoints desc
  loading: boolean
  error: Error | null
}
export function useLeaderboard(): UseLeaderboardResult

export interface LeaderboardRowProps {
  entry: LeaderboardEntry
  isTie?: boolean         // entry shares its rank with another -> "T-{rank}"
  isCurrentUser?: boolean // highlight + "You" badge
}
```

## Reused utilities
- `src/firebase/db.ts` — `leaderboardCol` (typed `CollectionReference<LeaderboardEntry>` with converter).
- `src/shared/types.ts` — `LeaderboardEntry` type (single source of truth; never redefined).
- `src/auth/useAuth.ts` — current user, to highlight their row.
- `src/components/states/` — `LoadingState` / `EmptyState` / `ErrorState`.
- `src/theme/theme.ts` — MD3 tokens via the palette (`action.selected`, `text.secondary`, etc.); no hard-coded colors.

## Test strategy
- `LeaderboardRow.test.tsx`: renders rank/name/points/stats; tie → "T-3"; current-user
  highlight (`aria-current` + "You"); avatar initial fallback.
- `LeaderboardPage.test.tsx`: mocks `useLeaderboard` + `useAuth` with inline sample
  `LeaderboardEntry[]`; asserts loading/empty/error states, the ingestion note, ordering
  (totalPoints desc), tie display ("T-2" for shared rank), and current-user highlight.
- Verification: `npx vitest run src/components/LeaderboardRow.test.tsx src/pages/LeaderboardPage.test.tsx`.

## Risks
- Listener leak → return `onSnapshot`'s unsubscribe from `useEffect`.
- Tie display drift if it duplicated ingestion logic → instead derive purely from the
  persisted `rank` (rank collisions), keeping the single ranking source in ingestion.
- Permission/connection error → surfaced via the `error` channel and the `ErrorState`.

## PENDING (cross-ticket dependency)
- The leaderboard is **empty until ticket 008 (ingestion)** computes and writes
  `leaderboard/{uid}` via `buildLeaderboard`. Until then the page renders the **Empty state**.
  Rankings refresh live after each ingestion run (the page is a pure reader).
- Raw predictions remain owner-only; only the aggregate is read here. Firestore read access to
  `leaderboard` is governed by `firestore.rules` (owned elsewhere), not by this UI.
