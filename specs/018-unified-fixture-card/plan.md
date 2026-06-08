# 018 — Plan

> Generated from spec.md. Technical design only — no behavior the spec doesn't call for.

## Approach
Build ONE production card, `FixtureCard`, that merges today's `MatchCard` (status/score + reveal
dialog) and `PredictionCard`/`PredictionInput` (score steppers + save). It uses the locked centered
layout from `MatchLabCard` (each team = a centered column with NAME above FLAG; prediction steppers or
result score centered beneath) but is fully wired and localized.

To reuse the tested write logic without the old layout, extract `PredictionInput`'s save into a hook
`useSavePrediction(gid, match, existing, now)` that owns: home/away state (synced to `existing`), the
server-time `locked` flag, `save()` (setDoc merge with `createdAt` only on first write, never
points/breakdown), and the success/permission-denied snackbar state. `FixtureCard` renders the centered
steppers + Save/Update button from that hook for **upcoming** matches, and for **live/finished** shows
the score + the viewer's own prediction subtly + a button opening the existing `MatchPredictionsDialog`
(reveal-at-kickoff, rules-gated) to see everyone's picks. A `CountdownToKickoff` chip shows on upcoming
cards.

`FixturesPage` renders a `FixtureCard` per match (it already has `useMatches`; add
`useGroupPredictions(gid)` + `useServerTime` to feed each card its `existing` prediction and `now`).
The **Predictions page is deleted** — route, nav item, `PredictionsPage`, and the now-orphan
`PredictionCard` + `PredictionInput` (logic lives in the hook). `MatchCard` stays (used by the
superadmin Canvas only). NO firestore.rules change — the kickoff lock + reveal rules already exist.

## Files to create / change
| Path | Change | Notes |
|------|--------|-------|
| `src/hooks/useSavePrediction.ts` | new | Extracted from PredictionInput: state, `locked`, `save()`, snack. The ONE write path. |
| `src/hooks/useSavePrediction.test.ts` | new | Save ref/shape (own prediction, no points/breakdown); locked past kickoff blocks save; permission-denied → locked snackbar. |
| `src/components/FixtureCard.tsx` | new | Centered unified card; consumes `useSavePrediction`, `MatchPredictionsDialog`, `CountdownToKickoff`; localized `t()`. |
| `src/components/FixtureCard.test.tsx` | new | Editable steppers pre-kickoff; score + own prediction post; save calls correct ref; reveal button only after kickoff. |
| `src/pages/FixturesPage.tsx` | edit | Render `FixtureCard` per match; add `useGroupPredictions(gid)` + `useServerTime`; pass `existing`, `now`, `gid`. |
| `src/pages/FixturesPage.test.tsx` | edit | Assert a FixtureCard per match (mock the new hooks). |
| `src/group/GroupApp.tsx` | edit | Remove `PredictionsPage` import + `predictions` route; add redirect `predictions` → `fixtures`. Keep Canvas wiring. |
| `src/components/navItems.tsx` | edit | Remove the `predictions` entry from `defaultNavItems`. |
| `src/pages/PredictionsPage.tsx` | delete | superseded |
| `src/pages/PredictionsPage.test.tsx` | delete | superseded |
| `src/components/PredictionCard.tsx` | delete | unused after (verify no other importers) |
| `src/components/PredictionInput.tsx` | delete | logic moved to `useSavePrediction` |
| `src/components/PredictionInput.test.tsx` | delete/replace | covered by `useSavePrediction.test.ts` |
| `src/i18n/locales/en.json` + `es.json` | edit | add `predictions.yourPrediction`; remove `nav.predictions` from BOTH (keep parity) |
| `specs/backlog.md` | edit | status |

## Data shapes / interfaces
```ts
// src/hooks/useSavePrediction.ts
export interface UseSavePrediction {
  homeGoals: number
  awayGoals: number
  setHomeGoals: (n: number) => void
  setAwayGoals: (n: number) => void
  locked: boolean            // now() >= match.kickoff (server-corrected)
  saving: boolean
  snack: { message: string; severity: 'success' | 'error' } | null
  dismissSnack: () => void
  save: () => Promise<void>  // setDoc(groupPredictionDoc(gid,uid,matchId), {...}, {merge:true})
}
export function useSavePrediction(
  gid: string, match: Match, existing: Prediction | undefined, now: () => number,
): UseSavePrediction

// FixtureCard
export interface FixtureCardProps { gid: string; match: Match; existing?: Prediction; now: () => number }
```
i18n key to add (both bundles): `predictions.yourPrediction` = "Your prediction {{home}}–{{away}}" /
"Tu predicción {{home}}–{{away}}". Remove `nav.predictions` from en + es.

## Reused utilities
- `useSavePrediction` reuses the exact write logic from `src/components/PredictionInput.tsx` (~lines 133-167):
  `groupPredictionDoc`, `serverTimestamp`, createdAt-only-on-first-write, permission-denied handling.
- `MatchPredictionsDialog` + `useMatchPredictions` — reveal-at-kickoff for others' picks (unchanged).
- `CountdownToKickoff` — countdown chip on upcoming cards.
- `useGroupPredictions(gid)`, `useServerTime`, `isTbdTeam`, `Match`/`Prediction` types — as today.
- Centered layout copied from `src/components/MatchLabCard.tsx` (the locked design), localized.

## Test strategy
- **AC2 (save):** `useSavePrediction.test.ts` — `save()` calls setDoc with `groupPredictionDoc(gid,uid,matchId)`
  and payload `{uid,matchId,homeGoals,awayGoals,updatedAt(,createdAt)}`, never `points`/`breakdown`.
- **AC3 (lock):** hook test — `locked` true when `now() >= kickoff`; `save()` no-ops/blocks when locked.
  FixtureCard test asserts steppers disabled past kickoff. Rules kickoff-lock suite unchanged (still green).
- **AC1 (one surface):** FixturesPage test — a FixtureCard per match; GroupApp route — `predictions`
  redirects to `fixtures` and no `predictions` nav item.
- **AC4 (reveal):** FixtureCard test — own prediction shown on played card; reveal button opens
  `MatchPredictionsDialog` only when kicked off (reuse existing reveal tests).
- **AC5 (i18n):** key-parity test stays green after adding `predictions.yourPrediction` / removing `nav.predictions`.
- **AC6/7 (gates / no backbone change):** build, test, test:rules (unchanged), lint, prettier; diff shows no
  scoring/ingest/rules edits.

## Risks
- **Orphan deletions break imports** → grep `PredictionCard`/`PredictionInput`/`PredictionsPage` usages before
  deleting; the only importers are the Predictions page + PredictionCard (both removed) — verify.
- **Losing tested write behavior** → move it verbatim into `useSavePrediction` and port the PredictionInput
  test assertions onto the hook so coverage doesn't regress.
- **Reveal-at-kickoff regression** → reuse `MatchPredictionsDialog`/`useMatchPredictions` untouched; the rules
  already gate others' predictions — do not change rules.
- **Key parity break** → add/remove i18n keys in BOTH en.json and es.json in the same edit.
- **Canvas entanglement** → `MatchCard` stays (Canvas uses it); only FixturesPage stops using it.
