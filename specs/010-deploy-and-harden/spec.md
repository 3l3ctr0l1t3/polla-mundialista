# 010 — Deploy & harden

> Status: 🟦 spec ready · Depends on: all · Specialist: acceptance-verifier

## Why
Final gate before the June 11 kickoff: ship to production, confirm security, and make sure no secret ever
reached the public repo.

## User story
As a **pool organizer**, I want **the app live, secure, and frozen before kickoff** so that **friends can
use it reliably during the tournament**.

## Scope
- Production `firebase deploy` (hosting + rules + indexes).
- Final security-rules review against the two-writers rule and kickoff lock.
- Secret scan of git history; confirm `.gitignore` coverage; rotate any exposed key.
- Smoke test end-to-end with two accounts.

## Non-goals
- No new features after freeze.

## Acceptance rules (definition of done)
1. App is deployed and reachable; rules + indexes deployed.
2. Security-rules review signed off; emulator tests green.
3. **Secret scan of the repo and history is clean** (no API key or service-account JSON committed).
4. End-to-end smoke: two accounts sign in, predict, `workflow_dispatch` ingests, leaderboard updates live;
   pre/post-kickoff lock behaves correctly.
5. Ingestion workflow scheduled and confirmed running.

## Constitution links
- No secrets in repo. Two-writers rule. Authoritative kickoff lock. Done = verified.

## Notes / open questions
- Plan to disable the cron after July 19, 2026 (tournament end).
