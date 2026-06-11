# 031 — Plan

## Approach
- New `FullScreenLoader` in `src/components/states/` (centered `CircularProgress`, role=status,
  label prop); used by the `App.tsx` session gate and the `GroupApp.tsx` group gate.
- `GroupNavDrawer`: drawer root `zIndex: appBar − 1` (so the bar + hamburger stay on top and
  clickable), paper `pt` clearing the bar + spacing; button toggles open/close, swaps
  `MenuIcon`/`CloseIcon`, aria-label + `aria-expanded`; selected row forces
  `'&.Mui-selected': { bgcolor: 'action.selected' }` (kills MUI's primary-tinted default).

## Files
| Path | Change |
|------|--------|
| `src/components/states/FullScreenLoader.tsx` (+index export) | new |
| `src/App.tsx` · `src/group/GroupApp.tsx` | use it |
| `src/components/GroupNavDrawer.tsx` | fixes 2–5 |
| `src/components/GroupNavDrawer.test.tsx` | toggle/X/aria tests |
| `src/i18n/locales/en.json` / `es.json` | `groupNav.closeMenu` |

## Test strategy
Toggle-click closes; icon/aria swap; Esc/backdrop still close; selected-row neutral bg via sx;
loader renders spinner (no skeleton) in both gates (existing gate tests updated if they assert
skeletons).

## Risks
- Modal zIndex override: sx on Drawer root wins over the default modal z-index — verify via test
  that the button stays clickable (fireEvent works regardless, so also assert computed class/style).
