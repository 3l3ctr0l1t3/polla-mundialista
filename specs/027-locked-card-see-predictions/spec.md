# 027 — Locked fixture card offers "See group predictions"

> Status: ⬜ not started · Depends on: 018, 019, 013 · Specialist: react-mui-builder

## Why
Once a prediction locks (lazy: kickoff − 10 min; strict: the batch cutoff from `config/tournament`),
today's `FixtureCard` just renders its steppers and Save button `disabled` — dead UI with nothing to do,
sometimes for **days** in strict groups. The card should instead offer the same "See group predictions"
action the live/finished state already has, reusing `MatchPredictionsDialog` (which already shows a
"reveals at kickoff" placeholder pre-kickoff), and show the viewer's own prediction read-only.

## User story
As a **group member** whose prediction for a match has locked, I want the fixture card to **show my own
pick and a "See group predictions" button instead of dead disabled controls**, so that **I always have a
useful action — and at kickoff the same dialog reveals everyone's picks**.

## Scope
- **`src/components/FixtureCard.tsx` only — a fourth visual state** for *locked-but-not-kicked-off*
  (server-corrected `now() ≥ lockTimeMs(match, mode, cutoffs)` and the match has not kicked off /
  `showResult` is false):
  - Remove the disabled steppers + Save/Update button in this window.
  - Render the **viewer's own prediction read-only** (or an explicit "no prediction" indication if they
    made none) — exact presentation decided in `plan.md`.
  - Render the **same "See group predictions" button** (`t('predictions.openDialog')`) already used in
    the live/finished state, opening the existing `MatchPredictionsDialog` for this match.
- **Lock gating, not kickoff gating:** the swap happens the instant the prediction locks per the
  existing `lockTimeMs(match, mode, cutoffs)` / `useSavePrediction` `locked` boolean — the same instant
  the rules enforce — in **both** lazy and strict modes. Between lock and kickoff the dialog shows its
  existing "reveals at kickoff" placeholder and performs **no query** of others' predictions
  (ticket 013 behavior, unchanged).
- **Localization:** any new copy (e.g. the "you predicted / no prediction" read-only text) added to
  **both** `src/i18n/locales/en.json` and `es.json` (key-parity rule since ticket 017); reuse existing
  `predictions.*` keys where they fit.
- **Theming:** all styling via MUI theme tokens from `src/theme/` — no hard-coded colors.
- **Tests:** extend `FixtureCard.test.tsx` to cover the locked-not-kicked-off state in both modes.

## Non-goals
- **No change to `firestore.rules`** — reveal-at-kickoff (013) and the lock rules (019) stay the
  authority, untouched.
- No change to `MatchPredictionsDialog` / `useMatchPredictions` behavior (the pre-kickoff placeholder
  already exists); no new page, route, dialog, or surface.
- No change to the editable (pre-lock) state or to the live/finished (`showResult`) state of the card.
- No change to `useSavePrediction`, `lockTimeMs`, the write path, scoring, or ingestion.
- No new Firestore reads pre-kickoff; no push/notification of the lock moment.

## Acceptance rules (definition of done)
Each rule is verifiable. These are what `/spec-verify` checks.
1. **Before lock — unchanged.** With server-corrected `now() < lockTimeMs`, the card renders the two
   goal steppers and the Save/Update button exactly as today (existing tests stay green).
2. **After lock, before kickoff — action swap.** With `now() ≥ lockTimeMs` and the match not yet
   kicked off, the card renders **no Save/Update button and no enabled-or-disabled steppers**; it
   renders the "See group predictions" button (`predictions.openDialog`), and clicking it opens
   `MatchPredictionsDialog`, which shows the existing "reveals at kickoff" placeholder and issues **no
   query** for others' predictions — asserted by component tests.
3. **After kickoff — unchanged.** Live/finished cards behave exactly as before ticket 027: result
   shown, same button, dialog lists everyone's predictions (existing reveal tests stay green).
4. **Own pick visible on the locked card.** In the locked-not-kicked-off window the card itself shows
   the viewer's saved prediction read-only without opening the dialog; if the viewer saved none, it
   shows a localized "no prediction" indication instead — component test for both cases.
5. **Both modes.** Rule 2 holds in a **lazy** group at `kickoff − 10min ≤ now < kickoff` and in a
   **strict** group from the relevant `config/tournament` batch cutoff onward, even when that cutoff is
   days before the match's own kickoff — component tests mock `lockTimeMs` inputs for both modes.
6. **No rules diff.** `git diff` shows zero changes to `firestore.rules`; `npm run test:rules` passes
   unchanged.
7. **Tests in place.** `FixtureCard.test.tsx` contains the locked-state tests of rules 2/4/5 (lazy and
   strict) and the full suite is green: `npm test`, `npm run build`, `npm run lint`,
   `npx prettier --check .`.
8. **i18n parity.** Every new key exists in **both** `en.json` and `es.json`; the i18n key-parity test
   is green and no missing-key fallback renders in the new state.
9. **Fully reactive — no refresh needed.** With the app left open, the card transitions
   **on its own** (a) from the editable state to the locked state when the server-corrected clock
   passes `lockTimeMs`, and (b) the open dialog transitions from the "reveals at kickoff" placeholder
   to the live prediction list when the clock passes `kickoff` — both without a page reload, remount,
   or user interaction. Component tests advance fake timers across each boundary and assert the swap.

## Constitution links
- **§4 Authoritative kickoff lock:** the UI swap is convenience gated by the server-corrected clock at
  the same instant (`lockTimeMs`) the rules enforce; `firestore.rules` remains the authority and is
  untouched.
- **§3 Two-writers rule:** no new write paths — this ticket only removes a (dead) write affordance;
  reads of others' predictions stay rules-gated to post-kickoff.
- **§7 Done = tested:** locked-state behavior in both modes ships with `FixtureCard.test.tsx` coverage
  (rules 2/4/5/7).

## Notes / open questions
- **Decision already made (do not re-ask):** the locked-window action is the **existing**
  `MatchPredictionsDialog` via the existing `predictions.openDialog` button — no new surface; and the
  swap fires at **lock time**, not kickoff.
- Exact read-only presentation of the viewer's own pick (e.g. plain score text where the steppers were,
  matching the "own prediction" treatment of the live/finished state) is the planner's call in
  `plan.md`; the spec only requires it be visible without opening the dialog (rule 4).
- The card already receives the viewer's prediction via `useGroupPredictions` (ticket 018), so rule 4
  needs **no new Firestore reads** — render from props/state already present.
- Assumption: "kicked off" continues to mean the card's existing `showResult` boundary (live/finished
  per `status`/`kickoff`); this ticket inserts the new state strictly between `locked` and that
  boundary, leaving both neighbors untouched.
- Strict-mode early lock means a user may see the locked card with **no prediction at all** for distant
  knockout matches — the "no prediction" indication of rule 4 covers this; copy should not imply the
  match is imminent.
- **Reactivity (rule 9) is a real design question:** `locked`/`kickedOff` are derived from `now()` at
  render time, so something must trigger a re-render at the `lockTimeMs` and `kickoff` instants
  (`CountdownToKickoff` ticks internally and does NOT re-render the card). The planner must pick the
  mechanism (e.g. a scheduled state tick at each boundary) — without adding a constant high-frequency
  re-render of every card.
