# 030 — Plan

## Approach
Port Canvas variant A (`src/dev/GroupNavPreviews.tsx` → `HamburgerDrawerPreview`) to a real
component wired to `useMyGroups`/`useGroup`/router, reusing the 029 switcher's `enterableGroups`
+ tab-preserving navigation and the My Groups join dialog (extracted).

## Files to create / change
| Path | Change | Notes |
|------|--------|-------|
| `src/components/GroupNavDrawer.tsx` | new | hamburger + temporary Drawer (translucent blur paper) |
| `src/components/GroupNavDrawer.test.tsx` | new | rules 1–3, 6 |
| `src/components/JoinGroupDialog.tsx` | new | extracted from MyGroupsPage (parseGid + dialog) |
| `src/pages/MyGroupsPage.tsx` | edit | use the extracted dialog |
| `src/components/AppShell.tsx` | edit | optional `leadingControl` slot (replaces soccer icon) |
| `src/group/GroupApp.tsx` | edit | `leadingControl={<GroupNavDrawer />}`, plain title |
| `src/components/GroupSwitcher.tsx` + test | delete | superseded by the drawer |
| `src/i18n/locales/en.json` / `es.json` | edit | `groupNav.*` keys |

## Reused utilities
- `enterableGroups` logic + tab preservation from `GroupSwitcher.tsx` (move into the new file).
- `parseGid` + join dialog from `MyGroupsPage.tsx` (extract, reuse in both).
- Theme: `alpha(theme.palette.background.paper, ~0.85)` + `backdropFilter: blur(8px)` for the
  drawer paper, mirroring the `MuiAppBar` override in `src/theme/theme.ts`.

## Test strategy
- Drawer open/close + a11y names; group list + current check + navigate-preserving-tab;
  create/join actions; ≥8-group filter + no-match. MyGroupsPage existing tests stay green.

## Risks
- Deleting GroupSwitcher breaks imports → repo-wide grep; GroupApp is the only consumer.
- Drawer over app bar z-index: AppBar uses `zIndex.drawer + 1`; temporary drawer must sit ABOVE
  the bar (MUI modal default) — verify visually via tests on `aria-modal` presence.
