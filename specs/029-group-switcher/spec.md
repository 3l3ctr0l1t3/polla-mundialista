# 029 — Group switcher in the top app bar (click the group name to switch groups)

> Status: ✅ verified · Depends on: 012, 028 · Specialist: react-mui-builder

## Why
Now that a user can belong to multiple groups (ticket 012), the only way to move between them is to leave
the in-group app, go back to **My Groups**, and re-enter another. In the top app bar the group name is a
plain static title (`<Typography variant="h6" component="h1">{group.name}</Typography>`), so the most
obvious affordance — the group name itself — does nothing. The owner wants clicking that name to open a
**dropdown menu of the user's groups** so a member can switch group in one tap without round-tripping
through My Groups.

## User story
As a **member of several groups**, I want to **click the group name in the top app bar and pick another of
my groups from a dropdown**, so that **I can switch between my pools instantly without going back to the My
Groups page**.

## Scope
- **New `GroupSwitcher` component** (planner names it, e.g. `src/components/GroupSwitcher.tsx`): a real
  `button` rendered in the app-bar title slot that shows the **current group name** plus a dropdown caret,
  styled to read like the existing app-bar title (inherits app-bar contrast/`h6`-weight, `noWrap`).
  Clicking it opens a MUI **`Menu`** anchored to the trigger.
  - **The list = the groups the user can ENTER:** `owned ∪ approved` from `useMyGroups()` (the `JoinedGroup`
    rows contribute `j.group`), **deduped by `group.groupId`** and **sorted by `group.name`**. **`pending`
    groups are excluded** — the user is not yet approved and cannot enter them.
  - **Current group marked selected:** the menu item whose `group.groupId === useGroup().gid` is rendered
    as selected/checked (e.g. MUI `selected` + a check icon) and carries `aria-current`.
  - **Selecting a group navigates** to `/g/{groupId}/<tab>` and closes the menu. The destination **tab
    segment** is the planner's call: preserve the current tab (the 3rd path segment, `/g/:gid/<tab>`) when
    that tab exists for the target group, or default to `fixtures`.
  - **Search-when-many:** when the enterable-group list length is **≥ a threshold (≈ 8)**, render a small
    filter `TextField` at the top of the menu that filters the list by name (case-insensitive,
    substring); below the threshold, **no** search field is rendered (short lists stay clean).
  - **States:** while `useMyGroups()` is `loading`, the trigger still shows the **current group name** (from
    `useGroup().group.name`) and does not crash; the menu may be empty/disabled until groups resolve. If the
    user has only **one** group, the trigger still behaves (planner decides whether the caret/menu still
    appears — if it does, it shows just that one group, checked); nothing breaks in the single-group case.
- **`AppShell` gains a minimal hook to host an interactive title** — an optional `titleControl?: ReactNode`
  prop (planner may pick the exact name) rendered **in place of** the plain title `Typography` when present.
  When `titleControl` is absent, the app bar renders the plain `title` string **exactly as today** (same
  `variant="h6"`, `noWrap`, `flexGrow`). AppShell stays decoupled from group logic — it only renders the
  node it is handed.
- **`GroupApp` wires the switcher in:** instead of (or in addition to) `title={group.name}`, it passes a
  `<GroupSwitcher />` into AppShell's title slot, still showing the current group name, now interactive.
- **Accessibility:** the trigger is a real `button` with `aria-haspopup="menu"` and `aria-expanded`
  reflecting the open state; menu items are keyboard-navigable; the current group is conveyed
  (`selected` / `aria-current`). The app-bar **heading semantics are preserved or sensibly relocated** —
  the planner ensures an accessible page/group label still exists (e.g. the trigger labels the heading, or
  the `component="h1"` role is retained around/within the control).
- **Localization:** any new copy (trigger `aria-label`, search-field placeholder/label, an empty/loading
  hint if used) is added to **both** `src/i18n/locales/en.json` and `es.json`; the key-parity test stays
  green.

## Non-goals
- **NOT a searchable Autocomplete combobox** as the primary UI. The primary UI is a **`Menu`**; a filter
  `TextField` appears **only** when the list is long (≥ ~8).
- **No "My Groups" / "Create group" entries inside the menu** (owner's explicit choice — the menu is **just
  the group list**). Those actions stay reachable via the existing nav (the My Groups item).
- **No group CRUD here** — no create / join / leave / rename / approve. This ticket only **switches** the
  active group. No change to the `useMyGroups` data model beyond reading the already-present `group.groupId`
  / `group.name`.
- **No change to routing structure**, `src/group/GroupApp.tsx`'s routes, the scoring engine
  (`src/shared/scoring.ts`), `firestore.rules`, or ingestion (`scripts/ingest/*`).
- **No change to the desktop rail or the mobile bottom-nav (ticket 028) behavior** beyond AppShell hosting
  the optional title control. **Pending groups are not switchable; no approval flow here.**
- Free-tier only; **no new dependency** (MUI `Menu` / `MenuItem` / `TextField` are already available).

