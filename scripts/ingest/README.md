# Ingestion job (`scripts/ingest`)

The **only server-side writer** for Polla Mundialista. Polls football-data.org for WC 2026 results,
grades predictions with the **shared** scoring engine (`src/shared/scoring.ts` — never reimplemented),
rebuilds **each group's** leaderboard, upserts standings, and writes a health doc. Run by a public-repo
GitHub Actions cron (`.github/workflows/ingest.yml`) and manually via `workflow_dispatch`.

Since ticket 012 the pool is **multi-tenant**: predictions and leaderboards live under
`groups/{groupId}/…`, while **matches, standings, and config stay GLOBAL** (top-level, one copy shared by
every group).

## What a run does

1. Early-exits outside the tournament window (2026-06-11 .. 2026-07-19 UTC) unless `INGEST_FORCE=1`.
2. Fetches `GET /v4/competitions/WC/matches?season=2026` and `…/standings` (rate-limited, 429 backoff).
3. **[global]** Upserts `matches/{fdId}` — idempotent, id-keyed; `utcDate` → Firestore `Timestamp`.
4. **[global]** Upserts `standings/{group}` (TOTAL tables only).
5. **[per group]** For each doc in `groups/*`:
   - Resolves the **participant set** = approved members (`groups/{gid}/members` where
     `status === 'approved'`) **∪ the implicit owner** (`groups/{gid}.ownerUid`, who carries **no member
     doc** — they are an implicit approved admin).
   - Grades `FINISHED` matches on **full-time 90'** (ignores ET/penalties) for that group's predictions,
     writing `points`/`breakdown` to `groups/{gid}/predictions/{uid}_{matchId}`. Only participants are
     graded. A per-prediction `scoringVersion` guard prevents double-grading.
   - Rebuilds that group's `groups/{gid}/leaderboard/{uid}` from its graded predictions (dense rank;
     tiebreakers points → exact → outcome → displayName), deleting any stale rows for ex-members.
6. Writes `config/meta.lastIngestRun` (+ `lastIngestAt`) with totals across all groups.

Grading + leaderboards are **isolated per group**: the same user can hold a different score in each group,
and one group's roster never leaks into another's board. A pending/rejected member is never graded.

Idempotent by design: id-keyed match upserts, the `scoringVersion` guard, and a full per-group leaderboard
recompute (with stale-row cleanup) make retries and reruns safe.

### Owner display names

The implicit owner has no member doc, so their `displayName`/`photoURL` are backfilled from the global
`users/{ownerUid}` profile (falling back to the bare uid). The same backfill covers any member doc that is
missing a name.

## Files

| File                  | Role                                                                              |
| --------------------- | --------------------------------------------------------------------------------- |
| `index.ts`            | Orchestrator. `npm run ingest`.                                                   |
| `footballData.ts`     | v4 client: `X-Auth-Token`, serialized, ≤10 req/min, 429 backoff.                  |
| `firestoreAdmin.ts`   | `firebase-admin` init from env/secret/local key. No hard-coded secrets.           |
| `mapMatch.ts`         | football-data match → Firestore `Match` (admin `Timestamp`, TBD placeholders).    |
| `buildLeaderboard.ts` | Pure dense-rank aggregation for **one group** (predictions + participant set).    |
| `scoring.ts`          | Thin re-export of the shared engine — single source of truth.                     |
| `types.ts`            | football-data v4 wire types.                                                      |
| `sample/`             | Saved sample responses for OFFLINE unit tests (`matches`, `standings`, `groups`). |
| `*.test.ts`           | node-env vitest tests (mapping + per-group grading + per-group leaderboard).      |

## Run the tests (offline — no creds, no network, no emulator)

```bash
npm run test:ingest
```

These exercise `mapMatch` + `buildLeaderboard` against `sample/*.json` using the real scoring engine.
`groups.test.ts` drives the per-group pipeline (resolve participants → grade → build board) against a
**two-group** fixture (`sample/groups.json`) with overlapping users and asserts each group's grading +
leaderboard are independent, that the **implicit owner** participates, and that pending members / IN_PLAY
matches are never graded.

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
(`competition`, `season`, `tournamentStart`, `tournamentEnd`) should exist before the first run. `groups/*`
(with their `members` + `predictions` subcollections) and `users` are written by the web app; the job only
reads them for per-group grading + each group's board, and writes back `points`/`breakdown` plus
`groups/{gid}/leaderboard/*`.
