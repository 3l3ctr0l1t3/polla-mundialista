# 007 — Leaderboard

> Status: 🟦 spec ready · Depends on: 003, 006 · Specialist: react-mui-builder + ingestion-engineer

## Why
The competitive payoff: a live ranked board. It must be server-built so raw predictions can stay private
(friends shouldn't see each other's picks before kickoff).

## User story
As a **participant**, I want **a live ranking of everyone by points** so that **I can see who's winning**.

## Scope
- `buildLeaderboard` (in the ingestion job) aggregates graded predictions per user into `leaderboard/{uid}`.
- Tiebreakers via dense rank: `totalPoints → exactCount → outcomeCount → displayName`.
- `LeaderboardPage` + `LeaderboardRow`, live via `onSnapshot`.

## Non-goals
- No per-match prediction reveal (predictions remain owner-only in v1).

## Acceptance rules (definition of done)
1. `leaderboard/{uid}` reflects the sum of each user's graded predictions and updates after each ingest run.
2. Ranking applies the tiebreaker chain; ties share a rank (e.g. "T-3").
3. `LeaderboardPage` updates live without refresh when scores change.
4. Raw predictions are **not** readable by other clients — only the aggregate leaderboard is.

## Constitution links
- Two-writers rule (leaderboard written only by ingestion). Single shared scoring engine.

## Notes / open questions
- Whole leaderboard rewritten each run (tiny N) to avoid increment drift.