## Acceptance rules (definition of done)
Each rule is verifiable. These are what `/spec-verify` checks.
1. **Clicking the title opens a menu of the user's enterable groups, current one selected.** A component
   test renders `GroupSwitcher` with a mocked `useMyGroups` (some owned + some approved) and a mocked
   `useGroup`, clicks the trigger, and asserts: every enterable group name appears (owned ∪ approved,
   **deduped** so a group present in both lists appears once), and the item matching `useGroup().gid` is
   rendered selected (`selected` / `aria-current`).
2. **Selecting a different group navigates and closes.** With `useNavigate` mocked, clicking a non-current
   group calls navigation to `/g/{thatGroupId}/...` (the current tab segment or `fixtures` per the planner's
   rule) and the menu closes — a test asserts both the navigation target and that the menu is dismissed.
3. **Pending groups are NOT listed.** A test with a `pending` `JoinedGroup` in the mocked `useMyGroups`
   asserts that group's name does **not** appear in the menu.
4. **Search field appears only at/above the threshold and filters by name.** A test with a list **≥** the
   threshold (e.g. 8+ groups) asserts the filter `TextField` is shown and that typing narrows the visible
   items to matching names; a test with a **few** groups (below threshold) asserts **no** filter field is
   rendered.
5. **AppShell hosts the title control without regressing the plain title.** When `titleControl` is provided
   AppShell renders it in the title slot; when absent, the plain `title` string renders as before — the
   existing `AppShell.test.tsx` assertions (default title, custom title, children, default destinations,
   desktop rail) stay **green**, and a diff shows the desktop rail / bottom-bar code paths are unchanged.
6. **Accessibility.** The trigger exposes `aria-haspopup="menu"` and toggles `aria-expanded`; the current
   group is conveyed via `selected` / `aria-current`; menu items are keyboard-reachable — asserted by a
   test (and the heading/accessible-label for the group is still present).
7. **Localized + key-parity.** All new copy exists in **both** `en.json` and `es.json`, and the i18n
   key-parity test is green.
8. **Quality gates green & untouched areas verified.** `npm run build`, `npm test` (incl. the new
   `GroupSwitcher` tests and the unchanged `AppShell` tests), `npm run lint`, and `npx prettier --check` on
   the touched files all pass. There is **no** change to `src/shared/scoring.ts`, `firestore.rules`,
   `scripts/ingest/*`, the routing structure, or the navItems set — verified by diff; the rules and ingest
   suites are unchanged and still green (no `npm run test:rules` / `test:ingest` regressions).

## Constitution links
- **Spec-first (1):** this navigation affordance is specified before any implementation.
- **TypeScript everywhere (2):** the switcher and the AppShell prop stay in strict TS; no scoring/grading
  code is touched or duplicated.
- **Two-writers rule (3):** purely client navigation chrome — the switcher **writes nothing**; the browser
  still writes only its own per-group prediction, and results/leaderboard/standings stay ingestion-only.
- **Authoritative kickoff lock (4):** unaffected — switching groups changes only the route; no lock or
  prediction-write logic changes.
- **Free-tier only (6):** no new dependency, no backend change (it reads the same `useMyGroups`
  listeners already in place).
- **Done = tested + meets acceptance rules (7):** the gates in AC8 close the ticket.

## Notes / open questions
- **Assumption — the title slot API.** AppShell gets an optional `titleControl?: ReactNode` (or equivalently
  named) prop; the plain `title` path is preserved byte-for-byte when it is absent. The planner picks the
  exact prop name/shape; the requirement is only that AppShell stays decoupled from group logic and the
  current title rendering is unchanged when no control is passed.
- **Assumption — destination tab on switch.** The spec assumes the switcher preserves the **current tab**
  segment when the target group supports it, falling back to `fixtures`. The planner may instead always
  navigate to `fixtures` if preserving the segment is fragile (e.g. switching from a tab the target group's
  admin/canvas conditions would not expose). Either is acceptable as long as the destination is sensible and
  never lands on a 404/redirect loop.
- **Assumption — the enterable set.** "Groups the user can enter" = `owned ∪ approved`, deduped by
  `group.groupId`, sorted by `name`. `pending` is excluded. If a group is both owned and approved it appears
  **once**.
- **Open question — single-group / loading rendering.** Whether the caret/menu still appears when the user
  has exactly one group, and what the menu shows while `useMyGroups` is loading (empty, disabled, or a small
  hint). The spec requires only that the trigger always shows the current group name and never crashes; the
  planner decides the exact affordance.
- **Open question — the search threshold value.** Stated as **≈ 8**; the planner fixes the exact number (a
  value where a plain menu would start to feel long on a phone) and whether the filter field also gets a
  clear/empty-results state.
- **Open question — heading semantics.** Today the title is `component="h1"`. The planner decides how to keep
  an accessible group/page heading once the title becomes a button (e.g. wrap/label the control as the
  heading, or keep a visually-hidden `h1`), without breaking the existing AppShell heading tests.
- **Numbering:** 027 (`027-locked-card-see-predictions`) and 028 (`028-mobile-nav-scroll`) are already
  committed, so this ticket is **029**.
