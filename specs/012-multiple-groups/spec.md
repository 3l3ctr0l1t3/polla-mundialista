# 012 — Multiple groups (multi-tenant pools) — PARKED

> Status: ⬜ parked (design later) · Depends on: 011 · Specialist: firestore-rules-engineer + react-mui-builder

## Why
Run several independent pools at once (friends, family, work…), each with its own members and leaderboard,
sharing the same World Cup fixtures/results.

## Direction (not yet specified in detail — to be designed when we get here)
- `groups/{groupId}` (name, owner, **invite code/link**) and `groups/{groupId}/members/{uid}`
  (generalizes ticket 011's single `members` collection).
- **Scope predictions and leaderboards per group** — today they are global. Affects the data model (003),
  predictions (005), leaderboard (007), security rules, and ingestion (008 grades + builds a leaderboard
  **per group**). Matches/standings stay global.
- UI: create a group, join by link, a **group switcher**, per-group approval.

## Open decisions (deferred)
- Who can create groups (only admin vs. any approved user) — **deferred, decide at design time**.
- Whether 011's `members/{uid}` migrates into `groups/{defaultGroupId}/members/{uid}`.

## Non-goals (for now)
- Everything — this ticket is a placeholder. Author the full spec via `/spec-plan`/refinement before building.
