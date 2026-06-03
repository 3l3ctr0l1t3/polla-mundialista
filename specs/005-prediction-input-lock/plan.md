# 005 — Plan

> Generated from spec.md. Technical design only — no behavior the spec doesn't call for.

## Approach
Build the participant prediction flow entirely on the Firebase Web SDK with real-time listeners.

- A `useServerTime` hook establishes a client→server clock offset once on mount by writing
  `serverTimestamp()` to the user's own throwaway doc (`serverTime/{uid}`) and reading the resolved value
  back via `getDoc`, then exposing `now()` = `Date.now() + offset`. The kickoff lock UI consumes `now()` so a
  skewed device clock cannot unlock an input. If the round-trip fails, it degrades gracefully to `Date.now()`
  with `offsetKnown=false` (the Firestore rule remains the authoritative gate either way).
- `useMyPredictions` subscribes via `onSnapshot` to `predictions where uid == me` and returns a
  `Record<matchId, Prediction>` map, cleaning up the listener on unmount / uid change.
- `CountdownToKickoff` renders a live countdown driven by `useServerTime().now()` on a 1s tick, flipping to a
  "Locked" chip once kickoff passes.
- `PredictionInput` renders two integer steppers (home/away, ints ≥ 0), disabled at/after kickoff (server
  time). On submit it writes the prediction via `setDoc(..., { merge: true })` with `updatedAt` always and
  `createdAt` only when the doc is new, and surfaces a rules-rejected late write (`permission-denied`) with a
  snackbar. It never writes `points`/`breakdown`.
- `PredictionsPage` lists upcoming (non-finished, future-or-live) matches with a Loading/Empty/Error state,
  each row rendering `CountdownToKickoff` + `PredictionInput` prefilled from `useMyPredictions`. Matches are
  read via a small local `onSnapshot` subscription (no dependency on ticket 004's `useMatches.ts`).

## Files to create / change
| Path | Change | Notes |
|------|--------|-------|
| `src/hooks/useServerTime.ts` | new | Server-time offset via `serverTimestamp()` round-trip; exposes `now()`. |
| `src/hooks/useMyPredictions.ts` | new | `onSnapshot` of my predictions → map by matchId. |
| `src/components/CountdownToKickoff.tsx` | new | Live countdown / locked chip on server time. |
| `src/components/PredictionInput.tsx` | new | Goal steppers + setDoc + snackbar on late-write rejection. |
| `src/pages/PredictionsPage.tsx` | overwrite stub | Upcoming matches list with states. |
| `src/components/PredictionInput.test.tsx` | new | Editable before / disabled after kickoff / setDoc shape. |

## Data shapes / interfaces
```ts
// useServerTime
interface ServerTime { now: () => number; offsetMs: number; offsetKnown: boolean }
function useServerTime(): ServerTime

// useMyPredictions
interface MyPredictions {
  predictions: Record<string, Prediction> // keyed by matchId
  loading: boolean
  error: Error | null
}
function useMyPredictions(): MyPredictions

// CountdownToKickoff
interface CountdownToKickoffProps { kickoffMs: number; now: () => number }

// PredictionInput
interface PredictionInputProps {
  match: Match
  existing?: Prediction
  now: () => number
}

// Write shape (merge): { uid, matchId, homeGoals, awayGoals, updatedAt: serverTimestamp(),
//                        createdAt?: serverTimestamp() }  // createdAt only when new
```

## Reused utilities
- `src/firebase/db.ts` — `db`, `predictionsCol`, `predictionDoc`, `predictionConverter`, `predictionId`,
  `matchesCol`.
- `src/auth/useAuth.ts` — current `user`.
- `src/components/states` — `LoadingState`, `EmptyState`, `ErrorState`.
- `src/shared/types.ts` — `Match`, `Prediction`.
- MUI theme tokens via the theme (`src/theme/`); no hard-coded colors.

## Test strategy
- `src/components/PredictionInput.test.tsx` (Vitest + Testing Library, firebase/firestore mocked):
  - inputs are editable when `now()` is before kickoff;
  - inputs are disabled when `now()` is at/after kickoff;
  - submit calls `setDoc` with `{ uid, matchId, homeGoals, awayGoals, updatedAt, createdAt }` for a new
    prediction (and merge option), and omits `createdAt` when editing an existing one;
  - a `permission-denied` rejection surfaces the "match already started" snackbar.
- Acceptance rules 1–4 covered by the above plus the authoritative `firestore.rules` gate (ticket-owned
  separately) for the forced-late-write rejection.

## Risks
- **Clock skew round-trip fails** (offline/rules) → fall back to `Date.now()`, `offsetKnown=false`; the rule
  still rejects late writes, so safety is preserved (UI is convenience only per constitution §4).
- **Parallel ownership of `useMatches.ts` (ticket 004)** → use a local matches subscription in the page to
  avoid a hard import dependency / file collision.
