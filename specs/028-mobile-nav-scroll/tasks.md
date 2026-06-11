# 028 — Tasks

> Generated from plan.md. Ordered, atomic, checkboxed. Check off as you implement.

- [x] 1. **Scrollable strip.** In `src/components/AppShell.tsx` `bottomBar`, wrap `<BottomNavigation>` in a
      `<Box>` with `overflowX: 'auto'`, `overflowY: 'hidden'`, and the scrollbar hidden
      (`scrollbarWidth: 'none'`, `msOverflowStyle: 'none'`, `'&::-webkit-scrollbar': { display: 'none' }`,
      `WebkitOverflowScrolling: 'touch'`).
- [x] 2. **Stop the squish.** Set `BottomNavigation` `sx={{ width: 'max-content', minWidth: '100%',
      justifyContent: 'flex-start' }}` and each `BottomNavigationAction` `sx={{ flex: '0 0 auto',
      minWidth: 72, maxWidth: 168 }}` so items keep a readable width and overflow instead of shrinking.
      (If 3–4 items look left-bunched, use `flex: '1 0 auto'` + `minWidth` so few items fill the bar while
      many still overflow — eyeball both cases.)
- [x] 3. **Scroll selected into view.** Add `selectedRef` (`useRef<HTMLButtonElement>`) on the action whose
      `key === selectedKey`, and a `useEffect` keyed on `selectedKey` calling
      `selectedRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' })`. Add `useRef`/`useEffect`
      imports.
- [x] 4. **Keep desktop + a11y intact.** Leave the `Drawer` rail branch, the top app bar, and the
      `aria-label={t('appShell.primaryNav')}` + selected-value behavior unchanged.
- [x] 5. **Tests.** In `src/components/AppShell.test.tsx`: mock `Element.prototype.scrollIntoView`; add a
      test rendering `AppShell` with a 7-item `navItems` array (mobile path) asserting all 7 labels present,
      the action root is `flex: 0 0 auto` with a `min-width` (not `flex: 1`), the scroll container has
      `overflow-x: auto`, and `scrollIntoView` was called for the selected item. Keep the existing 4 tests
      green.
- [x] 6. **Run the gates:** `npm run build`, `npm test`, `npm run lint`, `npx prettier --check` (touched
      files). Confirm `git diff --name-only` shows only `src/components/AppShell.tsx` +
      `src/components/AppShell.test.tsx` (no navItems/routing/scoring/rules/ingest).
- [x] 7. Run `/spec-verify 028` and confirm all acceptance rules pass.
- [x] 8. Update `specs/backlog.md` status to ✅.

## Verification command(s)
```
npm run build
npm test            # AppShell: 7-item scroll + min-width + scrollIntoView + existing 4 tests
npm run lint
npx prettier --check src/components/AppShell.tsx src/components/AppShell.test.tsx
git diff --name-only   # expect only src/components/AppShell.tsx, src/components/AppShell.test.tsx (+ specs/028, backlog)
```
