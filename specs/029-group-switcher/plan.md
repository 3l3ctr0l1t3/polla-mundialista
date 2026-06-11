# 029 — Plan

> Generated from spec.md. Technical design only — no behavior the spec doesn't call for.

## Approach
Make the app-bar title an optional interactive slot, and drop a self-contained `GroupSwitcher` into it
when inside a group. AppShell stays generic; all group logic lives in `GroupSwitcher`.

1. **`AppShell` gains `titleControl?: ReactNode`.** When provided, the app bar renders `titleControl` in
   the title position instead of the plain `<Typography component="h1">{title}</Typography>`. When absent,
   the title string renders exactly as today (so ticket-028 work + the existing AppShell tests are
   untouched). `title` is still passed (used as the accessible/document label + the `resolvedTitle`
   fallback).
2. **`GroupSwitcher` (new).** A button in the title slot showing the **current group name** + a
   `ArrowDropDownIcon`, styled `color="inherit"` to read on the app-bar. Click opens a MUI `Menu` anchored
   to it.
   - Group list = **dedupe([...owned, ...approved.map(a ⇒ a.group)], by `groupId`)** from `useMyGroups`,
     sorted by `name` (locale, case-insensitive). Pending excluded (not in the union). Current group key =
     `useGroup().gid`.
   - Each `MenuItem` is `selected={g.groupId === gid}` with a leading check (`CheckIcon`) for the current
     one; click → `navigate(\`/g/${g.groupId}/${currentTab}\`)` then close.
   - **`currentTab`** = the 3rd path segment of `useLocation().pathname` (`/g/:gid/<tab>`), defaulting to
     `fixtures`. The existing route guards already redirect Admin/Canvas to fixtures if the target group
     doesn't expose them, so preserving the tab is safe.
   - **Search-when-many:** if the list length ≥ `SEARCH_THRESHOLD` (8), render a small filter `TextField`
     (autoFocus, `placeholder=t('groupSwitcher.searchPlaceholder')`) pinned at the top of the menu; filter
     items by name (case-insensitive `includes`). `onKeyDown`/`onClick` `stopPropagation` so typing doesn't
     trigger MUI's menu keyboard nav / selection. Below the threshold: no field.
   - **States:** the trigger ALWAYS shows the current group name (from `useGroup().group?.name`), even while
     `useMyGroups` loads (menu may be briefly just the current group). With one group the caret + menu still
     render (that group shown checked) — harmless. Never crashes on empty/loading.
   - **a11y:** trigger is a `Button` with `aria-haspopup="menu"`, `aria-expanded={open}`,
     `aria-controls`; the button's accessible name is the group name (keeps an accessible group label even
     though it's no longer an `<h1>`); items keyboard-navigable; current conveyed via `selected`.
3. **`GroupApp`** passes `titleControl={<GroupSwitcher />}` to AppShell (still also `title={group.name}` for
   the document/label fallback).
4. **i18n:** add a small `groupSwitcher.*` block (trigger aria-label, search placeholder, maybe "current"
   marker aria) to BOTH `en.json` and `es.json`.

### Sketch
```tsx
// GroupSwitcher.tsx
const { gid, group } = useGroup()
const { owned, approved } = useMyGroups()
const navigate = useNavigate()
const tab = useLocation().pathname.split('/').filter(Boolean)[2] ?? 'fixtures'
const groups = dedupeSortByName([...owned, ...approved.map(a => a.group)])  // by groupId
const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
const [filter, setFilter] = useState('')
const showSearch = groups.length >= 8
const shown = showSearch ? groups.filter(g => g.name.toLowerCase().includes(filter.toLowerCase())) : groups
// <Button color="inherit" aria-haspopup="menu" aria-expanded={!!anchorEl} onClick=…>{group?.name} <ArrowDropDownIcon/></Button>
// <Menu> [optional <TextField/>] {shown.map(g => <MenuItem selected={g.groupId===gid} onClick={() => { navigate(`/g/${g.groupId}/${tab}`); close() }}>…</MenuItem>)} </Menu>
```

