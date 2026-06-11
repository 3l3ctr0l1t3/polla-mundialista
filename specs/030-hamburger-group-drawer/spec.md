# 030 — Hamburger group drawer (select · create · join)

> Status: ⬜ not started · Depends on: 012, 029 · Specialist: react-mui-builder

## Why
Group switching, creation and joining are scattered (title menu for switching; My Groups page for
create/join). The user picked Canvas variant **A**: a hamburger button opening a left navigation
drawer that unifies all three — replacing the ticket-029 title-menu switcher.

## User story
As a **member of several pollas**, I want **a hamburger menu listing my groups with create/join
actions** so that **I can switch or start/enter a group from anywhere without losing my place**.

## Scope
- New `GroupNavDrawer`: hamburger `IconButton` in the app bar's far-left slot (replacing the
  decorative soccer icon) opening a **temporary left Drawer**: "Your groups" list (avatar initial,
  name, role, check on current; filter field at ≥8 groups), then divider, then **Create group**
  (→ `/groups/new`) and **Join with code** (→ the same parse-link/code dialog as My Groups,
  extracted to a shared component).
- Picking a group navigates to `/g/{gid}/{currentTab}` (same tab-preserving behavior as 029).
- App-bar title becomes the plain (non-interactive) current group name; `GroupSwitcher` is removed.
- **Transparency preserved:** the app bar keeps its `transparent` + `backdropFilter: blur(8px)`
  look untouched; the drawer paper gets the same translucent-blur treatment (alpha of
  `background.paper` + blur), tokens from the theme only.
- All copy in `en.json` AND `es.json`.

## Non-goals
- No member counts in rows (would need extra reads). No changes to routes, My Groups page behavior,
  rules, or data model. No desktop nav-rail changes.

## Acceptance rules (definition of done)
1. The app bar shows a hamburger (accessible name) far left; clicking opens the drawer; Esc/backdrop
   closes it.
2. The drawer lists exactly the enterable groups (owned ∪ approved, deduped, sorted), current one
   selected/checked; picking another navigates to it preserving the current tab.
3. "Create group" navigates to `/groups/new`; "Join with code" opens the join dialog and a valid
   link/code navigates to `/join/{gid}` (shared component, MyGroupsPage still works).
4. The title-menu `GroupSwitcher` is gone from the app bar (component + tests removed/superseded).
5. App bar styling untouched (transparent + blur); drawer paper is translucent with blur, no
   hard-coded colors outside theme tokens.
6. ≥8 groups shows the filter; filtering narrows rows; no-match state shown.
7. Component tests cover rules 1–3 + 6; full gates green (`npm test`, build, lint, prettier);
   en/es key parity for all new keys.

## Constitution links
- §7 done = tested. Read-only navigation — no write-path changes (§3 untouched).

## Notes / open questions
- AppShell gains an optional `leadingControl` slot rendered instead of the soccer icon.
