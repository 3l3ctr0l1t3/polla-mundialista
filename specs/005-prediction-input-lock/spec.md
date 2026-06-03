# 005 — Prediction input & kickoff lock

> Status: 🟦 spec ready · Depends on: 003 · Specialist: react-mui-builder + firestore-rules-engineer

## Why
The core interaction: each participant predicts a scoreline per match, and predictions must lock at kickoff
so no one can predict after a match starts.

## User story
As a **participant**, I want **to enter and edit my predicted score for each upcoming match until it kicks
off** so that **my picks are fair and final once play begins**.

## Scope
- `PredictionsPage` listing upcoming matches; `PredictionInput` (home/away goal steppers).
- `CountdownToKickoff` using a **server-time offset** (`useServerTime`) so a wrong local clock can't unlock.
- Write to `predictions/{uid}_{matchId}` via `setDoc`; disable input at kickoff.
- Handle a rules-rejected late write with a "match already started" snackbar.

## Non-goals
- No scoring/points display logic beyond showing the user's own saved prediction (points come from 006/007).

## Acceptance rules (definition of done)
1. A participant can enter/edit `homeGoals`/`awayGoals` (ints ≥0) for a match **before** kickoff and the
   value persists.
2. At/after kickoff the input is disabled in the UI **and** a forced late write is rejected by rules.
3. Exactly one prediction exists per user per match (`{uid}_{matchId}`); editing updates it.
4. The countdown reflects server time, not the device clock.

## Constitution links
- Authoritative kickoff lock. Two-writers rule.

## Notes / open questions
- Server-time offset source: Firestore `serverTimestamp` round-trip on load.
