# 027 — Plan

> Generated from spec.md. Technical design only — no behavior the spec doesn't call for.

## Approach
`FixtureCard` today derives three states (editable · upcoming-TBD · live/finished). Insert a fourth,
**locked-upcoming**, between editable and `showResult`:

- `upcoming` = the current `editable` predicate (not FINAL, not in-play, real teams).
- `editable` = `upcoming && !locked` (the `locked` boolean already comes from `useSavePrediction`,
  computed against `lockTimeMs(match, mode, cutoffs)` — mode-aware, lazy and strict alike).
- `lockedUpcoming` = `upcoming && locked`.

In `lockedUpcoming`:
- **Center slot:** the viewer's own pick as read-only numerals (same `tabular-nums`/800-weight style
  as the result score, but `text.secondary` so it can't be mistaken for a result). No prediction →
  an "—" placeholder with a localized caption (`predictions.noPredictionLocked`) that does not imply
  the match is imminent (strict groups lock days early).
- **Action slot:** the Save/Update button is replaced by the SAME "See group predictions" button +
  `MatchPredictionsDialog` block the `showResult` branch already renders — extract that block so it is
  rendered for `showResult || lockedUpcoming` (single source, no duplicate dialog instance).
- **Top-right:** keep `CountdownToKickoff` (its target is `lockMs`, so past lock it already renders
  the "Locked" chip — correct signal, zero change).

**Reactivity (spec rule 9).** `locked`/`kickedOff` are computed from `now()` at render time, so the
card must re-render itself when the clock crosses `lockMs` and `kickoff.toMillis()`. New hook
`useBoundaryTick(now, boundaries: number[])`: finds the next boundary still in the future, arms ONE
`setTimeout` for it (chained in ≤ 24 h chunks to dodge the 2^31−1 ms overflow on far-away strict
kickoffs), bumps a state counter when it fires, then re-arms for the following boundary. At most one
cheap timer per card, firing at most twice in its life — no per-second re-render of the card tree.
The re-render flips `editable → lockedUpcoming` at lock, and flips the `kickedOff` prop passed to an
already-open dialog at kickoff (the dialog's `useMatchPredictions(gid, matchId, open && kickedOff)`
then attaches its listener — placeholder → live list with no reload; dialog itself unchanged).

No Firestore reads are added pre-kickoff: the viewer's own pick comes from the `existing` prop the
Fixtures page already passes (`useGroupPredictions`), and the dialog's query stays gated on
`kickedOff` exactly as ticket 013 left it. `firestore.rules` is untouched.

## Files to create / change
| Path | Change | Notes |
|------|--------|-------|
| `src/hooks/useBoundaryTick.ts` | new | re-render-at-instant hook; chunked single timer |
| `src/hooks/useBoundaryTick.test.ts` | new | fake-timer unit tests (fires at boundary, chains chunks, cleans up) |
| `src/components/FixtureCard.tsx` | edit | fourth state; share the reveal-button+dialog block; call `useBoundaryTick(now, [lockMs, kickoffMs])` |
| `src/components/FixtureCard.test.tsx` | edit | locked-state tests (lazy + strict), no-pick case, fake-timer boundary-crossing tests (rules 2/4/5/9) |
| `src/i18n/locales/en.json` | edit | `predictions.noPredictionLocked`, `predictions.yourPickAria` (if needed) |
| `src/i18n/locales/es.json` | edit | same keys (parity rule) |
| `specs/backlog.md` | edit | 027 → status update on completion |

## Data shapes / interfaces
```ts
// src/hooks/useBoundaryTick.ts
/**
 * Forces a re-render of the calling component each time the server-corrected clock
 * crosses one of the given instants (ms epoch). Single chained setTimeout; ≤24h chunks.
 * Returns the tick count (callers normally ignore it).
 */
export function useBoundaryTick(now: () => number, boundaries: readonly number[]): number

// FixtureCard internals (no prop changes — FixtureCardProps is untouched):
const upcoming = !FINAL.has(status) && status !== 'IN_PLAY' && status !== 'PAUSED' && !isTbdTeam(homeTeam)
const editable = upcoming && !locked          // steppers + Save (state 1, unchanged)
const lockedUpcoming = upcoming && locked     // NEW state: own pick read-only + reveal button
useBoundaryTick(now, [lockMs, kickoff.toMillis()])
```

## Reused utilities
- `useSavePrediction` (`src/hooks/useSavePrediction.ts`) — already exposes `locked`; no change.
- `lockTimeMs` / `effectiveMode` (`src/shared/predictionLock.ts`) — already mode-aware; no change.
- `MatchPredictionsDialog` + `useMatchPredictions` (ticket 013) — reused verbatim, incl. the
  pre-kickoff placeholder and the `open && kickedOff` query gate.
- `CountdownToKickoff` — already renders the "Locked" chip past `lockMs`; kept in the new state.
- Existing i18n keys: `predictions.openDialog` (button), `predictions.yourPrediction` /
  `predictions.predicted` (aria/captions) — only the "no pick" copy is new.

## Test strategy
- **Rule 1/3 (unchanged neighbors):** existing `FixtureCard.test.tsx` suites stay green untouched.
- **Rule 2 (action swap):** render with `now` between `LOCK_MS` and `KICKOFF_MS` → assert no
  save/update button, no stepper buttons; reveal button present; click → `dialogMock` called with
  `{ open: true, kickedOff: false }` (the placeholder + no-query behavior is the dialog's own tested
  contract from ticket 013).
- **Rule 4 (own pick):** same window with `existing={2,1}` → "2 – 1" visible; without `existing` →
  localized no-pick text visible.
- **Rule 5 (both modes):** lazy = the window above; strict = `useGroupMock` returns `mode:'strict'` +
  `useTournamentConfigMock` returns cutoffs with `firstCupMatchKickoffMs` already passed while
  `now()` is still days before the match kickoff → same rule-2/4 assertions.
- **Rule 9 (reactive):** `vi.useFakeTimers()` + `vi.setSystemTime`; `now = () => Date.now()`.
  (a) render just before `LOCK_MS`, advance past it → Save gone, reveal button appears, no rerender
  call; (b) locked card with dialog open just before `KICKOFF_MS`, advance past it → `dialogMock`
  last called with `kickedOff: true`. Plus `useBoundaryTick` unit tests (boundary fire, 24 h chunk
  chaining for far boundaries, unmount cleanup, past-boundaries = no timer).
- **Rule 6:** `git diff --stat firestore.rules` empty; `npm run test:rules` green unchanged.
- **Rules 7/8:** full gates — `npm test`, `npm run build`, `npm run lint`, `npx prettier --check .`;
  i18n parity test covers the new keys in en + es.

## Risks
- **`setTimeout` overflow** for strict-mode boundaries > 24.8 days away → chunked ≤ 24 h re-arming
  in `useBoundaryTick` (unit-tested).
- **Server offset measured after mount** (`useServerTime` resolves late) shifts the true boundary →
  the hook re-arms from `now()` on every fire and on `boundaries` change; worst case the swap fires
  one chunk-check late by milliseconds, and the Firestore rule remains the real gate (§4).
- **Double dialog instances** if the reveal block is duplicated per state → render it once for
  `showResult || lockedUpcoming`.
- **Timer leaks across many cards** → one chained timeout per card, cleared on unmount; far-future
  boundaries cost one 24 h timer, not per-second ticks.
