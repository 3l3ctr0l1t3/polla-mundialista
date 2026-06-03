# 004 — Fixtures & results display

> Status: 🟦 spec ready · Depends on: 003 · Specialist: react-mui-builder + ingestion-engineer

## Why
Participants need to see the schedule, live/finished scores, and group standings. This also proves the
data model end-to-end by seeding real World Cup fixtures.

## User story
As a **participant**, I want **to browse fixtures, results, and group tables** so that **I can follow the
tournament and plan my predictions**.

## Scope
- Ingestion fetch+map that reads `/v4/competitions/WC/matches?season=2026` and upserts `matches/*`; run once
  locally to **seed all 104 matches**. (Shared with ticket 008's job.)
- `FixturesPage` (matches grouped by day), `MatchCard`, `StandingsPage` (group tables), `ScoreChip`.
- Live updates via `onSnapshot`; "updated N min ago" badge from `config/meta`.

## Non-goals
- No prediction input (005); no automated cron yet (008).

## Acceptance rules (definition of done)
1. Seeding populates all 104 WC 2026 matches in Firestore with teams, group, `kickoff`, `status`.
2. `FixturesPage` lists matches grouped by day and reflects status (SCHEDULED/IN_PLAY/FINISHED) live.
3. `StandingsPage` renders the 12 group tables.
4. Knockout matches with undecided teams render gracefully as **TBD placeholders**.
5. UI shows a data-freshness indicator from `config/meta.lastIngestRun`.

## Constitution links
- Two-writers rule (results read-only to client). Free-tier (football-data free).

## Notes / open questions
- If football-data free tier lacks WC fixtures, fall back to openfootball/rezarahiminia JSON for fixtures.
