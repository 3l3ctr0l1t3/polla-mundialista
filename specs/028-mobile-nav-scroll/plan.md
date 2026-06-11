# 028 — Plan

> Generated from spec.md. Technical design only — no behavior the spec doesn't call for.

## Approach
Keep the MUI `BottomNavigation` (its MD3 look + selected state + a11y), but stop it from squishing items
and let it **scroll horizontally** when they overflow. Two changes inside `AppShell.tsx`'s `bottomBar`:

1. **Wrap `BottomNavigation` in a horizontally scrollable strip.** The fixed `Paper` gets an inner `Box`
   with `overflowX: 'auto'`, `overflowY: 'hidden'`, and the scrollbar hidden visually
   (`scrollbarWidth: 'none'`, `'&::-webkit-scrollbar': { display: 'none' }`, `msOverflowStyle: 'none'`).
   `WebkitOverflowScrolling: 'touch'` for momentum.
2. **Make each action fixed-width instead of `flex: 1`.** `BottomNavigation` defaults every
   `BottomNavigationAction` to `flex: 1` (equal distribution → shrink). Override to `flex: '0 0 auto'` with
   a readable `minWidth` (≈72–80px) so the row grows past the viewport and the wrapper scrolls. Set the
   `BottomNavigation` itself to `width: 'max-content'`, `minWidth: '100%'`, `justifyContent: 'flex-start'`
   so with FEW items it still fills the bar (no left-bunching), and with MANY it overflows.

3. **Scroll the selected item into view.** A `ref` on the selected action + a `useEffect` keyed on
   `selectedKey` that calls `el.scrollIntoView({ inline: 'center', block: 'nearest' })` so the active
   destination is visible after navigation / on mount, even if off-screen.

Desktop rail (`Drawer`) branch, the top app bar, and everything else are untouched. No nav-item/route
change; `navItems.tsx` and `GroupApp.tsx` are not touched.

### Sketch (bottomBar)
```tsx
const selectedRef = useRef<HTMLButtonElement | null>(null)
useEffect(() => {
  selectedRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' })
}, [selectedKey])

const bottomBar = (
  <Paper square elevation={3} sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: theme.zIndex.appBar }}>
    <Box sx={{
      overflowX: 'auto', overflowY: 'hidden',
      scrollbarWidth: 'none', msOverflowStyle: 'none',
      '&::-webkit-scrollbar': { display: 'none' },
      WebkitOverflowScrolling: 'touch',
    }}>
      <BottomNavigation
        showLabels
        value={selectedKey ?? false}
        onChange={(_, key: string) => handleSelect(key)}
        aria-label={t('appShell.primaryNav')}
        sx={{ width: 'max-content', minWidth: '100%', justifyContent: 'flex-start' }}
      >
        {items.map((item) => (
          <BottomNavigationAction
            key={item.key}
            ref={item.key === selectedKey ? selectedRef : undefined}
            value={item.key}
            label={item.label}
            icon={item.icon}
            sx={{ flex: '0 0 auto', minWidth: 72, maxWidth: 168 }}
          />
        ))}
      </BottomNavigation>
    </Box>
  </Paper>
)
```

## Files to create / change
| Path | Change | Notes |
|------|--------|-------|
| `src/components/AppShell.tsx` | edit | Wrap `BottomNavigation` in an overflow-x scroll `Box` (scrollbar hidden); set actions `flex:'0 0 auto'` + `minWidth`; add `selectedRef` + `useEffect` scroll-into-view. Add `useRef`/`useEffect` imports (`Box` already imported). Desktop rail untouched. |
| `src/components/AppShell.test.tsx` | edit | Add: render with 7 nav items at mobile → all 7 labels present; the action root is `flex:'0 0 auto'` (not flex:1) with a minWidth; the scroll container has `overflow-x: auto`; `scrollIntoView` (mocked) is called for the selected item. Keep existing 4 tests green. |

## Data shapes / interfaces
No types, props, routes, or i18n change. `AppShellProps`, `NavItem` unchanged. The only new internal state
is a `useRef<HTMLButtonElement>` + an effect on `selectedKey` — purely presentational.

## Reused utilities
- MUI `BottomNavigation` / `BottomNavigationAction` / `Paper` / `Box` — already imported; reused, restyled.
- `useMediaQuery(theme.breakpoints.up('sm'))` — unchanged; still gates rail vs bottom bar.
- `defaultNavItems` / `NavItem` (`navItems.tsx`) — read-only; the bar already maps over `items`.
- i18n `appShell.primaryNav` — unchanged nav landmark label.

## Test strategy
- **AC1 (all render + scrollable):** render `AppShell` with a 7-item `navItems` array at the mobile path
  (the suite already stubs `matchMedia` → `matches:false` → bottom bar). Assert all 7 labels are in the DOM
  and the scroll container has `overflow-x: auto` (read the emitted `style`/computed style).
- **AC2 (min-width, not flex:1):** assert a `BottomNavigationAction` root carries `flex: 0 0 auto` and a
  `min-width` — i.e. the equal-distribution shrink is gone.
- **AC3 (selected scrolled into view):** mock `Element.prototype.scrollIntoView = vi.fn()`; render with a
  `selectedKey`; assert `scrollIntoView` was called (the wired ref/effect). jsdom has no layout, so assert
  the call, not pixels.
- **AC4 (desktop rail unchanged):** the existing AppShell tests (title, children, default destinations,
  custom title) stay green; the rail branch isn't edited (diff).
- **AC5 (a11y):** `aria-label={t('appShell.primaryNav')}` stays on the `BottomNavigation`; selected value
  still drives the MUI selected state.
- **AC6 (gates):** `npm run build`, `npm test`, `npm run lint`, `npx prettier --check` (touched files);
  `git diff` shows only `AppShell.tsx` + `AppShell.test.tsx`.

## Risks
- **jsdom can't measure scroll** → assert the wired mechanism (`scrollIntoView` called) + applied styles,
  not scroll position. Mock `scrollIntoView` (jsdom doesn't implement it; calling it would throw).
- **Few-items regression** (bar looks left-bunched with 3–4 items) → `minWidth:'100%'` +
  `justifyContent:'flex-start'` + `flex:'0 0 auto'` may leave right-side whitespace. Mitigation: if it
  reads poorly, use `flex:'1 0 auto'` with a `minWidth` so few items fill the width but many still overflow.
  Implementer eyeballs both the 4-item and 7-item cases; behavior (all reachable + scroll on overflow) is
  unchanged either way.
- **Scrollbar-hide cross-browser** → cover WebKit (`::-webkit-scrollbar`), Firefox (`scrollbarWidth`), old
  Edge (`msOverflowStyle`); the strip stays scrollable by touch/trackpad regardless.
- **MUI passing `ref`/`sx` to `BottomNavigationAction`** is supported; keep `value` for selection.
