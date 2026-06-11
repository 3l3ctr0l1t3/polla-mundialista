# 028 — Mobile bottom-nav: horizontal scroll so all destinations are reachable

> Status: ✅ verified · Depends on: 009, 026 · Specialist: react-mui-builder

## Why
On a phone (`< sm`), `AppShell` renders a MUI `<BottomNavigation showLabels>` whose actions are force-
distributed (`flex: 1`) across the viewport width. As destinations grew — a regular member now sees
**Fixtures, Leaderboard, Rules (026), Standings, My Groups** (5), an admin also gets **Admin** (6), a
superadmin/local-dev also gets **Canvas** (7) — each action shrinks, labels truncate, and the bar becomes
cramped and effectively unusable; overflowing items are squished, not reachable. Adding the Rules tab (026)
is what pushed the bar past what fits a narrow phone and surfaced the bug. The fix: make the mobile bottom
bar **horizontally scrollable** so a user can swipe it to reach **every** destination.

## User story
As a **group member on a phone**, I want to **swipe the bottom navigation left and right to reach every
destination**, so that **I can open any tab (Rules, Standings, Admin, etc.) instead of seeing the items
squished into illegible slivers**.

## Scope
- **Modify only the mobile bottom-bar branch of `src/components/AppShell.tsx`** so the bar becomes
  horizontally scrollable by **native touch swipe** when its items overflow the viewport:
  - All N items render at a **consistent, readable `minWidth`** (label legible, not truncated to
    unreadability); the equal `flex: 1` distribution that shrinks actions is **removed** so items keep their
    width and the bar overflows instead of squishing.
  - When total item width exceeds the viewport, the bar **scrolls horizontally** (`overflow-x: auto`/scroll
    on the scroll container, no-wrap), reachable by finger swipe.
  - The **currently selected** item is **scrolled into view** (visible after navigation and on initial
    load), not left off-screen.
  - The horizontal scrollbar is **visually hidden** on mobile (reads as a swipeable strip, no scrollbar
    chrome) while remaining scrollable.
  - The bar stays **fixed at the bottom, full-width, same MD3 look** (icons + labels), same height; only its
    overflow behavior changes.
- **Implementation approach is the planner's call** (the behavior above is the requirement). Two viable
  options, neither mandated: (a) keep `BottomNavigation` inside a horizontally scrollable container
  (`overflowX: 'auto'`, no-wrap, each action a fixed `minWidth`, disabling the `flex: 1` distribution); or
  (b) switch the mobile bar to MUI `Tabs variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile`
  (built-in touch scroll + scroll-into-view) styled to look like the bottom nav.
- **Preserve accessibility:** the nav landmark `aria-label` (`t('appShell.primaryNav')`), the selected state
  (`aria-current`/`selected`), and keyboard operability all remain.
- **Update the test** `src/components/AppShell.test.tsx` to cover the new mobile scroll behavior (all items
  present, scrollable container, fixed min-width, selected-into-view, a11y preserved).
- **i18n:** none expected (labels already localized). If any new key is unavoidable, it goes in **both**
  `en.json` and `es.json` so the key-parity test stays green.

## Non-goals
- **No change to `src/components/navItems.tsx`** — which destinations exist, their order, labels, or icons
  are untouched; **no new nav item** is added.
- **No change to routing**, `src/group/GroupApp.tsx`, the scoring engine, the Rules content, ingestion, or
  `firestore.rules`.
- **No redesign to a hamburger/drawer or a "More"/overflow menu on mobile** — the owner wants a **swipeable
  bar**, not a collapsed/hidden menu.
- **The desktop left rail (`>= sm`), the top app bar, and all non-mobile behavior stay byte-for-byte
  unchanged.**
- No theme/token reskin beyond what the scroll behavior strictly requires; free-tier only, no new
  dependency.

## Acceptance rules (definition of done)
Each rule is verifiable. These are what `/spec-verify` checks.
1. **All items render and the bar scrolls (none dropped).** Rendering `AppShell` at a mobile viewport with
   many items (e.g. 7 `navItems`) shows **all N** mobile actions in the DOM (none hidden/dropped), and the
   bar's scroll container is horizontally scrollable (its computed/applied style is `overflow-x: auto` or
   `scroll`, no-wrap) — proven by an `AppShell.test.tsx` test asserting 7 actions present and the container
   is scrollable rather than distributing items with `flex: 1`.
