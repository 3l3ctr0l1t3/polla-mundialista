# 009 — Plan

> Generated from spec.md. Technical design only — no behavior the spec doesn't call for.

## Approach

Expand the minimal seed theme in `src/theme/` into a proper Material Design 3 token theme with light +
dark color schemes (MUI v9 `colorSchemes`), generated from a World-Cup-ish green seed. All palette,
shape, spacing and typography tokens live in `src/theme/` so components consume tokens and never
hard-code colors (constitution).

Add a responsive MD3 app frame, `AppShell`, that renders a top app bar plus a navigation surface that
adapts to viewport: a bottom `BottomNavigation` bar on phones and a left navigation rail (a permanent
`Drawer`, since MUI v9 has no `NavigationRail` component yet) on desktop, switched via `useMediaQuery`.
Routing is intentionally not wired here — the parent passes `navItems`, `selectedKey` and `onNavigate`
later. Provide reusable `LoadingState`, `EmptyState` and `ErrorState` building blocks so every page can
present loading/empty/error UX. Cover the shell with a smoke test.

This is a sensible **default** theme that a custom brand can later replace by editing `tokens.ts` alone.

## Files to create / change

| Path                                       | Change | Notes                                                          |
| ------------------------------------------ | ------ | -------------------------------------------------------------- |
| `src/theme/tokens.ts`                      | new    | Raw seed + tonal palettes, spacing, shape, type scale, layout |
| `src/theme/theme.ts`                       | edit   | Build light+dark MD3 theme from tokens; component defaults    |
| `src/components/AppShell.tsx`              | new    | Responsive MD3 frame: app bar + rail (desktop) / bottom (mob) |
| `src/components/navItems.tsx`              | new    | `NavItem` type + `DEFAULT_NAV_ITEMS` (separated for HMR rule) |
| `src/components/states/LoadingState.tsx`   | new    | Skeleton-based loading placeholder                            |
| `src/components/states/EmptyState.tsx`     | new    | Empty placeholder with icon/title/description/action          |
| `src/components/states/ErrorState.tsx`     | new    | Error placeholder with optional retry                         |
| `src/components/states/index.ts`           | new    | Barrel export for the state components                        |
| `src/components/AppShell.test.tsx`         | new    | Smoke test: title, children, nav labels                       |

## Data shapes / interfaces

```ts
// src/components/navItems.tsx
export interface NavItem {
  key: string
  label: string
  icon: ReactNode
}
export const DEFAULT_NAV_ITEMS: NavItem[] // Fixtures, Predictions, Leaderboard, Standings

// src/components/AppShell.tsx
export interface AppShellProps {
  children?: ReactNode
  title?: string // defaults to "Polla Mundialista"
  navItems?: NavItem[] // defaults to DEFAULT_NAV_ITEMS
  selectedKey?: string
  onNavigate?: (key: string) => void
}

// src/components/states/*
export interface LoadingStateProps {
  rows?: number
  label?: string
}
export interface EmptyStateProps {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
}
export interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  retryLabel?: string
}
```

## Reused utilities

- `createTheme` / `colorSchemes` from `@mui/material/styles` (MUI v9, MD3).
- `@mui/icons-material` for nav + state icons (CalendarMonth, EditNote, Leaderboard, Stadium,
  SportsSoccer, Inbox, Error).
- Existing `src/test/setup.ts` (jest-dom) for the smoke test.

## Test strategy

- `src/components/AppShell.test.tsx` (Vitest + Testing Library): renders the shell, asserts the title
  heading, that children render, that all default nav labels appear, and that a custom title is honored.
  `matchMedia` is stubbed in-test (jsdom lacks it) so `useMediaQuery` resolves deterministically.
- `npm run build` (tsc -b + vite build) proves the strict TypeScript compiles.
- `npm run lint` + `prettier --check src/theme src/components` prove style/lint compliance.

## Risks

- MUI v9 ships no `NavigationRail` component → use a permanent `Drawer` styled as a compact rail.
- `react-refresh/only-export-components` flags non-component exports in a component file → keep
  `NavItem`/`DEFAULT_NAV_ITEMS` in their own `navItems.tsx`.
- jsdom has no `matchMedia` → stub it in the test to avoid `useMediaQuery` crashing.
- Tonal palette is a hand-tuned approximation (no Material Color Utilities dependency) → acceptable as a
  default that will be reskinned; documented in `tokens.ts`.
