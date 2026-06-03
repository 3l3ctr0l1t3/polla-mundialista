# 008 — Plan

> Generated from spec.md. Technical design only — no behavior the spec doesn't call for.

## Approach
A standalone Node/TS job under `scripts/ingest/`, run by a public-repo GitHub Actions cron (and
`workflow_dispatch`). Each run:

1. **Early-exit** if the current UTC date is outside the tournament window (2026-06-11 .. 2026-07-19) —
   saves Actions minutes. `workflow_dispatch` can override via an input flag.
2. **Fetch** WC matches + standings from football-data.org v4 with a serialized, rate-limited client
   (`X-Auth-Token` header, ≤10 req/min, exponential backoff on HTTP 429).
3. **Upsert matches** into `matches/{fdId}` — id-keyed and idempotent (`utcDate` → Firestore Timestamp).
4. **Grade** `FINISHED` matches with the **shared** engine `src/shared/scoring.ts` (never reimplemented),
   writing `points`/`breakdown` to each `predictions/{uid}_{matchId}`. A `scoringVersion` guard on each
   prediction avoids re-grading already-graded predictions at the same scoring version.
5. **Rebuild leaderboard** from scratch each run: aggregate every graded prediction into
   `leaderboard/{uid}` with dense rank + tiebreakers (points → exact → outcome → displayName).
6. **Upsert standings** into `standings/{group}`.
7. **Write health** to `config/meta.lastIngestRun` (and `lastIngestAt`).

The job is **pure-functions-where-possible**: `mapMatch` and `buildLeaderboard` are side-effect-free and
unit-tested offline against a saved `sample/` fixture using the **real** scoring engine — no network, no
credentials, no emulator.

## Files to create / change
| Path | Change | Notes |
|------|--------|-------|
| `scripts/ingest/footballData.ts` | new | v4 client; rate-limit + 429 backoff |
| `scripts/ingest/firestoreAdmin.ts` | new | `firebase-admin` init from env/secret; no hard-coded secret |
| `scripts/ingest/mapMatch.ts` | new | football-data match → Firestore `Match` (admin Timestamp) |
| `scripts/ingest/scoring.ts` | new | thin re-export of `src/shared/scoring.ts` (single source of truth) |
| `scripts/ingest/buildLeaderboard.ts` | new | pure aggregation → dense-ranked `LeaderboardEntry[]` |
| `scripts/ingest/index.ts` | new | orchestrator (fetch→upsert→grade→leaderboard→standings→meta) |
| `scripts/ingest/types.ts` | new | football-data v4 response types (internal) |
| `scripts/ingest/tsconfig.json` | new | Node-oriented TS config for the job |
| `scripts/ingest/vitest.config.ts` | new | node-env config; isolates ingest tests from jsdom app setup |
| `scripts/ingest/sample/matches.json` | new | saved sample `/matches` response (offline tests) |
| `scripts/ingest/sample/standings.json` | new | saved sample `/standings` response |
| `scripts/ingest/mapMatch.test.ts` | new | unit tests (node env) |
| `scripts/ingest/buildLeaderboard.test.ts` | new | unit tests (node env) using real scoring engine |
| `scripts/ingest/README.md` | new | how to supply secrets + run locally + seed fixtures |
| `.github/workflows/ingest.yml` | new | cron (dense/sparse) + workflow_dispatch + secrets |
| `package.json` | edit | add `ingest` + `test:ingest` scripts (only batch agent allowed) |

## Data shapes / interfaces
```ts
// Admin-side mirrors of src/shared/types.ts, but using firebase-admin Timestamp.
// mapMatch(raw, now): MatchDoc                     // utcDate → Timestamp
// buildLeaderboard(predictions, users): LeaderboardEntry[]   // pure, dense rank
// gradeMatch uses scorePrediction(pred, actual, cfg) from src/shared/scoring.ts
```

## Reused utilities
- `src/shared/scoring.ts` — `scorePrediction`, `DEFAULT_SCORING`, `ScoringConfig`, `Scoreline`,
  `ScoreBreakdown` (imported read-only; never duplicated — constitution principle 2).
- `src/shared/types.ts` — `Match`, `Prediction`, `LeaderboardEntry`, `Standing`, `MatchStatus`, etc.
  (referenced for shape parity; the job uses admin `Timestamp`).

## Test strategy
- `mapMatch.test.ts` — maps the saved sample, asserts id/status/stage/group/teams (incl. TBD placeholders)
  and that `utcDate` becomes an admin `Timestamp` at the right epoch.
- `buildLeaderboard.test.ts` — grades sample predictions with the **real** engine, then asserts totals,
  exact/outcome counts, dense rank and the full tiebreaker chain (points→exact→outcome→displayName).
- Both run in a **node** environment via `scripts/ingest/vitest.config.ts` (no jsdom, no app setup file,
  no emulator, no creds): `npm run test:ingest`.
- Acceptance rules 1–2 (fetch/upsert/grade/rebuild + idempotency) are exercised by the orchestrator's
  pure helpers offline; live writes (rules 3–5) are validated by a real run once credentials exist (PENDING).

## Risks
- football-data free tier rate limit (10 req/min) → serialized client with a min-interval gate + 429 backoff.
- Double-grading on reruns → `scoringVersion` guard per prediction + idempotent id-keyed match upserts.
- Knockout `score.fullTime` already excludes ET/penalties on football-data → grade `fullTime` directly,
  matching the engine's `gradeOn: 'fullTime90'`.
- TBD knockout teams (no team id yet) → mapped to stable placeholder `Team`s so docs stay well-formed.

## PENDING (real runs / CI)
A live run requires credentials that are intentionally **not** in the repo:
1. **football-data.org API key** → GitHub Secret `FOOTBALL_DATA_API_KEY` (and local `.env`).
2. **Firebase service-account JSON** → GitHub Secret `FIREBASE_SERVICE_ACCOUNT` (and a gitignored local
   `scripts/ingest/serviceAccount.json` or `GOOGLE_APPLICATION_CREDENTIALS`).
3. **Firebase project id** → GitHub Secret `FIREBASE_PROJECT_ID`.
4. A **public** GitHub repo (unlimited Actions minutes) with those three secrets configured.
See `scripts/ingest/README.md` for exact steps.
