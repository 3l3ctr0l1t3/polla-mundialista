# 008 — Ingestion automation (cron)

> Status: 🟦 spec ready · Depends on: 004, 006 · Specialist: ingestion-engineer

## Why
Results must update automatically without a server. A scheduled GitHub Action (free on a public repo) polls
football-data.org, grades predictions, and rebuilds the leaderboard — the only server-side writer.

## User story
As a **participant**, I want **results and standings to update on their own during the tournament** so that
**the board stays current without anyone running anything manually**.

## Scope
- `scripts/ingest/` Node/TS job: football-data client (rate-limited), `firebase-admin` init from
  service-account secret, match upserts, grading via `src/shared/scoring.ts`, `buildLeaderboard`, standings,
  `config/meta` health write.
- `.github/workflows/ingest.yml`: cron (dense in match windows ~every 10 min, sparse off-hours) +
  `workflow_dispatch`; secrets `FOOTBALL_DATA_API_KEY`, `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_PROJECT_ID`.
- Repo is **public** → unlimited Actions minutes.

## Non-goals
- No new UI (consumes existing pages); no Cloud Functions (forbidden on Spark).

## Acceptance rules (definition of done)
1. A scheduled run fetches WC matches, upserts results, grades `FINISHED` matches, and rebuilds the leaderboard.
2. Re-running is **idempotent** (id-keyed upserts; `scoringVersion` guards re-grading; full leaderboard recompute).
3. Secrets are read only from GitHub Secrets; nothing sensitive is committed.
4. `workflow_dispatch` allows a manual run/regrade; failures exit non-zero (red run).
5. `config/meta.lastIngestRun` updates each successful run.

## Constitution links
- Two-writers rule (service account). No secrets in repo. Free-tier (public Actions).

## Notes / open questions
- football-data free scores are ~1–2 min delayed; grade only `FINISHED`; back off on HTTP 429.
- Script early-exits outside June 11 – July 19, 2026 to save minutes.
