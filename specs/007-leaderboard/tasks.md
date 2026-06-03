# 007 — Tasks (UI / reader side)

> Generated from plan.md. Ordered, atomic, checkboxed.
> Scope: live-reading UI only. The `buildLeaderboard` writer is ticket 008 (ingestion).

- [x] 1. `useLeaderboard` hook: `onSnapshot` over `leaderboardCol` ordered by `totalPoints` desc; return `{ entries, loading, error }`; unsubscribe on unmount.
- [x] 2. `LeaderboardRow` component: rank (ties → "T-3"), avatar/displayName, totalPoints, exact/outcome tiebreaker stats; highlight current user via `useAuth`.
- [x] 3. Overwrite `LeaderboardPage` stub: live ranked list with Loading/Empty/Error states + a note that rankings update after each ingestion run; derive tie flags from rank collisions.
- [x] 4. Tests: `LeaderboardRow.test.tsx` and `LeaderboardPage.test.tsx` with inline sample `LeaderboardEntry[]`; assert ordering and tie display.
- [x] 5. Run the verification command and confirm tests pass (12/12 passing).

## Verification command(s)
```
npx vitest run src/components/LeaderboardRow.test.tsx src/pages/LeaderboardPage.test.tsx
```

## PENDING (not in this ticket's lane)
- Ticket 008 (ingestion) implements `buildLeaderboard` to compute the tiebreaker dense rank
  and write `leaderboard/{uid}`. Until that runs, this page shows the **Empty state**.
- `firestore.rules` read access for `leaderboard` and the predictions-privacy guarantee are
  enforced server-side (owned elsewhere), not by this UI.
- Full `npm run build` / `npm test` integration check is run by the parent, not here.
