# 003 — Data model & security rules

> Status: 🟦 spec ready · Depends on: 001 · Specialist: firestore-rules-engineer

## Why
The integrity of the whole pool rests on the data model and the security rules: who can write what, and
the kickoff lock. This is the riskiest surface and gets a dedicated specialist + emulator tests.

## User story
As a **pool organizer**, I want **a data model and rules that make results tamper-proof and predictions
lockable** so that **no one can cheat by editing scores or late predictions**.

## Scope
- TypeScript typed Firestore converters for: `users`, `matches`, `predictions`, `leaderboard`, `standings`,
  `config` (shapes per the plan).
- `firestore.rules` enforcing the **two-writers rule**, the **kickoff lock**, and **no `points`/`breakdown`
  tampering**.
- `firestore.indexes.json` with required composite indexes.
- Firestore emulator rules-unit-tests.

## Data shapes (summary)
- `matches/{matchId}` — `matchId` = football-data id as string; fields incl. `kickoff` (UTC Timestamp),
  `status`, `score`, `stage`, `group`, denormalized teams.
- `predictions/{uid}_{matchId}` — `homeGoals`, `awayGoals` (ints ≥0); `points`/`breakdown` written by
  ingestion only.
- `leaderboard/{uid}`, `standings/{groupId}`, `config/{scoring|allowlist|meta}`.

## Non-goals
- No UI; no scoring logic (ticket 006); no ingestion (ticket 008).

## Acceptance rules (definition of done)
1. Clients can **read** `matches`/`leaderboard`/`standings`/`config` but **cannot write** them.
2. A prediction write is **allowed before** the match `kickoff` and **rejected at/after** it
   (`request.time < match.kickoff`, server time).
3. A user can write **only their own** prediction (`uid` match + doc-id prefix); cannot set `points`.
4. Emulator rules-unit-tests cover: pre/post kickoff, ownership, points-tampering, results-write-denied —
   and all pass.

## Constitution links
- Two-writers rule. Authoritative kickoff lock. Done = emulator tests pass.

## Notes / open questions
- Predictions are owner-only readable in v1 (privacy); revisit a post-kickoff reveal later.
