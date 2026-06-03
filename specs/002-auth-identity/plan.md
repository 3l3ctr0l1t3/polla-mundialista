# 002 — Plan

> Generated from spec.md. Technical design only — no behavior the spec doesn't call for.

## Approach
Add Firebase Google authentication and a membership gate on top of the existing app shell.

- `src/firebase/auth.ts` wraps the Firebase Auth Web SDK around the shared `app`
  (`config.ts`): `googleProvider`, `signInWithGoogle()`, `signOutUser()`, `onAuthChange()`.
- `AuthProvider` (React context) owns the auth listener. On each auth-state change it
  upserts `users/{uid}` (via the typed `db.ts` converter, never writing `isAdmin`) and
  resolves `isMember` from `config/allowlist.emails`. It exposes `{ user, loading, isMember }`
  via `useAuth()`.
- Routing: `main.tsx` wraps the tree in `BrowserRouter` + `ThemeProvider` + `CssBaseline`
  + `AuthProvider`. `App.tsx` is a route guard: while loading → `LoadingState`; signed-out
  OR non-member → `LoginPage` only; signed-in member → `AppShell` wrapping `<Routes>` for
  `/fixtures`, `/predictions`, `/leaderboard`, `/standings`, with `/` → `/fixtures`.
- Feature pages are minimal stubs (tickets 004/005/007 replace them).

The Firestore security rules (ticket 003) are the authoritative gate; the `isMember` flag
and the route guard are UI convenience.

## Files to create / change
| Path | Change | Notes |
|------|--------|-------|
| `src/firebase/auth.ts` | new | Auth SDK helpers (provider, sign-in/out, listener). |
| `src/auth/authContext.ts` | new | `AuthContext` + `AuthContextValue` (split for fast-refresh). |
| `src/auth/AuthProvider.tsx` | new | Listener, profile upsert, membership resolution. |
| `src/auth/useAuth.ts` | new | `useAuth()` hook. |
| `src/pages/LoginPage.tsx` | new | Google sign-in + not-a-member state + sign-out. |
| `src/pages/FixturesPage.tsx` | new | STUB (ticket 004). |
| `src/pages/PredictionsPage.tsx` | new | STUB (ticket 005). |
| `src/pages/LeaderboardPage.tsx` | new | STUB (ticket 007). |
| `src/pages/StandingsPage.tsx` | new | STUB (ticket 007). |
| `src/main.tsx` | edit | Wrap in BrowserRouter + AuthProvider. |
| `src/App.tsx` | edit | Route guard + member shell + routes. |
| `src/App.test.tsx` | edit | Render with Router/Auth; assert LoginPage when signed out. |
| `src/auth/AuthProvider.test.tsx` | new | Membership resolution unit tests (mocked SDK). |

## Data shapes / interfaces
```ts
// src/auth/authContext.ts
interface AuthContextValue {
  user: FirebaseUser | null
  loading: boolean
  isMember: boolean
}

// src/firebase/auth.ts
function signInWithGoogle(): Promise<FirebaseUser>
function signOutUser(): Promise<void>
function onAuthChange(cb: (user: FirebaseUser | null) => void): Unsubscribe

// users/{uid} upsert (never writes isAdmin; createdAt set only on first creation)
{ uid, displayName, email, photoURL, createdAt? }
```

## Reused utilities
- `src/firebase/config.ts` → `app` (shared FirebaseApp).
- `src/firebase/db.ts` → `userDoc`, `allowlistConfigDoc`, typed converters.
- `src/shared/types.ts` → `User`, `AllowlistConfig`.
- `src/components/AppShell.tsx` + `src/components/navItems.tsx` → responsive shell + `DEFAULT_NAV_ITEMS`.
- `src/components/states/` → `LoadingState`, `EmptyState` (page stubs).
- `src/theme/theme.ts` → existing MD3 theme.

## Test strategy
- `AuthProvider.test.tsx` (Vitest + RTL, mocked `firebase/auth` + `firebase/firestore`):
  signed-out → not-a-member; allowlisted email → member + one profile upsert; missing
  allowlist doc → not-a-member; unlisted email → not-a-member. (Acceptance rules 2, 3.)
- `App.test.tsx`: signed-out renders `LoginPage` (sign-in button) only. (Acceptance rule 4.)
- Sign-in/sign-out happy path (rule 1) is verified manually after the PENDING runtime
  steps below; the popup flow cannot run in jsdom.

## PENDING runtime steps (console / data — NOT code blockers)
- Enable the **Google** sign-in provider in the Firebase console for `la-pollita-corp`
  (Authentication → Sign-in method). Until then `signInWithGoogle()` rejects with
  `auth/operation-not-allowed`.
- Seed `config/allowlist` with `{ emails: [...] }` so invited friends pass the gate.
  A missing doc means everyone is treated as a non-member by design.

## Risks
- Stale async resolution after rapid auth changes → mitigated with a `mountedRef` guard
  inside `AuthProvider`.
- `createdAt` rewritten on every sign-in → mitigated by stamping it only when the user
  doc doesn't already exist.
- Profile upsert failing offline could block the gate → upsert is wrapped in try/catch so
  membership still resolves; rules remain the real gate.
