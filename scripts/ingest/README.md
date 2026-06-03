# Ingestion job (`scripts/ingest`)

The **only server-side writer** for Polla Mundialista. Polls football-data.org for WC 2026 results,
grades predictions with the **shared** scoring engine (`src/shared/scoring.ts` — never reimplemented),
rebuilds the leaderboard, upserts standings, and writes a health doc. Run by a public-repo GitHub Actions
cron (`.github/workflows/ingest.yml`) and manually via `workflow_dispatch`.

## What a run does

1. Early-exits outside the tournament window (2026-06-11 .. 2026-07-19 UTC) unless `INGEST_FORCE=1`.
2. Fetches `GET /v4/competitions/WC/matches?season=2026` and `…/standings` (rate-limited, 429 backoff).
3. Upserts `matches/{fdId}` — idempotent, id-keyed; `utcDate` → Firestore `Timestamp`.
4. Grades `FINISHED` matches on **full-time 90'** (ignores ET/penalties), writing `points`/`breakdown`
   to `predictions/{uid}_{matchId}`. A per-prediction `scoringVersion` guard prevents double-grading.
5. Rebuilds the **full** `leaderboard/{uid}` each run (dense rank; tiebreakers points → exact → outcome
   → displayName).
6. Upserts `standings/{group}` (TOTAL tables only).
7. Writes `config/meta.lastIngestRun` (+ `lastIngestAt`).

Idempotent by design: id-keyed match upserts, the `scoringVersion` guard, and a full leaderboard recompute
make retries and reruns safe.

## Files

| File                  | Role                                                                           |
| --------------------- | ------------------------------------------------------------------------------ |
| `index.ts`            | Orchestrator. `npm run ingest`.                                                |
| `footballData.ts`     | v4 client: `X-Auth-Token`, serialized, ≤10 req/min, 429 backoff.               |
| `firestoreAdmin.ts`   | `firebase-admin` init from env/secret/local key. No hard-coded secrets.        |
| `mapMatch.ts`         | football-data match → Firestore `Match` (admin `Timestamp`, TBD placeholders). |
| `buildLeaderboard.ts` | Pure dense-rank aggregation.                                                   |
| `scoring.ts`          | Thin re-export of the shared engine — single source of truth.                  |
| `types.ts`            | football-data v4 wire types.                                                   |
| `sample/`             | Saved sample responses for OFFLINE unit tests.                                 |
| `*.test.ts`           | node-env vitest tests (mapping + grading + leaderboard).                       |

## Run the tests (offline — no creds, no network, no emulator)

```bash
npm run test:ingest
```

These exercise `mapMatch` + `buildLeaderboard` against `sample/*.json` using the real scoring engine.

---

## PENDING — credentials & CI (not in the repo; repo is PUBLIC)

A **real** run (`npm run ingest`) and the live cron need secrets that are intentionally absent here.

### 1. football-data.org API key

- Register at <https://www.football-data.org/client/register> for a free-tier token.

### 2. Firebase service-account JSON

- Firebase Console → Project Settings → Service accounts → **Generate new private key**.
- The downloaded JSON is a secret. Patterns like `*serviceAccount*.json` are gitignored — keep it that way.

### 3. Firebase project id

- From the Firebase console (e.g. `polla-mundialista`).

### Local run

Create a gitignored `scripts/ingest/.env` (or repo-root `.env`):

```dotenv
FOOTBALL_DATA_API_KEY=your_football_data_token
FIREBASE_PROJECT_ID=your_project_id
# EITHER inline the service-account JSON as one line:
# FIREBASE_SERVICE_ACCOUNT={"type":"service_account", ... }
# OR point to a key file:
GOOGLE_APPLICATION_CREDENTIALS=./scripts/ingest/serviceAccount.json
```

Then place the key file (gitignored) and run:

```bash
# place scripts/ingest/serviceAccount.json (gitignored), then:
INGEST_FORCE=1 npm run ingest   # force a run outside the tournament window
```

`firestoreAdmin.ts` resolves credentials in order: `FIREBASE_SERVICE_ACCOUNT` (inline JSON) →
`GOOGLE_APPLICATION_CREDENTIALS` (path) → `scripts/ingest/serviceAccount.json`.

### GitHub Actions (live cron)

In the **public** repo, set **Settings → Secrets and variables → Actions**:

- `FOOTBALL_DATA_API_KEY`
- `FIREBASE_SERVICE_ACCOUNT` — paste the entire service-account JSON
- `FIREBASE_PROJECT_ID`

The workflow runs dense (~10 min) in match windows, sparse off-hours, plus manual `workflow_dispatch`
(with a `force` toggle). The job early-exits outside the tournament window and exits non-zero on error.

### Seeding fixtures (once)

`config/scoring` (optional — defaults to exact=5/outcome=3/gd-bonus=1 if absent) and `config/meta`
(`competition`, `season`, `tournamentStart`, `tournamentEnd`) should exist before the first run.
`users` and `predictions` are written by the web app; the job only reads them for grading + the board.
