# 031 — Drawer & loader polish (quick fixes)

> Status: ⬜ not started · Depends on: 030 · Specialist: react-mui-builder

## Why
First-use feedback on the 030 hamburger drawer and the app's loading screen (user request,
2026-06-11): the skeleton-bar loading screen reads as broken; the drawer can't be closed from the
icon that opened it (the modal drawer covers the app bar); the open state gives no visual cue; the
options start cramped at the top; and the current-group row carries a blue translucent wash.

## User story
As a **player**, I want **an obvious spinner while the app loads and a hamburger that visibly
toggles the groups drawer** so that **navigation feels predictable and polished**.

## Scope (the five fixes)
1. **Spinner loading screen:** replace the full-screen skeleton gates (session check in `App.tsx`,
   group load in `GroupApp.tsx`) with a centered circular spinner (`CircularProgress`), accessible
   label preserved. In-page list skeletons (`LoadingState`) stay as they are.
2. **Icon closes the drawer:** clicking the hamburger while the drawer is open closes it. The
   drawer must render BELOW the fixed app bar so the icon stays visible and clickable.
3. **Icon shows "X" when open:** the button swaps Menu → Close icon, with localized aria-labels
   (`groupNav.openMenu` / new `groupNav.closeMenu`), `aria-expanded` reflecting state.
4. **Top padding:** the drawer's content starts below the app bar with extra breathing room.
5. **No blue wash on options:** the selected group row uses the neutral `action.selected`
   background instead of MUI's default primary-tinted (blue) selection; the blue accents that
   remain are the avatar/check, not the row background. Drawer translucency/blur is kept.

## Non-goals
- No changes to drawer contents/actions, routes, or any non-drawer surface beyond the two loading
  gates. No theme-wide override changes.

## Acceptance rules (definition of done)
1. While auth/group resolve, a full-screen centered `CircularProgress` renders (role=status with
   label); no full-screen `Skeleton` remains in those two gates — component/unit tested.
2. With the drawer open, the hamburger button is still interactive; clicking it closes the drawer
   (toggle), Esc and backdrop still close it — tested.
3. Closed: Menu icon + open aria-label; open: Close (X) icon + close aria-label +
   `aria-expanded=true` — tested.
4. The drawer paper's top padding clears the app-bar height plus extra spacing (assert via
   rendered style or visual sx presence).
5. The selected row's background resolves to the theme's neutral `action.selected` (no
   `primary`-derived background); translucent blur paper unchanged — tested or asserted via sx.
6. en/es parity for `groupNav.closeMenu`; full gates green (`npm test`, build, lint, prettier).

## Constitution links
- §7 done = tested. UI-only; no data/rules changes.
