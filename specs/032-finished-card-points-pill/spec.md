# 032 — Finished card: points pill + constant card size in every state

> Status: ⬜ not started · Depends on: 027, 025 · Specialist: react-mui-builder

## Why
Canvas iteration (2026-06-11, user-approved option **C**): a finished match card should show the
final score, the viewer's prediction, and a small bottom-right **dot + points pill** tinted by how
the pick did — and the card must keep **exactly the same size in every state** (today it grows or
shrinks as buttons/captions come and go).

## User story
As a **player**, I want **the finished card to show my points at a glance (green/orange/red) with
no layout jumps between states** so that **scanning the fixtures list feels stable and rewarding**.

## Scope
- **`FixtureCard` layout normalized to three fixed zones** in ALL states:
  top row · teams/center slot (existing 84px min-height; own-pick caption and the locked
  "no prediction" caption move INSIDE it, stacked under the score/dash) · a **fixed-height footer
  slot** that holds exactly one thing per state:
  - editable → Save/Update button
  - locked-upcoming & live → "See group predictions" button
  - finished → empty (the pill overlays bottom-right) — **no button**
  - upcoming-TBD → empty
- **Points pill (option C)** on FINISHED cards when the viewer has a prediction: small outlined
  pill, bottom-right corner, dot + "N pts", tinted by best tier — green `success` = exact,
  orange `warning` = correct outcome only, red `error` = missed. Points/breakdown come from the
  ingestion-written `existing.points`/`existing.breakdown` when present; otherwise computed
  client-side with the shared engine (`scorePrediction` + `effectiveScoring(group)` + stage).
  No prediction → no pill.
- **Finished card stays a doorway:** with the button gone, tapping/clicking the finished card
  opens the existing `MatchPredictionsDialog` (accessible affordance, e.g. button-role overlay or
  CardActionArea; localized label).
- All new copy in `en.json` AND `es.json`; colors via theme tokens only.

## Non-goals
- No scoring-engine, dialog, hook, rules, or ingestion changes. No redesign of the editable
  steppers. No pill on live (IN_PLAY) cards — grading happens only at FINISHED.

## Acceptance rules (definition of done)
1. **Constant size:** every state (editable · locked-upcoming with/without pick · TBD-upcoming ·
   live · finished with/without pick) renders the same three-zone structure with the fixed-height
   footer present — asserted structurally in component tests (footer element exists in all states).
2. **Pill correctness:** finished + prediction → pill renders "N pts" using ingestion points when
   present, else the shared-engine computation (group-config aware); tinted success/warning/error
   by exact/outcome/miss — component tests cover all three tiers and the ingestion-vs-computed
   source.
3. **No pill** on finished cards without a prediction, and on live/locked/editable cards.
4. **Finished card opens the dialog** via an accessible click affordance (no button row); the
   locked/live states keep their "See group predictions" button exactly as in 027/031.
5. **Captions relocated:** own-pick caption renders inside the center slot on live/finished;
   locked no-pick caption inside the center slot; none of them add a row outside the zones.
6. Full gates green (`npm test`, `npm run build`, `npm run lint`, prettier on touched files);
   en/es key parity for any new keys.

## Constitution links
- §2 single scoring engine (client preview uses the SAME shared module); §3 two-writers (display
  only — never writes points); §7 done = tested.
