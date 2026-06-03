# 009 — MD3 theming & polish

> Status: 🟦 spec ready · Depends on: 002 · Specialist: react-mui-builder

## Why
The app should look and feel like Material Design 3 and work well on phones (where friends will use it),
with proper loading/empty/error states.

## User story
As a **participant on my phone**, I want **a clean, responsive Material Design 3 interface** so that **the
app is pleasant and easy to use during matches**.

## Scope
- `src/theme/` MD3 token theme (light + dark) generated from a seed color; isolated from components.
- Mobile `NavigationBar` / desktop `NavigationRail` in `AppShell`.
- Loading skeletons, empty states, error boundaries, and a "stale data" indicator.
- Responsive layouts across pages.

## Non-goals
- No new features; this is presentation + UX hardening only.

## Acceptance rules (definition of done)
1. Light and dark MD3 themes work; all colors come from `src/theme/` tokens (no hard-coded palette in components).
2. Navigation adapts: bottom bar on mobile, rail/side on desktop.
3. Every page has loading, empty, and error states.
4. Lighthouse: no major accessibility/performance regressions; layout works at mobile widths.

## Constitution links
- MD3 specifics isolated in `src/theme/` (convention).

## Notes / open questions
- Accept "MD3-flavored" MUI rather than pixel-perfect MD3 to avoid scope creep.
