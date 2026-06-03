# 002 — Tasks

> Generated from plan.md. Ordered, atomic, checkboxed. Check off as you implement.

- [x] 1. Add `src/firebase/auth.ts` — Google provider + sign-in/out + `onAuthChange`.
- [x] 2. Add `src/auth/authContext.ts` + `AuthProvider.tsx` + `useAuth.ts` (profile upsert, membership).
- [x] 3. Add `src/pages/LoginPage.tsx` (sign-in + not-a-member + sign-out).
- [x] 4. Add stub pages: Fixtures / Predictions / Leaderboard / Standings.
- [x] 5. Wire routing: `main.tsx` (BrowserRouter + AuthProvider) and `App.tsx` (route guard + routes).
- [x] 6. Update `App.test.tsx`; add `AuthProvider.test.tsx` for membership rules.
- [x] 7. Run `npm run build`, `npm test`, `npm run lint`, `npx prettier --check src` — all green.
- [ ] 8. PENDING runtime: enable Google provider + seed `config/allowlist` in the Firebase console.
- [ ] 9. Run `/spec-verify 002` and confirm all acceptance rules pass.
- [ ] 10. Update `specs/backlog.md` status to ✅.

## Verification command(s)
```
npm run build
npm test
npm run lint
npx prettier --check src
```
