# 030 — Tasks

- [x] 1. Extract `JoinGroupDialog` (+`parseGid`) from MyGroupsPage; rewire MyGroupsPage to it.
- [x] 2. Add optional `leadingControl` slot to AppShell (renders instead of the soccer icon).
- [x] 3. Create `GroupNavDrawer` (hamburger + translucent-blur temporary Drawer: groups list,
       filter ≥8, create/join actions) reusing `enterableGroups` + tab preservation from 029.
- [x] 4. Mount it in GroupApp (`leadingControl`); title becomes plain group name; delete
       `GroupSwitcher.tsx` + its test.
- [x] 5. i18n keys (`groupNav.*`) in en + es.
- [x] 6. Tests: `GroupNavDrawer.test.tsx` (spec rules 1–3, 6); AppShell/MyGroups suites green.
- [x] 7. Gates: `npm test` · `npm run build` · `npm run lint` · `npx prettier --check` (touched).
- [x] 8. Backlog row 030 → ✅ after verify.

## Verification command(s)
```
npm test && npm run build && npm run lint
```
