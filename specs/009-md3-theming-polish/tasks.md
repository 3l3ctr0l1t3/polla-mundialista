# 009 — Tasks

> Generated from plan.md. Ordered, atomic, checkboxed. Check off as you implement.

- [x] 1. Add `src/theme/tokens.ts` — seed color, light/dark tonal palettes, spacing, shape, type scale, layout constants.
- [x] 2. Rewrite `src/theme/theme.ts` to build light + dark MD3 `colorSchemes` from tokens, with component defaults.
- [x] 3. Add `src/components/navItems.tsx` — `NavItem` type + `DEFAULT_NAV_ITEMS` (Fixtures, Predictions, Leaderboard, Standings).
- [x] 4. Add `src/components/AppShell.tsx` — top app bar + responsive nav (bottom bar on mobile, rail on desktop) via `useMediaQuery`; accepts `children`, no router wiring.
- [x] 5. Add reusable state components in `src/components/states/` (`LoadingState`, `EmptyState`, `ErrorState`) + barrel `index.ts`.
- [x] 6. Write `src/components/AppShell.test.tsx` smoke test (title, children, nav labels) with a `matchMedia` stub.
- [x] 7. Run verification: vitest, `npm run build`, `npm run lint`, `prettier --check`.
- [ ] 8. Run `/spec-verify 009` and confirm all acceptance rules pass.
- [ ] 9. Update `specs/backlog.md` status to ✅.

## Verification command(s)

```
npx vitest run src/components/AppShell.test.tsx
npm run build
npm run lint
npx prettier --check src/theme src/components
```