## Files to create / change
| Path | Change | Notes |
|------|--------|-------|
| `src/components/GroupSwitcher.tsx` | new | The trigger button + Menu of groups; reads `useGroup`/`useMyGroups`; navigates on select; search when ≥8. |
| `src/components/GroupSwitcher.test.tsx` | new | Opens menu, lists deduped enterable groups, current selected; select → navigate + close; pending excluded; search threshold; a11y attrs. |
| `src/components/AppShell.tsx` | edit | Add optional `titleControl?: ReactNode`; render it in the title slot when present, else the plain `title` Typography (today's behavior). Desktop rail + bottom bar untouched. |
| `src/components/AppShell.test.tsx` | edit | Add: with `titleControl` provided it renders the control (and the plain-title heading path still works without it). Keep existing 8 tests green. |
| `src/group/GroupApp.tsx` | edit | Pass `titleControl={<GroupSwitcher />}` (keep `title={group.name}`). |
| `src/i18n/locales/en.json` / `es.json` | edit | New `groupSwitcher.*` keys in BOTH (key-parity). |

## Data shapes / interfaces
No Firestore/type changes. `Group` already has `groupId` + `name`. New AppShell prop:
```ts
export interface AppShellProps {
  // …existing…
  /** Interactive control rendered in the app-bar title slot (e.g. a group switcher). Falls back to `title`. */
  titleControl?: ReactNode
}
```
`GroupSwitcher` takes no props (reads context). A small local helper:
```ts
function enterableGroups(owned: Group[], approved: JoinedGroup[]): Group[] // dedupe by groupId, sort by name
```

## Reused utilities
- `useMyGroups` (`src/hooks/useMyGroups`) — owned ∪ approved (pending excluded); read-only.
- `useGroup` (`src/group/useGroup`) — current `gid`/`group`.
- `useNavigate`/`useLocation` (react-router-dom) — navigation + current tab segment, same pattern as
  `GroupApp.handleNavigate`.
- MUI `Menu`/`MenuItem`/`TextField`/`Button`/`ListItemIcon`/`CheckIcon`/`ArrowDropDownIcon` — already in deps.
- `Group.groupId` navigation pattern (`/g/${groupId}/<tab>`) — same as `MyGroupsPage`.

## Test strategy
- **AC1 (menu lists enterable groups, current selected):** render `GroupSwitcher` with mocked
  `useGroup` (gid=g1) + `useMyGroups` (owned [g1], approved [g2,g3]); click trigger; assert g1/g2/g3 names
  present and the g1 item is `selected` (aria-current / Mui-selected).
- **AC2 (select → navigate + close):** mock `useNavigate`; click the g2 item; assert
  `navigate('/g/g2/<tab>')` and the menu closed. Use a mocked `useLocation` to set the current tab.
- **AC3 (pending excluded):** include a pending group in the mock; assert its name is absent.
- **AC4 (search threshold):** with ≥8 groups assert the filter `TextField` renders and typing narrows the
  list; with few groups assert no field.
- **AC5 (AppShell slot):** `AppShell.test.tsx` — with `titleControl` the control renders; without it the
  plain title heading still renders (existing tests). Desktop rail unchanged (diff).
- **AC6 (a11y):** assert the trigger has `aria-haspopup="menu"` and `aria-expanded` toggles; the current
  group is conveyed (selected). 
- **AC7 (i18n):** key-parity test green with the new `groupSwitcher.*` keys in both locales.
- **AC8 (gates):** `npm run build`, `npm test`, `npm run lint`, `npx prettier --check` (touched files);
  `git diff` shows no change to scoring/rules/ingest/routing-structure.

## Risks
- **Menu search field swallows / conflicts with MUI menu keyboard nav** → `stopPropagation` on the
  TextField's `onKeyDown`/`onClick`; `autoFocus` the field; don't make it a `MenuItem`.
- **Lost `<h1>` heading** when the title becomes a button → keep an accessible group label via the button's
  text/`aria-label`; the existing AppShell heading tests use the plain-title path (no `titleControl`) so
  they stay green. Note for the implementer to keep a sensible accessible name.
- **Switching to a tab the target group doesn't expose** (Admin/Canvas) → route guards already redirect to
  fixtures; acceptable. If it feels odd, default to `fixtures` on switch — planner's fallback.
- **Duplicate group across owned+approved** (owner who also has a member doc) → dedupe by `groupId` so a
  group appears once.
- **App-bar contrast** (button must be legible on the primary AppBar) → `color="inherit"`, match the
  existing title typography; verify visually but no theme change.