2. **Consistent readable min-width (no squish-to-zero).** Each mobile action keeps a fixed, consistent
   `minWidth` and its label is **not** set to wrap/truncate-to-zero — a test asserts the min-width style is
   applied to the actions (items do not rely on `flex: 1` to fit).
3. **Selected item scrolled into view.** The currently selected destination is scrolled into view on render
   and when `selectedKey` changes — a test asserts the scroll-into-view mechanism is wired (e.g. a
   ref/effect targeting the selected action, or `Tabs` `value` driving its built-in scroll), and that the
   selected action is the focusable/`aria-current` one and reachable.
4. **Desktop rail unchanged.** The desktop branch (left `Drawer` rail) is unchanged — the existing AppShell
   tests (title, children, default destinations, custom title) stay green, and a diff shows no change to the
   `rail`/`Drawer` code path.
5. **Accessibility preserved.** The mobile nav still exposes its landmark `aria-label`
   (`t('appShell.primaryNav')`) and the selected/`aria-current` state still resolves — existing/added a11y
   assertions are green; keyboard operability is retained.
6. **Quality gates green & untouched areas verified.** `npm run build`, `npm test` (incl. the updated
   `AppShell.test.tsx`), `npm run lint`, and `npx prettier --check` on the touched files all pass. There is
   **no** change to `src/components/navItems.tsx`, routing, `src/shared/scoring.ts`, `firestore.rules`, or
   `scripts/ingest/*` — verified by diff; the rules and ingest suites are unchanged and still green (no
   `npm run test:rules` / `test:ingest` regressions). If any i18n key was added it exists in en + es and the
   key-parity test stays green.

## Constitution links
- **Spec-first (1):** this UI bug fix is specified before any implementation.
- **TypeScript everywhere (2):** the change stays in the strict-TS `AppShell.tsx`; no scoring/grading code is
  touched or duplicated.
- **Two-writers rule (3):** purely presentational — the navigation chrome **writes nothing**; the browser
  still writes only its own per-group prediction, and results/leaderboard/standings stay ingestion-only.
- **Authoritative kickoff lock (4):** unaffected — no rules or lock logic changes.
- **Free-tier only (6):** no new backend, no Cloud Functions, no paid dependency.
- **Done = tested + meets acceptance rules (7):** the gates in AC6 close the ticket.

## Notes / open questions
- **Assumption:** the bug is exactly the `flex: 1` equal distribution of `<BottomNavigationAction>` inside
  `<BottomNavigation>` (each action grows/shrinks to fill width), so with 6–7 destinations labels truncate
  on a narrow phone. The fix removes that distribution and makes the container overflow-scroll instead.
- **Assumption:** the planner picks the implementation (scrollable container around `BottomNavigation`, or
  swap to a styled scrollable `Tabs`); the required behavior — all items reachable by horizontal swipe,
  fixed min-width, selected-into-view, hidden scrollbar, same fixed full-width MD3 look, desktop rail
  unchanged — is fixed by this spec.
- **Open question (planner to resolve):** the exact `minWidth` per action (a value that keeps the longest
  current label legible while letting ~4–5 items fit a typical phone before scrolling begins) and whether
  scroll buttons are shown — the spec requires touch-swipe; scroll buttons (if `Tabs`) are
  `scrollButtons="auto"` and must not break the touch swipe (`allowScrollButtonsMobile`).
- **Open question (planner to resolve):** how the selected-into-view is wired and how the test asserts it in
  jsdom (where `scrollIntoView`/layout are stubbed) — e.g. asserting the effect/ref exists and the selected
  action carries the selected/`aria-current` marker, rather than measuring real pixel scroll.
- **Test harness note:** `AppShell.test.tsx` currently stubs `matchMedia` to `matches: false` (so
  `useMediaQuery(up('sm'))` is false → the **mobile bottom bar** renders). New mobile-scroll assertions can
  use that same mobile path; jsdom does not lay out or scroll, so assertions target the applied
  styles/structure and the wired mechanism, not measured scroll position.
- **Numbering:** 027 was already taken by the in-flight `027-locked-card-see-predictions` ticket, so this
  one is **028**.
