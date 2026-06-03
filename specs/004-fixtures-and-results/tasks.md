# 004 — Tasks

> Generated from plan.md. Ordered, atomic, checkboxed. Check off as you implement.

- [x] 1. `src/hooks/useMatches.ts` — onSnapshot over matchesCol, sorted by kickoff, cleanup on unmount
- [x] 2. `src/hooks/useStandings.ts` — onSnapshot over standingsCol, sorted by groupId
- [x] 3. `src/hooks/useMeta.ts` — onSnapshot over config/meta for the freshness badge
- [x] 4. `src/components/MatchCard.tsx` — teams/crests, local kickoff (dayjs), status chip, score, TBD-safe
- [x] 5. `src/components/StandingsTable.tsx` — group table P/W/D/L/GF/GA/GD/Pts
- [x] 6. `src/pages/FixturesPage.tsx` — grouped-by-day, Loading/Empty/Error, freshness badge
- [x] 7. `src/pages/StandingsPage.tsx` — 12 group tables
- [x] 8. `src/dev/sampleData.ts` — sample matches (scheduled/finished/TBD) + one group table
- [x] 9. Write tests for the acceptance rules (MatchCard + FixturesPage)
- [x] 10. Run scoped vitest and confirm the component/page tests pass
- [ ] 11. (PENDING — ticket 008) Seed all 104 WC 2026 matches; then live pages leave the Empty state
- [ ] 12. Update `specs/backlog.md` status to ✅ (owned by the parent/verify step)

## Verification command(s)
```
npx vitest run src/components/MatchCard.test.tsx src/pages/FixturesPage.test.tsx
```
