# 002 — Auth & participant identity

> Status: 🟦 spec ready · Depends on: 001 · Specialist: react-mui-builder

## Why
The pool is private to a group of friends. We need Google sign-in, a membership gate so randoms can't join,
and a participant profile to attach predictions and leaderboard entries to.

## User story
As a **friend invited to the pool**, I want **to sign in with Google** so that **I can make predictions
under my identity and appear on the leaderboard**.

## Scope
- Firebase Auth Google sign-in; `AuthProvider` React context exposing `{ user, loading, isMember }`.
- Allowlist gate: membership checked against `config/allowlist.emails`.
- On first valid sign-in, upsert `users/{uid}` (`displayName`, `email`, `photoURL`, `createdAt`).
- `LoginPage`; a "ask the organizer to add you" screen for signed-in non-members.
- Route guard: unauthenticated users see only `LoginPage`.

## Non-goals
- Roles/admin UI beyond a manually-set `isAdmin` flag in the console.

## Acceptance rules (definition of done)
1. A user can sign in and sign out with Google.
2. An email **not** in `config/allowlist` is blocked from the app with a clear message.
3. First sign-in creates `users/{uid}` with profile fields; `isAdmin` is never client-writable.
4. Signed-out users cannot reach any page except `LoginPage`.

## Constitution links
- Two-writers rule (user may only write their own `users/{uid}`). No secrets in repo.

## Notes / open questions
- Allowlist seeded manually in Firestore console for v1.
