# 029 — Tasks

> Generated from plan.md. Ordered, atomic, checkboxed. Check off as you implement.

- [x] 1. **AppShell title slot.** In `src/components/AppShell.tsx`, add optional `titleControl?: ReactNode`
      to `AppShellProps`; in the app bar render `titleControl` in the title position when provided, else the
      existing `<Typography component="h1">{resolvedTitle}</Typography>`. Leave the rail + bottom bar +
      everything else unchanged.
- [x] 2. **GroupSwitcher component.** Create `src/components/GroupSwitcher.tsx`: a `color="inherit"` trigger
      `Button` showing `useGroup().group?.name` + `ArrowDropDownIcon`, with `aria-haspopup="menu"` +
      `aria-expanded`. Build the group list from `useMyGroups` as `dedupe([...owned, ...approved.map(a =>
      a.group)], by groupId)` sorted by name (pending excluded). Open a MUI `Menu`; each `MenuItem`
      `selected={g.groupId === gid}` with a `CheckIcon` for the current; on click
      `navigate(\`/g/${g.groupId}/${currentTab}\`)` (currentTab = 3rd path segment of `useLocation`, default
      `fixtures`) then close.
- [x] 3. **Search-when-many.** When the list length ≥ 8, render an autofocus filter `TextField` at the top
      of the menu (placeholder localized) that filters items by name; `stopPropagation` on its
      `onKeyDown`/`onClick`. Below 8, no field.
- [x] 4. **Wire into GroupApp.** In `src/group/GroupApp.tsx`, pass `titleControl={<GroupSwitcher />}` to
      `AppShell` (keep `title={group.name}`).
- [x] 5. **i18n.** Add a `groupSwitcher.*` block (trigger aria-label, search placeholder, current-group aria)
      to BOTH `src/i18n/locales/en.json` and `es.json`. Keep key-parity green.
- [x] 6. **Tests.** Add `src/components/GroupSwitcher.test.tsx` (mock `useGroup`/`useMyGroups`/`useNavigate`/
      `useLocation`): opens menu, lists deduped enterable groups, current `selected`; select other → navigate
      `/g/{id}/{tab}` + close; pending excluded; search field only at ≥8 and filters; trigger
      `aria-haspopup`/`aria-expanded`. Update `src/components/AppShell.test.tsx`: `titleControl` renders when
      given; plain-title heading still works without it; keep existing tests green.
- [x] 7. **Run the gates:** `npm run build`, `npm test`, `npm run lint`, `npx prettier --check` (touched
      files). Confirm `git diff --name-only` shows no change to scoring/`firestore.rules`/`scripts/ingest/*`
      or routing structure (only AppShell/GroupApp/GroupSwitcher/i18n + specs).
- [x] 8. Run `/spec-verify 029` and confirm all acceptance rules pass.
- [x] 9. Update `specs/backlog.md` status to ✅.

## Verification command(s)
```
npm run build
npm test            # GroupSwitcher + AppShell titleControl + i18n parity
npm run lint
npx prettier --check src/components/GroupSwitcher.tsx src/components/GroupSwitcher.test.tsx src/components/AppShell.tsx src/components/AppShell.test.tsx src/group/GroupApp.tsx src/i18n/locales/en.json src/i18n/locales/es.json
# Unchanged & still green:
npm run test:rules
npm run test:ingest
```
