# 010 — Plan

> Generated from spec.md. Operational ticket: ship to production, verify integrity, harden secrets.

## Approach
With all feature tickets code-complete, deploy the full app + rules to the live Spark project, run a
secret scan on the public repo, and confirm the security posture. The end-to-end smoke (two accounts
predicting, ingestion → live leaderboard) and the cron activation are gated on the credentials in the
backlog PENDING list, so they are documented as the remaining manual promotion steps.

## Files to create / change
| Path | Change | Notes |
|------|--------|-------|
| (operational) | — | `firebase deploy` (hosting + rules + indexes); no source changes |
| specs/backlog.md | edit | statuses + PENDING follow-ups |

## Test strategy
- Live hosting returns HTTP 200 and serves the app shell.
- Firestore rules: emulator tests green (35) + rules deployed and compiled.
- Secret scan: no `.env*`, service-account JSON, or private-key markers in tracked files/history.
- Quality gates: build, app tests (65), rules tests (35), ingest tests (9), lint, prettier.

## Risks
- A leaked secret in a public repo is permanent → secret-guard hook + `.gitignore` + scan; service
  account never generated into the repo.
- E2E behavior (sign-in, lock, scoring) can only be fully verified once the Google provider + data are
  wired — tracked as PENDING, not silently assumed.
